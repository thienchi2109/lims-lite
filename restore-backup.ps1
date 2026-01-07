# CDC-LIMS Backup Restoration Script for Machine 2
# This script restores the Docker stack from backup created on Machine 1
# Usage: .\restore-backup.ps1

$ErrorActionPreference = "Stop"

# Configuration
$BackupDir = "d:\lims-lite\lims-backup-20260107-151545"
$ProjectDir = "d:\lims-lite"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CDC-LIMS Backup Restoration" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Verify backup files exist
Write-Host "[1/8] Verifying backup files..." -ForegroundColor Yellow
cd $BackupDir

$requiredFiles = @(
    "lims-database-20260107-151545.sql",
    "postgres-data.tar.gz",
    "storage-data.tar.gz"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $size = [math]::Round((Get-Item $file).Length/1MB, 2)
        Write-Host "  ✓ $file ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file - NOT FOUND!" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Stop all containers
Write-Host "`n[2/8] Stopping all containers..." -ForegroundColor Yellow
cd $ProjectDir
docker compose down
Write-Host "  ✓ All containers stopped" -ForegroundColor Green

# Step 3: Remove existing volumes
Write-Host "`n[3/8] Removing existing volumes..." -ForegroundColor Yellow
$volumes = @("lims-lite_postgres-data", "lims-lite_storage-data")

foreach ($vol in $volumes) {
    $exists = docker volume ls --filter "name=$vol" --format "{{.Name}}"
    if ($exists) {
        docker volume rm $vol 2>$null
        Write-Host "  ✓ Removed $vol" -ForegroundColor Green
    } else {
        Write-Host "  - $vol does not exist (skipping)" -ForegroundColor Gray
    }
}

# Step 4: Create new volumes
Write-Host "`n[4/8] Creating new volumes..." -ForegroundColor Yellow
docker volume create lims-lite_postgres-data
docker volume create lims-lite_storage-data
Write-Host "  ✓ Volumes created" -ForegroundColor Green

# Step 5: Import postgres-data
Write-Host "`n[5/8] Importing postgres-data volume..." -ForegroundColor Yellow
docker run --rm `
  -v lims-lite_postgres-data:/data `
  -v ${BackupDir}:/backup:ro `
  alpine sh -c "cd /data && tar xvzf /backup/postgres-data.tar.gz" | Out-Null
Write-Host "  ✓ PostgreSQL data imported" -ForegroundColor Green

# Step 6: Import storage-data
Write-Host "`n[6/8] Importing storage-data volume..." -ForegroundColor Yellow
docker run --rm `
  -v lims-lite_storage-data:/data `
  -v ${BackupDir}:/backup:ro `
  alpine sh -c "cd /data && tar xvzf /backup/storage-data.tar.gz" | Out-Null
Write-Host "  ✓ Storage data imported" -ForegroundColor Green

# Step 7: Verify volume contents
Write-Host "`n[7/8] Verifying volume contents..." -ForegroundColor Yellow
$pgFiles = docker run --rm -v lims-lite_postgres-data:/data alpine ls -la /data | Measure-Object -Line
$storageFiles = docker run --rm -v lims-lite_storage-data:/data alpine ls -la /data | Measure-Object -Line
Write-Host "  ✓ PostgreSQL volume: $($pgFiles.Lines) items" -ForegroundColor Green
Write-Host "  ✓ Storage volume: $($storageFiles.Lines) items" -ForegroundColor Green

# Step 8: Start containers
Write-Host "`n[8/8] Starting Docker containers..." -ForegroundColor Yellow
cd $ProjectDir
docker compose up -d

Write-Host "`n  Waiting for services to start..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Check container status
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Container Status" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
docker compose ps

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Restoration Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait 30-60 seconds for PostgreSQL to become healthy"
Write-Host "2. Run validation: .\validate-restoration.ps1"
Write-Host "3. Test login at: http://localhost:3000"
Write-Host ""
