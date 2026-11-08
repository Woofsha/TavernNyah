"""Frozen 46-color NPC character paper-doll palette.

Rules:
- <= 48 colors, zero pure black (#000000).
- Hue-shifted outlines matching Nyah & Fifi's readable chibi silhouettes.
- Never write raw hex outside palette modules.
"""

from __future__ import annotations

CHAR_PALETTE_HEX: dict[str, str] = {
    # Outlines x3 (warm skin/cloth/hair, cool armor/robes, deep nature green)
    "OUTLINE_WARM": "#261612",
    "OUTLINE_COOL": "#181c2b",
    "OUTLINE_NATURE": "#15291c",

    # Skin ramps (4 tones: porcelain, peach, tan, umber) + blush
    "SKIN_LIGHT_SHADOW": "#d9a389",
    "SKIN_LIGHT_BASE": "#f5cbb3",
    "SKIN_LIGHT_HIGH": "#ffe3d1",

    "SKIN_PEACH_SHADOW": "#c4886c",
    "SKIN_PEACH_BASE": "#e6ae8e",
    "SKIN_PEACH_HIGH": "#f7cba8",

    "SKIN_TAN_SHADOW": "#996247",
    "SKIN_TAN_BASE": "#bf8262",
    "SKIN_TAN_HIGH": "#dea381",

    "SKIN_DEEP_SHADOW": "#593526",
    "SKIN_DEEP_BASE": "#7d4e38",
    "SKIN_DEEP_HIGH": "#a16a50",

    "BLUSH_PINK": "#eb888b",

    # Hair & beastfolk ear/tail ramps
    "HAIR_RAVEN_SHADOW": "#252333",
    "HAIR_RAVEN_BASE": "#3a374d",
    "HAIR_RAVEN_HIGH": "#595473",

    "HAIR_BROWN_SHADOW": "#543729",
    "HAIR_BROWN_BASE": "#7d5540",
    "HAIR_BROWN_HIGH": "#a8795e",

    "HAIR_BLONDE_SHADOW": "#b3802d",
    "HAIR_BLONDE_BASE": "#e3b44f",
    "HAIR_BLONDE_HIGH": "#fae089",

    "HAIR_AUBURN_SHADOW": "#752825",
    "HAIR_AUBURN_BASE": "#ad4236",
    "HAIR_AUBURN_HIGH": "#db6d53",

    # Silver hair / white apron / eye sclera x3
    "WHITE_SHADOW": "#9aa3b8",
    "WHITE_BASE": "#cfd6e6",
    "WHITE_HIGH": "#f7f9fc",

    # Outfit: forest green x3
    "GREEN_SHADOW": "#244d34",
    "GREEN_BASE": "#3d7a4d",
    "GREEN_LIGHT": "#68ad6a",

    # Outfit: royal blue / indigo x3
    "BLUE_SHADOW": "#233c69",
    "BLUE_BASE": "#3b65a6",
    "BLUE_LIGHT": "#689be0",

    # Outfit: crimson / bard / noble x3
    "CRIMSON_SHADOW": "#6b1e2c",
    "CRIMSON_BASE": "#a83442",
    "CRIMSON_LIGHT": "#de5f5f",

    # Outfit: leather / wood / lute / tray x3
    "LEATHER_SHADOW": "#4d2d1b",
    "LEATHER_BASE": "#7a492c",
    "LEATHER_LIGHT": "#a86c43",

    # Outfit: steel / plate / blades x3
    "STEEL_SHADOW": "#495369",
    "STEEL_BASE": "#78869e",
    "STEEL_LIGHT": "#b8c7de",
}

CHAR_OUTLINE_KEYS = ("OUTLINE_WARM", "OUTLINE_COOL", "OUTLINE_NATURE")


def _hex_to_rgba(h: str) -> tuple[int, int, int, int]:
    s = h.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


CHAR_PALETTE_RGBA: dict[str, tuple[int, int, int, int]] = {
    k: _hex_to_rgba(v) for k, v in CHAR_PALETTE_HEX.items()
}

CHAR_OUTLINE_RGBA_SET: frozenset[tuple[int, int, int, int]] = frozenset(
    CHAR_PALETTE_RGBA[k] for k in CHAR_OUTLINE_KEYS
)

CHAR_ALL_RGBA_SET: frozenset[tuple[int, int, int, int]] = frozenset(
    CHAR_PALETTE_RGBA.values()
)


def ccol(name: str) -> tuple[int, int, int, int]:
    return CHAR_PALETTE_RGBA[name]


SKIN_RAMPS: dict[str, tuple[str, str, str]] = {
    "porcelain": ("SKIN_LIGHT_SHADOW", "SKIN_LIGHT_BASE", "SKIN_LIGHT_HIGH"),
    "peach": ("SKIN_PEACH_SHADOW", "SKIN_PEACH_BASE", "SKIN_PEACH_HIGH"),
    "tan": ("SKIN_TAN_SHADOW", "SKIN_TAN_BASE", "SKIN_TAN_HIGH"),
    "umber": ("SKIN_DEEP_SHADOW", "SKIN_DEEP_BASE", "SKIN_DEEP_HIGH"),
}

HAIR_RAMPS: dict[str, tuple[str, str, str]] = {
    "raven": ("HAIR_RAVEN_SHADOW", "HAIR_RAVEN_BASE", "HAIR_RAVEN_HIGH"),
    "brown": ("HAIR_BROWN_SHADOW", "HAIR_BROWN_BASE", "HAIR_BROWN_HIGH"),
    "blonde": ("HAIR_BLONDE_SHADOW", "HAIR_BLONDE_BASE", "HAIR_BLONDE_HIGH"),
    "auburn": ("HAIR_AUBURN_SHADOW", "HAIR_AUBURN_BASE", "HAIR_AUBURN_HIGH"),
    "silver": ("WHITE_SHADOW", "WHITE_BASE", "WHITE_HIGH"),
}

OUTFIT_RAMPS: dict[str, tuple[str, str, str]] = {
    "maid_dark": ("OUTLINE_COOL", "HAIR_RAVEN_SHADOW", "HAIR_RAVEN_BASE"),
    "villager_green": ("GREEN_SHADOW", "GREEN_BASE", "GREEN_LIGHT"),
    "villager_blue": ("BLUE_SHADOW", "BLUE_BASE", "BLUE_LIGHT"),
    "leather": ("LEATHER_SHADOW", "LEATHER_BASE", "LEATHER_LIGHT"),
    "crimson": ("CRIMSON_SHADOW", "CRIMSON_BASE", "CRIMSON_LIGHT"),
    "steel": ("STEEL_SHADOW", "STEEL_BASE", "STEEL_LIGHT"),
    "apron_white": ("WHITE_SHADOW", "WHITE_BASE", "WHITE_HIGH"),
    "gold_trim": ("HAIR_BLONDE_SHADOW", "HAIR_BLONDE_BASE", "HAIR_BLONDE_HIGH"),
}


if __name__ == "__main__":
    assert len(CHAR_PALETTE_HEX) <= 48, f"Exceeds 48 colors: {len(CHAR_PALETTE_HEX)}"
    assert (0, 0, 0, 255) not in CHAR_ALL_RGBA_SET, "Pure black is forbidden"
    print(f"Character palette verified: {len(CHAR_PALETTE_HEX)} colors.")
