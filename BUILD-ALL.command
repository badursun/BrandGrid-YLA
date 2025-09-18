#!/bin/bash

# Build for ALL platforms on macOS
clear

echo "================================================"
echo "  Building Executables for All Platforms"
echo "================================================"
echo ""

cd "$(dirname "$0")"

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "🔨 Building for macOS (.dmg)..."
npm run build-mac

echo ""
echo "🔨 Attempting Windows build (.exe)..."
echo "Note: This may work without Wine for simple NSIS installers"
npm run build-win 2>&1 | tee build-win.log

# Check if Windows build succeeded
if grep -q "cannot run on" build-win.log || grep -q "wine: not found" build-win.log; then
    echo ""
    echo "⚠️  Windows build requires Wine!"
    echo ""
    echo "To install Wine and enable Windows builds:"
    echo "1. Run: ./SETUP-CROSS-BUILD.command"
    echo "2. Or install manually: brew install --cask wine-stable"
    echo ""
    echo "Alternative: Use a Windows machine or VM for .exe build"
else
    echo "✅ Windows build may have succeeded!"
fi

echo ""
echo "================================================"
echo "Build Results:"
echo "================================================"
echo ""

# Show created files
echo "📁 Files in dist folder:"
ls -lah dist/*.dmg 2>/dev/null && echo "✅ macOS build found"
ls -lah dist/*.exe 2>/dev/null && echo "✅ Windows build found"

echo ""
read -p "Press Enter to exit..."