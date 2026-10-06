# 美术规格书 v0.1（给像素师）

> 目标风格：PS/SS 时代 SRW 的 2D 像素感，但按 16:9 现代屏幕排版。所有资源为 PNG，透明背景，**禁止抗锯齿、禁止半透明像素**（UI 面板除外）。

## 基础参数

| 项目 | 规格 |
|---|---|
| 内部分辨率 | 480×270，整数倍放大显示 |
| 地图格 | 32×32 px |
| 调色板 | 每张机体图 ≤ 16 色（含轮廓色 #0b0c10）；全局基础色板后续由美术定稿 |
| 轮廓 | 机体与头像 1px 深色轮廓 |
| 命名 | 全小写英文 + 下划线：`unit_<id>_map.png`、`unit_<id>_battle.png`、`portrait_<id>_<expr>.png`、`tile_<env>.png` |
| 导出 | Aseprite 导出 PNG 序列或精灵表 + JSON（数组格式）；帧数见下 |

## 资源类别

### 1. 机体地图图标（map icon）
- 尺寸 32×32，机体占 28×26 以内，底部预留 3 px 给 HP 条。
- 帧：待机 2 帧（轻微上下浮动 / 推进器闪烁）。朝向只画朝右，程序镜像翻转得到朝左。
- 敌我同机型用换色（palette swap）即可，请把「主色 / 副色 / 发光色」分在独立色值上方便替换。

### 2. 机体战斗立绘（battle sprite）
- 尺寸 128×128（S/M/L 尺寸机体）、160×160（LL 与母舰）。朝右画，程序镜像。
- 帧：待机 2、被击中 1、被击坠 1；每把武器攻击动作 4–6 帧。首批只画「待机 + 1 个代表性攻击动作」。
- 武器发射点在 JSON 中标注坐标（程序据此生成光束 / 导弹特效）。

### 3. 驾驶员头像
- 64×64，胸像，朝向稍偏右。表情：普通、愤怒、受伤、笑（首批只要普通 + 受伤）。

### 4. 地图地块（tileset）
- 32×32，按环境分套：平原 / 森林 / 山地 / 市街 / 基地 / 道路 / 海 / 河川；后续宇宙与月面。
- 需要 4 方向连接的地块（森林、山地、海岸、河岸、道路）请提供 47-tile 自动拼接 blob 集或至少 16-tile 集。

### 5. 特效
- 光束（线 + 命中火花）、导弹（弹体 + 尾烟 + 爆炸）、格斗斩击、护盾、爆炸（击坠用，大 48×48 ×8 帧）。

### 6. UI
- 面板 9-slice（含四角 / 边 / 中心），光标 4 角框，范围格纹理（移动蓝 / 攻击红），精神指令图标 16×16 ×30，地形图标 16×16。

## 占位期约定
程序目前用 `src/art/mapArt.ts` 按邻接关系程序化绘制整张地图（草地色块、河岸沙滩、木桥、道路连接、树林、建筑、机库 / 停机坪），机体图标由 `src/scenes/BootScene.ts` 生成。正式地块到位后改为 Tiled 图层渲染；机体 / 光标按贴图 key 替换：`unit_<unitId>`、`cursor`、`team_player`、`team_enemy`。


## 机体导入：天工仙甲骨架原型（当前采用）

外部美术交付的是 `mecha-ragdoll-v1`：每台机甲一张 4×4 透明部件图集 + `rigs/<id>.json`（部件中心、显示尺寸、层级、质量、关节锚点和角度范围）。导入：

```bash
node tools/import-rig.mjs <mecha-ragdoll-v1 目录> zhaoye      # 不写 id 就导入全部 24 台
```

脚本会把部件缩到游戏尺寸（默认 rig 坐标 ×0.32，最高 140px）、硬化透明边、全机统一 48 色、武器在左的机体整体镜像让武器朝前，打包成 `public/mechs/<id>/<id>.png` + `<id>.rig.json` + `icon.png`，登记到 `index.json`，并逐台报告越界和缺件。动作由 `src/core/rig.ts` 的通用动作库驱动，击坠和武器脱手走 Matter 刚体。检查：`?view=dolls`（骨架、动作、击坠）和 `?view=battle&a=zhaoye&d=e_liaoya&kill=1`（战斗画面）。

## 机体导入格式（布娃娃系统）

> 给外部美术 / 美术 AI 的可粘贴版说明：`docs/art-brief-for-chatgpt.md`。

游戏里的机体是**布娃娃**：头、躯干、手臂、腿、背包、武器各是一张图层，动作 = 每帧对部件做整数平移 / 换帧 / 显隐，没有旋转缩放，像素不会糊。
一台机体放在 `public/mechs/<id>/`，并在 `public/mechs/index.json` 登记：

```json
{ "dolls": [ { "id": "cangqiong", "doll": "mechs/cangqiong/cangqiong.doll.json", "icon": "mechs/cangqiong/icon.png" } ] }
```

`id` 必须等于 `src/data/units.json` 里的机体 id；`icon` 可选（32×32 地图图标，替换占位）。没有登记的机体继续用程序生成的占位方块。

### 推荐交付方式 A：Aseprite 源文件按约定导出

1. 一个 `.aseprite`，画布建议 128×128（LL 级 160×160），机体朝右站立，脚底中心在画布底边中点。
2. **一个图层 = 一个部件**，图层名用英文：`backpack` `legs` `arm_back` `torso` `head` `arm_front` `rifle` `saber`……图层顺序就是叠放顺序（下面的先画）。以 `_` 开头的图层会被忽略（参考线、草稿）。
3. **一个 Tag = 一个动作**，必须有 `idle`；战斗用到 `idle` `shoot` `melee` `hit` `down`，缺的会退回 `idle`。每个动作 1–6 帧即可。
4. 挂点用 Slice，命名 `挂点@部件`，例如 `muzzle@rifle`（枪口，光束 / 子弹从这里出发）。
5. 导出命令（也可在导出对话框里勾同样的选项）：

```bash
aseprite -b cangqiong.aseprite --split-layers --trim --list-layers --list-tags --list-slices \
  --filename-format '{layer}#{frame}' --format json-array \
  --sheet cangqiong.png --data cangqiong.ase.json
node tools/aseprite-to-doll.mjs cangqiong.ase.json public/mechs/cangqiong/cangqiong.doll.json cangqiong
```

转换脚本会把图层变成部件、Tag 变成动作、Slice 变成挂点，并自动算出每帧的位移。

### 交付方式 A2：整帧精灵表（已有整台机体动作帧时）

一行一个动作、一列一帧的 `<id>_sheet.png` + `<id>_sheet.json`，用 `node tools/sheet-to-doll.mjs <id>_sheet.json` 转成单部件布娃娃。字段说明见 `docs/art-brief-for-chatgpt.md` 方式 A。

### 交付方式 B：一部件一张 PNG

不用 Aseprite 时，把每个部件单独导出成透明 PNG（朝右，不要留多余空白），告诉我每个部件在 128×128 画布上的左上角位置和叠放顺序，我来写 `doll.json`。`public/mechs/cangqiong/` 就是这种形式的样例，直接照抄结构即可。

### doll.json 结构速览

```json
{
  "id": "cangqiong", "version": 1,
  "canvas": { "w": 128, "h": 128 }, "origin": { "x": 64, "y": 128 },
  "parts":   { "head": { "z": 4, "pivot": { "x": 0, "y": 0 }, "frames": [ { "image": "head.png", "x": 0, "y": 0, "w": 20, "h": 20 } ] } },
  "layout":  { "head": { "x": 54, "y": 27 } },
  "sockets": { "muzzle": { "part": "rifle", "x": 36, "y": 5 } },
  "poses":   { "idle": { "fps": 3, "loop": true, "keys": [ {}, { "head": { "dy": 1 } } ] } }
}
```

`frames` 可以指向一张总表（配合 `image` 字段和 x/y 裁切）或各自的 PNG。`layout` 是每个部件 pivot 在画布上的静止位置；`keys` 里每帧只写有变化的部件：`dx` `dy` 位移、`frame` 换帧、`hidden` 显隐。

### 检查方法

启动后访问 `?view=dolls` 进入机体预览页：左右键切换机体，上下键切换动作，F 翻转，G 显示画布框和原点。`pnpm test` 会校验 `public/mechs` 下每个 doll.json 的引用是否完整。
