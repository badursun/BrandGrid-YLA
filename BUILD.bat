@echo off
title YouTube Live Awards - Build Executable
color 0A

echo ================================================
echo   YouTube Live Awards - Executable Builder
echo ================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)

:: Check dependencies
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

:: Check electron-builder
npm list electron-builder >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing electron-builder...
    npm install --save-dev electron-builder
)

:: Create icons if missing
if not exist "build-resources\icon.ico" (
    echo.
    echo WARNING: icon.ico not found!
    echo Please create icon files in build-resources folder
    echo Opening icon generator...
    start build-resources\icon-generator.html
    echo.
    pause
)

echo.
echo Select build option:
echo 1. Build for Windows only
echo 2. Build for macOS only (requires macOS)
echo 3. Build for both platforms
echo.

set /p choice="Enter choice (1-3): "

echo.
echo Starting build process...
echo This may take several minutes...
echo.

if "%choice%"=="1" (
    echo Building for Windows...
    call npm run build-win
) else if "%choice%"=="2" (
    echo Building for macOS...
    call npm run build-mac
) else if "%choice%"=="3" (
    echo Building for all platforms...
    call npm run build-all
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

if %errorlevel% equ 0 (
    echo.
    echo ================================================
    echo BUILD SUCCESSFUL!
    echo ================================================
    echo.
    echo Executable files created in 'dist' folder:
    echo.
    dir /b dist\*.exe 2>nul
    dir /b dist\*.dmg 2>nul
    echo.
    echo You can now distribute these files!
    echo.
) else (
    echo.
    echo BUILD FAILED!
    echo Please check the error messages above.
    echo.
)

pause