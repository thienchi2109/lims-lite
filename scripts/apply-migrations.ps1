# Apply all SQL migrations in order
# Usage: powershell -ExecutionPolicy Bypass -File scripts/apply-migrations.ps1

$ErrorActionPreference = "Stop"
$migrationsDir = "D:\lims-lite\supabase\migrations"

# Get all .sql files sorted by name (numeric prefix ensures correct order)
$migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

Write-Host "`n=== Applying $($migrations.Count) migrations ===" -ForegroundColor Cyan

$success = 0
$failed = 0

foreach ($file in $migrations) {
    Write-Host "`n[$($success + $failed + 1)/$($migrations.Count)] Applying: $($file.Name)" -ForegroundColor Yellow

    try {
        $content = Get-Content -Path $file.FullName -Raw
        $result = $content | docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK" -ForegroundColor Green
            $success++
        } else {
            Write-Host "  FAILED: $result" -ForegroundColor Red
            $failed++
        }
    }
    catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Migration Summary ===" -ForegroundColor Cyan
Write-Host "Success: $success" -ForegroundColor Green
Write-Host "Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

# Refresh PostgREST schema cache
Write-Host "`nRefreshing PostgREST schema cache..." -ForegroundColor Yellow
docker compose restart rest

Write-Host "`nDone!" -ForegroundColor Cyan
