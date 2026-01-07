$main = "D:\lims-lite\supabase\migrations"
$prod = "D:\lims-lite\supabase\migrations\production"

$prodFiles = Get-ChildItem -Path $prod -Filter "*.sql"

foreach ($f in $prodFiles) {
    $mainFile = Join-Path $main $f.Name
    $prodFile = $f.FullName

    if (Test-Path $mainFile) {
        $mainHash = (Get-FileHash $mainFile).Hash
        $prodHash = (Get-FileHash $prodFile).Hash

        if ($mainHash -eq $prodHash) {
            Write-Host "$($f.Name) - IDENTICAL" -ForegroundColor Green
        } else {
            Write-Host "$($f.Name) - DIFFERENT" -ForegroundColor Red
        }
    } else {
        Write-Host "$($f.Name) - Only in production/" -ForegroundColor Yellow
    }
}
