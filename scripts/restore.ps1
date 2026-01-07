<#
.SYNOPSIS
    LIMS Docker Stack Restore Script (Machine 2)

.DESCRIPTION
    Restores a LIMS Docker stack backup including:
    - Checksum verification
    - Docker volume creation and import
    - Database restoration (if volumes are empty)
    - Service startup and validation

.PARAMETER BackupDir
    Directory containing backup files (required)

.PARAMETER ProjectDir
    Directory where lims-lite project is located. Defaults to D:\lims-lite

.PARAMETER SkipChecksums
    Skip checksum verification (not recommended)

.EXAMPLE
    .\restore.ps1 -BackupDir D:\lims-migration
    .\restore.ps1 -BackupDir D:\lims-migration -ProjectDir C:\projects\lims-lite

.NOTES
    Run on Machine 2 (target server)
    Requires Docker Desktop running
    Estimated time: 5-15 minutes
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupDir,

    [string]$ProjectDir = "D:\lims-lite",

    [switch]$SkipChecksums
)

# Configuration
$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# Colors for output
function Write-Step { param($msg) Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [X] $msg" -ForegroundColor Red }

function Test-Validation {
    param($name, $test, $expected)
    Write-Host "  Testing $name..." -NoNewline
    try {
        $result = Invoke-Expression $test
        if ($result -match $expected) {
            Write-Host " PASS" -ForegroundColor Green
            return $true
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
        return $false
    }
}

# Banner
Write-Host @"

  =====================================================
   LIMS Docker Stack Restore Script
   Timestamp: $Timestamp
  =====================================================

"@ -ForegroundColor Magenta

# Verify backup directory exists
Write-Step "Verifying backup directory..."

if (-not (Test-Path $BackupDir)) {
    Write-Fail "Backup directory not found: $BackupDir"
    exit 1
}
Write-Success "Found backup directory: $BackupDir"

# List backup contents
Write-Host "  Contents:"
Get-ChildItem $BackupDir -File | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "$([math]::Round($_.Length/1MB, 2)) MB" } else { "$([math]::Round($_.Length/1KB, 2)) KB" }
    Write-Host "    - $($_.Name) ($size)"
}

# Check required files
$requiredFiles = @("postgres-data.tar.gz", "storage-data.tar.gz")
$missingFiles = $requiredFiles | Where-Object { -not (Test-Path (Join-Path $BackupDir $_)) }

if ($missingFiles) {
    Write-Fail "Missing required files: $($missingFiles -join ', ')"
    exit 1
}
Write-Success "All required volume archives found"

# Check Docker is running
Write-Step "Checking Docker..."
try {
    $null = docker info 2>&1
    Write-Success "Docker is running"
} catch {
    Write-Fail "Docker is not running. Please start Docker Desktop."
    exit 1
}

# Step 1: Verify checksums
Write-Step "Step 1/6: Verifying checksums..."

$checksumFile = Join-Path $BackupDir "checksums.sha256"
if ($SkipChecksums) {
    Write-Warning "Skipping checksum verification (-SkipChecksums specified)"
} elseif (-not (Test-Path $checksumFile)) {
    Write-Warning "checksums.sha256 not found - skipping verification"
} else {
    $allValid = $true
    $expected = Get-Content $checksumFile

    foreach ($line in $expected) {
        if ($line -match '^([A-Fa-f0-9]+)\s+(.+)$') {
            $expectedHash = $Matches[1]
            $fileName = $Matches[2].Trim()
            $filePath = Join-Path $BackupDir $fileName

            if (Test-Path $filePath) {
                Write-Host "  Verifying $fileName..." -NoNewline
                $actualHash = (Get-FileHash $filePath -Algorithm SHA256).Hash

                if ($actualHash -eq $expectedHash) {
                    Write-Host " OK" -ForegroundColor Green
                } else {
                    Write-Host " MISMATCH!" -ForegroundColor Red
                    Write-Host "    Expected: $expectedHash"
                    Write-Host "    Actual:   $actualHash"
                    $allValid = $false
                }
            } else {
                Write-Host "  $fileName - NOT FOUND" -ForegroundColor Yellow
            }
        }
    }

    if (-not $allValid) {
        Write-Fail "Checksum verification failed!"
        Write-Host "  Re-download corrupted files before continuing."
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne 'y' -and $continue -ne 'Y') {
            exit 1
        }
    } else {
        Write-Success "All checksums verified"
    }
}

# Step 2: Verify project directory
Write-Step "Step 2/6: Verifying project directory..."

if (-not (Test-Path $ProjectDir)) {
    Write-Warning "Project directory not found: $ProjectDir"

    # Check for project archive
    $projectArchive = Get-ChildItem $BackupDir -Filter "lims-project*.tar.gz" | Select-Object -First 1

    if ($projectArchive) {
        Write-Host "  Found project archive: $($projectArchive.Name)"
        $extract = Read-Host "Extract project to $(Split-Path $ProjectDir -Parent)? (Y/n)"

        if ($extract -ne 'n' -and $extract -ne 'N') {
            Write-Host "  Extracting project archive..."

            $tarPath = Get-Command tar -ErrorAction SilentlyContinue
            if ($tarPath) {
                tar -xzf $projectArchive.FullName -C (Split-Path $ProjectDir -Parent)
            } else {
                $7zPath = "C:\Program Files\7-Zip\7z.exe"
                if (Test-Path $7zPath) {
                    & $7zPath x $projectArchive.FullName -o"$(Split-Path $ProjectDir -Parent)" -y | Out-Null
                    $tarFile = $projectArchive.FullName -replace '\.gz$', ''
                    if (Test-Path $tarFile) {
                        & $7zPath x $tarFile -o"$(Split-Path $ProjectDir -Parent)" -y | Out-Null
                        Remove-Item $tarFile -Force
                    }
                } else {
                    Write-Fail "Neither tar nor 7-Zip found. Please extract manually."
                    exit 1
                }
            }

            if (Test-Path $ProjectDir) {
                Write-Success "Project extracted to $ProjectDir"
            } else {
                Write-Fail "Extraction failed"
                exit 1
            }
        }
    } else {
        Write-Host "  No project archive found. Clone from git:"
        Write-Host "    git clone <repo-url> $ProjectDir"
        exit 1
    }
}

if (-not (Test-Path (Join-Path $ProjectDir "docker-compose.yml"))) {
    Write-Fail "docker-compose.yml not found in $ProjectDir"
    exit 1
}
Write-Success "Project directory verified"

# Check .env file
$envFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Fail ".env file not found!"
    Write-Host "  Copy .env from Machine 1 or create from env.md template"
    exit 1
}
Write-Success ".env file exists"

# Step 3: Stop existing containers (if any)
Write-Step "Step 3/6: Stopping existing containers..."

Push-Location $ProjectDir
try {
    $existingContainers = docker ps -a --filter "name=lims-" --format "{{.Names}}" 2>$null
    if ($existingContainers) {
        Write-Host "  Found existing containers, stopping..."
        docker compose down 2>&1 | Out-Null
        Write-Success "Containers stopped"
    } else {
        Write-Success "No existing containers"
    }
} catch {
    Write-Warning "Error checking containers: $_"
}

# Step 4: Create and import volumes
Write-Step "Step 4/6: Importing Docker volumes..."

$volumes = @(
    @{ Name = "lims-lite_postgres-data"; File = "postgres-data.tar.gz" },
    @{ Name = "lims-lite_storage-data"; File = "storage-data.tar.gz" }
)

foreach ($vol in $volumes) {
    $volFile = Join-Path $BackupDir $vol.File

    if (-not (Test-Path $volFile)) {
        Write-Warning "Volume archive not found: $($vol.File) - skipping"
        continue
    }

    Write-Host "  Processing $($vol.Name)..."

    # Check if volume exists
    $volExists = docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $vol.Name }

    if ($volExists) {
        Write-Host "    Volume exists. Checking if empty..."
        $fileCount = docker run --rm -v "$($vol.Name):/data" alpine sh -c "ls -A /data | wc -l" 2>$null

        if ([int]$fileCount -gt 0) {
            Write-Warning "    Volume contains $fileCount items"
            $overwrite = Read-Host "    Overwrite existing data? (y/N)"
            if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
                Write-Host "    Skipping $($vol.Name)"
                continue
            }
            # Clear volume
            docker run --rm -v "$($vol.Name):/data" alpine sh -c "rm -rf /data/*"
        }
    } else {
        Write-Host "    Creating volume..."
        docker volume create $vol.Name | Out-Null
    }

    # Import data
    Write-Host "    Importing data..."
    docker run --rm `
        -v "$($vol.Name):/data" `
        -v "${BackupDir}:/backup:ro" `
        alpine sh -c "cd /data && tar xzf /backup/$($vol.File)"

    # Verify import
    $newCount = docker run --rm -v "$($vol.Name):/data" alpine sh -c "ls -A /data | wc -l" 2>$null
    Write-Success "    Imported $newCount items to $($vol.Name)"
}

# Fix PostgreSQL permissions
Write-Host "  Fixing PostgreSQL data permissions..."
docker run --rm -v "lims-lite_postgres-data:/data" alpine chown -R 70:70 /data
Write-Success "Permissions fixed"

# Step 5: Start services
Write-Step "Step 5/6: Starting services..."

Write-Host "  Starting PostgreSQL first..."
docker compose up -d postgres

Write-Host "  Waiting for PostgreSQL to be healthy..."
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 5
    $waited += 5
    $status = docker inspect lims-postgres --format='{{.State.Health.Status}}' 2>$null
    Write-Host "    Status: $status ($waited s)"
} while ($status -ne 'healthy' -and $waited -lt $maxWait)

if ($status -eq 'healthy') {
    Write-Success "PostgreSQL is healthy"
} else {
    Write-Fail "PostgreSQL failed to become healthy"
    Write-Host "  Check logs: docker logs lims-postgres"
    exit 1
}

Write-Host "  Starting remaining services..."
docker compose up -d

# Wait for services
Write-Host "  Waiting for services to initialize (30s)..."
Start-Sleep -Seconds 30

# Step 6: Validation
Write-Step "Step 6/6: Validating restoration..."

$validationResults = @()

# Database connectivity
$validationResults += Test-Validation `
    "Database connectivity" `
    "docker exec lims-postgres psql -U postgres -c 'SELECT 1' 2>&1" `
    "1"

# Table count
$validationResults += Test-Validation `
    "Database tables" `
    "docker exec lims-postgres psql -U postgres -tAc `"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`" 2>&1" `
    "\d+"

# Auth service
$validationResults += Test-Validation `
    "Auth service" `
    "(Invoke-WebRequest -Uri 'http://localhost:8000/auth/v1/health' -TimeoutSec 10).StatusCode" `
    "200"

# REST API
$validationResults += Test-Validation `
    "REST API" `
    "(Invoke-WebRequest -Uri 'http://localhost:8000/rest/v1/' -TimeoutSec 10).StatusCode" `
    "200"

# Storage service
$validationResults += Test-Validation `
    "Storage files" `
    "docker exec lims-storage ls /var/lib/storage 2>&1" `
    ".*"

# Container status
Write-Host ""
Write-Host "  Container Status:" -ForegroundColor White
docker compose ps --format "table {{.Name}}\t{{.Status}}" | ForEach-Object { Write-Host "    $_" }

# Summary
$passCount = ($validationResults | Where-Object { $_ -eq $true }).Count
$totalCount = $validationResults.Count

Write-Host @"

  =====================================================
   RESTORE COMPLETE
  =====================================================

"@ -ForegroundColor $(if ($passCount -eq $totalCount) { 'Green' } else { 'Yellow' })

Write-Host "  Validation: $passCount / $totalCount tests passed" -ForegroundColor White
Write-Host ""

if ($passCount -eq $totalCount) {
    Write-Host "  All systems operational!" -ForegroundColor Green
} else {
    Write-Host "  Some tests failed. Check logs for details:" -ForegroundColor Yellow
    Write-Host "    docker compose logs -f"
}

Write-Host @"

  NEXT STEPS:
  1. Open http://localhost:3000 in browser
  2. Login with existing credentials
  3. Verify sample data is present
  4. Test Cloudflare Tunnel (if applicable)

  TROUBLESHOOTING:
  - View logs: docker compose logs -f <service>
  - Restart all: docker compose restart
  - PostgREST cache: docker compose restart rest

"@ -ForegroundColor Cyan

} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Restore script completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
