# CDC-LIMS Restoration Validation Script
# This script validates that the restoration was successful
# Usage: .\validate-restoration.ps1

$ErrorActionPreference = "Continue"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CDC-LIMS Restoration Validation" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allPassed = $true

# Test 1: Container Health
Write-Host "[1/7] Checking container status..." -ForegroundColor Yellow
$containers = docker compose ps --format json | ConvertFrom-Json
$runningCount = 0
$healthyCount = 0

foreach ($container in $containers) {
    if ($container.State -eq "running") {
        $runningCount++
        if ($container.Health -eq "healthy" -or $container.Health -eq "") {
            $healthyCount++
            Write-Host "  ✓ $($container.Service) - Running" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠ $($container.Service) - Running but not healthy" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  ✗ $($container.Service) - Not running" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host "  Summary: $runningCount running, $healthyCount healthy`n"

# Test 2: Database Connectivity
Write-Host "[2/7] Testing database connectivity..." -ForegroundColor Yellow
try {
    $result = docker exec lims-postgres psql -U postgres -c "SELECT 1 as connection_test;" 2>&1
    if ($result -match "connection_test") {
        Write-Host "  ✓ Database connection successful`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ Database connection failed`n" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "  ✗ Database connection error: $_`n" -ForegroundColor Red
    $allPassed = $false
}

# Test 3: Check Tables Exist
Write-Host "[3/7] Checking database tables..." -ForegroundColor Yellow
try {
    $tableCount = docker exec lims-postgres psql -U postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
    $tableCount = $tableCount.Trim()
    if ([int]$tableCount -gt 0) {
        Write-Host "  ✓ Found $tableCount tables in public schema`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ No tables found in database`n" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "  ✗ Error checking tables: $_`n" -ForegroundColor Red
    $allPassed = $false
}

# Test 4: Check Migrations
Write-Host "[4/7] Checking migration history..." -ForegroundColor Yellow
try {
    $migrations = docker exec lims-postgres psql -U postgres -t -c "SELECT count(*) FROM supabase_migrations.schema_migrations;" 2>&1
    $migrations = $migrations.Trim()
    if ([int]$migrations -gt 0) {
        Write-Host "  ✓ Found $migrations applied migrations`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠ No migrations found (may need to restore from SQL dump)`n" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  ⚠ Migration table not accessible: $_`n" -ForegroundColor Yellow
}

# Test 5: Check User Accounts
Write-Host "[5/7] Checking user accounts..." -ForegroundColor Yellow
try {
    $userCount = docker exec lims-postgres psql -U postgres -t -c "SELECT count(*) FROM auth.users;" 2>&1
    $userCount = $userCount.Trim()
    if ([int]$userCount -gt 0) {
        Write-Host "  ✓ Found $userCount user accounts`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ No user accounts found`n" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "  ✗ Error checking users: $_`n" -ForegroundColor Red
    $allPassed = $false
}

# Test 6: REST API
Write-Host "[6/7] Testing REST API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/rest/v1/" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ REST API responding (HTTP $($response.StatusCode))`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠ REST API returned HTTP $($response.StatusCode)`n" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  ✗ REST API not accessible: $_`n" -ForegroundColor Red
    $allPassed = $false
}

# Test 7: Auth Service
Write-Host "[7/7] Testing Auth service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/auth/v1/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Auth service healthy (HTTP $($response.StatusCode))`n" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠ Auth service returned HTTP $($response.StatusCode)`n" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  ✗ Auth service not accessible: $_`n" -ForegroundColor Red
    $allPassed = $false
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✓ All validation tests passed!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "Your LIMS system is ready to use!" -ForegroundColor Green
    Write-Host "`nAccess points:" -ForegroundColor Yellow
    Write-Host "  - Application: http://localhost:3000"
    Write-Host "  - Studio: http://localhost:3002"
    Write-Host "  - API: http://localhost:8000"
}
else {
    Write-Host "⚠ Some validation tests failed" -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check container logs: docker compose logs -f"
    Write-Host "2. Restart services: docker compose restart"
    Write-Host "3. If database is empty, restore from SQL dump:"
    Write-Host "   Get-Content lims-backup-20260107-151545\lims-database-20260107-151545.sql | docker exec -i lims-postgres psql -U postgres"
}

Write-Host ""
