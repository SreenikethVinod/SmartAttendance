# ==============================================================================
# SmartAttendance Unified Run Script (run.ps1)
# Launches the combined FastAPI backend and served frontend on 127.0.0.1:8000.
# Runs in one terminal, detects running instances, builds frontend if needed,
# and automatically opens the browser.
# ==============================================================================

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     Starting SmartAttendance System (FastAPI + React)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual environment not found at .venv. Please run .\setup.ps1 first."
    exit 1
}

# 1. Check for Duplicate Instances on Port 8000
$existingPort = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingPort -and $existingPort.OwningProcess -gt 0) {
    $procId = $existingPort.OwningProcess
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        if ($proc.ProcessName -like "*python*") {
            Write-Host "SmartAttendance backend is already running on http://127.0.0.1:8000 (PID: $procId)." -ForegroundColor Green
            Write-Host "Opening application in default web browser..." -ForegroundColor Yellow
            Start-Process "http://127.0.0.1:8000"
            exit 0
        } else {
            Write-Error "Port 8000 is currently occupied by an external process ($($proc.ProcessName), PID: $procId). Please free port 8000 before running."
            exit 1
        }
    }
}

# 2. Check if Frontend Production Build Exists
$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
if (-not (Test-Path $DistIndex)) {
    Write-Host "Frontend production build not found. Building now in frontend/..." -ForegroundColor Yellow
    Push-Location (Join-Path $ProjectRoot "frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend build failed. Please inspect build errors above."
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# 3. Schedule Browser Launch after Server Warmup
Write-Host "Application will launch in browser at: http://127.0.0.1:8000" -ForegroundColor Green
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:8000"
} | Out-Null

# 4. Launch FastAPI Server
$env:PYTHONPATH = $ProjectRoot
Write-Host "Starting ASGI server on http://127.0.0.1:8000 ... (Press CTRL+C to stop)`n" -ForegroundColor Cyan
& $VenvPython -m uvicorn backend_v2.main:app --host 127.0.0.1 --port 8000
