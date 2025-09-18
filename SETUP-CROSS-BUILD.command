#!/bin/bash

# Setup cross-platform build capability on macOS
# This allows building Windows .exe on macOS

clear

echo "================================================"
echo "  Cross-Platform Build Setup for macOS"
echo "================================================"
echo ""
echo "This will install tools to build Windows .exe on macOS"
echo ""

# Check Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Wine for Windows builds
echo "📦 Installing Wine (for Windows executable build)..."
echo "This may take a few minutes..."
echo ""

# Install Wine using Homebrew
brew install --cask wine-stable

# Alternative: Install mono and wine-mono for better .NET support
brew install mono

echo ""
echo "✅ Cross-platform build tools installed!"
echo ""
echo "Now you can build for both platforms:"
echo "  - npm run build-mac  → Creates .dmg for macOS"
echo "  - npm run build-win  → Creates .exe for Windows"
echo "  - npm run build-all  → Creates both"
echo ""
echo "Or use BUILD.command to build with menu"
echo ""

read -p "Press Enter to continue..."