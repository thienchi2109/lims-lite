#!/usr/bin/env pwsh
# CDC-LIMS Database Final Setup

Write-Host "Starting CDC-LIMS database setup..." -ForegroundColor Cyan

# Enable uuid-ossp extension properly (without role reference)
Write-Host "Enabling uuid-ossp extension..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' 2>$null

# Drop existing schema and start fresh
Write-Host "Resetting database..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;" 2>&1 | Out-Null

# Apply the setup SQL
Write-Host "Running setup SQL..." -ForegroundColor Yellow
docker exec lims-postgres psql -U postgres postgres -f /tmp/complete-setup.sql 2>&1 | Out-Null

# Verify results
Write-Host "`nVerifying setup..." -ForegroundColor Cyan
docker exec lims-postgres psql -U postgres postgres -c "
SELECT 'Tables Created:' as info,  COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Users:' as info, COUNT(*) as count FROM public.users;
SELECT 'Methods:' as info, COUNT(*) as count FROM public.methods;
SELECT 'Assays:' as info, COUNT(*) as count FROM public.assay_definitions;
SELECT 'Samples:' as info, COUNT(*) as count FROM public.samples;
SELECT 'Results:' as info, COUNT(*) as count FROM public.results;
"

Write-Host "`n=======================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host "Test Accounts:" -ForegroundColor White
Write-Host "  Analyst: analyst@cdc-lims.local / password123" -ForegroundColor Cyan
Write-Host "  Manager: manager@cdc-lims.local / password123" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Green
