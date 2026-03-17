# MediaMinder Stop Script
# Stops the Python backend API server and/or launcher

$procs = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    $cmd -like "*backend/server.py*" -or $cmd -like "*backend\server.py*" -or $cmd -like "*launcher.py*"
}

if ($procs) {
    $procs | Stop-Process -Force
    Write-Host "Stopped MediaMinder (PID: $($procs.Id -join ', '))" -ForegroundColor Green
} else {
    # Fallback: kill anything on port 3457
    $portProcs = Get-NetTCPConnection -LocalPort 3457 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($portProcs) {
        $portProcs | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Write-Host "Stopped process on port 3457 (PID: $($portProcs -join ', '))" -ForegroundColor Green
    } else {
        Write-Host "No MediaMinder process found." -ForegroundColor Yellow
    }
}
