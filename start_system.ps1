# start_system.ps1

Write-Host ">>> DRONE CONTROL SYSTEM AUTOMATION <<<" -ForegroundColor Cyan
Write-Host "1. Killing old backend processes..." -ForegroundColor Yellow

# Kill Python (Backend)
try {
    Stop-Process -Name "python" -ErrorAction SilentlyContinue -Force
    Write-Host "   - Python processes killed." -ForegroundColor Green
} catch {
    Write-Host "   - No running Python processes found." -ForegroundColor Gray
}

# Kill Node (Frontend) - Optional, might be aggressive if user has other node stuff
# try {
#     Stop-Process -Name "node" -ErrorAction SilentlyContinue -Force
# } catch {}

Write-Host "2. Starting BACKEND (FastAPI)..." -ForegroundColor Yellow
# Start Backend in a new window using proper python path
# We assume the user is in the root and has venv
$backendCmd = "d:\Documents\Codes\2025_DroneControlCore\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8090 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {$backendCmd}"

Write-Host "   - Backend launching on 127.0.0.1:8090" -ForegroundColor Green
Write-Host "   - Waiting 5 seconds for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "3. Starting FRONTEND (Vue)..." -ForegroundColor Yellow
# Start Frontend in a new window
$frontendPath = "d:\Documents\Codes\2025_DroneControlCore\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host "   - Frontend launching on localhost:5173" -ForegroundColor Green

Write-Host ">>> SYSTEM STARTUP INITIATED <<<" -ForegroundColor Cyan
Write-Host "Please check the two new PowerShell windows." -ForegroundColor Gray
