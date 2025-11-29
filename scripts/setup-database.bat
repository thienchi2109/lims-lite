@echo off
REM CDC-LIMS Database Setup - Windows Batch Script
echo ===================================
echo CDC-LIMS Database Setup
echo ===================================

echo Step 1: Enabling UUID extension...
docker exec -i lims-postgres psql -U postgres postgres < enable-extensions.sql

echo Step 2: Running complete setup...
docker exec -i lims-postgres psql -U postgres postgres < complete-setup.sql

echo.
echo Step 3: Verifying setup...
docker exec lims-postgres psql -U postgres postgres -c "SELECT 'Tables:' as info, COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
docker exec lims-postgres psql -U postgres postgres -c "SELECT 'Users:' as info, COUNT(*) as count FROM public.users;"
docker exec lims-postgres psql -U postgres postgres -c "SELECT 'Samples:' as info, COUNT(*) as count FROM public.samples;"
docker exec lims-postgres psql -U postgres postgres -c "SELECT 'Results:' as info, COUNT(*) as count FROM public.results;"

echo.
echo ===================================
echo Setup Complete!
echo ===================================
echo Test Accounts:
echo   Analyst: analyst@cdc-lims.local / password123
echo   Manager: manager@cdc-lims.local / password123
echo ===================================
