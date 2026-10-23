#!/usr/bin/env python3
"""
`python3 scripts/motion-diff.py <baseline> <after> [<noise>...]`: the motion pass's visual check. Compares
the canvas-hidden screens (`NOCANVAS=1 node scripts/motion-shots.mjs`) of <after> against <baseline>,
pixel by pixel. With the 3D hidden, everything left on screen is UI and must match.

Each <noise> is another capture of the baseline itself: pixels that differ between two captures of the same
code (live counters, clocks, a per-session QR code, the console feed) are content, not layout, and are
ignored, grown by a few pixels. Prints each screen that differs anywhere else, with the bounding box of
the difference, and writes a red overlay of it to <after>/diff/. Exits 1 if any screen differs.
"""
import os
import sys

import numpy as np
from PIL import Image

base, after = sys.argv[1], sys.argv[2]
noise_dirs = sys.argv[3:]
THRESH = 24  # per-channel difference that counts (anti-aliasing and JPEG-free PNG noise stay under it)
GROW = 6


def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)


def grow(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def changed(a, b):
    if a.shape != b.shape:
        return None
    return (np.abs(a - b).max(axis=2) > THRESH)


os.makedirs(f"{after}/diff", exist_ok=True)
bad = 0
names = sorted(n for n in os.listdir(base) if n.endswith(".png"))
for n in names:
    if not os.path.exists(f"{after}/{n}"):
        print(f"✗ {n}: missing in {after} (the page got shorter?)")
        bad += 1
        continue
    a, b = load(f"{base}/{n}"), load(f"{after}/{n}")
    d = changed(a, b)
    if d is None:
        print(f"✗ {n}: size {a.shape[1]}×{a.shape[0]} → {b.shape[1]}×{b.shape[0]}")
        bad += 1
        continue
    for nd in noise_dirs:
        if os.path.exists(f"{nd}/{n}"):
            z = changed(a, load(f"{nd}/{n}"))
            if z is not None:
                d &= ~grow(z, GROW)
    count = int(d.sum())
    if count > 40:
        ys, xs = np.nonzero(d)
        print(f"✗ {n}: {count} px differ in x {xs.min()}–{xs.max()}, y {ys.min()}–{ys.max()}")
        o = np.asarray(Image.open(f"{after}/{n}").convert("RGB")).copy()
        o[d] = [255, 0, 0]
        Image.fromarray(o).save(f"{after}/diff/{n}")
        bad += 1
extra = sorted(set(n for n in os.listdir(after) if n.endswith(".png")) - set(names))
for n in extra:
    print(f"✗ {n}: new screen (the page got taller?)")
    bad += 1
print(f"{'✗' if bad else '✓'} motion-diff: {len(names)} screens, {bad} differ outside the 3D.")
sys.exit(1 if bad else 0)
