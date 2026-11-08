"""Deterministic layered paper-doll NPC sprite & bust portrait generator for Nyah & Fifi's Tavern.

Matches Nyah & Fifi's 48x48 chibi scale and passes tools/qa_assets.py.
"""

from __future__ import annotations
import hashlib
import io
import json
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.palette_chars import (
    CHAR_PALETTE_RGBA,
    CHAR_OUTLINE_RGBA_SET,
    CHAR_ALL_RGBA_SET,
    ccol,
    SKIN_RAMPS,
    HAIR_RAMPS,
    OUTFIT_RAMPS,
)
from tools.draw_helpers import outline
from tools.qa_assets import check_image_qa, QAReport

RGBA = tuple[int, int, int, int]
TRANSPARENT: RGBA = (0, 0, 0, 0)

# Minimal 5x7 crisp bitmap glyph table for labeled contact preview
GLYPHS_5X7: dict[str, tuple[str, ...]] = {
    "A": (".###.", "#...#", "#####", "#...#", "#...#"),
    "B": ("####.", "#...#", "####.", "#...#", "####."),
    "C": (".####", "#....", "#....", "#....", ".####"),
    "D": ("####.", "#...#", "#...#", "#...#", "####."),
    "E": ("#####", "#....", "####.", "#....", "#####"),
    "F": ("#####", "#....", "####.", "#....", "#...."),
    "G": (".####", "#....", "#..##", "#...#", ".####"),
    "H": ("#...#", "#...#", "#####", "#...#", "#...#"),
    "I": (".###.", "..#..", "..#..", "..#..", ".###."),
    "J": ("..###", "...#.", "...#.", "#..#.", ".##.."),
    "K": ("#..#.", "#.#..", "##...", "#.#..", "#..#."),
    "L": ("#....", "#....", "#....", "#....", "#####"),
    "M": ("#...#", "##.##", "#.#.#", "#...#", "#...#"),
    "N": ("#...#", "##..#", "#.#.#", "#..##", "#...#"),
    "O": (".###.", "#...#", "#...#", "#...#", ".###."),
    "P": ("####.", "#...#", "####.", "#....", "#...."),
    "Q": (".###.", "#...#", "#.#.#", "#..#.", ".##.#"),
    "R": ("####.", "#...#", "####.", "#.#..", "#..#."),
    "S": (".####", "#....", ".###.", "....#", "####."),
    "T": ("#####", "..#..", "..#..", "..#..", "..#.."),
    "U": ("#...#", "#...#", "#...#", "#...#", ".###."),
    "V": ("#...#", "#...#", "#...#", ".#.#.", "..#.."),
    "W": ("#...#", "#...#", "#.#.#", "##.##", "#...#"),
    "X": ("#...#", ".#.#.", "..#..", ".#.#.", "#...#"),
    "Y": ("#...#", ".#.#.", "..#..", "..#..", "..#.."),
    "Z": ("#####", "...#.", "..#..", ".#...", "#####"),
    "0": (".###.", "#..##", "#.#.#", "##..#", ".###."),
    "1": ("..#..", ".##..", "..#..", "..#..", ".###."),
    "2": ("####.", "....#", ".###.", "#....", "#####"),
    "3": ("####.", "....#", ".###.", "....#", "####."),
    "4": ("#..#.", "#..#.", "#####", "...#.", "...#."),
    "5": ("#####", "#....", "####.", "....#", "####."),
    "6": (".###.", "#....", "####.", "#...#", ".###."),
    "7": ("#####", "...#.", "..#..", ".#...", ".#..."),
    "8": (".###.", "#...#", ".###.", "#...#", ".###."),
    "9": (".###.", "#...#", ".####", "....#", ".###."),
    "_": (".....", ".....", ".....", ".....", "#####"),
    "-": (".....", ".....", ".###.", ".....", "....."),
    ":": (".....", "..#..", ".....", "..#..", "....."),
    " ": (".....", ".....", ".....", ".....", "....."),
}

FOLK_TYPES = ("human", "elf", "beastfolk", "dwarf", "halfling")
BEAST_TYPES = ("cat", "dog", "fox", "bunny")
BUILDS = ("slim", "regular", "sturdy")
SKIN_NAMES = ("porcelain", "peach", "tan", "umber")
HAIR_STYLES = ("short", "bob", "long", "ponytail", "twintails", "braids", "bun", "spiky")
HAIR_COLORS = ("raven", "brown", "blonde", "auburn", "silver")
ROLES = (
    "villager",
    "chef",
    "bartender",
    "maid",
    "musician",
    "dancer",
    "adventurer_t1",
    "adventurer_t2",
    "adventurer_t3",
    "merchant",
    "noble",
)
CUSTOMER_ARCHETYPES = ("villager", "adventurer_rookie", "adventurer_veteran", "merchant", "noble")

ROLE_TO_OUTFIT: dict[str, str] = {
    "villager": "villager",
    "chef": "chef",
    "bartender": "bartender",
    "maid": "maid",
    "musician": "musician",
    "dancer": "dancer",
    "adventurer_t1": "adventurer_t1",
    "adventurer_rookie": "adventurer_t1",
    "adventurer_t2": "adventurer_t2",
    "adventurer_veteran": "adventurer_t2",
    "adventurer_t3": "adventurer_t3",
    "merchant": "merchant",
    "noble": "noble",
}

NAMES_BY_FOLK: dict[str, list[str]] = {
    "human": ["Garrett", "Marcel", "Bennett", "Ronald", "Arthur", "Gordon", "Cedric", "Clara", "Elena", "Wendy", "Sylvia"],
    "elf": ["Lyra", "Soleil", "Faelan", "Aerin", "Vesper", "Thorne", "Elowen", "Sylvan", "Caelynn", "Illyria", "Zephyr"],
    "dwarf": ["Barnaby", "Brom", "Moira", "Thorin", "Helga", "Orin", "Greta", "Dain", "Bruna", "Torvald", "Astrid"],
    "halfling": ["Pippa", "Clover", "Milo", "Tilly", "Bram", "Rosie", "Finn", "Poppy", "Corin", "Daisy", "Toby"],
    "beastfolk": ["Roxie", "Velvet", "Kael", "Cleo", "Jax", "Luna", "Bramble", "Nomi", "Fang", "Sable", "Miri", "Felix"],
}

CLASSES_BY_ROLE: dict[str, list[str]] = {
    "villager": ["Farmer", "Baker", "Miller", "Weaver", "Carpenter", "Herbalist"],
    "adventurer_t1": ["Novice Scout", "Trainee Warrior", "Apprentice Mage", "Rookie Archer"],
    "adventurer_rookie": ["Novice Scout", "Trainee Warrior", "Apprentice Mage", "Rookie Archer"],
    "adventurer_t2": ["Ranger", "Mercenary", "Spellsword", "Rogue", "Knight"],
    "adventurer_veteran": ["Ranger", "Mercenary", "Spellsword", "Knight", "Paladin"],
    "adventurer_t3": ["Paladin", "Archmage", "Grand Champion", "Shadow Blade"],
    "merchant": ["Peddler", "Spice Trader", "Caravan Master", "Guild Merchant", "Apothecary"],
    "noble": ["Baron", "Baroness", "Lord", "Lady", "Viscount", "Countess"],
    "chef": ["Head Chef", "Sous Chef", "Master Cook"],
    "bartender": ["Master Mixologist", "Tavern Bartender"],
    "maid": ["Head Maid", "Senior Maid", "Diligent Maid"],
    "musician": ["Bard", "Troubadour", "Minstrel"],
    "dancer": ["Tavern Dancer", "Silk Performer"],
}

RECIPE_IDS = [
    "meadow_tea",
    "house_ale",
    "bread_cheese",
    "hearty_stew",
    "honey_mead",
    "trail_rations",
    "healing_draught",
    "roast_chicken",
    "mana_tonic",
    "spiced_wine",
    "hunter_pie",
    "elven_nectar",
    "boar_ribs",
    "dragonfire_stout",
    "royal_pheasant",
]


@dataclass
class CharConfig:
    seed: int
    name: str
    folk: str
    beast_type: str
    build: str
    role: str
    outfit_type: str
    skin_tone: str
    hair_style: str
    hair_color: str
    eye_color_name: str
    has_beard: bool
    head_y: int
    body_w: int
    primary_ramp: tuple[RGBA, RGBA, RGBA]
    accent_ramp: tuple[RGBA, RGBA, RGBA]
    hair_ramp: tuple[RGBA, RGBA, RGBA]
    skin_ramp: tuple[RGBA, RGBA, RGBA]
    eye_col: RGBA


def resolve_ramp(ramp_name: str) -> tuple[RGBA, RGBA, RGBA]:
    if ramp_name in SKIN_RAMPS:
        return (ccol(SKIN_RAMPS[ramp_name][0]), ccol(SKIN_RAMPS[ramp_name][1]), ccol(SKIN_RAMPS[ramp_name][2]))
    if ramp_name in HAIR_RAMPS:
        return (ccol(HAIR_RAMPS[ramp_name][0]), ccol(HAIR_RAMPS[ramp_name][1]), ccol(HAIR_RAMPS[ramp_name][2]))
    if ramp_name in OUTFIT_RAMPS:
        return (ccol(OUTFIT_RAMPS[ramp_name][0]), ccol(OUTFIT_RAMPS[ramp_name][1]), ccol(OUTFIT_RAMPS[ramp_name][2]))
    return (ccol("OUTLINE_WARM"), ccol("SKIN_LIGHT_BASE"), ccol("SKIN_LIGHT_HIGH"))


def px(img: Image.Image, x: int, y: int, color: RGBA | str) -> None:
    c = ccol(color) if isinstance(color, str) else color
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def rect(img: Image.Image, x: int, y: int, w: int, h: int, color: RGBA | str) -> None:
    c = ccol(color) if isinstance(color, str) else color
    for py in range(max(0, y), min(img.height, y + h)):
        for pxx in range(max(0, x), min(img.width, x + w)):
            img.putpixel((pxx, py), c)


def ellipse(
    img: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    color: RGBA | str,
    filled: bool = True,
) -> None:
    if rx <= 0 or ry <= 0:
        return
    c = ccol(color) if isinstance(color, str) else color
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
            px(img, pxx, py, c)
    else:
        for pxx, py in inside:
            if any((pxx + dx, py + dy) not in inside for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                px(img, pxx, py, c)


def finalize_cell(
    cell: Image.Image,
    default_outline: str | RGBA = "OUTLINE_WARM",
) -> Image.Image:
    """Ensure bottom outline touches y=47 and all borders have closed 1px outline."""
    out_col = ccol(default_outline) if isinstance(default_outline, str) else default_outline
    max_y = -1
    for y in range(48):
        for x in range(48):
            if cell.getpixel((x, y))[3] > 0 and y > max_y:
                max_y = y

    if max_y >= 0 and max_y < 46:
        diff = 46 - max_y
        shifted = Image.new("RGBA", (48, 48), TRANSPARENT)
        shifted.paste(cell, (0, diff))
        cell = shifted

    snap_pre = cell.copy()
    has_at_46 = any(snap_pre.getpixel((x, 46))[3] == 255 for x in range(48))
    if not has_at_46:
        for x in range(48):
            col_pts = [y for y in range(48) if snap_pre.getpixel((x, y))[3] == 255]
            if col_pts and max(col_pts) >= 42:
                lowest = max(col_pts)
                c_pix = snap_pre.getpixel((x, lowest))
                for fill_y in range(lowest + 1, 47):
                    cell.putpixel((x, fill_y), c_pix)

    out = outline(cell, color=out_col, outline_set=CHAR_OUTLINE_RGBA_SET)

    # Clean isolated orphans
    w, h = out.size
    cleaned = out.copy()
    for y in range(h):
        for x in range(w):
            if cleaned.getpixel((x, y))[3] == 255:
                has_opaque = any(
                    0 <= x + dx < w and 0 <= y + dy < h and cleaned.getpixel((x + dx, y + dy))[3] == 255
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                if not has_opaque:
                    cleaned.putpixel((x, y), TRANSPARENT)

    # Verify lowest row is y=47
    max_y_post = max((y for y in range(48) for x in range(48) if cleaned.getpixel((x, y))[3] == 255), default=-1)
    if max_y_post < 47:
        for x in range(20, 28):
            cleaned.putpixel((x, 47), out_col)

    return cleaned


def finalize_bust(
    bust: Image.Image,
    default_outline: str | RGBA = "OUTLINE_WARM",
) -> Image.Image:
    """Ensure bottom outline touches y=63 and all borders have closed 1px outline."""
    out_col = ccol(default_outline) if isinstance(default_outline, str) else default_outline
    max_y = -1
    for y in range(64):
        for x in range(64):
            if bust.getpixel((x, y))[3] > 0 and y > max_y:
                max_y = y

    if max_y >= 0 and max_y < 62:
        diff = 62 - max_y
        shifted = Image.new("RGBA", (64, 64), TRANSPARENT)
        shifted.paste(bust, (0, diff))
        bust = shifted

    snap = bust.copy()
    has_at_62 = any(snap.getpixel((x, 62))[3] == 255 for x in range(64))
    if not has_at_62:
        for x in range(16, 48):
            bust.putpixel((x, 62), ccol("OUTLINE_COOL"))

    out = outline(bust, color=out_col, outline_set=CHAR_OUTLINE_RGBA_SET)

    w, h = out.size
    cleaned = out.copy()
    for y in range(h):
        for x in range(w):
            if cleaned.getpixel((x, y))[3] == 255:
                has_opaque = any(
                    0 <= x + dx < w and 0 <= y + dy < h and cleaned.getpixel((x + dx, y + dy))[3] == 255
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                if not has_opaque:
                    cleaned.putpixel((x, y), TRANSPARENT)

    max_y_post = max((y for y in range(64) for x in range(64) if cleaned.getpixel((x, y))[3] == 255), default=-1)
    if max_y_post < 63:
        for x in range(14, 50):
            cleaned.putpixel((x, 63), out_col)

    return cleaned


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    return buf.getvalue()


def build_char_config(seed: int, role_override: str | None = None, preset: dict | None = None) -> CharConfig:
    rng = random.Random(seed)
    preset = preset or {}

    folk = preset.get("folk", rng.choice(FOLK_TYPES))
    beast_type = preset.get("beast_type", rng.choice(BEAST_TYPES) if folk == "beastfolk" else "cat")
    build = preset.get("build", "sturdy" if folk == "dwarf" else ("slim" if folk == "halfling" else rng.choice(BUILDS)))

    role = role_override or preset.get("role", rng.choice(ROLES))
    outfit_type = preset.get("outfit_type", ROLE_TO_OUTFIT.get(role, "villager"))

    skin_tone = preset.get("skin_tone", rng.choice(SKIN_NAMES))
    hair_style = preset.get("hair_style", rng.choice(HAIR_STYLES))
    hair_color = preset.get("hair_color", rng.choice(HAIR_COLORS))
    eye_color_name = preset.get("eye_color", rng.choice(["blue", "green", "amber", "crimson", "brown", "raven"]))

    has_beard = preset.get("has_beard", (folk == "dwarf" and rng.random() < 0.65) or (folk == "human" and rng.random() < 0.15))

    name = preset.get("name")
    if not name:
        pool = NAMES_BY_FOLK.get(folk, NAMES_BY_FOLK["human"])
        name = pool[rng.randrange(len(pool))]

    # Proportions
    if folk == "dwarf":
        head_y = 12
    elif folk == "halfling":
        head_y = 15
    else:
        head_y = 7

    body_w = -1 if build == "slim" else (1 if build == "sturdy" else 0)

    # Ramps
    skin_ramp = resolve_ramp(skin_tone)
    hair_ramp = resolve_ramp(hair_color)

    # Outfit ramps
    if outfit_type == "chef":
        prim = resolve_ramp("apron_white")
        acc = resolve_ramp("crimson")
    elif outfit_type == "bartender":
        prim = resolve_ramp("leather")
        acc = resolve_ramp("apron_white")
    elif outfit_type == "maid":
        prim = resolve_ramp("maid_dark")
        acc = resolve_ramp("apron_white")
    elif outfit_type == "musician":
        prim = resolve_ramp("crimson")
        acc = resolve_ramp("gold_trim")
    elif outfit_type == "dancer":
        prim = resolve_ramp("crimson")
        acc = resolve_ramp("gold_trim")
    elif outfit_type in ("adventurer_t1", "adventurer_rookie"):
        prim = resolve_ramp("leather")
        acc = resolve_ramp("villager_green")
    elif outfit_type in ("adventurer_t2", "adventurer_veteran"):
        prim = resolve_ramp("villager_green")
        acc = resolve_ramp("leather")
    elif outfit_type == "adventurer_t3":
        prim = resolve_ramp("steel")
        acc = resolve_ramp("gold_trim")
    elif outfit_type == "merchant":
        prim = resolve_ramp("villager_blue")
        acc = resolve_ramp("gold_trim")
    elif outfit_type == "noble":
        prim = resolve_ramp("crimson")
        acc = resolve_ramp("gold_trim")
    else:  # villager
        v_ramp = rng.choice(["villager_green", "villager_blue", "leather"])
        prim = resolve_ramp(v_ramp)
        acc = resolve_ramp("leather")

    # Eye color
    eye_map = {
        "blue": ccol("BLUE_BASE"),
        "green": ccol("GREEN_BASE"),
        "amber": ccol("HAIR_BLONDE_BASE"),
        "crimson": ccol("CRIMSON_BASE"),
        "brown": ccol("HAIR_BROWN_BASE"),
        "raven": ccol("HAIR_RAVEN_BASE"),
    }
    eye_col = eye_map.get(eye_color_name, ccol("BLUE_BASE"))

    return CharConfig(
        seed=seed,
        name=name,
        folk=folk,
        beast_type=beast_type,
        build=build,
        role=role,
        outfit_type=outfit_type,
        skin_tone=skin_tone,
        hair_style=hair_style,
        hair_color=hair_color,
        eye_color_name=eye_color_name,
        has_beard=has_beard,
        head_y=head_y,
        body_w=body_w,
        primary_ramp=prim,
        accent_ramp=acc,
        hair_ramp=hair_ramp,
        skin_ramp=skin_ramp,
        eye_col=eye_col,
    )


# --- 48x48 Cell Drawing Routines ---

def draw_cell_layers(cfg: CharConfig, anim: str, dir_name: str) -> Image.Image:
    img = Image.new("RGBA", (48, 48), TRANSPARENT)

    cx = 24
    hy = cfg.head_y
    ty = hy + 19
    bw = cfg.body_w
    s_shad, s_base, s_high = cfg.skin_ramp
    h_shad, h_base, h_high = cfg.hair_ramp
    p_shad, p_base, p_high = cfg.primary_ramp
    a_shad, a_base, a_high = cfg.accent_ramp

    is_sit = "sit" in anim
    is_left = (dir_name == "left")
    is_up = (dir_name == "up")
    is_down = (dir_name == "down")

    # 1. Back Layer: Beastfolk tail & Cape / Back hair
    if cfg.folk == "beastfolk":
        t_col = h_base
        if cfg.beast_type == "cat":
            for i in range(7):
                px(img, 28 + i, 36 - i // 2, t_col)
                px(img, 28 + i, 37 - i // 2, h_shad)
        elif cfg.beast_type == "dog":
            for i in range(5):
                px(img, 27 + i, 35 - i, t_col)
                px(img, 28 + i, 35 - i, h_shad)
        elif cfg.beast_type == "fox":
            ellipse(img, 15, 36, 4.0, 3.0, t_col, filled=True)
            px(img, 12, 36, ccol("WHITE_HIGH"))
            px(img, 13, 36, ccol("WHITE_HIGH"))
        elif cfg.beast_type == "bunny":
            ellipse(img, 24, 38, 2.5, 2.5, ccol("WHITE_HIGH"), filled=True)

    # Cape if noble / adventurer_t2 / t3
    if cfg.outfit_type in ("noble", "adventurer_t2", "adventurer_t3") and (is_up or is_down or is_left):
        cape_col = p_shad if is_down else p_base
        rect(img, cx - 7 - bw, ty + 2, 14 + bw * 2, 18, cape_col)

    # Back hair
    if cfg.hair_style in ("long", "twintails", "braids", "ponytail"):
        if cfg.hair_style == "long":
            rect(img, cx - 8, hy + 8, 16, 20, h_shad)
        elif cfg.hair_style == "twintails":
            rect(img, cx - 12, hy + 6, 4, 18, h_base)
            rect(img, cx + 8, hy + 6, 4, 18, h_shad)
        elif cfg.hair_style == "braids":
            rect(img, cx - 10, hy + 10, 3, 16, h_base)
            rect(img, cx + 7, hy + 10, 3, 16, h_shad)
        elif cfg.hair_style == "ponytail":
            rect(img, cx + 6, hy + 6, 5, 14, h_shad)

    # 2. Legs & Shoes
    leg_col = ccol("LEATHER_SHADOW") if cfg.outfit_type in ("villager", "adventurer_t1", "adventurer_t2") else ccol("OUTLINE_COOL")
    boot_col = ccol("LEATHER_BASE")

    if is_sit:
        if is_left:
            # Thighs pointing left
            rect(img, cx - 8, ty + 8, 9, 3, leg_col)
            # Shins down to 46
            rect(img, cx - 8, ty + 10, 4, 46 - (ty + 10) + 1, leg_col)
            # Shoe pointing left at y=46
            rect(img, cx - 10, 44, 6, 3, boot_col)
            # Stool legs
            rect(img, cx + 1, ty + 10, 2, 46 - (ty + 10) + 1, ccol("LEATHER_SHADOW"))
        else:
            # Seated front / up
            rect(img, cx - 6, ty + 8, 12, 3, leg_col)
            rect(img, cx - 6, ty + 10, 3, 46 - (ty + 10) + 1, leg_col)
            rect(img, cx + 3, ty + 10, 3, 46 - (ty + 10) + 1, leg_col)
            rect(img, cx - 7, 44, 4, 3, boot_col)
            rect(img, cx + 3, 44, 4, 3, boot_col)
            # Stool
            rect(img, cx - 8, ty + 10, 2, 46 - (ty + 10) + 1, ccol("LEATHER_SHADOW"))
            rect(img, cx + 6, ty + 10, 2, 46 - (ty + 10) + 1, ccol("LEATHER_SHADOW"))
    elif is_left:
        # Profile standing / walking
        if anim == "walk_0":
            rect(img, cx - 8, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx - 10, 44, 6, 3, boot_col)
            rect(img, cx + 1, ty + 9, 4, 43 - (ty + 9) + 1, leg_col)
            rect(img, cx + 1, 42, 5, 2, boot_col)
        elif anim == "walk_2":
            rect(img, cx - 4, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx - 6, 44, 6, 3, boot_col)
            rect(img, cx + 2, ty + 9, 4, 42 - (ty + 9) + 1, leg_col)
            rect(img, cx + 2, 41, 5, 2, boot_col)
        else:
            # Idle left
            rect(img, cx - 5, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx - 7, 44, 6, 3, boot_col)
            rect(img, cx + 1, ty + 9, 4, 45 - (ty + 9) + 1, leg_col)
            rect(img, cx - 1, 44, 5, 3, boot_col)
    else:
        # Down / Up
        if anim == "walk_0":
            # Left foot forward, right foot trailing
            rect(img, cx - 6 - bw, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx - 7 - bw, 44, 5, 3, boot_col)
            rect(img, cx + 2, ty + 9, 4, 43 - (ty + 9) + 1, leg_col)
            rect(img, cx + 2, 41, 4, 3, boot_col)
        elif anim == "walk_2":
            # Right foot forward, left foot trailing
            rect(img, cx - 6 - bw, ty + 9, 4, 43 - (ty + 9) + 1, leg_col)
            rect(img, cx - 6 - bw, 41, 4, 3, boot_col)
            rect(img, cx + 2, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx + 2, 44, 5, 3, boot_col)
        else:
            # Idle / action default
            rect(img, cx - 6 - bw, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx - 7 - bw, 44, 5, 3, boot_col)
            rect(img, cx + 2, ty + 9, 4, 46 - (ty + 9) + 1, leg_col)
            rect(img, cx + 2, 44, 5, 3, boot_col)

    # 3. Torso & Clothes
    tw = 12 + bw * 2
    tx = cx - tw // 2
    if is_left:
        tx = cx - 5
        tw = 10
    rect(img, tx, ty, tw, 10, p_base if not is_up else p_shad)

    # Shading on outfit
    rect(img, tx + tw - 2, ty, 2, 10, p_shad)

    # Maid apron / Chef apron / Vest details
    if cfg.outfit_type == "maid":
        # White apron bib
        rect(img, cx - 3, ty + 1, 6, 6, a_high)
        # Apron skirt
        rect(img, tx - 1, ty + 7, tw + 2, 5, a_base)
        # White straps
        px(img, cx - 4, ty + 1, a_high)
        px(img, cx + 3, ty + 1, a_high)
    elif cfg.outfit_type == "chef":
        rect(img, tx, ty + 1, tw, 8, ccol("WHITE_BASE"))
        rect(img, cx - 1, ty + 1, 2, 8, ccol("WHITE_HIGH"))
        px(img, cx - 2, ty + 3, ccol("HAIR_BLONDE_BASE"))
        px(img, cx + 1, ty + 3, ccol("HAIR_BLONDE_BASE"))
        px(img, cx, ty, a_base)  # red neckerchief
    elif cfg.outfit_type == "bartender":
        rect(img, cx - 2, ty, 4, 7, ccol("WHITE_HIGH"))
        rect(img, tx, ty + 7, tw, 5, ccol("WHITE_BASE"))  # waist apron
    elif cfg.outfit_type == "adventurer_t3":
        # Steel plate
        rect(img, tx + 1, ty + 1, tw - 2, 8, ccol("STEEL_LIGHT"))
        px(img, tx + 2, ty + 2, ccol("HAIR_BLONDE_BASE"))
        px(img, tx + tw - 3, ty + 2, ccol("HAIR_BLONDE_BASE"))

    # Belt
    rect(img, tx, ty + 7, tw, 2, ccol("LEATHER_SHADOW"))
    px(img, cx - 1, ty + 7, ccol("HAIR_BLONDE_BASE"))

    # 4. Head & Face
    # Chibi head dimensions
    hrx = 10 if cfg.folk == "dwarf" else (8 if cfg.folk == "halfling" else 9)
    hry = 9 if cfg.folk == "dwarf" else (8 if cfg.folk == "halfling" else 9)
    hcx = cx - 2 if is_left else cx
    hcy = hy + 9

    # Head base oval
    ellipse(img, hcx, hcy, hrx, hry, s_base, filled=True)
    # Shading on chin / bottom
    ellipse(img, hcx, hcy + 1, hrx - 1, hry - 1, s_base, filled=True)
    rect(img, hcx - hrx + 1, hcy + hry - 3, (hrx - 1) * 2, 2, s_shad)

    # Ears
    if cfg.folk == "elf":
        # Pointed ears
        px(img, hcx - hrx - 2, hcy, s_base)
        px(img, hcx - hrx - 1, hcy - 1, s_high)
        px(img, hcx + hrx + 1, hcy, s_base)
        px(img, hcx + hrx + 2, hcy - 1, s_high)
    elif cfg.folk == "beastfolk":
        if cfg.beast_type == "cat":
            # Cat ears
            rect(img, hcx - 7, hy - 4, 4, 4, h_base)
            px(img, hcx - 6, hy - 2, ccol("BLUSH_PINK"))
            rect(img, hcx + 3, hy - 4, 4, 4, h_base)
            px(img, hcx + 4, hy - 2, ccol("BLUSH_PINK"))
        elif cfg.beast_type == "dog":
            rect(img, hcx - hrx - 2, hy + 2, 3, 8, h_shad)
            rect(img, hcx + hrx - 1, hy + 2, 3, 8, h_shad)
        elif cfg.beast_type == "fox":
            rect(img, hcx - 7, hy - 5, 4, 5, h_base)
            px(img, hcx - 6, hy - 2, ccol("WHITE_HIGH"))
            rect(img, hcx + 3, hy - 5, 4, 5, h_base)
            px(img, hcx + 4, hy - 2, ccol("WHITE_HIGH"))
        elif cfg.beast_type == "bunny":
            rect(img, hcx - 6, hy - 8, 3, 8, h_base)
            px(img, hcx - 5, hy - 6, ccol("BLUSH_PINK"))
            px(img, hcx - 5, hy - 5, ccol("BLUSH_PINK"))
            rect(img, hcx + 3, hy - 8, 3, 8, h_base)
            px(img, hcx + 4, hy - 6, ccol("BLUSH_PINK"))
            px(img, hcx + 4, hy - 5, ccol("BLUSH_PINK"))

    # Face (if not Up)
    if not is_up:
        if is_left:
            # Single eye profile
            rect(img, hcx - 4, hcy - 1, 3, 4, ccol("WHITE_HIGH"))
            px(img, hcx - 4, hcy, cfg.eye_col)
            px(img, hcx - 4, hcy - 1, ccol("OUTLINE_WARM"))  # lash
            px(img, hcx - 5, hcy + 3, ccol("BLUSH_PINK"))
        else:
            # Eyes
            if anim == "eat_1":
                # Content closed eyes > <
                px(img, hcx - 5, hcy, ccol("OUTLINE_WARM"))
                px(img, hcx - 4, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx - 3, hcy, ccol("OUTLINE_WARM"))
                px(img, hcx + 3, hcy, ccol("OUTLINE_WARM"))
                px(img, hcx + 4, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx + 5, hcy, ccol("OUTLINE_WARM"))
            else:
                # Big cute chibi eyes
                # Left eye
                rect(img, hcx - 6, hcy - 1, 4, 4, ccol("WHITE_HIGH"))
                rect(img, hcx - 5, hcy, 2, 3, cfg.eye_col)
                px(img, hcx - 6, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx - 5, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx - 4, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx - 5, hcy, ccol("WHITE_HIGH"))  # shine
                # Right eye
                rect(img, hcx + 2, hcy - 1, 4, 4, ccol("WHITE_HIGH"))
                rect(img, hcx + 3, hcy, 2, 3, cfg.eye_col)
                px(img, hcx + 2, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx + 3, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx + 4, hcy - 1, ccol("OUTLINE_WARM"))
                px(img, hcx + 3, hcy, ccol("WHITE_HIGH"))  # shine

            # Cheeks blush
            px(img, hcx - 7, hcy + 3, ccol("BLUSH_PINK"))
            px(img, hcx - 6, hcy + 3, ccol("BLUSH_PINK"))
            px(img, hcx + 5, hcy + 3, ccol("BLUSH_PINK"))
            px(img, hcx + 6, hcy + 3, ccol("BLUSH_PINK"))

            # Mouth
            if anim in ("eat_0", "cook_0", "play_1"):
                rect(img, hcx - 1, hcy + 4, 2, 2, ccol("CRIMSON_BASE"))
            else:
                px(img, hcx, hcy + 4, ccol("OUTLINE_WARM"))

        # Beard (if dwarf / elderly)
        if cfg.has_beard:
            rect(img, hcx - 6, hcy + 3, 12, 7, h_base)
            rect(img, hcx - 4, hcy + 9, 8, 4, h_shad)
            px(img, hcx - 2, hcy + 10, h_high)

    # 5. Front Hair
    if is_up:
        # Full back hair
        ellipse(img, hcx, hcy - 1, hrx + 1, hry + 1, h_base, filled=True)
        ellipse(img, hcx, hcy + 1, hrx, hry, h_shad, filled=True)
    else:
        # Bangs & side locks
        ellipse(img, hcx, hy + 3, hrx + 1, 5, h_base, filled=True)
        px(img, hcx - 2, hy + 2, h_high)
        px(img, hcx + 1, hy + 2, h_high)
        # Side bangs
        rect(img, hcx - hrx - 1, hy + 4, 3, 9, h_base)
        rect(img, hcx + hrx - 2, hy + 4, 3, 9, h_shad)
        # Forehead strands
        if cfg.hair_style == "spiky":
            px(img, hcx - 4, hy - 2, h_high)
            px(img, hcx, hy - 3, h_high)
            px(img, hcx + 3, hy - 2, h_base)
        elif cfg.hair_style == "bun":
            ellipse(img, hcx, hy - 4, 3.5, 3.5, h_base, filled=True)
            px(img, hcx + 1, hy - 3, ccol("HAIR_BLONDE_BASE"))  # pin

    # 6. Headwear
    if cfg.outfit_type == "chef":
        # White toque hat
        ellipse(img, hcx, hy - 4, 6.0, 4.0, ccol("WHITE_HIGH"), filled=True)
        rect(img, hcx - 5, hy - 2, 10, 3, ccol("WHITE_BASE"))
    elif cfg.outfit_type == "maid":
        # Frilled headband
        rect(img, hcx - 6, hy, 12, 2, ccol("WHITE_HIGH"))
        px(img, hcx - 7, hy + 1, a_base)
        px(img, hcx + 6, hy + 1, a_base)
    elif cfg.outfit_type == "musician":
        # Feathered bard beret
        ellipse(img, hcx - 2, hy - 2, 7.0, 3.5, p_base, filled=True)
        px(img, hcx + 4, hy - 5, ccol("CRIMSON_LIGHT"))  # feather
        px(img, hcx + 5, hy - 6, ccol("CRIMSON_LIGHT"))
    elif cfg.outfit_type == "noble":
        # Gold circlet
        rect(img, hcx - 5, hy + 2, 10, 2, ccol("HAIR_BLONDE_BASE"))
        px(img, hcx, hy + 2, ccol("CRIMSON_LIGHT"))  # gem
    elif cfg.outfit_type == "dancer":
        # Headband jewel
        px(img, hcx, hy + 3, ccol("HAIR_BLONDE_BASE"))
        px(img, hcx, hy + 4, ccol("BLUE_LIGHT"))

    # 7. Action Props & Arms
    if anim == "carry_down":
        # Wooden tray with ale mugs and bowl
        rect(img, cx - 10, ty + 3, 20, 3, ccol("LEATHER_BASE"))
        # Ale mugs
        rect(img, cx - 8, ty, 3, 3, ccol("HAIR_BLONDE_BASE"))
        px(img, cx - 8, ty - 1, ccol("WHITE_HIGH"))
        rect(img, cx + 5, ty, 3, 3, ccol("HAIR_BLONDE_BASE"))
        px(img, cx + 5, ty - 1, ccol("WHITE_HIGH"))
        # Stew bowl
        rect(img, cx - 2, ty + 1, 4, 2, ccol("CRIMSON_BASE"))
        # Hands holding tray
        px(img, cx - 9, ty + 4, s_base)
        px(img, cx + 8, ty + 4, s_base)
    elif anim == "carry_left":
        # Side tray
        rect(img, cx - 14, ty + 4, 12, 3, ccol("LEATHER_BASE"))
        px(img, cx - 12, ty + 2, ccol("HAIR_BLONDE_BASE"))
        px(img, cx - 12, ty + 1, ccol("WHITE_HIGH"))
        px(img, cx - 6, ty + 5, s_base)
    elif anim == "eat_0":
        # Mug in hand
        rect(img, cx - 8, ty + 2, 4, 5, ccol("LEATHER_BASE"))
        rect(img, cx - 8, ty + 1, 4, 1, ccol("WHITE_HIGH"))  # foam
        px(img, cx - 5, ty + 4, s_base)
    elif anim == "eat_1":
        # Mug raised to mouth
        rect(img, cx - 2, hy + 13, 5, 5, ccol("LEATHER_BASE"))
        rect(img, cx - 2, hy + 12, 5, 1, ccol("WHITE_HIGH"))
        px(img, cx + 3, hy + 15, s_base)
    elif anim == "cook_0":
        # Iron cauldron / pot
        rect(img, cx - 12, ty + 2, 8, 7, ccol("OUTLINE_COOL"))
        rect(img, cx - 11, ty + 3, 6, 2, ccol("CRIMSON_BASE"))  # stew bubbling
        # Wooden spoon
        for i in range(5):
            px(img, cx - 5 + i, ty - 1 + i, ccol("LEATHER_LIGHT"))
    elif anim == "cook_1":
        # Ladle raised high with steam
        for i in range(7):
            px(img, cx + 4 + i // 2, hy + 2 + i, ccol("LEATHER_LIGHT"))
        rect(img, cx + 6, hy + 1, 3, 2, ccol("STEEL_LIGHT"))
        px(img, cx + 7, hy - 1, ccol("WHITE_HIGH"))  # steam
    elif anim == "play_0":
        # Lute held across chest
        for i in range(6):
            px(img, cx - 8 + i, hy + 12 + i, ccol("LEATHER_LIGHT"))
        ellipse(img, cx + 3, ty + 3, 5.0, 4.0, ccol("LEATHER_BASE"), filled=True)
        px(img, cx + 3, ty + 3, ccol("OUTLINE_COOL"))  # sound hole
        px(img, cx - 5, hy + 15, s_base)  # fretting hand
        px(img, cx + 2, ty + 2, s_base)   # strum hand
    elif anim == "play_1":
        # Lute with musical sparkle
        for i in range(6):
            px(img, cx - 8 + i, hy + 12 + i, ccol("LEATHER_LIGHT"))
        ellipse(img, cx + 3, ty + 3, 5.0, 4.0, ccol("LEATHER_BASE"), filled=True)
        px(img, cx + 3, ty + 3, ccol("OUTLINE_COOL"))
        px(img, cx + 4, ty + 4, s_base)
        # Sparkle note
        px(img, cx + 10, hy + 8, ccol("HAIR_BLONDE_HIGH"))
        px(img, cx + 11, hy + 7, ccol("HAIR_BLONDE_HIGH"))
        px(img, cx + 11, hy + 9, ccol("HAIR_BLONDE_HIGH"))
        px(img, cx + 12, hy + 8, ccol("HAIR_BLONDE_HIGH"))
    elif anim == "dance_0":
        # Sway left, left arm high with flowing silk ribbon
        rect(img, cx - 11, hy + 8, 3, 7, s_base)
        for i in range(6):
            rect(img, cx - 13 - (i % 2), hy + 11 + i, 3, 2, a_high if i < 3 else a_base)
    elif anim == "dance_1":
        # Sway right, right arm high with flowing silk ribbon
        rect(img, cx + 9, hy + 8, 3, 7, s_base)
        for i in range(6):
            rect(img, cx + 11 + (i % 2), hy + 11 + i, 3, 2, a_high if i < 3 else a_base)
    elif anim == "dance_2":
        # Graceful twirl: arms arched overhead, flared skirt hem
        rect(img, cx - 8, hy + 1, 3, 6, s_base)
        rect(img, cx + 6, hy + 1, 3, 6, s_base)
        ellipse(img, cx, ty + 7, 8.5, 3.0, p_base, filled=True)
        ellipse(img, cx, ty + 8, 7.5, 2.0, a_high, filled=False)
    elif anim == "dance_3":
        # Curtsy / bow flourish: one arm out, ribbons trailing
        rect(img, cx - 11, ty + 1, 4, 3, s_base)
        rect(img, cx + 7, ty + 1, 4, 3, s_base)
        ellipse(img, cx, ty + 7, 8.0, 2.5, p_shad, filled=True)

    # Standalone arms for regular walk/idle if not action
    if anim in ("walk_0", "idle", "walk_2") and not is_left:
        # Default side arms
        rect(img, tx - 3, ty + 1, 3, 7, s_base)
        rect(img, tx + tw, ty + 1, 3, 7, s_base)

    return finalize_cell(img, default_outline="OUTLINE_WARM")


def draw_cell(cfg: CharConfig, anim_name: str, frame_idx: int) -> Image.Image:
    dir_name = "down"
    if "up" in anim_name:
        dir_name = "up"
    elif "left" in anim_name:
        dir_name = "left"

    anim_key = anim_name
    if anim_name.startswith("walk_"):
        parts = anim_name.split("_")
        anim_key = f"walk_{parts[1]}"
    elif anim_name.startswith("idle_"):
        anim_key = "idle"
    elif anim_name.startswith("sit_"):
        anim_key = "sit"

    return draw_cell_layers(cfg, anim_key, dir_name)


# --- 64x64 Bust Portrait Drawing Routines ---

def draw_bust(cfg: CharConfig) -> Image.Image:
    img = Image.new("RGBA", (64, 64), TRANSPARENT)

    cx = 32
    cy = 29
    s_shad, s_base, s_high = cfg.skin_ramp
    h_shad, h_base, h_high = cfg.hair_ramp
    p_shad, p_base, p_high = cfg.primary_ramp
    a_shad, a_base, a_high = cfg.accent_ramp

    # 1. Organic Back Hair behind head & neck (no boxy slabs)
    if cfg.hair_style == "long":
        ellipse(img, cx, cy + 8, 17.5, 19.0, h_shad, filled=True)
        ellipse(img, cx - 2, cy + 6, 15.0, 16.0, h_base, filled=True)
    elif cfg.hair_style == "twintails":
        ellipse(img, cx - 17, cy + 8, 5.5, 14.0, h_base, filled=True)
        ellipse(img, cx - 18, cy + 6, 3.5, 10.0, h_high, filled=True)
        ellipse(img, cx + 17, cy + 8, 5.5, 14.0, h_shad, filled=True)
        ellipse(img, cx + 16, cy + 6, 3.5, 10.0, h_base, filled=True)
    elif cfg.hair_style == "braids":
        for bi in range(4):
            ellipse(img, cx - 15, cy + 4 + bi * 5, 4.0, 3.5, h_base, filled=True)
            ellipse(img, cx + 15, cy + 4 + bi * 5, 4.0, 3.5, h_shad, filled=True)
    elif cfg.hair_style == "ponytail":
        ellipse(img, cx + 14, cy + 2, 5.0, 11.0, h_shad, filled=True)
        ellipse(img, cx + 13, cy, 3.5, 8.0, h_base, filled=True)

    # 2. Sloped Anime Shoulders & Torso (y = 43..62)
    for sy in range(44, 63):
        t = (sy - 44) / 18.0
        half_w = int(9 + 12 * math.pow(t, 0.65))
        rect(img, cx - half_w, sy, half_w * 2, 1, p_base)
        rect(img, cx + max(2, half_w - 6), sy, min(6, half_w), 1, p_shad)
        rect(img, cx - half_w, sy, 3, 1, p_high)

    # Outfit collar & chest details
    if cfg.outfit_type == "maid":
        # Ruffled white maid apron bib & frilled shoulder straps
        for sy in range(46, 63):
            rect(img, cx - 7, sy, 14, 1, a_high if sy < 59 else a_base)
        rect(img, cx - 13, 46, 3, 16, a_high)
        rect(img, cx + 10, 46, 3, 16, a_base)
        # Cute ribbon bow at collar
        ellipse(img, cx, 46, 3.5, 2.0, a_base, filled=True)
        px(img, cx, 46, ccol("HAIR_BLONDE_HIGH"))
    elif cfg.outfit_type == "chef":
        for sy in range(45, 63):
            half_w = int(9 + 11 * math.pow((sy - 44) / 18.0, 0.65))
            rect(img, cx - half_w + 1, sy, (half_w - 1) * 2, 1, ccol("WHITE_HIGH") if sy < 56 else ccol("WHITE_BASE"))
        rect(img, cx - 4, 44, 8, 4, a_base)  # chef kerchief
        for by in (50, 55, 60):
            px(img, cx - 3, by, ccol("OUTLINE_COOL"))
            px(img, cx + 3, by, ccol("OUTLINE_COOL"))
    elif cfg.outfit_type == "bartender":
        rect(img, cx - 6, 44, 12, 18, ccol("WHITE_HIGH"))
        rect(img, cx - 2, 46, 4, 3, ccol("CRIMSON_BASE"))  # bow tie
    elif cfg.outfit_type == "adventurer_t3":
        ellipse(img, cx - 15, 50, 6.5, 5.0, ccol("STEEL_LIGHT"), filled=True)
        ellipse(img, cx + 15, 50, 6.5, 5.0, ccol("STEEL_BASE"), filled=True)
        rect(img, cx - 5, 45, 10, 8, ccol("HAIR_BLONDE_BASE"))
    elif cfg.outfit_type in ("noble", "musician", "dancer"):
        ellipse(img, cx, 47, 7.0, 3.5, a_high, filled=True)
        px(img, cx, 48, ccol("CRIMSON_LIGHT"))

    # Slender neck + chin shadow
    rect(img, cx - 4, 39, 8, 7, s_base)
    rect(img, cx - 4, 39, 8, 2, s_shad)
    rect(img, cx + 1, 39, 3, 7, s_shad)

    # 3. Tapered Anime Head & Chin (wider cheeks, soft pointed chin!)
    rx = 13 if cfg.folk != "halfling" else 12
    ry = 12 if cfg.folk != "halfling" else 11
    ellipse(img, cx, cy - 1, rx, ry, s_base, filled=True)
    # Soften upper forehead highlight & lower chin taper
    ellipse(img, cx - 2, cy - 4, rx - 3, ry - 4, s_high, filled=True)
    for dy in range(4):
        w_chin = max(3, (rx - 3) - dy * 2)
        rect(img, cx - w_chin, cy + ry - 3 + dy, w_chin * 2, 1, s_base)
    rect(img, cx - 4, cy + ry, 8, 1, s_shad)

    # Ears
    if cfg.folk == "elf":
        for i in range(6):
            rect(img, cx - rx - i, cy - 1 - i // 2, 3, 3, s_base)
            rect(img, cx + rx + i - 2, cy - 1 - i // 2, 3, 3, s_shad)
    elif cfg.folk == "beastfolk":
        if cfg.beast_type in ("cat", "fox"):
            ear_h = 9 if cfg.beast_type == "cat" else 11
            inner_c = ccol("BLUSH_PINK") if cfg.beast_type == "cat" else ccol("WHITE_HIGH")
            for i in range(ear_h):
                w_e = max(1, (ear_h - i) * 6 // ear_h)
                rect(img, cx - 12, cy - 10 - i, w_e, 1, h_base)
                rect(img, cx + 12 - w_e, cy - 10 - i, w_e, 1, h_shad)
                if 1 <= i <= ear_h - 3 and w_e >= 3:
                    rect(img, cx - 11, cy - 10 - i, max(1, w_e - 2), 1, inner_c)
                    rect(img, cx + 13 - w_e, cy - 10 - i, max(1, w_e - 2), 1, inner_c)
        elif cfg.beast_type == "dog":
            ellipse(img, cx - rx - 2, cy + 2, 4.0, 8.0, h_shad, filled=True)
            ellipse(img, cx + rx + 2, cy + 2, 4.0, 8.0, h_shad, filled=True)
        elif cfg.beast_type == "bunny":
            ellipse(img, cx - 7, cy - 18, 3.2, 9.0, h_base, filled=True)
            ellipse(img, cx - 7, cy - 18, 1.5, 6.5, ccol("BLUSH_PINK"), filled=True)
            ellipse(img, cx + 7, cy - 18, 3.2, 9.0, h_base, filled=True)
            ellipse(img, cx + 7, cy - 18, 1.5, 6.5, ccol("BLUSH_PINK"), filled=True)
    else:
        ellipse(img, cx - rx, cy + 1, 2.2, 3.0, s_base, filled=True)
        ellipse(img, cx + rx, cy + 1, 2.2, 3.0, s_shad, filled=True)

    # 4. Crisp Anime Eyes, Brows, Blush & Mouth
    for ex_0, is_r in ((cx - 9, False), (cx + 3, True)):
        rect(img, ex_0, cy - 1, 6, 6, ccol("WHITE_HIGH"))
        rect(img, ex_0 + 1, cy, 4, 5, cfg.eye_col)
        rect(img, ex_0 + 2, cy + 1, 2, 3, ccol("OUTLINE_WARM"))  # pupil
        rect(img, ex_0 + 1, cy, 2, 2, ccol("WHITE_HIGH"))        # catchlight
        rect(img, ex_0 - (0 if is_r else 1), cy - 2, 7, 2, ccol("OUTLINE_WARM"))  # upper lash
        rect(img, ex_0 + 1, cy - 4, 4, 1, h_shad)                # eyebrow

    # Rosy Blush
    rect(img, cx - 10, cy + 6, 3, 2, ccol("BLUSH_PINK"))
    rect(img, cx + 7, cy + 6, 3, 2, ccol("BLUSH_PINK"))

    # Nose & Smile
    px(img, cx, cy + 5, s_shad)
    if cfg.folk == "beastfolk" and cfg.beast_type == "cat":
        px(img, cx - 2, cy + 8, ccol("OUTLINE_WARM"))
        px(img, cx - 1, cy + 9, ccol("OUTLINE_WARM"))
        px(img, cx, cy + 8, ccol("OUTLINE_WARM"))
        px(img, cx + 1, cy + 9, ccol("OUTLINE_WARM"))
        px(img, cx + 2, cy + 8, ccol("OUTLINE_WARM"))
    else:
        rect(img, cx - 2, cy + 8, 4, 1, ccol("CRIMSON_BASE"))
        px(img, cx - 3, cy + 7, ccol("OUTLINE_WARM"))
        px(img, cx + 2, cy + 7, ccol("OUTLINE_WARM"))

    # Rounded Beard (if dwarf / bearded)
    if cfg.has_beard:
        ellipse(img, cx, cy + 12, 10.5, 7.5, h_base, filled=True)
        ellipse(img, cx + 2, cy + 14, 8.0, 5.5, h_shad, filled=True)
        rect(img, cx - 4, cy + 7, 8, 2, h_high)  # mustache highlight

    # 5. Rounded Crown Hair + Feathered Bangs + Tapered Side Locks
    ellipse(img, cx, cy - 8, rx + 2, 6.5, h_base, filled=True)
    ellipse(img, cx - 2, cy - 10, rx - 2, 3.5, h_high, filled=True)
    # Feathered V-bangs across forehead
    for bx_off, b_len in ((-9, 5), (-5, 7), (-1, 8), (3, 7), (7, 5)):
        for by in range(b_len):
            w_b = max(1, 3 - by // 3)
            rect(img, cx + bx_off, cy - 8 + by, w_b, 1, h_base if bx_off <= 1 else h_shad)
    # Tapered cheek-framing sidelocks (wider at temple, 1px tip at jaw)
    for dy in range(13):
        lw = max(1, 3 - dy // 5)
        rect(img, cx - rx - 1 + dy // 5, cy - 4 + dy, lw, 1, h_base)
        rect(img, cx + rx - lw + 1 - dy // 5, cy - 4 + dy, lw, 1, h_shad)

    if cfg.hair_style == "bun":
        ellipse(img, cx, cy - 16, 5.5, 4.5, h_base, filled=True)
        rect(img, cx - 4, cy - 13, 8, 1, ccol("HAIR_BLONDE_HIGH"))

    # 6. Headwear
    if cfg.outfit_type == "chef":
        ellipse(img, cx, cy - 17, 10.5, 6.5, ccol("WHITE_HIGH"), filled=True)
        rect(img, cx - 9, cy - 13, 18, 4, ccol("WHITE_BASE"))
    elif cfg.outfit_type == "maid":
        ellipse(img, cx, cy - 11, 11.0, 2.8, ccol("WHITE_HIGH"), filled=True)
        px(img, cx - 11, cy - 10, a_base)
        px(img, cx + 11, cy - 10, a_base)
    elif cfg.outfit_type == "musician":
        ellipse(img, cx - 3, cy - 14, 11.0, 5.0, p_base, filled=True)
        line_pts = [(cx + 5 + i // 2, cy - 15 - i) for i in range(6)]
        for lx, ly in line_pts:
            rect(img, lx, ly, 2, 2, ccol("HAIR_BLONDE_HIGH"))
    elif cfg.outfit_type == "noble":
        rect(img, cx - 8, cy - 12, 16, 2, ccol("HAIR_BLONDE_HIGH"))
        px(img, cx, cy - 13, ccol("CRIMSON_LIGHT"))
    elif cfg.outfit_type == "dancer":
        rect(img, cx - 8, cy - 10, 16, 2, ccol("HAIR_BLONDE_HIGH"))
        px(img, cx, cy - 9, ccol("BLUE_LIGHT"))

    return finalize_bust(img, default_outline="OUTLINE_WARM")


def npc_from_seed(
    seed: int,
    role_override: str | None = None,
    preset: dict | None = None,
) -> tuple[Image.Image, Image.Image, dict]:
    cfg = build_char_config(seed, role_override, preset)
    rng = random.Random(seed)

    # 1. Generate 24 cells for the 192x288 sprite sheet
    cell_map = [
        # Row 0: Down
        ("walk_0_down", 0), ("idle_down", 1), ("walk_2_down", 2), ("sit_down", 3),
        # Row 1: Up
        ("walk_0_up", 0), ("idle_up", 1), ("walk_2_up", 2), ("sit_up", 3),
        # Row 2: Left
        ("walk_0_left", 0), ("idle_left", 1), ("walk_2_left", 2), ("sit_left", 3),
        # Row 3: Eat & Carry
        ("eat_0", 0), ("eat_1", 1), ("carry_down", 2), ("carry_left", 3),
        # Row 4: Cook & Play
        ("cook_0", 0), ("cook_1", 1), ("play_0", 2), ("play_1", 3),
        # Row 5: Dance
        ("dance_0", 0), ("dance_1", 1), ("dance_2", 2), ("dance_3", 3),
    ]

    sheet = Image.new("RGBA", (192, 288), TRANSPARENT)
    for idx, (anim_name, f_idx) in enumerate(cell_map):
        row = idx // 4
        col = idx % 4
        cell_img = draw_cell(cfg, anim_name, f_idx)
        sheet.paste(cell_img, (col * 48, row * 48))

    # 2. Generate 64x64 Bust Portrait
    bust = draw_bust(cfg)

    # 3. Generate Traits
    if cfg.role in ("villager", "adventurer_rookie", "adventurer_t1"):
        lvl = rng.randint(1, 5)
    elif cfg.role in ("adventurer_veteran", "adventurer_t2"):
        lvl = rng.randint(6, 14)
    elif cfg.role == "adventurer_t3":
        lvl = rng.randint(15, 25)
    elif cfg.role == "noble":
        lvl = rng.randint(5, 18)
    elif cfg.role == "merchant":
        lvl = rng.randint(3, 12)
    else:  # staff
        lvl = rng.randint(1, 10)

    class_pool = CLASSES_BY_ROLE.get(cfg.role, CLASSES_BY_ROLE["villager"])
    class_name = rng.choice(class_pool)

    mood = rng.choice(["happy", "cheerful", "calm", "curious", "hungry", "thirsty", "stoic", "grumpy", "flustered", "proud"])
    fav_dish = rng.choice(RECIPE_IDS)

    opinions = {
        "tavern": rng.choice([
            "Cozy atmosphere, love the warm hearth fire.",
            "Nice rustic charm, always lively and welcoming.",
            "Warm and inviting after a long journey.",
            "The best place in town to rest tired boots.",
        ]),
        "food": rng.choice([
            "The hearty root stew hits the spot every time!",
            "Crusty bread and sharp cheddar never disappoint.",
            "Delicious aromas drifting right from the hearth.",
            "Always flavorful, piping hot, and satisfying.",
        ]),
        "prices": rng.choice([
            "Fair prices for honest, generous tavern portions.",
            "A true bargain compared to crowded city inns.",
            "Worth every single copper coin spent here.",
            "Very reasonable for weary travelers on a budget.",
        ]),
        "nyah": rng.choice([
            "She's sharp-tongued and fierce, but keeps things running!",
            "Fierce boss catgirl, definitely don't get on her bad side.",
            "Demanding standards, but her tavern efficiency is undeniable.",
            "A bit terrifying when scolding, yet strangely charming.",
        ]),
        "fifi": rng.choice([
            "Such a sweet and wonderfully diligent maid!",
            "Always bustling between tables with a gentle smile.",
            "Works so hard without a complaint, deserves all headpats.",
            "The gentlest, sweetest soul in the entire tavern.",
        ]),
    }

    traits = {
        "seed": seed,
        "name": cfg.name,
        "folk": cfg.folk,
        "build": cfg.build,
        "role": cfg.role,
        "className": class_name,
        "level": lvl,
        "baselineMood": mood,
        "favoriteDish": fav_dish,
        "opinions": opinions,
    }

    return sheet, bust, traits


def render_contact_sheet(
    npcs: list[tuple[str, Image.Image, Image.Image, dict]],
    out_path: Path,
) -> None:
    """Render a labeled contact preview sheet showing all generated NPCs."""
    cols = 8
    rows = math.ceil(len(npcs) / cols)
    card_w = 120
    card_h = 100
    canvas = Image.new("RGBA", (cols * card_w, rows * card_h), ccol("OUTLINE_COOL"))

    fg_col = ccol("SKIN_LIGHT_HIGH")
    sh_col = ccol("OUTLINE_WARM")

    def draw_txt(img: Image.Image, x: int, y: int, text: str) -> None:
        cx = x
        for ch in text.upper():
            glyph = GLYPHS_5X7.get(ch, GLYPHS_5X7[" "])
            for ry, rstr in enumerate(glyph):
                for rx, bit in enumerate(rstr):
                    if bit == "#":
                        px(img, cx + rx + 1, y + ry + 1, sh_col)
                        px(img, cx + rx, y + ry, fg_col)
            cx += 6

    for idx, (npc_id, sheet, bust, traits) in enumerate(npcs):
        gx = (idx % cols) * card_w
        gy = (idx // cols) * card_h

        # Card border
        rect(canvas, gx + 1, gy + 1, card_w - 2, card_h - 2, ccol("OUTLINE_NATURE"))
        rect(canvas, gx + 2, gy + 2, card_w - 4, card_h - 4, ccol("OUTLINE_COOL"))

        # Paste 64x64 bust on left
        canvas.paste(bust, (gx + 4, gy + 4), bust)

        # Crop and paste idle Down cell (col 1, row 0 of sheet) on right
        idle_cell = sheet.crop((48, 0, 96, 48))
        canvas.paste(idle_cell, (gx + 68, gy + 12), idle_cell)

        # Label: ID and Name
        label_1 = npc_id[:16]
        label_2 = f"{traits['role'][:8]}:{traits['folk'][:4]}"
        draw_txt(canvas, gx + 6, gy + 74, label_1)
        draw_txt(canvas, gx + 6, gy + 86, label_2)

    canvas.save(out_path, format="PNG")


def main() -> int:
    out_dir = ROOT / "assets" / "npcs"
    out_dir.mkdir(parents=True, exist_ok=True)

    report = QAReport()

    # Staff definitions (9 named staff)
    staff_presets = [
        {"id": "barnaby", "name": "Old Barnaby", "folk": "dwarf", "build": "sturdy", "role": "chef", "hair_color": "silver", "hair_style": "short", "skin_tone": "peach", "has_beard": True},
        {"id": "clover", "name": "Clover", "folk": "beastfolk", "beast_type": "bunny", "build": "slim", "role": "maid", "hair_color": "blonde", "skin_tone": "porcelain", "hair_style": "bob"},
        {"id": "roxie", "name": "Roxie", "folk": "beastfolk", "beast_type": "cat", "build": "regular", "role": "maid", "hair_color": "auburn", "skin_tone": "porcelain", "hair_style": "twintails"},
        {"id": "pippa", "name": "Pippa", "folk": "beastfolk", "beast_type": "fox", "build": "regular", "role": "maid", "hair_color": "brown", "skin_tone": "peach", "hair_style": "braids"},
        {"id": "velvet", "name": "Velvet", "folk": "elf", "build": "slim", "role": "maid", "hair_color": "raven", "skin_tone": "porcelain", "hair_style": "long"},
        {"id": "garrett", "name": "Garrett", "folk": "human", "build": "sturdy", "role": "bartender", "hair_color": "brown", "skin_tone": "tan", "hair_style": "short"},
        {"id": "marcel", "name": "Marcel", "folk": "human", "build": "regular", "role": "chef", "hair_color": "blonde", "skin_tone": "porcelain", "hair_style": "short"},
        {"id": "lyra", "name": "Lyra", "folk": "elf", "build": "slim", "role": "musician", "hair_color": "blonde", "skin_tone": "porcelain", "hair_style": "long"},
        {"id": "soleil", "name": "Soleil", "folk": "beastfolk", "beast_type": "fox", "build": "slim", "role": "dancer", "hair_color": "auburn", "skin_tone": "peach", "hair_style": "twintails"},
    ]

    # Customer definitions (30 diverse customers covering all 5 archetypes and all 5 folk)
    customer_presets = []
    for i in range(30):
        arch = CUSTOMER_ARCHETYPES[i % 5]
        folk = FOLK_TYPES[(i + i // 5) % 5]
        beast = BEAST_TYPES[i % len(BEAST_TYPES)]
        cid = f"cust_{i:02d}"
        customer_presets.append({
            "id": cid,
            "role": arch,
            "folk": folk,
            "beast_type": beast,
        })

    all_specs = []
    base_seed = 1000
    for s in staff_presets:
        base_seed += 17
        all_specs.append((s["id"], base_seed, s))
    for c in customer_presets:
        base_seed += 13
        all_specs.append((c["id"], base_seed, c))

    # Determinism verification on 2 sample seeds
    for test_seed in (2026, 7777):
        s1, b1, t1 = npc_from_seed(test_seed)
        s2, b2, t2 = npc_from_seed(test_seed)
        if png_bytes(s1) != png_bytes(s2):
            report.errors.append(f"Non-deterministic sheet output for seed {test_seed}")
        if png_bytes(b1) != png_bytes(b2):
            report.errors.append(f"Non-deterministic bust output for seed {test_seed}")
        if t1 != t2:
            report.errors.append(f"Non-deterministic traits output for seed {test_seed}")

    manifest_npcs: dict[str, dict] = {}
    exported_for_preview: list[tuple[str, Image.Image, Image.Image, dict]] = []

    for npc_id, seed, preset in all_specs:
        sheet, bust, traits = npc_from_seed(seed, preset=preset)

        # QA check every cell in the 4x6 grid of the sheet
        for r in range(6):
            for c in range(4):
                cell = sheet.crop((c * 48, r * 48, (c + 1) * 48, (r + 1) * 48))
                check_image_qa(
                    f"{npc_id}_r{r}_c{c}",
                    cell,
                    allowed_rgba=CHAR_ALL_RGBA_SET,
                    outline_rgba=CHAR_OUTLINE_RGBA_SET,
                    report=report,
                    expected_size=(48, 48),
                    check_outline=True,
                    hangs=False,
                    skip_bottom_anchor=False,
                )

        # QA check bust
        check_image_qa(
            f"{npc_id}_bust",
            bust,
            allowed_rgba=CHAR_ALL_RGBA_SET,
            outline_rgba=CHAR_OUTLINE_RGBA_SET,
            report=report,
            expected_size=(64, 64),
            check_outline=True,
            hangs=False,
            skip_bottom_anchor=False,
        )

        sheet_path = out_dir / f"{npc_id}.png"
        bust_path = out_dir / f"{npc_id}_bust.png"
        sheet_path.write_bytes(png_bytes(sheet))
        bust_path.write_bytes(png_bytes(bust))

        manifest_npcs[npc_id] = {
            "id": npc_id,
            "sheet": f"assets/npcs/{npc_id}.png",
            "bust": f"assets/npcs/{npc_id}_bust.png",
            "traits": traits,
        }
        exported_for_preview.append((npc_id, sheet, bust, traits))

    manifest_payload = {
        "schemaVersion": 1,
        "npcCount": len(manifest_npcs),
        "sheetGrid": [4, 6],
        "sheetSize": [192, 288],
        "cellSize": [48, 48],
        "bustSize": [64, 64],
        "anchor": [0.5, 1.0],
        "animations": {
            "walk_down": {"row": 0, "frames": [0, 1, 2, 1], "flipX": False, "fps": 6},
            "idle_down": {"row": 0, "frames": [1], "flipX": False, "fps": 2},
            "sit_down": {"row": 0, "frames": [3], "flipX": False},
            "walk_up": {"row": 1, "frames": [0, 1, 2, 1], "flipX": False, "fps": 6},
            "idle_up": {"row": 1, "frames": [1], "flipX": False, "fps": 2},
            "sit_up": {"row": 1, "frames": [3], "flipX": False},
            "walk_left": {"row": 2, "frames": [0, 1, 2, 1], "flipX": False, "fps": 6},
            "idle_left": {"row": 2, "frames": [1], "flipX": False, "fps": 2},
            "walk_right": {"row": 2, "frames": [0, 1, 2, 1], "flipX": True, "fps": 6, "note": "flip_row_2"},
            "idle_right": {"row": 2, "frames": [1], "flipX": True, "fps": 2, "note": "flip_row_2"},
            "sit_left": {"row": 2, "frames": [3], "flipX": False},
            "sit_right": {"row": 2, "frames": [3], "flipX": True},
            "eat": {"row": 3, "frames": [0, 1], "fps": 2},
            "carry_down": {"row": 3, "frames": [2], "flipX": False},
            "carry_left": {"row": 3, "frames": [3], "flipX": False},
            "carry_right": {"row": 3, "frames": [3], "flipX": True},
            "cook": {"row": 4, "frames": [0, 1], "fps": 3},
            "play": {"row": 4, "frames": [2, 3], "fps": 4},
            "dance": {"row": 5, "frames": [0, 1, 2, 3], "fps": 5},
        },
        "npcs": manifest_npcs,
    }

    (out_dir / "manifest.json").write_text(json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8")

    # Labeled contact preview
    render_contact_sheet(exported_for_preview, out_dir / "npc_sheet.png")

    print(report.format_summary("NPC Generator Pipeline QA"))
    print(f"Exported {len(manifest_npcs)} NPCs, sheets, busts, manifest.json, and npc_sheet.png.")

    return 0 if report.ok() else 1


if __name__ == "__main__":
    raise SystemExit(main())
