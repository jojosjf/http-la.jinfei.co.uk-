"""生成可以直接上传的网页：技术支持页和各隐私政策页。

  privacy_app.html  安卓、鸿蒙 1.1 版（有测量记录、结果图）
  privacy_ios.html  iOS 版
  privacy.html      安卓 1.0 版和网页版

    python3 tool/make_ios_pages.py [--zh] 中文名 英文名 邮箱 [输出目录]

例：python3 tool/make_ios_pages.py 施晋菲 "Jinfei Shi" me@example.com ~/Desktop/ccc
    python3 tool/make_ios_pages.py --zh 施晋菲 "Jinfei Shi" me@example.com ~/Desktop/ccc_cn

默认生成英文优先的页面（海外网站用）；加 --zh 则默认显示中文（国内网站用），
仍可点按钮或用 #en 切换到英文。

填好 web/ 下技术支持页和各隐私政策页里的开发者姓名和邮箱，并把所有
非英文字符写成 HTML 字符引用（如“卡”写成 &#21345;）。这样文件只含英文字符，
不管网站服务器声明的是什么编码，中文都不会显示成乱码。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def ascii_only(text):
    # <script> 里的字符引用不会被解码，所以脚本部分必须本来就是纯英文。
    for script in re.findall(r'<script>.*?</script>', text, flags=re.S):
        if not script.isascii():
            raise SystemExit('<script> 中含有非英文字符，无法安全转换')
    return ''.join(c if ord(c) < 128 else f'&#{ord(c)};' for c in text)


def chinese_first(text):
    """把默认语言改成中文：标题、按钮状态、默认值，以及不支持脚本时的先后顺序。"""
    def swap(old, new):
        nonlocal text
        if old not in text:
            raise SystemExit(f'找不到要替换的内容：{old}')
        text = text.replace(old, new, 1)

    zh_title = re.search(r'<section data-lang="zh" data-title="([^"]*)"', text).group(1)
    text = re.sub(r'<title>.*?</title>', f'<title>{zh_title}</title>', text, count=1)
    swap('<html lang="en">', '<html lang="zh-CN">')
    swap('data-set="en" aria-pressed="true"', 'data-set="en" aria-pressed="false"')
    swap('data-set="zh" aria-pressed="false"', 'data-set="zh" aria-pressed="true"')
    swap("(saved === 'zh' ? 'zh' : 'en')", "(saved === 'en' ? 'en' : 'zh')")
    # 不支持脚本时两种语言都显示，中文排前面。
    en = re.search(r'  <section data-lang="en".*?</section>\n', text, flags=re.S).group(0)
    zh = re.search(r'  <section data-lang="zh".*?</section>\n', text, flags=re.S).group(0)
    divider = '  <hr class="nojs-divider">\n'
    swap(en + divider + zh, zh + divider + en)
    return text


def main():
    args = sys.argv[1:]
    zh_default = '--zh' in args
    args = [a for a in args if a != '--zh']
    if len(args) < 3:
        raise SystemExit(__doc__)
    name_zh, name_en, email = args[:3]
    out = pathlib.Path(args[3] if len(args) > 3 else ROOT / 'build' / 'ios_pages').expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for page in ('support.html', 'privacy_ios.html', 'privacy.html', 'privacy_app.html'):
        text = (ROOT / 'web' / page).read_text('utf-8')
        text = (text.replace('【开发者姓名】', name_zh).replace('【联系邮箱】', email)
                    .replace('[Developer name]', name_en).replace('[Contact email]', email))
        left = re.findall(r'【[^】]*】|\[Developer name\]|\[Contact email\]', text)
        if left:
            raise SystemExit(f'{page} 还有没替换的占位符：{left}')
        if zh_default:
            text = chinese_first(text)
        (out / page).write_text(ascii_only(text), 'ascii')
        print(out / page)


if __name__ == '__main__':
    main()
