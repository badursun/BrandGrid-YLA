#!/usr/bin/env python3
"""Create real icon files for Windows and macOS"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create build-resources directory if not exists
os.makedirs('build-resources', exist_ok=True)

def create_icon_image(size):
    """Create a simple icon image"""
    # Create new image with red background
    img = Image.new('RGBA', (size, size), color=(255, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Draw white play button triangle
    triangle_size = size * 0.3
    center_x = size // 2
    center_y = size // 2

    # Play button coordinates
    triangle = [
        (center_x - triangle_size//2, center_y - triangle_size//2),  # Top left
        (center_x - triangle_size//2, center_y + triangle_size//2),  # Bottom left
        (center_x + triangle_size//2, center_y)                      # Right point
    ]
    draw.polygon(triangle, fill='white')

    # Draw golden trophy at bottom
    trophy_y = size * 0.7
    trophy_size = size * 0.15

    # Trophy cup (simple circle)
    draw.ellipse(
        [center_x - trophy_size//2, trophy_y - trophy_size//2,
         center_x + trophy_size//2, trophy_y + trophy_size//2],
        fill=(255, 215, 0),  # Gold color
        outline=(255, 193, 37),
        width=2
    )

    # Add "YT" text at top
    text_size = int(size * 0.15)
    try:
        # Try to use a better font if available
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", text_size)
    except:
        font = ImageFont.load_default()

    text = "YT"
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = size * 0.1

    draw.text((text_x, text_y), text, fill='white', font=font)

    return img

# Create PNG files in various sizes
sizes = [16, 32, 48, 64, 128, 256, 512]
images = []

for size in sizes:
    img = create_icon_image(size)
    filename = f'build-resources/{size}x{size}.png'
    img.save(filename, 'PNG')
    images.append(img)
    print(f"Created {filename}")

# Create main icon.png
main_icon = create_icon_image(512)
main_icon.save('build-resources/icon.png', 'PNG')
print("Created build-resources/icon.png")

# Create Windows ICO file with multiple sizes
ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
ico_images = []

for size in ico_sizes:
    img = create_icon_image(size[0])
    ico_images.append(img)

# Save as ICO
ico_images[0].save(
    'build-resources/icon.ico',
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print("Created build-resources/icon.ico")

# For macOS ICNS, we'll use the PNG files
# macOS can work with PNG files as icons in many cases
print("\n✅ Icon files created successfully!")
print("Note: For production, consider using a professional icon design.")
print("\nTo create macOS .icns file, run:")
print("  iconutil -c icns build-resources/icon.iconset")
print("  (after organizing PNGs in icon.iconset folder)")

# Create a simple iconset structure for macOS
import shutil

iconset_dir = 'build-resources/icon.iconset'
os.makedirs(iconset_dir, exist_ok=True)

# macOS iconset naming convention
macos_sizes = {
    16: ['icon_16x16.png'],
    32: ['icon_16x16@2x.png', 'icon_32x32.png'],
    64: ['icon_32x32@2x.png'],
    128: ['icon_128x128.png'],
    256: ['icon_128x128@2x.png', 'icon_256x256.png'],
    512: ['icon_256x256@2x.png', 'icon_512x512.png']
}

for size in sizes:
    img = create_icon_image(size)
    if size in macos_sizes:
        for filename in macos_sizes[size]:
            filepath = os.path.join(iconset_dir, filename)
            img.save(filepath, 'PNG')
            print(f"Created {filepath}")

# Also create 1024 for retina
img_1024 = create_icon_image(1024)
img_1024.save(os.path.join(iconset_dir, 'icon_512x512@2x.png'), 'PNG')

print(f"\n✅ macOS iconset created in {iconset_dir}")
print("Icons are ready for building!")