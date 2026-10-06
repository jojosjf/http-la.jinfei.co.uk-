# 钢铁战线（暂定名）

一款 2D 像素风、回合制方格战棋的**原创**机器人 SRPG，核心玩法对标《第四次超级机器人大战》/《超级机器人大战 F·F 完结篇》。网页优先，Phaser 3 + TypeScript。

## 在线试玩

正式网址走 GitHub Pages，由 `.github/workflows/deploy.yml` 在推送到 `master` 时自动构建发布：

1. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**（只需一次）。
2. 把开发分支合并到 `master`（或在 Actions 页手动运行 Deploy to GitHub Pages）。
3. 几分钟后访问 https://jojosjf.github.io/http-la.jinfei.co.uk-/ 。想用自己的域名（如 la.jinfei.co.uk）在 Pages 设置里填 Custom domain 并加一条 CNAME 记录即可。

## 运行

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5173
pnpm check      # typecheck + lint + 单元测试 + 构建
pnpm e2e        # Playwright 自动试玩
```

操作：方向键 / 鼠标移动光标，Z / 回车 / 左键 确定，X / Esc / 右键 取消，E 结束回合，R 结束后重开。`?seed=123` 固定随机种子。

## 文档

- 制作计划、技术选型、资源清单、分工与任务表：[docs/game-plan.md](docs/game-plan.md)
- 美术规格：[docs/art-spec.md](docs/art-spec.md)
- 给 Claude Code 的项目约定：[CLAUDE.md](CLAUDE.md)

## 当前状态

垂直切片进行中（M1）：第 1 关「河畔遭遇战」3 vs 5，占位美术（地图已是按邻接关系程序化绘制的版本：水岸、木桥、道路、树林、建筑、机库）。已实现地图 / 地形、移动范围与寻路、武器射程与 P 武器、命中 / 伤害 / CT / 气力 / 地形适应 / 尺寸 / 限界公式、反击 / 防御 / 回避、地图上的战斗演出 v0、敌方 AI v0、胜负判定、HUD 与战斗预览。
