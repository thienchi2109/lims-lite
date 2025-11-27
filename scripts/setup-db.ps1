# CDC-LIMS Database Setup Script
# PowerShell script to setup database with migrations and seed data

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "CDC-LIMS Database Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Step 1: Enable uuid-ossp extension
Write-Host "`nStep 1: Enabling uuid-ossp extension..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# Step 2: Create auth.uid() function (simplified for standalone setup)
Write-Host "Step 2: Creating auth.uid() function..." -ForegroundColor Yellow
$authUidSql = @"
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS `$`$
    SELECT COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', '00000000-0000-0000-0000-000000000000')::UUID;
`$`$ LANGUAGE SQL STABLE;
"@
docker exec lims-postgres psql -U postgres postgres -c $authUidSql

# Step 3: Apply migrations
Write-Host "Step 3: Applying migration 001 (schema)..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/001_initial_schema.sql 2>&1 | Out-Null

Write-Host "Step 4: Applying migration 002 (audit triggers)..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/002_audit_triggers.sql 2>&1 | Out-Null

Write-Host "Step 5: Applying migration 003 (RLS policies)..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/003_rls_policies.sql 2>&1 | Out-Null

# Step 6: Seed data
Write-Host "Step 6: Seeding database with test users and sample data..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -f /tmp/migrations/006_complete_seed.sql

Write-Host "`n===================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host "Test Accounts Created:" -ForegroundColor White
Write-Host "  Analyst: analyst@cdc-lims.local / password123" -ForegroundColor Cyan
Write-Host "  Manager: manager@cdc-lims.local / password123" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Green
Write-Host "`nYou can now run: npm run dev" -ForegroundColor Yellow
