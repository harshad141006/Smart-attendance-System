Param()

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$faceDir = Join-Path $here '..\python\face_models' | Resolve-Path
Set-Location $faceDir

Write-Host "Creating Python virtual environment .venv (if not exists)"
if (!(Test-Path .venv)) {
    python -m venv .venv
}

Write-Host "Activating venv and installing requirements"
& .\.venv\Scripts\pip.exe install -r requirements.txt

Write-Host "Starting uvicorn on http://127.0.0.1:8000"
& .\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000
