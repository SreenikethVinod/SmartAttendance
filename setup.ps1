# ==============================================================================
# SmartAttendance Setup Script (setup.ps1)
# Installs verified Python 3.12 backend dependencies, frontend npm packages,
# C-runtime DLLs, and builds the production frontend.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     SmartAttendance Unified Project Setup (backend_v2)    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

# 1. Verify Node.js and npm
Write-Host "`n[1/6] Checking Node.js and npm..." -ForegroundColor Yellow
try {
    $nodeVer = & node --version
    $npmVer = & npm --version
    Write-Host "  Found Node.js $nodeVer and npm $npmVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js and npm are required. Please install Node.js 18+ and try again."
    exit 1
}

# 2. Check / Create Python 3.12 Virtual Environment
Write-Host "`n[2/6] Checking Python 3.12 virtual environment..." -ForegroundColor Yellow
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "  Creating isolated Python 3.12 virtual environment in .venv..." -ForegroundColor Gray
    try {
        & py -3.12 -m venv .venv
    } catch {
        & python -m venv .venv
    }
}
$pyVer = & $VenvPython --version
Write-Host "  Using $pyVer in .venv" -ForegroundColor Green

# 3. Install Python Dependencies
Write-Host "`n[3/6] Installing backend dependencies from backend_v2/requirements.txt..." -ForegroundColor Yellow
& $VenvPython -m pip install --quiet --upgrade pip
& $VenvPython -m pip install -r "backend_v2/requirements.txt"
Write-Host "  Backend dependencies verified." -ForegroundColor Green

# 4. Ensure Windows C-Runtime DLLs for ONNX Runtime
Write-Host "`n[4/6] Verifying Windows C-Runtime dependencies for ONNX Runtime..." -ForegroundColor Yellow
$OrtCapiDir = Join-Path $ProjectRoot ".venv\Lib\site-packages\onnxruntime\capi"
$VenvScriptsDir = Join-Path $ProjectRoot ".venv\Scripts"
$DriverStoreCandidates = Get-ChildItem -Path "C:\Windows\System32\DriverStore\FileRepository" -Filter "msvcp140.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if ($DriverStoreCandidates) {
    $dllSourceDir = $DriverStoreCandidates.DirectoryName
    Copy-Item (Join-Path $dllSourceDir "msvcp140*.dll") -Destination $OrtCapiDir -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $dllSourceDir "msvcp140*.dll") -Destination $VenvScriptsDir -Force -ErrorAction SilentlyContinue
}

# Test ONNX Runtime import
$ortCheck = & $VenvPython -c "import onnxruntime; print('OK')" 2>$null
if ($ortCheck -ne "OK") {
    Write-Host "  Note: If onnxruntime fails to load, ensure MSVC 2015-2022 redistributable is installed." -ForegroundColor Yellow
} else {
    Write-Host "  ONNX Runtime CPU verification passed." -ForegroundColor Green
}

# 5. Install Frontend Dependencies
Write-Host "`n[5/6] Installing frontend dependencies in frontend/..." -ForegroundColor Yellow
Push-Location (Join-Path $ProjectRoot "frontend")
try {
    & npm install
    Write-Host "  Frontend dependencies installed cleanly." -ForegroundColor Green
} finally {
    Pop-Location
}

# 6. Build Frontend for Production
Write-Host "`n[6/6] Building frontend production bundle (frontend/dist)..." -ForegroundColor Yellow
Push-Location (Join-Path $ProjectRoot "frontend")
try {
    & npm run build
    Write-Host "  Frontend build complete (frontend/dist ready)." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  Setup completed successfully! Run .\run.ps1 to start.  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
