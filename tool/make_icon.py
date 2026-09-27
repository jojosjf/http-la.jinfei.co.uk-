"""生成应用图标（占位设计）：深蓝底，卡片 + 两色参考线，卡片中央上下排列“居中”。

    python3 tool/make_icon.py

输出 assets/icon/icon_1024.png（完整图标）和 icon_foreground_1024.png
（安卓自适应图标前景，透明底、内容缩在安全区内）。之后运行
`dart run flutter_launcher_icons` 更新安卓/iOS/网页图标；鸿蒙把
icon_1024.png 复制到 ohos/AppScope/resources/base/media/app_icon.png
和 ohos/entry/src/main/resources/base/media/icon.png。

字体：Noto Sans SC Black 的“居中”两字子集（SIL Open Font License）。
"""
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / 'tool' / 'icon_font_noto_sans_sc_900.ttf'
OUT = ROOT / 'assets' / 'icon'
S = 1024
BG = (40, 53, 147, 255)
CARD = (255, 255, 255, 255)
ART = (92, 107, 192, 255)
CYAN = (0, 229, 255, 255)
PINK = (255, 64, 129, 255)


def draw(bg=True, pad=0):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        d.rectangle([0, 0, S, S], fill=BG)
    cw, ch = 420 - pad, 588 - pad * 1.4
    cx, cy = S / 2, S / 2
    ol, orr, ot, ob = cx - cw / 2, cx + cw / 2, cy - ch / 2, cy + ch / 2
    d.rounded_rectangle([ol, ot, orr, ob], radius=28, fill=CARD)
    bw = cw * 0.1
    il, ir, it, ib = ol + bw, orr - bw, ot + bw, ob - bw
    d.rectangle([il, it, ir, ib], fill=ART)

    # “居”“中”上下排列，放在图案区正中。
    size = int(min(ir - il, (ib - it) / 2) * 0.78)
    font = ImageFont.truetype(str(FONT), size)
    gap = size * 0.06
    for ch_, dy in (('居', -(size / 2 + gap)), ('中', size / 2 + gap)):
        d.text((cx, cy + dy), ch_, font=font, fill=(255, 255, 255, 255), anchor='mm')

    ext, w = 70, 14
    for x in (ol, orr):
        d.line([x, ot - ext, x, ob + ext], fill=CYAN, width=w)
    for y in (ot, ob):
        d.line([ol - ext, y, orr + ext, y], fill=CYAN, width=w)
    for x in (il, ir):
        d.line([x, ot - ext, x, ob + ext], fill=PINK, width=w)
    for y in (it, ib):
        d.line([ol - ext, y, orr + ext, y], fill=PINK, width=w)
    return im


if __name__ == '__main__':
    draw().convert('RGB').save(OUT / 'icon_1024.png')
    draw(bg=False, pad=110).save(OUT / 'icon_foreground_1024.png')
    print('written', OUT / 'icon_1024.png', OUT / 'icon_foreground_1024.png')
