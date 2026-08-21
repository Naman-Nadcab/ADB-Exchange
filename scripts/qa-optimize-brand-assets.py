#!/usr/bin/env python3
"""Final QA pass: simplify tiny favicons + lossless PNG optimization."""

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path('/Users/namansingh/.cursor/projects/Users-namansingh-Desktop-m-live/assets')
MARK_SOURCE = ASSETS / 'ChatGPT_Image_Aug_20__2026_at_05_54_21_PM-7781ce52-e55f-47e0-8edb-a91878dffb49.png'
APP_SOURCE = ASSETS / 'ChatGPT_Image_Aug_21__2026_at_01_33_54_PM-74f04a1b-e938-462d-81cd-8327d9867963.png'


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


def fit_square(im: Image.Image, size: int) -> Image.Image:
    side = max(im.width, im.height)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return square.resize((size, size), Image.Resampling.LANCZOS)


def morph_alpha(alpha: Image.Image, erode: int, dilate: int, threshold: int = 96) -> Image.Image:
    out = alpha
    for _ in range(erode):
        out = out.filter(ImageFilter.MinFilter(3))
    for _ in range(dilate):
        out = out.filter(ImageFilter.MaxFilter(3))
    return out.point(lambda p: 255 if p > threshold else 0)


def make_favicon_mark(mark_src: Image.Image, size: int) -> Image.Image:
    """Same supplied mark; simplify internal detail only at tiny sizes."""
    work = fit_square(mark_src, 512)
    arr = np.array(work.convert('RGBA'))
    rgb = arr[..., :3]
    alpha = Image.fromarray(arr[..., 3], 'L')

    if size <= 48:
        strength = 4 if size <= 16 else 3 if size <= 32 else 2
        simplified = morph_alpha(alpha, erode=strength, dilate=strength, threshold=88)
        simplified_arr = np.array(simplified, dtype=np.float32) / 255.0
        out_rgb = np.clip(
            np.where(simplified_arr[..., None] > 0.05, rgb, 0),
            0,
            255,
        ).astype(np.uint8)
        composed = np.dstack([out_rgb, (simplified_arr * 255).astype(np.uint8)])
        composed = Image.fromarray(composed, 'RGBA')
        # mild contrast lift for tiny sizes
        a = np.array(composed, dtype=np.float32)
        mask = a[..., 3] > 20
        a[..., :3][mask] = np.clip((a[..., :3][mask] - 128.0) * 1.1 + 128.0, 0, 255)
        composed = Image.fromarray(a.astype(np.uint8), 'RGBA')
        inner = max(1, size - 2) if size <= 32 else size
        scaled = composed.resize((inner, inner), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        offset = (size - inner) // 2
        canvas.paste(scaled, (offset, offset), scaled)
        return canvas

    base = work.resize((size, size), Image.Resampling.LANCZOS)
    a = np.array(base, dtype=np.float32)
    mask = a[..., 3] > 20
    a[..., :3][mask] = np.clip((a[..., :3][mask] - 128.0) * 1.06 + 128.0, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def optimize_png(im: Image.Image, path: Path) -> int:
    """Visually lossless PNG optimization via palette compression when beneficial."""
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = im.convert('RGBA')

    candidates: list[tuple[int, Image.Image]] = []

    buf = io.BytesIO()
    rgba.save(buf, format='PNG', optimize=True, compress_level=9)
    candidates.append((len(buf.getvalue()), rgba))

    alpha = rgba.split()[3]
    rgb = rgba.convert('RGB')
    for colors in (256, 192, 128):
        try:
            q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            q_rgba = q.convert('RGBA')
            q_rgba.putalpha(alpha)
            buf = io.BytesIO()
            q_rgba.save(buf, format='PNG', optimize=True, compress_level=9)
            candidates.append((len(buf.getvalue()), q_rgba))
        except Exception:
            pass

    size, best = min(candidates, key=lambda item: item[0])
    best.save(path, format='PNG', optimize=True, compress_level=9)
    return size


def write_ico(sources: dict[int, Image.Image], path: Path) -> None:
    images = [sources[s].convert('RGBA') for s in sorted(sources)]
    images[0].save(
        path,
        format='ICO',
        sizes=[(s, s) for s in sorted(sources)],
        append_images=images[1:],
    )


def main() -> None:
    before: dict[str, int] = {}
    after: dict[str, int] = {}

    mark_src = trim_alpha(remove_black_background(Image.open(MARK_SOURCE)))
    app_src = trim_alpha(remove_black_background(Image.open(APP_SOURCE)))

    favicon_exports = {
        16: make_favicon_mark(mark_src, 16),
        32: make_favicon_mark(mark_src, 32),
        48: make_favicon_mark(mark_src, 48),
        180: make_favicon_mark(mark_src, 180),
        192: make_favicon_mark(mark_src, 192),
        512: make_favicon_mark(mark_src, 512),
    }

    favicon_map = {
        'favicon-16x16.png': 16,
        'favicon-32x32.png': 32,
        'favicon-192x192.png': 192,
        'favicon-512x512.png': 512,
        'android-chrome-192x192.png': 192,
        'android-chrome-512x512.png': 512,
        'apple-touch-icon.png': 180,
        'favicon-180x180.png': 180,
    }

    favicon_bases = [ROOT / 'apps/frontend/public', ROOT / 'apps/admin-panel/public']

    for base in favicon_bases:
        for fname, size in favicon_map.items():
            path = base / fname
            if path.exists():
                before[str(path.relative_to(ROOT))] = path.stat().st_size
            after[str(path.relative_to(ROOT))] = optimize_png(favicon_exports[size], path)

        ico_path = base / 'favicon.ico'
        if ico_path.exists():
            before[str(ico_path.relative_to(ROOT))] = ico_path.stat().st_size
        write_ico({16: favicon_exports[16], 32: favicon_exports[32], 48: favicon_exports[48]}, ico_path)
        after[str(ico_path.relative_to(ROOT))] = ico_path.stat().st_size

    optimize_targets = [
        ROOT / 'apps/frontend/public/brand/icon-gold.png',
        ROOT / 'apps/admin-panel/public/brand/icon-gold.png',
        ROOT / 'apps/mobile/assets/brand/icon-gold.png',
        ROOT / 'apps/mobile/assets/icon.png',
        ROOT / 'apps/mobile/assets/adaptive-icon.png',
    ]

    icon_512 = fit_square(mark_src, 512)
    app_1024 = fit_square(app_src, 1024)

    for path in optimize_targets:
        rel = str(path.relative_to(ROOT))
        if path.exists():
            before[rel] = path.stat().st_size
        im = icon_512 if 'icon-gold' in path.name else app_1024
        after[rel] = optimize_png(im, path)

    export_dir = ROOT / 'brand' / 'export'
    export_dir.mkdir(parents=True, exist_ok=True)
    optimize_png(favicon_exports[16], export_dir / 'eda-exchange-favicon-16.png')
    optimize_png(favicon_exports[32], export_dir / 'eda-exchange-favicon-32.png')
    optimize_png(icon_512, export_dir / 'eda-exchange-mark-gold.png')
    optimize_png(app_1024, export_dir / 'eda-exchange-app-icon-1024.png')

    report = {'before': before, 'after': after}
    (export_dir / 'qa-optimization.json').write_text(json.dumps(report, indent=2))

    print('Optimization complete:')
    for rel in sorted(set(before) | set(after)):
        b = before.get(rel, 0)
        a = after.get(rel, 0)
        if b:
            pct = (1 - a / b) * 100 if b else 0
            print(f'  {rel}: {b} -> {a} B ({pct:.1f}% reduction)')


if __name__ == '__main__':
    main()
