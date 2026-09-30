"""Topps UK 新品 / 开卖监控（第一阶段：监控 + 通知 + 半自动下单）。

用法：
    python3 -m topps_monitor.monitor              # 持续运行
    python3 -m topps_monitor.monitor --once       # 只检查一次（测试用）
    python3 -m topps_monitor.monitor --test-notify  # 发一条测试通知

uk.topps.com 是 Shopify 商店，所以用 Shopify 公开的商品接口：
    /products.json            全店商品列表（含库存状态、价格）
    /products/<handle>.js     单个商品（开卖前后高频检查用）
半自动下单用 Shopify 的购物车直达链接 /cart/<variant_id>:<数量>，
打开后商品直接进购物车并跳到结账页，最后由你本人确认付款。
"""

import argparse
import html
import json
import logging
import os
import random
import re
import time
import urllib.error
import urllib.request
import webbrowser

from datetime import datetime, timedelta, timezone

from .net import SSL_CONTEXT
from .notifiers import Notifier

log = logging.getLogger("topps")

HERE = os.path.dirname(os.path.abspath(__file__))
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")

RELEASE_HINT = re.compile(
    r"([^.!?\n]{0,80}\b(release[sd]?|launch(es|ing)?|on sale|available (from|on)|drops?|pre-?order)\b[^.!?\n]{0,80})",
    re.I)


# ---------------------------------------------------------------- 工具函数

def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def strip_html(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).replace("\xa0", " ")


def parse_time(s):
    """解析配置里的时间，如 2026-10-05T10:00:00+01:00 或 2026-10-05 10:00（按英国时间）。"""
    dt = datetime.fromisoformat(s.replace("Z", "+00:00").replace(" ", "T"))
    if dt.tzinfo is None:
        try:
            from zoneinfo import ZoneInfo
            dt = dt.replace(tzinfo=ZoneInfo("Europe/London"))
        except Exception:
            dt = dt.replace(tzinfo=timezone.utc)
    return dt


def now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- 商店访问

class Shop:
    def __init__(self, base_url, timeout=20):
        self.base = base_url.rstrip("/")
        self.timeout = timeout

    def get_json(self, path):
        req = urllib.request.Request(self.base + path, headers={
            "User-Agent": USER_AGENT, "Accept": "application/json", "Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=self.timeout, context=SSL_CONTEXT) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def all_products(self, max_pages=10):
        out = []
        for page in range(1, max_pages + 1):
            data = self.get_json(f"/products.json?limit=250&page={page}")
            items = data.get("products", [])
            out.extend(items)
            if len(items) < 250:
                break
        return out

    def product(self, handle):
        # 加随机参数绕开 CDN 缓存，拿到最新库存
        return normalize_js_product(self.get_json(f"/products/{handle}.js?_={int(time.time())}"))

    def product_url(self, handle):
        return f"{self.base}/products/{handle}"

    def checkout_url(self, variant_id, qty):
        return f"{self.base}/cart/{variant_id}:{qty}"


def normalize_js_product(p):
    """把 /products/x.js 的格式（价格以便士为单位）转成和 products.json 一致。"""
    return {
        "id": p["id"], "title": p["title"], "handle": p["handle"],
        "body_html": p.get("description", ""), "tags": p.get("tags", []),
        "product_type": p.get("type", ""), "published_at": p.get("published_at"),
        "variants": [{"id": v["id"], "title": v.get("title", ""), "available": v.get("available", False),
                      "price": f"{v['price'] / 100:.2f}" if isinstance(v.get("price"), int) else v.get("price")}
                     for v in p.get("variants", [])],
    }


# ---------------------------------------------------------------- 筛选

def product_text(p):
    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = tags.split(",")
    return " ".join([p.get("title", ""), p.get("product_type", ""), " ".join(tags)]).lower()


def summarize(p):
    variants = p.get("variants") or []
    avail = [v for v in variants if v.get("available")]
    prices = [float(v["price"]) for v in variants if v.get("price")]
    body = strip_html(p.get("body_html"))
    hints = [m.group(1).strip() for m in RELEASE_HINT.finditer(body)][:2]
    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    return {
        "id": p["id"], "title": p["title"], "handle": p["handle"],
        "available": bool(avail),
        "variant_id": (avail or variants or [{}])[0].get("id"),
        "price": min(prices) if prices else None,
        "release_hint": " | ".join(hints),
        "coming_soon": any("coming" in t.lower() or "pre-order" in t.lower() or "preorder" in t.lower()
                           for t in tags),
    }


class Filter:
    def __init__(self, cfg):
        self.include = [k.lower() for k in cfg.get("include_keywords", [])]
        self.exclude = [k.lower() for k in cfg.get("exclude_keywords", [])]
        self.min_price = cfg.get("min_price")
        self.max_price = cfg.get("max_price")
        self.watch_handles = {w["handle"] for w in cfg.get("watchlist", []) if w.get("handle")}

    def wanted(self, p, info):
        if p["handle"] in self.watch_handles:
            return True
        text = product_text(p)
        if any(k in text for k in self.exclude):
            return False
        if self.include and not any(k in text for k in self.include):
            return False
        price = info["price"]
        if price is not None:
            if self.min_price and price < self.min_price:
                return False
            if self.max_price and price > self.max_price:
                return False
        return True


# ---------------------------------------------------------------- 主逻辑

class Monitor:
    def __init__(self, cfg, state_path, notifier=None, shop=None, opener=webbrowser.open):
        self.cfg = cfg
        self.state_path = state_path
        self.state = load_json(state_path, {"products": {}, "reminders": [], "opened": []})
        self.shop = shop or Shop(cfg.get("store", "https://uk.topps.com"))
        self.notifier = notifier or Notifier(cfg.get("notify"))
        self.filter = Filter(cfg)
        self.opener = opener
        self.first_run = not self.state["products"]
        self.last_block_notice = 0.0
        self.qty_by_handle = {w["handle"]: w.get("quantity", 1)
                              for w in cfg.get("watchlist", []) if w.get("handle")}

    # --- 通知 & 半自动下单

    def buy_link(self, info):
        qty = self.qty_by_handle.get(info["handle"], self.cfg.get("default_quantity", 1))
        if info.get("variant_id"):
            return self.shop.checkout_url(info["variant_id"], qty)
        return self.shop.product_url(info["handle"])

    def fmt(self, info):
        lines = [info["title"]]
        if info["price"] is not None:
            lines.append(f"价格: £{info['price']:.2f}")
        if info.get("release_hint"):
            lines.append(f"发售信息: {info['release_hint'][:200]}")
        lines.append(f"商品页: {self.shop.product_url(info['handle'])}")
        return "\n".join(lines)

    def on_available(self, info, reason):
        link = self.buy_link(info)
        self.notifier.send(f"🚨 开卖了！{reason}", self.fmt(info) + "\n点链接直接进入结账页", link)
        if self.cfg.get("auto_open_checkout") and info["handle"] not in self.state["opened"]:
            log.info("自动打开结账页: %s", link)
            self.opener(link)
            self.state["opened"].append(info["handle"])

    # --- 一次全店扫描

    def scan_all(self):
        products = self.shop.all_products()
        seen = self.state["products"]
        wanted_count = 0
        for p in products:
            info = summarize(p)
            if not self.filter.wanted(p, info):
                continue
            wanted_count += 1
            key = str(info["id"])
            old = seen.get(key)
            if old is None:
                if not self.first_run:
                    if info["available"]:
                        self.on_available(info, "新品上架")
                    else:
                        self.notifier.send("🆕 发现新品（未开卖）", self.fmt(info), self.shop.product_url(info["handle"]))
            else:
                self.compare(old, info)
            seen[key] = {**info, "last_seen": now().isoformat()}
        if self.first_run:
            log.info("首次运行：记录了 %d 个符合条件的商品（首次不发通知）", wanted_count)
            self.first_run = False
        else:
            log.info("全店扫描完成：共 %d 个商品，符合条件 %d 个", len(products), wanted_count)
        return products

    def compare(self, old, info):
        if info["available"] and not old.get("available"):
            self.on_available(info, "补货/开卖")
        elif not info["available"] and old.get("available"):
            log.info("已售罄: %s", info["title"])
            if info["handle"] in self.state["opened"]:
                self.state["opened"].remove(info["handle"])
        if old.get("release_hint") != info.get("release_hint") and info.get("release_hint"):
            self.notifier.send("🗓 发售信息更新", self.fmt(info), self.shop.product_url(info["handle"]))
        if old.get("price") and info["price"] and old["price"] != info["price"]:
            self.notifier.send("💷 价格变动", f"{info['title']}\n£{old['price']:.2f} → £{info['price']:.2f}",
                               self.shop.product_url(info["handle"]))

    # --- 开卖前后的高频检查

    def hot_handles(self):
        """返回当前处于“开卖窗口”的商品 handle。"""
        hot = set()
        t = now()
        before = timedelta(minutes=self.cfg.get("hot_window_before_min", 3))
        after = timedelta(minutes=self.cfg.get("hot_window_after_min", 30))
        for item in self.cfg.get("schedule", []):
            start = parse_time(item["time"])
            if start - before <= t <= start + after:
                hot.add(item["handle"])
        for w in self.cfg.get("watchlist", []):
            if w.get("always_hot"):
                hot.add(w["handle"])
        return hot

    def check_hot(self, handles):
        for h in handles:
            try:
                p = self.shop.product(h)
            except Exception as e:
                log.warning("高频检查 %s 失败: %s", h, e)
                continue
            info = summarize(p)
            key = str(info["id"])
            old = self.state["products"].get(key)
            if old is None:
                if info["available"]:
                    self.on_available(info, "开卖")
            else:
                self.compare(old, info)
            self.state["products"][key] = {**info, "last_seen": now().isoformat()}

    def send_reminders(self):
        t = now()
        done = set(self.state["reminders"])
        for item in self.cfg.get("schedule", []):
            start = parse_time(item["time"])
            if not t < start:
                continue
            # 只发最紧迫的一条提醒，更早的那些一并标记为已发
            due = [m for m in self.cfg.get("remind_before_min", [60, 5])
                   if start - timedelta(minutes=m) <= t]
            if not due:
                continue
            ids = [f"{item['handle']}@{item['time']}-{m}" for m in due]
            if all(i in done for i in ids):
                continue
            mins_left = max(1, round((start - t).total_seconds() / 60))
            local = start.astimezone().strftime("%m-%d %H:%M")
            self.notifier.send(f"⏰ 约 {mins_left} 分钟后开卖",
                               f"{item.get('name', item['handle'])}\n开卖时间: {local}（本机时间）",
                               self.shop.product_url(item["handle"]))
            self.state["reminders"].extend(i for i in ids if i not in done)

    # --- 主循环

    def save(self):
        save_json(self.state_path, self.state)

    def run(self, once=False):
        normal = max(30, self.cfg.get("poll_seconds", 120))
        hot_iv = max(3, self.cfg.get("hot_poll_seconds", 5))
        last_full = 0.0
        backoff = 0
        while True:
            try:
                self.send_reminders()
                if time.time() - last_full >= normal:
                    self.scan_all()
                    last_full = time.time()
                hot = self.hot_handles()
                if hot:
                    self.check_hot(hot)
                self.save()
                backoff = 0
            except urllib.error.HTTPError as e:
                backoff = min(600, max(30, backoff * 2))
                log.warning("网站返回 %s（%s），%d 秒后重试", e.code,
                            "请求太频繁" if e.code == 429 else "可能在排队/维护", backoff)
                if e.code in (403, 429, 503) and time.time() - self.last_block_notice > 3600:
                    self.last_block_notice = time.time()
                    self.notifier.send("⚠️ 网站访问受限", f"Topps 返回 {e.code}，可能在排队或限流，请手动打开网站查看",
                                       self.shop.base)
            except Exception as e:
                backoff = min(600, max(30, backoff * 2))
                log.warning("检查失败: %s，%d 秒后重试", e, backoff)
            if once:
                return
            if backoff:
                time.sleep(backoff)
            else:
                time.sleep((hot_iv if self.hot_handles() else min(normal, 30)) + random.uniform(0, 1))


def main():
    ap = argparse.ArgumentParser(description="Topps UK 开卖监控")
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--state", default=os.path.join(HERE, "state.json"))
    ap.add_argument("--once", action="store_true", help="只检查一次")
    ap.add_argument("--test-notify", action="store_true", help="发送测试通知")
    ap.add_argument("--list", action="store_true", help="列出当前符合筛选条件的商品")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(),
                                  logging.FileHandler(os.path.join(HERE, "monitor.log"), encoding="utf-8")])
    if not os.path.exists(args.config):
        raise SystemExit(f"找不到配置文件 {args.config}，请先复制 config.example.json 为 config.json 并填写")
    cfg = load_json(args.config, {})

    if args.test_notify:
        Notifier(cfg.get("notify")).send("✅ Topps 监控测试", "如果你收到这条消息，说明通知配置成功", cfg.get("store"))
        return
    mon = Monitor(cfg, args.state)
    if args.list:
        for p in mon.shop.all_products():
            info = summarize(p)
            if mon.filter.wanted(p, info):
                flag = "有货" if info["available"] else "无货"
                price = f"£{info['price']:.2f}" if info["price"] is not None else "-"
                print(f"[{flag}] {price:>9}  {info['title']}  (handle: {info['handle']})")
        return
    log.info("开始监控 %s", mon.shop.base)
    mon.run(once=args.once)


if __name__ == "__main__":
    main()
