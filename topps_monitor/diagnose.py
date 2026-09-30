"""诊断 uk.topps.com 的网站结构和访问限制。

用法：python3 -m topps_monitor.diagnose
把输出全部复制发回即可（不包含任何个人信息）。
"""

import re
import urllib.error
import urllib.request

from .monitor import USER_AGENT
from .net import SSL_CONTEXT

BASE = "https://uk.topps.com"
PATHS = ["/", "/robots.txt", "/products.json?limit=1", "/collections/all",
         "/sitemap.xml", "/search?q=hobby"]
HEADERS_OF_INTEREST = ["server", "x-shopid", "x-shopify-stage", "powered-by", "cf-ray", "cf-mitigated",
                       "x-powered-by", "x-magento-cache-debug", "x-akamai-transformed", "akamai-grn",
                       "x-amz-cf-id", "x-cache", "set-cookie", "content-type", "location"]


def probe(path):
    req = urllib.request.Request(BASE + path, headers={
        "User-Agent": USER_AGENT, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9"})
    try:
        resp = urllib.request.urlopen(req, timeout=20, context=SSL_CONTEXT)
        status, headers, body = resp.status, resp.headers, resp.read(200_000)
    except urllib.error.HTTPError as e:
        status, headers, body = e.code, e.headers, e.read(200_000)
    except Exception as e:
        print(f"\n== {path}\n   连接失败: {e}")
        return
    text = body.decode("utf-8", "ignore")
    print(f"\n== {path}\n   状态码: {status}   最终地址: {getattr(resp, 'url', '') if status == 200 else ''}")
    for h in HEADERS_OF_INTEREST:
        v = headers.get(h)
        if v:
            if h == "set-cookie":  # 只显示 cookie 名字，不显示值
                v = ", ".join(sorted({c.split("=")[0].strip() for c in headers.get_all(h)}))
            print(f"   {h}: {v[:150]}")
    title = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
    if title:
        print(f"   页面标题: {' '.join(title.group(1).split())[:120]}")
    for marker in ["Shopify", "cdn.shopify.com", "Magento", "salesforce", "demandware", "BigCommerce",
                   "cloudflare", "Just a moment", "captcha", "Access Denied", "queue-it", "_Incapsula_",
                   "akamai", "__NEXT_DATA__", "application/ld+json"]:
        if marker.lower() in text.lower():
            print(f"   页面包含: {marker}")
    if path == "/robots.txt" and status == 200:
        print("   robots.txt 前 25 行:")
        for line in text.splitlines()[:25]:
            print("     " + line)
    if status != 200 and path != "/robots.txt":
        print("   返回内容前 300 字: " + " ".join(text.split())[:300])


def main():
    print(f"诊断 {BASE}")
    for p in PATHS:
        probe(p)


if __name__ == "__main__":
    main()
