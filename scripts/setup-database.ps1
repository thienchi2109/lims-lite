# CDC-LIMS Database Setup Script
# Run this script after starting Docker containers for the first time

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "CDC-LIMS Database Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green

# Check if postgres container exists
Write-Host "Checking PostgreSQL container..." -ForegroundColor Yellow
$postgresContainer = docker ps --filter "name=lims-postgres" --format "{{.Names}}"
if (-not $postgresContainer) {
    Write-Host "✗ PostgreSQL container not found. Please run 'docker-compose up -d' first." -ForegroundColor Red
    exit 1
}
Write-Host "✓ PostgreSQL container is running" -ForegroundColor Green

# Create schemas
Write-Host ""
Write-Host "Creating database schemas..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS graphql_public;" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Schemas created successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create schemas" -ForegroundColor Red
    exit 1
}

# Restart auth service
Write-Host ""
Write-Host "Restarting auth service..." -ForegroundColor Yellow
docker restart lims-auth | Out-Null
Write-Host "✓ Auth service restarted" -ForegroundColor Green

# Wait for auth to start
Write-Host "Waiting for auth service to start (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host "✓ Auth service should be ready" -ForegroundColor Green

# Apply migrations
Write-Host ""
Write-Host "Applying database migrations..." -ForegroundColor Yellow
$migrationCount = 0
Get-ChildItem -Path .\supabase\migrations\*.sql | Sort-Object Name | ForEach-Object {
    Write-Host "  Applying: $($_.Name)" -ForegroundColor Gray
    Get-Content $_.FullName | docker exec -i lims-postgres psql -U postgres -d postgres 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $migrationCount++
    }
}
Write-Host "✓ Applied $migrationCount migrations" -ForegroundColor Green

# Enable pgcrypto extension
Write-Host ""
Write-Host "Enabling pgcrypto extension..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ pgcrypto extension enabled" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to enable pgcrypto" -ForegroundColor Red
    exit 1
}

# Fix user passwords
Write-Host ""
Write-Host "Setting up test user passwords..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = crypt('password123', gen_salt('bf')) WHERE email IN ('analyst@cdc-lims.local', 'manager@cdc-lims.local');" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Test user passwords configured" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to set passwords" -ForegroundColor Red
    exit 1
}

# Verify Supabase health
Write-Host ""
Write-Host "Verifying Supabase health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/auth/v1/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Supabase is healthy and accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Supabase health check failed, but setup may still be successful" -ForegroundColor Yellow
}

# Success message
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✓ Database Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test User Credentials:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Analyst Account:" -ForegroundColor White
Write-Host "  Username: analyst" -ForegroundColor Gray
Write-Host "  Password: password123" -ForegroundColor Gray
Write-Host ""
Write-Host "Manager Account:" -ForegroundColor White
Write-Host "  Username: manager" -ForegroundColor Gray
Write-Host "  Password: password123" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npm run dev" -ForegroundColor White
Write-Host "  2. Open: http://localhost:3000" -ForegroundColor White
Write-Host "  3. Login with one of the test accounts above" -ForegroundColor White
Write-Host ""
