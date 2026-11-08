"""Frozen validator for all `data/*.json` files against `ARCHITECTURE.md` & `data/schemas.json`.

Usage:
  python tools/validate_data.py               # validates all data files
  python tools/validate_data.py economy       # validates recipes, upgrades, customers, staff
  python tools/validate_data.py narrative     # validates dialogue, thoughts
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load_json(name: str) -> dict:
    p = DATA / name
    if not p.exists():
        raise FileNotFoundError(f"Missing {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def validate_economy(errors: list[str]) -> None:
    try:
        recipes = load_json("recipes.json")["recipes"]
        upgrades = load_json("upgrades.json")["upgrades"]
        cust = load_json("customers.json")
        staff = load_json("staff.json")
    except Exception as exc:
        errors.append(f"Economy JSON load failed: {exc}")
        return

    if len(recipes) < 12:
        errors.append(f"recipes.json: expected >= 12 recipes, got {len(recipes)}")
    seen_r: set[str] = set()
    starter_unlocked = 0
    for r in recipes:
        rid = r.get("id")
        if not rid or rid in seen_r:
            errors.append(f"recipes.json: duplicate/missing id {rid}")
        seen_r.add(rid)
        for k in ("name", "category", "station", "tier", "price", "cookTime", "unlockCost", "repRequired", "icon", "worldProp", "desc"):
            if k not in r:
                errors.append(f"recipes.json[{rid}]: missing field {k}")
        if r.get("category") not in ("drink", "food", "ration", "potion"):
            errors.append(f"recipes.json[{rid}]: invalid category {r.get('category')}")
        if r.get("station") not in ("bar", "kitchen", "counter"):
            errors.append(f"recipes.json[{rid}]: invalid station {r.get('station')}")
        if r.get("unlockCost") == 0:
            starter_unlocked += 1
    if starter_unlocked < 2:
        errors.append("recipes.json: need at least 2 starter-unlocked recipes (unlockCost == 0)")

    if len(upgrades) < 24:
        errors.append(f"upgrades.json: expected >= 24 upgrades, got {len(upgrades)}")
    seen_u: set[str] = set()
    tabs_seen: set[str] = set()
    for u in upgrades:
        uid = u.get("id")
        if not uid or uid in seen_u:
            errors.append(f"upgrades.json: duplicate/missing id {uid}")
        seen_u.add(uid)
        tabs_seen.add(u.get("tab", ""))
        for k in ("name", "tab", "kind", "baseCost", "costGrowth", "maxLevel", "repRequired", "icon", "effect", "nyahComment", "desc"):
            if k not in u:
                errors.append(f"upgrades.json[{uid}]: missing field {k}")
        if u.get("kind") == "repeatable":
            g = float(u.get("costGrowth", 0))
            if not (1.10 <= g <= 1.30):
                errors.append(f"upgrades.json[{uid}]: repeatable costGrowth {g} outside [1.10, 1.30]")
    for req_tab in ("tables", "building", "staff", "decor"):
        if req_tab not in tabs_seen:
            errors.append(f"upgrades.json: missing tab '{req_tab}'")

    for u in upgrades:
        req = u.get("requires")
        if req and req not in seen_u:
            errors.append(f"upgrades.json[{u['id']}]: requires unknown upgrade '{req}'")

    archs = {a["id"] for a in cust.get("archetypes", [])}
    for req_a in ("villager", "adventurer_rookie", "adventurer_veteran", "merchant", "noble"):
        if req_a not in archs:
            errors.append(f"customers.json: missing archetype '{req_a}'")
    phases = {p["id"] for p in cust.get("dayPhases", [])}
    for req_p in ("morning", "afternoon", "evening", "night"):
        if req_p not in phases:
            errors.append(f"customers.json: missing dayPhase '{req_p}'")

    canon_ids = {s["id"] for s in staff.get("canonStaff", [])}
    for cid in ("nyah", "fifi", "barnaby"):
        if cid not in canon_ids:
            errors.append(f"staff.json: missing canonStaff '{cid}'")
    hire_maids = [s for s in staff.get("hireableStaff", []) if s.get("role") == "maid"]
    maid_pers = {s.get("personality") for s in hire_maids}
    for mp in ("flustered", "defiant", "delighted", "unimpressed"):
        if mp not in maid_pers:
            errors.append(f"staff.json: missing hireable maid personality '{mp}'")
    hire_roles = {s.get("role") for s in staff.get("hireableStaff", [])}
    for hr in ("maid", "chef", "bartender", "musician", "dancer"):
        if hr not in hire_roles:
            errors.append(f"staff.json: missing hireable role '{hr}'")


def validate_narrative(errors: list[str]) -> None:
    try:
        dlg = load_json("dialogue.json")
        tht = load_json("thoughts.json")
    except Exception as exc:
        errors.append(f"Narrative JSON load failed: {exc}")
        return

    intro = dlg.get("intro", [])
    total_dur = sum(float(b.get("durationSec", 0)) for b in intro)
    if not (32.0 <= total_dur <= 52.0):
        errors.append(f"dialogue.json: intro duration {total_dur:.1f}s outside [32, 52]s target (~40s)")
    fifi_protest_dur = sum(
        float(b.get("durationSec", 0))
        for b in intro
        if b.get("speaker") == "fifi" and b.get("mood") in ("protest", "panic", "worried", "flustered")
    )
    if fifi_protest_dur < 14.0:
        errors.append(f"dialogue.json: Fifi protest sequence is {fifi_protest_dur:.1f}s, must be >= 14.0s (~15s)")

    banter = dlg.get("banter", [])
    if len(banter) < 80:
        errors.append(f"dialogue.json: banter has {len(banter)} lines, MUST be >= 80")

    hire_scenes = dlg.get("hireScenes", {})
    if len(hire_scenes) < 4:
        errors.append(f"dialogue.json: hireScenes has {len(hire_scenes)} entries, need >= 4")

    if len(dlg.get("offlineTemplates", [])) < 4:
        errors.append("dialogue.json: need >= 4 offlineTemplates")

    folk = tht.get("namesByFolk", {})
    for rf in ("human", "dwarf", "elf", "halfling", "beastfolk"):
        if rf not in folk or len(folk[rf].get("first", [])) < 8 or len(folk[rf].get("last", [])) < 8:
            errors.append(f"thoughts.json: namesByFolk['{rf}'] needs >= 8 first and >= 8 last names")

    lt = tht.get("liveThoughts", {})
    req_situations = (
        "entering", "waiting_to_order", "waiting_for_food", "eating_happy",
        "eating_unimpressed", "buying_supplies", "heading_on_quest",
        "returned_from_quest", "renting_room", "sleeping",
        "enjoying_entertainment", "leaving_happy", "leaving_upset",
        "maid_working", "chef_working", "entertainer_working",
    )
    for sit in req_situations:
        arr = lt.get(sit, [])
        if len(arr) < 8:
            errors.append(f"thoughts.json: liveThoughts['{sit}'] has {len(arr)} variants, MUST be >= 8")

    ops = tht.get("opinions", {})
    for topic in ("tavern", "food", "prices", "nyah", "fifi"):
        bucket = ops.get(topic, {})
        total_v = sum(len(bucket.get(tier, [])) for tier in ("low", "mid", "high"))
        if total_v < 9 or any(len(bucket.get(tier, [])) < 3 for tier in ("low", "mid", "high")):
            errors.append(
                f"thoughts.json: opinions['{topic}'] needs >= 3 per tier (low/mid/high) and >= 9 total, got {total_v}"
            )


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    errors: list[str] = []
    if mode in ("all", "economy"):
        validate_economy(errors)
    if mode in ("all", "narrative"):
        validate_narrative(errors)
    if errors:
        print(f"VALIDATION FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"VALIDATION PASSED ({mode}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
