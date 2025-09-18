@echo off
title YouTube Live Awards - Windows Python Setup
color 0A

echo ================================================
echo   Windows Python Requirements Setup
echo ================================================
echo.

:: Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    echo.
    echo Please download and install Python from:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANT: During installation, CHECK the box:
    echo [x] Add Python to PATH
    echo.
    pause
    start https://www.python.org/downloads/
    exit /b 1
)

echo Python is installed:
python --version
echo.

:: Install required Python packages
echo Installing Python packages...
echo.

pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip is not installed!
    echo Running: python -m ensurepip
    python -m ensurepip
)

echo Installing pytchat (YouTube chat library)...
pip install pytchat

echo.
echo Installing requests...
pip install requests

echo.
echo ================================================
echo   Testing Python chat fetcher...
echo ================================================
echo.

:: Test if pytchat works
python -c "import pytchat; print('✓ pytchat installed successfully')" 2>nul
if %errorlevel% neq 0 (
    echo ERROR: pytchat installation failed!
    echo Trying alternative installation...
    python -m pip install --upgrade pip
    python -m pip install pytchat
)

python -c "import requests; print('✓ requests installed successfully')" 2>nul
if %errorlevel% neq 0 (
    echo ERROR: requests installation failed!
    python -m pip install requests
)

echo.
echo ================================================
echo   Setup Complete!
echo ================================================
echo.
echo Python dependencies are installed.
echo You can now run the application with START.bat
echo.
pause