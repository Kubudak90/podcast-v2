#!/usr/bin/env python3
"""Render the PodChat mark in public/icon.svg to the PWA PNGs.

Any-purpose icons keep the rounded tile. Maskable icons use a full-bleed
background and scale the mark into the center safe zone so Android can crop
the corners without cutting off the stand.
"""

import math
import struct
import zlib
from pathlib import Path

INDIGO = (99, 102, 241)
WHITE = (255, 255, 255)
OUT = Path(__file__).resolve().parents[1] / "public"


def bezier(t, p0, p1, p2, p3):
    u = 1 - t
    return (
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    )


def dist_to_segment(px, py, ax, ay, bx, by):
    abx, aby = bx - ax, by - ay
    length_sq = abx * abx + aby * aby
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / length_sq))
    return math.hypot(px - (ax + abx * t), py - (ay + aby * t))


def sd_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


def sd_round_box(px, py, x, y, w, h, r):
    cx, cy = x + w / 2, y + h / 2
    hw, hh = w / 2, h / 2
    dx = abs(px - cx) - hw + r
    dy = abs(py - cy) - hh + r
    return math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - r


def coverage(sd_px):
    if sd_px <= -0.5:
        return 1.0
    if sd_px >= 0.5:
        return 0.0
    return 0.5 - sd_px


def build_arc_segments():
    p0, p1, p2, p3 = (176, 320), (176, 380), (336, 380), (336, 320)
    steps = 48
    points = [bezier(i / steps, p0, p1, p2, p3) for i in range(steps + 1)]
    return list(zip(points, points[1:]))


ARC = build_arc_segments()


def mark_coverage(sx, sy):
    """White microphone coverage in the 512 viewBox. sx/sy are source pixels."""
    shapes = (
        sd_circle(sx, sy, 256, 200, 60),
        sd_round_box(sx, sy, 226, 260, 60, 100, 30),
        sd_round_box(sx, sy, 246, 380, 20, 60, 0),
        sd_round_box(sx, sy, 196, 440, 120, 20, 10),
    )
    best = min(shapes)
    if 156 <= sx <= 356 and 300 <= sy <= 400:
        for (ax, ay), (bx, by) in ARC:
            best = min(best, dist_to_segment(sx, sy, ax, ay, bx, by) - 10)
    return best


def render(size, maskable):
    buf = bytearray(size * size * 4)
    # Maskable art sits inside the inner keyline so a circle crop keeps the stand.
    art = 0.8 if maskable else 1.0
    unit = 512 / size
    for y in range(size):
        for x in range(size):
            sx = (x + 0.5) * unit
            sy = (y + 0.5) * unit
            if maskable:
                bg = 1.0
                mx = 256 + (sx - 256) / art
                my = 256 + (sy - 256) / art
            else:
                bg = coverage(sd_round_box(sx, sy, 0, 0, 512, 512, 100) / unit)
                mx, my = sx, sy
            # Distances are in viewBox units. Maskable art is scaled by `art`,
            # so one canvas pixel covers `unit / art` viewBox units.
            white = coverage(mark_coverage(mx, my) * (art if maskable else 1.0) / unit)
            out_a = white + bg * (1 - white)
            if out_a <= 0:
                continue
            inv = 1 - white
            r = (WHITE[0] * white + INDIGO[0] * bg * inv) / out_a
            g = (WHITE[1] * white + INDIGO[1] * bg * inv) / out_a
            b = (WHITE[2] * white + INDIGO[2] * bg * inv) / out_a
            i = (y * size + x) * 4
            buf[i] = int(r + 0.5)
            buf[i + 1] = int(g + 0.5)
            buf[i + 2] = int(b + 0.5)
            buf[i + 3] = int(out_a * 255 + 0.5)
    return bytes(buf)


def write_png(path, size, rgba):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    jobs = (
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-192.png", 192, True),
        ("icon-maskable-512.png", 512, True),
    )
    for name, size, maskable in jobs:
        print(f"rendering {name}")
        write_png(OUT / name, size, render(size, maskable))
    print("done")


if __name__ == "__main__":
    main()
