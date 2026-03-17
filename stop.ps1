# MediaMinder Stop Script
# Stops the Python backend API server

$procs = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*backend/server.py*" -or
    (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*backend\server.py*"
}

if ($procs) {
    $procs | Stop-Process -Force
    Write-Host "Stopped MediaMinder backend (PID: $($procs.Id -join ', '))" -ForegroundColor Green
} else {
    Write-Host "No MediaMinder backend process found." -ForegroundColor Yellow
}
