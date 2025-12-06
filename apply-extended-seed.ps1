# Apply Extended Seed Data Migration
# Run this script after Docker Desktop is running properly

Write-Host "Checking Docker status..." -ForegroundColor Cyan

# Check if Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running or not responding properly." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Docker is running" -ForegroundColor Green

# Check if containers are running
Write-Host "`nChecking containers..." -ForegroundColor Cyan
$containers = docker ps --filter "name=lims-" --format "{{.Names}}"

if ($containers) {
    Write-Host "✓ Found running containers:" -ForegroundColor Green
    $containers | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠ No lims containers running. Starting them..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 15
}

# Check if postgres is healthy
Write-Host "`nWaiting for PostgreSQL to be ready..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
$pgReady = $false

while (-not $pgReady -and $attempt -lt $maxAttempts) {
    $attempt++
    $healthCheck = docker exec lims-postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pgReady = $true
        Write-Host "✓ PostgreSQL is ready" -ForegroundColor Green
    } else {
        Write-Host "  Waiting... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $pgReady) {
    Write-Host "❌ PostgreSQL did not become ready in time" -ForegroundColor Red
    exit 1
}

# Apply migration
Write-Host "`nApplying extended seed data migration..." -ForegroundColor Cyan
$migrationFile = ".\supabase\migrations\021_extended_seed_data.sql"

if (Test-Path $migrationFile) {
    Get-Content $migrationFile | docker exec -i lims-postgres psql -U postgres -d postgres
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migration applied successfully!" -ForegroundColor Green
        Write-Host "`nVerifying data..." -ForegroundColor Cyan
        
        # Quick verification
        docker exec lims-postgres psql -U postgres -d postgres -c "SELECT 'Methods' as entity, COUNT(*) FROM public.methods WHERE deleted_at IS NULL UNION ALL SELECT 'Assays', COUNT(*) FROM public.assay_definitions WHERE deleted_at IS NULL UNION ALL SELECT 'Samples', COUNT(*) FROM public.samples WHERE deleted_at IS NULL;"
        
    } else {
        Write-Host "`n❌ Migration failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 All done! Your database now has:" -ForegroundColor Green
Write-Host "  • 25+ laboratory methods" -ForegroundColor White
Write-Host "  • 30+ assay definitions" -ForegroundColor White
Write-Host "  • 30+ sample records" -ForegroundColor White
Write-Host "  • Proper assay-method relationships via junction table" -ForegroundColor White
Write-Host "`nRefresh your browser to see the new data!" -ForegroundColor Cyan
