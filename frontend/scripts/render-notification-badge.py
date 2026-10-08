#!/usr/bin/env python3
"""Render public/badge-72.png from the microphone in public/icon.svg.

Android notification badges use the alpha channel as a mask. The mark is
white on a transparent background, with a few pixels of padding so the
stand is not clipped. This file is separate from the home-screen icon
renderer so the two can land independently.
"""

import math
import struct
import zlib
from pathlib import Path

WHITE = (255, 255, 255)
SIZE = 72
PAD = 4
OUT = Path(__file__).resolve().parents[1] / "public" / "badge-72.png"

# Bounding box of the mark in the 512 viewBox (arc stroke included).
MARK_CX = 256.0
MARK_CY = 300.0
MARK_H = 320.0


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
    """Signed distance, in viewBox units, to the white microphone."""
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


def render(size):
    buf = bytearray(size * size * 4)
    scale = (size - 2 * PAD) / MARK_H
    for y in range(size):
        for x in range(size):
            sx = MARK_CX + ((x + 0.5) - size / 2) / scale
            sy = MARK_CY + ((y + 0.5) - size / 2) / scale
            alpha = coverage(mark_coverage(sx, sy) * scale)
            if alpha <= 0:
                continue
            i = (y * size + x) * 4
            buf[i] = WHITE[0]
            buf[i + 1] = WHITE[1]
            buf[i + 2] = WHITE[2]
            buf[i + 3] = int(alpha * 255 + 0.5)
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
    write_png(OUT, SIZE, render(SIZE))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
