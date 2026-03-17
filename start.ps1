# MediaMinder Startup Script
# Starts the Python backend API and the Vite dev server

$backendJob = Start-Process -PassThru -NoNewWindow powershell -ArgumentList "-Command", "cd '$PSScriptRoot'; python backend/server.py"
$frontendJob = Start-Process -PassThru -NoNewWindow powershell -ArgumentList "-Command", "cd '$PSScriptRoot'; npx vite --port 5173"

Write-Host ""
Write-Host "MediaMinder started!" -ForegroundColor Green
Write-Host "  Backend API: http://localhost:3457" -ForegroundColor Cyan
Write-Host "  Frontend:    http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop, then run: Stop-Process -Id $($backendJob.Id),$($frontendJob.Id)" -ForegroundColor Yellow

try {
    Wait-Process -Id $backendJob.Id, $frontendJob.Id
} catch {
    Stop-Process -Id $backendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendJob.Id -ErrorAction SilentlyContinue
}
