@echo off
title YouTube Live Awards System
color 0A

echo ================================================
echo    YouTube Live Awards System
echo ================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules\" (
    echo First time setup detected...
    echo Installing dependencies, please wait...
    echo.
    call node setup.js
    if %errorlevel% neq 0 (
        echo Setup failed! Please check the errors above.
        pause
        exit /b 1
    )
)

if not exist "server\node_modules\" (
    echo Server dependencies missing...
    echo Installing dependencies, please wait...
    echo.
    cd server
    call npm install
    cd ..
)

:: Start the application with Electron
echo.
echo Starting YouTube Live Awards System...
echo ------------------------------------------------
echo Launching Electron Application...
echo ------------------------------------------------
echo.

:: Start with Electron (includes server)
npm run start-electron

pause