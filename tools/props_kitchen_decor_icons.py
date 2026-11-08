"""Props for Kitchen, Entertainment/Decor, 16x16 Icons/Emotes, and 9-Slice UI Panels.

Module defining `PROPS_KITCHEN_DECOR_ICONS: dict[str, AssetSpec]` obeying the 1x pixel-art
frozen QA rules:
- Palette-only colors from `tools.palette` (never raw hex literals, zero pure black).
- Binary alpha (0 or 255).
- Closed 1px hue-shifted outlines on all exposed edges and canvas boundaries.
- Bottom anchor sanity on all non-hanging props (lowest opaque row touches h - 1).
- Multi-tile 64x64 assembled royal teal & gold rug sliced into 4 quadrants.
- Tileable 8px centers and closed OUTLINE_WARM borders on all 24x24 9-slice UI panels.
"""

from __future__ import annotations
from PIL import Image

from tools.palette import col
from tools.draw_helpers import (
    AssetSpec,
    new_canvas,
    outline,
    px,
    rect,
    line,
    ellipse,
    finalize_prop,
    dither,
    TRANSPARENT,
)


# ==============================================================================
# SECTION 1: KITCHEN PROPS
# ==============================================================================

def draw_stove_cauldron() -> Image.Image:
    """64x56 iron stove with glowing fire grate & bubbling stew cauldron."""
    w, h = 64, 56
    img = new_canvas(w, h)

    # 1. Cast-iron stove body (x=6..57, y=22..55)
    rect(img, 6, 22, 52, 30, "METAL_BASE")
    rect(img, 7, 23, 50, 4, "METAL_LIGHT")
    rect(img, 6, 46, 52, 7, "METAL_SHADOW")

    # Stove pipe on right (x=46..52, y=2..22)
    rect(img, 46, 2, 7, 21, "METAL_BASE")
    rect(img, 46, 2, 2, 21, "METAL_LIGHT")
    rect(img, 51, 2, 2, 21, "METAL_SHADOW")
    # Pipe cap rim
    rect(img, 44, 2, 11, 3, "METAL_LIGHT")
    rect(img, 44, 4, 11, 1, "METAL_SHADOW")
    # Pipe damper handle
    rect(img, 53, 11, 4, 2, "METAL_LIGHT")
    px(img, 56, 12, "GOLD_BASE")

    # Stovetop rim / flange (y=20..24, x=5..58)
    rect(img, 5, 20, 54, 4, "METAL_LIGHT")
    rect(img, 5, 23, 54, 1, "METAL_SHADOW")

    # Fire grate opening (x=18..44, y=30..48)
    rect(img, 18, 30, 27, 19, "STONE_DEEP")
    # Glowing fire interior
    rect(img, 20, 33, 23, 15, "FLAME_EMBER")
    rect(img, 22, 36, 19, 11, "FLAME_ORANGE")
    rect(img, 24, 39, 15, 7, "FLAME_YELLOW")
    # Embers & hot coals
    for ex in range(21, 43, 2):
        px(img, ex, 46, "FLAME_YELLOW")
        px(img, ex + 1, 47, "FLAME_ORANGE")
    # Cast iron vertical grate bars
    for bx in (22, 26, 30, 34, 38, 42):
        rect(img, bx, 32, 2, 16, "METAL_SHADOW")
        px(img, bx, 33, "METAL_LIGHT")
    # Arch top border for grate
    rect(img, 17, 29, 29, 2, "OUTLINE_COOL")
    rect(img, 17, 30, 2, 19, "OUTLINE_COOL")
    rect(img, 44, 30, 2, 19, "OUTLINE_COOL")

    # Cauldron on left burner (centered at x=23, y=7..22)
    ellipse(img, 23.5, 15.0, 12.0, 8.0, "METAL_SHADOW", filled=True)
    ellipse(img, 23.5, 14.5, 11.0, 7.0, "METAL_BASE", filled=True)
    # Highlights & shadows on cauldron belly
    ellipse(img, 21.0, 14.0, 7.0, 5.0, "METAL_LIGHT", filled=True)
    # Cauldron rim
    ellipse(img, 23.5, 8.5, 11.5, 3.5, "METAL_LIGHT", filled=False)
    ellipse(img, 23.5, 9.0, 10.5, 2.5, "METAL_SHADOW", filled=True)
    # Bubbling stew inside
    ellipse(img, 23.5, 9.0, 9.0, 2.0, "ROAST_BASE", filled=True)
    ellipse(img, 22.0, 8.8, 5.0, 1.2, "ALE_BASE", filled=True)
    # Bubbles & herbs
    px(img, 20, 9, "CREAM_LIGHT")
    px(img, 25, 8, "FLAME_YELLOW")
    px(img, 28, 9, "LEAF_LIGHT")
    px(img, 18, 9, "LEAF_BASE")
    # Cauldron side ears/handles
    rect(img, 10, 10, 2, 4, "METAL_LIGHT")
    rect(img, 35, 10, 2, 4, "METAL_LIGHT")
    px(img, 9, 12, "GOLD_BASE")
    px(img, 37, 12, "GOLD_BASE")

    # Rising steam curls above cauldron (y=2..7)
    px(img, 22, 5, "CREAM_LIGHT")
    px(img, 23, 4, "CREAM_LIGHT")
    px(img, 24, 3, "CREAM_LIGHT")
    px(img, 25, 4, "CREAM_SHADOW")
    px(img, 18, 6, "CREAM_LIGHT")
    px(img, 19, 5, "CREAM_LIGHT")

    # Stove feet (touching y=55)
    # Left foot
    rect(img, 7, 51, 6, 5, "METAL_BASE")
    rect(img, 7, 51, 2, 5, "METAL_LIGHT")
    rect(img, 6, 54, 8, 2, "METAL_SHADOW")
    # Right foot
    rect(img, 51, 51, 6, 5, "METAL_BASE")
    rect(img, 51, 51, 2, 5, "METAL_LIGHT")
    rect(img, 50, 54, 8, 2, "METAL_SHADOW")
    # Ash drawer in center
    rect(img, 22, 50, 20, 4, "METAL_SHADOW")
    rect(img, 30, 51, 4, 2, "METAL_LIGHT")

    return finalize_prop(img, "OUTLINE_COOL", hangs=False)


def draw_prep_counter() -> Image.Image:
    """64x44 butcher block with cleaver, bread loaf, herbs."""
    w, h = 64, 44
    img = new_canvas(w, h)

    # 1. Thick butcher block slab (y=14..22, x=4..59)
    # Top working surface: y=14..18
    rect(img, 4, 14, 56, 5, "WOOD_BASE")
    # Checkerboard end-grain wood blocks
    for by in range(14, 19):
        for bx in range(4, 60, 4):
            c = "WOOD_LIGHT" if ((bx // 4 + by) % 2 == 0) else "WOOD_BASE"
            rect(img, bx, by, 4, 1, c)
    # Front edge bevel of the butcher block
    rect(img, 4, 19, 56, 4, "WOOD_SHADOW")
    rect(img, 4, 19, 56, 1, "WOOD_LIGHT")

    # 2. Heavy wooden legs & frame (y=22..43)
    # Front-left leg (x=6..11)
    rect(img, 6, 23, 6, 21, "WOOD_BASE")
    rect(img, 6, 23, 2, 21, "WOOD_LIGHT")
    rect(img, 10, 23, 2, 21, "WOOD_SHADOW")
    # Front-right leg (x=52..57)
    rect(img, 52, 23, 6, 21, "WOOD_BASE")
    rect(img, 52, 23, 2, 21, "WOOD_LIGHT")
    rect(img, 56, 23, 2, 21, "WOOD_SHADOW")
    # Back legs (darker)
    rect(img, 14, 23, 4, 15, "WOOD_DEEP")
    rect(img, 46, 23, 4, 15, "WOOD_DEEP")
    # Back wall shadow behind lower shelf
    rect(img, 12, 23, 40, 12, "WOOD_DEEP")

    # Lower slatted storage shelf (y=34..38, x=10..53)
    rect(img, 10, 34, 44, 4, "WOOD_SHADOW")
    for sx in range(12, 52, 5):
        rect(img, sx, 34, 4, 3, "WOOD_BASE")
        px(img, sx, 34, "WOOD_LIGHT")

    # Items on lower shelf: dough bowl & sack
    # Wooden dough bowl (x=16..26, y=30..36)
    ellipse(img, 21.0, 33.0, 5.0, 3.0, "WOOD_BASE", filled=True)
    ellipse(img, 21.0, 32.0, 4.0, 2.0, "CREAM_LIGHT", filled=True)
    # Tied spice bundle on lower shelf (x=36..44, y=32..36)
    rect(img, 36, 33, 8, 3, "PARCHMENT_BASE")
    rect(img, 39, 32, 2, 5, "WOOD_DEEP")

    # 3. Tabletop items (y=4..16)
    # Cleaver on left stuck into wood (x=8..14, y=4..15)
    # Handle angled up
    rect(img, 10, 4, 3, 5, "WOOD_DEEP")
    px(img, 10, 4, "WOOD_LIGHT")
    # Cleaver blade
    rect(img, 8, 8, 7, 7, "METAL_LIGHT")
    rect(img, 12, 8, 3, 7, "METAL_BASE")
    rect(img, 8, 14, 7, 1, "METAL_SHADOW")
    # Hole in blade
    px(img, 12, 10, "WOOD_BASE")

    # Fresh crusty bread loaf sliced in center (x=24..38, y=8..15)
    ellipse(img, 31.0, 12.0, 7.0, 4.0, "ROAST_BASE", filled=True)
    ellipse(img, 30.0, 11.0, 6.0, 3.0, "ROAST_LIGHT", filled=True)
    # Crust slashes
    line(img, 27, 9, 29, 12, "PARCHMENT_LIGHT")
    line(img, 31, 9, 33, 12, "PARCHMENT_LIGHT")
    line(img, 35, 9, 37, 12, "PARCHMENT_LIGHT")
    # Bread slice leaning on board
    ellipse(img, 23.5, 12.5, 2.5, 3.5, "ROAST_BASE", filled=True)
    ellipse(img, 23.5, 12.5, 1.5, 2.5, "PARCHMENT_LIGHT", filled=True)
    # Bread crumbs
    px(img, 21, 14, "PARCHMENT_LIGHT")
    px(img, 39, 15, "ROAST_LIGHT")

    # Fresh herb bundle & garlic on right (x=44..55, y=9..16)
    # Rosemary sprigs
    line(img, 48, 14, 44, 9, "LEAF_BASE")
    line(img, 48, 14, 52, 9, "LEAF_LIGHT")
    line(img, 48, 14, 55, 11, "LEAF_BASE")
    px(img, 45, 9, "LEAF_LIGHT")
    px(img, 53, 9, "LEAF_LIGHT")
    px(img, 54, 12, "LEAF_LIGHT")
    # Twine tie
    px(img, 48, 13, "PARCHMENT_SHADOW")
    # Garlic bulb
    ellipse(img, 44.0, 14.5, 2.0, 2.0, "CREAM_LIGHT", filled=True)
    px(img, 44, 13, "CREAM_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def draw_spit_roast() -> Image.Image:
    """64x48 stone fire pit + glazed roast on iron spit."""
    w, h = 64, 48
    img = new_canvas(w, h)

    # 1. Fieldstone hearth ring (x=6..57, y=30..47)
    # Oval fire pit basin
    ellipse(img, 31.5, 39.0, 25.0, 8.5, "STONE_SHADOW", filled=True)
    ellipse(img, 31.5, 38.0, 22.0, 6.5, "STONE_DEEP", filled=True)

    # Fire pit interior logs, coals & layered 3-tone jagged flames (y=26..42)
    rect(img, 16, 37, 32, 4, "WOOD_DEEP")
    rect(img, 18, 38, 28, 2, "FLAME_EMBER")
    for fx, top_y, fw in ((21, 30, 5), (26, 27, 6), (31, 25, 6), (36, 28, 5), (40, 31, 4)):
        for py in range(top_y, 38):
            cur_w = max(1, fw - (37 - py) // 3)
            ox = fx - cur_w // 2
            rect(img, ox, py, cur_w, 1, "FLAME_EMBER" if py < top_y + 2 else "FLAME_ORANGE")
            if cur_w >= 3 and py >= top_y + 2:
                rect(img, ox + 1, py, max(1, cur_w - 2), 1, "FLAME_YELLOW")

    # Front ring of fieldstones (y=38..47)
    stone_centers = [
        (8, 41, 4, 3), (15, 43, 5, 4), (23, 45, 5, 4), (32, 45, 6, 4),
        (41, 45, 5, 4), (49, 43, 5, 4), (56, 41, 4, 3)
    ]
    for scx, scy, srx, sry in stone_centers:
        ellipse(img, scx, scy, srx, sry, "STONE_BASE", filled=True)
        ellipse(img, scx - 1, scy - 1, srx - 1.5, sry - 1.5, "STONE_LIGHT", filled=True)
        ellipse(img, scx + 1, scy + 1, srx - 1.5, sry - 1.5, "STONE_SHADOW", filled=True)

    # 2. Iron spit A-frame uprights
    # Left A-frame (x=7..12, y=14..45)
    line(img, 9, 14, 7, 44, "METAL_BASE")
    line(img, 10, 14, 8, 44, "METAL_LIGHT")
    line(img, 10, 14, 12, 44, "METAL_SHADOW")
    rect(img, 7, 28, 6, 2, "METAL_BASE")  # crossbar
    # Top fork on left
    px(img, 8, 13, "METAL_LIGHT")
    px(img, 11, 13, "METAL_BASE")

    # Right A-frame (x=51..56, y=14..45)
    line(img, 53, 14, 51, 44, "METAL_BASE")
    line(img, 54, 14, 52, 44, "METAL_LIGHT")
    line(img, 54, 14, 56, 44, "METAL_SHADOW")
    rect(img, 51, 28, 6, 2, "METAL_BASE")  # crossbar
    # Top fork on right
    px(img, 52, 13, "METAL_LIGHT")
    px(img, 55, 13, "METAL_BASE")

    # Spit skewer rod (horizontal across x=7..58 at y=16..17)
    rect(img, 7, 16, 52, 2, "METAL_BASE")
    rect(img, 7, 16, 52, 1, "METAL_LIGHT")
    # Crank handle on right
    rect(img, 58, 14, 2, 7, "METAL_LIGHT")
    rect(img, 59, 19, 3, 2, "WOOD_DEEP")

    # 3. Glazed roast pig / meat on the spit (x=18..46, y=9..25)
    # Plump main roast body
    ellipse(img, 31.5, 16.5, 13.0, 7.5, "ROAST_BASE", filled=True)
    # Roasted golden highlight top face
    ellipse(img, 30.5, 14.5, 11.5, 5.0, "ROAST_LIGHT", filled=True)
    # Caramelized glaze shine along top
    for gx in range(23, 39, 3):
        px(img, gx, 12, "FLAME_YELLOW")
        px(img, gx + 1, 13, "ROAST_LIGHT")
    # Savory grill score marks
    for mx in (24, 28, 32, 36, 40):
        line(img, mx, 12, mx + 1, 20, "ROAST_SHADOW")
    # Bone ends protruding
    rect(img, 16, 15, 3, 3, "CREAM_LIGHT")
    px(img, 15, 15, "CREAM_SHADOW")
    rect(img, 44, 15, 3, 3, "CREAM_LIGHT")
    px(img, 47, 15, "CREAM_SHADOW")
    # Sizzling drip falling towards fire
    px(img, 29, 24, "FLAME_ORANGE")
    px(img, 33, 25, "ROAST_LIGHT")

    return finalize_prop(img, "OUTLINE_COOL", hangs=False)


def draw_pantry() -> Image.Image:
    """48x60 tall open larder with jars, cheese wheel, bread, sacks."""
    w, h = 48, 60
    img = new_canvas(w, h)

    # 1. Pantry cabinet woodwork
    # Backing dark timber panel
    rect(img, 4, 6, 40, 53, "WOOD_DEEP")
    # Vertical plank lines in back
    for vx in (14, 24, 34):
        rect(img, vx, 7, 1, 51, "WOOD_SHADOW")

    # Crown cornice moulding (y=3..7, x=2..45)
    rect(img, 2, 3, 44, 2, "WOOD_LIGHT")
    rect(img, 3, 5, 42, 2, "WOOD_BASE")
    rect(img, 4, 7, 40, 1, "WOOD_SHADOW")

    # Side upright frames (left x=4..7, right x=40..43)
    rect(img, 4, 7, 4, 52, "WOOD_BASE")
    rect(img, 4, 7, 1, 52, "WOOD_LIGHT")
    rect(img, 7, 7, 1, 52, "WOOD_SHADOW")
    rect(img, 40, 7, 4, 52, "WOOD_BASE")
    rect(img, 40, 7, 1, 52, "WOOD_LIGHT")
    rect(img, 43, 7, 1, 52, "WOOD_SHADOW")

    # Shelf 1 (y=19..22, x=7..41)
    rect(img, 7, 19, 34, 3, "WOOD_BASE")
    rect(img, 7, 19, 34, 1, "WOOD_LIGHT")
    rect(img, 7, 21, 34, 1, "WOOD_SHADOW")

    # Shelf 2 (y=33..36, x=7..41)
    rect(img, 7, 33, 34, 3, "WOOD_BASE")
    rect(img, 7, 33, 34, 1, "WOOD_LIGHT")
    rect(img, 7, 35, 34, 1, "WOOD_SHADOW")

    # Shelf 3 (y=46..49, x=7..41)
    rect(img, 7, 46, 34, 3, "WOOD_BASE")
    rect(img, 7, 46, 34, 1, "WOOD_LIGHT")
    rect(img, 7, 48, 34, 1, "WOOD_SHADOW")

    # Bottom base rail (y=56..59, x=3..44)
    rect(img, 3, 56, 42, 4, "WOOD_BASE")
    rect(img, 3, 56, 42, 1, "WOOD_LIGHT")
    rect(img, 3, 59, 42, 1, "WOOD_SHADOW")

    # 2. Shelf 1 contents: preserve jars (y=11..19)
    # Jar 1: Red strawberry jam (x=9..14, y=12..19)
    rect(img, 9, 14, 6, 5, "POTION_RED")
    px(img, 9, 14, "CREAM_LIGHT")
    rect(img, 9, 12, 6, 2, "PARCHMENT_LIGHT")  # cloth lid
    px(img, 11, 14, "WOOD_DEEP")  # twine tie
    # Jar 2: Golden honey pot (x=17..23, y=10..19)
    rect(img, 17, 13, 7, 6, "ALE_LIGHT")
    rect(img, 18, 14, 5, 5, "GOLD_BASE")
    rect(img, 18, 10, 5, 3, "PARCHMENT_BASE")
    px(img, 20, 11, "GOLD_LIGHT")
    # Jar 3: Pickled green peppers (x=26..31, y=12..19)
    rect(img, 26, 14, 6, 5, "POTION_GREEN")
    px(img, 26, 14, "CREAM_LIGHT")
    rect(img, 27, 12, 4, 2, "WOOD_LIGHT")
    # Jar 4: Blue apothecary jar (x=34..39, y=11..19)
    rect(img, 34, 13, 6, 6, "POTION_BLUE")
    px(img, 34, 13, "CREAM_LIGHT")
    rect(img, 35, 11, 4, 2, "PARCHMENT_LIGHT")

    # 3. Shelf 2 contents: Cheese wheel & bread (y=24..33)
    # Cheese wheel with wedge cutout (x=9..22, y=25..33)
    ellipse(img, 15.5, 29.0, 6.0, 3.5, "GOLD_BASE", filled=True)
    ellipse(img, 15.0, 27.5, 5.0, 2.5, "GOLD_LIGHT", filled=True)
    # Wedge cutout revealing creamy center
    rect(img, 14, 26, 4, 4, "CREAM_LIGHT")
    px(img, 15, 28, "PARCHMENT_SHADOW")
    # Sourdough bread loaf (x=24..33, y=25..33)
    ellipse(img, 28.5, 29.0, 4.5, 3.5, "ROAST_BASE", filled=True)
    ellipse(img, 28.0, 28.0, 3.5, 2.5, "ROAST_LIGHT", filled=True)
    line(img, 26, 27, 28, 29, "PARCHMENT_LIGHT")
    # Butter crock (x=35..39, y=27..33)
    rect(img, 35, 28, 5, 5, "CREAM_LIGHT")
    rect(img, 35, 32, 5, 1, "CREAM_SHADOW")
    rect(img, 36, 27, 3, 1, "WOOD_BASE")

    # 4. Shelf 3 contents: Ceramic jugs & spice jars (y=37..46)
    # Ceramic oil flagon (x=10..16, y=37..46)
    ellipse(img, 13.0, 42.0, 3.5, 4.0, "STONE_BASE", filled=True)
    rect(img, 12, 38, 2, 4, "STONE_LIGHT")
    px(img, 12, 37, "WOOD_LIGHT")  # cork
    rect(img, 9, 39, 2, 4, "STONE_BASE")  # handle
    # Earthenware spice canisters (x=20..38, y=39..46)
    for px_start, p_col in ((20, "ROAST_LIGHT"), (26, "STONE_LIGHT"), (32, "PARCHMENT_BASE")):
        rect(img, px_start, 40, 5, 6, p_col)
        rect(img, px_start, 40, 1, 6, "CREAM_LIGHT")
        rect(img, px_start, 39, 5, 1, "WOOD_SHADOW")

    # 5. Bottom shelf: plump burlap sacks (y=47..59)
    # Large sack on left (x=7..24, y=47..59)
    ellipse(img, 15.5, 54.0, 8.0, 5.5, "PARCHMENT_BASE", filled=True)
    ellipse(img, 14.5, 53.0, 6.5, 4.0, "PARCHMENT_LIGHT", filled=True)
    rect(img, 13, 47, 4, 3, "PARCHMENT_SHADOW")  # tied neck
    rect(img, 12, 49, 6, 1, "WOOD_DEEP")  # tie cord
    # Second sack leaning on right (x=24..39, y=49..59)
    ellipse(img, 31.5, 54.5, 7.5, 5.0, "PARCHMENT_BASE", filled=True)
    ellipse(img, 30.5, 53.5, 6.0, 3.5, "PARCHMENT_LIGHT", filled=True)
    rect(img, 30, 49, 4, 3, "PARCHMENT_SHADOW")
    rect(img, 29, 51, 6, 1, "WOOD_DEEP")

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


# ==============================================================================
# SECTION 2: ENTERTAINMENT & DECOR PROPS
# ==============================================================================

def draw_stage_small() -> Image.Image:
    """96x56 wooden minstrel platform with red curtain trim & brass footlights."""
    w, h = 96, 56
    img = new_canvas(w, h)

    # 1. Wooden platform deck (y=16..35)
    # Deck surface in angled 3/4 perspective: back edge y=16 (x=8..87), front rim y=34 (x=4..91)
    # Fill deck trapezoid
    for dy in range(16, 35):
        t = (dy - 16) / 18.0
        x_left = int(8 - 4 * t)
        x_right = int(87 + 4 * t)
        rect(img, x_left, dy, x_right - x_left + 1, 1, "WOOD_BASE")

    # Deck floor planks running side-to-side with seams
    for py in (20, 24, 28, 32):
        for px_col in range(6, 90, 8):
            px(img, px_col, py, "WOOD_SHADOW")
    # Top highlight rim
    rect(img, 8, 16, 80, 1, "WOOD_LIGHT")

    # Front stage edge moulding (y=34..37, x=4..91)
    rect(img, 4, 34, 88, 3, "WOOD_LIGHT")
    rect(img, 4, 36, 88, 1, "WOOD_SHADOW")

    # 2. Stage riser apron / front face (y=37..55)
    rect(img, 4, 37, 88, 18, "WOOD_DEEP")
    # Corner posts at left and right
    rect(img, 4, 34, 5, 21, "WOOD_BASE")
    rect(img, 4, 34, 2, 21, "WOOD_LIGHT")
    rect(img, 87, 34, 5, 21, "WOOD_BASE")
    rect(img, 87, 34, 2, 21, "WOOD_LIGHT")

    # Scalloped red velvet stage curtain valance / skirt across front apron (x=9..86, y=37..52)
    # 6 scalloped swag folds
    for sw in range(6):
        sx0 = 9 + sw * 13
        # Red velvet swag drape
        ellipse(img, sx0 + 6.0, 42.0, 6.0, 5.0, "CLOTH_RED_BASE", filled=True)
        ellipse(img, sx0 + 5.0, 40.5, 4.5, 3.5, "CLOTH_RED_LIGHT", filled=True)
        ellipse(img, sx0 + 6.0, 44.0, 5.5, 2.5, "CLOTH_RED_SHADOW", filled=True)
        # Gold fringe trim along bottom of each scallop
        for fx in range(sx0 + 1, sx0 + 12):
            px(img, fx, 47, "GOLD_BASE")
            px(img, fx, 48, "GOLD_LIGHT")
        # Gold hanging tassel at scallop joint
        px(img, sx0, 49, "GOLD_BASE")
        px(img, sx0, 50, "GOLD_LIGHT")

    # Base skirting rail touching y=55
    rect(img, 4, 53, 88, 3, "WOOD_BASE")
    rect(img, 4, 53, 88, 1, "WOOD_LIGHT")
    rect(img, 4, 55, 88, 1, "WOOD_SHADOW")

    # 3. Brass footlights along the front rim (y=32..35)
    # 4 footlights at x=18, 38, 58, 78
    for fx in (18, 38, 58, 78):
        # Brass clam-shell reflector
        ellipse(img, fx, 34.0, 3.5, 2.5, "GOLD_BASE", filled=True)
        px(img, fx - 1, 33, "GOLD_LIGHT")
        # Glowing candle flame inside footlight
        ellipse(img, fx, 31.0, 1.5, 2.5, "FLAME_YELLOW", filled=True)
        px(img, fx, 30, "FLAME_ORANGE")

    # 4. Upper side curtain drapes (swags at stage edges)
    # Left drape (x=4..13, y=4..30)
    rect(img, 4, 4, 9, 24, "CLOTH_RED_BASE")
    rect(img, 5, 4, 3, 24, "CLOTH_RED_LIGHT")
    rect(img, 11, 4, 2, 24, "CLOTH_RED_SHADOW")
    rect(img, 4, 18, 10, 2, "GOLD_BASE")  # gold tieback sash
    # Right drape (x=83..91, y=4..30)
    rect(img, 83, 4, 9, 24, "CLOTH_RED_BASE")
    rect(img, 84, 4, 3, 24, "CLOTH_RED_LIGHT")
    rect(img, 90, 4, 2, 24, "CLOTH_RED_SHADOW")
    rect(img, 82, 18, 10, 2, "GOLD_BASE")  # gold tieback sash

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def draw_prop_lute() -> Image.Image:
    """24x32 minstrel's lute resting on an instrument stand."""
    w, h = 24, 32
    img = new_canvas(w, h)

    # 1. Lute soundbox / bowl (centered at x=12, y=14..29)
    ellipse(img, 12.0, 21.5, 6.5, 7.5, "WOOD_BASE", filled=True)
    ellipse(img, 11.0, 20.0, 5.0, 6.0, "WOOD_LIGHT", filled=True)
    ellipse(img, 13.5, 23.0, 4.5, 5.5, "WOOD_SHADOW", filled=True)
    # Soundhole rosette
    ellipse(img, 12.0, 19.0, 1.8, 1.8, "WOOD_DEEP", filled=True)
    px(img, 12, 19, "GOLD_BASE")
    # Bridge
    rect(img, 10, 25, 5, 2, "WOOD_DEEP")

    # 2. Lute neck & pegbox (y=3..15, x=11..13)
    rect(img, 11, 7, 3, 8, "WOOD_BASE")
    rect(img, 11, 7, 1, 8, "WOOD_LIGHT")
    # Frets
    for fy in (9, 11, 13):
        px(img, 12, fy, "METAL_LIGHT")
    # Angled pegbox at headstock (y=3..7)
    rect(img, 10, 3, 4, 4, "WOOD_SHADOW")
    # Gold tuning pegs
    px(img, 9, 4, "GOLD_LIGHT")
    px(img, 9, 6, "GOLD_BASE")
    px(img, 14, 4, "GOLD_LIGHT")
    px(img, 14, 6, "GOLD_BASE")

    # 3. Wooden instrument floor stand (touching y=31)
    # Cradle arms holding lute
    line(img, 6, 27, 9, 29, "WOOD_SHADOW")
    line(img, 18, 27, 15, 29, "WOOD_SHADOW")
    # Stand legs touching base
    line(img, 7, 27, 6, 31, "WOOD_BASE")
    line(img, 17, 27, 18, 31, "WOOD_BASE")
    line(img, 12, 28, 12, 31, "WOOD_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def draw_prop_harp() -> Image.Image:
    """28x40 bardic Celtic folk harp."""
    w, h = 28, 40
    img = new_canvas(w, h)

    # 1. Base pedestal touching y=39 (x=12..25, y=35..39)
    rect(img, 12, 36, 14, 4, "WOOD_BASE")
    rect(img, 12, 36, 14, 1, "WOOD_LIGHT")
    rect(img, 12, 39, 14, 1, "WOOD_SHADOW")

    # 2. Soundbox sloping diagonally from base up to upper neck
    # x=14..24 at y=36, tapering up to x=10..15 at y=8
    for sy in range(8, 36):
        t = (sy - 8) / 28.0
        sx = int(11 + 7 * t)
        rect(img, sx, sy, 4, 1, "WOOD_BASE")
        px(img, sx, sy, "WOOD_LIGHT")
        px(img, sx + 3, sy, "WOOD_SHADOW")
    # Gold inlay line down soundbox
    for sy in range(12, 34, 2):
        t = (sy - 8) / 28.0
        sx = int(12 + 7 * t)
        px(img, sx, sy, "GOLD_BASE")

    # 3. Curved wooden forepillar on left (x=4..10, y=6..38)
    line(img, 10, 7, 5, 14, "WOOD_BASE")
    line(img, 5, 14, 4, 24, "WOOD_BASE")
    line(img, 4, 24, 7, 34, "WOOD_BASE")
    line(img, 7, 34, 12, 37, "WOOD_BASE")
    # Pillar highlight & shadow thickness
    line(img, 9, 7, 4, 14, "WOOD_LIGHT")
    line(img, 4, 14, 3, 24, "WOOD_LIGHT")
    line(img, 3, 24, 6, 34, "WOOD_LIGHT")
    line(img, 6, 34, 11, 37, "WOOD_LIGHT")
    # Carved Celtic scroll at crown
    ellipse(img, 8.0, 7.0, 2.5, 2.5, "GOLD_LIGHT", filled=True)

    # 4. Harmonic neck / arch across top (x=6..21, y=5..10)
    line(img, 8, 7, 14, 5, "WOOD_LIGHT")
    line(img, 14, 5, 21, 8, "WOOD_BASE")
    line(img, 8, 8, 14, 6, "WOOD_BASE")
    line(img, 14, 6, 21, 9, "WOOD_SHADOW")
    # Gold tuning pins on underside of neck
    for px_pin in range(10, 20, 2):
        px(img, px_pin, 7, "GOLD_LIGHT")

    # 5. Golden strings running between neck and soundbox
    for str_i in range(6):
        x_top = 10 + str_i * 2
        y_top = 8
        x_bot = 13 + int(str_i * 1.8)
        y_bot = 14 + str_i * 4
        line(img, x_top, y_top, x_bot, y_bot, "GOLD_LIGHT")

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def draw_candles_cluster() -> Image.Image:
    """20x20 cluster of tavern candles with dripping tallow and warm flame halos."""
    w, h = 20, 20
    img = new_canvas(w, h)

    # 1. Pool of melted wax at base touching y=19 (x=3..17, y=16..19)
    ellipse(img, 10.5, 17.5, 7.0, 2.5, "CREAM_SHADOW", filled=True)
    ellipse(img, 9.5, 17.0, 5.5, 1.8, "CREAM_LIGHT", filled=True)

    # 2. Tall candle (center-left: x=8..11, y=5..18)
    rect(img, 8, 7, 4, 11, "CREAM_LIGHT")
    rect(img, 10, 7, 2, 11, "CREAM_SHADOW")
    # Wax drip on left
    px(img, 7, 10, "CREAM_LIGHT")
    px(img, 7, 11, "CREAM_LIGHT")
    # Wick
    px(img, 9, 5, "OUTLINE_WARM")
    # Flame
    ellipse(img, 9.5, 3.0, 1.5, 2.2, "FLAME_YELLOW", filled=True)
    px(img, 9, 1, "FLAME_ORANGE")

    # 3. Medium candle (right: x=12..15, y=9..18)
    rect(img, 12, 11, 4, 7, "CREAM_LIGHT")
    rect(img, 14, 11, 2, 7, "CREAM_SHADOW")
    # Wax drip
    px(img, 16, 14, "CREAM_LIGHT")
    # Wick
    px(img, 13, 9, "OUTLINE_WARM")
    # Flame
    ellipse(img, 13.5, 7.0, 1.5, 2.0, "FLAME_YELLOW", filled=True)
    px(img, 13, 5, "FLAME_ORANGE")

    # 4. Short candle (front-left: x=4..7, y=12..19)
    rect(img, 4, 14, 4, 5, "CREAM_LIGHT")
    rect(img, 6, 14, 2, 5, "CREAM_SHADOW")
    # Wick
    px(img, 5, 12, "OUTLINE_WARM")
    # Flame
    ellipse(img, 5.5, 10.0, 1.2, 1.8, "FLAME_YELLOW", filled=True)
    px(img, 5, 8, "FLAME_ORANGE")

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


def draw_plant_pot() -> Image.Image:
    """24x36 decorative tavern houseplant in terracotta pot."""
    w, h = 24, 36
    img = new_canvas(w, h)

    # 1. Terracotta planter pot (y=21..35, x=5..18)
    # Planter rim
    rect(img, 5, 21, 14, 4, "ROAST_BASE")
    rect(img, 5, 21, 14, 1, "ROAST_LIGHT")
    rect(img, 5, 24, 14, 1, "ROAST_SHADOW")
    # Pot body tapering down
    for py in range(25, 36):
        t = (py - 25) / 10.0
        x0 = int(6 + 2 * t)
        x1 = int(17 - 2 * t)
        rect(img, x0, py, x1 - x0 + 1, 1, "ROAST_BASE")
        px(img, x0, py, "ROAST_LIGHT")
        px(img, x1, py, "ROAST_SHADOW")
    # Dark potting soil in pot
    ellipse(img, 11.5, 22.0, 5.5, 1.5, "WOOD_DEEP", filled=True)

    # 2. Lush green cascading foliage (y=3..22, x=2..21)
    # Center upright stem & leaves
    line(img, 12, 21, 12, 6, "LEAF_BASE")
    ellipse(img, 12.0, 5.0, 3.5, 3.5, "LEAF_LIGHT", filled=True)
    ellipse(img, 12.0, 5.0, 2.0, 2.0, "LEAF_BASE", filled=True)

    # Left arching fronds
    line(img, 11, 20, 5, 11, "LEAF_BASE")
    ellipse(img, 5.0, 10.0, 3.5, 2.5, "LEAF_LIGHT", filled=True)
    px(img, 3, 9, "LEAF_BASE")
    line(img, 10, 19, 3, 16, "LEAF_BASE")
    ellipse(img, 3.5, 16.5, 2.5, 2.0, "LEAF_LIGHT", filled=True)

    # Right arching fronds
    line(img, 13, 20, 18, 11, "LEAF_BASE")
    ellipse(img, 18.0, 10.0, 3.5, 2.5, "LEAF_LIGHT", filled=True)
    px(img, 20, 9, "LEAF_SHADOW")
    line(img, 14, 19, 20, 16, "LEAF_BASE")
    ellipse(img, 20.0, 16.5, 2.5, 2.0, "LEAF_LIGHT", filled=True)

    # Foreground leaves cascading over pot rim
    ellipse(img, 8.5, 22.5, 2.5, 2.0, "LEAF_LIGHT", filled=True)
    ellipse(img, 15.0, 23.0, 2.5, 2.0, "LEAF_LIGHT", filled=True)

    return finalize_prop(img, "OUTLINE_WARM", hangs=False)


# ==============================================================================
# SECTION 3: HANGING DECOR (hangs=True)
# ==============================================================================

def draw_lantern_wall() -> Image.Image:
    """16x24 ornate iron wall sconce with glowing lantern."""
    w, h = 16, 24
    img = new_canvas(w, h)

    # 1. Iron wall mounting plate (x=2..5, y=3..10)
    rect(img, 2, 3, 3, 8, "METAL_BASE")
    rect(img, 2, 3, 1, 8, "METAL_LIGHT")
    rect(img, 4, 3, 1, 8, "METAL_SHADOW")
    # Mounting screws
    px(img, 3, 4, "GOLD_BASE")
    px(img, 3, 9, "GOLD_BASE")

    # 2. Curved iron bracket arm arching to right (x=4..11, y=4..9)
    line(img, 4, 5, 9, 5, "METAL_BASE")
    line(img, 9, 5, 11, 8, "METAL_LIGHT")
    px(img, 10, 8, "METAL_BASE")
    # Hanging loop
    px(img, 11, 9, "METAL_LIGHT")
    px(img, 11, 10, "METAL_SHADOW")

    # 3. Lantern cage (x=7..15, y=11..22)
    # Peaked roof cap
    rect(img, 8, 11, 7, 2, "METAL_BASE")
    rect(img, 9, 11, 5, 1, "METAL_LIGHT")
    px(img, 11, 10, "METAL_LIGHT")
    # Glass lantern body (y=13..19)
    rect(img, 8, 13, 7, 7, "FLAME_YELLOW")
    rect(img, 9, 14, 5, 5, "FLAME_ORANGE")
    px(img, 11, 15, "FLAME_YELLOW")  # bright flame core
    px(img, 11, 16, "FLAME_EMBER")
    # Corner iron cage bars
    rect(img, 8, 13, 1, 7, "METAL_SHADOW")
    rect(img, 14, 13, 1, 7, "METAL_SHADOW")
    # Lantern base & finial (y=20..22)
    rect(img, 8, 20, 7, 2, "METAL_BASE")
    px(img, 11, 22, "METAL_LIGHT")

    return finalize_prop(img, "OUTLINE_COOL", hangs=True)


def draw_string_lights() -> Image.Image:
    """64x20 festive sagging string lights with colorful glowing lanterns."""
    w, h = 64, 20
    img = new_canvas(w, h)

    # 1. Catenary wire dipping across 64px span
    # y = 3 at x=0, dipping to y=8 at x=32, rising to y=3 at x=63
    for x in range(64):
        # Parabolic dip
        norm_x = (x - 32) / 32.0
        wy = int(8 - 5 * (1.0 - norm_x * norm_x))
        px(img, x, wy, "OUTLINE_WARM")
        px(img, x, wy + 1, "METAL_SHADOW")

    # 2. Hanging colorful lanterns at 7 points
    # bulb positions and colors
    bulbs = [
        (5, "FLAME_YELLOW", "FLAME_ORANGE"),
        (14, "POTION_RED", "CLOTH_RED_LIGHT"),
        (23, "POTION_GREEN", "LEAF_LIGHT"),
        (32, "FLAME_YELLOW", "GOLD_LIGHT"),
        (41, "POTION_BLUE", "CLOTH_ACCENT_LIGHT"),
        (50, "FLAME_ORANGE", "FLAME_YELLOW"),
        (59, "POTION_PURPLE", "POTION_RED"),
    ]

    for bx, col_core, col_high in bulbs:
        norm_x = (bx - 32) / 32.0
        wy = int(8 - 5 * (1.0 - norm_x * norm_x))
        # Socket / cord hanger
        rect(img, bx, wy + 2, 2, 2, "METAL_BASE")
        # Glass bulb body (4x5)
        rect(img, bx - 1, wy + 4, 4, 5, col_core)
        px(img, bx, wy + 5, col_high)
        px(img, bx, wy + 6, "CREAM_LIGHT")  # filament shine
        # Outline around bulb
        rect(img, bx - 1, wy + 4, 4, 5, "OUTLINE_WARM", filled=False)

    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_banner_red() -> Image.Image:
    """24x48 medieval tavern red banner with gold crest & swallowtail fringe."""
    w, h = 24, 48
    img = new_canvas(w, h)

    # 1. Hanging wooden crossbar at top (y=3..5, x=2..21)
    rect(img, 2, 3, 20, 3, "WOOD_BASE")
    rect(img, 2, 3, 20, 1, "WOOD_LIGHT")
    # Carved finials at ends
    ellipse(img, 2.5, 4.5, 2.0, 2.0, "GOLD_LIGHT", filled=True)
    ellipse(img, 21.5, 4.5, 2.0, 2.0, "GOLD_LIGHT", filled=True)
    # Suspension ring & cord
    px(img, 11, 1, "METAL_LIGHT")
    px(img, 12, 1, "METAL_LIGHT")
    px(img, 11, 2, "OUTLINE_COOL")
    px(img, 12, 2, "OUTLINE_COOL")

    # 2. Main red cloth banner field (x=4..19, y=6..45)
    # Base fill
    for by in range(6, 42):
        rect(img, 4, by, 16, 1, "CLOTH_RED_BASE")
    # Left highlight fold
    rect(img, 5, 6, 2, 35, "CLOTH_RED_LIGHT")
    # Right shadow fold
    rect(img, 17, 6, 2, 35, "CLOTH_RED_SHADOW")

    # 3. Gold heraldic emblem in center (y=15..27, centered at x=11.5)
    # Rampant crest / crown
    rect(img, 8, 15, 8, 2, "GOLD_LIGHT")
    px(img, 8, 14, "GOLD_LIGHT")
    px(img, 11, 13, "GOLD_LIGHT")
    px(img, 12, 13, "GOLD_LIGHT")
    px(img, 15, 14, "GOLD_LIGHT")
    # Crossed mugs emblem
    rect(img, 9, 18, 6, 6, "GOLD_BASE")
    rect(img, 10, 19, 4, 4, "GOLD_LIGHT")
    px(img, 11, 20, "CLOTH_RED_BASE")
    px(img, 12, 20, "CLOTH_RED_BASE")
    rect(img, 8, 25, 8, 2, "GOLD_BASE")

    # 4. Swallowtail / swallow-forked bottom cut (y=40..45)
    # Left tail: x=4..10 reaches y=45
    # Right tail: x=13..19 reaches y=45
    # Center cutout: from y=39 up at x=11..12
    for ty in range(40, 46):
        # cut out center triangle
        cut_w = int((ty - 39) * 1.5)
        left_w = max(0, 8 - cut_w)
        right_start = min(19, 15 + cut_w - 4)
        if left_w > 0:
            rect(img, 4, ty, left_w, 1, "CLOTH_RED_BASE")
            px(img, 5, ty, "CLOTH_RED_LIGHT")
        if right_start < 20:
            rect(img, right_start, ty, 20 - right_start, 1, "CLOTH_RED_BASE")
            px(img, 18, ty, "CLOTH_RED_SHADOW")

    # Gold fringe and hanging tassels at bottom tips
    px(img, 4, 45, "GOLD_LIGHT")
    px(img, 5, 45, "GOLD_BASE")
    px(img, 18, 45, "GOLD_BASE")
    px(img, 19, 45, "GOLD_LIGHT")

    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_banner_accent() -> Image.Image:
    """24x48 royal teal banner matching CLOTH_ACCENT ramp."""
    w, h = 24, 48
    img = new_canvas(w, h)

    # 1. Hanging wooden crossbar at top (y=3..5, x=2..21)
    rect(img, 2, 3, 20, 3, "WOOD_BASE")
    rect(img, 2, 3, 20, 1, "WOOD_LIGHT")
    ellipse(img, 2.5, 4.5, 2.0, 2.0, "GOLD_LIGHT", filled=True)
    ellipse(img, 21.5, 4.5, 2.0, 2.0, "GOLD_LIGHT", filled=True)
    px(img, 11, 1, "METAL_LIGHT")
    px(img, 12, 1, "METAL_LIGHT")
    px(img, 11, 2, "OUTLINE_COOL")
    px(img, 12, 2, "OUTLINE_COOL")

    # 2. Main teal cloth banner field (x=4..19, y=6..45)
    for by in range(6, 42):
        rect(img, 4, by, 16, 1, "CLOTH_ACCENT_BASE")
    rect(img, 5, 6, 2, 35, "CLOTH_ACCENT_LIGHT")
    rect(img, 17, 6, 2, 35, "CLOTH_ACCENT_SHADOW")

    # 3. Gold heraldic emblem (harp & stars)
    ellipse(img, 11.5, 20.5, 4.5, 5.5, "GOLD_BASE", filled=True)
    ellipse(img, 11.5, 20.5, 3.0, 4.0, "CLOTH_ACCENT_BASE", filled=True)
    line(img, 10, 18, 10, 23, "GOLD_LIGHT")
    line(img, 12, 18, 12, 23, "GOLD_LIGHT")
    # Crown atop harp
    px(img, 9, 14, "GOLD_LIGHT")
    px(img, 11, 13, "GOLD_LIGHT")
    px(img, 12, 13, "GOLD_LIGHT")
    px(img, 14, 14, "GOLD_LIGHT")

    # 4. Swallowtail bottom cut (y=40..45)
    for ty in range(40, 46):
        cut_w = int((ty - 39) * 1.5)
        left_w = max(0, 8 - cut_w)
        right_start = min(19, 15 + cut_w - 4)
        if left_w > 0:
            rect(img, 4, ty, left_w, 1, "CLOTH_ACCENT_BASE")
            px(img, 5, ty, "CLOTH_ACCENT_LIGHT")
        if right_start < 20:
            rect(img, right_start, ty, 20 - right_start, 1, "CLOTH_ACCENT_BASE")
            px(img, 18, ty, "CLOTH_ACCENT_SHADOW")

    # Gold tassels at tips
    px(img, 4, 45, "GOLD_LIGHT")
    px(img, 5, 45, "GOLD_BASE")
    px(img, 18, 45, "GOLD_BASE")
    px(img, 19, 45, "GOLD_LIGHT")

    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_painting_landscape() -> Image.Image:
    """32x28 framed tavern oil painting (hills/sky/tree)."""
    w, h = 32, 28
    img = new_canvas(w, h)

    # 1. Hanging wire at top (y=0..2)
    line(img, 15, 0, 10, 3, "METAL_BASE")
    line(img, 16, 0, 21, 3, "METAL_BASE")

    # 2. Ornate gilded wooden frame (x=2..29, y=3..25)
    rect(img, 2, 3, 28, 23, "WOOD_BASE")
    # Outer gold bevel
    rect(img, 3, 4, 26, 21, "GOLD_BASE")
    rect(img, 3, 4, 26, 1, "GOLD_LIGHT")
    rect(img, 3, 4, 1, 21, "GOLD_LIGHT")
    rect(img, 3, 24, 26, 1, "WOOD_SHADOW")
    rect(img, 28, 4, 1, 21, "WOOD_SHADOW")

    # 3. Canvas aperture inside frame (x=5..26, y=6..22)
    # Sky (daylight blue)
    rect(img, 5, 6, 22, 7, "CLOTH_ACCENT_LIGHT")
    # Puffy white cumulus cloud
    ellipse(img, 18.0, 8.5, 4.0, 2.0, "CREAM_LIGHT", filled=True)
    ellipse(img, 17.5, 9.5, 3.0, 1.5, "CREAM_SHADOW", filled=True)

    # Distant blue-gray mountain peaks (y=11..14)
    line(img, 5, 13, 9, 10, "STONE_BASE")
    line(img, 9, 10, 14, 13, "STONE_BASE")
    line(img, 14, 13, 19, 11, "STONE_SHADOW")
    line(img, 19, 11, 26, 14, "STONE_SHADOW")

    # Rolling green meadow hills (y=13..22)
    ellipse(img, 12.0, 19.0, 9.0, 6.0, "LEAF_BASE", filled=True)
    ellipse(img, 21.0, 18.0, 8.0, 5.0, "LEAF_LIGHT", filled=True)
    rect(img, 5, 19, 22, 4, "LEAF_SHADOW")

    # Tiny timber cottage on hillside (x=10..16, y=14..18)
    rect(img, 10, 15, 6, 4, "WOOD_BASE")
    # Red roof
    line(img, 9, 15, 13, 13, "CLOTH_RED_BASE")
    line(img, 13, 13, 17, 15, "CLOTH_RED_LIGHT")
    # Chimney smoke
    px(img, 14, 12, "CREAM_LIGHT")
    px(img, 15, 11, "CREAM_LIGHT")

    # Little oak tree on right (x=21..25, y=14..21)
    rect(img, 23, 17, 2, 4, "WOOD_DEEP")  # trunk
    ellipse(img, 23.5, 15.0, 3.0, 3.0, "LEAF_LIGHT", filled=True)
    ellipse(img, 24.0, 16.0, 2.5, 2.0, "LEAF_BASE", filled=True)

    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_trophy_stag() -> Image.Image:
    """32x32 mounted stag head trophy on wooden heraldic shield plaque."""
    w, h = 32, 32
    img = new_canvas(w, h)

    # 1. Oak heraldic shield plaque (centered at x=15.5, y=7..28)
    # Shield shape
    rect(img, 10, 8, 12, 12, "WOOD_BASE")
    rect(img, 11, 20, 10, 4, "WOOD_BASE")
    rect(img, 13, 24, 6, 3, "WOOD_BASE")
    px(img, 15, 27, "WOOD_BASE")
    px(img, 16, 27, "WOOD_BASE")
    # Plaque highlight edge & shadow edge
    rect(img, 10, 8, 1, 12, "WOOD_LIGHT")
    rect(img, 10, 8, 12, 1, "WOOD_LIGHT")
    rect(img, 21, 8, 1, 12, "WOOD_SHADOW")

    # 2. Carved stag head & neck (y=13..26, centered at x=15.5)
    # Neck
    ellipse(img, 15.5, 21.0, 4.5, 5.0, "ROAST_BASE", filled=True)
    ellipse(img, 14.5, 20.0, 3.5, 4.0, "ROAST_LIGHT", filled=True)
    # Head & muzzle
    ellipse(img, 15.5, 16.0, 3.5, 4.0, "ROAST_BASE", filled=True)
    rect(img, 14, 18, 4, 3, "PARCHMENT_LIGHT")  # snout
    px(img, 14, 20, "WOOD_DEEP")  # nostril
    px(img, 17, 20, "WOOD_DEEP")
    # Dark eyes
    px(img, 13, 15, "OUTLINE_WARM")
    px(img, 18, 15, "OUTLINE_WARM")
    # Perked ears
    line(img, 12, 14, 9, 12, "ROAST_BASE")
    px(img, 9, 11, "ROAST_LIGHT")
    line(img, 19, 14, 22, 12, "ROAST_BASE")
    px(img, 22, 11, "ROAST_LIGHT")

    # 3. Grand branching antlers (x=3..28, y=2..14)
    # Left antler stem
    line(img, 14, 12, 10, 7, "CREAM_LIGHT")
    line(img, 10, 7, 7, 3, "CREAM_LIGHT")
    # Left tines
    line(img, 11, 8, 7, 7, "CREAM_LIGHT")
    line(img, 8, 5, 4, 4, "CREAM_LIGHT")
    line(img, 9, 7, 9, 4, "CREAM_SHADOW")

    # Right antler stem
    line(img, 17, 12, 21, 7, "CREAM_LIGHT")
    line(img, 21, 7, 24, 3, "CREAM_LIGHT")
    # Right tines
    line(img, 20, 8, 24, 7, "CREAM_LIGHT")
    line(img, 23, 5, 27, 4, "CREAM_LIGHT")
    line(img, 22, 7, 22, 4, "CREAM_SHADOW")

    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_chandelier() -> Image.Image:
    """48x40 gleaming two-tier brass chandelier with warm burning wax candles."""
    w, h = 48, 40
    img = new_canvas(w, h)

    # 1. Brass ceiling canopy & central chain shaft
    rect(img, 21, 1, 6, 3, "GOLD_LIGHT")
    rect(img, 22, 4, 4, 16, "GOLD_BASE")
    rect(img, 23, 4, 2, 16, "GOLD_LIGHT")

    # 2. Upper smaller brass ring (y=11..15)
    ellipse(img, 23.5, 13.0, 10.5, 2.5, "GOLD_BASE", filled=True)
    ellipse(img, 23.5, 12.6, 10.0, 2.0, "GOLD_LIGHT", filled=False)

    # Diagonal brass suspension struts to lower grand wheel
    for dx0, dy0, dx1, dy1 in ((14, 13, 6, 23), (33, 13, 41, 23)):
        line(img, dx0, dy0, dx1, dy1, "GOLD_BASE")
        line(img, dx0 + 1, dy0, dx1 + 1, dy1, "GOLD_LIGHT")

    # 3. Grand lower brass wheel rim (y=21..29, x=4..43)
    ellipse(img, 23.5, 25.0, 19.0, 4.5, "GOLD_BASE", filled=True)
    ellipse(img, 23.5, 25.0, 15.5, 2.5, TRANSPARENT, filled=True)
    ellipse(img, 23.5, 24.3, 18.5, 3.8, "GOLD_LIGHT", filled=False)

    # Bottom ornate finial drop
    rect(img, 22, 28, 4, 5, "GOLD_BASE")
    rect(img, 23, 33, 2, 3, "GOLD_LIGHT")

    # 4. Bright cream wax candles + 3-tone flames
    candle_positions = [(6, 22), (13, 25), (23, 26), (34, 25), (41, 22), (15, 12), (32, 12)]
    for cx, cy in candle_positions:
        rect(img, cx - 1, cy, 4, 2, "GOLD_LIGHT")
        rect(img, cx, cy - 4, 2, 4, "CREAM_LIGHT")
        rect(img, cx, cy - 7, 2, 3, "FLAME_ORANGE")
        px(img, cx, cy - 6, "FLAME_YELLOW")
        px(img, cx + 1, cy - 5, "FLAME_YELLOW")
        px(img, cx, cy - 8, "FLAME_EMBER")

    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


# ==============================================================================
# SECTION 4: ASSEMBLED RUG (64x64 master sliced into 4 quadrants of 32x32)
# ==============================================================================

def make_rug_accent_master() -> Image.Image:
    """Master 64x64 royal teal & gold rug with closed OUTLINE_WARM perimeter."""
    w, h = 64, 64
    img = new_canvas(w, h, "CLOTH_ACCENT_BASE")

    # 1. Closed OUTLINE_WARM border around 64x64 perimeter
    for x in range(64):
        px(img, x, 0, "OUTLINE_WARM")
        px(img, x, 63, "OUTLINE_WARM")
    for y in range(64):
        px(img, 0, y, "OUTLINE_WARM")
        px(img, 63, y, "OUTLINE_WARM")

    # 2. Outer gold braided fringe & border bands (rows/cols 1..3)
    for x in range(1, 63):
        px(img, x, 1, "GOLD_BASE")
        px(img, x, 62, "GOLD_BASE")
        px(img, x, 2, "GOLD_LIGHT")
        px(img, x, 61, "GOLD_LIGHT")
        px(img, x, 3, "CLOTH_ACCENT_SHADOW")
        px(img, x, 60, "CLOTH_ACCENT_SHADOW")
    for y in range(1, 63):
        px(img, 1, y, "GOLD_BASE")
        px(img, 62, y, "GOLD_BASE")
        px(img, 2, y, "GOLD_LIGHT")
        px(img, 61, y, "GOLD_LIGHT")
        px(img, 3, y, "CLOTH_ACCENT_SHADOW")
        px(img, 60, y, "CLOTH_ACCENT_SHADOW")

    # Corner tassels in outer fringe
    for cx, cy in ((2, 2), (61, 2), (2, 61), (61, 61)):
        rect(img, cx - 1, cy - 1, 3, 3, "GOLD_LIGHT")
        px(img, cx, cy, "CLOTH_RED_BASE")

    # 3. Inner teal damask diamond pattern
    for y in range(6, 58, 4):
        for x in range(6, 58, 4):
            if ((x + y) // 4) % 2 == 0:
                px(img, x, y, "CLOTH_ACCENT_LIGHT")
            else:
                px(img, x, y, "CLOTH_ACCENT_SHADOW")

    # 4. Corner arabesque scrollwork (in 4 corners)
    corner_boxes = [(5, 5), (46, 5), (5, 46), (46, 46)]
    for bx, by in corner_boxes:
        rect(img, bx, by, 13, 13, "CLOTH_ACCENT_SHADOW", filled=False)
        ellipse(img, bx + 6.0, by + 6.0, 4.5, 4.5, "GOLD_BASE", filled=True)
        ellipse(img, bx + 6.0, by + 6.0, 3.0, 3.0, "GOLD_LIGHT", filled=True)
        px(img, bx + 6, by + 6, "CLOTH_RED_BASE")

    # 5. Grand central sunburst medallion (centered at 31.5, 31.5)
    ellipse(img, 31.5, 31.5, 16.0, 16.0, "GOLD_BASE", filled=True)
    ellipse(img, 31.5, 31.5, 14.5, 14.5, "CLOTH_ACCENT_SHADOW", filled=True)
    ellipse(img, 31.5, 31.5, 12.5, 12.5, "CLOTH_ACCENT_BASE", filled=True)
    ellipse(img, 31.5, 31.5, 10.0, 10.0, "GOLD_LIGHT", filled=True)
    ellipse(img, 31.5, 31.5, 7.5, 7.5, "CLOTH_RED_BASE", filled=True)
    ellipse(img, 31.5, 31.5, 5.0, 5.0, "GOLD_BASE", filled=True)
    ellipse(img, 31.5, 31.5, 2.5, 2.5, "CREAM_LIGHT", filled=True)

    # 8 radiating golden star points from center
    for ang_i in range(8):
        import math
        rad = ang_i * (math.pi / 4.0)
        px1 = int(round(31.5 + 13.0 * math.cos(rad)))
        py1 = int(round(31.5 + 13.0 * math.sin(rad)))
        px(img, px1, py1, "GOLD_LIGHT")

    return img


_RUG_MASTER_CACHE: Image.Image | None = None

def _get_rug_master() -> Image.Image:
    global _RUG_MASTER_CACHE
    if _RUG_MASTER_CACHE is None:
        _RUG_MASTER_CACHE = make_rug_accent_master()
    return _RUG_MASTER_CACHE


def draw_rug_accent_tl() -> Image.Image:
    """Top-left 32x32 quadrant of assembled rug."""
    return _get_rug_master().crop((0, 0, 32, 32))


def draw_rug_accent_tr() -> Image.Image:
    """Top-right 32x32 quadrant of assembled rug."""
    return _get_rug_master().crop((32, 0, 64, 32))


def draw_rug_accent_bl() -> Image.Image:
    """Bottom-left 32x32 quadrant of assembled rug."""
    return _get_rug_master().crop((0, 32, 32, 64))


def draw_rug_accent_br() -> Image.Image:
    """Bottom-right 32x32 quadrant of assembled rug."""
    return _get_rug_master().crop((32, 32, 64, 64))


# ==============================================================================
# SECTION 5: 16x16 RECIPE ICONS
# ==============================================================================

def draw_icon_ale() -> Image.Image:
    """16x16 foamy glass/wooden beer tankard."""
    img = new_canvas(16, 16)
    # Mug body
    rect(img, 3, 5, 8, 8, "ALE_BASE")
    rect(img, 4, 6, 2, 6, "ALE_LIGHT")
    rect(img, 3, 12, 8, 1, "WOOD_SHADOW")
    # Handle on right
    rect(img, 11, 7, 3, 5, "OUTLINE_WARM")
    rect(img, 11, 8, 2, 3, TRANSPARENT)
    # Frothy foam top
    rect(img, 2, 3, 10, 3, "CREAM_LIGHT")
    px(img, 2, 5, "CREAM_SHADOW")
    px(img, 11, 5, "CREAM_SHADOW")
    px(img, 6, 2, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_tea() -> Image.Image:
    """16x16 warm ceramic teacup with steaming tea."""
    img = new_canvas(16, 16)
    # Saucer
    rect(img, 2, 12, 12, 2, "CREAM_LIGHT")
    rect(img, 2, 13, 12, 1, "CREAM_SHADOW")
    # Teacup
    rect(img, 4, 7, 8, 5, "CREAM_LIGHT")
    rect(img, 9, 7, 3, 5, "CREAM_SHADOW")
    # Handle
    rect(img, 11, 8, 3, 3, "OUTLINE_WARM")
    px(img, 12, 9, TRANSPARENT)
    # Herbal tea surface
    rect(img, 5, 7, 6, 1, "ALE_LIGHT")
    px(img, 7, 7, "LEAF_LIGHT")
    # Rising steam wisps
    px(img, 6, 4, "CREAM_LIGHT")
    px(img, 7, 3, "CREAM_LIGHT")
    px(img, 8, 4, "CREAM_SHADOW")
    px(img, 9, 2, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_bread_cheese() -> Image.Image:
    """16x16 sourdough loaf paired with yellow cheese wedge."""
    img = new_canvas(16, 16)
    # Crusty bread loaf on left
    ellipse(img, 5.0, 9.5, 4.0, 3.5, "ROAST_BASE", filled=True)
    ellipse(img, 4.5, 8.5, 3.0, 2.5, "ROAST_LIGHT", filled=True)
    line(img, 3, 7, 4, 9, "PARCHMENT_LIGHT")
    line(img, 6, 7, 7, 9, "PARCHMENT_LIGHT")
    # Sharp cheese wedge on right
    line(img, 8, 12, 14, 12, "GOLD_BASE")
    line(img, 8, 12, 14, 8, "GOLD_LIGHT")
    line(img, 14, 8, 14, 12, "GOLD_BASE")
    rect(img, 9, 9, 5, 3, "GOLD_LIGHT")
    px(img, 11, 10, "CREAM_LIGHT")  # cheese hole
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_stew() -> Image.Image:
    """16x16 steaming hearty stew bowl with spoon."""
    img = new_canvas(16, 16)
    # Clay stew bowl
    ellipse(img, 7.5, 10.0, 6.0, 3.5, "STONE_BASE", filled=True)
    rect(img, 2, 7, 12, 2, "STONE_LIGHT")
    # Savory stew surface
    ellipse(img, 7.5, 8.0, 4.5, 1.8, "ROAST_BASE", filled=True)
    px(img, 6, 8, "ALE_LIGHT")
    px(img, 9, 8, "LEAF_LIGHT")
    px(img, 7, 9, "ROAST_LIGHT")
    # Wooden spoon sticking out
    line(img, 10, 7, 13, 2, "WOOD_LIGHT")
    px(img, 14, 2, "WOOD_BASE")
    # Steam curls
    px(img, 5, 4, "CREAM_LIGHT")
    px(img, 6, 3, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_mead() -> Image.Image:
    """16x16 golden honey mead horn/flagon."""
    img = new_canvas(16, 16)
    # Drinking horn body
    ellipse(img, 7.5, 8.5, 5.0, 5.0, "GOLD_BASE", filled=True)
    ellipse(img, 7.0, 7.5, 4.0, 4.0, "GOLD_LIGHT", filled=True)
    # Curving tip
    line(img, 4, 11, 3, 14, "ROAST_BASE")
    px(img, 2, 14, "GOLD_BASE")
    # Gold rim bands
    rect(img, 7, 3, 6, 2, "GOLD_LIGHT")
    # Frothy foam spilling over top
    ellipse(img, 10.0, 3.5, 3.0, 2.0, "CREAM_LIGHT", filled=True)
    px(img, 12, 4, "CREAM_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_roast_chicken() -> Image.Image:
    """16x16 golden roasted drumstick with bone."""
    img = new_canvas(16, 16)
    # Plump crispy drumstick bulb
    ellipse(img, 6.0, 7.0, 4.5, 4.0, "ROAST_BASE", filled=True)
    ellipse(img, 5.0, 6.0, 3.5, 3.0, "ROAST_LIGHT", filled=True)
    px(img, 4, 5, "FLAME_YELLOW")  # crispy glaze highlight
    # Bone shaft & double knuckle
    line(img, 9, 9, 13, 13, "CREAM_LIGHT")
    px(img, 12, 14, "CREAM_LIGHT")
    px(img, 14, 12, "CREAM_LIGHT")
    px(img, 13, 14, "CREAM_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_wine() -> Image.Image:
    """16x16 elegant goblet filled with ruby wine."""
    img = new_canvas(16, 16)
    # Goblet bowl
    ellipse(img, 7.5, 5.5, 4.5, 3.5, "GOLD_BASE", filled=True)
    ellipse(img, 7.5, 5.0, 3.5, 2.5, "CLOTH_RED_BASE", filled=True)
    px(img, 6, 4, "CLOTH_RED_LIGHT")  # wine highlight
    # Stem
    rect(img, 7, 8, 2, 4, "GOLD_BASE")
    px(img, 7, 8, "GOLD_LIGHT")
    # Goblet foot
    rect(img, 4, 12, 8, 2, "GOLD_BASE")
    rect(img, 5, 12, 6, 1, "GOLD_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_pie() -> Image.Image:
    """16x16 lattice tavern berry pie."""
    img = new_canvas(16, 16)
    # Metal pie tin
    ellipse(img, 7.5, 9.5, 6.5, 3.5, "METAL_BASE", filled=True)
    # Berry filling underneath
    ellipse(img, 7.5, 8.5, 5.5, 2.5, "CLOTH_RED_BASE", filled=True)
    px(img, 8, 8, "CLOTH_RED_LIGHT")
    # Golden lattice pastry strips
    line(img, 4, 8, 11, 8, "ROAST_LIGHT")
    line(img, 5, 7, 10, 10, "ROAST_LIGHT")
    line(img, 10, 7, 5, 10, "ROAST_LIGHT")
    # Fluted pie crust rim
    ellipse(img, 7.5, 8.5, 5.5, 2.5, "ROAST_BASE", filled=False)
    px(img, 2, 8, "ROAST_LIGHT")
    px(img, 13, 8, "ROAST_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_nectar() -> Image.Image:
    """16x16 shimmering nectar vial with sparkle."""
    img = new_canvas(16, 16)
    # Crystal vial body
    rect(img, 4, 6, 6, 8, "POTION_BLUE")
    rect(img, 5, 8, 4, 5, "GOLD_LIGHT")
    px(img, 6, 9, "FLAME_YELLOW")
    # Specular glass edge
    rect(img, 4, 6, 1, 7, "CREAM_LIGHT")
    # Cork
    rect(img, 5, 3, 4, 3, "WOOD_LIGHT")
    # Sparkle star on right
    px(img, 12, 3, "GOLD_LIGHT")
    line(img, 12, 2, 12, 4, "CREAM_LIGHT")
    line(img, 11, 3, 13, 3, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_ribs() -> Image.Image:
    """16x16 rack of smoky barbecue tavern ribs."""
    img = new_canvas(16, 16)
    # Glazed meat slab
    rect(img, 2, 5, 12, 6, "ROAST_BASE")
    rect(img, 3, 5, 10, 2, "ROAST_LIGHT")
    rect(img, 2, 10, 12, 1, "ROAST_SHADOW")
    # Grill marks
    for mx in (4, 7, 10):
        line(img, mx, 5, mx, 10, "ROAST_SHADOW")
    # Bone tips poking out bottom
    for bx in (3, 6, 9, 12):
        rect(img, bx, 11, 2, 3, "CREAM_LIGHT")
        px(img, bx + 1, 13, "CREAM_SHADOW")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_stout() -> Image.Image:
    """16x16 pint glass of dark stout with creamy foam."""
    img = new_canvas(16, 16)
    # Dark stout body
    rect(img, 4, 5, 8, 9, "WOOD_DEEP")
    rect(img, 5, 6, 2, 7, "ROAST_SHADOW")
    rect(img, 4, 13, 8, 1, "METAL_SHADOW")
    # Thick frothy tan/cream foam head
    rect(img, 3, 2, 10, 4, "CREAM_LIGHT")
    px(img, 3, 5, "CREAM_SHADOW")
    px(img, 12, 5, "CREAM_SHADOW")
    px(img, 7, 2, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_pheasant() -> Image.Image:
    """16x16 roast game bird on pewter dish."""
    img = new_canvas(16, 16)
    # Pewter plate
    ellipse(img, 7.5, 11.0, 7.0, 3.0, "METAL_BASE", filled=True)
    ellipse(img, 7.5, 10.5, 6.0, 2.0, "METAL_LIGHT", filled=True)
    # Roasted bird
    ellipse(img, 7.5, 7.5, 5.0, 4.0, "ROAST_BASE", filled=True)
    ellipse(img, 6.5, 6.5, 3.5, 2.5, "ROAST_LIGHT", filled=True)
    # Drumstick leg
    line(img, 10, 7, 13, 6, "CREAM_LIGHT")
    # Herb garnish
    px(img, 3, 9, "LEAF_LIGHT")
    px(img, 4, 8, "CLOTH_RED_BASE")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


# ==============================================================================
# SECTION 6: 16x16 ITEM / HUD / UPGRADE ICONS
# ==============================================================================

def draw_icon_ration() -> Image.Image:
    """16x16 adventurer travel ration pack."""
    img = new_canvas(16, 16)
    # Burlap parcel
    rect(img, 3, 4, 10, 9, "PARCHMENT_BASE")
    rect(img, 4, 5, 8, 2, "PARCHMENT_LIGHT")
    rect(img, 3, 12, 10, 1, "PARCHMENT_SHADOW")
    # Cross twine ties
    line(img, 8, 4, 8, 12, "WOOD_DEEP")
    line(img, 3, 8, 12, 8, "WOOD_DEEP")
    # Slice of sausage / dried provision peeking out
    ellipse(img, 11.0, 10.0, 2.0, 2.0, "ROAST_LIGHT", filled=True)
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_potion_red() -> Image.Image:
    """16x16 round flask of health potion."""
    img = new_canvas(16, 16)
    # Cork
    rect(img, 7, 2, 2, 2, "WOOD_LIGHT")
    # Neck
    rect(img, 7, 4, 2, 2, "CREAM_SHADOW")
    # Spherical bulb filled with crimson liquid
    ellipse(img, 7.5, 9.5, 5.0, 5.0, "POTION_RED", filled=True)
    ellipse(img, 6.5, 8.5, 3.5, 3.5, "CLOTH_RED_LIGHT", filled=True)
    # Specular shine
    px(img, 5, 7, "CREAM_LIGHT")
    px(img, 5, 8, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_COOL", hangs=True)


def draw_icon_potion_blue() -> Image.Image:
    """16x16 diamond flask of mana potion."""
    img = new_canvas(16, 16)
    # Cork
    rect(img, 7, 2, 2, 2, "WOOD_LIGHT")
    # Neck
    rect(img, 7, 4, 2, 2, "CREAM_SHADOW")
    # Phial body filled with azure mana
    ellipse(img, 7.5, 9.5, 4.5, 5.0, "POTION_BLUE", filled=True)
    ellipse(img, 6.5, 8.5, 3.0, 3.5, "CLOTH_ACCENT_LIGHT", filled=True)
    # Specular highlight
    px(img, 5, 7, "CREAM_LIGHT")
    px(img, 5, 8, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_COOL", hangs=True)


def draw_icon_coin() -> Image.Image:
    """16x16 embossed gold coin."""
    img = new_canvas(16, 16)
    ellipse(img, 7.5, 7.5, 6.0, 6.0, "GOLD_BASE", filled=True)
    ellipse(img, 7.0, 7.0, 5.0, 5.0, "GOLD_LIGHT", filled=True)
    # Inner rim / star imprint
    ellipse(img, 7.5, 7.5, 3.0, 3.0, "GOLD_BASE", filled=False)
    px(img, 7, 7, "CREAM_LIGHT")  # coin glint
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_rep_star() -> Image.Image:
    """16x16 5-pointed golden reputation star."""
    img = new_canvas(16, 16)
    # Golden 5-point star
    # Center diamond
    ellipse(img, 7.5, 7.5, 4.0, 4.0, "GOLD_BASE", filled=True)
    ellipse(img, 7.0, 7.0, 3.0, 3.0, "GOLD_LIGHT", filled=True)
    # Top point
    line(img, 7, 2, 7, 6, "GOLD_LIGHT")
    line(img, 8, 2, 8, 6, "GOLD_BASE")
    # Left / right arms
    line(img, 2, 7, 6, 7, "GOLD_LIGHT")
    line(img, 9, 7, 13, 7, "GOLD_BASE")
    # Bottom feet
    line(img, 4, 12, 6, 9, "GOLD_LIGHT")
    line(img, 11, 12, 9, 9, "GOLD_BASE")
    # Center sparkle
    px(img, 7, 7, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def _finish_icon(img: Image.Image, out_col: str = "OUTLINE_WARM") -> Image.Image:
    return finalize_prop(outline(img, out_col), out_col, hangs=True)


def draw_icon_upg_table() -> Image.Image:
    """16x16 tavern dining table upgrade icon."""
    img = new_canvas(16, 16)
    rect(img, 2, 5, 12, 4, "WOOD_BASE")
    rect(img, 2, 5, 12, 1, "WOOD_LIGHT")
    rect(img, 2, 8, 12, 1, "WOOD_SHADOW")
    rect(img, 3, 9, 2, 5, "WOOD_BASE")
    rect(img, 11, 9, 2, 5, "WOOD_BASE")
    rect(img, 7, 2, 3, 3, "ALE_LIGHT")
    px(img, 8, 2, "CREAM_LIGHT")
    return _finish_icon(img, "OUTLINE_WARM")


def draw_icon_upg_build() -> Image.Image:
    """16x16 sturdy carpenter hammer & gable icon."""
    img = new_canvas(16, 16)
    # Thick wooden handle (3px wide diagonal so interior wood stays bright!)
    for i in range(7):
        rect(img, 2 + i, 12 - i, 3, 2, "WOOD_BASE")
        px(img, 2 + i, 12 - i, "WOOD_LIGHT")
    # Gleaming forged steel hammer head
    rect(img, 6, 2, 8, 4, "METAL_BASE")
    rect(img, 6, 2, 8, 1, "METAL_LIGHT")
    rect(img, 6, 3, 3, 2, "METAL_LIGHT")
    rect(img, 12, 5, 2, 2, "METAL_SHADOW")
    img = outline(img, "OUTLINE_WARM")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_upg_staff() -> Image.Image:
    """16x16 maid headdress / staff hire icon."""
    img = new_canvas(16, 16)
    # Frilled white maid headband
    rect(img, 3, 4, 10, 4, "CREAM_LIGHT")
    px(img, 4, 3, "CREAM_LIGHT")
    px(img, 7, 3, "CREAM_LIGHT")
    px(img, 8, 3, "CREAM_LIGHT")
    px(img, 11, 3, "CREAM_LIGHT")
    rect(img, 3, 7, 10, 1, "CREAM_SHADOW")
    # Royal teal bow ribbon
    rect(img, 5, 8, 6, 4, "CLOTH_ACCENT_BASE")
    px(img, 6, 9, "CLOTH_ACCENT_LIGHT")
    px(img, 9, 9, "CLOTH_ACCENT_LIGHT")
    # Golden center brooch
    px(img, 7, 9, "GOLD_LIGHT")
    px(img, 8, 9, "GOLD_BASE")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_upg_decor() -> Image.Image:
    """16x16 tavern decor / wall banner ornament icon."""
    img = new_canvas(16, 16)
    # Golden heraldic shield
    rect(img, 4, 3, 8, 7, "GOLD_BASE")
    rect(img, 5, 3, 6, 1, "GOLD_LIGHT")
    rect(img, 5, 10, 6, 2, "GOLD_BASE")
    px(img, 7, 12, "GOLD_BASE")
    px(img, 8, 12, "GOLD_BASE")
    # Crimson velvet inner inlay
    rect(img, 6, 5, 4, 4, "CLOTH_RED_BASE")
    px(img, 7, 6, "CLOTH_RED_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_icon_bed() -> Image.Image:
    """16x16 cozy inn bedroom bed icon."""
    img = new_canvas(16, 16)
    # Wooden headboard on left
    rect(img, 2, 4, 3, 10, "WOOD_BASE")
    rect(img, 2, 4, 3, 1, "WOOD_LIGHT")
    # Mattress and red quilt blanket
    rect(img, 5, 8, 9, 6, "CLOTH_RED_BASE")
    rect(img, 5, 8, 9, 1, "CLOTH_RED_LIGHT")
    rect(img, 5, 13, 9, 1, "CLOTH_RED_SHADOW")
    # White fluffy pillow
    rect(img, 5, 5, 4, 3, "CREAM_LIGHT")
    rect(img, 5, 7, 4, 1, "CREAM_SHADOW")
    # Bed footboard post
    rect(img, 13, 7, 2, 7, "WOOD_BASE")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


# ==============================================================================
# SECTION 7: 16x16 EMOTE BUBBLES
# ==============================================================================

def _base_emote_bubble() -> Image.Image:
    """Speech bubble frame with pointer tail."""
    img = new_canvas(16, 16)
    # Rounded bubble body: x=1..14, y=1..11
    rect(img, 2, 1, 11, 11, "CREAM_LIGHT")
    rect(img, 1, 2, 13, 9, "CREAM_LIGHT")
    # Shadow along bottom and right inner border
    for x in range(3, 14):
        px(img, x, 10, "CREAM_SHADOW")
    for y in range(3, 11):
        px(img, 13, y, "CREAM_SHADOW")
    # Speech bubble pointer tail at bottom-left
    px(img, 3, 12, "CREAM_LIGHT")
    px(img, 4, 12, "CREAM_LIGHT")
    px(img, 3, 13, "CREAM_LIGHT")
    px(img, 4, 13, "CREAM_SHADOW")
    px(img, 3, 14, "CREAM_LIGHT")
    return img


def draw_emote_heart() -> Image.Image:
    """16x16 speech bubble with heart."""
    img = _base_emote_bubble()
    for p in ((4, 4), (5, 4), (7, 4), (8, 4)):
        px(img, p[0], p[1], "CLOTH_RED_BASE")
    for x in range(3, 10):
        px(img, x, 5, "CLOTH_RED_BASE")
        px(img, x, 6, "CLOTH_RED_BASE")
    for x in range(4, 9):
        px(img, x, 7, "CLOTH_RED_BASE")
    for x in range(5, 8):
        px(img, x, 8, "CLOTH_RED_BASE")
    px(img, 6, 9, "CLOTH_RED_BASE")
    px(img, 4, 5, "CLOTH_RED_LIGHT")
    px(img, 7, 5, "CLOTH_RED_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_exclaim() -> Image.Image:
    """16x16 speech bubble with exclamation mark."""
    img = _base_emote_bubble()
    rect(img, 6, 3, 2, 5, "FLAME_ORANGE")
    px(img, 6, 3, "FLAME_YELLOW")
    px(img, 7, 7, "FLAME_EMBER")
    # Dot
    rect(img, 6, 9, 2, 2, "FLAME_ORANGE")
    px(img, 6, 9, "FLAME_YELLOW")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_question() -> Image.Image:
    """16x16 speech bubble with question mark."""
    img = _base_emote_bubble()
    rect(img, 5, 3, 4, 1, "CLOTH_ACCENT_BASE")
    rect(img, 7, 4, 2, 2, "CLOTH_ACCENT_BASE")
    rect(img, 6, 6, 2, 2, "CLOTH_ACCENT_BASE")
    px(img, 5, 3, "CLOTH_ACCENT_LIGHT")
    # Dot
    rect(img, 6, 9, 2, 2, "CLOTH_ACCENT_BASE")
    px(img, 6, 9, "CLOTH_ACCENT_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_anger() -> Image.Image:
    """16x16 speech bubble with anime anger vein."""
    img = _base_emote_bubble()
    # 4 curved anger cross veins
    line(img, 4, 4, 9, 4, "CLOTH_RED_BASE")
    line(img, 4, 8, 9, 8, "CLOTH_RED_BASE")
    line(img, 4, 4, 4, 8, "CLOTH_RED_BASE")
    line(img, 9, 4, 9, 8, "CLOTH_RED_BASE")
    line(img, 6, 3, 7, 3, "CLOTH_RED_LIGHT")
    line(img, 6, 9, 7, 9, "FLAME_EMBER")
    px(img, 5, 5, "CLOTH_RED_LIGHT")
    px(img, 8, 5, "CLOTH_RED_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_zzz() -> Image.Image:
    """16x16 speech bubble with sleep Zzz."""
    img = _base_emote_bubble()
    # Large Z (top-left)
    rect(img, 4, 3, 4, 1, "CLOTH_ACCENT_BASE")
    px(img, 6, 4, "CLOTH_ACCENT_BASE")
    px(img, 5, 5, "CLOTH_ACCENT_BASE")
    rect(img, 4, 6, 4, 1, "CLOTH_ACCENT_BASE")
    # Medium z (middle)
    rect(img, 7, 6, 3, 1, "CLOTH_ACCENT_LIGHT")
    px(img, 8, 7, "CLOTH_ACCENT_LIGHT")
    rect(img, 7, 8, 3, 1, "CLOTH_ACCENT_LIGHT")
    # Small z (bottom-right)
    rect(img, 9, 8, 2, 1, "CLOTH_ACCENT_BASE")
    px(img, 9, 9, "CLOTH_ACCENT_BASE")
    rect(img, 9, 10, 2, 1, "CLOTH_ACCENT_BASE")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_sparkle() -> Image.Image:
    """16x16 speech bubble with 4-point golden sparkle."""
    img = _base_emote_bubble()
    ellipse(img, 6.5, 6.0, 3.5, 3.5, "GOLD_BASE", filled=True)
    ellipse(img, 6.5, 6.0, 2.0, 2.0, "GOLD_LIGHT", filled=True)
    line(img, 6, 3, 7, 3, "GOLD_LIGHT")
    line(img, 6, 9, 7, 9, "GOLD_BASE")
    line(img, 3, 6, 4, 6, "GOLD_LIGHT")
    line(img, 9, 6, 10, 6, "GOLD_BASE")
    px(img, 6, 6, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_music() -> Image.Image:
    """16x16 speech bubble with musical notes."""
    img = _base_emote_bubble()
    # Noteheads
    ellipse(img, 5.0, 8.5, 1.5, 1.2, "WOOD_DEEP", filled=True)
    ellipse(img, 9.0, 7.5, 1.5, 1.2, "WOOD_DEEP", filled=True)
    # Stems
    line(img, 6, 8, 6, 4, "WOOD_DEEP")
    line(img, 10, 7, 10, 3, "WOOD_DEEP")
    # Top beam
    rect(img, 6, 3, 5, 2, "WOOD_DEEP")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


def draw_emote_coin() -> Image.Image:
    """16x16 speech bubble with mini gold coin."""
    img = _base_emote_bubble()
    ellipse(img, 6.5, 6.0, 3.5, 3.5, "GOLD_BASE", filled=True)
    ellipse(img, 6.0, 5.5, 2.5, 2.5, "GOLD_LIGHT", filled=True)
    px(img, 6, 6, "CREAM_LIGHT")
    return finalize_prop(img, "OUTLINE_WARM", hangs=True)


# ==============================================================================
# SECTION 8: 9-SLICE UI SKINS (size=(24,24), footprint=(0,0), layer="ui")
# ==============================================================================

def draw_ui_panel_wood() -> Image.Image:
    """24x24 9-slice wooden UI panel skin."""
    w, h = 24, 24
    img = new_canvas(w, h, "WOOD_BASE")

    # 1. Closed OUTLINE_WARM outer border with 1px cut bevelled corners
    # Corner cuts
    for cx, cy in ((0, 0), (23, 0), (0, 23), (23, 23)):
        px(img, cx, cy, TRANSPARENT)

    # Outer border edges
    for x in range(1, 23):
        px(img, x, 0, "OUTLINE_WARM")
        px(img, x, 23, "OUTLINE_WARM")
    for y in range(1, 23):
        px(img, 0, y, "OUTLINE_WARM")
        px(img, 23, y, "OUTLINE_WARM")

    # 2. Bevel highlights & shadows
    # Top & left inner highlight
    for x in range(1, 23):
        px(img, x, 1, "WOOD_LIGHT")
    for y in range(1, 23):
        px(img, 1, y, "WOOD_LIGHT")
    # Bottom & right inner shadow
    for x in range(1, 23):
        px(img, x, 22, "WOOD_DEEP")
    for y in range(1, 23):
        px(img, 22, y, "WOOD_DEEP")

    # Second inner groove
    for x in range(2, 22):
        px(img, x, 2, "WOOD_SHADOW")
        px(img, x, 21, "WOOD_SHADOW")
    for y in range(2, 22):
        px(img, 2, y, "WOOD_SHADOW")
        px(img, 21, y, "WOOD_SHADOW")

    # 3. Corner brass reinforcement rivets (in 8px corner regions)
    for rx, ry in ((4, 4), (19, 4), (4, 19), (19, 19)):
        px(img, rx, ry, "GOLD_BASE")
        px(img, rx - 1, ry - 1, "GOLD_LIGHT")

    return img


def draw_ui_panel_parchment() -> Image.Image:
    """24x24 9-slice parchment UI panel skin."""
    w, h = 24, 24
    img = new_canvas(w, h, "PARCHMENT_BASE")

    # Cut corners
    for cx, cy in ((0, 0), (23, 0), (0, 23), (23, 23)):
        px(img, cx, cy, TRANSPARENT)

    # Outer border edges
    for x in range(1, 23):
        px(img, x, 0, "OUTLINE_WARM")
        px(img, x, 23, "OUTLINE_WARM")
    for y in range(1, 23):
        px(img, 0, y, "OUTLINE_WARM")
        px(img, 23, y, "OUTLINE_WARM")

    # Inner bevel
    for x in range(1, 23):
        px(img, x, 1, "PARCHMENT_LIGHT")
        px(img, x, 22, "PARCHMENT_SHADOW")
    for y in range(1, 23):
        px(img, 1, y, "PARCHMENT_LIGHT")
        px(img, 22, y, "PARCHMENT_SHADOW")

    # Decorative corner brackets
    for rx, ry in ((3, 3), (20, 3), (3, 20), (20, 20)):
        px(img, rx, ry, "GOLD_BASE")

    return img


def draw_ui_button_wood() -> Image.Image:
    """24x24 9-slice tactile wooden UI button skin."""
    w, h = 24, 24
    img = new_canvas(w, h, "WOOD_BASE")

    # Cut corners
    for cx, cy in ((0, 0), (23, 0), (0, 23), (23, 23)):
        px(img, cx, cy, TRANSPARENT)

    # Outer border edges
    for x in range(1, 23):
        px(img, x, 0, "OUTLINE_WARM")
        px(img, x, 23, "OUTLINE_WARM")
    for y in range(1, 23):
        px(img, 0, y, "OUTLINE_WARM")
        px(img, 23, y, "OUTLINE_WARM")

    # 2px prominent raised top-left button highlight lip
    for x in range(1, 23):
        px(img, x, 1, "WOOD_LIGHT")
        px(img, x, 2, "WOOD_LIGHT")
    for y in range(1, 23):
        px(img, 1, y, "WOOD_LIGHT")
        px(img, 2, y, "WOOD_LIGHT")

    # 2px bottom-right deep button shadow lip
    for x in range(1, 23):
        px(img, x, 21, "WOOD_SHADOW")
        px(img, x, 22, "WOOD_DEEP")
    for y in range(1, 23):
        px(img, 21, y, "WOOD_SHADOW")
        px(img, 22, y, "WOOD_DEEP")

    return img


def draw_ui_button_gold() -> Image.Image:
    """24x24 9-slice opulent golden UI button skin."""
    w, h = 24, 24
    img = new_canvas(w, h, "GOLD_BASE")

    # Cut corners
    for cx, cy in ((0, 0), (23, 0), (0, 23), (23, 23)):
        px(img, cx, cy, TRANSPARENT)

    # Outer border edges
    for x in range(1, 23):
        px(img, x, 0, "OUTLINE_WARM")
        px(img, x, 23, "OUTLINE_WARM")
    for y in range(1, 23):
        px(img, 0, y, "OUTLINE_WARM")
        px(img, 23, y, "OUTLINE_WARM")

    # Radiant golden highlight bevel
    for x in range(1, 23):
        px(img, x, 1, "GOLD_LIGHT")
        px(img, x, 2, "GOLD_LIGHT")
    for y in range(1, 23):
        px(img, 1, y, "GOLD_LIGHT")
        px(img, 2, y, "GOLD_LIGHT")

    # Bottom-right shadow bevel
    for x in range(1, 23):
        px(img, x, 21, "GOLD_BASE")
        px(img, x, 22, "WOOD_SHADOW")
    for y in range(1, 23):
        px(img, 21, y, "GOLD_BASE")
        px(22, y, "WOOD_SHADOW") if False else px(img, 22, y, "WOOD_SHADOW")

    return img


# ==============================================================================
# REGISTRY DEFINITION: PROPS_KITCHEN_DECOR_ICONS
# ==============================================================================

PROPS_KITCHEN_DECOR_ICONS: dict[str, AssetSpec] = {
    # Kitchen (layer="prop")
    "stove_cauldron": AssetSpec(
        fn=draw_stove_cauldron,
        footprint=(2, 1),
        layer="prop",
        hangs=False,
    ),
    "prep_counter": AssetSpec(
        fn=draw_prep_counter,
        footprint=(2, 1),
        layer="prop",
        hangs=False,
    ),
    "spit_roast": AssetSpec(
        fn=draw_spit_roast,
        footprint=(2, 1),
        layer="prop",
        hangs=False,
    ),
    "pantry": AssetSpec(
        fn=draw_pantry,
        footprint=(2, 1),
        layer="prop",
        hangs=False,
    ),

    # Entertainment & Decor (layer="prop" / "tabletop")
    "stage_small": AssetSpec(
        fn=draw_stage_small,
        footprint=(3, 2),
        layer="prop",
        hangs=False,
    ),
    "prop_lute": AssetSpec(
        fn=draw_prop_lute,
        footprint=(1, 1),
        layer="prop",
        hangs=False,
    ),
    "prop_harp": AssetSpec(
        fn=draw_prop_harp,
        footprint=(1, 1),
        layer="prop",
        hangs=False,
    ),
    "candles_cluster": AssetSpec(
        fn=draw_candles_cluster,
        footprint=(1, 1),
        layer="tabletop",
        hangs=False,
    ),
    "plant_pot": AssetSpec(
        fn=draw_plant_pot,
        footprint=(1, 1),
        layer="prop",
        hangs=False,
    ),

    # Hanging decor (hangs=True, layer="prop")
    "lantern_wall": AssetSpec(
        fn=draw_lantern_wall,
        footprint=(1, 1),
        layer="prop",
        hangs=True,
    ),
    "string_lights": AssetSpec(
        fn=draw_string_lights,
        footprint=(2, 1),
        layer="prop",
        hangs=True,
    ),
    "banner_red": AssetSpec(
        fn=draw_banner_red,
        footprint=(1, 1),
        layer="prop",
        hangs=True,
    ),
    "banner_accent": AssetSpec(
        fn=draw_banner_accent,
        footprint=(1, 1),
        layer="prop",
        hangs=True,
    ),
    "painting_landscape": AssetSpec(
        fn=draw_painting_landscape,
        footprint=(1, 1),
        layer="prop",
        hangs=True,
    ),
    "trophy_stag": AssetSpec(
        fn=draw_trophy_stag,
        footprint=(1, 1),
        layer="prop",
        hangs=True,
    ),
    "chandelier": AssetSpec(
        fn=draw_chandelier,
        footprint=(2, 1),
        layer="prop",
        hangs=True,
    ),

    # Assembled rug quadrants (32x32 each, layer="rug", multi_group="rug_accent")
    "rug_accent_tl": AssetSpec(
        fn=draw_rug_accent_tl,
        footprint=(1, 1),
        layer="rug",
        multi_group="rug_accent",
        multi_pos=(0, 0),
    ),
    "rug_accent_tr": AssetSpec(
        fn=draw_rug_accent_tr,
        footprint=(1, 1),
        layer="rug",
        multi_group="rug_accent",
        multi_pos=(1, 0),
    ),
    "rug_accent_bl": AssetSpec(
        fn=draw_rug_accent_bl,
        footprint=(1, 1),
        layer="rug",
        multi_group="rug_accent",
        multi_pos=(0, 1),
    ),
    "rug_accent_br": AssetSpec(
        fn=draw_rug_accent_br,
        footprint=(1, 1),
        layer="rug",
        multi_group="rug_accent",
        multi_pos=(1, 1),
    ),

    # 16x16 Recipe icons (size=(16,16), footprint=(0,0), layer="icon", hangs=True)
    "icon_ale": AssetSpec(
        fn=draw_icon_ale,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_tea": AssetSpec(
        fn=draw_icon_tea,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_bread_cheese": AssetSpec(
        fn=draw_icon_bread_cheese,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_stew": AssetSpec(
        fn=draw_icon_stew,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_mead": AssetSpec(
        fn=draw_icon_mead,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_roast_chicken": AssetSpec(
        fn=draw_icon_roast_chicken,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_wine": AssetSpec(
        fn=draw_icon_wine,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_pie": AssetSpec(
        fn=draw_icon_pie,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_nectar": AssetSpec(
        fn=draw_icon_nectar,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_ribs": AssetSpec(
        fn=draw_icon_ribs,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_stout": AssetSpec(
        fn=draw_icon_stout,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_pheasant": AssetSpec(
        fn=draw_icon_pheasant,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),

    # 16x16 Item / HUD / Upgrade icons
    "icon_ration": AssetSpec(
        fn=draw_icon_ration,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_potion_red": AssetSpec(
        fn=draw_icon_potion_red,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_potion_blue": AssetSpec(
        fn=draw_icon_potion_blue,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_coin": AssetSpec(
        fn=draw_icon_coin,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_rep_star": AssetSpec(
        fn=draw_icon_rep_star,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_upg_table": AssetSpec(
        fn=draw_icon_upg_table,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_upg_build": AssetSpec(
        fn=draw_icon_upg_build,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_upg_staff": AssetSpec(
        fn=draw_icon_upg_staff,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_upg_decor": AssetSpec(
        fn=draw_icon_upg_decor,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "icon_bed": AssetSpec(
        fn=draw_icon_bed,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),

    # 16x16 Emote bubbles
    "emote_heart": AssetSpec(
        fn=draw_emote_heart,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_exclaim": AssetSpec(
        fn=draw_emote_exclaim,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_question": AssetSpec(
        fn=draw_emote_question,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_anger": AssetSpec(
        fn=draw_emote_anger,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_zzz": AssetSpec(
        fn=draw_emote_zzz,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_sparkle": AssetSpec(
        fn=draw_emote_sparkle,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_music": AssetSpec(
        fn=draw_emote_music,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),
    "emote_coin": AssetSpec(
        fn=draw_emote_coin,
        footprint=(0, 0),
        layer="icon",
        hangs=True,
    ),

    # 9-Slice UI Skins (size=(24,24), footprint=(0,0), layer="ui")
    "ui_panel_wood": AssetSpec(
        fn=draw_ui_panel_wood,
        footprint=(0, 0),
        layer="ui",
        hangs=True,
    ),
    "ui_panel_parchment": AssetSpec(
        fn=draw_ui_panel_parchment,
        footprint=(0, 0),
        layer="ui",
        hangs=True,
    ),
    "ui_button_wood": AssetSpec(
        fn=draw_ui_button_wood,
        footprint=(0, 0),
        layer="ui",
        hangs=True,
    ),
    "ui_button_gold": AssetSpec(
        fn=draw_ui_button_gold,
        footprint=(0, 0),
        layer="ui",
        hangs=True,
    ),
}
