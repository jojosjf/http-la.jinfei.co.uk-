"""生成软件著作权登记用的《使用说明书》PDF。

    python3 tool/make_manual_pdf.py [版本号]

截图在 docs/copyright/screens/（手机界面 1080×1920），按“打开软件 → 各功能
依次使用”的顺序编号。需要 reportlab 和中文字体，默认用文泉驿正黑，可用环境
变量 CJK_FONT 指定 .ttf/.ttc 路径。
"""
import os
import pathlib
import sys

from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAME = '卡牌居中检查'
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'V2.0'
SHOTS = ROOT / 'docs' / 'copyright' / 'screens'
OUT = ROOT / 'docs' / 'copyright' / f'{NAME}{VERSION}_使用说明书.pdf'

FONT_PATH = os.environ.get('CJK_FONT', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
pdfmetrics.registerFont(TTFont('CJK', FONT_PATH, subfontIndex=0))

BODY = ParagraphStyle('body', fontName='CJK', fontSize=11, leading=19,
                      firstLineIndent=22, wordWrap='CJK', spaceAfter=4)
TITLE = ParagraphStyle('title', fontName='CJK', fontSize=20, leading=30,
                       alignment=TA_CENTER, spaceAfter=18)
H1 = ParagraphStyle('h1', fontName='CJK', fontSize=15, leading=24,
                    spaceBefore=10, spaceAfter=6)
H2 = ParagraphStyle('h2', fontName='CJK', fontSize=12.5, leading=21,
                    spaceBefore=8, spaceAfter=4)
CAPTION = ParagraphStyle('caption', fontName='CJK', fontSize=10, leading=16,
                         alignment=TA_CENTER, spaceBefore=4, spaceAfter=8)
CELL = ParagraphStyle('cell', fontName='CJK', fontSize=10.5, leading=17,
                      wordWrap='CJK')

figure_no = 0


def p(text):
    return Paragraph(text, BODY)


def figure(name, caption):
    global figure_no
    figure_no += 1
    height = 11.2 * cm
    img = Image(str(SHOTS / f'{name}.png'), width=height * 1080 / 1920, height=height)
    return KeepTogether([img, Paragraph(f'图 {figure_no}  {caption}', CAPTION)])


def section(title, paragraphs, shot, caption):
    return [KeepTogether([Paragraph(title, H2), p(paragraphs[0])]),
            *[p(t) for t in paragraphs[1:]],
            figure(shot, caption)]


def table(rows, widths):
    t = Table([[Paragraph(c, CELL) for c in r] for r in rows], colWidths=widths)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, '#888888'),
        ('BACKGROUND', (0, 0), (-1, 0), '#E8EAF6'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def story():
    s = [Paragraph(f'{NAME}{VERSION} 使用说明书', TITLE)]

    s += [Paragraph('一、软件介绍', H1)]
    s += [Paragraph('1、软件类型', H2),
          p(f'「{NAME}」是一款运行在安卓手机上的图像测量类工具软件，用于测量卡牌正面边框的居中程度。'
            '软件完全离线运行，不需要注册或登录，不申请任何设备权限。')]
    s += [Paragraph('2、开发目的', H2),
          p('收藏卡牌时，卡面图案在卡纸上的位置是否居中，是判断卡牌品相的重要指标之一。'
            '居中程度通常用左右、上下两侧边框宽度的比例来表示，例如 55/45 表示较宽一侧的边框占两侧总宽度的 55%。'
            '用肉眼很难准确判断几个百分点的差别，用尺子测量又容易划伤卡面。'),
          p('本软件让用户只需拍一张卡牌照片，在手机上对齐参考线，就能得到精确的居中比例，'
            '并按公开的正面居中标准给出参考等级，帮助用户在送评前自行判断卡牌的居中情况。')]
    s += [Paragraph('3、主要功能', H2),
          p('软件的主要功能包括：首次启动隐私政策提示与隐私政策查看；从相册选择卡牌照片；'
            '用 8 条参考线分别对齐卡牌外边缘和图案边框；实时计算左右、上下居中比例并给出参考等级和临界提示；'
            '拖动参考线时的放大镜；逐像素微调；照片旋转校正；双指放大查看细节；使用说明。')]
    s += [Paragraph('4、软件特点', H2),
          p('操作简单：选一张照片、拖动参考线即可得到结果，结果随参考线移动实时更新，不需要反复点击计算。'),
          p('测量精细：放大镜、逐像素微调、最高 8 倍的双指放大和 0.1° 精度的旋转校正相互配合，'
            '可以把参考线准确地对齐到卡牌边缘，减少手指遮挡和照片倾斜带来的误差。'),
          p('安全离线：软件不申请网络权限，照片只在手机内存中处理，不上传、不保存，测量结果也不会被记录。')]
    s += [Paragraph('5、运行环境', H2),
          table([['项目', '要求'],
                 ['硬件环境', '安卓智能手机或平板电脑，ARM 架构处理器'],
                 ['软件环境', 'Android 7.0 及以上版本'],
                 ['网络', '不需要网络，完全离线运行'],
                 ['设备权限', '不申请任何设备权限，通过系统照片选择器选图']],
                [3.2 * cm, 12.3 * cm])]

    s += [PageBreak(), Paragraph('二、主要功能介绍', H1)]
    s += section('1、首次启动与隐私政策提示', [
        '在手机桌面点击「卡牌居中检查」图标打开软件。第一次打开时，软件会在主界面上方弹出「隐私政策提示」对话框，'
        '简要说明软件完全离线运行、不收集个人信息、不申请设备权限、照片只在本机处理。',
        '对话框不能通过点击空白处或按返回键关闭，用户必须作出选择：点击「同意」后对话框关闭，进入主界面，'
        '以后再打开软件不会再弹出；点击「不同意」进入下一步的确认提示；'
        '点击「查看《隐私政策》」可以阅读完整的隐私政策。',
    ], '01_prompt', '首次启动时的隐私政策提示')
    s += section('2、查看完整隐私政策', [
        '在隐私政策提示框中点击「查看《隐私政策》」，进入「隐私政策」页面。页面列出更新日期、生效日期，'
        '以及软件收集的个人信息、照片的使用方式、设备权限、第三方 SDK、本机保存的信息、自启动和关联启动、'
        '用户权利、未成年人保护、政策更新和联系方式等内容，用户可以上下滑动阅读全文。',
        '点击页面左上角的返回箭头，回到隐私政策提示框继续选择。软件使用过程中，'
        '也可以随时从「说明」对话框中的「隐私政策」按钮再次进入本页面（见第 11 节）。',
    ], '02_policy', '隐私政策页面')
    s += section('3、不同意隐私政策', [
        '在隐私政策提示框中点击「不同意」，软件弹出「温馨提示」对话框，再次说明软件不会收集任何个人信息，'
        '但需要用户同意隐私政策后才能使用。',
        '点击「再看看」回到隐私政策提示框，用户可以重新阅读并选择「同意」；点击「退出应用」则关闭软件，'
        '下次打开时仍会弹出隐私政策提示。',
    ], '03_disagree', '不同意隐私政策时的温馨提示')
    s += section('4、主界面', [
        '用户在隐私政策提示框中点击「同意」后，进入软件主界面。主界面顶部是标题栏，显示软件名称「卡牌居中检查」，'
        '右上角的「ⓘ」图标用于打开使用说明。',
        '界面中央提示用户「选择一张卡片照片」，并建议尽量正对卡片拍摄、让卡片四边完整入镜，以减少透视变形对测量的影响。'
        '下方的「从相册选择」按钮是开始测量的入口。',
    ], '04_home', '主界面')
    s += section('5、选择卡牌照片', [
        '在主界面点击「从相册选择」，软件打开手机系统自带的照片选择器，用户从中点选一张卡牌照片。'
        '软件只能读取用户选中的这一张照片，不能浏览相册中的其他照片，因此不需要相册权限。',
        '选好照片后自动进入测量界面：上方显示照片和 8 条参考线，参考线先放在默认位置（外框线在照片宽高的 8% 和 92% 处，'
        '内框线在 14% 和 86% 处）；中间一行是工具栏；下方的结果栏显示左右比例、上下比例和参考等级。'
        '标题栏右侧新增「更换图片」图标，点击可以重新选择照片。',
    ], '05_loaded', '选择照片后进入测量界面')
    s += section('6、对齐参考线与测量结果', [
        '8 条参考线分为两组：青色长虚线是外框线，要对齐卡牌的外边缘；粉色短虚线是内框线，要对齐卡面图案的边框。'
        '每条线上有一个手柄，手柄上的小图标出这条线要对准哪一条边，文字「外左」「内上」等标明线的名称。'
        '用手指按住手柄拖动，即可移动对应的参考线；同方向的线不会交叉，最外侧的线不会拖出照片。',
        '参考线每移动一次，结果栏立即重新计算：左右比例 = 左、右两侧边框中较宽一侧所占的百分比，'
        '上下比例同理；参考等级按两者中较差的一个，对照公开的正面居中标准给出。'
        '当比例刚好超出上一等级 1 至 3 个百分点时，结果栏会显示橙色的「临界：接近 PSA x」提示，'
        '提醒用户仔细复核参考线的位置。图 6 中上下比例为 58/42，参考等级为 PSA 9，并提示接近 PSA 10。',
        '结果栏最下方注明“参考 PSA 公开标准，仅供参考，与 PSA 无关联”，说明结果只是参考，不代表实际评级。',
    ], '06_measure', '对齐参考线后的测量结果')
    s += section('7、拖动时的放大镜', [
        '拖动参考线时，屏幕上会出现一个圆形放大镜，放大显示参考线附近的照片细节，放大镜中的黑色虚线就是正在拖动的参考线，'
        '方便用户把线准确地对到边缘上，而不会被手指挡住视线。',
        '拖动过程中手指可以沿着线的方向滑动，放大镜会跟着查看这条线上不同的位置；工具栏左侧同时显示正在拖动的线的名称，'
        '如「内框下线」。松开手指后放大镜自动消失，结果栏显示新的比例。',
    ], '07_magnifier', '拖动参考线时的放大镜')
    s += section('8、逐像素微调', [
        '用手指点一下某条参考线的手柄，这条线被选中，手柄显示为黄色高亮，工具栏变为微调状态：'
        '左侧显示被选中的线的名称，如「内框左线」，右侧出现两个方向箭头按钮。',
        '每点一次箭头按钮，参考线按原图像素移动 1 像素：竖线用左右箭头，横线用上下箭头。'
        '拖动适合大范围移动，箭头适合最后的精确对齐。点击照片的空白处即可取消选中，工具栏恢复原状。',
    ], '08_nudge', '选中参考线后逐像素微调')
    s += section('9、旋转校正', [
        '如果拍照时卡牌有些倾斜，参考线无法同时对齐整条边。此时点击工具栏右侧的「旋转」，工具栏变为刻度盘，'
        '左侧显示当前旋转角度。左右拖动刻度盘即可旋转照片，精度为 0.1°，最大可旋转 ±180°。',
        '点击刻度盘右侧的「归零」图标可以把角度恢复为 0°；点击「✓」完成旋转，工具栏恢复原状，'
        '「旋转」按钮旁边会显示当前的旋转角度。旋转后照片的显示区域不变，参考线位置保持不变，用户可以继续对齐参考线。',
    ], '09_rotate', '拖动刻度盘旋转校正照片')
    s += section('10、双指放大', [
        '在测量界面的照片区域，用两根手指向外张开即可放大照片，最高放大 8 倍，双指向内收拢则缩小。'
        '放大后可以用手指拖动照片，查看卡牌的任意一角。',
        '放大后参考线和手柄随照片一起缩放，线宽和手柄大小保持不变，便于在高倍率下精细调整。'
        '图 10 为放大后查看卡牌上半部分的界面。',
    ], '10_zoom', '双指放大查看细节')
    s += section('11、使用说明与隐私政策入口', [
        '在任意界面点击标题栏右上角的「ⓘ」图标，弹出「说明」对话框，介绍参考线的对齐方法、放大镜、逐像素微调、'
        '双指放大和旋转校正的使用方法，以及照片只在本机处理、不上传、不保存的隐私说明。',
        '对话框底部有两个按钮：点击「隐私政策」进入第 2 节介绍的隐私政策页面，随时查看完整的隐私政策；'
        '点击「关闭」回到之前的界面，继续测量。',
    ], '11_about', '说明对话框')

    s += [Paragraph('三、参考等级对照', H1),
          p('软件按下表把左右、上下比例中较差的一个换算为参考等级。表中比例表示较宽一侧边框所占的最大百分比，'
            '超过 90/10 时显示“低于 PSA 3”。'),
          table([['参考等级', '允许的最大比例'],
                 ['PSA 10', '55/45'], ['PSA 9', '60/40'], ['PSA 8', '65/35'], ['PSA 7', '70/30'],
                 ['PSA 6', '80/20'], ['PSA 5', '85/15'], ['PSA 3', '90/10']],
                [6 * cm, 9.5 * cm]),
          Spacer(1, 8),
          p('当比例超出上一等级 1 至 3 个百分点，且上一等级不低于 PSA 7 时，结果栏显示临界提示。'
            '参考等级依据公开的正面居中标准计算，仅供参考，不代表实际评级。')]
    return s


def decorate(c, doc):
    width, height = A4
    c.saveState()
    c.setFont('CJK', 9.5)
    c.drawCentredString(width / 2, height - 1.3 * cm, f'{NAME}{VERSION}')
    c.setLineWidth(0.5)
    c.line(2 * cm, height - 1.5 * cm, width - 2 * cm, height - 1.5 * cm)
    c.drawCentredString(width / 2, 1.1 * cm, str(doc.page))
    c.restoreState()


def main():
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, title=f'{NAME}{VERSION} 使用说明书',
                            leftMargin=2.5 * cm, rightMargin=2.5 * cm,
                            topMargin=2.2 * cm, bottomMargin=2 * cm)
    doc.build(story(), onFirstPage=decorate, onLaterPages=decorate)
    print(f'{OUT.relative_to(ROOT)}: {doc.page} 页')


if __name__ == '__main__':
    main()
