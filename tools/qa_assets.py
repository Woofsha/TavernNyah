"""Frozen QA validator for generated tavern assets and paper-doll NPC sprites.

Quality checks enforced (exit non-zero on any violation):
1. Every opaque pixel is in the allowed palette; zero pure black (0, 0, 0, 255).
2. Alpha is strictly 0 or 255.
3. Closed 1px 4-neighbor outline on non-tileable props/characters (tested on assembled
   multi-tile groups rather than individual slices).
4. Anchor sanity: lowest opaque row touches bottom of image (`y == h - 1`) unless `hangs=True`
   or `skip_bottom_anchor=True` (for tileable floors/rugs/UI 9-slices).
5. Sizes match manifest; tile-layer pieces (`floor`, `wall`, `rug`) are multiples of base tile (`32x32`).
6. Warn-only: isolated single-pixel orphans (opaque pixel with zero 4-neighbor opaque pixels).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from PIL import Image

RGBA = tuple[int, int, int, int]
BASE_TILE = 32


@dataclass
class QAReport:
    checked: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def ok(self) -> bool:
        return len(self.errors) == 0

    def format_summary(self, label: str = "Asset QA") -> str:
        lines = [f"=== {label}: checked {self.checked} items | errors={len(self.errors)} | warnings={len(self.warnings)} ==="]
        for w in self.warnings[:20]:
            lines.append(f"  [WARN] {w}")
        if len(self.warnings) > 20:
            lines.append(f"  [WARN] ...and {len(self.warnings) - 20} more warnings")
        for e in self.errors[:40]:
            lines.append(f"  [FAIL] {e}")
        if len(self.errors) > 40:
            lines.append(f"  [FAIL] ...and {len(self.errors) - 40} more errors")
        return "\n".join(lines)


def check_image_qa(
    name: str,
    img: Image.Image,
    allowed_rgba: frozenset[RGBA],
    outline_rgba: frozenset[RGBA],
    report: QAReport,
    *,
    expected_size: tuple[int, int] | None = None,
    tile_layer: bool = False,
    tileable: bool = False,
    check_outline: bool = True,
    hangs: bool = False,
    skip_bottom_anchor: bool = False,
) -> None:
    report.checked += 1
    w, h = img.size

    if expected_size is not None and (w, h) != tuple(expected_size):
        report.errors.append(f"{name}: size {(w, h)} != manifest {expected_size}")

    if tile_layer and (w % BASE_TILE != 0 or h % BASE_TILE != 0):
        report.errors.append(f"{name}: tile-layer size {(w, h)} is not a multiple of {BASE_TILE}x{BASE_TILE}")

    bad_alpha = 0
    bad_palette: set[RGBA] = set()
    pure_black = 0
    outline_leaks: list[tuple[int, int]] = []
    orphans = 0
    max_opaque_y = -1
    any_opaque = False

    pixels = img.load()
    for y in range(h):
        for x in range(w):
            px: RGBA = pixels[x, y]
            a = px[3]
            if a not in (0, 255):
                bad_alpha += 1
                continue
            if a == 0:
                continue
            any_opaque = True
            if y > max_opaque_y:
                max_opaque_y = y
            if px == (0, 0, 0, 255):
                pure_black += 1
            if px not in allowed_rgba:
                bad_palette.add(px)

            # Orphan check (4-neighbor)
            opaque_nbs = 0
            touches_trans_or_edge = (x == 0 or x == w - 1 or y == 0 or y == h - 1)
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    if pixels[nx, ny][3] == 255:
                        opaque_nbs += 1
                    else:
                        touches_trans_or_edge = True
            if opaque_nbs == 0:
                orphans += 1
            if check_outline and not tileable and touches_trans_or_edge:
                if px not in outline_rgba:
                    outline_leaks.append((x, y))

    if not any_opaque:
        report.errors.append(f"{name}: image is completely empty/transparent")
        return

    if bad_alpha > 0:
        report.errors.append(f"{name}: {bad_alpha} pixels have non-binary alpha (not 0 or 255)")
    if pure_black > 0:
        report.errors.append(f"{name}: {pure_black} pure black (0,0,0,255) pixels found")
    if bad_palette:
        sample = list(bad_palette)[:4]
        report.errors.append(f"{name}: {len(bad_palette)} off-palette colors found, e.g. {sample}")
    if outline_leaks:
        report.errors.append(
            f"{name}: unclosed outline at {len(outline_leaks)} border pixels, e.g. {outline_leaks[:5]}"
        )
    if not tileable and not hangs and not skip_bottom_anchor:
        if max_opaque_y != h - 1:
            report.errors.append(
                f"{name}: anchor sanity failed — lowest opaque row is y={max_opaque_y}, expected y={h - 1}"
            )
    if orphans > 0:
        report.warnings.append(f"{name}: {orphans} isolated single-pixel orphan(s)")
