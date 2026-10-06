# 钢铁战线（暂定名）— 项目说明给 Claude Code

2D 像素风回合制机器人 SRPG，对标《超级机器人大战 F 完结篇》的系统。网页优先（Phaser 3 + TypeScript + Vite）。
全部机体 / 角色 / 剧情必须原创，不得使用任何版权作品的名称、设定或剪影。

## 常用命令

```bash
pnpm dev          # 开发服务器 http://127.0.0.1:5173
pnpm check        # typecheck + lint + 单元测试 + 构建（提交前必须通过）
pnpm e2e          # Playwright 自动试玩（云端容器用 /opt/pw-browsers/chromium）
pnpm test:watch   # Vitest 监听模式
```

## 目录约定

- `src/core/` 纯逻辑，**不得 import Phaser**：网格、寻路、射程、战斗公式、气力、单位状态。所有规则改动都要配单元测试。
- `src/data/` 静态数据 JSON（地形 / 机体 / 驾驶员 / 武器 / 关卡）+ `validateData()` 交叉校验。数值改动只改 JSON，不改代码。
- `src/ai/` 敌方 AI 与防御选择，只依赖 core。
- `src/scenes/` Phaser 场景：`BootScene` 程序化生成占位贴图；`MapScene` 玩家阶段状态机、敌方阶段、地图上的战斗演出 v0。
- `src/ui/Hud.ts` 固定在屏幕上的面板、菜单、预览、横幅。
- `tests/unit/` Vitest；`tests/e2e/` Playwright，通过 `window.__srpg`（见 `src/debug.ts`）读取状态并操控光标。
- `docs/game-plan.md` 总体制作计划与任务表；`docs/art-spec.md` 美术规格。

## 设计规则

- 内部分辨率 480×270，整数倍缩放，`pixelArt: true`；地图格 32×32。
- 字体用 Fusion Pixel 12px（OFL），UI 文案中文。
- 数值公式以 `docs/game-plan.md` §6 为准，改公式先改文档再改 `src/core/battle.ts` 和测试。
- 占位美术的贴图 key 约定：`tile_<terrainId>`、`unit_<unitId>`、`cursor`、`team_player`、`team_enemy`。正式像素图按同名 key 替换即可。
- 提交前运行 `pnpm check`；涉及场景交互的改动再跑 `pnpm e2e`。
