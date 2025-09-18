#!/usr/bin/env python3
"""Fix Windows ICO file with proper sizes"""

from PIL import Image, ImageDraw
import os

def create_icon_image(size):
    """Create a simple icon image"""
    img = Image.new('RGBA', (size, size), color=(220, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # White circle
    margin = size * 0.2
    draw.ellipse([margin, margin, size - margin, size - margin], fill='white')

    # Red play triangle
    center_x, center_y = size // 2, size // 2
    triangle_size = size * 0.3
    triangle = [
        (center_x - triangle_size//3, center_y - triangle_size//2),
        (center_x - triangle_size//3, center_y + triangle_size//2),
        (center_x + triangle_size//2, center_y)
    ]
    draw.polygon(triangle, fill=(220, 0, 0))

    return img

print("Creating proper Windows ICO file...")

# Create individual images for each size
img_256 = create_icon_image(256)
img_48 = create_icon_image(48)
img_32 = create_icon_image(32)
img_16 = create_icon_image(16)

# Save as multi-size ICO
img_256.save(
    'build-resources/icon.ico',
    format='ICO',
    sizes=[(256, 256), (48, 48), (32, 32), (16, 16)]
)

print("✅ Fixed icon.ico with proper sizes (256x256, 48x48, 32x32, 16x16)")
print("Ready to build Windows executable!")