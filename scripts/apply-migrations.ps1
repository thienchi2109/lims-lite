# Apply all migrations to the database
Write-Host "Applying migrations to lims-postgres..."

$migrations = Get-ChildItem -Path ".\supabase\migrations\*.sql" | Sort-Object Name

foreach ($migration in $migrations) {
    Write-Host "Applying: $($migration.Name)"
    Get-Content $migration.FullName | docker exec -i lims-postgres psql -U postgres -d postgres
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Success" -ForegroundColor Green
    }
    else {
        Write-Host "  Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All migrations applied!"
