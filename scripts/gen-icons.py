"""Regenerate favicon / app-icon set from byuican-icon.png with a transparent
background and the handshake maximized in the canvas.

Run from app/: python scripts/gen-icons.py
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SRC = PUBLIC / "byuican-icon.png"

# (filename, canvas_size, content_fraction)
# content_fraction = 1.0 means handshake fills canvas edge-to-edge.
# Slight inset (0.96) keeps it crisp without touching the edges.
# Maskable uses 0.80 to respect the Android safe-zone.
TARGETS = [
    ("favicon-32.png", 32, 0.96),
    ("favicon-128.png", 128, 0.96),
    ("apple-icon.png", 180, 0.92),
    ("icon-192.png", 192, 0.96),
    ("icon-512.png", 512, 0.96),
    ("icon-maskable-512.png", 512, 0.80),
]


def trim(im: Image.Image) -> Image.Image:
    """Crop transparent margins around the handshake."""
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    return im.crop(bbox) if bbox else im


def fit(content: Image.Image, canvas: int, frac: float) -> Image.Image:
    inner = max(1, int(canvas * frac))
    c = content.copy()
    c.thumbnail((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - c.width) // 2
    y = (canvas - c.height) // 2
    out.paste(c, (x, y), c)
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    trimmed = trim(src)
    for name, size, frac in TARGETS:
        out = fit(trimmed, size, frac)
        out.save(PUBLIC / name, format="PNG", optimize=True)
        print(f"wrote public/{name} ({size}x{size}, content={int(frac * 100)}%)")

    # Multi-resolution favicon.ico (16/32/48) for legacy browsers.
    ico_sizes = [(16, 0.96), (32, 0.96), (48, 0.96)]
    ico_layers = [fit(trimmed, s, f) for s, f in ico_sizes]
    ico_layers[0].save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s, _ in ico_sizes],
        append_images=ico_layers[1:],
    )
    print("wrote public/favicon.ico (16/32/48)")


if __name__ == "__main__":
    main()
