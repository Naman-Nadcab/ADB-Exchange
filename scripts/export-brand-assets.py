#!/usr/bin/env python3
"""Export EDA EXCHANGE brand PNGs from supplied reference artwork.

Uses the attached logo images as the visual source of truth.
No Arial/system-font wordmark generation.
"""

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path('/Users/namansingh/.cursor/projects/Users-namansingh-Desktop-m-live/assets')
MASTER_DIR = ROOT / 'brand' / 'master'
EXPORT_DIR = ROOT / 'brand' / 'export'

SOURCES = {
    'horizontal_gold': 'ChatGPT_Image_Aug_20__2026_at_05_50_25_PM-253b3035-3497-49ff-9c97-006d827712d9.png',
    'horizontal_white': 'ChatGPT_Image_Aug_20__2026_at_05_51_34_PM-8898bc6b-6b32-45be-8c45-f5c7cd62d7d5.png',
    'mark_gold': 'ChatGPT_Image_Aug_20__2026_at_05_54_21_PM-7781ce52-e55f-47e0-8edb-a91878dffb49.png',
    'stacked_gold': 'ChatGPT_Image_Aug_20__2026_at_05_58_42_PM-216190f4-6121-41e8-8625-73942e06edb3.png',
    'app_icon_gold': 'ChatGPT_Image_Aug_21__2026_at_01_33_54_PM-74f04a1b-e938-462d-81cd-8327d9867963.png',
}


def remove_black_background(im: Image.Image, thresh: int = 28) -> Image.Image:
    rgb = np.array(im.convert('RGB'))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mask = (r <= thresh) & (g <= thresh) & (b <= thresh)
    rgba = np.dstack([r, g, b, np.where(mask, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def trim_alpha(im: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(im.convert('RGBA'))
    alpha = arr[..., 3]
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        return im
    left = max(0, int(xs.min()) - pad)
    right = min(im.width - 1, int(xs.max()) + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(im.height - 1, int(ys.max()) + pad)
    return im.crop((left, top, right + 1, bottom + 1))


def load_source(key: str) -> Image.Image:
    path = ASSETS / SOURCES[key]
    if not path.exists():
        raise SystemExit(f'Missing source asset: {path}')
    return trim_alpha(remove_black_background(Image.open(path)))


def fit_height(im: Image.Image, height: int) -> Image.Image:
    ratio = height / im.height
    width = max(1, round(im.width * ratio))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def fit_width(im: Image.Image, width: int) -> Image.Image:
    ratio = width / im.width
    height = max(1, round(im.height * ratio))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def fit_square(im: Image.Image, size: int) -> Image.Image:
    side = max(im.width, im.height)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return square.resize((size, size), Image.Resampling.LANCZOS)


def crop_compact_horizontal(im: Image.Image) -> Image.Image:
    """Keep icon + EDA; remove EXCHANGE from the wordmark column only."""
    arr = np.array(im.convert('RGBA'))
    h, w = arr.shape[:2]
    col_density = [(arr[:, x, 3] > 20).sum() for x in range(w)]

    segments: list[tuple[int, int]] = []
    start: int | None = None
    for x, density in enumerate(col_density):
        if density > 0:
            if start is None:
                start = x
        elif start is not None:
            segments.append((start, x - 1))
            start = None
    if start is not None:
        segments.append((start, w - 1))

    text_start = segments[1][0] if len(segments) > 1 else int(w * 0.35)
    text_rows = [(arr[y, text_start:, 3] > 20).sum() for y in range(h)]

    split = h
    for y in range(int(h * 0.25), h - 6):
        if text_rows[y] < 12 and y > 0 and text_rows[y - 1] > 60:
            if any(text_rows[yy] > 60 for yy in range(y + 1, min(y + 28, h))):
                split = y
                break

    if split >= h - 6:
        split = int(h * 0.78)

    out = arr.copy()
    out[split:, text_start:, 3] = 0
    return trim_alpha(Image.fromarray(out, 'RGBA'), pad=6)


def make_favicon_mark(im: Image.Image, size: int) -> Image.Image:
    """Same brand mark, slightly boosted contrast for tiny sizes."""
    base = fit_square(im, max(size * 4, 256))
    arr = np.array(base.convert('RGBA'), dtype=np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    # mild contrast lift on visible pixels only
    mask = alpha > 20
    rgb[mask] = np.clip((rgb[mask] - 128.0) * 1.08 + 128.0, 0, 255)
    out = np.dstack([rgb, alpha]).astype(np.uint8)
    small = Image.fromarray(out, 'RGBA').resize((size, size), Image.Resampling.LANCZOS)
    return small


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)


def write_ico(sources: dict[int, Image.Image], path: Path) -> None:
    """Minimal multi-size ICO writer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    for size in sorted(sources):
        im = sources[size].convert('RGBA')
        png_buf = []
        im.save(png_buf := __import__('io').BytesIO(), format='PNG')
        entries.append((size, png_buf.getvalue()))

    # Use Pillow if available for ICO (more reliable)
    images = [sources[s].convert('RGBA') for s in sorted(sources)]
    images[0].save(path, format='ICO', sizes=[(s, s) for s in sorted(sources)], append_images=images[1:])


def copy_tree(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    save_png(Image.open(src), dst)


def main() -> None:
    horizontal_gold_src = load_source('horizontal_gold')
    horizontal_white_src = load_source('horizontal_white')
    mark_gold_src = load_source('mark_gold')
    stacked_gold_src = load_source('stacked_gold')
    app_icon_src = load_source('app_icon_gold')

    compact_gold_src = crop_compact_horizontal(horizontal_gold_src)

    exports: dict[str, Image.Image] = {
        'eda-exchange-horizontal-gold.png': fit_height(horizontal_gold_src, 48),
        'eda-exchange-horizontal-white.png': fit_height(horizontal_white_src, 48),
        'eda-exchange-horizontal-compact-gold.png': fit_height(compact_gold_src, 48),
        'eda-exchange-mark-gold.png': fit_square(mark_gold_src, 512),
        'eda-exchange-stacked-gold.png': fit_width(stacked_gold_src, 480),
        'eda-exchange-favicon-16.png': make_favicon_mark(mark_gold_src, 16),
        'eda-exchange-favicon-32.png': make_favicon_mark(mark_gold_src, 32),
        'eda-exchange-favicon-48.png': make_favicon_mark(mark_gold_src, 48),
        'eda-exchange-favicon-192.png': make_favicon_mark(mark_gold_src, 192),
        'eda-exchange-favicon-512.png': make_favicon_mark(mark_gold_src, 512),
        'eda-exchange-apple-touch-icon.png': make_favicon_mark(mark_gold_src, 180),
        'eda-exchange-app-icon-1024.png': fit_square(app_icon_src, 1024),
    }

    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    for key, src_name in SOURCES.items():
        src_path = ASSETS / src_name
        save_png(Image.open(src_path), MASTER_DIR / src_name)

    manifest: dict[str, dict[str, int | str]] = {}
    for name, image in exports.items():
        out = EXPORT_DIR / name
        save_png(image, out)
        manifest[name] = {
            'path': str(out.relative_to(ROOT)),
            'width': image.width,
            'height': image.height,
            'bytes': out.stat().st_size,
        }
        corners = [image.getpixel(p)[3] for p in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))]
        print(f'{name}: {image.width}x{image.height} {out.stat().st_size}B corners={corners}')

    # Legacy-compatible filenames for app public dirs
    legacy_map = {
        'logo-horizontal-gold.png': exports['eda-exchange-horizontal-gold.png'],
        'logo-horizontal-white.png': exports['eda-exchange-horizontal-white.png'],
        'logo-horizontal-compact-gold.png': exports['eda-exchange-horizontal-compact-gold.png'],
        'logo-marketing.png': exports['eda-exchange-stacked-gold.png'],
        'icon-gold.png': exports['eda-exchange-mark-gold.png'],
    }

    deploy_targets = [
        ROOT / 'apps/frontend/public/brand',
        ROOT / 'apps/admin-panel/public/brand',
        ROOT / 'apps/mobile/assets/brand',
    ]
    for target in deploy_targets:
        target.mkdir(parents=True, exist_ok=True)
        for fname, image in legacy_map.items():
            save_png(image, target / fname)

    favicon_targets = [
        ROOT / 'apps/frontend/public',
        ROOT / 'apps/admin-panel/public',
    ]
    favicon_files = {
        'favicon-16x16.png': exports['eda-exchange-favicon-16.png'],
        'favicon-32x32.png': exports['eda-exchange-favicon-32.png'],
        'favicon-192x192.png': exports['eda-exchange-favicon-192.png'],
        'favicon-512x512.png': exports['eda-exchange-favicon-512.png'],
        'android-chrome-192x192.png': exports['eda-exchange-favicon-192.png'],
        'android-chrome-512x512.png': exports['eda-exchange-favicon-512.png'],
        'apple-touch-icon.png': exports['eda-exchange-apple-touch-icon.png'],
        'favicon-180x180.png': exports['eda-exchange-apple-touch-icon.png'],
    }
    for base in favicon_targets:
        for fname, image in favicon_files.items():
            save_png(image, base / fname)
        write_ico(
            {
                16: exports['eda-exchange-favicon-16.png'],
                32: exports['eda-exchange-favicon-32.png'],
                48: exports['eda-exchange-favicon-48.png'],
            },
            base / 'favicon.ico',
        )

    mobile_icon = exports['eda-exchange-app-icon-1024.png']
    save_png(mobile_icon, ROOT / 'apps/mobile/assets/icon.png')
    save_png(mobile_icon, ROOT / 'apps/mobile/assets/adaptive-icon.png')

    manifest_path = EXPORT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f'Wrote {manifest_path}')


if __name__ == '__main__':
    main()
