@echo off
setlocal

echo ========================================
echo ふくまど！モバイル開発モード
echo ========================================
echo.

rem Get PC IP address
echo PCのIPアドレスを取得中...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP:~1%
echo.
echo ========================================
echo スマートフォンからアクセスする場合：
echo http://%IP%:5173
echo ========================================
echo.

rem Start backend server
pushd "%~dp0server"
start "fukumado-server" cmd /k "npm run dev"
popd

rem Wait a moment for backend to start
timeout /t 2 /nobreak >nul

rem Start frontend dev server with host flag
pushd "%~dp0web"
start "fukumado-web-mobile" cmd /k "npm run dev -- --host"
popd

echo.
echo バックエンドとフロントエンドの開発サーバーを起動しました。
echo.
echo ■ PC（ローカル）からアクセス:
echo   http://localhost:5173
echo.
echo ■ スマートフォン（同じWi-Fi）からアクセス:
echo   http://%IP%:5173
echo.
echo ※ファイアウォールの警告が表示された場合は「アクセスを許可する」を選択してください。
echo.
echo サーバーを停止するには、開いたウィンドウを閉じるか、各ウィンドウでCtrl+Cを押してください。
pause
