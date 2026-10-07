云衡 · 修仙者拆件与动作样例 v1

本包只包含一位成年修仙者云衡；全身概念已确认，当前拆件属于第一轮程序实验素材。
图像使用内置 image_gen，根据已确认的云衡全身参考分别生成身体、衣物装备拆件。
生成提示词与来源在 generation-record.json，原始拆件图在 original/。

入口：index.html。
启动：进入本目录，运行 python3 -m http.server 8766 --bind 127.0.0.1
打开 http://127.0.0.1:8766/
检查：node verify.cjs

characters.json：角色清单，已有 id/name/parts/image_size/alpha_channel/atlas 字段保持含义。
rigs/yunheng.json：bodies 中 id/tile/x/y/w/h/mass/layer 与 joints 中 a/b/anchor/min/max/detachable 保持原含义。
图集为 4 列 × 8 行，1280×2560，32 个素材槽。atlasColumns=4、atlasRows=8。
不可将 atlasRows 写死为 4。tile 索引从左到右、从上到下。
atlas-regions.json：每个 tile 在最终图集中的源裁取矩形 x/y/w/h，另附原始裁切尺寸；按 tile 顺序排列。
parts/：32 张独立紧裁切透明 PNG，原始裁切尺寸不等于 Rig 的显示尺寸。
atlas-regions 使用图集像素；Rig 使用预览逻辑像素。两种 x/y/w/h 含义不可混用。
Rig bodies.x/y 是部件中心位置；joints.anchor 是 Rig 坐标系中连接点。角度单位弧度。
layer 从小到大绘制，同层保持 bodies 原顺序。
本样例沿用视图左侧 l、视图右侧 r 的部件命名；不能直接当成解剖学左右。

程序动作：motion.js。createMotion(Matter, simulation) 返回状态与动作接口：
start('idle'|'walk'|'slash'|'hurt')；pose(dt) 更新骨架；disableArm()；dropWeapon()；fall()。
motion.legDisabled=true 时行走速度降低并使用跛行姿态。
站姿按两只鞋底定位到 y=585；不能让下垂武器的最低点决定人物站立高度。
待机发带、头发与衣摆轻晃；行走身体摆动、衣物装备跟随；挥剑为肩肘和武器骨架关键帧；受击后仰。
持剑臂失灵时上臂、前臂、宽袖、武器切为局部动态，身体继续由动画控制；不能继续挥剑。
脱手只解除 weapon 的关节；全身倒地调用 sim.activate() 进入 Matter 刚体。
动作不是逐帧替换图片，需支持平移、旋转、显示尺寸与浮点计算；绘制位置取整、最近邻采样。

损伤：injury.js。cut(body, worldPoint, 'tear'|'bleed') 写入局部伤口；paint(ctx, body) 绘制破衣、皮肤和血迹。
伤痕跟随所属部件，不修改源 PNG；重新拼装清空损伤。
点击衣物/四肢可定位损伤。累计衣袖/持剑侧手臂伤害 >=0.7 触发失灵。
绘制皮肤是局部遮罩内的像素效果，不是完整人体底层解剖或多层服装模拟。
流血为少量视觉粒子，无伤口组织或爆炸解体特效。

当前限制：
1. 拆件为重新生成的独立素材，不是完整概念图的无损切片；像素密度和接缝仍需正式美术校正。
2. 衣袖、衣摆、发带用轻量刚体/铰接近似，不是软布料物理；同一角色关闭内部碰撞。
3. 碰撞体为简化矩形，不随衣物裂口或皮肤划伤重建。
4. 仅有一个朝向的基础贴图，没有背面、完整八方向或逐帧手绘挥剑变体。
5. 不含全套战斗 AI、正式引擎接入或其余 19 人拆件。

交给 Claude 时，请先验证：
32 槽位裁取和层级 -> 站姿鞋底原点 -> 待机/走路/挥剑/受击 -> 衣袖破损跟随 -> 持剑臂失灵 -> 脱手和全身倒地。
第一次导入请截图对比本包的 preview.jpg；先排除裁取坐标和显示尺寸混用，再调整视觉比例。
