#!/usr/bin/env python3
"""Generate TrustScan toolbar/store icons (rounded tile, shield, checkmark).

Pure-python PNG writer — no third-party deps. Supersampled rasterizer for
smooth edges. Outputs 16/32/48/128 px PNGs to assets/icons/.
"""
import struct, zlib, math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- geometry
def bezier(p0, p1, p2, n=32):
    """Quadratic bezier sampled into n points."""
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts

def arc(cx, cy, r, a0, a1, n=20):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in [a0 + (a1 - a0) * i / n for i in range(n + 1)]]

def shield_polygon():
    """Shield outline in unit coordinates (0..1)."""
    pts = []
    pts += arc(0.185, 0.145, 0.105, 180, 270)      # top-left round
    pts += arc(0.815, 0.145, 0.105, 270, 360)      # top-right round
    pts += [(0.92, 0.40), (0.92, 0.50)]            # right side
    pts += bezier((0.92, 0.50), (0.87, 0.715), (0.50, 0.94), 26)  # to bottom tip
    pts += bezier((0.50, 0.94), (0.13, 0.715), (0.08, 0.50), 26)  # back up
    pts += [(0.08, 0.40), (0.08, 0.245)]           # left side
    return pts

SHIELD = shield_polygon()

def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            x_int = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_int:
                inside = not inside
        j = i
    return inside

def dist_seg(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(px - ax, py - ay)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - bx, py - by)
    t = c1 / c2
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))

CHECK = [(0.375, 0.545, 0.475, 0.660), (0.475, 0.660, 0.660, 0.440)]
CHECK_W = 0.062

def in_check(x, y):
    return any(dist_seg(x, y, *s) < CHECK_W for s in CHECK)

def in_tile(x, y, r=0.225):
    if r <= x <= 1 - r or r <= y <= 1 - r:
        return (r <= x <= 1 - r) and (r <= y <= 1 - r)
    # corner
    cx = min(max(x, r), 1 - r)
    cy = min(max(y, r), 1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ---------------------------------------------------------------- png
def write_png(path, size, grid):
    raw = b""
    for row in grid:
        raw += b"\x00" + b"".join(struct.pack("BBBB", *px) for px in row)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

def render(size, ss=3):
    TILE_A, TILE_B = (22, 25, 36), (11, 13, 19)     # #161924 -> #0B0D13
    SHIELD_A, SHIELD_B = (139, 156, 255), (70, 198, 180)  # indigo -> teal
    CHECK_C = (10, 12, 16)

    grid = []
    for py in range(size):
        row = []
        for pxx in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (pxx + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    if in_tile(x, y):
                        col, alpha = TILE_A if False else lerp(TILE_A, TILE_B, y), 255
                        if point_in_poly(x, y, SHIELD):
                            t = max(0.0, min(1.0, (y - 0.14) / 0.78))
                            col = lerp(SHIELD_A, SHIELD_B, t)
                            if in_check(x, y):
                                col = CHECK_C
                        r += col[0]; g += col[1]; b += col[2]; a += alpha
            n = ss * ss
            row.append((round(r / n), round(g / n), round(b / n), round(a / n)))
        grid.append(row)
    return grid

if __name__ == "__main__":
    for s in (16, 32, 48, 128):
        write_png(os.path.join(OUT, "icon%d.png" % s), s, render(s))
        print("wrote icon%d.png" % s)
