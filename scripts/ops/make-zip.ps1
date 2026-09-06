$source = "D:\AlgoFight-backend-new"
$zipPath = "D:\AlgoFight-clean-project.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$tempFolder = "D:\AlgoFight-export-temp"
if (Test-Path $tempFolder) {
    Remove-Item $tempFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $tempFolder | Out-Null

Write-Host "Copying files excluding node_modules, .git, and .env secrets..."

# Use robocopy for fast, reliable copy with exclusions
& robocopy $source $tempFolder /E /XD "node_modules" ".git" ".turbo" "dist" "build" ".next" "coverage" /XF ".env" ".env.local" ".env.production" ".env.development" "*.log" "AlgoFight-*.zip"

Write-Host "Compressing to clean ZIP archive..."
Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item $tempFolder -Recurse -Force

$zipFile = Get-Item $zipPath
Write-Host "Clean ZIP Archive created successfully!"
Write-Host "File: $($zipFile.FullName)"
Write-Host "Size: $([math]::Round($zipFile.Length / 1MB, 2)) MB"
