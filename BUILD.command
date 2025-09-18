#!/bin/bash

# YouTube Live Awards - Build Executable for macOS
# Make executable: chmod +x BUILD.command

clear

echo "================================================"
echo "  YouTube Live Awards - Executable Builder"
echo "================================================"
echo ""

# Get script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo "Install with: brew install node"
    echo "Or download from: https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check electron-builder
if ! npm list electron-builder &> /dev/null; then
    echo "📦 Installing electron-builder..."
    npm install --save-dev electron-builder
fi

# Check for icons
if [ ! -f "build-resources/icon.icns" ]; then
    echo ""
    echo "⚠️  WARNING: icon.icns not found!"
    echo "Please create icon files in build-resources folder"
    echo "Opening icon generator..."
    open build-resources/icon-generator.html
    echo ""
    read -p "Press Enter after creating icons..."
fi

echo ""
echo "Select build option:"
echo "1. Build for macOS only"
echo "2. Build for Windows (requires Wine)"
echo "3. Build for both platforms"
echo ""

read -p "Enter choice (1-3): " choice

echo ""
echo "🔨 Starting build process..."
echo "This may take several minutes..."
echo ""

case $choice in
    1)
        echo "Building for macOS..."
        npm run build-mac
        ;;
    2)
        echo "Building for Windows..."
        echo "Note: Building Windows exe on macOS requires Wine"
        npm run build-win
        ;;
    3)
        echo "Building for all platforms..."
        npm run build-all
        ;;
    *)
        echo "Invalid choice!"
        read -p "Press Enter to exit..."
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ BUILD SUCCESSFUL!"
    echo "================================================"
    echo ""
    echo "Executable files created in 'dist' folder:"
    echo ""
    ls -la dist/*.dmg 2>/dev/null
    ls -la dist/*.exe 2>/dev/null
    echo ""
    echo "You can now distribute these files!"
    echo ""
else
    echo ""
    echo "❌ BUILD FAILED!"
    echo "Please check the error messages above."
    echo ""
fi

read -p "Press Enter to exit..."