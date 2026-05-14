@echo off
REM DarkNet Chat - Deployment Script for Windows
REM Project: ShadowKeep v2.0

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           DARKNET CHAT - DEPLOYMENT SCRIPT                   ║
echo ║              Project: ShadowKeep v2.0                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo [*] Checking Node.js installation...
node -v >nul 2>&1
if errorlevel 1 (
    echo [!] Node.js not found. Please install Node.js v18+
    pause
    exit /b 1
)

echo [+] Node.js detected
echo.

REM Install dependencies
echo [*] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [!] Failed to install dependencies
    pause
    exit /b 1
)
echo [+] Dependencies installed
echo.

REM Create .env if not exists
if not exist .env (
    echo [*] Creating .env file...
    copy .env.example .env
    echo [!] Please edit .env file with your custom values
)

REM Create uploads directory
if not exist public\uploads mkdir public\uploads
echo [+] Uploads directory ready
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    SERVER STARTING...                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Access URLs:
echo   Main App:    http://localhost:3000
echo   Admin Panel: http://localhost:3000/admin.html
echo.
echo Default Admin Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo [*] Starting server...
echo.

call npm start
