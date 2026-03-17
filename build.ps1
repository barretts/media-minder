# MediaMinder Build Script
# Builds the React frontend and packages everything into a single EXE

Write-Host "=== MediaMinder Build ===" -ForegroundColor Cyan

# Step 1: Build frontend
Write-Host "`n[1/2] Building frontend..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed!" -ForegroundColor Red; exit 1 }

# Step 2: Package with PyInstaller
Write-Host "`n[2/2] Packaging with PyInstaller..." -ForegroundColor Yellow
pyinstaller `
    --name "MediaMinder" `
    --onefile `
    --windowed `
    --icon "NONE" `
    --distpath "release" `
    --workpath "build/pyinstaller" `
    --add-data "backend;backend" `
    --add-data "dist;dist" `
    --hidden-import "uvicorn.logging" `
    --hidden-import "uvicorn.loops" `
    --hidden-import "uvicorn.loops.auto" `
    --hidden-import "uvicorn.protocols" `
    --hidden-import "uvicorn.protocols.http" `
    --hidden-import "uvicorn.protocols.http.auto" `
    --hidden-import "uvicorn.protocols.websockets" `
    --hidden-import "uvicorn.protocols.websockets.auto" `
    --hidden-import "uvicorn.lifespan" `
    --hidden-import "uvicorn.lifespan.on" `
    --hidden-import "uvicorn.lifespan.off" `
    --hidden-import "settings" `
    --hidden-import "scanner" `
    --hidden-import "scraper" `
    --hidden-import "nfo" `
    --hidden-import "images" `
    --clean `
    --noconfirm `
    launcher.py

if ($LASTEXITCODE -ne 0) { Write-Host "PyInstaller build failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Build complete! ===" -ForegroundColor Green
Write-Host "EXE location: release\MediaMinder.exe" -ForegroundColor Cyan
Write-Host "Run it: .\release\MediaMinder.exe" -ForegroundColor Cyan
