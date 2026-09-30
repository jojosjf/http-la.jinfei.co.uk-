"""生成可以直接上传的网页：技术支持页、iOS 隐私政策页和通用隐私政策页。

    python3 tool/make_ios_pages.py 中文名 英文名 邮箱 [输出目录]

例：python3 tool/make_ios_pages.py 施晋菲 "Jinfei Shi" me@example.com ~/Desktop/ccc

填好 web/support.html、web/privacy_ios.html、web/privacy.html 里的开发者姓名和邮箱，并把所有
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


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    name_zh, name_en, email = sys.argv[1:4]
    out = pathlib.Path(sys.argv[4] if len(sys.argv) > 4 else ROOT / 'build' / 'ios_pages').expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for page in ('support.html', 'privacy_ios.html', 'privacy.html'):
        text = (ROOT / 'web' / page).read_text('utf-8')
        text = (text.replace('【开发者姓名】', name_zh).replace('【联系邮箱】', email)
                    .replace('[Developer name]', name_en).replace('[Contact email]', email))
        left = re.findall(r'【[^】]*】|\[Developer name\]|\[Contact email\]', text)
        if left:
            raise SystemExit(f'{page} 还有没替换的占位符：{left}')
        (out / page).write_text(ascii_only(text), 'ascii')
        print(out / page)


if __name__ == '__main__':
    main()
