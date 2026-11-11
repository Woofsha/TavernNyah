"""Tileable floors, cutaway walls, doors, stairs, furniture, tables, beds, and exterior props.

All pixel art uses the frozen 43-color tavern palette from `tools.palette`.
Zero raw hex colors. Non-tileable props are finalized with closed 1px outlines
and bottom-row anchoring.
"""

from __future__ import annotations
import math
import random
from PIL import Image

from tools.draw_helpers import (
    AssetSpec,
    new_canvas,
    px,
    rect,
    line,
    ellipse,
    dither,
    finalize_prop,
    tile_wrap_px,
    tile_wrap_speckles,
)
from tools.palette import PALETTE_RGBA, OUTLINE_RGBA_SET, col


# =============================================================================
# 1. Tileable Floors (32x32, footprint=(1,1), layer="floor", tileable=True)
# =============================================================================

def gen_floor_wood_planks() -> Image.Image:
    """Seamless 32x32 warm tavern plank floor.
    4 horizontal planks (height 8) with staggered vertical joints, nail heads, and wood grain.
    """
    img = new_canvas(32, 32, "WOOD_BASE")
    # 4 planks: y=0..7, 8..15, 16..23, 24..31
    for i in range(4):
        y0 = i * 8
        # Top highlight of plank
        rect(img, 0, y0, 32, 1, "WOOD_LIGHT")
        # Body rows
        rect(img, 0, y0 + 1, 32, 4, "WOOD_BASE")
        # Lower shadow row
        rect(img, 0, y0 + 5, 32, 1, "WOOD_SHADOW")
        rect(img, 0, y0 + 6, 32, 1, "WOOD_SHADOW")
        # Seam divider between planks
        rect(img, 0, y0 + 7, 32, 1, "WOOD_DEEP")

    # Staggered vertical joints across planks (x mod 32)
    # Plank 0: joint at x=14
    rect(img, 14, 0, 1, 7, "WOOD_DEEP")
    px(img, 13, 0, "WOOD_SHADOW")
    px(img, 15, 0, "WOOD_LIGHT")
    # Plank 1: joint at x=28
    rect(img, 28, 8, 1, 7, "WOOD_DEEP")
    px(img, 27, 8, "WOOD_SHADOW")
    px(img, 29, 8, "WOOD_LIGHT")
    # Plank 2: joint at x=6
    rect(img, 6, 16, 1, 7, "WOOD_DEEP")
    px(img, 5, 16, "WOOD_SHADOW")
    px(img, 7, 16, "WOOD_LIGHT")
    # Plank 3: joint at x=20
    rect(img, 20, 24, 1, 7, "WOOD_DEEP")
    px(img, 19, 24, "WOOD_SHADOW")
    px(img, 21, 24, "WOOD_LIGHT")

    # Wood grain streaks (seamlessly within planks)
    grain_specs = [
        (2, 2, 5, "WOOD_LIGHT"), (18, 3, 6, "WOOD_SHADOW"),
        (4, 10, 8, "WOOD_LIGHT"), (16, 11, 7, "WOOD_SHADOW"),
        (10, 18, 7, "WOOD_LIGHT"), (22, 19, 6, "WOOD_SHADOW"),
        (4, 26, 6, "WOOD_SHADOW"), (24, 27, 5, "WOOD_LIGHT"),
    ]
    for gx, gy, gw, gc in grain_specs:
        rect(img, gx, gy, gw, 1, gc)

    # Iron nail heads at plank ends
    nails = [
        (12, 2), (16, 2), (2, 2), (30, 2),
        (26, 10), (30, 10), (4, 10), (14, 10),
        (4, 18), (8, 18), (18, 18), (28, 18),
        (18, 26), (22, 26), (2, 26), (30, 26),
    ]
    for nx, ny in nails:
        px(img, nx, ny, "WOOD_DEEP")
        px(img, nx + 1, ny, "METAL_SHADOW")

    return img


def gen_floor_stone() -> Image.Image:
    """Seamless 32x32 dressed tavern flagstone floor.
    Interlocking flagstone slabs with mortar lines, bevel highlights, and chiseled texture.
    """
    img = new_canvas(32, 32, "STONE_BASE")

    # Horizontal mortar at y=15 and y=31 (wraps to y=0 cleanly)
    rect(img, 0, 15, 32, 1, "STONE_DEEP")
    rect(img, 0, 31, 32, 1, "STONE_DEEP")

    # Vertical mortar:
    # Row 1 (y=0..14): joint at x=17
    rect(img, 17, 0, 1, 15, "STONE_DEEP")
    # Row 2 (y=16..30): joints at x=7 and x=24
    rect(img, 7, 16, 1, 15, "STONE_DEEP")
    rect(img, 24, 16, 1, 15, "STONE_DEEP")

    # Highlights (top and left of each flagstone slab)
    # Slab 1: (0..16, 0..14)
    rect(img, 0, 0, 17, 1, "STONE_LIGHT")
    rect(img, 0, 0, 1, 15, "STONE_LIGHT")
    rect(img, 0, 14, 17, 1, "STONE_SHADOW")
    rect(img, 16, 0, 1, 15, "STONE_SHADOW")

    # Slab 2: (18..31, 0..14)
    rect(img, 18, 0, 14, 1, "STONE_LIGHT")
    rect(img, 18, 0, 1, 15, "STONE_LIGHT")
    rect(img, 18, 14, 14, 1, "STONE_SHADOW")
    rect(img, 31, 0, 1, 15, "STONE_SHADOW")

    # Slab 3: (0..6, 16..30) - wraps horizontally with slab across x=25..31
    rect(img, 0, 16, 7, 1, "STONE_LIGHT")
    rect(img, 0, 30, 7, 1, "STONE_SHADOW")
    rect(img, 6, 16, 1, 15, "STONE_SHADOW")

    # Slab 4: (8..23, 16..30)
    rect(img, 8, 16, 16, 1, "STONE_LIGHT")
    rect(img, 8, 16, 1, 15, "STONE_LIGHT")
    rect(img, 8, 30, 16, 1, "STONE_SHADOW")
    rect(img, 23, 16, 1, 15, "STONE_SHADOW")

    # Slab 5: (25..31, 16..30)
    rect(img, 25, 16, 7, 1, "STONE_LIGHT")
    rect(img, 25, 16, 1, 15, "STONE_LIGHT")
    rect(img, 25, 30, 7, 1, "STONE_SHADOW")

    # Surface chiseled speckles (deterministic)
    specks = [
        (4, 4), (10, 8), (12, 3), (22, 6), (28, 10),
        (3, 22), (12, 25), (18, 20), (28, 26), (15, 27)
    ]
    for sx, sy in specks:
        px(img, sx, sy, "STONE_LIGHT")
        px(img, sx + 1, sy + 1, "STONE_SHADOW")

    return img


def gen_floor_kitchen() -> Image.Image:
    """Seamless 32x32 kitchen quarry stone tile floor.
    Muted 16x16 slate and warm sandstone slabs so kitchen props & characters pop cleanly.
    """
    img = new_canvas(32, 32, "STONE_SHADOW")

    for ty in range(2):
        for tx in range(2):
            x0 = tx * 16
            y0 = ty * 16
            is_warm = ((tx + ty) % 2 == 0)
            if is_warm:
                rect(img, x0, y0, 15, 15, "PARCHMENT_SHADOW")
                rect(img, x0, y0, 15, 1, "PARCHMENT_BASE")
                rect(img, x0, y0, 1, 15, "PARCHMENT_BASE")
                rect(img, x0 + 1, y0 + 14, 14, 1, "STONE_SHADOW")
                rect(img, x0 + 14, y0 + 1, 1, 14, "STONE_SHADOW")
                px(img, x0 + 5, y0 + 6, "PARCHMENT_BASE")
                px(img, x0 + 11, y0 + 10, "STONE_BASE")
            else:
                rect(img, x0, y0, 15, 15, "STONE_BASE")
                rect(img, x0, y0, 15, 1, "STONE_LIGHT")
                rect(img, x0, y0, 1, 15, "STONE_LIGHT")
                rect(img, x0 + 1, y0 + 14, 14, 1, "STONE_SHADOW")
                rect(img, x0 + 14, y0 + 1, 1, 14, "STONE_SHADOW")
                px(img, x0 + 6, y0 + 5, "STONE_LIGHT")
                px(img, x0 + 10, y0 + 11, "STONE_SHADOW")
            rect(img, x0 + 15, y0, 1, 16, "STONE_DEEP")
            rect(img, x0, y0 + 15, 16, 1, "STONE_DEEP")

    return img


def gen_floor_cellar() -> Image.Image:
    """Seamless 32x32 cellar flagstone and packed earth floor.
    Moody, dark flagstones with mortar cracks and damp mossy crevices.
    """
    img = new_canvas(32, 32, "STONE_DEEP")

    # Define organic slabs within 32x32 (surrounded by STONE_DEEP packed earth)
    slabs = [
        # (x, y, w, h)
        (2, 2, 11, 8),
        (16, 2, 13, 8),
        (1, 13, 11, 8),
        (15, 13, 14, 8),
        (4, 24, 14, 6),
        (21, 24, 10, 6),
    ]

    for sx, sy, sw, sh in slabs:
        rect(img, sx, sy, sw, sh, "STONE_SHADOW")
        # Top-left highlight
        rect(img, sx, sy, sw, 1, "STONE_BASE")
        rect(img, sx, sy, 1, sh, "STONE_BASE")
        # Bottom-right shadow
        rect(img, sx + 1, sy + sh - 1, sw - 1, 1, "STONE_DEEP")
        rect(img, sx + sw - 1, sy + 1, 1, sh - 1, "STONE_DEEP")

    # Wrapping stone slab across left/right boundary (y=24..29)
    rect(img, 0, 24, 2, 6, "STONE_SHADOW")
    rect(img, 31, 24, 1, 6, "STONE_SHADOW")
    rect(img, 0, 24, 2, 1, "STONE_BASE")
    rect(img, 31, 24, 1, 1, "STONE_BASE")

    # Cracks & damp patches
    line(img, 5, 4, 9, 8, "STONE_DEEP")
    line(img, 20, 4, 24, 7, "STONE_DEEP")
    line(img, 19, 15, 23, 19, "STONE_DEEP")

    # Subtle moss/damp green specks in earth mortar
    moss_pts = [(14, 5), (14, 6), (13, 11), (14, 11), (2, 11), (28, 22), (19, 23)]
    for mx, my in moss_pts:
        px(img, mx, my, "LEAF_SHADOW")

    return img


def gen_floor_grass() -> Image.Image:
    """Seamless 32x32 outdoor yard grass.
    Lush green lawn with grass blade tufts, clover, and tiny buttercup blossoms.
    """
    img = new_canvas(32, 32, "LEAF_BASE")

    # Grass blade tufts scattered with modulo wrapping
    tufts = [
        (3, 4), (11, 2), (20, 5), (28, 3),
        (6, 12), (16, 10), (24, 14), (30, 11),
        (2, 20), (10, 18), (19, 21), (27, 19),
        (5, 28), (14, 26), (22, 29), (29, 27)
    ]
    for tx, ty in tufts:
        # 3-blade tuft: center, left, right
        tile_wrap_px(img, tx, ty, "LEAF_LIGHT")
        tile_wrap_px(img, tx - 1, ty + 1, "LEAF_LIGHT")
        tile_wrap_px(img, tx + 1, ty + 1, "LEAF_LIGHT")
        tile_wrap_px(img, tx, ty + 2, "LEAF_SHADOW")

    # Scattered clover & small golden blossoms
    blossoms = [(8, 8), (25, 8), (4, 16), (17, 24), (28, 23), (12, 31)]
    for bx, by in blossoms:
        tile_wrap_px(img, bx, by, "GOLD_LIGHT")
        tile_wrap_px(img, bx + 1, by, "LEAF_SHADOW")

    clovers = [(14, 15), (22, 2), (7, 24), (23, 26)]
    for cx, cy in clovers:
        tile_wrap_px(img, cx, cy, "CREAM_LIGHT")

    return img


def gen_floor_cobble() -> Image.Image:
    """Seamless 32x32 cobblestone street / courtyard paving.
    Rounded cobblestones staggered in 4 rows with dark mortar joints and highlights.
    """
    img = new_canvas(32, 32, "STONE_DEEP")

    # 4 rows of cobbles, height 8 each
    for row in range(4):
        y0 = row * 8
        x_offset = 4 if (row % 2 == 1) else 0
        for col_idx in range(5):
            cx = (col_idx * 8 + x_offset)
            # Draw rounded cobble (6x5 inside 8x8 cell)
            for dy in range(6):
                for dx in range(6):
                    # Inset corners for rounded look
                    if (dx == 0 or dx == 5) and (dy == 0 or dy == 5):
                        continue
                    px_x = (cx + dx) % 32
                    px_y = (y0 + 1 + dy) % 32

                    if dy == 0 or (dx == 0 and dy < 4):
                        c = "STONE_LIGHT"
                    elif dy == 5 or dx == 5 or dy == 4:
                        c = "STONE_SHADOW"
                    else:
                        c = "STONE_BASE"
                    img.putpixel((px_x, px_y), col(c))

    return img


# =============================================================================
# 2. Tileable Walls (32x64, footprint=(1,2), layer="wall", tileable=True)
# =============================================================================

def _draw_wall_top_cap(img: Image.Image, wood: bool = True) -> None:
    """Draw solid cutaway top cap (y=0..11)."""
    if wood:
        rect(img, 0, 0, 32, 1, "WOOD_LIGHT")
        rect(img, 0, 1, 32, 7, "WOOD_BASE")
        # Grain on top cap
        rect(img, 2, 3, 12, 1, "WOOD_LIGHT")
        rect(img, 18, 4, 10, 1, "WOOD_SHADOW")
        rect(img, 0, 8, 32, 1, "WOOD_SHADOW")
        rect(img, 0, 9, 32, 2, "WOOD_DEEP")
        rect(img, 0, 11, 32, 1, "WOOD_DEEP")
    else:
        rect(img, 0, 0, 32, 1, "STONE_LIGHT")
        rect(img, 0, 1, 32, 7, "STONE_BASE")
        rect(img, 4, 3, 10, 1, "STONE_LIGHT")
        rect(img, 18, 4, 8, 1, "STONE_SHADOW")
        rect(img, 0, 8, 32, 1, "STONE_SHADOW")
        rect(img, 0, 9, 32, 2, "STONE_DEEP")
        rect(img, 0, 11, 32, 1, "STONE_DEEP")


def _draw_wall_baseboard(img: Image.Image, wood: bool = True) -> None:
    """Draw solid bottom baseboard plinth (y=56..63)."""
    if wood:
        rect(img, 0, 56, 32, 1, "WOOD_LIGHT")
        rect(img, 0, 57, 32, 4, "WOOD_BASE")
        rect(img, 3, 58, 14, 1, "WOOD_LIGHT")
        rect(img, 20, 59, 9, 1, "WOOD_SHADOW")
        rect(img, 0, 61, 32, 1, "WOOD_SHADOW")
        rect(img, 0, 62, 32, 1, "WOOD_DEEP")
        rect(img, 0, 63, 32, 1, "WOOD_DEEP")
    else:
        rect(img, 0, 56, 32, 1, "STONE_LIGHT")
        rect(img, 0, 57, 32, 4, "STONE_SHADOW")
        rect(img, 0, 61, 32, 1, "STONE_DEEP")
        rect(img, 0, 62, 32, 2, "STONE_DEEP")


def gen_wall_timber_mid() -> Image.Image:
    """Seamless 32x64 cutaway half-timber tavern wall.
    Top timber cap, cream plaster with timber posts & diagonal cross-brace, baseboard.
    """
    img = new_canvas(32, 64, "PARCHMENT_BASE")
    _draw_wall_top_cap(img, wood=True)
    _draw_wall_baseboard(img, wood=True)

    # Plaster face shading (y=12..55)
    rect(img, 0, 12, 32, 20, "PARCHMENT_LIGHT")
    rect(img, 0, 32, 32, 16, "PARCHMENT_BASE")
    rect(img, 0, 48, 32, 8, "PARCHMENT_SHADOW")

    # Timber posts on left (x=0..3) and right (x=28..31) that meet to form 8px post
    # Left edge post
    rect(img, 0, 12, 1, 44, "WOOD_SHADOW")
    rect(img, 1, 12, 1, 44, "WOOD_LIGHT")
    rect(img, 2, 12, 2, 44, "WOOD_BASE")
    # Right edge post
    rect(img, 28, 12, 2, 44, "WOOD_BASE")
    rect(img, 30, 12, 1, 44, "WOOD_SHADOW")
    rect(img, 31, 12, 1, 44, "WOOD_DEEP")

    # Diagonal timber cross-brace from (4, 14) to (27, 53)
    for step in range(40):
        bx = 4 + int(step * 23 / 39)
        by = 14 + int(step * 39 / 39)
        px(img, bx, by, "WOOD_LIGHT")
        px(img, bx, by + 1, "WOOD_BASE")
        px(img, bx, by + 2, "WOOD_BASE")
        px(img, bx, by + 3, "WOOD_SHADOW")

    # Horizontal center beam at y=32..35
    rect(img, 4, 32, 24, 1, "WOOD_LIGHT")
    rect(img, 4, 33, 24, 2, "WOOD_BASE")
    rect(img, 4, 35, 24, 1, "WOOD_SHADOW")

    # Iron peg studs at timber intersections
    px(img, 4, 14, "WOOD_DEEP")
    px(img, 27, 53, "WOOD_DEEP")
    px(img, 4, 33, "WOOD_DEEP")
    px(img, 27, 33, "WOOD_DEEP")

    return img


def gen_wall_timber_window() -> Image.Image:
    """Seamless 32x64 cutaway half-timber wall with warm paned glowing tavern window."""
    img = gen_wall_timber_mid()

    # Window frame (x=7..24, y=20..44)
    # Outer wood frame
    rect(img, 7, 20, 18, 25, "WOOD_DEEP")
    rect(img, 8, 21, 16, 23, "WOOD_SHADOW")
    rect(img, 8, 21, 16, 1, "WOOD_LIGHT")

    # Window sill extending slightly wider (x=6..25, y=43..45)
    rect(img, 6, 43, 20, 1, "WOOD_LIGHT")
    rect(img, 6, 44, 20, 2, "WOOD_SHADOW")

    # Glowing paned glass (x=9..22, y=22..42)
    rect(img, 9, 22, 14, 21, "FLAME_ORANGE")
    rect(img, 10, 23, 12, 19, "FLAME_YELLOW")
    rect(img, 12, 25, 8, 15, "CREAM_LIGHT")

    # Diamond / cross leaded mullions
    rect(img, 15, 22, 2, 21, "OUTLINE_COOL")
    rect(img, 9, 32, 14, 2, "OUTLINE_COOL")

    # Subtle warm ambient glow spill on plaster beneath window
    for dy in range(46, 52):
        for dx in range(9, 23):
            if (dx + dy) % 2 == 0:
                px(img, dx, dy, "PARCHMENT_LIGHT")

    return img


def gen_wall_stone_mid() -> Image.Image:
    """Seamless 32x64 solid cutaway stone tavern wall.
    Dressed stone top cap, ashlar stone masonry courses with bevels, and heavy plinth.
    """
    img = new_canvas(32, 64, "STONE_BASE")
    _draw_wall_top_cap(img, wood=False)
    _draw_wall_baseboard(img, wood=False)

    # 5 courses of stone blocks:
    # Course 0: y=12..19 (joint at x=16)
    # Course 1: y=21..28 (joint at x=0/31 and x=15)
    # Course 2: y=30..37 (joint at x=8 and x=24)
    # Course 3: y=39..46 (joint at x=16)
    # Course 4: y=48..55 (joint at x=0/31 and x=15)

    # Horizontal mortar lines
    for my in (20, 29, 38, 47):
        rect(img, 0, my, 32, 1, "STONE_DEEP")

    # Course 0 (y=12..19):
    rect(img, 16, 12, 1, 8, "STONE_DEEP")
    # Course 1 (y=21..28):
    rect(img, 0, 21, 1, 8, "STONE_DEEP")
    rect(img, 31, 21, 1, 8, "STONE_DEEP")
    rect(img, 15, 21, 1, 8, "STONE_DEEP")
    # Course 2 (y=30..37):
    rect(img, 8, 30, 1, 8, "STONE_DEEP")
    rect(img, 24, 30, 1, 8, "STONE_DEEP")
    # Course 3 (y=39..46):
    rect(img, 16, 39, 1, 8, "STONE_DEEP")
    # Course 4 (y=48..55):
    rect(img, 0, 48, 1, 8, "STONE_DEEP")
    rect(img, 31, 48, 1, 8, "STONE_DEEP")
    rect(img, 15, 48, 1, 8, "STONE_DEEP")

    # Top/left highlights and bottom/right shadows for each stone block
    # Course 0
    rect(img, 0, 12, 16, 1, "STONE_LIGHT")
    rect(img, 0, 19, 16, 1, "STONE_SHADOW")
    rect(img, 17, 12, 15, 1, "STONE_LIGHT")
    rect(img, 17, 19, 15, 1, "STONE_SHADOW")

    # Course 1
    rect(img, 1, 21, 14, 1, "STONE_LIGHT")
    rect(img, 1, 28, 14, 1, "STONE_SHADOW")
    rect(img, 16, 21, 15, 1, "STONE_LIGHT")
    rect(img, 16, 28, 15, 1, "STONE_SHADOW")

    # Course 2
    rect(img, 0, 30, 8, 1, "STONE_LIGHT")
    rect(img, 9, 30, 15, 1, "STONE_LIGHT")
    rect(img, 25, 30, 7, 1, "STONE_LIGHT")
    rect(img, 0, 37, 8, 1, "STONE_SHADOW")
    rect(img, 9, 37, 15, 1, "STONE_SHADOW")
    rect(img, 25, 37, 7, 1, "STONE_SHADOW")

    # Course 3
    rect(img, 0, 39, 16, 1, "STONE_LIGHT")
    rect(img, 0, 46, 16, 1, "STONE_SHADOW")
    rect(img, 17, 39, 15, 1, "STONE_LIGHT")
    rect(img, 17, 46, 15, 1, "STONE_SHADOW")

    # Course 4
    rect(img, 1, 48, 14, 1, "STONE_LIGHT")
    rect(img, 1, 55, 14, 1, "STONE_SHADOW")
    rect(img, 16, 48, 15, 1, "STONE_LIGHT")
    rect(img, 16, 55, 15, 1, "STONE_SHADOW")

    # Texture speckles
    for sy in (15, 24, 33, 42, 51):
        px(img, 5, sy, "STONE_LIGHT")
        px(img, 22, sy, "STONE_SHADOW")

    return img


def gen_wall_corner_l() -> Image.Image:
    """Seamless 32x64 cutaway wall left corner piece.
    Massive corner post / quoin return on the left, continuing into timber wall.
    """
    img = new_canvas(32, 64, "PARCHMENT_BASE")
    _draw_wall_top_cap(img, wood=True)
    _draw_wall_baseboard(img, wood=True)

    # Plaster on right (x=11..31)
    rect(img, 11, 12, 21, 20, "PARCHMENT_LIGHT")
    rect(img, 11, 32, 21, 16, "PARCHMENT_BASE")
    rect(img, 11, 48, 21, 8, "PARCHMENT_SHADOW")

    # Heavy corner post column (x=0..10, y=12..55)
    # Facing left return (shadowed):
    rect(img, 0, 12, 4, 44, "WOOD_DEEP")
    # Front corner bevel & face:
    rect(img, 4, 12, 1, 44, "WOOD_LIGHT")
    rect(img, 5, 12, 4, 44, "WOOD_BASE")
    rect(img, 9, 12, 1, 44, "WOOD_SHADOW")
    rect(img, 10, 12, 1, 44, "WOOD_DEEP")

    # Horizontal braces on right (x=11..27)
    rect(img, 11, 32, 17, 1, "WOOD_LIGHT")
    rect(img, 11, 33, 17, 2, "WOOD_BASE")
    rect(img, 11, 35, 17, 1, "WOOD_SHADOW")

    # Right edge timber post matching wall_timber_mid
    rect(img, 28, 12, 2, 44, "WOOD_BASE")
    rect(img, 30, 12, 1, 44, "WOOD_SHADOW")
    rect(img, 31, 12, 1, 44, "WOOD_DEEP")

    return img


def gen_wall_corner_r() -> Image.Image:
    """Seamless 32x64 cutaway wall right corner piece.
    Timber wall on left, massive shaded corner post column on right.
    """
    img = new_canvas(32, 64, "PARCHMENT_BASE")
    _draw_wall_top_cap(img, wood=True)
    _draw_wall_baseboard(img, wood=True)

    # Plaster on left (x=0..20)
    rect(img, 0, 12, 21, 20, "PARCHMENT_LIGHT")
    rect(img, 0, 32, 21, 16, "PARCHMENT_BASE")
    rect(img, 0, 48, 21, 8, "PARCHMENT_SHADOW")

    # Left edge post matching wall_timber_mid
    rect(img, 0, 12, 1, 44, "WOOD_SHADOW")
    rect(img, 1, 12, 1, 44, "WOOD_LIGHT")
    rect(img, 2, 12, 2, 44, "WOOD_BASE")

    # Horizontal center beam (x=4..20)
    rect(img, 4, 32, 17, 1, "WOOD_LIGHT")
    rect(img, 4, 33, 17, 2, "WOOD_BASE")
    rect(img, 4, 35, 17, 1, "WOOD_SHADOW")

    # Heavy corner post column on right (x=21..31, y=12..55)
    rect(img, 21, 12, 1, 44, "WOOD_LIGHT")
    rect(img, 22, 12, 4, 44, "WOOD_BASE")
    rect(img, 26, 12, 2, 44, "WOOD_SHADOW")
    rect(img, 28, 12, 4, 44, "WOOD_DEEP")

    return img


# =============================================================================
# 3. Doors & Stairs (layer="prop", non-tileable, closed outline)
# =============================================================================

def gen_door_front() -> Image.Image:
    """64x64 arched oak tavern entrance with iron strap hinges and brass knocker."""
    img = new_canvas(64, 64)

    # Stone masonry arch surround (x=6..57, y=4..63)
    # Draw arch stones
    ellipse(img, 31.5, 30.0, 26.0, 26.0, "STONE_BASE", filled=True)
    ellipse(img, 31.5, 30.0, 19.0, 19.0, "WOOD_BASE", filled=True)
    # Fill lower sides
    rect(img, 6, 30, 8, 33, "STONE_BASE")
    rect(img, 50, 30, 8, 33, "STONE_SHADOW")
    # Stone arch highlights & joints
    rect(img, 6, 30, 2, 33, "STONE_LIGHT")
    rect(img, 56, 30, 2, 33, "STONE_DEEP")

    # Oak door surface (x=14..49, y=12..63)
    rect(img, 14, 20, 36, 40, "WOOD_BASE")
    # Top highlight curve
    ellipse(img, 31.5, 28.0, 17.5, 16.5, "WOOD_LIGHT", filled=False)

    # Vertical oak plank lines
    for px_line in (20, 26, 32, 38, 44):
        rect(img, px_line, 16, 1, 44, "WOOD_DEEP" if px_line == 32 else "WOOD_SHADOW")
        rect(img, px_line + 1, 16, 1, 44, "WOOD_LIGHT")

    # Center split seam down middle
    rect(img, 31, 14, 2, 46, "WOOD_DEEP")

    # Wrought iron strap hinges (upper y=24..27, lower y=46..49)
    for hy in (24, 46):
        # Left hinge
        rect(img, 12, hy, 16, 3, "METAL_BASE")
        rect(img, 12, hy, 16, 1, "METAL_LIGHT")
        px(img, 16, hy + 1, "METAL_LIGHT")
        px(img, 24, hy + 1, "METAL_LIGHT")
        # Right hinge
        rect(img, 36, hy, 16, 3, "METAL_SHADOW")
        rect(img, 36, hy, 16, 1, "METAL_BASE")
        px(img, 40, hy + 1, "METAL_LIGHT")
        px(img, 48, hy + 1, "METAL_LIGHT")

    # Polished brass knocker on right door (x=37..41, y=34..40)
    ellipse(img, 39.0, 37.0, 3.0, 3.5, "GOLD_BASE", filled=True)
    ellipse(img, 39.0, 37.0, 1.5, 1.8, "WOOD_DEEP", filled=True)
    px(img, 38, 35, "GOLD_LIGHT")

    # Brass latch handle on left door (x=25..27, y=36..42)
    rect(img, 25, 36, 2, 7, "GOLD_BASE")
    px(img, 25, 37, "GOLD_LIGHT")

    # Heavy stone doorstep threshold at bottom (x=8..55, y=58..63)
    rect(img, 8, 58, 48, 2, "STONE_LIGHT")
    rect(img, 8, 60, 48, 3, "STONE_SHADOW")
    rect(img, 8, 63, 48, 1, "STONE_DEEP")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_door_front_open() -> Image.Image:
    """64x64 arched oak tavern entrance with doors swung open to the sides.
    The center doorway aperture is 100% transparent (see-through) revealing the tavern interior floor.
    """
    img = new_canvas(64, 64)

    # 1. Stone masonry arch surround (cx=31.5, cy=30.0, outer_r=26.0, inner_r=18.0)
    for y in range(4, 31):
        for x in range(6, 58):
            nx_out = (x - 31.5) / 26.0
            ny_out = (y - 30.0) / 26.0
            d_out = nx_out * nx_out + ny_out * ny_out
            nx_in = (x - 31.5) / 18.0
            ny_in = (y - 30.0) / 18.0
            d_in = nx_in * nx_in + ny_in * ny_in
            if d_out <= 1.0 and d_in > 1.0:
                px(img, x, y, "STONE_BASE")

    # Side stone pillars (y=30..57)
    rect(img, 6, 30, 8, 28, "STONE_BASE")
    rect(img, 6, 30, 2, 28, "STONE_LIGHT")
    rect(img, 13, 30, 1, 28, "STONE_DEEP")
    rect(img, 50, 30, 8, 28, "STONE_SHADOW")
    rect(img, 50, 30, 1, 28, "STONE_DEEP")
    rect(img, 56, 30, 2, 28, "STONE_DEEP")

    # Stone arch highlights & inner shadow
    ellipse(img, 31.5, 30.0, 26.0, 26.0, "STONE_LIGHT", filled=False)
    ellipse(img, 31.5, 30.0, 18.0, 18.0, "STONE_DEEP", filled=False)

    # 2. Open oak doors swung to sides
    # Left door leaf (x=14..18, y=18..57)
    rect(img, 14, 20, 5, 38, "WOOD_BASE")
    rect(img, 14, 18, 4, 2, "WOOD_BASE")
    rect(img, 14, 18, 1, 40, "WOOD_DEEP")
    rect(img, 15, 18, 1, 40, "WOOD_LIGHT")
    rect(img, 18, 20, 1, 38, "WOOD_DEEP")
    rect(img, 12, 26, 4, 2, "METAL_LIGHT")
    rect(img, 12, 48, 4, 2, "METAL_LIGHT")

    # Right door leaf (x=45..49, y=18..57)
    rect(img, 45, 20, 5, 38, "WOOD_BASE")
    rect(img, 46, 18, 4, 2, "WOOD_BASE")
    rect(img, 45, 20, 1, 38, "WOOD_LIGHT")
    rect(img, 48, 18, 1, 40, "WOOD_SHADOW")
    rect(img, 49, 18, 1, 40, "WOOD_DEEP")
    rect(img, 48, 26, 4, 2, "METAL_BASE")
    rect(img, 48, 48, 4, 2, "METAL_BASE")
    px(img, 45, 36, "GOLD_LIGHT")
    px(img, 45, 37, "GOLD_BASE")

    # 3. Heavy stone doorstep threshold at bottom (x=8..55, y=58..63)
    rect(img, 8, 58, 48, 2, "STONE_LIGHT")
    rect(img, 8, 60, 48, 3, "STONE_SHADOW")
    rect(img, 8, 63, 48, 1, "STONE_DEEP")

    # The entire center (x=19..44, y=4..57) remains completely see-through transparent!
    return finalize_prop(img, "OUTLINE_WARM")


def gen_stairs_up() -> Image.Image:
    """64x64 oak staircase ascending with carved handrail."""
    img = new_canvas(64, 64)

    # Ascending wooden steps (7 steps)
    steps = [
        # (x0, w, y_tread, h_tread, y_riser, h_riser)
        (8, 48, 56, 3, 59, 5),
        (10, 46, 48, 3, 51, 5),
        (12, 44, 40, 3, 43, 5),
        (14, 42, 32, 3, 35, 5),
        (16, 40, 24, 3, 27, 5),
        (18, 38, 16, 3, 19, 5),
        (20, 36, 8, 3, 11, 5),
    ]

    for sx, sw, yt, ht, yr, hr in steps:
        # Tread (horizontal surface seen in 3/4)
        rect(img, sx, yt, sw, ht, "WOOD_BASE")
        rect(img, sx, yt, sw, 1, "WOOD_LIGHT")
        # Riser (vertical face)
        rect(img, sx, yr, sw, hr, "WOOD_SHADOW")
        rect(img, sx, yr + hr - 1, sw, 1, "WOOD_DEEP")

    # Left banister and handrail
    # Balusters (vertical spindles)
    for bx, by in ((9, 44), (11, 36), (13, 28), (15, 20), (17, 12)):
        rect(img, bx, by, 2, 14, "WOOD_BASE")
        px(img, bx, by, "WOOD_LIGHT")

    # Slanted handrail beam
    line(img, 8, 44, 20, 8, "WOOD_LIGHT")
    line(img, 9, 45, 21, 9, "WOOD_BASE")
    line(img, 10, 46, 22, 10, "WOOD_SHADOW")

    # Newel post at bottom left (x=6..10, y=42..63)
    rect(img, 6, 48, 4, 15, "WOOD_BASE")
    rect(img, 6, 48, 1, 15, "WOOD_LIGHT")
    rect(img, 9, 48, 1, 15, "WOOD_SHADOW")
    # Carved spherical ball finial on top of newel post
    ellipse(img, 8.0, 45.0, 2.8, 3.2, "WOOD_LIGHT", filled=True)
    px(img, 7, 44, "CREAM_LIGHT")
    px(img, 9, 46, "WOOD_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_stairs_down() -> Image.Image:
    """64x48 stone steps descending to dark cellar with curb frame."""
    img = new_canvas(64, 48)

    # Outer stone curb frame around opening (x=6..57, y=4..47)
    rect(img, 6, 4, 52, 43, "STONE_BASE")
    rect(img, 6, 4, 52, 2, "STONE_LIGHT")
    rect(img, 6, 4, 2, 43, "STONE_LIGHT")
    rect(img, 56, 4, 2, 43, "STONE_SHADOW")
    rect(img, 6, 45, 52, 3, "STONE_SHADOW")

    # Dark cellar void inside opening (x=12..51, y=8..42)
    rect(img, 12, 8, 40, 35, "STONE_DEEP")

    # Descending stone steps receding into deep darkness
    # Step 1 (nearest / highest)
    rect(img, 14, 34, 36, 4, "STONE_LIGHT")
    rect(img, 14, 38, 36, 3, "STONE_BASE")
    # Step 2
    rect(img, 15, 27, 34, 4, "STONE_BASE")
    rect(img, 15, 31, 34, 3, "STONE_SHADOW")
    # Step 3
    rect(img, 16, 20, 32, 4, "STONE_SHADOW")
    rect(img, 16, 24, 32, 3, "STONE_DEEP")
    # Step 4 (deepest into cellar darkness)
    rect(img, 18, 13, 28, 4, "STONE_DEEP")

    # Wooden hatch doors folded open on sides
    # Left door (x=3..8, y=6..40)
    rect(img, 3, 6, 5, 34, "WOOD_BASE")
    rect(img, 3, 6, 1, 34, "WOOD_LIGHT")
    rect(img, 7, 6, 1, 34, "WOOD_SHADOW")
    rect(img, 3, 14, 5, 2, "METAL_SHADOW")
    rect(img, 3, 30, 5, 2, "METAL_SHADOW")

    # Right door (x=55..60, y=6..40)
    rect(img, 55, 6, 5, 34, "WOOD_SHADOW")
    rect(img, 55, 6, 1, 34, "WOOD_BASE")
    rect(img, 59, 6, 1, 34, "WOOD_DEEP")
    rect(img, 55, 14, 5, 2, "METAL_SHADOW")
    rect(img, 55, 30, 5, 2, "METAL_SHADOW")

    return finalize_prop(img, "OUTLINE_COOL")


# =============================================================================
# 4. Seating & Storage (layer="prop", non-tileable, closed outline)
# =============================================================================

def gen_chair_s() -> Image.Image:
    """24x32 tavern wooden chair facing South (toward camera)."""
    img = new_canvas(24, 32)
    # Backrest uprights (x=4..6 and x=17..19, y=2..18)
    rect(img, 4, 2, 3, 17, "WOOD_BASE")
    rect(img, 4, 2, 1, 17, "WOOD_LIGHT")
    rect(img, 17, 2, 3, 17, "WOOD_SHADOW")
    rect(img, 17, 2, 1, 17, "WOOD_BASE")
    # Curved top crest rail (x=4..19, y=2..5)
    rect(img, 4, 2, 16, 3, "WOOD_BASE")
    rect(img, 4, 2, 16, 1, "WOOD_LIGHT")
    # Carved center splat (x=10..13, y=5..16)
    rect(img, 10, 5, 4, 11, "WOOD_LIGHT")
    rect(img, 12, 5, 2, 11, "WOOD_BASE")
    # Seat cushion / plank (x=3..20, y=16..22)
    rect(img, 3, 16, 18, 5, "WOOD_BASE")
    rect(img, 3, 16, 18, 1, "WOOD_LIGHT")
    rect(img, 3, 16, 1, 5, "WOOD_LIGHT")
    rect(img, 3, 21, 18, 2, "WOOD_SHADOW")
    # 4 legs (front legs x=4..6, x=17..19, y=22..31)
    rect(img, 4, 22, 3, 10, "WOOD_BASE")
    rect(img, 4, 22, 1, 10, "WOOD_LIGHT")
    rect(img, 17, 22, 3, 10, "WOOD_SHADOW")
    rect(img, 17, 22, 1, 10, "WOOD_BASE")
    # Cross stretchers
    rect(img, 7, 27, 10, 1, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_chair_n() -> Image.Image:
    """24x32 tavern wooden chair facing North (away from camera, seen from behind)."""
    img = new_canvas(24, 32)
    # Rear backrest uprights extending to floor
    rect(img, 4, 2, 3, 29, "WOOD_BASE")
    rect(img, 4, 2, 1, 29, "WOOD_LIGHT")
    rect(img, 17, 2, 3, 29, "WOOD_SHADOW")
    rect(img, 19, 2, 1, 29, "WOOD_DEEP")
    # Top crest rail
    rect(img, 4, 2, 16, 4, "WOOD_BASE")
    rect(img, 4, 2, 16, 1, "WOOD_LIGHT")
    # Solid wooden back panel in foreground
    rect(img, 7, 5, 10, 16, "WOOD_BASE")
    rect(img, 7, 5, 2, 16, "WOOD_LIGHT")
    rect(img, 15, 5, 2, 16, "WOOD_SHADOW")
    # Cross stretcher
    rect(img, 7, 26, 10, 2, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_chair_e() -> Image.Image:
    """24x32 tavern wooden chair facing East (profile facing right toward table)."""
    img = new_canvas(24, 32)
    # Backrest on West (left)
    rect(img, 4, 2, 3, 20, "WOOD_BASE")
    rect(img, 4, 2, 1, 20, "WOOD_LIGHT")
    rect(img, 6, 2, 1, 20, "WOOD_SHADOW")
    # Seat extending East
    rect(img, 6, 16, 14, 5, "WOOD_BASE")
    rect(img, 6, 16, 14, 1, "WOOD_LIGHT")
    rect(img, 6, 20, 14, 2, "WOOD_SHADOW")
    # Rear leg
    rect(img, 4, 21, 3, 10, "WOOD_BASE")
    rect(img, 4, 21, 1, 10, "WOOD_LIGHT")
    # Front leg
    rect(img, 16, 21, 3, 10, "WOOD_SHADOW")
    rect(img, 16, 21, 1, 10, "WOOD_BASE")
    rect(img, 7, 26, 9, 2, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_chair_w() -> Image.Image:
    """24x32 tavern wooden chair facing West (profile facing left toward table, top-left lit)."""
    img = new_canvas(24, 32)
    # Backrest on East (right)
    rect(img, 17, 2, 3, 20, "WOOD_SHADOW")
    rect(img, 17, 2, 1, 20, "WOOD_BASE")
    rect(img, 19, 2, 1, 20, "WOOD_DEEP")
    # Seat extending West with top-left lighting
    rect(img, 4, 16, 14, 5, "WOOD_BASE")
    rect(img, 4, 16, 14, 1, "WOOD_LIGHT")
    rect(img, 4, 16, 1, 5, "WOOD_LIGHT")
    rect(img, 4, 20, 14, 2, "WOOD_SHADOW")
    # Front leg (left)
    rect(img, 5, 21, 3, 10, "WOOD_BASE")
    rect(img, 5, 21, 1, 10, "WOOD_LIGHT")
    # Rear leg (right)
    rect(img, 17, 21, 3, 10, "WOOD_DEEP")
    rect(img, 17, 21, 1, 10, "WOOD_SHADOW")
    rect(img, 8, 26, 9, 2, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")

gen_chair = gen_chair_s


def gen_stool_s() -> Image.Image:
    """20x24 round rustic tavern stool facing South (front view)."""
    img = new_canvas(20, 24)
    # Round wooden seat top (oval in 3/4 perspective)
    ellipse(img, 9.5, 6.0, 7.0, 3.8, "WOOD_BASE", filled=True)
    ellipse(img, 9.5, 5.0, 6.5, 3.2, "WOOD_LIGHT", filled=True)
    ellipse(img, 9.5, 5.0, 3.0, 1.5, "WOOD_BASE", filled=False)
    # Seat thickness front rim
    rect(img, 3, 7, 14, 2, "WOOD_SHADOW")
    # 3 splayed legs
    line(img, 5, 9, 3, 23, "WOOD_BASE")
    line(img, 6, 9, 4, 23, "WOOD_LIGHT")
    line(img, 10, 9, 10, 23, "WOOD_DEEP")
    line(img, 14, 9, 16, 23, "WOOD_SHADOW")
    line(img, 15, 9, 17, 23, "WOOD_DEEP")
    ellipse(img, 10.0, 17.5, 5.5, 2.0, "WOOD_SHADOW", filled=False)
    px(img, 6, 17, "WOOD_LIGHT")
    px(img, 14, 18, "WOOD_DEEP")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_stool_n() -> Image.Image:
    """20x24 round rustic tavern stool facing North (back view)."""
    img = new_canvas(20, 24)
    ellipse(img, 9.5, 6.0, 7.0, 3.8, "WOOD_BASE", filled=True)
    ellipse(img, 9.5, 5.0, 6.5, 3.2, "WOOD_LIGHT", filled=True)
    rect(img, 3, 7, 14, 2, "WOOD_SHADOW")
    line(img, 10, 8, 10, 23, "WOOD_BASE")
    line(img, 9, 8, 9, 23, "WOOD_LIGHT")
    line(img, 4, 9, 3, 23, "WOOD_SHADOW")
    line(img, 15, 9, 16, 23, "WOOD_DEEP")
    ellipse(img, 10.0, 16.5, 5.5, 2.0, "WOOD_SHADOW", filled=False)
    px(img, 6, 16, "WOOD_LIGHT")
    px(img, 14, 17, "WOOD_DEEP")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_stool_e() -> Image.Image:
    """20x24 round rustic tavern stool facing East (profile view)."""
    img = new_canvas(20, 24)
    ellipse(img, 9.5, 6.0, 7.0, 3.8, "WOOD_BASE", filled=True)
    ellipse(img, 9.5, 5.0, 6.5, 3.2, "WOOD_LIGHT", filled=True)
    rect(img, 3, 7, 14, 2, "WOOD_SHADOW")
    line(img, 6, 8, 4, 23, "WOOD_LIGHT")
    line(img, 7, 8, 5, 23, "WOOD_BASE")
    line(img, 13, 8, 15, 23, "WOOD_SHADOW")
    line(img, 14, 8, 16, 23, "WOOD_DEEP")
    ellipse(img, 10.0, 17.0, 5.0, 2.0, "WOOD_SHADOW", filled=False)
    return finalize_prop(img, "OUTLINE_WARM")


def gen_stool_w() -> Image.Image:
    """20x24 round rustic tavern stool facing West (profile view, top-left lit)."""
    img = new_canvas(20, 24)
    ellipse(img, 9.5, 6.0, 7.0, 3.8, "WOOD_BASE", filled=True)
    ellipse(img, 9.5, 5.0, 6.5, 3.2, "WOOD_LIGHT", filled=True)
    rect(img, 3, 7, 14, 2, "WOOD_SHADOW")
    line(img, 5, 8, 3, 23, "WOOD_LIGHT")
    line(img, 6, 8, 4, 23, "WOOD_BASE")
    line(img, 14, 8, 16, 23, "WOOD_SHADOW")
    line(img, 15, 8, 17, 23, "WOOD_DEEP")
    ellipse(img, 10.0, 17.0, 5.0, 2.0, "WOOD_SHADOW", filled=False)
    return finalize_prop(img, "OUTLINE_WARM")

gen_stool = gen_stool_s


def gen_bench_s() -> Image.Image:
    """64x28 long communal tavern bench facing South (front view)."""
    img = new_canvas(64, 28)
    rect(img, 2, 4, 60, 6, "WOOD_BASE")
    rect(img, 2, 4, 60, 1, "WOOD_LIGHT")
    rect(img, 2, 4, 1, 6, "WOOD_LIGHT")
    rect(img, 6, 6, 22, 1, "WOOD_LIGHT")
    rect(img, 34, 7, 18, 1, "WOOD_SHADOW")
    rect(img, 2, 10, 60, 3, "WOOD_SHADOW")
    rect(img, 2, 13, 60, 1, "WOOD_DEEP")
    rect(img, 8, 14, 7, 13, "WOOD_BASE")
    rect(img, 8, 14, 2, 13, "WOOD_LIGHT")
    rect(img, 13, 14, 2, 13, "WOOD_SHADOW")
    rect(img, 6, 25, 11, 3, "WOOD_SHADOW")
    rect(img, 6, 25, 11, 1, "WOOD_LIGHT")
    rect(img, 48, 14, 7, 13, "WOOD_SHADOW")
    rect(img, 48, 14, 2, 13, "WOOD_BASE")
    rect(img, 53, 14, 2, 13, "WOOD_DEEP")
    rect(img, 46, 25, 11, 3, "WOOD_DEEP")
    rect(img, 46, 25, 11, 1, "WOOD_SHADOW")
    rect(img, 15, 19, 33, 3, "WOOD_SHADOW")
    rect(img, 15, 19, 33, 1, "WOOD_BASE")
    px(img, 15, 20, "WOOD_LIGHT")
    px(img, 47, 20, "WOOD_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_bench_n() -> Image.Image:
    """64x28 long communal tavern bench facing North (back view)."""
    img = new_canvas(64, 28)
    rect(img, 2, 4, 60, 6, "WOOD_BASE")
    rect(img, 2, 4, 60, 1, "WOOD_LIGHT")
    rect(img, 2, 10, 60, 3, "WOOD_SHADOW")
    rect(img, 2, 13, 60, 1, "WOOD_DEEP")
    rect(img, 8, 14, 7, 13, "WOOD_BASE")
    rect(img, 8, 14, 2, 13, "WOOD_LIGHT")
    rect(img, 13, 14, 2, 13, "WOOD_SHADOW")
    rect(img, 6, 25, 11, 3, "WOOD_SHADOW")
    rect(img, 48, 14, 7, 13, "WOOD_SHADOW")
    rect(img, 48, 14, 2, 13, "WOOD_BASE")
    rect(img, 53, 14, 2, 13, "WOOD_DEEP")
    rect(img, 46, 25, 11, 3, "WOOD_DEEP")
    rect(img, 15, 18, 33, 3, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_bench_e() -> Image.Image:
    """28x64 vertical communal tavern bench facing East."""
    img = new_canvas(28, 64)
    rect(img, 4, 2, 8, 60, "WOOD_BASE")
    rect(img, 4, 2, 1, 60, "WOOD_LIGHT")
    rect(img, 12, 2, 12, 60, "WOOD_SHADOW")
    rect(img, 6, 6, 16, 6, "WOOD_BASE")
    rect(img, 6, 52, 16, 6, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")


def gen_bench_w() -> Image.Image:
    """28x64 vertical communal tavern bench facing West (top-left lit)."""
    img = new_canvas(28, 64)
    rect(img, 4, 2, 12, 60, "WOOD_BASE")
    rect(img, 4, 2, 1, 60, "WOOD_LIGHT")
    rect(img, 16, 2, 8, 60, "WOOD_DEEP")
    rect(img, 6, 6, 16, 6, "WOOD_BASE")
    rect(img, 6, 52, 16, 6, "WOOD_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM")

gen_bench = gen_bench_s


def gen_chest() -> Image.Image:
    """32x28 iron-bound tavern treasure and storage chest."""
    img = new_canvas(32, 28)

    # Curved domed lid (x=3..28, y=3..13)
    ellipse(img, 15.5, 12.0, 12.5, 9.0, "WOOD_BASE", filled=True)
    ellipse(img, 15.5, 11.0, 12.0, 8.0, "WOOD_LIGHT", filled=True)
    # Lid rim
    rect(img, 3, 11, 26, 3, "WOOD_SHADOW")

    # Chest body (x=3..28, y=14..27)
    rect(img, 3, 14, 26, 13, "WOOD_BASE")
    rect(img, 3, 20, 26, 7, "WOOD_SHADOW")

    # 3 wrought iron straps curving over lid & body (left x=5..7, center x=14..16, right x=24..26)
    for bx in (5, 14, 24):
        rect(img, bx, 4, 3, 23, "METAL_SHADOW")
        rect(img, bx, 4, 1, 23, "METAL_BASE")
        px(img, bx + 1, 5, "METAL_LIGHT")
        px(img, bx + 1, 12, "METAL_LIGHT")
        px(img, bx + 1, 25, "METAL_LIGHT")

    # Polished brass lockplate / hasp in center (x=13..17, y=11..17)
    rect(img, 13, 11, 5, 7, "GOLD_BASE")
    rect(img, 13, 11, 5, 1, "GOLD_LIGHT")
    px(img, 14, 12, "GOLD_LIGHT")
    # Keyhole
    px(img, 15, 14, "OUTLINE_WARM")
    px(img, 15, 15, "OUTLINE_WARM")

    # Side iron drop handles
    rect(img, 2, 17, 2, 4, "METAL_BASE")
    rect(img, 28, 17, 2, 4, "METAL_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_crates_sacks() -> Image.Image:
    """48x40 wooden slatted crate + bulging grain sacks."""
    img = new_canvas(48, 40)

    # Slatted wooden crate on left (x=3..25, y=8..39)
    rect(img, 3, 8, 23, 31, "WOOD_BASE")
    # Top lid
    rect(img, 3, 8, 23, 3, "WOOD_LIGHT")
    # Corner posts
    rect(img, 3, 8, 3, 31, "WOOD_LIGHT")
    rect(img, 23, 8, 3, 31, "WOOD_SHADOW")
    # Bottom rail
    rect(img, 3, 36, 23, 4, "WOOD_SHADOW")
    # Diagonal 'X' braces across front face
    line(img, 6, 12, 22, 35, "WOOD_LIGHT")
    line(img, 6, 35, 22, 12, "WOOD_SHADOW")
    # Horizontal plank grooves
    for gy in (16, 23, 30):
        rect(img, 6, gy, 17, 1, "WOOD_DEEP")

    # Upright grain sack (x=22..37, y=12..39)
    # Ruffled gathered top fabric
    rect(img, 26, 12, 8, 4, "PARCHMENT_LIGHT")
    # Rope tie neck
    rect(img, 27, 16, 6, 2, "WOOD_DEEP")
    px(img, 28, 16, "GOLD_BASE")
    # Bulging belly of sack
    ellipse(img, 30.0, 28.0, 7.5, 11.0, "PARCHMENT_BASE", filled=True)
    ellipse(img, 28.5, 26.0, 5.5, 8.5, "PARCHMENT_LIGHT", filled=True)
    # Lower creases
    rect(img, 23, 34, 14, 5, "PARCHMENT_SHADOW")

    # Second slouched grain sack in front (x=30..45, y=22..39)
    ellipse(img, 37.5, 31.0, 7.0, 8.0, "PARCHMENT_BASE", filled=True)
    ellipse(img, 36.0, 29.0, 5.0, 6.0, "PARCHMENT_LIGHT", filled=True)
    rect(img, 32, 35, 12, 4, "PARCHMENT_SHADOW")
    # Stitched seam line
    for sty in range(26, 36, 2):
        px(img, 39, sty, "ROAST_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_shelves_bottles() -> Image.Image:
    """64x56 tavern back-bar shelving unit with potions, mugs, and wine keg."""
    img = new_canvas(64, 56)

    # Oak cabinet frame (x=3..60, y=2..55)
    # Side uprights
    rect(img, 3, 2, 5, 53, "WOOD_BASE")
    rect(img, 3, 2, 2, 53, "WOOD_LIGHT")
    rect(img, 56, 2, 5, 53, "WOOD_SHADOW")
    rect(img, 59, 2, 2, 53, "WOOD_DEEP")
    # Top carved cornice
    rect(img, 2, 2, 60, 4, "WOOD_BASE")
    rect(img, 2, 2, 60, 1, "WOOD_LIGHT")
    rect(img, 2, 5, 60, 1, "WOOD_SHADOW")

    # Horizontal shelves: Top (y=18..21), Middle (y=35..38), Bottom (y=52..55)
    for sy in (18, 35, 52):
        rect(img, 3, sy, 58, 4, "WOOD_BASE")
        rect(img, 3, sy, 58, 1, "WOOD_LIGHT")
        rect(img, 3, sy + 3, 58, 1, "WOOD_SHADOW")

    # Shelf 1: Colorful bottles & potions (y=7..18)
    bottles = [
        (10, 8, "POTION_RED"),
        (18, 9, "POTION_BLUE"),
        (26, 7, "POTION_GREEN"),
        (34, 8, "POTION_PURPLE"),
        (42, 9, "POTION_YELLOW"),
        (50, 7, "ALE_BASE"),
    ]
    for bx, by, bcol in bottles:
        # Cork
        rect(img, bx + 2, by, 2, 2, "WOOD_LIGHT")
        # Neck
        rect(img, bx + 2, by + 2, 2, 2, "CREAM_SHADOW")
        # Body
        rect(img, bx, by + 4, 6, 7, bcol)
        # Specular highlight
        px(img, bx + 1, by + 4, "CREAM_LIGHT")
        px(img, bx + 1, by + 5, "CREAM_LIGHT")

    # Shelf 2: Row of foamy mugs (y=25..35)
    for mx in (12, 24, 36, 48):
        # Mug handle
        rect(img, mx + 6, mx_offset := 28, 2, 4, "METAL_BASE")
        # Body
        rect(img, mx, 27, 6, 8, "ALE_BASE")
        rect(img, mx, 27, 2, 8, "ALE_LIGHT")
        rect(img, mx + 4, 27, 2, 8, "ALE_BASE")
        # Foamy head
        rect(img, mx, 25, 6, 3, "CREAM_LIGHT")
        px(img, mx + 5, 26, "CREAM_SHADOW")

    # Shelf 3: Center oak wine keg with brass tap + plates (y=40..52)
    # Keg (x=24..40, y=41..52)
    ellipse(img, 32.0, 46.5, 8.0, 5.5, "WOOD_BASE", filled=True)
    ellipse(img, 32.0, 45.5, 7.5, 4.5, "WOOD_LIGHT", filled=True)
    # Iron hoops
    ellipse(img, 28.0, 46.5, 2.0, 5.0, "METAL_SHADOW", filled=False)
    ellipse(img, 36.0, 46.5, 2.0, 5.0, "METAL_SHADOW", filled=False)
    # Center brass tap
    rect(img, 31, 47, 3, 2, "GOLD_BASE")
    px(img, 31, 47, "GOLD_LIGHT")
    px(img, 32, 49, "GOLD_BASE")

    # Stack of ceramic plates on left (x=10..18, y=45..52)
    for py in (46, 48, 50):
        ellipse(img, 14.0, py, 4.5, 1.8, "CREAM_LIGHT", filled=True)
        ellipse(img, 14.0, py + 0.8, 4.5, 1.2, "CREAM_SHADOW", filled=False)

    return finalize_prop(img, "OUTLINE_WARM")


# =============================================================================
# 5. 4 Visual Table Tiers (64x48, footprint=(2,2), layer="prop")
# =============================================================================

def gen_table_t1_bare() -> Image.Image:
    """64x48 Tier 1: Rustic rough plank tavern table with square trestle legs."""
    img = new_canvas(64, 48)

    # 4 rough tabletop planks (x=4..59, y=8..28)
    rect(img, 4, 8, 56, 20, "WOOD_BASE")
    rect(img, 4, 8, 56, 2, "WOOD_LIGHT")
    rect(img, 4, 8, 2, 20, "WOOD_LIGHT")

    # Horizontal plank seams
    for py in (13, 18, 23):
        rect(img, 4, py, 56, 1, "WOOD_DEEP")
        rect(img, 4, py + 1, 56, 1, "WOOD_LIGHT")

    # Wood grain knots and rough ends
    ellipse(img, 20.0, 15.0, 2.5, 1.5, "WOOD_DEEP", filled=True)
    ellipse(img, 44.0, 21.0, 2.5, 1.5, "WOOD_DEEP", filled=True)

    # Wooden dowel pins at plank ends
    for dx in (6, 57):
        for dy in (10, 15, 20, 25):
            px(img, dx, dy, "WOOD_DEEP")

    # Apron edge underneath tabletop
    rect(img, 6, 28, 52, 5, "WOOD_SHADOW")
    rect(img, 6, 32, 52, 1, "WOOD_DEEP")

    # Chunky square trestle legs (y=33..47)
    # Front-left leg (x=7..13)
    rect(img, 7, 33, 7, 14, "WOOD_BASE")
    rect(img, 7, 33, 2, 14, "WOOD_LIGHT")
    rect(img, 12, 33, 2, 14, "WOOD_SHADOW")
    # Front-right leg (x=50..56)
    rect(img, 50, 33, 7, 14, "WOOD_SHADOW")
    rect(img, 50, 33, 2, 14, "WOOD_BASE")
    rect(img, 55, 33, 2, 14, "WOOD_DEEP")
    # Back legs (partially visible)
    rect(img, 12, 30, 4, 12, "WOOD_DEEP")
    rect(img, 48, 30, 4, 12, "WOOD_DEEP")

    # Horizontal foot stretcher beam (y=41..43, x=13..50)
    rect(img, 13, 41, 37, 3, "WOOD_SHADOW")
    rect(img, 13, 41, 37, 1, "WOOD_BASE")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_table_t2_polished() -> Image.Image:
    """64x48 Tier 2: Bevelled warm oak table with brass studs and turned legs."""
    img = new_canvas(64, 48)

    # Polished tabletop with rounded corners & bevel (x=4..59, y=8..28)
    ellipse(img, 31.5, 18.0, 27.5, 10.0, "WOOD_BASE", filled=True)
    ellipse(img, 31.5, 17.0, 26.5, 9.0, "WOOD_LIGHT", filled=True)

    # Lustrous diagonal highlight reflection
    line(img, 16, 12, 28, 24, "CREAM_LIGHT")
    line(img, 17, 12, 29, 24, "CREAM_LIGHT")
    line(img, 22, 11, 34, 23, "CREAM_LIGHT")

    # Chamfered bevel edge rim
    ellipse(img, 31.5, 18.0, 27.5, 10.0, "WOOD_SHADOW", filled=False)
    rect(img, 6, 26, 52, 4, "WOOD_SHADOW")

    # Decorative brass studs along rim
    stud_xs = [8, 14, 20, 26, 32, 38, 44, 50, 56]
    for sx in stud_xs:
        px(img, sx, 27, "GOLD_BASE")
        px(img, sx, 26, "GOLD_LIGHT")

    # Table apron molding
    rect(img, 8, 30, 48, 3, "WOOD_DEEP")

    # Turned cylindrical legs with lathe rings & brass ferrules (y=33..47)
    # Left leg (x=8..14)
    rect(img, 9, 33, 5, 11, "WOOD_BASE")
    rect(img, 9, 33, 2, 11, "WOOD_LIGHT")
    rect(img, 12, 33, 2, 11, "WOOD_SHADOW")
    # Ring ornament
    rect(img, 8, 36, 7, 2, "WOOD_LIGHT")
    # Brass ferrule foot (y=44..47)
    rect(img, 9, 44, 5, 3, "GOLD_BASE")
    rect(img, 9, 44, 2, 3, "GOLD_LIGHT")

    # Right leg (x=49..55)
    rect(img, 50, 33, 5, 11, "WOOD_SHADOW")
    rect(img, 50, 33, 2, 11, "WOOD_BASE")
    rect(img, 53, 33, 2, 11, "WOOD_DEEP")
    # Ring ornament
    rect(img, 49, 36, 7, 2, "WOOD_BASE")
    # Brass ferrule foot (y=44..47)
    rect(img, 50, 44, 5, 3, "GOLD_BASE")
    rect(img, 50, 44, 2, 3, "GOLD_LIGHT")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_table_t3_clothed() -> Image.Image:
    """64x48 Tier 3: Oak table with draped cream tablecloth and crimson runner."""
    img = new_canvas(64, 48)

    # Draped cream tablecloth (x=4..59, y=8..36)
    ellipse(img, 31.5, 18.0, 27.5, 10.0, "CREAM_LIGHT", filled=True)
    # Hanging skirt folds
    rect(img, 5, 23, 54, 12, "CREAM_SHADOW")
    # Vertical cloth pleat shadows
    for fx in (8, 14, 20, 44, 50, 56):
        line(img, fx, 23, fx + 1, 35, "PARCHMENT_SHADOW")

    # Crimson cloth runner down center (x=24..39, y=8..38)
    rect(img, 24, 8, 16, 18, "CLOTH_RED_BASE")
    rect(img, 24, 8, 16, 2, "CLOTH_RED_LIGHT")
    rect(img, 24, 8, 2, 18, "CLOTH_RED_LIGHT")
    rect(img, 24, 26, 16, 12, "CLOTH_RED_BASE")
    rect(img, 36, 26, 4, 12, "CLOTH_RED_SHADOW")
    # Gold fringe tassels at runner overhang hem (y=38..40, x=24..39)
    for tx in range(24, 40, 2):
        px(img, tx, 38, "GOLD_LIGHT")
        px(img, tx, 39, "GOLD_BASE")

    # Turned oak legs peeking out from underneath cloth corners (y=35..47)
    # Left leg
    rect(img, 8, 35, 4, 12, "WOOD_BASE")
    rect(img, 8, 35, 1, 12, "WOOD_LIGHT")
    rect(img, 11, 35, 1, 12, "WOOD_SHADOW")
    # Right leg
    rect(img, 52, 35, 4, 12, "WOOD_SHADOW")
    rect(img, 52, 35, 1, 12, "WOOD_BASE")
    rect(img, 55, 35, 1, 12, "WOOD_DEEP")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_table_t4_ornate() -> Image.Image:
    """64x48 Tier 4: Gilded noble banquet table with royal drapery, candelabra, and filigree."""
    img = new_canvas(64, 48)

    # Velvet crimson base drape (x=3..60, y=8..36)
    ellipse(img, 31.5, 18.0, 28.5, 10.5, "CLOTH_RED_BASE", filled=True)
    ellipse(img, 31.5, 17.0, 27.5, 9.5, "CLOTH_RED_LIGHT", filled=True)
    rect(img, 4, 23, 56, 13, "CLOTH_RED_SHADOW")

    # Royal accent teal scalloped valance (x=4..59, y=28..35)
    for sc_idx in range(7):
        sc_x = 5 + sc_idx * 8
        ellipse(img, sc_x + 3.5, 31.0, 4.0, 3.5, "CLOTH_ACCENT_BASE", filled=True)
        ellipse(img, sc_x + 3.5, 30.0, 3.5, 2.5, "CLOTH_ACCENT_LIGHT", filled=True)

    # Gold filigree embroidery border (y=34..36)
    for gx in range(5, 59, 2):
        px(img, gx, 35, "GOLD_LIGHT")
        px(img, gx + 1, 36, "GOLD_BASE")

    # Flat woven gold-and-teal royal centerpiece medallion (leaves tabletop flat for food/candle props!)
    ellipse(img, 31.5, 16.5, 12.0, 4.5, "GOLD_BASE", filled=True)
    ellipse(img, 31.5, 16.5, 10.0, 3.3, "CLOTH_ACCENT_BASE", filled=True)
    ellipse(img, 31.5, 16.5, 5.0, 1.8, "GOLD_LIGHT", filled=True)

    # Gilded baroque scrolled legs peeking out (y=36..47)
    # Left leg
    rect(img, 7, 36, 5, 11, "GOLD_BASE")
    rect(img, 7, 36, 2, 11, "GOLD_LIGHT")
    ellipse(img, 9.5, 45.0, 3.0, 2.0, "GOLD_LIGHT", filled=True)
    # Right leg
    rect(img, 52, 36, 5, 11, "GOLD_BASE")
    rect(img, 52, 36, 2, 11, "GOLD_LIGHT")
    ellipse(img, 54.5, 45.0, 3.0, 2.0, "GOLD_BASE", filled=True)

    return finalize_prop(img, "OUTLINE_WARM")


# =============================================================================
# 6. 2 Guest Bed Tiers (48x56, footprint=(2,2), layer="prop")
# =============================================================================

def gen_bed_t1() -> Image.Image:
    """48x56 Tier 1: Simple timber guest bed with cream pillow and wool blanket."""
    img = new_canvas(48, 56)

    # Wooden headboard (x=6..41, y=4..18)
    rect(img, 6, 4, 36, 14, "WOOD_BASE")
    rect(img, 6, 4, 36, 2, "WOOD_LIGHT")
    rect(img, 6, 4, 2, 14, "WOOD_LIGHT")
    rect(img, 40, 4, 2, 14, "WOOD_SHADOW")

    # 4 corner timber posts
    # Back-left & back-right posts
    rect(img, 4, 2, 4, 18, "WOOD_LIGHT")
    rect(img, 40, 2, 4, 18, "WOOD_SHADOW")

    # Mattress bed frame sides (x=6..41, y=18..46)
    rect(img, 6, 18, 36, 28, "PARCHMENT_SHADOW")

    # Single cream pillow (x=12..35, y=14..22)
    ellipse(img, 23.5, 18.0, 11.5, 4.5, "CREAM_LIGHT", filled=True)
    ellipse(img, 23.5, 19.0, 9.0, 3.0, "CREAM_SHADOW", filled=False)

    # Folded white undersheet top collar (y=22..25, x=8..39)
    rect(img, 8, 22, 32, 3, "CREAM_LIGHT")
    rect(img, 8, 25, 32, 1, "CREAM_SHADOW")

    # Homespun wool blanket (y=26..46, x=8..39)
    rect(img, 8, 26, 32, 20, "PARCHMENT_BASE")
    rect(img, 8, 26, 32, 2, "PARCHMENT_LIGHT")
    rect(img, 8, 26, 2, 20, "PARCHMENT_LIGHT")
    # Diagonal wool weave texture
    for wy in range(28, 44, 4):
        line(img, 10, wy, 36, wy + 2, "PARCHMENT_SHADOW")

    # Footboard (x=6..41, y=46..51)
    rect(img, 6, 46, 36, 5, "WOOD_BASE")
    rect(img, 6, 46, 36, 1, "WOOD_LIGHT")
    rect(img, 6, 50, 36, 1, "WOOD_SHADOW")

    # Two front posts touching floor (x=4..8 and x=39..43, y=42..55)
    rect(img, 4, 42, 4, 13, "WOOD_BASE")
    rect(img, 4, 42, 2, 13, "WOOD_LIGHT")
    rect(img, 39, 42, 4, 13, "WOOD_SHADOW")
    rect(img, 39, 42, 2, 13, "WOOD_BASE")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_bed_t2() -> Image.Image:
    """48x56 Tier 2: Carved noble guest bed with crimson gold-trimmed duvet and twin pillows."""
    img = new_canvas(48, 56)

    # Ornate dark oak headboard with carved arch (x=4..43, y=2..20)
    rect(img, 4, 4, 40, 16, "WOOD_DEEP")
    rect(img, 4, 4, 40, 2, "WOOD_BASE")
    ellipse(img, 23.5, 8.0, 14.0, 6.0, "WOOD_BASE", filled=True)
    ellipse(img, 23.5, 7.0, 12.0, 5.0, "WOOD_LIGHT", filled=True)

    # 4 tall turned posts with carved ball finials
    # Back posts (y=0..20)
    for bx in (2, 42):
        rect(img, bx, 2, 4, 18, "WOOD_SHADOW")
        ellipse(img, bx + 2.0, 2.0, 2.5, 2.5, "WOOD_LIGHT", filled=True)

    # Twin plush cream pillows (x=8..22 and x=25..39, y=12..22)
    ellipse(img, 15.0, 17.0, 7.0, 4.5, "CREAM_LIGHT", filled=True)
    ellipse(img, 15.0, 18.0, 5.0, 3.0, "CREAM_SHADOW", filled=False)
    ellipse(img, 32.0, 17.0, 7.0, 4.5, "CREAM_LIGHT", filled=True)
    ellipse(img, 32.0, 18.0, 5.0, 3.0, "CREAM_SHADOW", filled=False)

    # Turned-down crisp sheet cuff (y=21..24, x=6..41)
    rect(img, 6, 21, 36, 3, "CREAM_LIGHT")
    rect(img, 6, 24, 36, 1, "CREAM_SHADOW")

    # Plush royal crimson quilted duvet (y=25..46, x=6..41)
    rect(img, 6, 25, 36, 21, "CLOTH_RED_BASE")
    rect(img, 6, 25, 36, 2, "CLOTH_RED_LIGHT")

    # Diamond quilting tucks
    tucks = [
        (12, 28), (24, 28), (36, 28),
        (18, 34), (30, 34),
        (12, 40), (24, 40), (36, 40),
    ]
    for tx, ty in tucks:
        px(img, tx, ty, "CLOTH_RED_SHADOW")
        px(img, tx, ty - 1, "CLOTH_RED_LIGHT")

    # Gold brocade ribbon border along duvet edges
    rect(img, 6, 26, 36, 1, "GOLD_LIGHT")
    rect(img, 6, 26, 1, 20, "GOLD_LIGHT")
    rect(img, 41, 26, 1, 20, "GOLD_BASE")

    # Carved footboard (x=6..41, y=46..51)
    rect(img, 6, 46, 36, 5, "WOOD_DEEP")
    rect(img, 6, 46, 36, 1, "WOOD_LIGHT")
    ellipse(img, 23.5, 48.5, 3.0, 2.0, "GOLD_BASE", filled=True)

    # Front turned posts touching floor (x=2..6 and x=41..45, y=36..55)
    for fx in (2, 41):
        rect(img, fx, 36, 4, 19, "WOOD_BASE")
        rect(img, fx, 36, 1, 19, "WOOD_LIGHT")
        rect(img, fx + 3, 36, 1, 19, "WOOD_SHADOW")
        # Ball finial top
        ellipse(img, fx + 2.0, 36.0, 2.5, 2.5, "WOOD_LIGHT", filled=True)

    return finalize_prop(img, "OUTLINE_WARM")


# =============================================================================
# 7. Exterior & Diorama (layer="exterior", non-tileable, closed outline)
# =============================================================================

def gen_facade_t1() -> Image.Image:
    """128x96 Tier 1: Run-down humble tavern shack with patched roof and smoke."""
    img = new_canvas(128, 96)

    # Ground rubble footing (y=90..95, x=16..112)
    rect(img, 16, 90, 96, 5, "STONE_SHADOW")
    rect(img, 16, 90, 96, 1, "STONE_BASE")

    # Weathered timber walls (x=24..104, y=50..92)
    rect(img, 24, 50, 80, 42, "WOOD_BASE")
    # Horizontal weathered plank gaps
    for py in range(54, 90, 6):
        rect(img, 24, py, 80, 1, "WOOD_DEEP")

    # Plank door (x=54..74, y=62..94)
    rect(img, 54, 62, 20, 32, "WOOD_SHADOW")
    rect(img, 54, 62, 20, 1, "WOOD_LIGHT")
    rect(img, 63, 62, 1, 32, "WOOD_DEEP")
    # Latch
    px(img, 66, 78, "METAL_BASE")

    # Shuttered window with warm crack of light (x=32..46, y=62..76)
    rect(img, 32, 62, 14, 14, "WOOD_SHADOW")
    rect(img, 37, 64, 4, 10, "FLAME_YELLOW")
    rect(img, 32, 62, 14, 1, "WOOD_LIGHT")

    # Patched roof (x=18..110, y=24..54)
    # Triangular gable shape
    for ry in range(24, 54):
        inset = int((ry - 24) * (110 - 64) / 30)
        rx0 = max(18, 64 - inset)
        rx1 = min(110, 64 + inset)
        rect(img, rx0, ry, rx1 - rx0 + 1, 1, "ROAST_BASE")
    # Thatch/shingle patches
    rect(img, 34, 32, 16, 8, "PARCHMENT_SHADOW")
    rect(img, 72, 36, 18, 10, "WOOD_SHADOW")
    # Eaves highlight
    line(img, 18, 54, 64, 24, "ROAST_LIGHT")
    line(img, 64, 24, 110, 54, "ROAST_SHADOW")

    # Crooked fieldstone chimney on right (x=88..102, y=14..50)
    rect(img, 88, 14, 14, 36, "STONE_BASE")
    rect(img, 88, 14, 2, 36, "STONE_LIGHT")
    rect(img, 100, 14, 2, 36, "STONE_SHADOW")
    # Chimney cap
    rect(img, 86, 12, 18, 3, "STONE_SHADOW")

    # Cozy puffs of smoke drifting up (y=4..14)
    ellipse(img, 94.0, 9.0, 4.0, 3.0, "CREAM_LIGHT", filled=True)
    ellipse(img, 91.0, 4.0, 5.0, 3.5, "CREAM_SHADOW", filled=True)

    # Crooked wooden sign post on left (x=10..14, y=56..94)
    rect(img, 12, 56, 3, 38, "WOOD_BASE")
    rect(img, 12, 56, 1, 38, "WOOD_LIGHT")
    # Hanging signboard (x=6..18, y=60..70)
    rect(img, 6, 60, 12, 10, "WOOD_LIGHT")
    rect(img, 6, 69, 12, 1, "WOOD_SHADOW")
    # Hanging iron links
    px(img, 8, 58, "METAL_SHADOW")
    px(img, 15, 58, "METAL_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_facade_t2() -> Image.Image:
    """128x96 Tier 2: Sturdy single-story timber & plaster tavern with ale mug sign."""
    img = new_canvas(128, 96)

    # Stone foundation (x=16..112, y=88..95)
    rect(img, 16, 88, 96, 7, "STONE_SHADOW")
    rect(img, 16, 88, 96, 2, "STONE_BASE")
    rect(img, 16, 88, 96, 1, "STONE_LIGHT")

    # Half-timbered walls (x=20..108, y=46..90)
    rect(img, 20, 46, 88, 44, "PARCHMENT_BASE")
    rect(img, 20, 46, 88, 14, "PARCHMENT_LIGHT")

    # Timber framing posts and horizontal beams
    # Base timber
    rect(img, 20, 87, 88, 3, "WOOD_BASE")
    # Top timber
    rect(img, 20, 46, 88, 3, "WOOD_BASE")
    # Vertical timber posts
    for vx in (20, 48, 80, 106):
        rect(img, vx, 46, 3, 44, "WOOD_BASE")
        rect(img, vx, 46, 1, 44, "WOOD_LIGHT")

    # Arched oak front door (x=52..76, y=56..94)
    rect(img, 52, 56, 24, 38, "WOOD_BASE")
    ellipse(img, 63.5, 58.0, 12.0, 6.0, "WOOD_LIGHT", filled=True)
    rect(img, 63, 56, 2, 38, "WOOD_DEEP")
    # Brass door handle
    px(img, 66, 75, "GOLD_LIGHT")
    px(img, 66, 76, "GOLD_BASE")

    # 2 glowing lattice windows (x=26..44 and x=84..102, y=58..78)
    for wx in (26, 84):
        rect(img, wx, 58, 18, 20, "WOOD_SHADOW")
        rect(img, wx + 1, 59, 16, 18, "FLAME_YELLOW")
        rect(img, wx + 4, 62, 10, 12, "CREAM_LIGHT")
        # Mullions
        rect(img, wx + 8, 59, 2, 18, "WOOD_DEEP")
        rect(img, wx + 1, 67, 16, 2, "WOOD_DEEP")

    # Solid clay shingle roof (x=14..114, y=18..48)
    for ry in range(18, 48):
        inset = int((ry - 18) * (114 - 64) / 30)
        rx0 = max(14, 64 - inset)
        rx1 = min(114, 64 + inset)
        rect(img, rx0, ry, rx1 - rx0 + 1, 1, "ROAST_BASE")
        if ry % 4 == 0:
            rect(img, rx0, ry, rx1 - rx0 + 1, 1, "ROAST_SHADOW")
    line(img, 14, 48, 64, 18, "ROAST_LIGHT")
    line(img, 64, 18, 114, 48, "ROAST_SHADOW")

    # Stone chimney on right (x=88..100, y=8..40)
    rect(img, 88, 8, 12, 32, "STONE_BASE")
    rect(img, 88, 8, 2, 32, "STONE_LIGHT")
    rect(img, 98, 8, 2, 32, "STONE_SHADOW")

    # Wrought iron bracket + painted ale mug sign above door (x=60..68, y=44..54)
    rect(img, 61, 46, 6, 7, "ALE_BASE")
    rect(img, 61, 44, 6, 2, "CREAM_LIGHT")
    rect(img, 67, 47, 2, 4, "METAL_BASE")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_facade_t3() -> Image.Image:
    """128x96 Tier 3: Prosperous 2-story tavern with timber overhang, dormer, and cat sign."""
    img = new_canvas(128, 96)

    # Ground floor stone masonry (x=18..110, y=52..95)
    rect(img, 18, 52, 92, 43, "STONE_BASE")
    # Ashlar mortar courses
    for my in (60, 68, 76, 84, 91):
        rect(img, 18, my, 92, 1, "STONE_DEEP")

    # Grand arched double oak doors (x=50..78, y=58..94)
    ellipse(img, 63.5, 62.0, 14.0, 8.0, "STONE_LIGHT", filled=True)
    rect(img, 50, 62, 28, 32, "WOOD_BASE")
    rect(img, 63, 62, 2, 32, "WOOD_DEEP")
    # Wrought iron strap hinges
    for hy in (68, 84):
        rect(img, 51, hy, 11, 2, "METAL_SHADOW")
        rect(img, 66, hy, 11, 2, "METAL_SHADOW")

    # 2 bay windows with flower boxes (x=24..44 and x=84..104, y=60..80)
    for bx in (24, 84):
        rect(img, bx, 60, 20, 18, "WOOD_SHADOW")
        rect(img, bx + 2, 62, 16, 14, "FLAME_YELLOW")
        # Flower box underneath window
        rect(img, bx - 1, 78, 22, 5, "WOOD_DEEP")
        rect(img, bx - 1, 78, 22, 1, "WOOD_LIGHT")
        # Green foliage & red flowers
        for fx in range(bx, bx + 20, 3):
            px(img, fx, 77, "LEAF_BASE")
            px(img, fx + 1, 76, "POTION_RED")

    # Second floor overhang / jettying (x=14..114, y=26..54)
    # Overhang support corbel brackets
    for kx in (16, 36, 62, 90, 112):
        rect(img, kx, 50, 4, 4, "WOOD_LIGHT")
    # Whitewashed plaster with decorative cross-timbers
    rect(img, 14, 26, 100, 26, "PARCHMENT_LIGHT")
    # Timber framing
    rect(img, 14, 26, 100, 3, "WOOD_BASE")
    rect(img, 14, 49, 100, 3, "WOOD_BASE")
    for tx in (14, 38, 62, 86, 111):
        rect(img, tx, 26, 3, 26, "WOOD_BASE")
    # 3 second-story glowing windows
    for wx in (22, 46, 94):
        rect(img, wx, 32, 10, 12, "FLAME_YELLOW")
        rect(img, wx, 32, 10, 1, "WOOD_DEEP")

    # Steep tiled roof with center dormer (x=8..120, y=8..28)
    for ry in range(8, 28):
        inset = int((ry - 8) * (120 - 64) / 20)
        rx0 = max(8, 64 - inset)
        rx1 = min(120, 64 + inset)
        rect(img, rx0, ry, rx1 - rx0 + 1, 1, "CLOTH_RED_SHADOW")
    line(img, 8, 28, 64, 8, "CLOTH_RED_LIGHT")
    line(img, 64, 8, 120, 28, "CLOTH_RED_SHADOW")

    # Center dormer window (x=54..74, y=10..26)
    rect(img, 54, 14, 20, 12, "PARCHMENT_LIGHT")
    rect(img, 58, 16, 12, 10, "FLAME_YELLOW")
    # Dormer gable
    line(img, 52, 14, 64, 8, "ROAST_LIGHT")
    line(img, 64, 8, 76, 14, "ROAST_SHADOW")

    # Gilded cat emblem tavern sign on corner bracket (x=8..18, y=42..56)
    rect(img, 9, 44, 8, 8, "GOLD_BASE")
    rect(img, 9, 44, 8, 1, "GOLD_LIGHT")
    # Cat silhouette ears on sign
    px(img, 11, 42, "GOLD_LIGHT")
    px(img, 15, 42, "GOLD_LIGHT")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_facade_t4() -> Image.Image:
    """128x96 Tier 4: Grand two-story noble inn with clock spire, twin dormers, and crest."""
    img = new_canvas(128, 96)

    # Polished stone ground floor arcade (x=10..118, y=52..95)
    rect(img, 10, 52, 108, 43, "STONE_BASE")
    rect(img, 10, 52, 108, 2, "STONE_LIGHT")

    # Grand arched entry portal (x=44..84, y=54..94)
    ellipse(img, 63.5, 60.0, 20.0, 12.0, "STONE_LIGHT", filled=True)
    rect(img, 46, 60, 36, 34, "WOOD_DEEP")
    # Double carved oak doors with brass studs
    rect(img, 48, 64, 32, 30, "WOOD_BASE")
    rect(img, 63, 64, 2, 30, "WOOD_DEEP")
    for gy in (70, 78, 86):
        px(img, 54, gy, "GOLD_LIGHT")
        px(img, 72, gy, "GOLD_LIGHT")

    # Flanking glowing brass lanterns beside entry
    for lx in (40, 86):
        rect(img, lx, 64, 4, 8, "METAL_SHADOW")
        rect(img, lx + 1, 65, 2, 5, "FLAME_YELLOW")
        px(img, lx + 1, 66, "CREAM_LIGHT")

    # Grand multi-pane bay windows (x=16..38 and x=90..112, y=58..82)
    for bx in (16, 90):
        rect(img, bx, 58, 22, 24, "WOOD_DEEP")
        rect(img, bx + 2, 60, 18, 20, "FLAME_YELLOW")
        rect(img, bx + 4, 62, 14, 16, "CREAM_LIGHT")
        rect(img, bx + 10, 60, 2, 20, "GOLD_BASE")

    # Second floor with ornate carvings & gilded trim (x=8..120, y=24..54)
    rect(img, 8, 24, 112, 28, "PARCHMENT_LIGHT")
    # Gilded frieze belt
    rect(img, 8, 50, 112, 3, "GOLD_BASE")
    rect(img, 8, 50, 112, 1, "GOLD_LIGHT")
    # Second floor windows with crimson drapery
    for wx in (16, 36, 76, 96):
        rect(img, wx, 28, 16, 18, "CLOTH_RED_BASE")
        rect(img, wx + 3, 30, 10, 14, "FLAME_YELLOW")
        rect(img, wx, 28, 16, 2, "GOLD_BASE")

    # Grand crest above entrance: Nyah & Fifi feline crest (x=52..76, y=36..48)
    rect(img, 52, 36, 24, 12, "CLOTH_RED_BASE")
    rect(img, 52, 36, 24, 1, "GOLD_LIGHT")
    rect(img, 52, 47, 24, 1, "GOLD_LIGHT")
    # Feline ear crest silhouette
    px(img, 56, 34, "GOLD_LIGHT")
    px(img, 71, 34, "GOLD_LIGHT")
    rect(img, 58, 38, 12, 6, "CLOTH_ACCENT_BASE")

    # Mansard slate roof (x=6..122, y=8..26)
    rect(img, 6, 12, 116, 14, "STONE_SHADOW")
    rect(img, 6, 12, 116, 2, "STONE_BASE")

    # Center spire / cupola with feline weather vane (x=56..72, y=2..16)
    rect(img, 58, 8, 12, 8, "STONE_BASE")
    rect(img, 60, 10, 8, 6, "FLAME_YELLOW")
    # Spire needle & gilded vane
    line(img, 64, 8, 64, 2, "GOLD_BASE")
    px(img, 63, 2, "GOLD_LIGHT")
    px(img, 65, 2, "GOLD_LIGHT")

    # Twin dormers on left and right (x=24..38 and x=88..102, y=6..16)
    for dx in (24, 88):
        rect(img, dx, 8, 14, 8, "STONE_BASE")
        rect(img, dx + 2, 10, 10, 6, "FLAME_YELLOW")

    return finalize_prop(img, "OUTLINE_WARM")


def gen_tree_oak() -> Image.Image:
    """64x80 tavern yard leafy oak tree with gnarled trunk and roots."""
    img = new_canvas(64, 80)

    # Volumetric foliage clusters (x=4..60, y=2..56)
    leaf_clusters = [
        # (cx, cy, rx, ry)
        (32.0, 16.0, 18.0, 14.0),
        (18.0, 26.0, 14.0, 12.0),
        (46.0, 26.0, 14.0, 12.0),
        (22.0, 38.0, 16.0, 13.0),
        (42.0, 38.0, 16.0, 13.0),
        (32.0, 32.0, 15.0, 12.0),
    ]

    # Draw base foliage clusters
    for cx, cy, rx, ry in leaf_clusters:
        ellipse(img, cx, cy, rx, ry, "LEAF_BASE", filled=True)

    # Draw highlights (top-left) and shadows (bottom-right)
    for cx, cy, rx, ry in leaf_clusters:
        ellipse(img, cx - 3.0, cy - 3.0, rx * 0.7, ry * 0.7, "LEAF_LIGHT", filled=True)
        ellipse(img, cx + 2.0, cy + 3.0, rx * 0.6, ry * 0.6, "LEAF_SHADOW", filled=False)

    # Gnarled trunk and spreading roots (y=42..79, x=18..46)
    # Main trunk
    rect(img, 26, 42, 12, 28, "WOOD_BASE")
    rect(img, 26, 42, 3, 28, "WOOD_LIGHT")
    rect(img, 35, 42, 3, 28, "WOOD_SHADOW")
    # Bark grooves
    line(img, 30, 44, 29, 68, "WOOD_DEEP")
    line(img, 33, 46, 34, 70, "WOOD_SHADOW")

    # Spreading buttress roots anchoring into ground
    # Left root
    line(img, 26, 66, 18, 79, "WOOD_BASE")
    line(img, 27, 66, 19, 79, "WOOD_LIGHT")
    line(img, 28, 66, 20, 79, "WOOD_SHADOW")
    # Right root
    line(img, 37, 66, 45, 79, "WOOD_SHADOW")
    line(img, 36, 66, 44, 79, "WOOD_DEEP")
    # Center taproot
    rect(img, 29, 70, 7, 9, "WOOD_BASE")
    rect(img, 29, 70, 2, 9, "WOOD_LIGHT")
    rect(img, 34, 70, 2, 9, "WOOD_SHADOW")

    # Apply leaf outline to top canopy
    for y in range(0, 52):
        for x in range(0, 64):
            cur = img.getpixel((x, y))
            if cur[3] == 255 and cur not in OUTLINE_RGBA_SET:
                # Check if touching transparency
                exposed = (
                    x == 0 or x == 63 or y == 0 or
                    any(img.getpixel((x + dx, y + dy))[3] == 0 for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)))
                )
                if exposed:
                    img.putpixel((x, y), col("OUTLINE_LEAF"))

    return finalize_prop(img, "OUTLINE_WARM")


def gen_bush_berry() -> Image.Image:
    """32x28 tavern garden berry bush with ripe red berries."""
    img = new_canvas(32, 28)

    # Rounded foliage masses
    ellipse(img, 15.5, 14.0, 13.0, 10.0, "LEAF_BASE", filled=True)
    ellipse(img, 12.0, 11.0, 9.0, 7.0, "LEAF_LIGHT", filled=True)
    ellipse(img, 18.0, 17.0, 9.0, 6.0, "LEAF_SHADOW", filled=False)

    # Ripe red berries sprinkled across bush
    berries = [
        (8, 12), (12, 8), (17, 10), (22, 12),
        (10, 18), (15, 16), (20, 17), (24, 16),
        (14, 21), (18, 22)
    ]
    for bx, by in berries:
        px(img, bx, by, "POTION_RED")
        px(img, bx, by - 1, "CLOTH_RED_LIGHT")

    # Stem at base (y=24..27, x=14..18)
    rect(img, 15, 24, 2, 4, "WOOD_DEEP")

    # Pre-outline foliage with OUTLINE_LEAF
    for y in range(28):
        for x in range(32):
            cur = img.getpixel((x, y))
            if cur[3] == 255 and cur not in OUTLINE_RGBA_SET:
                exposed = (
                    x == 0 or x == 31 or y == 0 or y == 27 or
                    any(img.getpixel((x + dx, y + dy))[3] == 0 for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)))
                )
                if exposed:
                    img.putpixel((x, y), col("OUTLINE_LEAF"))

    return finalize_prop(img, "OUTLINE_LEAF")


def gen_lamppost() -> Image.Image:
    """24x64 cast iron tavern street lamp with glowing lantern."""
    img = new_canvas(24, 64)

    # Cast iron pedestal base (y=50..63, x=6..18)
    rect(img, 8, 50, 8, 4, "METAL_BASE")
    rect(img, 8, 50, 2, 4, "METAL_LIGHT")
    rect(img, 6, 54, 12, 9, "METAL_SHADOW")
    rect(img, 6, 54, 3, 9, "METAL_BASE")
    rect(img, 6, 54, 12, 1, "METAL_LIGHT")
    rect(img, 5, 61, 14, 3, "METAL_SHADOW")
    rect(img, 5, 61, 14, 1, "METAL_LIGHT")

    # Fluted vertical post / shaft (y=22..50, x=10..14)
    rect(img, 10, 22, 4, 28, "METAL_SHADOW")
    rect(img, 10, 22, 1, 28, "METAL_LIGHT")
    rect(img, 11, 22, 1, 28, "METAL_BASE")

    # Ornamental rings on shaft
    for ry in (30, 40):
        rect(img, 9, ry, 6, 2, "METAL_BASE")
        rect(img, 9, ry, 2, 2, "METAL_LIGHT")

    # Lantern bracket arms (y=18..24)
    line(img, 7, 24, 12, 21, "METAL_BASE")
    line(img, 17, 24, 12, 21, "METAL_SHADOW")

    # Hexagonal glass lantern housing (x=5..19, y=6..22)
    # Lantern base & cap
    rect(img, 7, 20, 10, 2, "METAL_BASE")
    rect(img, 6, 8, 12, 2, "METAL_BASE")
    rect(img, 6, 8, 12, 1, "METAL_LIGHT")

    # Glass panes with glowing flame inside (x=7..17, y=10..20)
    rect(img, 7, 10, 10, 10, "FLAME_ORANGE")
    rect(img, 9, 11, 6, 8, "FLAME_YELLOW")
    rect(img, 11, 13, 2, 4, "CREAM_LIGHT")

    # Metal corner struts
    rect(img, 7, 10, 1, 10, "METAL_SHADOW")
    rect(img, 16, 10, 1, 10, "METAL_SHADOW")
    rect(img, 11, 10, 2, 10, "METAL_BASE")

    # Top pointed iron cap and finial spire (y=3..8, x=9..15)
    ellipse(img, 11.5, 7.0, 3.5, 2.0, "METAL_LIGHT", filled=True)
    line(img, 11, 6, 11, 3, "METAL_LIGHT")
    line(img, 12, 6, 12, 3, "METAL_BASE")

    return finalize_prop(img, "OUTLINE_COOL")


# =============================================================================
# Registry: PROPS_STRUCTURE_FURNITURE
# =============================================================================

PROPS_STRUCTURE_FURNITURE: dict[str, AssetSpec] = {
    # Tileable Floors (32x32, footprint=(1,1), layer="floor", tileable=True)
    "floor_wood_planks": AssetSpec(
        fn=gen_floor_wood_planks,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),
    "floor_stone": AssetSpec(
        fn=gen_floor_stone,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),
    "floor_kitchen": AssetSpec(
        fn=gen_floor_kitchen,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),
    "floor_cellar": AssetSpec(
        fn=gen_floor_cellar,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),
    "floor_grass": AssetSpec(
        fn=gen_floor_grass,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),
    "floor_cobble": AssetSpec(
        fn=gen_floor_cobble,
        footprint=(1, 1),
        layer="floor",
        tileable=True,
    ),

    # Tileable Walls (32x64, footprint=(1,2), layer="wall", tileable=True)
    "wall_timber_mid": AssetSpec(
        fn=gen_wall_timber_mid,
        footprint=(1, 2),
        layer="wall",
        tileable=True,
    ),
    "wall_timber_window": AssetSpec(
        fn=gen_wall_timber_window,
        footprint=(1, 2),
        layer="wall",
        tileable=True,
    ),
    "wall_stone_mid": AssetSpec(
        fn=gen_wall_stone_mid,
        footprint=(1, 2),
        layer="wall",
        tileable=True,
    ),
    "wall_corner_l": AssetSpec(
        fn=gen_wall_corner_l,
        footprint=(1, 2),
        layer="wall",
        tileable=True,
    ),
    "wall_corner_r": AssetSpec(
        fn=gen_wall_corner_r,
        footprint=(1, 2),
        layer="wall",
        tileable=True,
    ),

    # Doors & Stairs (layer="prop")
    "door_front": AssetSpec(
        fn=gen_door_front,
        footprint=(2, 1),
        layer="prop",
    ),
    "door_front_open": AssetSpec(
        fn=gen_door_front_open,
        footprint=(2, 1),
        layer="prop",
    ),
    "stairs_up": AssetSpec(
        fn=gen_stairs_up,
        footprint=(2, 2),
        layer="prop",
    ),
    "stairs_down": AssetSpec(
        fn=gen_stairs_down,
        footprint=(2, 2),
        layer="prop",
    ),

    # Seating & Storage (layer="prop")
    "chair": AssetSpec(
        fn=gen_chair,
        footprint=(1, 1),
        layer="prop",
    ),
    "chair_s": AssetSpec(
        fn=gen_chair_s,
        footprint=(1, 1),
        layer="prop",
    ),
    "chair_n": AssetSpec(
        fn=gen_chair_n,
        footprint=(1, 1),
        layer="prop",
    ),
    "chair_e": AssetSpec(
        fn=gen_chair_e,
        footprint=(1, 1),
        layer="prop",
    ),
    "chair_w": AssetSpec(
        fn=gen_chair_w,
        footprint=(1, 1),
        layer="prop",
    ),
    "stool": AssetSpec(
        fn=gen_stool,
        footprint=(1, 1),
        layer="prop",
    ),
    "stool_s": AssetSpec(
        fn=gen_stool_s,
        footprint=(1, 1),
        layer="prop",
    ),
    "stool_n": AssetSpec(
        fn=gen_stool_n,
        footprint=(1, 1),
        layer="prop",
    ),
    "stool_e": AssetSpec(
        fn=gen_stool_e,
        footprint=(1, 1),
        layer="prop",
    ),
    "stool_w": AssetSpec(
        fn=gen_stool_w,
        footprint=(1, 1),
        layer="prop",
    ),
    "bench": AssetSpec(
        fn=gen_bench,
        footprint=(2, 1),
        layer="prop",
    ),
    "bench_s": AssetSpec(
        fn=gen_bench_s,
        footprint=(2, 1),
        layer="prop",
    ),
    "bench_n": AssetSpec(
        fn=gen_bench_n,
        footprint=(2, 1),
        layer="prop",
    ),
    "bench_e": AssetSpec(
        fn=gen_bench_e,
        footprint=(1, 2),
        layer="prop",
    ),
    "bench_w": AssetSpec(
        fn=gen_bench_w,
        footprint=(1, 2),
        layer="prop",
    ),
    "chest": AssetSpec(
        fn=gen_chest,
        footprint=(1, 1),
        layer="prop",
    ),
    "crates_sacks": AssetSpec(
        fn=gen_crates_sacks,
        footprint=(2, 1),
        layer="prop",
    ),
    "shelves_bottles": AssetSpec(
        fn=gen_shelves_bottles,
        footprint=(2, 1),
        layer="prop",
    ),

    # 4 Visual Table Tiers (64x48, footprint=(2,2), layer="prop")
    "table_t1_bare": AssetSpec(
        fn=gen_table_t1_bare,
        footprint=(2, 2),
        layer="prop",
    ),
    "table_t2_polished": AssetSpec(
        fn=gen_table_t2_polished,
        footprint=(2, 2),
        layer="prop",
    ),
    "table_t3_clothed": AssetSpec(
        fn=gen_table_t3_clothed,
        footprint=(2, 2),
        layer="prop",
    ),
    "table_t4_ornate": AssetSpec(
        fn=gen_table_t4_ornate,
        footprint=(2, 2),
        layer="prop",
    ),

    # 2 Guest Bed Tiers (48x56, footprint=(2,2), layer="prop")
    "bed_t1": AssetSpec(
        fn=gen_bed_t1,
        footprint=(2, 2),
        layer="prop",
    ),
    "bed_t2": AssetSpec(
        fn=gen_bed_t2,
        footprint=(2, 2),
        layer="prop",
    ),

    # Exterior & Diorama (layer="exterior")
    "facade_t1": AssetSpec(
        fn=gen_facade_t1,
        footprint=(4, 2),
        layer="exterior",
    ),
    "facade_t2": AssetSpec(
        fn=gen_facade_t2,
        footprint=(4, 2),
        layer="exterior",
    ),
    "facade_t3": AssetSpec(
        fn=gen_facade_t3,
        footprint=(4, 2),
        layer="exterior",
    ),
    "facade_t4": AssetSpec(
        fn=gen_facade_t4,
        footprint=(4, 2),
        layer="exterior",
    ),
    "tree_oak": AssetSpec(
        fn=gen_tree_oak,
        footprint=(2, 1),
        layer="exterior",
    ),
    "bush_berry": AssetSpec(
        fn=gen_bush_berry,
        footprint=(1, 1),
        layer="exterior",
    ),
    "lamppost": AssetSpec(
        fn=gen_lamppost,
        footprint=(1, 1),
        layer="exterior",
    ),
}
