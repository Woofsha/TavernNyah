"""Master tavern asset pipeline assembler, QA runner, `sheet.png` and `preview.png` renderer.

Combines:
- `tools/props_core.py` (`PROPS_CORE`)
- `tools/props_structure_furniture.py` (`PROPS_STRUCTURE_FURNITURE`)
- `tools/props_kitchen_decor_icons.py` (`PROPS_KITCHEN_DECOR_ICONS`)

Exports:
- `assets/tavern/<name>.png`
- `assets/tavern/manifest.json`
- `sheet.png` (4-column labeled contact sheet, 8x nearest-neighbor upscale, dark background,
  multi-tile pieces shown assembled)
- `preview.png` (cozy diorama scene on tiled wood-plank floor, Y-sorted with engine's contact shadow rule)
"""

from __future__ import annotations
import hashlib
import io
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.palette import ALL_RGBA_SET, OUTLINE_RGBA_SET, col, export_palette_json
from tools.draw_helpers import AssetSpec
from tools.qa_assets import BASE_TILE, QAReport, check_image_qa
from tools.props_core import PROPS_CORE
from tools.props_structure_furniture import PROPS_STRUCTURE_FURNITURE
from tools.props_kitchen_decor_icons import PROPS_KITCHEN_DECOR_ICONS


# Minimal 5x7 crisp bitmap glyph table for contact sheet labels (100% font-file independent)
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
    " ": (".....", ".....", ".....", ".....", "....."),
}


def draw_bitmap_label(img: Image.Image, x: int, y: int, text: str, scale: int = 2) -> None:
    fg = col("CREAM_LIGHT")
    sh = col("OUTLINE_COOL")
    cx = x
    for ch in text.upper():
        rows = GLYPHS_5X7.get(ch, GLYPHS_5X7[" "])
        for ry, rstr in enumerate(rows):
            for rx, bit in enumerate(rstr):
                if bit == "#":
                    for sy in range(scale):
                        for sx in range(scale):
                            px_x = cx + rx * scale + sx
                            px_y = y + ry * scale + sy
                            if 0 <= px_x + scale < img.width and 0 <= px_y + scale < img.height:
                                img.putpixel((px_x + scale, px_y + scale), sh)
                    for sy in range(scale):
                        for sx in range(scale):
                            px_x = cx + rx * scale + sx
                            px_y = y + ry * scale + sy
                            if 0 <= px_x < img.width and 0 <= px_y < img.height:
                                img.putpixel((px_x, px_y), fg)
        cx += 6 * scale


def build_registry() -> dict[str, AssetSpec]:
    merged: dict[str, AssetSpec] = {}
    for src_name, reg in (
        ("props_core", PROPS_CORE),
        ("props_structure_furniture", PROPS_STRUCTURE_FURNITURE),
        ("props_kitchen_decor_icons", PROPS_KITCHEN_DECOR_ICONS),
    ):
        for k, spec in reg.items():
            if k in merged:
                raise ValueError(f"Duplicate asset key '{k}' in {src_name}")
            merged[k] = spec
    return merged


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    return buf.getvalue()


def assemble_multi_groups(
    registry: dict[str, AssetSpec], rendered: dict[str, Image.Image]
) -> dict[str, Image.Image]:
    groups: dict[str, list[tuple[tuple[int, int], Image.Image]]] = {}
    for name, spec in registry.items():
        if spec.multi_group and spec.multi_pos is not None:
            groups.setdefault(spec.multi_group, []).append((spec.multi_pos, rendered[name]))
    assembled: dict[str, Image.Image] = {}
    for gname, parts in groups.items():
        max_gx = max(pos[0] for pos, _ in parts)
        max_gy = max(pos[1] for pos, _ in parts)
        tw, th = parts[0][1].size
        canvas = Image.new("RGBA", ((max_gx + 1) * tw, (max_gy + 1) * th), (0, 0, 0, 0))
        for (gx, gy), part_img in parts:
            canvas.paste(part_img, (gx * tw, gy * th))
        assembled[gname] = canvas
    return assembled


def render_contact_sheet(
    registry: dict[str, AssetSpec],
    rendered: dict[str, Image.Image],
    assembled_groups: dict[str, Image.Image],
    out_path: Path,
) -> None:
    """4-column labeled contact sheet, 8x nearest-neighbor upscale, dark background."""
    scale = 8
    cols = 4
    items: list[tuple[str, Image.Image]] = []
    seen_groups: set[str] = set()

    for name in registry:
        spec = registry[name]
        if spec.multi_group:
            if spec.multi_group not in seen_groups:
                seen_groups.add(spec.multi_group)
                items.append((spec.multi_group, assembled_groups[spec.multi_group]))
        else:
            items.append((name, rendered[name]))

    pad = 24
    label_h = 28
    # Compute column width and per-row heights so nothing clips
    max_up_w = max(im.width * scale for _, im in items)
    cell_w = max(max_up_w + pad * 2, 320)

    rows_data: list[tuple[int, list[tuple[str, Image.Image]]]] = []
    for idx in range(0, len(items), cols):
        chunk = items[idx : idx + cols]
        row_img_h = max(im.height * scale for _, im in chunk)
        rows_data.append((row_img_h + label_h + pad * 2, chunk))

    sheet_w = cols * cell_w + pad * 2
    sheet_h = sum(rh for rh, _ in rows_data) + pad * 2
    bg = col("OUTLINE_COOL")
    card_bg = col("STONE_DEEP")
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg)

    cur_y = pad
    for row_h, chunk in rows_data:
        for c_idx, (label, im) in enumerate(chunk):
            cx0 = pad + c_idx * cell_w
            # Subtle inner card frame
            card = Image.new("RGBA", (cell_w - 12, row_h - 12), card_bg)
            sheet.paste(card, (cx0 + 6, cur_y + 6))

            up = im.resize((im.width * scale, im.height * scale), resample=Image.Resampling.NEAREST)
            ix = cx0 + (cell_w - up.width) // 2
            iy = cur_y + (row_h - label_h - up.height) // 2
            sheet.alpha_composite(up, (ix, iy))

            lbl = label[:24]
            lbl_w = len(lbl) * 12
            lx = cx0 + max(8, (cell_w - lbl_w) // 2)
            ly = cur_y + row_h - label_h - 4
            draw_bitmap_label(sheet, lx, ly, lbl, scale=2)
        cur_y += row_h

    sheet.save(out_path, format="PNG")


def draw_contact_shadow(canvas: Image.Image, foot_x: int, foot_y: int, rx: int, ry: int) -> None:
    """Engine contact shadow rule: crisp pixel ellipse drawn directly beneath entity feet."""
    sh_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sc = col("OUTLINE_WARM")
    shadow_rgba = (sc[0], sc[1], sc[2], 115)
    for py in range(foot_y - ry, foot_y + ry + 1):
        for px_x in range(foot_x - rx, foot_x + rx + 1):
            if 0 <= px_x < canvas.width and 0 <= py < canvas.height:
                nx = (px_x - foot_x) / max(1, rx)
                ny = (py - foot_y) / max(1, ry)
                if nx * nx + ny * ny <= 1.0:
                    sh_layer.putpixel((px_x, py), shadow_rgba)
    canvas.alpha_composite(sh_layer)


def render_preview_scene(
    registry: dict[str, AssetSpec],
    rendered: dict[str, Image.Image],
    assembled_groups: dict[str, Image.Image],
    out_path: Path,
) -> None:
    """Render `preview.png`: cozy tavern room on tiled wood-plank floor, Y-sorted, with engine shadows."""
    cols_t, rows_t = 16, 10
    scene_w, scene_h = cols_t * BASE_TILE, rows_t * BASE_TILE
    scene = Image.new("RGBA", (scene_w, scene_h), col("OUTLINE_WARM"))

    # 1. Tile wood-plank floor (rows 2..9) and kitchen stone patch on right
    floor_wood = rendered["floor_wood_planks"]
    floor_kitchen = rendered["floor_kitchen"]
    for ty in range(rows_t):
        for tx in range(cols_t):
            tile = floor_kitchen if (tx >= 12 and ty >= 2) else floor_wood
            scene.paste(tile, (tx * BASE_TILE, ty * BASE_TILE))

    # 2. Back cutaway wall across top 2 tile rows (y = 0..64)
    wall_mid = rendered["wall_timber_mid"]
    wall_win = rendered["wall_timber_window"]
    wall_stone = rendered["wall_stone_mid"]
    for tx in range(cols_t):
        if tx in (3, 9):
            w_tile = wall_win
        elif tx >= 12:
            w_tile = wall_stone
        else:
            w_tile = wall_mid
        scene.paste(w_tile, (tx * BASE_TILE, 0))

    # 3. Rugs on floor layer (before Y-sorted entities)
    if "rug_red" in assembled_groups:
        scene.alpha_composite(assembled_groups["rug_red"], (5 * BASE_TILE, 5 * BASE_TILE))
    if "rug_accent" in assembled_groups:
        scene.alpha_composite(assembled_groups["rug_accent"], (1 * BASE_TILE, 6 * BASE_TILE))

    # 4. Wall-mounted / hanging props positioned cleanly on solid wall panels (avoiding windows at tx=3,9)
    wall_mounts = [
        ("banner_red", 0 * BASE_TILE + 4, 8),
        ("lantern_wall", 2 * BASE_TILE + 10, 14),
        ("quest_board_full", 4 * BASE_TILE + 8, 6),
        ("painting_landscape", 5 * BASE_TILE + 20, 16),
        ("sign_tavern", 10 * BASE_TILE + 20, 10),
        ("drying_rack_herbs", 12 * BASE_TILE + 8, 8),
    ]
    for aname, wx, wy in wall_mounts:
        if aname in rendered:
            scene.alpha_composite(rendered[aname], (wx, wy))

    # 5. Y-sorted entities (anchor = (0.5, 1.0) at foot_x, foot_y)
    # Also place canon Nyah & Fifi world frames if available so scale harmony is directly visible!
    entities: list[tuple[int, str, Image.Image, int, int, bool, tuple[int, int] | None]] = []

    def add_prop(name: str, fx: int, fy: int, shadow: bool = True, custom_sh: tuple[int, int] | None = None) -> None:
        if name not in rendered:
            return
        im = rendered[name]
        entities.append((fy, name, im, fx, fy, shadow, custom_sh))

    add_prop("fireplace_1", 7 * BASE_TILE + 16, 2 * BASE_TILE + 14, shadow=False)
    add_prop("potion_display", 2 * BASE_TILE, 2 * BASE_TILE + 18, shadow=True, custom_sh=(26, 6))
    add_prop("keg_rack", 10 * BASE_TILE + 16, 2 * BASE_TILE + 20, shadow=True, custom_sh=(26, 6))
    add_prop("pantry", 15 * BASE_TILE - 4, 2 * BASE_TILE + 20, shadow=True, custom_sh=(20, 6))
    add_prop("armor_stand", 4 * BASE_TILE - 8, 2 * BASE_TILE + 24, shadow=True, custom_sh=(13, 5))

    # Bar counter & stools
    add_prop("bar_counter_taps", 9 * BASE_TILE + 16, 4 * BASE_TILE + 8, shadow=True, custom_sh=(44, 8))
    add_prop("stool", 8 * BASE_TILE + 14, 4 * BASE_TILE + 24, shadow=True, custom_sh=(9, 4))
    add_prop("stool", 9 * BASE_TILE + 16, 4 * BASE_TILE + 24, shadow=True, custom_sh=(9, 4))
    add_prop("stool", 10 * BASE_TILE + 18, 4 * BASE_TILE + 24, shadow=True, custom_sh=(9, 4))

    # Kitchen zone on right
    add_prop("stove_cauldron", 13 * BASE_TILE + 16, 4 * BASE_TILE + 20, shadow=True, custom_sh=(28, 7))
    add_prop("prep_counter", 13 * BASE_TILE + 16, 7 * BASE_TILE + 8, shadow=True, custom_sh=(28, 7))
    add_prop("spit_roast", 14 * BASE_TILE, 9 * BASE_TILE - 4, shadow=True, custom_sh=(26, 7))

    # Dining tables + chairs + tabletop food/ale
    add_prop("chair", 2 * BASE_TILE - 6, 5 * BASE_TILE + 8, shadow=True, custom_sh=(10, 4))
    add_prop("chair", 4 * BASE_TILE + 6, 5 * BASE_TILE + 8, shadow=True, custom_sh=(10, 4))
    add_prop("table_round", 3 * BASE_TILE, 5 * BASE_TILE + 16, shadow=True, custom_sh=(26, 8))

    add_prop("chair", 5 * BASE_TILE - 4, 7 * BASE_TILE + 12, shadow=True, custom_sh=(10, 4))
    add_prop("chair", 7 * BASE_TILE + 4, 7 * BASE_TILE + 12, shadow=True, custom_sh=(10, 4))
    add_prop("table_t3_clothed", 6 * BASE_TILE, 7 * BASE_TILE + 20, shadow=True, custom_sh=(26, 8))

    add_prop("table_t4_ornate", 9 * BASE_TILE + 16, 8 * BASE_TILE + 12, shadow=True, custom_sh=(26, 8))
    add_prop("plant_pot", 1 * BASE_TILE - 4, 9 * BASE_TILE - 4, shadow=True, custom_sh=(10, 4))
    add_prop("crates_sacks", 11 * BASE_TILE + 16, 9 * BASE_TILE + 8, shadow=True, custom_sh=(20, 6))

    # Load Nyah & Fifi single idle cell (without modifying canon files) to verify diorama scale
    nyah_p = ROOT / "character sprites" / "nyah_world.png"
    fifi_p = ROOT / "character sprites" / "fifi_world.png"
    if nyah_p.exists() and fifi_p.exists():
        nyah_cell = Image.open(nyah_p).convert("RGBA").crop((48, 0, 96, 48))
        fifi_cell = Image.open(fifi_p).convert("RGBA").crop((48, 0, 96, 48))
        entities.append((6 * BASE_TILE + 4, "nyah", nyah_cell, 5 * BASE_TILE - 4, 6 * BASE_TILE + 4, True, (10, 4)))
        entities.append((6 * BASE_TILE + 20, "fifi", fifi_cell, 8 * BASE_TILE - 8, 6 * BASE_TILE + 20, True, (10, 4)))

    entities.sort(key=lambda e: e[0])
    for _, ename, im, fx, fy, has_sh, c_sh in entities:
        if has_sh:
            rx, ry = c_sh if c_sh else (max(8, im.width // 2 - 4), max(4, im.height // 8))
            draw_contact_shadow(scene, fx, fy - 1, rx, ry)
        dx = int(fx - im.width // 2)
        dy = int(fy - im.height)
        scene.alpha_composite(im, (dx, dy))
        # Tabletop & chimney mount overlays
        if ename == "fireplace_1" and "trophy_stag" in rendered:
            stag = rendered["trophy_stag"]
            scene.alpha_composite(stag, (fx - stag.width // 2, fy - im.height + 2))
        elif ename == "table_round" and "ale_tray_three" in rendered:
            tray = rendered["ale_tray_three"]
            scene.alpha_composite(tray, (fx - tray.width // 2, fy - 38))
        elif ename == "table_t3_clothed" and "roast_chicken_platter" in rendered:
            roast = rendered["roast_chicken_platter"]
            scene.alpha_composite(roast, (fx - roast.width // 2, fy - 40))
        elif ename == "table_t4_ornate" and "candles_cluster" in rendered:
            cand = rendered["candles_cluster"]
            scene.alpha_composite(cand, (fx - cand.width // 2, fy - 40))

    # Hanging chandelier suspended from top ceiling rafter beam in open dining bay (away from windows at tx=3,9)
    if "chandelier" in rendered:
        ch_im = rendered["chandelier"]
        scene.alpha_composite(ch_im, (6 * BASE_TILE - ch_im.width // 2, 2))

    # Save crisp 2x nearest-neighbor upscale so preview is immediately legible at 1024x640
    preview_up = scene.resize((scene_w * 2, scene_h * 2), resample=Image.Resampling.NEAREST)
    preview_up.save(out_path, format="PNG")


def main() -> int:
    export_palette_json()
    registry = build_registry()
    out_dir = ROOT / "assets" / "tavern"
    out_dir.mkdir(parents=True, exist_ok=True)

    # First pass render
    rendered_1: dict[str, Image.Image] = {name: spec.fn() for name, spec in registry.items()}
    # Second pass render to verify byte-identical determinism
    rendered_2: dict[str, Image.Image] = {name: spec.fn() for name, spec in registry.items()}

    report = QAReport()

    for name in registry:
        b1 = png_bytes(rendered_1[name])
        b2 = png_bytes(rendered_2[name])
        if hashlib.sha256(b1).digest() != hashlib.sha256(b2).digest():
            report.errors.append(f"{name}: non-deterministic output across two runs")

    assembled = assemble_multi_groups(registry, rendered_1)
    for gname, gimg in assembled.items():
        check_image_qa(
            f"{gname} (assembled)",
            gimg,
            ALL_RGBA_SET,
            OUTLINE_RGBA_SET,
            report,
            tile_layer=True,
            tileable=False,
            check_outline=True,
            skip_bottom_anchor=True,
        )

    manifest_assets: dict[str, dict] = {}
    for name, spec in registry.items():
        img = rendered_1[name]
        is_tile_layer = spec.layer in ("floor", "wall", "rug")
        is_multi_slice = spec.multi_group is not None
        skip_anchor = spec.tileable or is_multi_slice or spec.layer in ("icon", "ui")
        check_image_qa(
            name,
            img,
            ALL_RGBA_SET,
            OUTLINE_RGBA_SET,
            report,
            expected_size=img.size,
            tile_layer=is_tile_layer,
            tileable=spec.tileable,
            check_outline=(not spec.tileable and not is_multi_slice),
            hangs=spec.hangs,
            skip_bottom_anchor=skip_anchor,
        )
        (out_dir / f"{name}.png").write_bytes(png_bytes(img))
        manifest_assets[name] = {
            "file": f"assets/tavern/{name}.png",
            "size": [img.width, img.height],
            "footprint": [spec.footprint[0], spec.footprint[1]],
            "layer": spec.layer,
            "anchor": [0.5, 1.0],
            "tileable": spec.tileable,
            "hangs": spec.hangs,
            "multiGroup": spec.multi_group,
            "multiPos": list(spec.multi_pos) if spec.multi_pos else None,
        }

    manifest_payload = {
        "schemaVersion": 1,
        "baseTile": BASE_TILE,
        "assetCount": len(manifest_assets),
        "assets": manifest_assets,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8"
    )

    render_contact_sheet(registry, rendered_1, assembled, ROOT / "sheet.png")
    render_preview_scene(registry, rendered_1, assembled, ROOT / "preview.png")

    print(report.format_summary("Tavern Asset Pipeline QA"))
    print(f"Exported {len(manifest_assets)} assets, sheet.png, and preview.png.")
    return 0 if report.ok() else 1


if __name__ == "__main__":
    raise SystemExit(main())
