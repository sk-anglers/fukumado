@echo off
setlocal

rem Start backend server
pushd "%~dp0server"
start "fukumado-server" cmd /k "npm run dev"
popd

rem Start frontend dev server
pushd "%~dp0web"
start "fukumado-web" cmd /k "npm run dev"
popd

echo Started backend and frontend development servers.
echo Close the opened windows or press Ctrl+C in each window to stop.
pause
