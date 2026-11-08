"""Core tavern props for Nyah & Fifi's Tavern.

Defines the 12 original required tavern assets (with rug_red split into 4 quadrants):
- fireplace_1 (64x80, prop)
- bar_counter_taps (96x56, prop)
- keg_rack (64x56, prop)
- table_round (64x48, prop)
- roast_chicken_platter (32x24, tabletop)
- ale_tray_three (28x22, tabletop)
- potion_display (64x64, prop)
- armor_stand (32x56, prop)
- sign_tavern (40x40, prop, hangs=True)
- quest_board_full (64x56, prop)
- drying_rack_herbs (48x32, prop, hangs=True)
- rug_red_tl, rug_red_tr, rug_red_bl, rug_red_br (32x32 each, rug, multi_group="rug_red")
"""

from __future__ import annotations
import math
from PIL import Image

from tools.palette import col
from tools.draw_helpers import (
    AssetSpec,
    draw_mug_unit,
    new_canvas,
    rect,
    line,
    ellipse,
    dither,
    px,
    outline,
    finalize_prop,
)


def gen_fireplace_1() -> Image.Image:
    """Stone chimney & arch, dark hearth, logs, 3-tone flame, wood mantelpiece."""
    img = new_canvas(64, 80)

    # 1. Stone Chimney (top section, x=16..47, y=4..28)
    # Flue cap molding
    rect(img, 14, 4, 36, 4, "STONE_BASE")
    rect(img, 14, 4, 36, 1, "STONE_LIGHT")
    rect(img, 14, 7, 36, 1, "STONE_SHADOW")

    # Stack
    rect(img, 16, 8, 32, 20, "STONE_BASE")
    for cy in range(8, 28, 4):
        rect(img, 16, cy, 32, 1, "STONE_SHADOW")
        offset = 0 if (cy // 4) % 2 == 0 else 4
        for cx in range(16 + offset, 48, 8):
            rect(img, cx, cy, 1, 4, "STONE_SHADOW")
            if cx + 1 < 48:
                px(img, cx + 1, cy + 1, "STONE_LIGHT")
    # Left highlight, right shadow
    rect(img, 16, 8, 1, 20, "STONE_LIGHT")
    rect(img, 47, 8, 1, 20, "STONE_SHADOW")

    # 2. Wood Mantelpiece (heavy carved timber shelf, x=8..55, y=28..36)
    rect(img, 8, 28, 48, 3, "WOOD_LIGHT")
    rect(img, 10, 29, 44, 1, "WOOD_BASE")
    rect(img, 8, 31, 48, 3, "WOOD_BASE")
    rect(img, 8, 34, 48, 1, "WOOD_SHADOW")
    rect(img, 8, 35, 48, 1, "WOOD_DEEP")
    # Corbels / support brackets
    rect(img, 10, 36, 4, 4, "WOOD_SHADOW")
    rect(img, 10, 36, 1, 4, "WOOD_BASE")
    rect(img, 50, 36, 4, 4, "WOOD_DEEP")
    rect(img, 50, 36, 1, 4, "WOOD_SHADOW")

    # 3. Stone Fireplace Breast & Pillars (x=8..55, y=36..75)
    # Left pillar
    rect(img, 8, 36, 13, 39, "STONE_BASE")
    # Right pillar
    rect(img, 43, 36, 13, 39, "STONE_BASE")
    for py in range(36, 75, 5):
        rect(img, 8, py, 13, 1, "STONE_SHADOW")
        rect(img, 43, py, 13, 1, "STONE_SHADOW")
        rect(img, 8, py + 1, 13, 1, "STONE_LIGHT")
        rect(img, 43, py + 1, 13, 1, "STONE_LIGHT")
    for py in range(36, 75, 10):
        rect(img, 14, py + 1, 1, 4, "STONE_SHADOW")
    for py in range(41, 75, 10):
        rect(img, 49, py + 1, 1, 4, "STONE_SHADOW")
    rect(img, 8, 36, 1, 39, "STONE_LIGHT")
    rect(img, 20, 36, 1, 39, "STONE_SHADOW")
    rect(img, 43, 36, 1, 39, "STONE_SHADOW")
    rect(img, 55, 36, 1, 39, "STONE_DEEP")

    # Stone Arch across the opening (x=21..42, y=36..44)
    rect(img, 21, 36, 22, 8, "STONE_BASE")
    for ax in range(21, 43):
        dist = abs(ax - 31.5) / 10.5
        arch_top = int(41 + dist * dist * 3)
        for ay in range(arch_top, 45):
            px(img, ax, ay, "STONE_DEEP")
    # Keystone
    rect(img, 30, 35, 4, 8, "STONE_LIGHT")
    rect(img, 31, 36, 2, 7, "STONE_BASE")
    px(img, 33, 42, "STONE_SHADOW")

    # 4. Hearth Interior Cavity (x=21..42, y=44..74)
    rect(img, 21, 44, 22, 31, "STONE_DEEP")
    for by in range(47, 73, 4):
        rect(img, 22, by, 20, 1, "STONE_SHADOW")
        rect(img, 28, by, 8, 1, "FLAME_EMBER")

    # Fireplace Grate & Andirons
    rect(img, 23, 71, 18, 2, "METAL_SHADOW")
    rect(img, 23, 71, 18, 1, "METAL_BASE")
    rect(img, 24, 63, 2, 9, "METAL_BASE")
    rect(img, 23, 61, 4, 2, "METAL_LIGHT")
    rect(img, 38, 63, 2, 9, "METAL_SHADOW")
    rect(img, 37, 61, 4, 2, "METAL_BASE")

    # Firewood Logs
    rect(img, 24, 69, 16, 4, "WOOD_SHADOW")
    rect(img, 25, 70, 14, 2, "WOOD_BASE")
    px(img, 24, 70, "WOOD_DEEP")
    px(img, 39, 70, "WOOD_DEEP")
    line(img, 26, 68, 37, 65, "WOOD_BASE")
    line(img, 26, 69, 37, 66, "WOOD_LIGHT")

    # Glowing 3-tone Flame (FLAME_EMBER, FLAME_ORANGE, FLAME_YELLOW)
    rect(img, 26, 67, 12, 3, "FLAME_EMBER")
    rect(img, 27, 68, 10, 2, "FLAME_ORANGE")
    # Left flame tongue
    for fy in range(54, 67):
        w = max(1, 4 - (67 - fy) // 3)
        rect(img, 27, fy, w, 1, "FLAME_ORANGE")
    rect(img, 28, 57, 2, 8, "FLAME_YELLOW")
    px(img, 27, 54, "FLAME_YELLOW")
    # Center tall tongue
    for fy in range(48, 67):
        w = max(2, 6 - (67 - fy) // 3)
        rect(img, 30, fy, w, 1, "FLAME_ORANGE")
    rect(img, 31, 52, 4, 12, "FLAME_YELLOW")
    rect(img, 32, 48, 2, 5, "FLAME_YELLOW")
    # Right flame tongue
    for fy in range(53, 67):
        w = max(1, 4 - (67 - fy) // 3)
        rect(img, 35, fy, w, 1, "FLAME_ORANGE")
    rect(img, 35, 56, 2, 9, "FLAME_YELLOW")
    px(img, 36, 53, "FLAME_YELLOW")
    rect(img, 29, 61, 6, 6, "FLAME_YELLOW")

    # 5. Stone Hearth Apron / Curb (x=6..57, y=75..79)
    rect(img, 6, 75, 52, 5, "STONE_BASE")
    rect(img, 6, 75, 52, 1, "STONE_LIGHT")
    rect(img, 6, 76, 1, 4, "STONE_LIGHT")
    rect(img, 57, 76, 1, 4, "STONE_DEEP")
    for sx in (18, 31, 44):
        rect(img, sx, 76, 1, 4, "STONE_SHADOW")
    rect(img, 6, 79, 52, 1, "STONE_SHADOW")

    img = outline(img, "OUTLINE_COOL")
    return finalize_prop(img, "OUTLINE_COOL", hangs=False)


def gen_bar_counter_taps() -> Image.Image:
    """Polished wood bar counter, bevel top, 3 panels, foot rail, 3 taps."""
    img = new_canvas(96, 56)

    # 1. Countertop (x=3..92, y=14..29)
    rect(img, 3, 14, 90, 12, "WOOD_BASE")
    rect(img, 3, 14, 90, 1, "WOOD_LIGHT")
    rect(img, 3, 14, 1, 12, "WOOD_LIGHT")
    rect(img, 92, 14, 1, 12, "WOOD_SHADOW")
    dither(img, (5, 16, 86, 8), "WOOD_BASE", "WOOD_LIGHT", "wood_grain")

    # Front bevel / bullnose rim
    rect(img, 2, 25, 92, 1, "WOOD_LIGHT")
    rect(img, 2, 26, 92, 3, "WOOD_BASE")
    rect(img, 2, 29, 92, 1, "WOOD_SHADOW")
    rect(img, 4, 30, 88, 1, "WOOD_DEEP")

    # 2. Beer Taps & Drip Tray
    # Recessed drip tray
    rect(img, 29, 18, 38, 7, "METAL_BASE")
    rect(img, 30, 19, 36, 5, "METAL_SHADOW")
    for ty in (20, 22):
        rect(img, 31, ty, 34, 1, "METAL_BASE")

    # Broad gleaming brass draft bridge
    rect(img, 33, 9, 30, 3, "GOLD_BASE")
    rect(img, 33, 9, 30, 1, "GOLD_LIGHT")
    rect(img, 35, 11, 4, 8, "GOLD_BASE")
    rect(img, 35, 11, 1, 8, "GOLD_LIGHT")
    rect(img, 57, 11, 4, 8, "GOLD_BASE")
    rect(img, 57, 11, 1, 8, "GOLD_LIGHT")

    # 3 Distinct Spaced Faucets & Tap Handles
    for tx, hy, handle_col in [
        (37, 3, "CLOTH_RED_BASE"),
        (47, 2, "POTION_GREEN"),
        (57, 3, "CLOTH_ACCENT_BASE"),
    ]:
        rect(img, tx, 10, 2, 6, "GOLD_LIGHT")
        rect(img, tx - 1, 15, 2, 3, "METAL_LIGHT")
        rect(img, tx, hy + 1, 3, 6, handle_col)
        px(img, tx, hy + 1, "CREAM_LIGHT")
        rect(img, tx, hy, 3, 1, "GOLD_LIGHT")

    # Freshly poured frothy mug resting on the bar top to the right
    draw_mug_unit(img, 73, 14, foamy=True)

    # 3. Front Panels (3 bays for 3 tiles)
    rect(img, 4, 31, 88, 21, "WOOD_BASE")
    for bx in (7, 36, 65):
        bw = 24
        # Frame
        rect(img, bx, 33, bw, 1, "WOOD_LIGHT")
        rect(img, bx, 33, 1, 16, "WOOD_LIGHT")
        rect(img, bx, 48, bw, 1, "WOOD_SHADOW")
        rect(img, bx + bw - 1, 33, 1, 16, "WOOD_SHADOW")
        # Recessed insert
        rect(img, bx + 2, 35, bw - 4, 12, "WOOD_SHADOW")
        rect(img, bx + 2, 35, bw - 4, 1, "WOOD_DEEP")
        rect(img, bx + 2, 35, 1, 12, "WOOD_DEEP")
        rect(img, bx + 3, 46, bw - 5, 1, "WOOD_BASE")

    # Pilasters between bays
    for px_pos in (32, 61):
        rect(img, px_pos, 31, 3, 20, "WOOD_BASE")
        rect(img, px_pos, 31, 1, 20, "WOOD_LIGHT")
        rect(img, px_pos + 2, 31, 1, 20, "WOOD_SHADOW")

    # 4. Polished Brass Foot Rail
    rect(img, 6, 49, 84, 1, "GOLD_LIGHT")
    rect(img, 6, 50, 84, 1, "GOLD_BASE")
    rect(img, 6, 51, 84, 1, "WOOD_DEEP")
    for brk_x in (10, 33, 62, 85):
        rect(img, brk_x, 49, 2, 4, "GOLD_BASE")
        px(img, brk_x, 49, "GOLD_LIGHT")

    # Plinth / Kickboard
    rect(img, 4, 52, 88, 4, "WOOD_DEEP")
    rect(img, 5, 52, 86, 1, "WOOD_SHADOW")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def _draw_keg_unit(img: Image.Image, x: int, y: int, w: int = 26, h: int = 20) -> None:
    """Draw a detailed front-facing oak keg with iron hoops and brass spigot."""
    cx = x + w // 2
    cy = y + h // 2

    # Barrel belly curvature
    for py in range(y, y + h):
        dy = abs(py - cy)
        inset = 2 if dy > h // 2 - 2 else (1 if dy > h // 2 - 4 else 0)
        rect(img, x + inset, py, w - 2 * inset, 1, "WOOD_BASE")
    rect(img, x + 3, y + 1, w - 6, 2, "WOOD_LIGHT")
    rect(img, x + 3, y + h - 3, w - 6, 2, "WOOD_SHADOW")

    # Outer iron hoops
    for py in range(y + 1, y + h - 1):
        dy = abs(py - cy)
        inset = 2 if dy > h // 2 - 2 else (1 if dy > h // 2 - 4 else 0)
        px(img, x + 2 + inset, py, "METAL_BASE")
        px(img, x + w - 3 - inset, py, "METAL_SHADOW")
    px(img, x + 3, y + 2, "METAL_LIGHT")

    # Front circular barrel head
    ellipse(img, cx, cy, 8.5, 7.5, "METAL_BASE", filled=True)
    ellipse(img, cx, cy, 7.0, 6.0, "WOOD_BASE", filled=True)
    # Stave joints
    line(img, cx - 3, cy - 4, cx - 3, cy + 4, "WOOD_SHADOW")
    line(img, cx + 3, cy - 4, cx + 3, cy + 4, "WOOD_SHADOW")
    ellipse(img, cx - 1, cy - 1, 5.0, 4.0, "WOOD_LIGHT", filled=False)

    # Brass spigot in center
    rect(img, cx - 1, cy, 3, 2, "GOLD_BASE")
    px(img, cx, cy - 1, "GOLD_LIGHT")
    px(img, cx, cy + 2, "GOLD_BASE")
    px(img, cx - 1, cy, "GOLD_LIGHT")


def gen_keg_rack() -> Image.Image:
    """Timber A-frame rack holding 3 stacked barrels (2 bottom, 1 top) with spigots."""
    img = new_canvas(64, 56)

    # Timber A-Frame Stanchions (behind/around barrels)
    for row in range(7, 56):
        t = (row - 7) / 48.0
        # Left slanted leg
        lx = int(round(16 * (1.0 - t) + 4 * t))
        rect(img, lx, row, 4, 1, "WOOD_BASE")
        px(img, lx, row, "WOOD_LIGHT")
        # Right slanted leg
        rx = int(round(44 * (1.0 - t) + 56 * t))
        rect(img, rx, row, 4, 1, "WOOD_SHADOW")
        px(img, rx + 3, row, "WOOD_DEEP")

    # Cross support beams
    rect(img, 14, 29, 36, 4, "WOOD_BASE")
    rect(img, 14, 29, 36, 1, "WOOD_LIGHT")
    rect(img, 14, 32, 36, 1, "WOOD_SHADOW")

    # 3 Barrels: Top center, Bottom left, Bottom right
    _draw_keg_unit(img, 19, 8, 26, 20)
    _draw_keg_unit(img, 5, 29, 26, 20)
    _draw_keg_unit(img, 33, 29, 26, 20)

    # Bottom support chocks and skid base
    for chk_x in (6, 25, 34, 53):
        rect(img, chk_x, 49, 4, 6, "WOOD_SHADOW")
        px(img, chk_x, 49, "WOOD_BASE")
    rect(img, 4, 52, 56, 4, "WOOD_DEEP")
    rect(img, 5, 52, 54, 1, "WOOD_SHADOW")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def gen_table_round() -> Image.Image:
    """3/4 oval oak tabletop, south bevel rim, central pedestal, 4 splayed feet."""
    img = new_canvas(64, 48)

    cx = 31.5
    cy = 15.5
    rx = 26.0
    ry = 11.0

    # 1. Oval Tabletop Surface
    ellipse(img, cx, cy, rx, ry, "WOOD_BASE", filled=True)
    # Highlights on upper quadrant
    ellipse(img, cx - 1, cy - 1, rx - 2, ry - 2, "WOOD_LIGHT", filled=False)
    # Plank lines across table
    for py in (11, 16, 20):
        for px_pos in range(int(cx - rx) + 3, int(cx + rx) - 2):
            nx = (px_pos - cx) / rx
            ny = (py - cy) / ry
            if nx * nx + ny * ny <= 0.88:
                px(img, px_pos, py, "WOOD_SHADOW")

    # 2. South Rim (thick bevel edge viewed in 3/4 top-down)
    for px_pos in range(int(cx - rx) + 1, int(cx + rx)):
        dx = (px_pos - cx) / rx
        if dx * dx < 1.0:
            top_y = cy + ry * math.sqrt(1.0 - dx * dx)
            iy = int(math.floor(top_y))
            # 5px thick vertical rim
            for dy in range(6):
                yy = iy + dy
                c = "WOOD_BASE" if dy < 2 else ("WOOD_SHADOW" if dy < 4 else "WOOD_DEEP")
                if px_pos < cx and dy < 2:
                    c = "WOOD_LIGHT"
                px(img, px_pos, yy, c)

    # 3. Central Turned Pedestal (x=27..36, y=28..40)
    # Top neck
    rect(img, 29, 28, 6, 4, "WOOD_SHADOW")
    # Swelling baluster
    rect(img, 27, 32, 10, 5, "WOOD_BASE")
    rect(img, 27, 32, 2, 5, "WOOD_LIGHT")
    rect(img, 35, 32, 2, 5, "WOOD_SHADOW")
    # Lower collar
    rect(img, 28, 37, 8, 4, "WOOD_SHADOW")

    # 4. Splayed Feet
    # Background North-West / North-East feet
    line(img, 28, 38, 20, 42, "WOOD_SHADOW")
    line(img, 35, 38, 43, 42, "WOOD_DEEP")
    # Foreground South-West foot (curves down to y=47)
    line(img, 28, 40, 22, 44, "WOOD_BASE")
    line(img, 22, 44, 15, 47, "WOOD_BASE")
    line(img, 28, 41, 22, 45, "WOOD_LIGHT")
    line(img, 22, 45, 15, 47, "WOOD_LIGHT")
    rect(img, 13, 46, 3, 2, "WOOD_BASE")

    # Foreground South-East foot (curves down to y=47)
    line(img, 35, 40, 41, 44, "WOOD_SHADOW")
    line(img, 41, 44, 48, 47, "WOOD_SHADOW")
    line(img, 35, 41, 41, 45, "WOOD_BASE")
    line(img, 41, 45, 48, 47, "WOOD_BASE")
    rect(img, 48, 46, 3, 2, "WOOD_SHADOW")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def gen_roast_chicken_platter() -> Image.Image:
    """Silver platter, roasted whole chicken, drumsticks with bone knobs, garnish."""
    img = new_canvas(32, 24)

    # 1. Oval Platter (cx=15.5, cy=13.5, rx=13, ry=7)
    ellipse(img, 15.5, 13.5, 13.0, 7.0, "METAL_BASE", filled=True)
    ellipse(img, 15.5, 13.5, 13.0, 7.0, "METAL_SHADOW", filled=False)
    ellipse(img, 15.0, 13.0, 12.0, 6.0, "CREAM_LIGHT", filled=False)
    ellipse(img, 15.5, 13.5, 10.0, 5.0, "METAL_SHADOW", filled=True)

    # 2. Roast Chicken Body
    ellipse(img, 15.5, 13.0, 6.5, 4.5, "ROAST_BASE", filled=True)
    ellipse(img, 14.5, 11.5, 4.5, 3.0, "ROAST_LIGHT", filled=True)
    line(img, 15, 10, 15, 15, "ROAST_SHADOW")
    px(img, 13, 13, "ROAST_SHADOW")
    px(img, 17, 13, "ROAST_SHADOW")

    # 3. Drumsticks
    # Left leg
    rect(img, 10, 14, 4, 3, "ROAST_BASE")
    line(img, 10, 15, 7, 17, "CREAM_LIGHT")
    rect(img, 6, 17, 2, 2, "CREAM_LIGHT")
    # Right leg
    rect(img, 17, 14, 4, 3, "ROAST_BASE")
    line(img, 20, 15, 23, 17, "CREAM_LIGHT")
    rect(img, 23, 17, 2, 2, "CREAM_LIGHT")

    # 4. Garnish (parsley / herbs & roasted red tomato)
    px(img, 6, 12, "LEAF_LIGHT")
    px(img, 7, 12, "LEAF_BASE")
    px(img, 6, 13, "LEAF_SHADOW")

    px(img, 23, 11, "LEAF_LIGHT")
    px(img, 24, 11, "LEAF_BASE")
    px(img, 24, 12, "LEAF_SHADOW")

    px(img, 11, 18, "LEAF_LIGHT")
    px(img, 12, 18, "LEAF_BASE")
    px(img, 18, 18, "LEAF_BASE")
    px(img, 19, 18, "LEAF_LIGHT")

    # Roasted apple / tomato
    rect(img, 13, 9, 2, 2, "CLOTH_RED_BASE")
    px(img, 13, 9, "CLOTH_RED_LIGHT")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def gen_ale_tray_three() -> Image.Image:
    """Wooden serving tray with brass gallery holding 3 frothy ale mugs."""
    img = new_canvas(28, 22)

    # 1. Oval Tray with Brass Rim (cx=13.5, cy=14.5, rx=12, ry=6)
    ellipse(img, 13.5, 14.5, 12.0, 6.0, "GOLD_BASE", filled=True)
    ellipse(img, 13.5, 14.5, 10.5, 4.5, "WOOD_BASE", filled=True)
    ellipse(img, 13.0, 14.0, 11.5, 5.5, "GOLD_LIGHT", filled=False)
    # Handles
    px(img, 1, 14, "GOLD_LIGHT")
    px(img, 1, 15, "GOLD_BASE")
    px(img, 26, 14, "GOLD_LIGHT")
    px(img, 26, 15, "GOLD_BASE")

    # 2. Three Mugs (Back-left, Back-right, Front-center)
    def _draw_mini_mug(mx: int, my: int, foamy_overflow: bool = False) -> None:
        # Handle on right
        rect(img, mx + 5, my + 3, 2, 4, "WOOD_SHADOW")
        px(img, mx + 5, my + 4, "WOOD_BASE")
        # Mug body
        rect(img, mx + 1, my + 2, 4, 6, "ALE_BASE")
        rect(img, mx + 1, my + 2, 2, 5, "ALE_LIGHT")
        rect(img, mx + 1, my + 7, 4, 1, "WOOD_SHADOW")
        # Froth
        rect(img, mx + 1, my, 4, 2, "CREAM_LIGHT")
        px(img, mx + 4, my + 1, "CREAM_SHADOW")
        if foamy_overflow:
            px(img, mx + 1, my + 2, "CREAM_LIGHT")
            px(img, mx + 1, my + 3, "CREAM_LIGHT")

    _draw_mini_mug(4, 4)
    _draw_mini_mug(16, 4)
    _draw_mini_mug(10, 8, foamy_overflow=True)

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def _draw_potion_flask(
    img: Image.Image,
    x: int,
    y: int,
    color: str,
    bottle_type: int = 0,
) -> None:
    """Draw one of several distinct potion bottle shapes with cork and highlights."""
    if bottle_type == 0:
        # Round alembic flask
        rect(img, x + 2, y, 2, 2, "WOOD_LIGHT")
        rect(img, x + 2, y + 2, 2, 2, "CREAM_SHADOW")
        ellipse(img, x + 2.5, y + 7.5, 3.0, 3.0, color, filled=True)
        px(img, x + 1, y + 6, "CREAM_LIGHT")
        px(img, x + 1, y + 7, "CREAM_LIGHT")
    elif bottle_type == 1:
        # Square apothecary vial
        rect(img, x + 2, y, 2, 1, "WOOD_LIGHT")
        rect(img, x + 2, y + 1, 2, 2, "CREAM_SHADOW")
        rect(img, x + 1, y + 3, 4, 8, color)
        rect(img, x + 1, y + 3, 1, 7, "CREAM_LIGHT")
        rect(img, x + 4, y + 3, 1, 8, "WOOD_DEEP")
    elif bottle_type == 2:
        # Triangular conical flask
        rect(img, x + 2, y, 2, 1, "WOOD_LIGHT")
        rect(img, x + 2, y + 1, 2, 2, "CREAM_SHADOW")
        line(img, x + 2, y + 3, x, y + 10, color)
        line(img, x + 3, y + 3, x + 5, y + 10, color)
        rect(img, x + 1, y + 4, 4, 7, color)
        px(img, x + 1, y + 5, "CREAM_LIGHT")
        px(img, x + 1, y + 8, "CREAM_LIGHT")
    elif bottle_type == 3:
        # Hourglass / double-sphere potion
        rect(img, x + 2, y, 2, 1, "WOOD_LIGHT")
        ellipse(img, x + 2.5, y + 3.5, 2.0, 2.0, color, filled=True)
        ellipse(img, x + 2.5, y + 8.5, 2.8, 2.8, color, filled=True)
        px(img, x + 1, y + 3, "CREAM_LIGHT")
        px(img, x + 1, y + 8, "CREAM_LIGHT")
    elif bottle_type == 4:
        # Stout cylindrical jar with wax seal
        rect(img, x + 1, y, 4, 2, "WOOD_LIGHT")
        rect(img, x, y + 2, 6, 7, color)
        rect(img, x, y + 2, 1, 6, "CREAM_LIGHT")
        rect(img, x + 5, y + 2, 1, 7, "WOOD_DEEP")


def gen_potion_display() -> Image.Image:
    """Apothecary cabinet with 2 shelves displaying 10 distinct potions."""
    img = new_canvas(64, 64)

    # 1. Cabinet Frame & Shelves (x=4..59, y=4..63)
    # Top cornice
    rect(img, 4, 4, 56, 3, "WOOD_LIGHT")
    rect(img, 6, 7, 52, 2, "WOOD_BASE")
    # Uprights
    rect(img, 4, 9, 5, 52, "WOOD_BASE")
    rect(img, 4, 9, 1, 52, "WOOD_LIGHT")
    rect(img, 55, 9, 5, 52, "WOOD_SHADOW")
    rect(img, 59, 9, 1, 52, "WOOD_DEEP")
    # Backboard
    rect(img, 9, 9, 46, 50, "WOOD_DEEP")
    for px_pos in range(15, 55, 8):
        rect(img, px_pos, 9, 1, 50, "WOOD_SHADOW")

    # Shelves
    # Top shelf (y=29..32)
    rect(img, 9, 29, 46, 2, "WOOD_LIGHT")
    rect(img, 9, 31, 46, 2, "WOOD_BASE")
    rect(img, 9, 33, 46, 1, "WOOD_SHADOW")
    # Bottom shelf (y=51..54)
    rect(img, 9, 51, 46, 2, "WOOD_LIGHT")
    rect(img, 9, 53, 46, 2, "WOOD_BASE")
    rect(img, 9, 55, 46, 1, "WOOD_SHADOW")

    # Plinth base & feet
    rect(img, 4, 59, 56, 5, "WOOD_DEEP")
    rect(img, 6, 59, 52, 1, "WOOD_SHADOW")

    # 2. Top Shelf Potions (5 bottles across all 5 colors)
    # POTION_RED, POTION_BLUE, POTION_GREEN, POTION_PURPLE, POTION_YELLOW
    _draw_potion_flask(img, 11, 18, "POTION_RED", bottle_type=0)
    _draw_potion_flask(img, 20, 18, "POTION_BLUE", bottle_type=1)
    _draw_potion_flask(img, 29, 18, "POTION_GREEN", bottle_type=2)
    _draw_potion_flask(img, 38, 18, "POTION_PURPLE", bottle_type=3)
    _draw_potion_flask(img, 47, 19, "POTION_YELLOW", bottle_type=4)

    # 3. Bottom Shelf Potions (5 bottles, different shapes & positions)
    _draw_potion_flask(img, 11, 40, "POTION_PURPLE", bottle_type=1)
    _draw_potion_flask(img, 20, 41, "POTION_YELLOW", bottle_type=0)
    _draw_potion_flask(img, 29, 40, "POTION_RED", bottle_type=3)
    _draw_potion_flask(img, 38, 41, "POTION_BLUE", bottle_type=4)
    _draw_potion_flask(img, 47, 40, "POTION_GREEN", bottle_type=2)

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def gen_armor_stand() -> Image.Image:
    """Steel knight breastplate, pauldrons, visored helm with red plume on wood stand."""
    img = new_canvas(32, 56)

    # 1. Visored Helm & Red Plume (y=3..19)
    # Crimson plume flowing from helm crest
    for py, px_start, pw in [
        (3, 14, 4),
        (4, 13, 6),
        (5, 12, 7),
        (6, 12, 6),
        (7, 11, 5),
        (8, 11, 4),
    ]:
        rect(img, px_start, py, pw, 1, "CLOTH_RED_BASE")
        px(img, px_start, py, "CLOTH_RED_LIGHT")
        px(img, px_start + pw - 1, py, "CLOTH_RED_SHADOW")

    # Helm dome
    ellipse(img, 15.5, 11.5, 5.0, 4.0, "METAL_BASE", filled=True)
    ellipse(img, 14.5, 10.5, 4.0, 3.0, "METAL_LIGHT", filled=False)
    rect(img, 19, 10, 2, 4, "METAL_SHADOW")

    # Visor slit & brow ridge
    rect(img, 11, 13, 10, 1, "METAL_LIGHT")
    rect(img, 12, 14, 8, 1, "OUTLINE_COOL")
    rect(img, 12, 15, 8, 3, "METAL_BASE")
    rect(img, 18, 15, 2, 3, "METAL_SHADOW")
    # Gorget / neck
    rect(img, 13, 18, 6, 2, "METAL_SHADOW")

    # 2. Pauldrons (shoulders)
    # Left pauldron
    ellipse(img, 8.5, 23.5, 3.5, 3.5, "METAL_BASE", filled=True)
    ellipse(img, 8.0, 22.5, 3.0, 3.0, "METAL_LIGHT", filled=False)
    # Right pauldron
    ellipse(img, 23.5, 23.5, 3.5, 3.5, "METAL_SHADOW", filled=True)
    ellipse(img, 23.0, 22.5, 3.0, 3.0, "METAL_BASE", filled=False)

    # 3. Steel Breastplate (cuirass, y=20..38)
    rect(img, 10, 20, 12, 18, "METAL_BASE")
    # Central ridge (tapul keel)
    rect(img, 15, 20, 1, 18, "METAL_LIGHT")
    rect(img, 11, 21, 4, 10, "METAL_LIGHT")
    rect(img, 17, 21, 5, 17, "METAL_SHADOW")
    # Gold trim on neck & edges
    rect(img, 12, 20, 8, 1, "GOLD_LIGHT")
    px(img, 10, 21, "GOLD_BASE")
    px(img, 21, 21, "GOLD_BASE")

    # Faulds / tassets skirt (y=38..43)
    rect(img, 11, 38, 10, 5, "METAL_BASE")
    rect(img, 11, 39, 10, 1, "METAL_SHADOW")
    rect(img, 11, 41, 10, 1, "METAL_SHADOW")
    rect(img, 17, 38, 4, 5, "METAL_SHADOW")

    # 4. Wood Stand & Base (y=44..55)
    # Center wooden post
    rect(img, 14, 43, 4, 9, "WOOD_BASE")
    rect(img, 14, 43, 1, 9, "WOOD_LIGHT")
    rect(img, 17, 43, 1, 9, "WOOD_SHADOW")

    # Cross base resting on floor
    line(img, 14, 49, 7, 55, "WOOD_BASE")
    line(img, 14, 50, 7, 55, "WOOD_LIGHT")
    line(img, 17, 49, 24, 55, "WOOD_SHADOW")
    line(img, 17, 50, 24, 55, "WOOD_DEEP")
    rect(img, 6, 54, 3, 2, "WOOD_BASE")
    rect(img, 23, 54, 3, 2, "WOOD_SHADOW")
    rect(img, 14, 52, 4, 4, "WOOD_BASE")

    img = outline(img, "OUTLINE_COOL")
    return finalize_prop(img, "OUTLINE_COOL", hangs=False)


def gen_sign_tavern() -> Image.Image:
    """Iron bracket & chains suspending wooden sign with golden frothy beer mug."""
    img = new_canvas(40, 40)

    # 1. Wrought Iron Bracket along top (x=4..36, y=2..6)
    rect(img, 4, 2, 30, 2, "METAL_BASE")
    rect(img, 4, 2, 30, 1, "METAL_LIGHT")
    rect(img, 4, 4, 30, 1, "METAL_SHADOW")
    # Decorative scrollwork curl
    px(img, 34, 3, "METAL_BASE")
    px(img, 35, 4, "METAL_LIGHT")
    px(img, 35, 5, "METAL_BASE")
    px(img, 34, 6, "METAL_SHADOW")

    # Two suspension chains
    for cy in range(4, 12, 2):
        px(img, 10, cy, "METAL_LIGHT")
        px(img, 10, cy + 1, "METAL_SHADOW")
        px(img, 28, cy, "METAL_LIGHT")
        px(img, 28, cy + 1, "METAL_SHADOW")

    # 2. Wooden Signboard (x=6..33, y=12..36)
    rect(img, 6, 12, 28, 24, "WOOD_SHADOW")
    rect(img, 7, 13, 26, 22, "WOOD_BASE")
    rect(img, 7, 13, 26, 1, "WOOD_LIGHT")
    rect(img, 7, 13, 1, 22, "WOOD_LIGHT")
    rect(img, 32, 13, 1, 22, "WOOD_DEEP")
    # Corner reinforcing iron brackets
    for ix, iy in [(6, 12), (31, 12), (6, 34), (31, 34)]:
        rect(img, ix, iy, 2, 2, "METAL_BASE")
        px(img, ix, iy, "METAL_LIGHT")

    # Scalloped bottom tail
    for dx in range(12):
        dy = min(dx, 12 - dx) // 2
        px(img, 14 + dx, 36 + dy, "WOOD_SHADOW")

    # 3. Painted Tavern Emblem: Golden Frothy Beer Mug (cx=19, cy=24)
    # Mug body
    rect(img, 16, 22, 7, 8, "GOLD_BASE")
    rect(img, 16, 22, 2, 7, "GOLD_LIGHT")
    rect(img, 21, 22, 2, 8, "WOOD_DEEP")
    # Mug handle
    rect(img, 23, 23, 3, 5, "GOLD_BASE")
    px(img, 24, 24, "WOOD_BASE")
    px(img, 24, 25, "WOOD_BASE")
    px(img, 24, 26, "WOOD_BASE")

    # Foam head
    rect(img, 15, 18, 9, 4, "CREAM_LIGHT")
    px(img, 14, 19, "CREAM_LIGHT")
    px(img, 24, 19, "CREAM_LIGHT")
    px(img, 22, 21, "CREAM_SHADOW")
    px(img, 17, 21, "CREAM_SHADOW")
    # Drip
    px(img, 16, 22, "CREAM_LIGHT")
    px(img, 16, 23, "CREAM_LIGHT")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def gen_quest_board_full() -> Image.Image:
    """Notice board with overlapping parchment notices, wax seals, gold tag, dagger."""
    img = new_canvas(64, 56)

    # 1. Wooden Frame & Rooflet (x=4..59, y=2..47)
    # Pitched rooflet
    rect(img, 3, 2, 58, 3, "WOOD_SHADOW")
    rect(img, 4, 2, 56, 1, "WOOD_LIGHT")
    # Frame outer
    rect(img, 4, 5, 56, 42, "WOOD_BASE")
    rect(img, 4, 5, 56, 2, "WOOD_LIGHT")
    rect(img, 4, 5, 2, 42, "WOOD_LIGHT")
    rect(img, 58, 5, 2, 42, "WOOD_DEEP")
    rect(img, 4, 45, 56, 2, "WOOD_SHADOW")
    # Dark cork interior backing
    rect(img, 8, 8, 48, 37, "WOOD_DEEP")

    # 2. Overlapping Notices
    # Notice 1: Top-left bounty poster (x=10..24, y=9..23)
    rect(img, 10, 9, 15, 15, "PARCHMENT_BASE")
    rect(img, 10, 9, 15, 1, "PARCHMENT_LIGHT")
    rect(img, 10, 9, 1, 15, "PARCHMENT_LIGHT")
    rect(img, 13, 12, 6, 6, "WOOD_DEEP")
    px(img, 15, 13, "PARCHMENT_BASE")
    # Red wax seal
    rect(img, 12, 21, 3, 3, "CLOTH_RED_BASE")
    px(img, 12, 21, "CLOTH_RED_LIGHT")

    # Notice 2: Large center proclamation (x=22..41, y=8..26)
    rect(img, 22, 8, 20, 18, "PARCHMENT_LIGHT")
    for sy in range(12, 24, 3):
        rect(img, 25, sy, 14, 1, "PARCHMENT_SHADOW")
    # Wax seals
    rect(img, 24, 10, 3, 3, "CLOTH_RED_BASE")
    px(img, 24, 10, "CLOTH_RED_LIGHT")
    rect(img, 37, 22, 3, 3, "CLOTH_RED_BASE")
    px(img, 37, 22, "CLOTH_RED_LIGHT")

    # Notice 3: Herb gathering request (x=40..53, y=10..22)
    rect(img, 40, 10, 14, 13, "PARCHMENT_BASE")
    px(img, 46, 12, "LEAF_BASE")
    px(img, 47, 12, "LEAF_LIGHT")
    px(img, 46, 13, "LEAF_SHADOW")

    # Notice 4: Escort quest (bottom-left, x=10..27, y=22..41)
    rect(img, 10, 22, 18, 19, "PARCHMENT_SHADOW")
    rect(img, 11, 23, 16, 17, "PARCHMENT_BASE")
    for sy in range(26, 38, 3):
        rect(img, 13, sy, 12, 1, "PARCHMENT_SHADOW")

    # Notice 5: Guild announcement (bottom-center, x=24..43, y=24..42)
    rect(img, 24, 24, 19, 18, "PARCHMENT_BASE")
    rect(img, 24, 24, 19, 1, "PARCHMENT_LIGHT")
    for sy in range(28, 40, 3):
        rect(img, 27, sy, 13, 1, "PARCHMENT_SHADOW")

    # Notice 6: GOLD BOUNTY TAG (x=42..53, y=23..38)
    rect(img, 42, 23, 12, 16, "GOLD_BASE")
    rect(img, 43, 24, 10, 14, "GOLD_LIGHT")
    rect(img, 45, 27, 6, 2, "WOOD_DEEP")
    rect(img, 46, 33, 4, 4, "CLOTH_RED_BASE")
    px(img, 46, 33, "CLOTH_RED_LIGHT")

    # 3. Pinned Dagger (thrust through notice 2 into notice 5)
    # Pommel & grip
    rect(img, 33, 16, 2, 2, "GOLD_BASE")
    rect(img, 33, 18, 2, 3, "WOOD_DEEP")
    rect(img, 31, 21, 6, 1, "GOLD_BASE")
    px(img, 31, 21, "GOLD_LIGHT")
    # Steel blade
    rect(img, 33, 22, 1, 6, "METAL_LIGHT")
    rect(img, 34, 22, 1, 6, "METAL_SHADOW")

    # 4. Support Posts (x=7..12 and x=51..56, y=46..55)
    rect(img, 7, 46, 6, 10, "WOOD_BASE")
    rect(img, 7, 46, 1, 10, "WOOD_LIGHT")
    rect(img, 12, 46, 1, 10, "WOOD_SHADOW")

    rect(img, 51, 46, 6, 10, "WOOD_SHADOW")
    rect(img, 51, 46, 1, 10, "WOOD_BASE")
    rect(img, 56, 46, 1, 10, "WOOD_DEEP")

    rect(img, 13, 48, 38, 3, "WOOD_BASE")
    rect(img, 13, 48, 38, 1, "WOOD_LIGHT")
    rect(img, 13, 50, 38, 1, "WOOD_SHADOW")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def gen_drying_rack_herbs() -> Image.Image:
    """Hanging wooden beam suspending 5 tied herb and flower bundles."""
    img = new_canvas(48, 32)

    # 1. Suspension Ropes from Ceiling
    for ry in range(1, 6):
        px(img, 8, ry, "PARCHMENT_BASE")
        px(img, 39, ry, "PARCHMENT_BASE")

    # 2. Horizontal Wooden Beam (x=4..43, y=5..8)
    rect(img, 4, 5, 40, 4, "WOOD_BASE")
    rect(img, 4, 5, 40, 1, "WOOD_LIGHT")
    rect(img, 4, 8, 40, 1, "WOOD_SHADOW")
    px(img, 3, 6, "WOOD_LIGHT")
    px(img, 44, 7, "WOOD_SHADOW")

    # 3. Five Tied Herb Bundles
    # Bundle 1: Sage / Forest Mint (x=6..11, y=8..26)
    rect(img, 8, 8, 2, 4, "PARCHMENT_BASE")
    ellipse(img, 8.5, 18.5, 3.0, 7.0, "LEAF_BASE", filled=True)
    ellipse(img, 8.0, 17.5, 2.0, 5.0, "LEAF_LIGHT", filled=False)
    line(img, 9, 12, 9, 25, "LEAF_SHADOW")

    # Bundle 2: Lavender / Violet Blossoms (x=13..19, y=8..28)
    rect(img, 15, 8, 2, 4, "PARCHMENT_BASE")
    line(img, 16, 11, 16, 27, "LEAF_BASE")
    for py, px_pos in [(14, 15), (16, 17), (18, 14), (20, 16), (22, 15), (24, 17), (26, 16)]:
        rect(img, px_pos, py, 2, 2, "POTION_PURPLE")
        px(img, px_pos, py, "CLOTH_ACCENT_LIGHT")

    # Bundle 3: Chamomile / Hops (x=21..27, y=8..26)
    rect(img, 23, 8, 2, 4, "PARCHMENT_BASE")
    ellipse(img, 24.0, 18.0, 3.2, 6.5, "LEAF_LIGHT", filled=True)
    for py, px_pos in [(14, 23), (17, 25), (19, 22), (22, 24), (25, 23)]:
        rect(img, px_pos, py, 2, 2, "FLAME_YELLOW")
        px(img, px_pos, py, "GOLD_LIGHT")

    # Bundle 4: Crimson Poppy / Rosehips (x=29..35, y=8..28)
    rect(img, 31, 8, 2, 4, "PARCHMENT_BASE")
    line(img, 32, 11, 32, 27, "LEAF_SHADOW")
    for py, px_pos in [(15, 30), (18, 33), (21, 30), (24, 32), (27, 31)]:
        rect(img, px_pos, py, 3, 2, "CLOTH_RED_BASE")
        px(img, px_pos, py, "CLOTH_RED_LIGHT")
        px(img, px_pos + 2, py + 1, "CLOTH_RED_SHADOW")

    # Bundle 5: Wild Thyme (x=37..42, y=8..26)
    rect(img, 39, 8, 2, 4, "PARCHMENT_BASE")
    ellipse(img, 39.5, 18.0, 2.8, 6.5, "LEAF_BASE", filled=True)
    ellipse(img, 39.0, 17.0, 1.8, 4.5, "LEAF_LIGHT", filled=False)
    line(img, 40, 12, 40, 25, "LEAF_SHADOW")

    # Twine knot bows at beam
    for bx in (8, 15, 23, 31, 39):
        px(img, bx - 1, 9, "PARCHMENT_LIGHT")
        px(img, bx + 2, 9, "PARCHMENT_LIGHT")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def gen_rug_red_full() -> Image.Image:
    """Generate the full 64x64 ornate crimson and gold rug with closed outline."""
    img = new_canvas(64, 64)

    # 1. Closed OUTLINE_WARM along all canvas border edges
    rect(img, 0, 0, 64, 64, "OUTLINE_WARM", filled=False)

    # 2. Fringe along top and bottom (y=1 and y=62)
    for x in range(1, 63):
        col_fringe = "CREAM_SHADOW" if (x % 3 != 0) else "GOLD_BASE"
        px(img, x, 1, col_fringe)
        px(img, x, 62, col_fringe)
    for y in range(2, 62):
        px(img, 1, y, "OUTLINE_WARM")
        px(img, 62, y, "OUTLINE_WARM")

    # 3. Outer Gold Guard Border (x, y in [2..5] and [58..61])
    for y in range(2, 62):
        for x in range(2, 62):
            is_outer_border = (x in (2, 61) or y in (2, 61))
            is_gold_fillet = (x in (3, 60) or y in (3, 60))
            is_dark_trim = (x in (4, 5, 58, 59) or y in (4, 5, 58, 59))
            if is_outer_border:
                px(img, x, y, "GOLD_BASE")
            elif is_gold_fillet:
                px(img, x, y, "GOLD_LIGHT" if (x + y) % 2 == 0 else "GOLD_BASE")
            elif is_dark_trim:
                px(img, x, y, "CLOTH_RED_SHADOW")

    # Inner gold line at x=6, 57, y=6, 57
    for x in range(6, 58):
        px(img, x, 6, "GOLD_LIGHT")
        px(img, x, 57, "GOLD_BASE")
    for y in range(6, 58):
        px(img, 6, y, "GOLD_LIGHT")
        px(img, 57, y, "GOLD_BASE")

    # 4. Rich Crimson Field (x=7..56, y=7..56)
    rect(img, 7, 7, 50, 50, "CLOTH_RED_BASE")
    dither(img, (7, 7, 50, 50), "CLOTH_RED_BASE", "CLOTH_RED_SHADOW", pattern="checker_sparse")

    # Corner Gold Fleurons (x, y near [8..15])
    for ox, oy in [(8, 8), (48, 8), (8, 48), (48, 48)]:
        rect(img, ox, oy, 8, 8, "CLOTH_RED_SHADOW")
        rect(img, ox + 1, oy + 1, 6, 6, "GOLD_BASE")
        rect(img, ox + 2, oy + 2, 4, 4, "GOLD_LIGHT")
        px(img, ox + 3, oy + 3, "CLOTH_RED_BASE")

    # 5. Center Medallion (centered at 31.5, 31.5, radius ~13)
    cx, cy = 31.5, 31.5
    ellipse(img, cx, cy, 14.0, 14.0, "GOLD_BASE", filled=True)
    ellipse(img, cx, cy, 12.5, 12.5, "GOLD_LIGHT", filled=True)
    ellipse(img, cx, cy, 10.5, 10.5, "CLOTH_RED_SHADOW", filled=True)
    ellipse(img, cx, cy, 8.5, 8.5, "CLOTH_RED_BASE", filled=True)

    # 8-pointed star points
    for rad_offset in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4):
        for sign in (1, -1):
            px_val = int(round(cx + sign * 14.5 * math.cos(rad_offset)))
            py_val = int(round(cy + sign * 14.5 * math.sin(rad_offset)))
            if 0 <= px_val < 64 and 0 <= py_val < 64:
                px(img, px_val, py_val, "GOLD_LIGHT")

    # Royal teal core
    ellipse(img, cx, cy, 5.5, 5.5, "CLOTH_ACCENT_SHADOW", filled=True)
    ellipse(img, cx, cy, 4.0, 4.0, "CLOTH_ACCENT_BASE", filled=True)
    ellipse(img, cx - 0.5, cy - 0.5, 2.0, 2.0, "CLOTH_ACCENT_LIGHT", filled=True)
    px(img, int(cx), int(cy), "CREAM_LIGHT")

    return img


_CACHED_RUG_RED: Image.Image | None = None


def _get_cached_rug_red() -> Image.Image:
    global _CACHED_RUG_RED
    if _CACHED_RUG_RED is None:
        _CACHED_RUG_RED = gen_rug_red_full()
    return _CACHED_RUG_RED


def gen_rug_red_tl() -> Image.Image:
    return _get_cached_rug_red().crop((0, 0, 32, 32))


def gen_rug_red_tr() -> Image.Image:
    return _get_cached_rug_red().crop((32, 0, 64, 32))


def gen_rug_red_bl() -> Image.Image:
    return _get_cached_rug_red().crop((0, 32, 32, 64))


def gen_rug_red_br() -> Image.Image:
    return _get_cached_rug_red().crop((32, 32, 64, 64))


PROPS_CORE: dict[str, AssetSpec] = {
    "fireplace_1": AssetSpec(fn=gen_fireplace_1, footprint=(2, 1), layer="prop"),
    "bar_counter_taps": AssetSpec(fn=gen_bar_counter_taps, footprint=(3, 1), layer="prop"),
    "keg_rack": AssetSpec(fn=gen_keg_rack, footprint=(2, 1), layer="prop"),
    "table_round": AssetSpec(fn=gen_table_round, footprint=(2, 2), layer="prop"),
    "roast_chicken_platter": AssetSpec(fn=gen_roast_chicken_platter, footprint=(1, 1), layer="tabletop"),
    "ale_tray_three": AssetSpec(fn=gen_ale_tray_three, footprint=(1, 1), layer="tabletop"),
    "potion_display": AssetSpec(fn=gen_potion_display, footprint=(2, 1), layer="prop"),
    "armor_stand": AssetSpec(fn=gen_armor_stand, footprint=(1, 1), layer="prop"),
    "sign_tavern": AssetSpec(fn=gen_sign_tavern, footprint=(1, 1), layer="prop", hangs=True),
    "quest_board_full": AssetSpec(fn=gen_quest_board_full, footprint=(2, 1), layer="prop"),
    "drying_rack_herbs": AssetSpec(fn=gen_drying_rack_herbs, footprint=(2, 1), layer="prop", hangs=True),
    "rug_red_tl": AssetSpec(fn=gen_rug_red_tl, footprint=(1, 1), layer="rug", multi_group="rug_red", multi_pos=(0, 0)),
    "rug_red_tr": AssetSpec(fn=gen_rug_red_tr, footprint=(1, 1), layer="rug", multi_group="rug_red", multi_pos=(1, 0)),
    "rug_red_bl": AssetSpec(fn=gen_rug_red_bl, footprint=(1, 1), layer="rug", multi_group="rug_red", multi_pos=(0, 1)),
    "rug_red_br": AssetSpec(fn=gen_rug_red_br, footprint=(1, 1), layer="rug", multi_group="rug_red", multi_pos=(1, 1)),
}
