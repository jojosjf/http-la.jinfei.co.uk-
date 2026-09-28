"""重新生成网页版内置的中文字体子集。

网页版默认从谷歌服务器按需下载中文字体，国内经常加载失败、显示成方框。
这里把界面用到的字符（ARB 文件里的全部文字 + ASCII）做成 Noto Sans SC 子集，
随网页一起部署。修改 lib/l10n/*.arb 后运行：

    python3 tool/subset_web_font.py

另外生成一个常用字备用字体（GB2312 一级汉字 3755 个 + 常用标点，只有常规
粗细），网页版在界面字体里找不到的字（如用户输入的卡片名称）从这里取。
需要先安装 fontTools：pip install fonttools
"""
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'fonts'
WEIGHTS = [400, 500, 600, 700]

chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('×·—…“”‘’：，。；！？（）、%°')
for arb in (ROOT / 'lib' / 'l10n').glob('*.arb'):
    for key, value in json.loads(arb.read_text('utf-8')).items():
        if not key.startswith('@') and isinstance(value, str):
            chars |= set(value)
chars -= {'\n'}
text = ''.join(sorted(chars))

for w in WEIGHTS:
    url = ('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@%d&text=%s'
           % (w, urllib.parse.quote(text)))
    # 旧版浏览器 UA 会拿到 TTF，Flutter 字体资源需要 TTF/OTF。
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/4.0'})
    css = urllib.request.urlopen(req).read().decode()
    font_url = re.search(r'url\((https://[^)]+)\)', css).group(1)
    data = urllib.request.urlopen(font_url).read()
    (OUT / ('NotoSansSC-Subset-%d.ttf' % w)).write_bytes(data)
    print('weight %d: %d bytes' % (w, len(data)))
print('%d characters' % len(text))

# 常用字备用字体：下载完整的 Noto Sans SC，在本地裁成常用字。
from fontTools import subset as ft_subset  # noqa: E402

common = set(text)
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try:
            common.add(bytes([hi, lo]).decode('gb2312'))
        except UnicodeDecodeError:
            pass
common |= set('，。、；：？！“”‘’（）《》【】—…·～￥％＃＠＆＊＋－＝')
req = urllib.request.Request(
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400',
    headers={'User-Agent': 'Mozilla/4.0'})
css = urllib.request.urlopen(req).read().decode()
full = OUT / 'NotoSansSC-Full.tmp.ttf'
full.write_bytes(urllib.request.urlopen(
    re.search(r'url\((https://[^)]+)\)', css).group(1)).read())
# 放在 web/ 里：只随网页版部署，不打进手机安装包，启动后按需加载。
out = ROOT / 'web' / 'fonts' / 'NotoSansSC-Common-400.ttf'
ft_subset.main([
    str(full),
    '--text=' + ''.join(sorted(common)),
    '--output-file=' + str(out),
    '--layout-features=*',
])
full.unlink()
print('common: %d characters, %d bytes' % (len(common), out.stat().st_size))
