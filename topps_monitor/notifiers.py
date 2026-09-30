"""通知渠道：Telegram、微信（Server酱）、手机推送（ntfy）、Mac 桌面通知。

只用 Python 标准库，没有第三方依赖。某个渠道失败不会影响其它渠道。
"""

import json
import logging
import subprocess
import sys
import urllib.parse
import urllib.request

from .net import SSL_CONTEXT

log = logging.getLogger("topps.notify")


def _post(url, data=None, headers=None, json_body=None, timeout=15):
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers = {**(headers or {}), "Content-Type": "application/json"}
    elif isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
        return resp.status


def send_telegram(cfg, title, body, url=None):
    text = f"*{title}*\n{body}"
    if url:
        text += f"\n{url}"
    _post(
        f"https://api.telegram.org/bot{cfg['bot_token']}/sendMessage",
        json_body={"chat_id": cfg["chat_id"], "text": text, "parse_mode": "Markdown",
                   "disable_web_page_preview": False},
    )


def send_serverchan(cfg, title, body, url=None):
    """微信推送：https://sct.ftqq.com 获取 SendKey。"""
    desp = body + (f"\n\n[立即购买]({url})" if url else "")
    _post(f"https://sctapi.ftqq.com/{cfg['send_key']}.send", data={"title": title[:32], "desp": desp})


def send_ntfy(cfg, title, body, url=None):
    """手机推送：安卓/iPhone 安装 ntfy App 并订阅同一个 topic。"""
    server = cfg.get("server", "https://ntfy.sh").rstrip("/")
    payload = {"topic": cfg["topic"], "title": title, "message": body,
               "priority": int(cfg.get("priority", 5)), "tags": ["rotating_light"]}
    if url:
        payload["click"] = url
        payload["actions"] = [{"action": "view", "label": "打开购买页", "url": url}]
    _post(server, json_body=payload)


def send_mac(cfg, title, body, url=None):
    if sys.platform != "darwin":
        return
    script = f'display notification {json.dumps(body)} with title {json.dumps(title)} sound name "Glass"'
    subprocess.run(["osascript", "-e", script], check=False, timeout=10)


CHANNELS = {
    "telegram": send_telegram,
    "serverchan": send_serverchan,
    "ntfy": send_ntfy,
    "mac": send_mac,
}


class Notifier:
    def __init__(self, notify_cfg, dry_run=False):
        self.cfg = notify_cfg or {}
        self.dry_run = dry_run
        self.sent = []  # 测试用

    def send(self, title, body, url=None):
        self.sent.append((title, body, url))
        log.info("通知: %s | %s | %s", title, body.replace("\n", " / "), url or "")
        if self.dry_run:
            return
        for name, fn in CHANNELS.items():
            ch = self.cfg.get(name)
            if not ch or not ch.get("enabled"):
                continue
            try:
                fn(ch, title, body, url)
            except Exception as e:  # 一个渠道挂了不影响别的
                log.warning("通知渠道 %s 发送失败: %s", name, e)
