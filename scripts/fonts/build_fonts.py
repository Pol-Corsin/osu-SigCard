"""
Builds the static card fonts in public/fonts/card from Google Fonts sources.

Why a build step:
  * resvg needs static fonts with correct family names (see build-assets.ts).
  * Fraunces and JetBrains Mono are only published as variable fonts, so we
    cut static instances for the weights the templates use.
  * Shippori Mincho / Zen Kaku Gothic New are multi-megabyte CJK fonts; we
    subset them to Latin + the exact Japanese strings in
    src/modules/templates/editorial/japanese.json.

Requires: pip install fonttools brotli
Run from the repo root:  python scripts/fonts/build_fonts.py [group ...]
Groups: core (the original Phase 2–4 fonts), v2 (Raster, Liquid Chrome,
Photo Album). With no argument, every group is built. Build only the group
you changed: upstream sources can change over time, and rebuilding an
untouched group could shift glyphs on templates that are meant to stay
pixel-identical.
"""
import io
import json
import pathlib
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "fonts" / "card"
GF = "https://raw.githubusercontent.com/google/fonts/main/ofl"

LATIN = "".join(chr(c) for c in range(0x20, 0x7F)) + "…·—–№×%#°"
# v2 fonts also carry typographic quotes (handwritten "’26", captions).
LATIN_V2 = LATIN + "’‘“”"


def fetch(path: str) -> bytes:
    with urllib.request.urlopen(f"{GF}/{path}", timeout=60) as r:
        return r.read()


def set_names(font: TTFont, family: str, style: str, weight: int, italic: bool) -> None:
    """Write consistent RIBBI + typographic names so resvg and browsers agree."""
    name = font["name"]
    ribbi = "Italic" if italic else "Regular"
    legacy_family = family if style in ("Regular", "Italic") else f"{family} {style.replace(' Italic', '')}"
    for rec in list(name.names):
        if rec.nameID in (1, 2, 4, 6, 16, 17):
            name.removeNames(nameID=rec.nameID)
    ps = f"{family.replace(' ', '')}-{style.replace(' ', '')}"
    name.setName(legacy_family, 1, 3, 1, 0x409)
    name.setName(ribbi, 2, 3, 1, 0x409)
    name.setName(f"{family} {style}", 4, 3, 1, 0x409)
    name.setName(ps, 6, 3, 1, 0x409)
    name.setName(family, 16, 3, 1, 0x409)
    name.setName(style, 17, 3, 1, 0x409)
    os2 = font["OS/2"]
    os2.usWeightClass = weight
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b1 if italic else 0) | (0 if italic else 0b1000000)
    font["head"].macStyle = (0b10 if italic else 0) | (0b1 if weight >= 700 else 0)


def save_subset(font: TTFont, file: str, text: str, features: list[str] | None = None) -> None:
    opts = subset.Options()
    opts.layout_features = features or ["kern", "liga", "calt", "vert", "vrt2", "palt", "locl"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    font.save(OUT / file)
    print(f"{file}: {(OUT / file).stat().st_size / 1024:.0f} KB")


def static(src: bytes, axes: dict, family: str, style: str, weight: int, italic: bool, file: str, text: str, features: list[str] | None = None) -> None:
    font = TTFont(io.BytesIO(src))
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    set_names(font, family, style, weight, italic)
    save_subset(font, file, text, features)


# v2 fonts keep kerning only. Browsers turn ligatures off whenever letter-spacing
# is non-zero (CSS Text spec) but resvg keeps them, and contextual alternates
# change widths the metrics tables can't predict; with "kern" alone the browser,
# resvg and measureText() lay out every string glyph-for-glyph the same.
V2_FEATURES = ["kern"]


def build_v2() -> None:
    # Raster: Archivo at its widest (wdth 125), heavy weights only.
    ar = fetch("archivo/Archivo%5Bwdth,wght%5D.ttf")
    for w, n in [(800, "ExtraBold"), (900, "Black")]:
        static(ar, {"wght": w, "wdth": 125}, "Archivo Expanded", n, w, False, f"archivo-expanded-{w}.ttf", LATIN_V2, V2_FEATURES)
    # Liquid Chrome
    ub = fetch("unbounded/Unbounded%5Bwght%5D.ttf")
    for w, n in [(500, "Medium"), (800, "ExtraBold")]:
        static(ub, {"wght": w}, "Unbounded", n, w, False, f"unbounded-{w}.ttf", LATIN_V2, V2_FEATURES)
    # Photo Album
    static(fetch("instrumentserif/InstrumentSerif-Regular.ttf"), {}, "Instrument Serif", "Regular", 400, False, "instrument-serif-400.ttf", LATIN_V2, V2_FEATURES)
    static(fetch("instrumentserif/InstrumentSerif-Italic.ttf"), {}, "Instrument Serif", "Italic", 400, True, "instrument-serif-400-italic.ttf", LATIN_V2, V2_FEATURES)
    static(fetch("caveat/Caveat%5Bwght%5D.ttf"), {"wght": 500}, "Caveat", "Medium", 500, False, "caveat-500.ttf", LATIN_V2, V2_FEATURES)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    groups = set(sys.argv[1:]) or {"core", "v2"}
    unknown = groups - {"core", "v2"}
    if unknown:
        raise SystemExit(f"unknown group(s): {', '.join(sorted(unknown))}")
    if "v2" in groups:
        build_v2()
    if "core" not in groups:
        return
    jp = json.loads((ROOT / "src/modules/templates/editorial/japanese.json").read_text(encoding="utf-8"))
    jp_text = "".join(jp["modes"].values()) + "".join(jp["stats"].values()) + "".join(jp["misc"])
    print(f"Japanese glyphs: {''.join(sorted(set(jp_text)))}")

    # Cyberpunk
    for w, n in [(600, "SemiBold"), (700, "Bold")]:
        static(fetch(f"chakrapetch/ChakraPetch-{n}.ttf"), {}, "Chakra Petch", n, w, False, f"chakra-petch-{w}.ttf", LATIN)
    jbm = fetch("jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf")
    for w, n in [(400, "Regular"), (700, "Bold")]:
        static(jbm, {"wght": w}, "JetBrains Mono", n, w, False, f"jetbrains-mono-{w}.ttf", LATIN)

    # Editorial (CJK, subset)
    for w, n in [(700, "Bold"), (800, "ExtraBold")]:
        static(fetch(f"shipporimincho/ShipporiMincho-{n}.ttf"), {}, "Shippori Mincho", n, w, False, f"shippori-mincho-{w}.ttf", LATIN + jp_text)
    for w, n in [(400, "Regular"), (700, "Bold")]:
        static(fetch(f"zenkakugothicnew/ZenKakuGothicNew-{n}.ttf"), {}, "Zen Kaku Gothic New", n, w, False, f"zen-kaku-gothic-new-{w}.ttf", LATIN + jp_text)

    # Y2K
    static(fetch("michroma/Michroma-Regular.ttf"), {}, "Michroma", "Regular", 400, False, "michroma-400.ttf", LATIN)
    for w, n in [(400, "Regular"), (700, "Bold")]:
        static(fetch(f"spacemono/SpaceMono-{n}.ttf"), {}, "Space Mono", n, w, False, f"space-mono-{w}.ttf", LATIN)

    # Artistic: Fraunces italic, static instances from the variable font
    fr = fetch("fraunces/Fraunces-Italic%5BSOFT,WONK,opsz,wght%5D.ttf")
    static(fr, {"wght": 300, "opsz": 72, "SOFT": 100, "WONK": 1}, "Fraunces", "Light Italic", 300, True, "fraunces-300-italic.ttf", LATIN)
    static(fr, {"wght": 800, "opsz": 144, "SOFT": 50, "WONK": 1}, "Fraunces", "ExtraBold Italic", 800, True, "fraunces-800-italic.ttf", LATIN)


if __name__ == "__main__":
    main()
