"""Frozen 1x pixel-art drawing helpers for Nyah & Fifi's Tavern.

Provides:
- AssetSpec registry entry
- Primitives: new_canvas, px, rect, hline, vline, line, ellipse, poly_scan
- Lighting & texture: shade, dither, stamp, tile_wrap_noise
- Outline & anchor helpers: outline, finalize_prop
- Reusable prop sub-components: draw_barrel_unit, draw_mug_unit, draw_potion_unit, draw_wood_plank_band
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Iterable, Sequence
import math
import random
from PIL import Image

from tools.palette import PALETTE_RGBA, OUTLINE_RGBA_SET, col, ramp_rgba

RGBA = tuple[int, int, int, int]
TRANSPARENT: RGBA = (0, 0, 0, 0)


@dataclass(frozen=True)
class AssetSpec:
    fn: Callable[[], Image.Image]
    footprint: tuple[int, int]          # in base tiles (w_tiles, h_tiles), (0,0) for icons/UI
    layer: str                          # "floor" | "wall" | "rug" | "prop" | " tabletop" | "icon" | "ui" | "exterior"
    tileable: bool = False
    hangs: bool = False
    multi_group: str | None = None      # e.g. "rug_red" for _tl/_tr/_bl/_br assembly
    multi_pos: tuple[int, int] | None = None  # (gx, gy) tile offset in group


def resolve_color(c: str | RGBA) -> RGBA:
    if isinstance(c, str):
        return PALETTE_RGBA[c]
    return c


def new_canvas(w: int, h: int, fill: str | RGBA | None = None) -> Image.Image:
    bg = TRANSPARENT if fill is None else resolve_color(fill)
    return Image.new("RGBA", (w, h), bg)


def px(img: Image.Image, x: int, y: int, color: str | RGBA) -> None:
    w, h = img.size
    if 0 <= x < w and 0 <= y < h:
        img.putpixel((int(x), int(y)), resolve_color(color))


def get_px(img: Image.Image, x: int, y: int) -> RGBA:
    w, h = img.size
    if 0 <= x < w and 0 <= y < h:
        return img.getpixel((int(x), int(y)))
    return TRANSPARENT


def rect(
    img: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    color: str | RGBA,
    filled: bool = True,
) -> None:
    if w <= 0 or h <= 0:
        return
    rgba = resolve_color(color)
    iw, ih = img.size
    x0, y0 = int(x), int(y)
    x1, y1 = x0 + int(w) - 1, y0 + int(h) - 1
    if filled:
        for py in range(max(0, y0), min(ih, y1 + 1)):
            for pxx in range(max(0, x0), min(iw, x1 + 1)):
                img.putpixel((pxx, py), rgba)
    else:
        for pxx in range(x0, x1 + 1):
            px(img, pxx, y0, rgba)
            px(img, pxx, y1, rgba)
        for py in range(y0, y1 + 1):
            px(img, x0, py, rgba)
            px(img, x1, py, rgba)


def line(
    img: Image.Image,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: str | RGBA,
) -> None:
    """Integer Bresenham 1px line (no anti-aliasing)."""
    rgba = resolve_color(color)
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        px(img, x0, y0, rgba)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def ellipse(
    img: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    color: str | RGBA,
    filled: bool = True,
) -> None:
    """Crisp pixel ellipse centered at (cx, cy) with radii (rx, ry)."""
    if rx <= 0 or ry <= 0:
        return
    rgba = resolve_color(color)
    x_min = int(math.floor(cx - rx - 1))
    x_max = int(math.ceil(cx + rx + 1))
    y_min = int(math.floor(cy - ry - 1))
    y_max = int(math.ceil(cy + ry + 1))
    inside: set[tuple[int, int]] = set()
    for py in range(y_min, y_max + 1):
        for pxx in range(x_min, x_max + 1):
            nx = (pxx - cx) / rx
            ny = (py - cy) / ry
            if nx * nx + ny * ny <= 1.0:
                inside.add((pxx, py))
    if filled:
        for pxx, py in inside:
            px(img, pxx, py, rgba)
    else:
        for pxx, py in inside:
            if any(
                (pxx + dx, py + dy) not in inside
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            ):
                px(img, pxx, py, rgba)


def make_mask(w: int, h: int, coords: Iterable[tuple[int, int]] | None = None) -> set[tuple[int, int]]:
    m: set[tuple[int, int]] = set()
    if coords is not None:
        for x, y in coords:
            if 0 <= x < w and 0 <= y < h:
                m.add((x, y))
    return m


def mask_from_alpha(img: Image.Image) -> set[tuple[int, int]]:
    w, h = img.size
    return {
        (x, y)
        for y in range(h)
        for x in range(w)
        if img.getpixel((x, y))[3] > 0
    }


def shade(
    img: Image.Image,
    mask: set[tuple[int, int]],
    ramp: Sequence[str | RGBA],
    light_dir: tuple[int, int] = (-1, -1),
) -> None:
    """Shade pixels in `mask` using ordered `ramp` (shadow -> base -> highlight).

    Top-left light default `(-1, -1)`:
    - Pixels whose up/left neighbors lie outside `mask` receive highlight (`ramp[-1]`).
    - Pixels whose down/right neighbors lie outside `mask` receive shadow (`ramp[0]` or `ramp[1]`).
    - Interior pixels receive base (`ramp[-2]` for >=3 tones, else `ramp[0]`).
    """
    if not mask or not ramp:
        return
    cols = [resolve_color(c) for c in ramp]
    c_deep = cols[0]
    c_shad = cols[1] if len(cols) >= 4 else cols[0]
    c_base = cols[-2] if len(cols) >= 2 else cols[0]
    c_high = cols[-1]
    lx, ly = light_dir

    for x, y in mask:
        lit_edge = ((x + lx, y) not in mask) or ((x, y + ly) not in mask)
        shad_edge = ((x - lx, y) not in mask) or ((x, y - ly) not in mask)
        both_shad = ((x - lx, y) not in mask) and ((x, y - ly) not in mask)
        if lit_edge and not shad_edge:
            px(img, x, y, c_high)
        elif both_shad:
            px(img, x, y, c_deep)
        elif shad_edge:
            px(img, x, y, c_shad)
        else:
            px(img, x, y, c_base)


def dither(
    img: Image.Image,
    region: tuple[int, int, int, int] | set[tuple[int, int]],
    c1: str | RGBA,
    c2: str | RGBA,
    pattern: str = "checker_sparse",
    only_over: str | RGBA | None = None,
) -> None:
    """Apply sparse pixel dithering (`checker`, `checker_sparse`, `wood_grain`, `stone_speck`)."""
    col1 = resolve_color(c1)
    col2 = resolve_color(c2)
    target_over = resolve_color(only_over) if only_over is not None else None

    if isinstance(region, tuple):
        rx, ry, rw, rh = region
        coords = [(x, y) for y in range(ry, ry + rh) for x in range(rx, rx + rw)]
    else:
        coords = list(region)

    for x, y in coords:
        if target_over is not None and get_px(img, x, y) != target_over:
            continue
        use_c2 = False
        if pattern == "checker":
            use_c2 = ((x + y) & 1) == 1
        elif pattern == "checker_sparse":
            use_c2 = (x % 2 == 0) and (y % 2 == 0) and (((x // 2 + y // 2) & 1) == 1)
        elif pattern == "wood_grain":
            use_c2 = ((y * 5 + x) % 11 == 0) or ((y * 3 + x // 3) % 13 == 0)
        elif pattern == "stone_speck":
            use_c2 = ((x * 7 + y * 13) % 17 == 0)
        px(img, x, y, col2 if use_c2 else col1)


def stamp(
    img: Image.Image,
    x: int,
    y: int,
    grid: Sequence[str],
    key_map: dict[str, str | RGBA],
) -> None:
    """Blit a compact ASCII stamp onto `img` at `(x, y)`. '.' and ' ' are transparent."""
    resolved = {k: resolve_color(v) for k, v in key_map.items()}
    for dy, row in enumerate(grid):
        for dx, ch in enumerate(row):
            if ch in (".", " "):
                continue
            if ch in resolved:
                px(img, x + dx, y + dy, resolved[ch])


def outline(
    img: Image.Image,
    color: str | RGBA = "OUTLINE_WARM",
    outline_set: frozenset[RGBA] = OUTLINE_RGBA_SET,
    preserve_canvas_bounds: bool = True,
) -> Image.Image:
    """Ensure a closed 1px 4-neighbor outline around all opaque shapes in `img`.

    1. Any transparent pixel 4-adjacent to a non-outline opaque pixel becomes `color`.
    2. Any non-outline opaque pixel on the outer canvas edge (0, w-1, 0, h-1) becomes `color`
       so the outline stays strictly closed at image boundaries.
    """
    out_rgba = resolve_color(color)
    w, h = img.size
    res = img.copy()

    to_outline: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            cur = img.getpixel((x, y))
            if cur[3] == 0:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        nb = img.getpixel((nx, ny))
                        if nb[3] == 255 and nb not in outline_set:
                            to_outline.append((x, y))
                            break

    for x, y in to_outline:
        res.putpixel((x, y), out_rgba)

    if preserve_canvas_bounds:
        # Close any interior pixel still exposed to transparency or canvas border
        snap = res.copy()
        for y in range(h):
            for x in range(w):
                cur = snap.getpixel((x, y))
                if cur[3] == 255 and cur not in outline_set:
                    touches_edge = (x == 0 or x == w - 1 or y == 0 or y == h - 1)
                    touches_trans = any(
                        snap.getpixel((x + dx, y + dy))[3] == 0
                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                        if 0 <= x + dx < w and 0 <= y + dy < h
                    )
                    if touches_edge or touches_trans:
                        # Prefer nearest existing outline color if adjacent, else out_rgba
                        chosen = out_rgba
                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < w and 0 <= ny < h:
                                nb = snap.getpixel((nx, ny))
                                if nb in outline_set:
                                    chosen = nb
                                    break
                        res.putpixel((x, y), chosen)
    return res


def finalize_prop(
    img: Image.Image,
    default_outline: str | RGBA = "OUTLINE_WARM",
    hangs: bool = False,
    outline_set: frozenset[RGBA] = OUTLINE_RGBA_SET,
) -> Image.Image:
    """Shift non-hanging props down so their lowest opaque row touches `h - 1`,
    remove 1px transparent-surrounded orphans, and verify closed 4-neighbor outlines.
    """
    w, h = img.size
    work = img.copy()

    if not hangs:
        bbox = work.getbbox()
        if bbox is not None:
            _, _, _, bottom = bbox
            shift_y = h - bottom
            if shift_y > 0:
                shifted = Image.new("RGBA", (w, h), TRANSPARENT)
                shifted.paste(work, (0, shift_y))
                work = shifted

    # Ensure every border-exposed opaque pixel is an outline pixel
    out_rgba = resolve_color(default_outline)
    snap = work.copy()
    for y in range(h):
        for x in range(w):
            cur = snap.getpixel((x, y))
            if cur[3] == 255 and cur not in outline_set:
                exposed = (
                    x == 0
                    or x == w - 1
                    or y == 0
                    or y == h - 1
                    or any(
                        snap.getpixel((x + dx, y + dy))[3] == 0
                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                    )
                )
                if exposed:
                    chosen = out_rgba
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            nb = snap.getpixel((nx, ny))
                            if nb in outline_set:
                                chosen = nb
                                break
                    work.putpixel((x, y), chosen)

    # Prune accidental isolated 1px orphans surrounded by 4 transparent neighbors
    snap2 = work.copy()
    for y in range(h):
        for x in range(w):
            if snap2.getpixel((x, y))[3] == 255:
                has_opaque_nb = any(
                    0 <= x + dx < w
                    and 0 <= y + dy < h
                    and snap2.getpixel((x + dx, y + dy))[3] == 255
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                if not has_opaque_nb:
                    work.putpixel((x, y), TRANSPARENT)
    return work


def tile_wrap_px(img: Image.Image, x: int, y: int, color: str | RGBA) -> None:
    """Wrap-around pixel setter for seamless tileable textures."""
    w, h = img.size
    img.putpixel((x % w, y % h), resolve_color(color))


def tile_wrap_speckles(
    img: Image.Image,
    seed: int,
    count: int,
    colors: Sequence[str | RGBA],
    cluster_len: int = 2,
) -> None:
    """Deterministic wrap-around texture clusters for seamless floor/wall tiles."""
    rng = random.Random(seed)
    w, h = img.size
    cols = [resolve_color(c) for c in colors]
    for _ in range(count):
        sx = rng.randrange(w)
        sy = rng.randrange(h)
        c = cols[rng.randrange(len(cols))]
        for dx in range(rng.randint(1, cluster_len)):
            tile_wrap_px(img, sx + dx, sy, c)


# --- Shared Tavern Component Primitives ---

def draw_barrel_unit(img: Image.Image, x: int, y: int, w: int = 16, h: int = 18, horizontal: bool = True) -> None:
    """Draw a shaded oak barrel with iron hoops (un-outlined interior or outlined)."""
    if horizontal:
        # Rounded stave cylinder facing viewer
        for py in range(y + 1, y + h - 1):
            inset = 1 if py in (y + 1, y + h - 2) else 0
            c = "WOOD_LIGHT" if py < y + 5 else ("WOOD_BASE" if py < y + h - 5 else "WOOD_SHADOW")
            rect(img, x + 1 + inset, py, w - 2 - 2 * inset, 1, c)
        # Iron hoops left & right
        rect(img, x + 3, y + 1, 2, h - 2, "METAL_BASE")
        px(img, x + 3, y + 2, "METAL_LIGHT")
        rect(img, x + w - 5, y + 1, 2, h - 2, "METAL_SHADOW")
        px(img, x + w - 5, y + 2, "METAL_BASE")
        # Front circular head on left or center tap
        ellipse(img, x + w // 2, y + h // 2, 3.0, 3.5, "WOOD_DEEP", filled=True)
        ellipse(img, x + w // 2, y + h // 2, 2.0, 2.2, "WOOD_SHADOW", filled=True)
        px(img, x + w // 2, y + h // 2, "GOLD_BASE")
    else:
        # Upright standing barrel (3/4 top-down: oval top + front staves)
        rect(img, x + 1, y + 4, w - 2, h - 5, "WOOD_BASE")
        rect(img, x + w - 5, y + 4, 4, h - 5, "WOOD_SHADOW")
        rect(img, x + 2, y + 4, 3, h - 5, "WOOD_LIGHT")
        # Iron bands
        rect(img, x + 1, y + 7, w - 2, 2, "METAL_BASE")
        rect(img, x + 1, y + h - 5, w - 2, 2, "METAL_SHADOW")
        # Top lid
        ellipse(img, x + w / 2 - 0.5, y + 4, w / 2 - 1.2, 3.0, "WOOD_LIGHT", filled=True)
        ellipse(img, x + w / 2 - 0.5, y + 4, w / 2 - 2.5, 1.8, "WOOD_SHADOW", filled=True)


def draw_mug_unit(img: Image.Image, x: int, y: int, foamy: bool = True) -> None:
    """Draw a tiny 7x9 wooden/amber ale mug with handle and foam."""
    # Handle on right
    rect(img, x + 5, y + 3, 2, 4, "METAL_BASE")
    px(img, x + 5, y + 4, TRANSPARENT)
    # Body
    rect(img, x + 1, y + 2, 4, 6, "ALE_BASE")
    rect(img, x + 1, y + 2, 2, 5, "ALE_LIGHT")
    rect(img, x + 1, y + 7, 4, 1, "WOOD_SHADOW")
    if foamy:
        rect(img, x + 1, y + 1, 4, 2, "CREAM_LIGHT")
        px(img, x + 4, y + 2, "CREAM_SHADOW")


def draw_potion_unit(img: Image.Image, x: int, y: int, liquid_col: str, tall: bool = False) -> None:
    """Draw a 5x8 (or 5x10) glass potion bottle with cork and specular highlight."""
    bh = 9 if tall else 7
    # Cork
    rect(img, x + 2, y, 2, 1, "WOOD_LIGHT")
    # Neck
    rect(img, x + 2, y + 1, 2, 2, "CREAM_SHADOW")
    # Flask body
    rect(img, x + 1, y + 3, 4, bh - 3, liquid_col)
    # Specular highlight top-left
    px(img, x + 1, y + 3, "CREAM_LIGHT")
    px(img, x + 1, y + 4, "CREAM_LIGHT")
