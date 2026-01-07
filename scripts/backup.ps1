<#
.SYNOPSIS
    LIMS Docker Stack Backup Script (Machine 1)

.DESCRIPTION
    Creates a complete backup of the LIMS Docker stack including:
    - PostgreSQL database dump (pg_dumpall)
    - Docker volumes (postgres-data, storage-data)
    - Project files (excluding node_modules, .next)
    - SHA256 checksums for integrity verification

.PARAMETER OutputDir
    Directory to store backup files. Defaults to .\lims-backup-<timestamp>

.PARAMETER SkipProjectArchive
    Skip creating project archive (use if transferring via git clone)

.EXAMPLE
    .\backup.ps1
    .\backup.ps1 -OutputDir D:\backups\lims-2024
    .\backup.ps1 -SkipProjectArchive

.NOTES
    Run from the lims-lite project directory
    Requires Docker Desktop running
    Estimated time: 5-15 minutes depending on data size
#>

param(
    [string]$OutputDir = "",
    [switch]$SkipProjectArchive
)

# Configuration
$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot | Split-Path -Parent
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not $OutputDir) {
    $OutputDir = Join-Path $ProjectDir "lims-backup-$Timestamp"
}

# Colors for output
function Write-Step { param($msg) Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [X] $msg" -ForegroundColor Red }

# Banner
Write-Host @"

  =====================================================
   LIMS Docker Stack Backup Script
   Timestamp: $Timestamp
  =====================================================

"@ -ForegroundColor Magenta

# Verify we're in the right directory
Write-Step "Verifying environment..."

if (-not (Test-Path (Join-Path $ProjectDir "docker-compose.yml"))) {
    Write-Fail "docker-compose.yml not found in $ProjectDir"
    Write-Host "  Please run this script from the lims-lite directory"
    exit 1
}
Write-Success "Found docker-compose.yml"

# Check Docker is running
try {
    $null = docker info 2>&1
    Write-Success "Docker is running"
} catch {
    Write-Fail "Docker is not running. Please start Docker Desktop."
    exit 1
}

# Check containers are running
$pgStatus = docker inspect lims-postgres --format='{{.State.Status}}' 2>$null
if ($pgStatus -ne 'running') {
    Write-Warning "lims-postgres is not running (status: $pgStatus)"
    Write-Host "  Database dump will be skipped. Volume export will still work."
    $skipDbDump = $true
} else {
    Write-Success "lims-postgres is running"
    $skipDbDump = $false
}

# Create output directory
Write-Step "Creating backup directory..."
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
Write-Success "Created: $OutputDir"

# Change to project directory
Push-Location $ProjectDir

try {
    # Step 1: Database Dump
    Write-Step "Step 1/5: Creating database dump..."

    if (-not $skipDbDump) {
        $dbDumpFile = Join-Path $OutputDir "lims-database-$Timestamp.sql"

        Write-Host "  Executing pg_dumpall (this may take a few minutes)..."
        docker exec lims-postgres pg_dumpall -U postgres > $dbDumpFile

        $dumpSize = (Get-Item $dbDumpFile).Length / 1MB
        Write-Success "Database dump created: $([math]::Round($dumpSize, 2)) MB"

        # Verify dump is not empty and contains expected content
        $dumpHead = Get-Content $dbDumpFile -Head 5 -ErrorAction SilentlyContinue
        if ($dumpHead -match "PostgreSQL") {
            Write-Success "Dump verification passed"
        } else {
            Write-Warning "Dump may be incomplete - please verify manually"
        }
    } else {
        Write-Warning "Skipped database dump (container not running)"
    }

    # Step 2: Stop containers
    Write-Step "Step 2/5: Stopping containers..."
    Write-Host "  This prevents data corruption during volume export..."

    docker compose down 2>&1 | Out-Null
    Start-Sleep -Seconds 3

    # Verify all stopped
    $runningContainers = docker ps --filter "name=lims-" --format "{{.Names}}" 2>$null
    if ($runningContainers) {
        Write-Warning "Some containers still running: $runningContainers"
    } else {
        Write-Success "All LIMS containers stopped"
    }

    # Step 3: Export Docker volumes
    Write-Step "Step 3/5: Exporting Docker volumes..."

    $volumes = @(
        @{ Name = "lims-lite_postgres-data"; File = "postgres-data.tar.gz" },
        @{ Name = "lims-lite_storage-data"; File = "storage-data.tar.gz" }
    )

    foreach ($vol in $volumes) {
        $volFile = Join-Path $OutputDir $vol.File
        Write-Host "  Exporting $($vol.Name)..."

        # Check volume exists
        $volExists = docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $vol.Name }
        if (-not $volExists) {
            Write-Warning "Volume $($vol.Name) not found - skipping"
            continue
        }

        # Export using Alpine container
        docker run --rm `
            -v "$($vol.Name):/data:ro" `
            -v "${OutputDir}:/backup" `
            alpine tar czf "/backup/$($vol.File)" -C /data .

        if (Test-Path $volFile) {
            $volSize = (Get-Item $volFile).Length / 1MB
            Write-Success "$($vol.File): $([math]::Round($volSize, 2)) MB"
        } else {
            Write-Fail "Failed to create $($vol.File)"
        }
    }

    # Step 4: Archive project (optional)
    Write-Step "Step 4/5: Archiving project files..."

    if ($SkipProjectArchive) {
        Write-Warning "Skipped project archive (-SkipProjectArchive specified)"
        Write-Host "  Transfer project via: git clone <repo-url>"
    } else {
        $projectArchive = Join-Path $OutputDir "lims-project.tar.gz"

        # Create exclusion file
        $excludeFile = Join-Path $env:TEMP "lims-exclude.txt"
        @(
            "node_modules",
            ".next",
            "lims-backup-*",
            "*.tar.gz",
            "*.sql"
        ) | Out-File -FilePath $excludeFile -Encoding ASCII

        Write-Host "  Creating project archive (excluding node_modules, .next)..."

        # Try tar first (Git Bash), fall back to 7-Zip
        $tarPath = Get-Command tar -ErrorAction SilentlyContinue
        if ($tarPath) {
            tar --exclude-from="$excludeFile" -czf "$projectArchive" -C (Split-Path $ProjectDir -Parent) (Split-Path $ProjectDir -Leaf)
        } else {
            $7zPath = "C:\Program Files\7-Zip\7z.exe"
            if (Test-Path $7zPath) {
                $tempTar = Join-Path $OutputDir "lims-project.tar"
                & $7zPath a -ttar -xr!node_modules -xr!.next -xr!"lims-backup-*" $tempTar $ProjectDir | Out-Null
                & $7zPath a -tgzip $projectArchive $tempTar | Out-Null
                Remove-Item $tempTar -Force
            } else {
                Write-Warning "Neither tar nor 7-Zip found. Skipping project archive."
                Write-Host "  Install 7-Zip or use Git Bash for tar support"
            }
        }

        Remove-Item $excludeFile -Force -ErrorAction SilentlyContinue

        if (Test-Path $projectArchive) {
            $projSize = (Get-Item $projectArchive).Length / 1MB
            Write-Success "Project archive: $([math]::Round($projSize, 2)) MB"
        }
    }

    # Step 5: Generate checksums
    Write-Step "Step 5/5: Generating checksums..."

    $checksumFile = Join-Path $OutputDir "checksums.sha256"
    $checksums = @()

    Get-ChildItem $OutputDir -File | Where-Object { $_.Name -ne "checksums.sha256" } | ForEach-Object {
        Write-Host "  Hashing $($_.Name)..."
        $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        $checksums += "$hash  $($_.Name)"
    }

    $checksums | Out-File -FilePath $checksumFile -Encoding ASCII
    Write-Success "Checksums saved to checksums.sha256"

    # Summary
    Write-Host @"

  =====================================================
   BACKUP COMPLETE
  =====================================================

"@ -ForegroundColor Green

    Write-Host "  Backup location: $OutputDir" -ForegroundColor White
    Write-Host ""
    Write-Host "  Files created:" -ForegroundColor White
    Get-ChildItem $OutputDir | ForEach-Object {
        $size = if ($_.Length -gt 1MB) { "$([math]::Round($_.Length/1MB, 2)) MB" } else { "$([math]::Round($_.Length/1KB, 2)) KB" }
        Write-Host "    - $($_.Name) ($size)"
    }

    $totalSize = (Get-ChildItem $OutputDir | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host ""
    Write-Host "  Total size: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Yellow

    Write-Host @"

  NEXT STEPS:
  1. Upload the backup folder to cloud storage
  2. On Machine 2, download and run restore.ps1
  3. Verify with: docker compose ps

"@ -ForegroundColor Cyan

    # Ask about restarting containers
    Write-Host ""
    $restart = Read-Host "Restart containers on this machine? (y/N)"
    if ($restart -eq 'y' -or $restart -eq 'Y') {
        Write-Step "Restarting containers..."
        docker compose up -d
        Write-Success "Containers restarted"
    } else {
        Write-Warning "Containers are still stopped. Start with: docker compose up -d"
    }

} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Backup script completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
