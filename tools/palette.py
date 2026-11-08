"""Frozen 43-color tavern & UI palette.

Rules:
- Max 48 colors (exact 43 fixed roles defined below).
- Zero pure black (#000000).
- Never write raw hex outside palette files.
- Run `python tools/palette.py` to mirror to `data/palette.json`.
"""

from __future__ import annotations
import json
from pathlib import Path

PALETTE_HEX: dict[str, str] = {
    # Outlines x3 (hue-shifted per material, never pure black)
    "OUTLINE_WARM": "#2b1a12",          # wood, cloth, food, gold, parchment
    "OUTLINE_COOL": "#1d2033",          # stone, metal, glass
    "OUTLINE_LEAF": "#162b1e",          # plants, herbs, trees

    # Wood x4 (cool-leaning deep/shadow -> warm mid/highlight)
    "WOOD_DEEP": "#4a2c1d",
    "WOOD_SHADOW": "#6e4228",
    "WOOD_BASE": "#9c633b",
    "WOOD_LIGHT": "#c78c59",

    # Stone x4 (cool slate shadow -> warm-lit stone top)
    "STONE_DEEP": "#33384a",
    "STONE_SHADOW": "#4d546b",
    "STONE_BASE": "#737c94",
    "STONE_LIGHT": "#9ea8bd",

    # Metal x3
    "METAL_SHADOW": "#3f485c",
    "METAL_BASE": "#6d7a91",
    "METAL_LIGHT": "#b3c2d6",

    # Cloth red x3
    "CLOTH_RED_SHADOW": "#6e1d2a",
    "CLOTH_RED_BASE": "#a8323e",
    "CLOTH_RED_LIGHT": "#db5a58",

    # Accent cloth x3 (royal teal-blue)
    "CLOTH_ACCENT_SHADOW": "#1f425c",
    "CLOTH_ACCENT_BASE": "#326b8a",
    "CLOTH_ACCENT_LIGHT": "#5ca3bd",

    # Gold x2
    "GOLD_BASE": "#c98a2c",
    "GOLD_LIGHT": "#f5cb5c",

    # Flame x3
    "FLAME_EMBER": "#b83525",
    "FLAME_ORANGE": "#eb7526",
    "FLAME_YELLOW": "#ffe066",

    # Potion glass x5
    "POTION_RED": "#e03c52",
    "POTION_BLUE": "#3b8eea",
    "POTION_GREEN": "#44bd68",
    "POTION_PURPLE": "#9b54d6",
    "POTION_YELLOW": "#f0c237",

    # Parchment x3
    "PARCHMENT_SHADOW": "#b89d7a",
    "PARCHMENT_BASE": "#dec6a2",
    "PARCHMENT_LIGHT": "#f5e6cc",

    # Foam / cream x2
    "CREAM_SHADOW": "#d6cfc2",
    "CREAM_LIGHT": "#fff8eb",

    # Ale amber x2
    "ALE_BASE": "#bd6819",
    "ALE_LIGHT": "#f09f35",

    # Leaf green x3
    "LEAF_SHADOW": "#285238",
    "LEAF_BASE": "#46824c",
    "LEAF_LIGHT": "#7ab865",

    # Roast / bread browns x3
    "ROAST_SHADOW": "#5c2b18",
    "ROAST_BASE": "#964c26",
    "ROAST_LIGHT": "#cc7d43",
}

OUTLINE_KEYS = ("OUTLINE_WARM", "OUTLINE_COOL", "OUTLINE_LEAF")

RAMPS: dict[str, tuple[str, ...]] = {
    "wood": ("WOOD_DEEP", "WOOD_SHADOW", "WOOD_BASE", "WOOD_LIGHT"),
    "stone": ("STONE_DEEP", "STONE_SHADOW", "STONE_BASE", "STONE_LIGHT"),
    "metal": ("METAL_SHADOW", "METAL_BASE", "METAL_LIGHT"),
    "cloth_red": ("CLOTH_RED_SHADOW", "CLOTH_RED_BASE", "CLOTH_RED_LIGHT"),
    "cloth_accent": ("CLOTH_ACCENT_SHADOW", "CLOTH_ACCENT_BASE", "CLOTH_ACCENT_LIGHT"),
    "gold": ("GOLD_BASE", "GOLD_LIGHT"),
    "flame": ("FLAME_EMBER", "FLAME_ORANGE", "FLAME_YELLOW"),
    "parchment": ("PARCHMENT_SHADOW", "PARCHMENT_BASE", "PARCHMENT_LIGHT"),
    "cream": ("CREAM_SHADOW", "CREAM_LIGHT"),
    "ale": ("ALE_BASE", "ALE_LIGHT"),
    "leaf": ("LEAF_SHADOW", "LEAF_BASE", "LEAF_LIGHT"),
    "roast": ("ROAST_SHADOW", "ROAST_BASE", "ROAST_LIGHT"),
}


def _hex_to_rgba(h: str) -> tuple[int, int, int, int]:
    s = h.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


PALETTE_RGBA: dict[str, tuple[int, int, int, int]] = {
    k: _hex_to_rgba(v) for k, v in PALETTE_HEX.items()
}

OUTLINE_RGBA_SET: frozenset[tuple[int, int, int, int]] = frozenset(
    PALETTE_RGBA[k] for k in OUTLINE_KEYS
)

ALL_RGBA_SET: frozenset[tuple[int, int, int, int]] = frozenset(PALETTE_RGBA.values())


def col(name: str) -> tuple[int, int, int, int]:
    """Return RGBA tuple for a named palette role."""
    return PALETTE_RGBA[name]


def ramp_rgba(ramp_name: str) -> list[tuple[int, int, int, int]]:
    """Return ordered shadow->highlight RGBA list for a material ramp."""
    return [PALETTE_RGBA[k] for k in RAMPS[ramp_name]]


def export_palette_json(out_path: Path | None = None) -> Path:
    root = Path(__file__).resolve().parent.parent
    target = out_path or (root / "data" / "palette.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "count": len(PALETTE_HEX),
        "maxAllowed": 48,
        "outlines": list(OUTLINE_KEYS),
        "colors": PALETTE_HEX,
        "ramps": {k: list(v) for k, v in RAMPS.items()},
    }
    target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return target


if __name__ == "__main__":
    assert len(PALETTE_HEX) <= 48, f"Palette exceeds 48 colors: {len(PALETTE_HEX)}"
    assert (0, 0, 0, 255) not in ALL_RGBA_SET, "Pure black is forbidden"
    out = export_palette_json()
    print(f"Exported {len(PALETTE_HEX)} colors to {out}")
