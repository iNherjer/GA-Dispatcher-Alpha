#!/usr/bin/env python3
"""Generate a VFR Multitool app icon suitable for iOS/Android."""

from PIL import Image, ImageDraw, ImageFont
import math, os

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# --- Background: dark navy/charcoal gradient feel ---
# Rounded rect is handled by iOS automatically, so we fill the full square
# with a rich dark blue-grey background
bg_color = (18, 25, 38)
draw.rectangle([0, 0, SIZE, SIZE], fill=bg_color)

# Subtle radial gradient overlay (lighter center)
center = SIZE // 2
for r in range(center, 0, -2):
    alpha = int(35 * (1 - r / center))
    col = (40, 70, 110, alpha)
    draw.ellipse([center - r, center - r, center + r, center + r], fill=col)

# --- Compass Rose (center, large) ---
cx, cy = SIZE // 2, SIZE // 2 - 20
outer_r = 320
inner_r = 100
tick_r = 340

def polar(angle_deg, radius, ox=cx, oy=cy):
    a = math.radians(angle_deg - 90)
    return (ox + radius * math.cos(a), oy + radius * math.sin(a))

# Outer circle ring
for w in range(3):
    draw.ellipse(
        [cx - outer_r - w, cy - outer_r - w, cx + outer_r + w, cy + outer_r + w],
        outline=(180, 200, 220, 180), width=2
    )
# Inner circle
draw.ellipse(
    [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
    outline=(180, 200, 220, 140), width=2
)

# Tick marks (every 30 degrees)
for deg in range(0, 360, 30):
    p1 = polar(deg, outer_r - 15)
    p2 = polar(deg, outer_r + 12)
    w = 3 if deg % 90 == 0 else 1
    draw.line([p1, p2], fill=(180, 200, 220, 200), width=w)

# Cardinal points - large diamond shapes
point_color_n = (70, 180, 255)   # North = bright blue
point_color_s = (180, 200, 220)  # South = silver
point_color_e = (180, 200, 220)
point_color_w = (180, 200, 220)

def draw_cardinal_point(angle, color_light, color_dark, length):
    """Draw a diamond-shaped compass point."""
    tip = polar(angle, length)
    left = polar(angle - 12, inner_r + 20)
    right = polar(angle + 12, inner_r + 20)
    center_pt = polar(angle, inner_r - 5)
    # Light half
    draw.polygon([tip, left, center_pt], fill=color_light)
    # Dark half
    draw.polygon([tip, right, center_pt], fill=color_dark)

# N, E, S, W
draw_cardinal_point(0,   point_color_n, (40, 120, 200), outer_r - 20)
draw_cardinal_point(180, (120, 130, 140), (80, 90, 100), outer_r - 20)
draw_cardinal_point(90,  (160, 170, 180), (100, 110, 120), outer_r - 50)
draw_cardinal_point(270, (160, 170, 180), (100, 110, 120), outer_r - 50)

# Intermediate points (NE, SE, SW, NW) - shorter
for angle in [45, 135, 225, 315]:
    draw_cardinal_point(angle, (100, 115, 130), (70, 80, 90), outer_r - 80)

# Center dot
draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(70, 180, 255))
draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(200, 220, 240))

# --- "N" label ---
try:
    font_n = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
except:
    font_n = ImageFont.load_default()

n_pos = polar(0, outer_r + 45)
draw.text(n_pos, "N", fill=(70, 180, 255), font=font_n, anchor="mm")

# --- Dashed route line across the compass ---
route_color = (255, 160, 50, 220)  # warm orange
route_points = [
    (180, 780),
    (300, 600),
    (450, 520),
    (620, 400),
    (750, 280),
    (850, 200),
]

# Draw dashed line segments
for i in range(len(route_points) - 1):
    x1, y1 = route_points[i]
    x2, y2 = route_points[i + 1]
    seg_len = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    dash_len = 12
    gap_len = 10
    total = dash_len + gap_len
    n_dashes = int(seg_len / total)
    for d in range(n_dashes):
        t1 = (d * total) / seg_len
        t2 = (d * total + dash_len) / seg_len
        t2 = min(t2, 1.0)
        dx1 = x1 + (x2 - x1) * t1
        dy1 = y1 + (y2 - y1) * t1
        dx2 = x1 + (x2 - x1) * t2
        dy2 = y1 + (y2 - y1) * t2
        draw.line([(dx1, dy1), (dx2, dy2)], fill=route_color, width=4)

# Waypoint dots on route
for i, (px, py) in enumerate(route_points):
    r = 10 if i in (0, len(route_points) - 1) else 7
    draw.ellipse([px - r, py - r, px + r, py + r], fill=route_color, outline=(255, 200, 100), width=2)

# --- Small airplane silhouette along the route ---
# Position it at middle of the route
ap_x, ap_y = 540, 450
ap_size = 50

# Simple airplane shape (triangle + wings)
plane_color = (255, 255, 255, 230)
# Fuselage
draw.polygon([
    (ap_x, ap_y - ap_size),        # nose
    (ap_x - 8, ap_y + ap_size//2), # tail left
    (ap_x + 8, ap_y + ap_size//2), # tail right
], fill=plane_color)
# Wings
draw.polygon([
    (ap_x, ap_y - 5),
    (ap_x - ap_size + 5, ap_y + 15),
    (ap_x - ap_size + 5, ap_y + 22),
    (ap_x, ap_y + 10),
], fill=plane_color)
draw.polygon([
    (ap_x, ap_y - 5),
    (ap_x + ap_size - 5, ap_y + 15),
    (ap_x + ap_size - 5, ap_y + 22),
    (ap_x, ap_y + 10),
], fill=plane_color)
# Tail wing
draw.polygon([
    (ap_x, ap_y + ap_size//2 - 10),
    (ap_x - 18, ap_y + ap_size//2),
    (ap_x + 18, ap_y + ap_size//2),
], fill=plane_color)

# --- "VFR" text at bottom ---
try:
    font_vfr = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 88)
except:
    font_vfr = ImageFont.load_default()

vfr_y = SIZE - 95
# Text shadow
draw.text((cx + 2, vfr_y + 2), "VFR", fill=(0, 0, 0, 150), font=font_vfr, anchor="mm")
draw.text((cx, vfr_y), "VFR", fill=(220, 230, 240), font=font_vfr, anchor="mm")

# --- Subtle border ring for the whole icon ---
border_margin = 20
draw.rounded_rectangle(
    [border_margin, border_margin, SIZE - border_margin, SIZE - border_margin],
    radius=180,
    outline=(70, 180, 255, 60),
    width=3
)

# Save master 1024x1024
out_dir = os.path.dirname(os.path.abspath(__file__))
master_path = os.path.join(out_dir, "icon-1024.png")
img_rgb = Image.new("RGB", (SIZE, SIZE), bg_color)
img_rgb.paste(img, (0, 0), img)
img_rgb.save(master_path, "PNG")
print(f"Saved: {master_path}")

# Generate iOS/Android standard sizes
sizes = [180, 167, 152, 120]
for s in sizes:
    resized = img_rgb.resize((s, s), Image.LANCZOS)
    p = os.path.join(out_dir, f"apple-touch-icon-{s}x{s}.png")
    resized.save(p, "PNG")
    print(f"Saved: {p}")

# Also save a general apple-touch-icon (180x180)
resized = img_rgb.resize((180, 180), Image.LANCZOS)
p = os.path.join(out_dir, "apple-touch-icon.png")
resized.save(p, "PNG")
print(f"Saved: {p}")

print("Done!")
