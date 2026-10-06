# 给美术 AI 的素材交付说明（可直接粘贴）

> 用法：把下面「=== 开始 ===」到「=== 结束 ===」之间的内容整段发给负责出图的 ChatGPT。它回传的文件交给 Claude Code 导入即可。

=== 开始 ===

你在为一款**原创**的 2D 像素风机器人战棋游戏（网页端，Phaser 引擎，内部分辨率 480×270 整数倍放大）提供机体素材。程序这边已经写好导入管线，请严格按下面的格式交付，这样你已有的像素机器人和攻击、受伤等动作可以直接用，不用重画。

## 一、每台机体需要的东西

| 用途 | 规格 | 动作 |
|---|---|---|
| 战斗立绘 | 透明 PNG，画布 128×128（特大型 LL 用 160×160），机体**朝右**站立，脚底中心对准画布底边中点（x=64, y=128） | idle 待机 2 帧、shoot 射击 3 帧、melee 格斗 3 帧、hit 受击 2 帧、down 击坠 1 帧 |
| 地图图标 | 32×32，朝右，底部留 3 像素空白给血条 | 待机 2 帧（轻微浮动或推进器闪烁） |
| 设定 | 20 字以内：名称、阵营、尺寸级别 S/M/L/LL、真实系或超级系、主色 | — |

动作可以多（比如 special 必杀、defend 防御），但上面 5 个必须有；缺的程序会自动用 idle 代替。

## 二、硬性规则（不满足就无法导入）

1. **真像素**：1 个图片像素 = 1 个游戏像素。如果你只能输出放大过的图，必须是干净的整数倍（如 4×），文件名加 `@4x`，并且放大后不能有模糊或半像素。
2. **真透明背景**：PNG 带 Alpha 通道。不要白底、不要粉底、不要画一个棋盘格当背景。
3. **禁止**抗锯齿、渐变、模糊、投影、外发光、噪点。颜色每台机体不超过 16 色，外加 1 像素深色轮廓。
4. **同一机体所有帧用同一画布尺寸**，身体不要在帧与帧之间漂移，不要自动裁切空白。
5. **原创**：不得出现任何现有动画、游戏、模型品牌的机体名称、标志、配色组合或可辨认的剪影。
6. 同系列量产机可以用同一张图换色；请把「主色 / 副色 / 发光色」分在不同的色值上，方便程序换色。

## 三、交付格式（二选一）

### 方式 A：整帧精灵表（你已有整台机体的动作帧时用这个）

1. 一张 `<机体id>_sheet.png`：每格 128×128，**一行一个动作，一列一帧**，行顺序固定为 idle、shoot、melee、hit、down；一行内帧数不够的格子留透明。
2. 一个 `<机体id>_sheet.json`：

```json
{
  "id": "cangqiong",
  "image": "cangqiong_sheet.png",
  "cell": [128, 128],
  "origin": [64, 128],
  "poses": { "idle": 2, "shoot": 3, "melee": 3, "hit": 2, "down": 1 },
  "fps": { "idle": 3, "shoot": 8, "melee": 8, "hit": 8, "down": 4 },
  "muzzle": [110, 56]
}
```

`muzzle` 是 shoot 第 1 帧里枪口的像素坐标（光束和子弹从这里飞出），没有远程武器就不写。

### 方式 B：按部件分层（新机体推荐，能做更多动作组合）

部件名固定用英文：`backpack` 背包、`legs` 双腿、`arm_back` 后臂、`torso` 躯干、`head` 头、`arm_front` 前臂、`weapon_main` 主武器、`weapon_melee` 近战武器；可加 `shield`、`wing`。

- 每个部件一张透明 PNG，按部件本身大小裁切，不留多余空白，朝右。
- 一个 `parts.json`，写每个部件在 128×128 画布上的左上角坐标和叠放顺序（数字小的在下面）：

```json
{
  "id": "cangqiong",
  "canvas": [128, 128],
  "origin": [64, 128],
  "parts": {
    "backpack":    { "file": "backpack.png",    "pos": [44, 42], "z": 0 },
    "legs":        { "file": "legs.png",        "pos": [42, 78], "z": 1 },
    "arm_back":    { "file": "arm_back.png",    "pos": [36, 48], "z": 2 },
    "torso":       { "file": "torso.png",       "pos": [46, 44], "z": 3 },
    "head":        { "file": "head.png",        "pos": [54, 27], "z": 4 },
    "arm_front":   { "file": "arm_front.png",   "pos": [76, 48], "z": 5 },
    "weapon_main": { "file": "rifle.png",       "pos": [100, 47], "z": 6, "hidden": true }
  },
  "muzzle": { "part": "weapon_main", "at": [36, 5] }
}
```

- 动作不用你做帧动画：程序会按「每帧把某个部件平移几像素 / 换一张部件图 / 显示或隐藏」来演，所以只要额外提供需要换图的部件变体即可，例如 `arm_front_aim.png`（抬枪的前臂）、`legs_run.png`。
- 如果你用 Aseprite：一个图层一个部件，一个 Tag 一个动作，Slice 命名 `muzzle@weapon_main`，用下面的命令导出，程序会自动转换：

```
aseprite -b <id>.aseprite --split-layers --trim --list-layers --list-tags --list-slices --filename-format "{layer}#{frame}" --format json-array --sheet <id>.png --data <id>.ase.json
```

## 四、命名与打包

- 机体 id 用小写英文加下划线，敌方加 `e_` 前缀：`cangqiong`、`e_quanya`。
- 目录结构：`mechs/<id>/` 内放 `<id>_sheet.png` + `<id>_sheet.json`（方式 A）或 `parts/*.png` + `parts.json`（方式 B），加上 `<id>_icon.png`（64×32，两帧并排）。
- 每批交付附一张所有机体的总览图（contact sheet）方便快速检查。

## 五、交付前自检

- [ ] 背景真透明　- [ ] 1:1 像素或标明整数倍　- [ ] 没有抗锯齿和渐变
- [ ] 全部朝右　- [ ] 脚底在底边中点　- [ ] 每帧画布尺寸一致　- [ ] 动作行顺序正确
- [ ] JSON 能被解析、`id` 与文件名一致　- [ ] 没有任何版权机体的痕迹

=== 结束 ===

## 六、部件已经拆好时：先这样问（可直接粘贴）

=== 提问开始 ===

我们的程序是「布娃娃」渲染：每个部件一张图层，动作 = 每帧对部件做整数像素平移、换图、显隐，不做旋转缩放。你已经把机体拆成部件了，很好。为了让程序直接导入，请先回答下面 11 个问题，并先发**一台完整的样例机体**（所有部件、所有动作、以及你现有的任何说明文件，原样打包），确认导入没问题后再批量给。

1. **清单**：现在有哪些机体？每台的部件列表（文件名、像素尺寸）。
2. **坐标系**：部件图是「整画布同尺寸、位置已对齐」（例如全部 128×128，其余透明），还是「按部件紧裁切」？如果是紧裁切，每个部件在画布上的左上角坐标是多少？画布多大？脚底中心在哪个像素？
3. **叠放顺序**：从底到顶列出部件顺序（例如 backpack → legs → arm_back → torso → head → arm_front → weapon）。
4. **动作怎么表达**，三选一：A 每帧每个部件的位移 / 换图 / 显隐表；B 每个部件每帧一张整画布 PNG（如 `torso_shoot_1.png`）；C 只有合成后的整帧图。A 或 B 最好；C 也能用，但做不了部件级动作。
5. **部件变体**：哪些部件有多张图（抬枪的手臂、张开的手、受损的躯干等）？分别用在哪些动作？
6. **武器与挂点**：武器是独立部件吗？枪口像素坐标（光束 / 子弹起点）、持握点坐标？近战武器有没有单独的挥砍帧？
7. **像素比例**：是 1:1 真像素吗？若放大过，倍数是多少？有没有抗锯齿或半透明边缘？
8. **配色**：每台机体的主色 / 副色 / 发光色色值？是否方便做换色量产机？
9. **朝向**：全部朝右还是朝左？左右是否对称（有没有单侧武器、不对称肩甲）？
10. **地图图标**：有没有 32×32 小图标？没有的话能否按同一配色出 2 帧待机？
11. **现有描述文件**：你那边已有的任何 JSON / TXT / 表格（部件位置、动画表、调色板）请原样给我，我来适配格式，不需要你改。

回答尽量用表格或 JSON。文件按 `mechs/<机体id>/` 目录打包，机体 id 用小写英文加下划线（敌方加 `e_` 前缀）。如果你能直接输出下面这个 manifest 就最省事：

```json
{
  "id": "cangqiong",
  "canvas": [128, 128],
  "origin": [64, 128],
  "facing": "right",
  "scale": 1,
  "parts": {
    "torso":       { "file": "torso.png",     "pos": [46, 44], "z": 3 },
    "arm_front":   { "file": "arm_front.png", "pos": [76, 48], "z": 5, "variants": { "aim": "arm_front_aim.png" } },
    "weapon_main": { "file": "rifle.png",     "pos": [100, 47], "z": 6, "hidden": true, "muzzle": [36, 5] }
  },
  "poses": {
    "idle":  { "fps": 3, "loop": true,  "keys": [ {}, { "torso": { "dy": 1 } } ] },
    "shoot": { "fps": 8, "loop": false, "keys": [
      { "arm_front": { "variant": "aim" }, "weapon_main": { "hidden": false } },
      { "arm_front": { "variant": "aim", "dx": -2 }, "weapon_main": { "hidden": false, "dx": -3 } },
      { "arm_front": { "variant": "aim" }, "weapon_main": { "hidden": false } }
    ] }
  },
  "palette": { "main": "#4aa3ff", "sub": "#2f74c4", "glow": "#7ff0ff" }
}
```

`pos` 是部件左上角在画布上的坐标；`keys` 每帧只写有变化的部件：`dx` / `dy` 位移（右为正、下为正，单位像素）、`variant` 换图、`hidden` 显隐。

=== 提问结束 ===

## 给我们自己的备注

- 方式 A 的文件用 `node tools/sheet-to-doll.mjs public/mechs/<id>/<id>_sheet.json` 转成 `doll.json`，再登记到 `public/mechs/index.json`。
- 方式 B 的 `parts.json` / 第六节的 manifest 由 Claude Code 转成 `doll.json`（结构见 `public/mechs/cangqiong/`）；如果对方给的是「整画布对齐的部件逐帧 PNG」，Claude 用边界框自动算出位置和每帧位移（需要时加一个 PNG 解码依赖写转换脚本）。
- AI 出图常见问题：假像素（网格不齐、抗锯齿）、白底、尺寸不一致。收到后先在 `?view=dolls` 预览页检查；如需清洗（网格对齐、量化颜色、抠底）告诉 Claude 写工具。
