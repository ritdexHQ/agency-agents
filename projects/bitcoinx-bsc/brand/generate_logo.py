#!/usr/bin/env python3
"""
Sinh bo logo BitcoinX (BTCx) o moi kich thuoc ma cac san/vi yeu cau.

Chay:  python3 brand/generate_logo.py

Ket qua (thu muc brand/):
  btcx-logo.svg   vector goc, dung cho website / token list
  btcx-<N>.png    32, 64, 128, 200, 256, 512, 1024 — nen trong suot
  logo.png        ban sao 256x256, dung ten ma Trust Wallet assets yeu cau
  btcx-banner-<W>x<H>.png  ty le 3:1 cho Token Header cua DEX Screener
                  (yeu cau: it nhat 600px rong, chua noi dung trong vung an toan)

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
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SIZES = [32, 64, 128, 200, 256, 512, 1024]
# DEX Screener Token Header: ty le 3:1, toi thieu 600px rong.
BANNERS = [(600, 200), (1200, 400), (1800, 600)]
SS = 8  # he so lay mau qua (supersampling) cho bien muot

NAVY_OUT = (10, 17, 34)     # #0A1122
NAVY_IN = (27, 42, 74)      # #1B2A4A
TEAL = (41, 224, 200)       # #29E0C8
BLUE = (76, 141, 255)       # #4C8DFF
WHITE = (233, 243, 255)     # #E9F3FF
AMBER = (255, 179, 71)      # #FFB347

# Hai chu de. Dat BTCX_THEME=navy de quay ve ban cu.
#
# "orange" dung ho mau cam cua Bitcoin — dung thong le cua cac token boc BTC
# (WBTC, BTCB, cbBTC deu dung ky hieu tien te mau cam). Dieu do hop le VI BTCx
# that su duoc bao chung 1:1.
#
# Nhung moi token boc deu phai co DAU PHAN BIET rieng: BTCB gan huy hieu
# Binance, cbBTC dung xanh Coinbase. O day dau phan biet la chu "x". No la bat
# buoc, khong phai trang tri — bo no di thi con lai dung la logo Bitcoin, va do
# la thu bi gan co mao danh khi nop ho so, dong thoi khien nguoi mua hieu nham
# BTCx la Bitcoin.
THEMES = {
    # Thiet ke do chu du an cung cap: dia cam phang, ky hieu tien te trang dung
    # thang, khong vanh, khong dau phan biet. Day la mac dinh theo yeu cau.
    #
    # Luu y da trao doi va da duoc quyet: khong co dau phan biet thi o kich thuoc
    # nho trong vi, nhan dien nay doc ra "Bitcoin". Phan phan biet vi the nam het
    # o ten, ky hieu va mo ta — phai giu chung that ro o moi noi. Doi sang ban co
    # chu "x" bat cu luc nao: BTCX_THEME=orange npm run logo
    "bitcoin": {
        "bg_in": (255, 153, 0),     # #FF9900 phang
        "bg_out": (255, 153, 0),
        "mark_a": (255, 255, 255),
        "mark_b": (255, 255, 255),
        "badge": None,              # khong ve chu "x"
        "ring": None,               # khong vanh
        "accent": (255, 153, 0),
        "mark_center": 0.50,        # ky hieu nam giua dia
    },
    "orange": {
        "bg_in": (255, 168, 56),    # #FFA838 tam sang
        "bg_out": (223, 119, 6),    # #DF7706 vanh dam
        "mark_a": (255, 255, 255),  # ky hieu tien te trang
        "mark_b": (255, 248, 238),
        "badge": (10, 17, 34),      # chu "x" navy — dau phan biet, tuong phan manh
        "ring": (255, 214, 153),
        "accent": AMBER,
        "mark_center": 0.40,
    },
    "navy": {
        "bg_in": NAVY_IN,
        "bg_out": NAVY_OUT,
        "mark_a": TEAL,
        "mark_b": BLUE,
        "badge": WHITE,
        "ring": BLUE,
        "accent": TEAL,
        "mark_center": 0.40,
    },
}
THEME_NAME = os.environ.get("BTCX_THEME", "bitcoin")
if THEME_NAME not in THEMES:
    raise SystemExit(f"BTCX_THEME khong hop le: {THEME_NAME}. Chon: {', '.join(THEMES)}")
T = THEMES[THEME_NAME]


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
            fill=lerp(T["bg_in"], T["bg_out"], t) + (255,),
        )

    # --- Vong vien manh (chu de "bitcoin" khong co) ---
    if T["ring"] is not None:
        ring = max(n * 0.018, SS)
        d.ellipse([ring / 2, ring / 2, n - ring / 2, n - ring / 2], outline=T["ring"] + (110,), width=int(ring))

    # --- Chu "B" cua monogram ---
    font = ImageFont.truetype(FONT, int(n * 0.60))
    bbox = d.textbbox((0, 0), "B", font=font)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    bx = n * T["mark_center"] - bw / 2
    by = n * 0.50 - bh / 2

    layer = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((bx - bbox[0], by - bbox[1]), "B", font=font, fill=T["mark_a"] + (255,))

    # Hai thanh doc xuyen qua than chu B — motif tien te quen thuoc.
    bar_w = bw * 0.11
    for frac in (0.22, 0.47):
        x = bx + bw * frac
        ld.rounded_rectangle(
            [x, by - bh * 0.20, x + bar_w, by + bh * 1.20],
            radius=bar_w / 2,
            fill=T["mark_a"] + (255,),
        )

    # Chuyen mau ngang cho phan monogram.
    grad = Image.new("RGBA", (n, n))
    gd = ImageDraw.Draw(grad)
    for x in range(n):
        gd.line([(x, 0), (x, n)], fill=lerp(T["mark_a"], T["mark_b"], x / n) + (255,))
    img.paste(grad, (0, 0), layer)

    # --- Chu "x": dau phan biet voi Bitcoin, neu chu de co dung ---
    if T["badge"] is not None:
        xfont = ImageFont.truetype(FONT, int(n * 0.30))
        xbbox = d.textbbox((0, 0), "x", font=xfont)
        xw, xh = xbbox[2] - xbbox[0], xbbox[3] - xbbox[1]
        d.text(
            (n * 0.745 - xw / 2 - xbbox[0], n * 0.655 - xh / 2 - xbbox[1]),
            "x",
            font=xfont,
            fill=T["badge"] + (255,),
        )

    return img.resize((px, px), Image.LANCZOS)


def _fit_font(draw, text: str, font_path: str, max_width: int, start_px: int) -> ImageFont.FreeTypeFont:
    """Font lon nhat ma `text` van nam gon trong `max_width`.

    Ban dau banner bi tran chu ra ngoai vung an toan vi kich thuoc font duoc dat
    cung theo chieu cao. Do dai chuoi thay doi (va tieng Viet co dau cang dai hon),
    nen phai do lai chu khong uoc luong.
    """
    size = start_px
    while size > 8:
        font = ImageFont.truetype(font_path, size)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
        size -= max(1, size // 40)
    return ImageFont.truetype(font_path, 8)


def draw_banner(width: int, height: int) -> Image.Image:
    """Banner 3:1 cho Token Header cua DEX Screener.

    Toan bo logo va chu nam trong vung an toan (>=1/6 chieu rong moi ben), vi
    banner hay bi cat hai dau tuy bo cuc trang hien thi.
    """
    assert width == height * 3, "Token Header phai la ty le 3:1"
    ss = 4
    w, h = width * ss, height * ss
    img = Image.new("RGBA", (w, h), NAVY_OUT + (255,))
    d = ImageDraw.Draw(img)

    # Nen: chuyen mau ngang, dam ben trai.
    for x in range(w):
        d.line([(x, 0), (x, h)], fill=lerp(NAVY_OUT, NAVY_IN, x / w) + (255,))

    # Vien manh o canh duoi, lay mau tu bang mau nhan dien.
    d.rectangle([0, h - max(h * 0.008, ss), w, h], fill=T["accent"] + (90,))

    pad = w // 6  # vung an toan
    mark = int(h * 0.60)
    logo = draw_logo(max(mark // ss, 32)).resize((mark, mark), Image.LANCZOS)
    img.paste(logo, (pad, (h - mark) // 2), logo)

    text_x = pad + mark + int(w * 0.03)
    max_text = w - text_x - pad
    assert max_text > 0, "Vung chu rong am — kiem tra lai bo cuc"

    lines = [
        ("BitcoinX", FONT, int(h * 0.26), WHITE + (255,), 0.22),
        ("BTCx · BNB Smart Chain", FONT_REGULAR, int(h * 0.11), (143, 163, 191, 255), 0.50),
        ("Backed 1:1 by BTCB · Redeem anytime", FONT, int(h * 0.10), T["accent"] + (255,), 0.75),
    ]
    for text, font_path, start_px, colour, y_frac in lines:
        font = _fit_font(d, text, font_path, max_text, start_px)
        d.text((text_x, h * y_frac), text, font=font, fill=colour, anchor="lm")

    return img.resize((width, height), Image.LANCZOS)


def _hex(rgb) -> str:
    return "#%02X%02X%02X" % tuple(rgb)


def build_svg() -> str:
    """Ban vector, dung cung bang mau va bo cuc voi PNG."""
    cx = 256 * T["mark_center"] + 25.6
    bar1, bar2 = cx - 28.4, cx - 3.8
    ring = (
        ""
        if T["ring"] is None
        else f'<circle cx="128" cy="128" r="125.7" fill="none" stroke="{_hex(T["ring"])}" stroke-opacity="0.43" stroke-width="4.6"/>'
    )
    badge = (
        ""
        if T["badge"] is None
        else (
            '<text x="191" y="168" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-weight="700" '
            f'font-size="77" text-anchor="middle" dominant-baseline="central" fill="{_hex(T["badge"])}">x</text>'
        )
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="BitcoinX">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{_hex(T['bg_in'])}"/>
      <stop offset="100%" stop-color="{_hex(T['bg_out'])}"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{_hex(T['mark_a'])}"/>
      <stop offset="100%" stop-color="{_hex(T['mark_b'])}"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="128" fill="url(#bg)"/>
  {ring}
  <g fill="url(#mark)">
    <text x="{cx}" y="128" font-family="DejaVu Sans,Helvetica,Arial,sans-serif" font-weight="700"
          font-size="154" text-anchor="middle" dominant-baseline="central">B</text>
    <rect x="{bar1}" y="50.1" width="10.8" height="155.8" rx="5.4"/>
    <rect x="{bar2}" y="50.1" width="10.8" height="155.8" rx="5.4"/>
  </g>
  {badge}
</svg>
"""


def main() -> None:
    print(f"Chu de: {THEME_NAME}\n")
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

    for bw, bh in BANNERS:
        path = os.path.join(HERE, f"btcx-banner-{bw}x{bh}.png")
        draw_banner(bw, bh).save(path, optimize=True)
        print(f"{path}  {os.path.getsize(path):>6} bytes  ({bw}x{bh}, 3:1)")

    svg = os.path.join(HERE, "btcx-logo.svg")
    with open(svg, "w", encoding="utf-8") as f:
        f.write(build_svg())
    print(f"{svg}  {os.path.getsize(svg):>6} bytes")


if __name__ == "__main__":
    main()
