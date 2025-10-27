@echo off
setlocal

echo ========================================
echo   Fukumado Admin Dashboard - Dev Start
echo ========================================
echo.

rem Check if admin-server exists
if not exist "%~dp0admin-server" (
    echo ERROR: admin-server directory not found
    pause
    exit /b 1
)

rem Check if admin-web exists
if not exist "%~dp0admin-web" (
    echo ERROR: admin-web directory not found
    pause
    exit /b 1
)

rem Check if .env file exists in admin-server
if not exist "%~dp0admin-server\.env" (
    echo WARNING: admin-server\.env not found
    echo Please copy .env.example to .env and configure it
    echo.
)

rem Start admin backend server
echo Starting admin backend server on port 4001...
pushd "%~dp0admin-server"
start "fukumado-admin-server" cmd /k "npm run dev"
popd

rem Wait a moment for backend to start
timeout /t 2 /nobreak > nul

rem Start admin frontend dev server
echo Starting admin frontend server on port 5174...
pushd "%~dp0admin-web"
start "fukumado-admin-web" cmd /k "npm run dev"
popd

echo.
echo ========================================
echo   Development servers started!
echo ========================================
echo   Backend API:  http://localhost:4001
echo   Frontend UI:  http://localhost:5174
echo   WebSocket:    ws://localhost:4001/admin/ws
echo ========================================
echo.
echo Basic Authentication Required:
echo   Username: admin
echo   Password: (set in admin-server\.env)
echo.
echo To stop servers:
echo   - Close the opened command windows, or
echo   - Press Ctrl+C in each window
echo ========================================
echo.
pause
