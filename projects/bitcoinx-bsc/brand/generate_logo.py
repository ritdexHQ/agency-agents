#!/usr/bin/env python3
"""
Sinh bo logo BitcoinX (BTCx) o moi kich thuoc ma cac san/vi yeu cau.

Chay:  python3 brand/generate_logo.py

Ket qua (thu muc brand/):
  btcx-logo.svg   vector goc, dung cho website / token list
  btcx-<N>.png    32, 64, 128, 200, 256, 512, 1024 — nen trong suot
  logo.png        ban sao 256x256, dung ten ma Trust Wallet assets yeu cau

Ghi chu thiet ke: mau va hinh khoi CO Y khac logo Bitcoin goc (tron cam, chu B
nghieng). BTCx la tai san rieng duoc bao chung boi BTCB, khong phai Bitcoin, nen
nhan dien phai phan biet duoc — nham lan o day khong chi la van de thuong hieu
ma con la van de nguoi dung mua nham.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

SIZES = [32, 64, 128, 200, 256, 512, 1024]
SS = 8  # he so lay mau qua (supersampling) cho bien muot

NAVY_OUT = (10, 17, 34)     # #0A1122
NAVY_IN = (27, 42, 74)      # #1B2A4A
TEAL = (41, 224, 200)       # #29E0C8
BLUE = (76, 141, 255)       # #4C8DFF
WHITE = (233, 243, 255)     # #E9F3FF


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw_logo(px: int) -> Image.Image:
    n = px * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # --- Nen: dia tron voi chuyen mau xuyen tam ---
    steps = 64
    for i in range(steps, 0, -1):
        t = i / steps
        r = (n / 2) * t
        d.ellipse(
            [n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r],
            fill=lerp(NAVY_IN, NAVY_OUT, t) + (255,),
        )

    # --- Vong vien manh ---
    ring = max(n * 0.018, SS)
    d.ellipse([ring / 2, ring / 2, n - ring / 2, n - ring / 2], outline=BLUE + (90,), width=int(ring))

    # --- Chu "B" cua monogram ---
    font = ImageFont.truetype(FONT, int(n * 0.60))
    bbox = d.textbbox((0, 0), "B", font=font)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    bx = n * 0.40 - bw / 2
    by = n * 0.50 - bh / 2

    layer = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((bx - bbox[0], by - bbox[1]), "B", font=font, fill=TEAL + (255,))

    # Hai thanh doc xuyen qua than chu B — motif tien te quen thuoc.
    bar_w = bw * 0.11
    for frac in (0.22, 0.47):
        x = bx + bw * frac
        ld.rounded_rectangle(
            [x, by - bh * 0.20, x + bar_w, by + bh * 1.20],
            radius=bar_w / 2,
            fill=TEAL + (255,),
        )

    # Chuyen mau teal -> blue theo chieu ngang cho phan monogram.
    grad = Image.new("RGBA", (n, n))
    gd = ImageDraw.Draw(grad)
    for x in range(n):
        gd.line([(x, 0), (x, n)], fill=lerp(TEAL, BLUE, x / n) + (255,))
    img.paste(grad, (0, 0), layer)

    # --- Chu "x" nho o goc duoi phai ---
    xfont = ImageFont.truetype(FONT, int(n * 0.30))
    xbbox = d.textbbox((0, 0), "x", font=xfont)
    xw, xh = xbbox[2] - xbbox[0], xbbox[3] - xbbox[1]
    d.text(
        (n * 0.745 - xw / 2 - xbbox[0], n * 0.655 - xh / 2 - xbbox[1]),
        "x",
        font=xfont,
        fill=WHITE + (255,),
    )

    return img.resize((px, px), Image.LANCZOS)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="BitcoinX">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1B2A4A"/>
      <stop offset="100%" stop-color="#0A1122"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#29E0C8"/>
      <stop offset="100%" stop-color="#4C8DFF"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="128" fill="url(#bg)"/>
  <circle cx="128" cy="128" r="125.7" fill="none" stroke="#4C8DFF" stroke-opacity="0.35" stroke-width="4.6"/>
  <g fill="url(#mark)">
    <text x="102" y="128" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-weight="700"
          font-size="154" text-anchor="middle" dominant-baseline="central">B</text>
    <rect x="73.6" y="50.1" width="10.8" height="155.8" rx="5.4"/>
    <rect x="98.2" y="50.1" width="10.8" height="155.8" rx="5.4"/>
  </g>
  <text x="191" y="168" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-weight="700"
        font-size="77" text-anchor="middle" dominant-baseline="central" fill="#E9F3FF">x</text>
</svg>
"""


def main() -> None:
    for size in SIZES:
        path = os.path.join(HERE, f"btcx-{size}.png")
        img = draw_logo(size)
        img.save(path, optimize=True)
        print(f"{path}  {os.path.getsize(path):>6} bytes")

    # Trust Wallet assets doi dung ten "logo.png", 256x256, duoi 100KB.
    src = os.path.join(HERE, "btcx-256.png")
    dst = os.path.join(HERE, "logo.png")
    Image.open(src).save(dst, optimize=True)
    size = os.path.getsize(dst)
    assert size < 100_000, f"logo.png {size} bytes — vuot gioi han 100KB cua Trust Wallet"
    print(f"{dst}  {size:>6} bytes  (gioi han Trust Wallet: 100000)")

    svg = os.path.join(HERE, "btcx-logo.svg")
    with open(svg, "w", encoding="utf-8") as f:
        f.write(SVG)
    print(f"{svg}  {os.path.getsize(svg):>6} bytes")


if __name__ == "__main__":
    main()
