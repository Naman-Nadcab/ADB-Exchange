#!/usr/bin/env python3
"""DEPRECATED — legacy Arial wordmark pipeline.

Superseded by scripts/export-brand-assets.py which exports PNGs from the
supplied EDA EXCHANGE reference artwork. Do not run this script for production
logo generation.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / '.tmp-brand-out' / 'master-logo.png'
OUT = ROOT / '.tmp-brand-out'

# Gold tone sampled from the artwork
GOLD = (184, 148, 90)
WHITE = (255, 255, 255)


def strip_checkerboard(im: Image.Image) -> Image.Image:
    """Remove light/dark checkerboard and flat gray backgrounds."""
    im = im.convert('RGBA')
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a < 10:
                continue
            spread = max(r, g, b) - min(r, g, b)
            avg = (r + g + b) / 3
            if spread <= 18 and avg >= 195:
                continue
            if spread <= 12 and 105 <= avg <= 175:
                continue
            dst[x, y] = (r, g, b, a)
    return out


def crop_content(im: Image.Image, pad: int = 6) -> Image.Image:
    im = im.convert('RGBA')
    w, h = im.size
    xs: list[int] = []
    ys: list[int] = []
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 12:
                xs.append(x)
                ys.append(y)
    if not xs:
        return im
    left = max(0, min(xs) - pad)
    right = min(w - 1, max(xs) + pad)
    top = max(0, min(ys) - pad)
    bottom = min(h - 1, max(ys) + pad)
    return im.crop((left, top, right + 1, bottom + 1))


def split_icon_mark(im: Image.Image) -> Image.Image:
    """Keep only the chart/globe mark (drop baked-in wordmark)."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    row_counts = [
        sum(1 for x in range(w) if px[x, y][3] > 12) for y in range(h)
    ]

    # Find the wide text band below the mark.
    text_start = h
    for y in range(int(h * 0.45), h):
        if row_counts[y] > w * 0.25:
            text_start = min(text_start, y)
            break

    gap_end = text_start
    for y in range(text_start - 1, int(h * 0.2), -1):
        if row_counts[y] < w * 0.02:
            gap_end = y
            break

    icon = im.crop((0, 0, w, max(gap_end, int(h * 0.55))))
    return crop_content(icon, pad=8)


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def render_wordmark(
    text_top: str,
    text_bottom: str | None,
    width: int,
    color: tuple[int, int, int],
) -> Image.Image:
    """Render EDA EXCHANGE wordmark to match the supplied logo style."""
    top_font = load_font(max(18, width // 9))
    bottom_font = load_font(max(12, width // 14)) if text_bottom else top_font

    probe = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    top_box = draw.textbbox((0, 0), text_top, font=top_font)
    top_w, top_h = top_box[2] - top_box[0], top_box[3] - top_box[1]
    if text_bottom:
        bottom_box = draw.textbbox((0, 0), text_bottom, font=bottom_font)
        bottom_w, bottom_h = bottom_box[2] - bottom_box[0], bottom_box[3] - bottom_box[1]
    else:
        bottom_w = bottom_h = 0

    gap = max(4, width // 40)
    canvas_w = width
    canvas_h = top_h + (gap + bottom_h if text_bottom else 0) + 8
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.text(((canvas_w - top_w) // 2, 0), text_top, fill=(*color, 255), font=top_font)
    if text_bottom:
        draw.text(
            ((canvas_w - bottom_w) // 2, top_h + gap),
            text_bottom,
            fill=(*color, 255),
            font=bottom_font,
        )
    return canvas


def compose_stacked(icon: Image.Image, text: Image.Image, gap: int = 12) -> Image.Image:
    icon = icon.convert('RGBA')
    text = text.convert('RGBA')
    width = max(icon.width, text.width)
    height = icon.height + gap + text.height
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    canvas.paste(icon, ((width - icon.width) // 2, 0), icon)
    canvas.paste(text, ((width - text.width) // 2, icon.height + gap), text)
    return canvas


def compose_header(icon: Image.Image, text: Image.Image, gap: int = 18) -> Image.Image:
    """Icon left, wordmark right — fits navbar height presets."""
    icon = icon.convert('RGBA')
    text = text.convert('RGBA')
    target_icon_h = max(text.height, int(text.height * 1.1))
    scale = target_icon_h / icon.height
    icon = icon.resize((max(1, int(icon.width * scale)), target_icon_h), Image.Resampling.LANCZOS)
    width = icon.width + gap + text.width
    height = max(icon.height, text.height)
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    canvas.paste(icon, (0, (height - icon.height) // 2), icon)
    canvas.paste(text, (icon.width + gap, (height - text.height) // 2), text)
    return canvas


def fit_width(im: Image.Image, width: int) -> Image.Image:
    ratio = width / im.width
    height = max(1, round(im.height * ratio))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def square_icon(im: Image.Image, size: int) -> Image.Image:
    im = im.convert('RGBA')
    side = max(im.width, im.height)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return square.resize((size, size), Image.Resampling.LANCZOS)


def verify_transparent(path: Path) -> None:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    corners = [im.getpixel(p)[3] for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    gray_opaque = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = im.getpixel((x, y))
            if a > 200 and max(r, g, b) - min(r, g, b) < 8 and 110 <= (r + g + b) / 3 <= 250:
                gray_opaque += 1
    print(f'{path.name}: {w}x{h} corners={corners} gray_opaque={gray_opaque}')


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f'Master logo missing: {MASTER}')

    cleaned = crop_content(strip_checkerboard(Image.open(MASTER)))
    icon = split_icon_mark(cleaned)

    # Wordmark width follows the mark; header CSS scales height.
    word_w = max(180, icon.width // 2)
    text_gold = render_wordmark('EDA', 'EXCHANGE', word_w, GOLD)
    text_white = render_wordmark('EDA', 'EXCHANGE', word_w, WHITE)

    horizontal_gold = compose_header(icon, text_gold)
    horizontal_white = compose_header(icon, text_white)
    marketing = fit_width(compose_stacked(icon, text_gold, gap=16), 420)
    icon_gold = square_icon(icon, 512)

    outputs = {
        'logo-horizontal-gold.png': horizontal_gold,
        'logo-horizontal-white.png': horizontal_white,
        'logo-marketing.png': marketing,
        'icon-gold.png': icon_gold,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    for name, image in outputs.items():
        target = OUT / name
        image.save(target, optimize=True)
        verify_transparent(target)

    favicon_src = square_icon(icon, 512)
    for size in (16, 32, 192, 512):
        favicon_src.resize((size, size), Image.Resampling.LANCZOS).save(
            OUT / f'favicon-{size}.png', optimize=True
        )
    square_icon(icon, 1024).save(OUT / 'app-icon-1024.png', optimize=True)

    print('Done.')


if __name__ == '__main__':
    main()
