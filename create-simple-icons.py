#!/usr/bin/env python3
"""Create simple icon files for Windows and macOS"""

from PIL import Image, ImageDraw
import os

# Create build-resources directory if not exists
os.makedirs('build-resources', exist_ok=True)

def create_icon_image(size):
    """Create a simple icon image"""
    # Create new image with red background
    img = Image.new('RGBA', (size, size), color=(220, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Draw white circle in center
    margin = size * 0.2
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill='white'
    )

    # Draw red play triangle
    triangle_size = size * 0.3
    center_x = size // 2
    center_y = size // 2

    # Play button coordinates
    triangle = [
        (center_x - triangle_size//3, center_y - triangle_size//2),
        (center_x - triangle_size//3, center_y + triangle_size//2),
        (center_x + triangle_size//2, center_y)
    ]
    draw.polygon(triangle, fill=(220, 0, 0))

    return img

print("Creating icon files...")

# Create PNG files in various sizes
sizes = [16, 32, 48, 64, 128, 256, 512]
images = []

for size in sizes:
    img = create_icon_image(size)
    filename = f'build-resources/{size}x{size}.png'
    img.save(filename, 'PNG')
    images.append(img)
    print(f"✓ {filename}")

# Create main icon.png
main_icon = create_icon_image(512)
main_icon.save('build-resources/icon.png', 'PNG')
print("✓ build-resources/icon.png")

# Create Windows ICO file
print("\nCreating Windows ICO...")
ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
ico_images = []

for width, height in ico_sizes:
    img = create_icon_image(width)
    ico_images.append(img)

# Save as ICO with all sizes
ico_images[0].save(
    'build-resources/icon.ico',
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print("✓ build-resources/icon.ico")

# Create macOS ICNS placeholder
# For a real ICNS, we need iconutil command on macOS
print("\nCreating macOS icon placeholder...")
main_icon.save('build-resources/icon.icns', 'PNG')
print("✓ build-resources/icon.icns (PNG placeholder)")

print("\n✅ All icon files created successfully!")
print("Ready to build Windows executable!")