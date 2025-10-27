@echo off
chcp 65001 > nul
echo ========================================
echo   ふくまど管理ダッシュボード起動スクリプト
echo ========================================
echo.

REM 管理サーバー（バックエンド）を起動
echo [1/2] 管理サーバー（admin-server）を起動しています...
cd /d "%~dp0admin-server"
start "Fukumado Admin Server" cmd /k "npm run dev"
timeout /t 3 /nobreak > nul
echo.

REM 管理Webアプリ（フロントエンド）を起動
echo [2/2] 管理Webアプリ（admin-web）を起動しています...
cd /d "%~dp0admin-web"
start "Fukumado Admin Web" cmd /k "npm run dev"
echo.

echo ========================================
echo   起動完了
echo ========================================
echo.
echo 管理サーバー: http://localhost:4001
echo 管理画面: http://localhost:5174
echo.
echo ユーザー名: admin
echo パスワード: MX!+Fr87Dn#abuc3Zu4F*sqh
echo.
echo ウィンドウを閉じるとサーバーが停止します。
echo ========================================
pause
