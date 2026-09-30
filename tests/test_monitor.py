import os
import tempfile
import unittest
from datetime import timedelta

from topps_monitor.monitor import Monitor, Shop, normalize_js_product, now
from topps_monitor.notifiers import Notifier


def prod(pid, title, price, available, handle=None, tags=(), body=""):
    return {"id": pid, "title": title, "handle": handle or f"p{pid}", "tags": list(tags),
            "product_type": "", "body_html": body,
            "variants": [{"id": pid * 10, "price": f"{price:.2f}", "available": available}]}


class FakeShop(Shop):
    def __init__(self, products):
        super().__init__("https://uk.topps.com")
        self.products = products

    def all_products(self, max_pages=10):
        return list(self.products)

    def product(self, handle):
        return next(p for p in self.products if p["handle"] == handle)


CFG = {"include_keywords": ["hobby", "chrome"], "exclude_keywords": ["match attax"],
       "min_price": 60, "auto_open_checkout": True, "default_quantity": 1,
       "watchlist": [{"handle": "ucc", "quantity": 2}]}


class MonitorTest(unittest.TestCase):
    def make(self, products, cfg=CFG):
        self.tmp = tempfile.mkdtemp()
        self.opened = []
        self.shop = FakeShop(products)
        self.n = Notifier({}, dry_run=True)
        return Monitor(cfg, os.path.join(self.tmp, "state.json"), notifier=self.n,
                       shop=self.shop, opener=self.opened.append)

    def test_first_run_silent_then_restock_notifies_and_opens_checkout(self):
        m = self.make([prod(1, "Topps Chrome UCC Hobby Box", 250, False, handle="ucc")])
        m.scan_all()
        self.assertEqual(self.n.sent, [])
        self.shop.products[0]["variants"][0]["available"] = True
        m.scan_all()
        self.assertEqual(len(self.n.sent), 1)
        self.assertIn("开卖", self.n.sent[0][0])
        self.assertEqual(self.opened, ["https://uk.topps.com/cart/10:2"])
        m.scan_all()  # 仍有货：不重复通知、不重复打开
        self.assertEqual(len(self.n.sent), 1)
        self.assertEqual(len(self.opened), 1)

    def test_filters_exclude_match_attax_and_cheap(self):
        m = self.make([prod(1, "Seed", 100, False, handle="ucc")])
        m.scan_all()
        self.shop.products += [prod(2, "Match Attax Hobby Tin", 90, True),
                               prod(3, "Chrome Hanger Pack", 5, True),
                               prod(4, "Topps Sapphire Hobby Box", 300, False)]
        m.scan_all()
        titles = [s[1].splitlines()[0] for s in self.n.sent]
        self.assertEqual(titles, ["Topps Sapphire Hobby Box"])
        self.assertIn("新品", self.n.sent[0][0])

    def test_release_hint_extracted(self):
        m = self.make([prod(1, "Seed", 100, False, handle="ucc")])
        m.scan_all()
        self.shop.products.append(prod(5, "Chrome F1 Hobby Box", 200, False,
                                       body="<p>This product releases on 15th October at 10am BST.</p>"))
        m.scan_all()
        self.assertIn("15th October", self.n.sent[0][1])

    def test_schedule_reminder_and_hot_window(self):
        start = (now() + timedelta(minutes=2)).isoformat()
        cfg = {**CFG, "schedule": [{"handle": "ucc", "name": "UCC", "time": start}]}
        m = self.make([prod(1, "Topps Chrome UCC Hobby Box", 250, False, handle="ucc")], cfg)
        m.send_reminders()
        self.assertEqual(len(self.n.sent), 1)  # 60 和 5 分钟都已到期，只发一条
        self.assertIn("2 分钟", self.n.sent[0][0])
        m.send_reminders()
        self.assertEqual(len(self.n.sent), 1)
        self.assertEqual(m.hot_handles(), {"ucc"})
        m.check_hot({"ucc"})
        self.shop.products[0]["variants"][0]["available"] = True
        m.check_hot({"ucc"})
        self.assertEqual(self.opened, ["https://uk.topps.com/cart/10:2"])

    def test_normalize_js_product_pence(self):
        p = normalize_js_product({"id": 1, "title": "t", "handle": "h",
                                  "variants": [{"id": 2, "price": 24999, "available": True}]})
        self.assertEqual(p["variants"][0]["price"], "249.99")


if __name__ == "__main__":
    unittest.main()
