# Topps UK 开卖监控助手

盯着 [uk.topps.com](https://uk.topps.com) 的高端卡盒，一开卖或补货就推送到手机，并在 Mac 上自动打开**已加购、直达结账页**的链接，你只需确认付款。

> 第一阶段：监控 + 通知 + 半自动下单（本版本）
> 第二阶段：全自动下单（待定，见文末说明）

## 功能

| 功能 | 说明 |
|---|---|
| 新品发现 | 每 2 分钟扫描全店，符合条件的新品立刻通知（含发售信息片段） |
| 开卖 / 补货 | 商品从无货变有货时立刻通知 |
| 开卖倒计时 | 在 `schedule` 里填开卖时间，提前 60 / 5 分钟提醒 |
| 开卖前后高频检查 | 开卖前 3 分钟到开卖后 30 分钟，每 5 秒检查一次 |
| 半自动下单 | 有货时自动在 Mac 默认浏览器打开 `/cart/商品:数量` 链接 —— 商品直接进购物车并跳到结账页 |
| 价格 / 发售信息变动 | 自动通知 |
| 只看高端盒 | 关键词筛选（Hobby、Jumbo、Breaker's Delight、Sapphire、Dynasty…），排除 Match Attax 等 |

## 安装（Mac）

Mac 自带 Python 3（首次运行 `python3` 若提示安装开发者工具，点“安装”即可）。**无需安装任何第三方库。**

```bash
git clone <本仓库地址> ~/topps && cd ~/topps
cp topps_monitor/config.example.json topps_monitor/config.json
# 编辑 config.json（见下文）
python3 -m topps_monitor.monitor --test-notify   # 测试通知
python3 -m topps_monitor.monitor --list          # 看看当前筛选出的商品
python3 -m topps_monitor.monitor                 # 开始监控
```

## 设置通知（任选，可同时开）

- **手机推送（推荐，最快）**：手机装 **ntfy** App（安卓应用商店 / App Store），订阅一个只有你知道的主题名，例如 `topps-jojo-8f3k2`，把同样的名字填进 `notify.ntfy.topic`。点通知直接进结账页。
- **Telegram**：找 @BotFather 创建机器人拿到 `bot_token`；给机器人发一条消息后，访问 `https://api.telegram.org/bot<token>/getUpdates` 找到 `chat_id`。
- **微信**：在 [Server酱](https://sct.ftqq.com) 用微信登录拿到 `SendKey`，填到 `notify.serverchan.send_key`。
- **Mac 桌面通知**：默认开启。

## 配置说明（`topps_monitor/config.json`）

- `include_keywords` / `exclude_keywords`：标题、类型、标签里包含/排除的词。
- `min_price` / `max_price`：价格范围（英镑），默认 £60–£1500，过滤掉便宜的小包。
- `watchlist`：特别想要的商品。`handle` 是商品网址 `uk.topps.com/products/<handle>` 的最后一段；`quantity` 是加购数量；`always_hot: true` 表示一直 5 秒检查一次（慎用）。
- `schedule`：已知的开卖时间（英国时间），触发倒计时提醒和高频检查。
- `auto_open_checkout`：有货时是否自动打开结账页。**Mac 浏览器请保持 Topps 账号已登录**，并在账户里存好地址和付款方式，这样结账页只需确认。

## 开机自动后台运行

```bash
# 先把 plist 里的 /Users/你的用户名/topps 改成实际路径
cp topps_monitor/com.topps.monitor.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.topps.monitor.plist
# 停止：launchctl unload ~/Library/LaunchAgents/com.topps.monitor.plist
```

`caffeinate -i` 会阻止 Mac 空闲睡眠。建议在 系统设置 → 电池/能源 中设置“接电源时防止自动睡眠”。日志在 `topps_monitor/monitor.log`。

## 抢购小贴士

1. 开卖前把 Topps 账号登录好、地址和支付方式（Apple Pay / PayPal 最快）提前保存。
2. 大发售常有排队页面和人机验证 —— 本程序**不会绕过**，收到“网站访问受限”通知时请手动打开网站排队。
3. 发售日期可关注 Topps 官方社交媒体，发现后填进 `schedule`。

## 关于第二阶段（全自动）

全自动下单技术上可以做（用浏览器自动化在你自己的账号里完成付款），但 Topps 的条款很可能禁止机器人下单，被识别后订单可能被取消或账号被封；遇到排队和验证码也仍需人工。建议先用半自动跑几次发售，看看速度是否够用再决定。

## 常见问题

- **`No module named 'topps_monitor'`**：要在项目根目录（能看到 `topps_monitor` 文件夹的那一层）运行，并确认下载的是 `claude/zealous-hopper-uqjrv6` 分支。
- **`CERTIFICATE_VERIFY_FAILED`**：程序已自动使用 macOS 系统证书；若仍报错，运行一次 `open "/Applications/Python 3.13/Install Certificates.command"`。

## 测试

```bash
python3 -m unittest discover -s tests -t .
```
