#!/bin/bash

# YouTube Live Awards System - Linux/Unix Launcher
# Make this file executable: chmod +x START.sh

clear

echo "================================================"
echo "   YouTube Live Awards System"
echo "================================================"
echo ""

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo "Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "Fedora: sudo dnf install nodejs npm"
    echo "Or download from: https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ]; then
    echo "📦 First time setup detected..."
    echo "Installing dependencies, please wait..."
    echo ""

    node setup.js

    if [ $? -ne 0 ]; then
        echo "❌ Setup failed! Please check the errors above."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Check Python dependencies
if ! python3 -c "import pytchat" &> /dev/null 2>&1; then
    echo "📦 Installing Python dependencies..."
    pip3 install --user -r python/requirements.txt
fi

# Start the application with Electron
echo ""
echo "🚀 Starting YouTube Live Awards System..."
echo "------------------------------------------------"
echo "🖥️  Launching Electron Application..."
echo "------------------------------------------------"
echo ""

# Start with Electron (includes server)
npm start