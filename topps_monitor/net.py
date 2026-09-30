"""HTTPS 证书设置。

Mac 上用 python.org 安装包装的 Python 默认没有根证书，会报
CERTIFICATE_VERIFY_FAILED。这里额外加载 macOS 系统自带的证书
（/etc/ssl/cert.pem）和 certifi（如已安装），证书校验依然开启。
"""

import os
import ssl

_EXTRA_CA_FILES = ["/etc/ssl/cert.pem", "/usr/local/etc/openssl/cert.pem",
                   "/opt/homebrew/etc/openssl@3/cert.pem"]


def make_ssl_context():
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except Exception:
        pass
    for path in _EXTRA_CA_FILES:
        if os.path.exists(path):
            try:
                ctx.load_verify_locations(path)
            except Exception:
                pass
    return ctx


SSL_CONTEXT = make_ssl_context()
