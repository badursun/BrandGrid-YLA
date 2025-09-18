# Build Resources

This folder contains resources needed for building the executable applications.

## Required Icon Files

You need to create the following icon files:

### For Windows
- **icon.ico** - Windows icon file (should contain 16x16, 32x32, 48x48, 256x256)

### For macOS
- **icon.icns** - macOS icon file (should contain all standard sizes)

### For Linux
- **icon.png** - 512x512 PNG icon
- **16x16.png**
- **32x32.png**
- **48x48.png**
- **64x64.png**
- **128x128.png**
- **256x256.png**
- **512x512.png**

## How to Create Icons

### Option 1: Use the Icon Generator
1. Open `icon-generator.html` in a browser
2. Download all PNG sizes
3. Convert to platform-specific formats

### Option 2: Use an Icon Design Tool
1. Create a 512x512 design
2. Export to all required sizes
3. Convert using:
   - Windows: Use online ICO converter or ImageMagick
   - macOS: Use `iconutil` or online ICNS converter

### Option 3: Use Placeholder Icon
For testing, you can use a simple colored square as placeholder:
```bash
# Create a simple red square icon (requires ImageMagick)
convert -size 256x256 xc:red icon.png
convert icon.png icon.ico
```

## Recommended Icon Design
- Background: YouTube red (#FF0000)
- Foreground: White play button + gold trophy
- Style: Flat design, rounded corners
- Text: Optional "YT Awards" text