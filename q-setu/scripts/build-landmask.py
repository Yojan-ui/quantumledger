"""Rasterises Natural Earth admin-0 countries (India point of view) into an equirectangular land
mask for the globe: red = land, green = India. Pure Python (no dependencies).

  python3 scripts/build-landmask.py ne_10m_admin_0_countries_ind.geojson apps/web/public/globe/landmask.png
"""
import json, math, struct, sys, zlib

W, H = 2048, 1024
src, out = sys.argv[1], sys.argv[2]
fc = json.load(open(src))

def dp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return dp(pts[: idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [a, b]

def simplify(ring, eps=0.04):
    if len(ring) < 8:
        return ring
    k = max(range(len(ring)), key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    return dp(ring[: k + 1], eps)[:-1] + dp(ring[k:], eps)

img = bytearray(W * H * 3)

def fill(rings, channel):
    """Even-odd scanline fill of all rings of one polygon (outer + holes)."""
    edges = []
    for ring in rings:
        pts = [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in simplify(ring)]
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            if y0 != y1:
                edges.append((x0, y0, x1, y1))
    if not edges:
        return
    ymin = max(0, int(min(min(e[1], e[3]) for e in edges)))
    ymax = min(H - 1, int(max(max(e[1], e[3]) for e in edges)) + 1)
    for row in range(ymin, ymax + 1):
        y = row + 0.5
        xs = sorted(x0 + (y - y0) * (x1 - x0) / (y1 - y0) for x0, y0, x1, y1 in edges if (y0 <= y < y1) or (y1 <= y < y0))
        for i in range(0, len(xs) - 1, 2):
            for col in range(max(0, int(xs[i] + 0.5)), min(W, int(xs[i + 1] + 0.5))):
                img[(row * W + col) * 3 + channel] = 255

for f in fc["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    india = f["properties"].get("ADM0_A3") == "IND"
    for p in polys:
        fill(p, 0)
        if india:
            fill(p, 1)

raw = b"".join(b"\x00" + bytes(img[r * W * 3 : (r + 1) * W * 3]) for r in range(H))
chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
open(out, "wb").write(png)
print(f"wrote {out} ({len(png)} bytes)")
