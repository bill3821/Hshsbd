#!/usr/bin/env python3
"""Generate the launcher icon (PNG + ICO) with nothing but the standard library.

Run it if you want to tweak the look:  python3 launcher/make_icon.py
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 256
SS = 4  # supersampling factor for smooth edges

BG_TOP = (0x14, 0x14, 0x20)
BG_BOTTOM = (0x0A, 0x0A, 0x0F)
GREEN = (0x00, 0xE8, 0x8A)
BORDER = (0x2E, 0x2E, 0x3E)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def in_rounded_rect(x, y, left, top, right, bottom, radius):
    if x < left or x > right or y < top or y > bottom:
        return False
    for cx, cy in ((left + radius, top + radius), (right - radius, top + radius),
                   (left + radius, bottom - radius), (right - radius, bottom - radius)):
        if ((x < left + radius) == (cx == left + radius)) and \
           ((y < top + radius) == (cy == top + radius)):
            if (x < left + radius or x > right - radius) and \
               (y < top + radius or y > bottom - radius):
                return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
    return True


def in_bar(x, y, index, n=4, unit=1.0):
    """Rising bar chart across the lower half."""
    gap = 0.055 * unit
    width = (0.56 * unit - gap * (n - 1)) / n
    left = 0.22 * unit + index * (width + gap)
    heights = (0.16, 0.26, 0.36, 0.48)
    bottom = 0.80 * unit
    top = bottom - heights[index] * unit
    return left <= x <= left + width and top <= y <= bottom


def in_arrow(x, y, unit=1.0):
    """Upward arrow sweeping over the bars."""
    # shaft: thick diagonal from lower-left to upper-right
    x0, y0 = 0.22 * unit, 0.62 * unit
    x1, y1 = 0.74 * unit, 0.26 * unit
    dx, dy = x1 - x0, y1 - y0
    length2 = dx * dx + dy * dy
    t = ((x - x0) * dx + (y - y0) * dy) / length2
    if 0.0 <= t <= 1.0:
        px, py = x0 + t * dx, y0 + t * dy
        if (x - px) ** 2 + (y - py) ** 2 <= (0.052 * unit) ** 2:
            return True
    # head: triangle at the tip
    ax, ay = 0.80 * unit, 0.20 * unit
    bx, by = 0.80 * unit, 0.44 * unit
    cx, cy = 0.56 * unit, 0.20 * unit

    def side(x1_, y1_, x2_, y2_):
        return (x2_ - x1_) * (y - y1_) - (y2_ - y1_) * (x - x1_)

    s1, s2, s3 = side(ax, ay, bx, by), side(bx, by, cx, cy), side(cx, cy, ax, ay)
    return (s1 >= 0 and s2 >= 0 and s3 >= 0) or (s1 <= 0 and s2 <= 0 and s3 <= 0)


def render():
    hi = SIZE * SS
    # accumulate RGBA at supersampled resolution, then box-filter down
    rows = []
    for py in range(SIZE):
        row = bytearray()
        for px in range(SIZE):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    fx = (px * SS + sx + 0.5) / hi
                    fy = (py * SS + sy + 0.5) / hi
                    sr, sg, sb, sa = sample(fx, fy)
                    r += sr; g += sg; b += sb; a += sa
            n = SS * SS
            row += bytes((r // n, g // n, b // n, a // n))
        rows.append(bytes(row))
    return rows


def sample(fx, fy):
    """Colour of the icon at normalised coords (0..1). Returns RGBA."""
    if not in_rounded_rect(fx, fy, 0.02, 0.02, 0.98, 0.98, 0.20):
        return (0, 0, 0, 0)

    base = lerp(BG_TOP, BG_BOTTOM, fy)

    # subtle inner border
    if not in_rounded_rect(fx, fy, 0.05, 0.05, 0.95, 0.95, 0.175):
        base = lerp(base, BORDER, 0.85)

    if in_arrow(fx, fy):
        return GREEN + (255,)

    for i in range(4):
        if in_bar(fx, fy, i):
            shade = lerp((0x1E, 0x6E, 0x55), GREEN, i / 3.0)
            return shade + (255,)

    return base + (255,)


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)
    return png


def downscale(rows, size, target):
    """Box-filter an RGBA row list down to target x target."""
    factor = size // target
    out = []
    for ty in range(target):
        row = bytearray()
        for tx in range(target):
            acc = [0, 0, 0, 0]
            for sy in range(factor):
                src = rows[ty * factor + sy]
                for sx in range(factor):
                    o = ((tx * factor + sx) * 4)
                    for ch in range(4):
                        acc[ch] += src[o + ch]
            n = factor * factor
            row += bytes(v // n for v in acc)
        out.append(bytes(row))
    return out


def write_ico(path, pngs):
    """ICO holding PNG-compressed entries (Windows Vista and newer)."""
    count = len(pngs)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + 16 * count
    entries, blobs = b"", b""
    for size, data in pngs:
        entries += struct.pack("<BBBBHHII", size if size < 256 else 0,
                               size if size < 256 else 0, 0, 0, 1, 32,
                               len(data), offset)
        blobs += data
        offset += len(data)
    with open(path, "wb") as fh:
        fh.write(header + entries + blobs)


def write_icns(path, pngs):
    """macOS .icns holding PNG-compressed entries."""
    types = {32: b"ic11", 64: b"ic12", 128: b"ic07", 256: b"ic08"}
    body = b""
    for size, data in pngs:
        tag = types.get(size)
        if tag:
            body += tag + struct.pack(">I", len(data) + 8) + data
    with open(path, "wb") as fh:
        fh.write(b"icns" + struct.pack(">I", len(body) + 8) + body)


def main():
    rows = render()
    png_path = os.path.join(HERE, "fly-trader.png")
    write_png(png_path, rows, SIZE)

    variants = []
    for target in (256, 128, 64, 32, 16):
        scaled = rows if target == SIZE else downscale(rows, SIZE, target)
        tmp = os.path.join(HERE, ".icon-%d.png" % target)
        data = write_png(tmp, scaled, target)
        os.remove(tmp)
        variants.append((target, data))
    write_ico(os.path.join(HERE, "fly-trader.ico"),
              [v for v in variants if v[0] in (256, 64, 32, 16)])
    write_icns(os.path.join(HERE, "fly-trader.icns"), variants)
    print("wrote fly-trader.png, fly-trader.ico and fly-trader.icns")


if __name__ == "__main__":
    main()
