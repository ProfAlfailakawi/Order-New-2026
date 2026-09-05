"""Link-preview card for التراث.

The previous card put a large translucent circle behind the headline and let the
logo tile crowd it, so the type read as muddy and cramped. This one keeps a hard
rule: the decoration lives in bands the text never enters, and the two halves are
separated by measured space rather than by luck. Every string is measured and the
layout asserts the blocks do not collide before it writes the file.
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CREAM   = (251, 246, 234)
GREEN   = (15, 79, 45)
GREEN_D = (11, 63, 37)
RED     = (215, 25, 47)
GOLD    = (184, 134, 43)
SAND    = (243, 233, 211)
MUTED   = (104, 112, 122)

# The faces come from the repo's own self-hosted Tajawal, so the card is always
# set in the same type as the site. Pillow cannot open woff2, so each face is
# unpacked to a temporary ttf; the arabic and latin subsets are separate files.
import re, tempfile, atexit
from fontTools.ttLib import TTFont

_TMP = tempfile.mkdtemp()
atexit.register(lambda: __import__("shutil").rmtree(_TMP, ignore_errors=True))
_CSS = open("public/fonts/fonts.css", encoding="utf-8").read()

def face(weight, subset, family="Tajawal"):
    for sub, block in re.findall(r"/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", _CSS, re.S):
        if sub != subset or f"font-family: '{family}'" not in block:
            continue
        if f"font-weight: {weight};" not in block:
            continue
        src = "public/fonts/" + re.search(r"url\(/fonts/([^)]+)\)", block).group(1)
        out = os.path.join(_TMP, f"{family}-{weight}-{subset}.ttf")
        f = TTFont(src); f.flavor = None; f.save(out)
        return out
    raise SystemExit(f"no {family} {weight} {subset} face in public/fonts/fonts.css")

AR = None
LA = None
f_eyebrow = ImageFont.truetype(face(700, "arabic"), 27)
f_head    = ImageFont.truetype(face(800, "arabic"), 60)
f_sub     = ImageFont.truetype(face(400, "arabic"), 27)
f_domain  = ImageFont.truetype(face(700, "latin"), 31)

img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ---- decoration: one Sadu band along the bottom edge, and a soft sand wash on
# the logo side. Both sit outside the type column by construction.
BAND_H = 26
for x in range(-40, W + 40, 48):
    d.polygon([(x, H), (x + 24, H - BAND_H), (x + 48, H)], fill=SAND)
    d.polygon([(x + 24, H), (x + 48, H - BAND_H), (x + 72, H)], fill=(247, 240, 225))
d.rectangle([0, H - 5, W, H], fill=GREEN)

wash = Image.new("RGB", (W, H), CREAM)
ImageDraw.Draw(wash).ellipse([-300, -150, 408, 558], fill=SAND)
img = Image.blend(img, wash, 0.55)
d = ImageDraw.Draw(img)
for x in range(-40, W + 40, 48):          # redraw the band over the wash
    d.polygon([(x, H), (x + 24, H - BAND_H), (x + 48, H)], fill=SAND)
d.rectangle([0, H - 5, W, H], fill=GREEN)

# ---- logo tile (left), vertically centred in its own column
TILE, TX, TY = 244, 72, (H - 244) // 2
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    [TX + 6, TY + 14, TX + TILE + 6, TY + TILE + 14], 54, fill=(24, 34, 20, 46))
img = Image.alpha_composite(img.convert("RGBA"), shadow.filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(18)))
d = ImageDraw.Draw(img)
d.rounded_rectangle([TX, TY, TX + TILE, TY + TILE], 54, fill=(255, 255, 255))

mark = Image.open("public/logo.png").convert("RGBA")
mh = 158
mw = round(mark.width * mh / mark.height)
mark = mark.resize((mw, mh), Image.LANCZOS)
img.paste(mark, (TX + (TILE - mw) // 2, TY + (TILE - mh) // 2), mark)

# ---- type column (right, RTL). Right edge fixed; every line grows leftwards.
R = W - 74
COL_LEFT = TX + TILE + 72          # the type may never cross this
def rtl(text, font, y, fill):
    w = d.textlength(text, font=font)
    d.text((R - w, y), text, font=font, fill=fill)
    return R - w, w

# Measure the whole stack first, then centre it on the same axis as the logo
# tile. Guessing a top margin is what left the old card visually top-heavy.
GAP1, GAP2, GAP3 = 54, 92, 70
# The pill holds a diamond and the domain as one group. Padding it from the
# left alone left the pair sitting off-centre inside the box.
DOMAIN = "alturathkw.shop"
dw = d.textlength(DOMAIN, font=f_domain)
DIA, DIA_GAP, PAD = 18, 16, 36
inner = DIA + DIA_GAP + dw
pw, ph = inner + PAD * 2, 66
stack = GAP1 + GAP2 + GAP3 + ph + 40
y = TY + (TILE - stack) // 2

x1, w1 = rtl("شركة مطبخ التراث الكويتي", f_eyebrow, y, GOLD)
y += GAP1
x2, w2 = rtl("طعم الأصالة في كل طبق", f_head, y, GREEN)
y += GAP2
x3, w3 = rtl("اطلب بسهولة، وادفع بالطريقة اللي تناسبك", f_sub, y, MUTED)
y += GAP3
d.rounded_rectangle([R - pw, y, R, y + ph], ph // 2, fill=GREEN_D)

# Right-to-left inside the pill: the diamond leads, the domain follows.
gx = R - PAD                                   # right edge of the group
cx, cy, r = gx - DIA // 2, y + ph // 2, DIA // 2
d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=RED)
tb = d.textbbox((0, 0), DOMAIN, font=f_domain)
d.text((gx - DIA - DIA_GAP - dw, cy - (tb[1] + tb[3]) / 2), DOMAIN,
       font=f_domain, fill=(247, 226, 168))

leftmost = min(x1, x2, x3, R - pw)
assert leftmost > COL_LEFT, f"type column overruns the logo: {leftmost} <= {COL_LEFT}"
assert y + ph < H - BAND_H - 24, "type column overruns the bottom band"
print(f"clearance to logo tile: {leftmost - COL_LEFT:.0f}px, to bottom band: {H - BAND_H - (y + ph):.0f}px")

img.convert("RGB").save("public/og-order-v8.jpg", quality=92, optimize=True, progressive=True)
print("wrote public/og-order-v8.jpg")
