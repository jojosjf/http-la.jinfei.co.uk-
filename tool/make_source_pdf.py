"""生成软件著作权登记用的源程序 PDF。

    python3 tool/make_source_pdf.py [版本号]

按规范排版：每页 52 行（≥50），页眉写软件名称和版本号，页脚标页码；
不满 60 页时全部提供，超过 60 页时取前 30 页和后 30 页。
从 lib/main.dart 的开头开始，按“入口 → 数据模型 → 计算逻辑 → 界面”的顺序
收录手写的 Dart 源码；自动生成的多语言文件（lib/l10n）不收录。

需要 reportlab（pip install reportlab）和一个中文等宽字体，默认用
文泉驿等宽正黑（Linux 的 fonts-wqy-zenhei），可用环境变量 CJK_FONT
指定 .ttf/.ttc 路径。
"""
import os
import pathlib
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAME = '卡牌居中检查'
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'V1.0.2'
LINES_PER_PAGE = 52
OUT = ROOT / 'docs' / 'copyright' / f'{NAME}{VERSION}_源程序.pdf'

FONT_PATH = os.environ.get('CJK_FONT', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
# 文泉驿 ttc 里第 2 个字体是等宽版（Zen Hei Mono），代码缩进才能对齐。
pdfmetrics.registerFont(TTFont('Mono', FONT_PATH, subfontIndex=1))


def source_files():
    lib = ROOT / 'lib'
    groups = [
        [lib / 'main.dart'],
        sorted((lib / 'models').glob('*.dart')),
        sorted((lib / 'logic').glob('*.dart')),
        sorted((lib / 'ui').glob('*.dart')),
    ]
    return [f for g in groups for f in g]


def source_lines():
    lines = []
    for f in source_files():
        text = f.read_text('utf-8').rstrip('\n').split('\n')
        # 文件之间只留一个空行，不写文件名。
        if lines:
            lines.append('')
        lines.extend(line.rstrip() for line in text)
    return lines


def pages_to_print(lines):
    pages = [lines[i:i + LINES_PER_PAGE] for i in range(0, len(lines), LINES_PER_PAGE)]
    if len(pages) <= 60:
        return pages
    return pages[:30] + pages[-30:]


def main():
    pages = pages_to_print(source_lines())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    left, top, bottom = 42, 50, 44
    size = 8.2
    step = (height - top - bottom - 16) / LINES_PER_PAGE

    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle(f'{NAME} {VERSION} 源程序')
    for number, page in enumerate(pages, start=1):
        c.setFont('Mono', 9)
        c.drawString(left, height - 32, f'{NAME} {VERSION}')
        c.drawRightString(width - left, height - 32, '源程序')
        c.line(left, height - 38, width - left, height - 38)
        c.setFont('Mono', size)
        y = height - top - 8
        for line in page:
            c.drawString(left, y, line)
            y -= step
        c.setFont('Mono', 9)
        c.drawCentredString(width / 2, 24, f'第 {number} 页  共 {len(pages)} 页')
        c.showPage()
    c.save()
    total = sum(len(p) for p in pages)
    print(f'{OUT.relative_to(ROOT)}: {len(pages)} 页, {total} 行')


if __name__ == '__main__':
    main()
