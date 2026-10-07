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
- `src/art/` 程序化地图绘制：`mapArt.ts` 按邻接关系把整张地图画进一张 CanvasTexture（水岸、桥、道路连接、树林、建筑、机库），调色板在 `palette.ts`。布娃娃机体：`dollRegistry.ts` 读 `public/mechs/index.json` 并加载每台机体的 doll.json 与 PNG；`dollActor.ts` 把布娃娃（或占位方块）渲染成战斗画面用的 `BattleActor`。
- `src/core/rig.ts` 骨架机体格式 rig v2（来自「天工仙甲」原型：部件中心 + 关节锚点 + 角度限制）、通用动作库 `POSE_LIBRARY`（idle / walk / melee / shoot / block / hit；`_W` `_O` 表示持武器侧 / 另一侧，`held_W` `held_O` 表示该侧手持物，手持物 = 用可脱落关节挂在手上的部件，见 `heldParts()`）、动作采样与前向运动学，纯逻辑。`src/art/rigActor.ts` 渲染骨架并在击坠 / 武器脱手时切换为 Matter 刚体布娃娃（场景需开 Matter 且 `autoUpdate: false`，在 update 里调 `stepRagdolls`）。`tools/import-rig.mjs <原型目录> [id...]` 把原型的 4×4 图集 + rigs/*.json 转成 `public/mechs/<id>/`（缩到游戏尺寸、硬化透明边、统一调色板、武器侧朝前、生成 32×32 地图图标），并报告越界 / 缺件；连不上根部的部件自动剔除。24 台已全部导入 `public/mechs/`，`tests/unit/mechs.test.ts` 逐台校验。
- `src/core/doll.ts` 布娃娃格式（部件 / 布局 / 挂点 / 动作）、校验与姿势解析，纯逻辑。`tools/aseprite-to-doll.mjs` 把 Aseprite 导出转成 doll.json；`tools/sheet-to-doll.mjs` 把整帧精灵表（一行一动作）转成单部件布娃娃；`tools/gen-sample-doll.mjs` 生成样例机体 `public/mechs/cangqiong`。外部美术交付说明在 `docs/art-brief-for-chatgpt.md`。导入规范见 `docs/art-spec.md`「机体导入格式」。
- `src/scenes/` Phaser 场景：`BootScene` 程序化生成机体 / 光标占位贴图；`MapScene` 玩家阶段状态机、敌方阶段、先结算后演出（`applyStrike` → `BattleScript`）；`BattleScene` 切出式战斗画面（双方机体走 `createActor()`：骨架 rig 优先，其次布娃娃，最后占位 `mech_<unitId>`；击坠时骨架机体散架成刚体残骸；HP/EN 面板、光束 / 弹幕 / 炮弹 / 格斗四类攻击动画、命中 / 回避 / 防御 / 击坠效果，按确认键 25 倍速快进，可在系统菜单里关闭，设置存 localStorage）。
- `src/scenes/DollViewerScene.ts` 机体预览页（`?view=dolls`，D 击坠 / S 断臂击坠 / W 武器脱手）；`src/scenes/battleDemo.ts` 战斗演示（`?view=battle&a=<机体>&d=<机体>&w=<武器>&kill=1`），给美术检查导入结果。
- `src/ui/Hud.ts` 固定在屏幕上的面板、菜单、预览、横幅。
- `tests/unit/` Vitest；`tests/e2e/` Playwright，通过 `window.__srpg`（见 `src/debug.ts`）读取状态并操控光标。
- `docs/game-plan.md` 总体制作计划与任务表；`docs/art-spec.md` 美术规格。

## 设计规则

- 内部分辨率 480×270，整数倍缩放，`pixelArt: true`；地图格 32×32。
- 字体用 Fusion Pixel 12px（OFL），UI 文案中文。
- 数值公式以 `docs/game-plan.md` §6 为准，改公式先改文档再改 `src/core/battle.ts` 和测试。
- 占位美术的贴图 key 约定：`unit_<unitId>`、`cursor`、`team_player`、`team_enemy`；地图整张由 `renderMapTexture()` 生成（key `map_<scenarioId>`）。正式像素图按同名 key 替换；正式地块到位后把 `mapArt.ts` 换成 Tiled 图层渲染。
- HUD 文字统一用 `TEXT_STYLE`（Fusion Pixel 12px 粗体 + 1px 阴影），面板用 `drawBox()`。
- 采用的美术是「天工仙甲」24 台（仙侠机甲）：0 照夜（主角）、1–10 同伴、11–20 敌人、21–23 Boss；机体 id 沿用原型拼音（如 `xuetang`），旧的 `e_*`、`cangqiong` 等占位机体只留给测试。规则层不随美术改变：部位破坏、断肢只做视觉，不影响 HP / 命中 / 伤害公式。
- 提交前运行 `pnpm check`；涉及场景交互的改动再跑 `pnpm e2e`。
