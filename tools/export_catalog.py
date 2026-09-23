#!/usr/bin/env python3
"""
Export the app's plant catalog to the website.

Reads PlantItem.sampleCatalog straight out of the visionOS app's
PlantItem.swift (the literal array — no Swift toolchain needed), then writes

  assets/catalog/catalog.json      the data behind each tile's preview card
  assets/catalog/card/<slug>.webp  the card's image: the app's 1024px render,
                                   cropped to the plant, 800px on the long side
  index.html  (between <!-- catalog:shelves --> markers)
                                   the three marquee shelves of tiles

so the shelves and the cards can never drift from what the app ships.
Adding a plant to the site = add its name to ROWS below (and drop its render
in assets/catalog/), then run this. Entries the app has that aren't placed
on a shelf are listed at the end as a reminder.

  python3 tools/export_catalog.py            # write both outputs
  python3 tools/export_catalog.py --check    # exit 1 if either is stale
"""
import argparse
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DEFAULT_SWIFT = SITE.parent / "Verde-Vision" / "Test" / "Test" / "Models" / "PlantItem.swift"
JSON_OUT = SITE / "assets" / "catalog" / "catalog.json"
INDEX = SITE / "index.html"
IMG_DIR = SITE / "assets" / "catalog"
CARD_DIR = IMG_DIR / "card"
CARD_PX = 800          # long side of a card image; 2× the ~400px it displays at
CARD_MARGIN = 0.03     # breathing room around the plant's alpha bbox
MARK_OPEN, MARK_CLOSE = "<!-- catalog:shelves -->", "<!-- /catalog:shelves -->"

# ── The site's view of the catalog ──────────────────────────────────────
# Keyed by the app's name. `name` is what the tile says when the app's name
# is too internal; `image` overrides the render's basename; `kind` is the
# tile's small label (finer than the app's shopping category); `photo`
# marks tiles that are photographs rather than renders (object-fit: cover).
SITE_OVERRIDES = {
    "Golden Barrel Cactus": {"name": "Golden Barrel"},
    "Fire Barrel Cactus":   {"name": "Fire Barrel"},
    "Totem Pole Cactus":    {"name": "Totem Pole", "image": "totem-pole-cactus"},
    "Organ Pipe Cactus":    {"name": "Organ Pipe", "image": "organ-pipe-cactus"},
    "Agave Truncata":       {"name": "Artichoke Agave", "image": "agave-truncata"},
    "Agave Geminiflora":    {"name": "Twin-flowered Agave", "image": "agave-geminiflora"},
    "AZ Boulder 1":         {"name": "Arizona Boulder", "image": "az-boulder"},
    "Landscape Uplight":    {"name": "Uplight"},
}

KIND = {
    "Mexican Fan Palm": "Palm", "Madagascar Palm": "Palm",
    "Saguaro": "Cactus", "Organ Pipe Cactus": "Cactus", "Totem Pole Cactus": "Cactus",
    "Mexican Fence Post": "Cactus", "Argentine Toothpick": "Cactus", "Golden Barrel Cactus": "Cactus",
    "Fire Barrel Cactus": "Cactus", "Santa Rita Prickly Pear": "Cactus",
    "Agave Americana": "Agave", "Agave Truncata": "Agave", "Blue Glow Agave": "Agave",
    "Black Tip Agave": "Agave", "Agave Geminiflora": "Agave", "Tropical Agave": "Agave",
    "Desert Spoon": "Accent", "Red Yucca": "Accent", "Beaked Yucca": "Yucca",
    "Ocotillo": "Shrub",
    "Aloe Vera": "Succulent", "Aloe Ferox": "Succulent", "Moroccan Mound": "Succulent", "Firestick": "Succulent",
}
KIND_BY_CATEGORY = {
    "tree": "Tree", "shrub": "Shrub", "flower": "Flower", "grass": "Grass", "succulent": "Succulent",
    "groundcover": "Groundcover", "hardscape": "Boulder", "lighting": "Lighting",
}
# Tiles whose art is a photograph rather than a transparent render, so the tile
# crops to fill (object-fit: cover) instead of sitting on the card. Empty since
# the three LED fixtures were re-rendered as transparent lit product shots —
# they used to be opaque night scenes, which read as black boxes on paper.
PHOTO_TILES = set()

# How each asset was made — the card says so, because the intro copy promises
# it. Anything in neither set gets no badge (legacy entries whose provenance
# isn't recorded in the Swift comments; fill them in as you confirm them).
MODELLED = {
    "Blue Palo Verde", "Chaste Tree", "Beaked Yucca", "Agave Geminiflora",   # purchased models
    "Texas Ebony", "Mulga", "Desert Spoon", "Green Hopseed", "Ocotillo",      # generated (Sep 2026)
    "Aloe Vera", "Mexican Fence Post", "Orange Tree",                         # .blend marketplace models
}
SCANNED = {
    "Agave Americana", "Golden Barrel Cactus", "AZ Boulder 1", "Totem Pole Cactus", "Organ Pipe Cactus",
    "Agave Truncata", "Tropical Agave", "Fire Barrel Cactus", "Yellow Bells", "Firestick",
    "Little John Bottlebrush", "Moroccan Mound", "Santa Rita Prickly Pear", "Madagascar Palm",
    "Black Tip Agave", "Desert Willow", "Desert Ironwood", "Jojoba", "Leatherleaf Acacia",
    "White Dawn Lantana", "Purple Lantana", "Yellow Lantana", "Texas Sage", "Aloe Ferox", "Blue Glow Agave",
}

# The three shelves, in tile order, by SITE name. Lights and boulders are
# spaced through the rows on purpose; keep each row long enough (≥ 13) that
# the loop doesn't visibly repeat on a wide screen.
ROWS = [
    {"dir": "left", "speed": 34, "tiles": [
        "Blue Palo Verde", "Desert Ironwood", "Honey Mesquite", "Path Light", "Desert Willow", "Texas Ebony",
        "Mulga", "Chaste Tree", "Orange Tree", "Leatherleaf Acacia", "Arizona Boulder", "Mexican Fan Palm",
        "Madagascar Palm", "Texas Sage", "Green Hopseed", "Jojoba", "Little John Bottlebrush", "Yellow Bells",
        "Yellow Lantana"]},
    {"dir": "right", "speed": 30, "tiles": [
        "Saguaro", "Organ Pipe", "Totem Pole", "Mexican Fence Post", "Uplight", "Argentine Toothpick",
        "Golden Barrel", "Fire Barrel", "Santa Rita Prickly Pear", "Agave Americana", "Artichoke Agave",
        "Flat Boulder", "Blue Glow Agave", "Black Tip Agave", "Twin-flowered Agave"]},
    {"dir": "left", "speed": 28, "tiles": [
        "Desert Spoon", "Red Yucca", "Flood Light", "Beaked Yucca", "Aloe Vera", "Purple Lantana", "Ocotillo",
        "Aloe Ferox", "Gray Boulder", "Moroccan Mound", "Tropical Agave", "Firestick", "White Dawn Lantana"]},
]

SIZE_LABEL = {
    "oneGallon": "1 gal", "fiveGallon": "5 gal", "fifteenGallon": "15 gal",
    "twentyFourBox": '24" box', "thirtySixBox": '36" box', "fortyEightBox": '48" box', "sixtyBox": '60" box',
    "small": "Small", "medium": "Medium", "large": "Large",
}
ENUM_LABEL = {
    "fullSun": "Full sun", "partialShade": "Partial shade", "fullShade": "Full shade",
    "low": "Low", "moderate": "Moderate", "high": "High",
    "slow": "Slow", "fast": "Fast",
    "annual": "Annual", "perennial": "Perennial", "shortLived": "Short-lived (3–5 yrs)",
    "longLived": "Long-lived (25+ yrs)", "veryLongLived": "Very long-lived (100+ yrs)",
}


# ── A small reader for the Swift literal ────────────────────────────────
class Enum(str):
    """A `.caseName` token."""


def strip_comments(src: str) -> str:
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '"':                       # copy a string literal verbatim
            j = i + 1
            while j < n and src[j] != '"':
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1]); i = j + 1
        elif src.startswith("//", i):
            j = src.find("\n", i); i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return "".join(out)


class Reader:
    def __init__(self, s: str):
        self.s, self.i = s, 0

    def ws(self):
        while self.i < len(self.s) and self.s[self.i].isspace():
            self.i += 1

    def peek(self):
        self.ws(); return self.s[self.i] if self.i < len(self.s) else ""

    def expect(self, ch):
        self.ws()
        if not self.s.startswith(ch, self.i):
            raise SyntaxError(f"expected {ch!r} at {self.i}: {self.s[self.i:self.i+40]!r}")
        self.i += len(ch)

    def ident(self):
        self.ws()
        m = re.match(r"[A-Za-z_][A-Za-z0-9_]*", self.s[self.i:])
        if not m:
            raise SyntaxError(f"expected identifier at {self.i}: {self.s[self.i:self.i+40]!r}")
        self.i += m.end(); return m.group(0)

    def string(self):
        self.expect('"'); out = []
        while self.s[self.i] != '"':
            c = self.s[self.i]
            if c == "\\":
                e = self.s[self.i + 1]
                if e == "u":                 # \u{XXXX}
                    end = self.s.index("}", self.i)
                    out.append(chr(int(self.s[self.i + 3:end], 16))); self.i = end + 1; continue
                out.append({"n": "\n", "t": "\t", "r": "\r", "0": "\0"}.get(e, e)); self.i += 2
            else:
                out.append(c); self.i += 1
        self.i += 1; return "".join(out)

    def value(self):
        c = self.peek()
        if c == '"':
            return self.string()
        if c == "[":
            self.i += 1; items = []
            while self.peek() != "]":
                items.append(self.value())
                if self.peek() == ",": self.i += 1
            self.i += 1; return items
        if c == ".":
            self.i += 1; return Enum(self.ident())
        m = re.match(r"-?\d+(\.\d+)?", self.s[self.i:])
        if m:
            self.i += m.end(); return float(m.group(0)) if m.group(1) else int(m.group(0))
        name = self.ident()
        if name == "nil": return None
        if name in ("true", "false"): return name == "true"
        if self.peek() == "(":               # a call: ContainerSize(...) / PlantItem(...)
            return {"_call": name, **self.args()}
        return Enum(name)

    def args(self):
        self.expect("("); out = {}
        while self.peek() != ")":
            label = self.ident(); self.expect(":")
            out[label] = self.value()
            if self.peek() == ",": self.i += 1
        self.i += 1; return out


def read_catalog(swift: Path):
    src = strip_comments(swift.read_text())
    head = "static let sampleCatalog: [PlantItem] = ["
    r = Reader(src); r.i = src.index(head) + len(head) - 1
    items = r.value()
    return [it for it in items if isinstance(it, dict) and it.get("_call") == "PlantItem"]


# ── Shape the site's view ───────────────────────────────────────────────
def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# The app's descriptions are written for designers, so they read fine on the
# site as-is — except the odd internal note ("Pricing is a placeholder."),
# which is dropped sentence by sentence rather than hand-edited in two places.
INTERNAL_NOTE = re.compile(r"[^.!?]*\bplaceholder\b[^.!?]*[.!?]\s*", re.I)


def clean_description(text):
    return INTERNAL_NOTE.sub("", text).strip() if text else text


def fmt_ft(v):
    if v is None: return None
    return f"{v:g} ft"


def entry(it: dict) -> dict:
    app = it["name"]; o = SITE_OVERRIDES.get(app, {})
    name = o.get("name", app)
    image = o.get("image", slugify(name))
    cat = str(it["category"])
    sizes = [SIZE_LABEL.get(str(s["type"]), str(s["type"])) for s in it.get("availableSizes", [])]
    is_plant = cat not in ("hardscape", "lighting")
    return {
        "slug": slugify(name),
        "name": name,
        "appName": app,
        "kind": KIND.get(app, KIND_BY_CATEGORY.get(cat, cat.title())),
        "category": cat,
        "photo": app in PHOTO_TILES,
        "image": f"assets/catalog/{image}.webp",
        "botanical": it.get("botanicalName"),
        "height": fmt_ft(it.get("matureHeightFt")),
        "width": fmt_ft(it.get("matureWidthFt")),
        "sun": ENUM_LABEL.get(str(it["sun"])) if is_plant else None,
        "water": ENUM_LABEL.get(str(it["water"])) if is_plant else None,
        "sizes": sizes if cat != "lighting" else [],
        "origin": it.get("origin"),
        "description": clean_description(it.get("description")),
        "coldF": it.get("coldToleranceFahrenheit") if is_plant else None,
        "bloom": it.get("bloomPeriod"),
        "growth": ENUM_LABEL.get(str(it["growthRate"])) if it.get("growthRate") else None,
        "lifespan": ENUM_LABEL.get(str(it["lifespan"])) if (is_plant and it.get("lifespan")) else None,
        "made": "modelled" if app in MODELLED else "scanned" if app in SCANNED else None,
    }


def card_image(it: dict, e: dict, xcassets: Path):
    """Write assets/catalog/card/<slug>.webp from the app's own thumbnail.

    Renders (RGBA) are cropped to their alpha bbox — the app frames each plant
    with generous air, which is what made the card's image look small — and
    kept transparent so they sit on the card's paper. Photos (RGB, the light
    fixtures) are just resized. Skipped when the output is newer than the
    source. Returns the JSON stub, or None if there's no source."""
    from PIL import Image
    src = next(iter((xcassets / f"{it.get('thumbnailName')}.imageset").glob("*.[pj][np]g")), None)
    if src is None:
        return None
    out = CARD_DIR / f"{e['slug']}.webp"
    if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
        im = Image.open(src)
        if im.mode == "RGBA":
            alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)   # ignore the faint halo
            box = alpha.getbbox() or (0, 0, *im.size)
            m = int(max(box[2] - box[0], box[3] - box[1]) * CARD_MARGIN)
            box = (max(0, box[0] - m), max(0, box[1] - m), min(im.width, box[2] + m), min(im.height, box[3] + m))
            im = im.crop(box)
        else:
            im = im.convert("RGB")
        scale = min(1.0, CARD_PX / max(im.size))          # never upscale a source
        if scale < 1.0:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        CARD_DIR.mkdir(parents=True, exist_ok=True)
        im.save(out, "WEBP", quality=84, method=6)
    from PIL import Image as _I
    w, h = _I.open(out).size
    return {"src": f"assets/catalog/card/{out.name}", "w": w, "h": h}


def tile_html(e: dict) -> str:
    cls = "cat-tile cat-tile--photo" if e["photo"] else "cat-tile"
    return (f'          <li class="{cls}" data-plant="{e["slug"]}">'
            f'<img src="{e["image"]}" alt="{e["name"]}" width="320" height="320" loading="lazy" decoding="async" />'
            f'<span class="cat-name">{e["name"]}</span><span class="cat-kind">{e["kind"]}</span>'
            f'<button type="button" class="cat-more" aria-label="About {e["name"]}"></button></li>')


def shelves_html(by_name: dict) -> str:
    rows = []
    for row in ROWS:
        tiles = "\n".join(tile_html(by_name[n]) for n in row["tiles"])
        rows.append(f'      <div class="catalog-row" data-marquee data-dir="{row["dir"]}" data-speed="{row["speed"]}">\n'
                    f'        <ul class="catalog-track" data-marquee-track>\n{tiles}\n        </ul>\n      </div>')
    return f"{MARK_OPEN}\n" + "\n".join(rows) + f"\n      {MARK_CLOSE}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--app", type=Path, default=DEFAULT_SWIFT, help="path to the app's PlantItem.swift")
    ap.add_argument("--check", action="store_true", help="don't write; exit 1 if the outputs are stale")
    a = ap.parse_args()

    items = read_catalog(a.app)
    entries = [entry(it) for it in items]
    by_name = {e["name"]: e for e in entries}
    raw_by_name = {e["name"]: it for e, it in zip(entries, items)}
    placed = [n for row in ROWS for n in row["tiles"]]
    missing = [n for n in placed if n not in by_name]
    if missing:
        sys.exit(f"ROWS names the app doesn't have: {missing}")
    dupes = {n for n in placed if placed.count(n) > 1}
    if dupes:
        sys.exit(f"tiles listed twice: {sorted(dupes)}")
    shown = [by_name[n] for n in placed]
    xcassets = a.app.parents[1] / "Assets.xcassets"
    for e in shown:
        if not (SITE / e["image"]).exists():
            print(f"warning: no render at {e['image']} for {e['name']}", file=sys.stderr)
        e["card"] = None if a.check else card_image(raw_by_name[e["name"]], e, xcassets)
        if e["card"] is None and not a.check:
            print(f"warning: no app thumbnail for {e['name']} — card falls back to the tile render", file=sys.stderr)

    # only what's on a shelf goes to the site
    data = json.dumps({e["slug"]: e for e in shown}, ensure_ascii=False, indent=1) + "\n"
    html = INDEX.read_text()
    i, j = html.find(MARK_OPEN), html.find(MARK_CLOSE)
    if i < 0 or j < 0:
        sys.exit(f"index.html needs {MARK_OPEN} … {MARK_CLOSE} around the shelves")
    new_html = html[:i] + shelves_html(by_name) + html[j + len(MARK_CLOSE):]

    if a.check and JSON_OUT.exists():      # keep the on-disk card stubs out of the comparison
        old_cards = {k: v.get("card") for k, v in json.loads(JSON_OUT.read_text()).items()}
        for e in shown:
            e["card"] = old_cards.get(e["slug"])
        data = json.dumps({e["slug"]: e for e in shown}, ensure_ascii=False, indent=1) + "\n"
    stale = [p for p, new in ((JSON_OUT, data), (INDEX, new_html)) if not p.exists() or p.read_text() != new]
    if a.check:
        if stale:
            sys.exit("stale: " + ", ".join(str(p.relative_to(SITE)) for p in stale))
        print("catalog up to date"); return
    JSON_OUT.write_text(data)
    INDEX.write_text(new_html)
    print(f"{len(shown)} tiles on {len(ROWS)} shelves → {JSON_OUT.relative_to(SITE)}, {INDEX.name}")
    unplaced = [e["name"] for e in entries if e["name"] not in by_name or e["name"] not in placed]
    if unplaced:
        print("in the app but not on a shelf: " + ", ".join(unplaced))
    unbadged = [e["name"] for e in shown if e["made"] is None and e["category"] not in ("lighting",)]
    if unbadged:
        print("no scanned/modelled badge yet: " + ", ".join(unbadged))


if __name__ == "__main__":
    main()
