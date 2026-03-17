# MediaMinder Desktop Startup Script
# Builds frontend and launches the pywebview native window + API

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Building frontend..." -ForegroundColor Cyan
npx vite build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed!" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Launching MediaMinder..." -ForegroundColor Green
python launcher.py
