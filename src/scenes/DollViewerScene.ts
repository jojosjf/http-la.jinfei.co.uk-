import Phaser from 'phaser';
import { createActor, DollActor, ImageActor, type BattleActor } from '../art/dollActor';
import { dollRegistry } from '../art/dollRegistry';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadData } from '../data';
import { TEXT_STYLE } from '../ui/Hud';

declare global {
  interface Window {
    __dolls?: {
      ids: string[];
      current(): { id: string | null; pose: string | null; key: number };
      setPose(name: string): void;
      select(id: string): void;
    };
  }
}

/**
 * Artist preview page: `?view=dolls`. Shows each imported paper doll next to its placeholder,
 * cycles poses, draws the design canvas and origin. Left/Right = mech, Up/Down = pose,
 * F = flip, G = grid, Space = replay.
 */
export class DollViewerScene extends Phaser.Scene {
  private ids: string[] = [];
  private index = 0;
  private poseIndex = 0;
  private flip = false;
  private grid = true;
  private actor: BattleActor | null = null;
  private placeholder: BattleActor | null = null;
  private overlay!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('DollViewer');
  }

  create(): void {
    this.ids = dollRegistry.ids();
    const bg = this.add.graphics();
    bg.fillStyle(0x1b2a3a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x24364a, 1);
    for (let x = 0; x < GAME_WIDTH; x += 16) for (let y = (x / 16) % 2 ? 16 : 0; y < GAME_HEIGHT; y += 32) bg.fillRect(x, y, 16, 16);
    this.overlay = this.add.graphics().setDepth(20);
    this.info = this.add.text(8, 6, '', TEXT_STYLE).setDepth(30).setLineSpacing(2);
    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 14, '←→ 机体   ↑↓ 动作   F 翻转   G 网格   空格 重播', { ...TEXT_STYLE, color: '#cfd8dc' })
      .setOrigin(1, 0)
      .setDepth(30);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      switch (ev.code) {
        case 'ArrowRight':
          this.select(this.index + 1);
          break;
        case 'ArrowLeft':
          this.select(this.index - 1);
          break;
        case 'ArrowDown':
          this.setPoseIndex(this.poseIndex + 1);
          break;
        case 'ArrowUp':
          this.setPoseIndex(this.poseIndex - 1);
          break;
        case 'KeyF':
          this.flip = !this.flip;
          this.rebuild();
          break;
        case 'KeyG':
          this.grid = !this.grid;
          this.drawOverlay();
          break;
        case 'Space':
          this.rebuild();
          break;
        default:
          break;
      }
    });

    window.__dolls = {
      ids: this.ids,
      current: () => ({ id: this.currentId(), pose: this.currentPoseName(), key: this.poseIndex }),
      setPose: (name) => {
        const names = this.poseNames();
        const i = names.indexOf(name);
        if (i >= 0) this.setPoseIndex(i);
      },
      select: (id) => {
        const i = this.ids.indexOf(id);
        if (i >= 0) this.select(i);
      },
    };

    this.rebuild();
  }

  private currentId(): string | null {
    return this.ids[this.index] ?? null;
  }

  private poseNames(): string[] {
    const id = this.currentId();
    const doll = id ? dollRegistry.get(id) : undefined;
    return doll ? Object.keys(doll.def.poses) : [];
  }

  private currentPoseName(): string | null {
    return this.poseNames()[this.poseIndex] ?? null;
  }

  private select(i: number): void {
    if (this.ids.length === 0) return;
    this.index = ((i % this.ids.length) + this.ids.length) % this.ids.length;
    this.poseIndex = 0;
    this.rebuild();
  }

  private setPoseIndex(i: number): void {
    const n = this.poseNames().length;
    if (n === 0) return;
    this.poseIndex = ((i % n) + n) % n;
    this.rebuild();
  }

  private rebuild(): void {
    this.actor?.destroy();
    this.placeholder?.destroy();
    this.actor = null;
    this.placeholder = null;
    const id = this.currentId();
    if (!id) {
      this.info.setText('没有找到导入的机体。\n把 PNG + doll.json 放进 public/mechs/<id>/ 并登记到 public/mechs/index.json。');
      this.overlay.clear();
      return;
    }
    const doll = dollRegistry.get(id)!;
    const pose = this.currentPoseName() ?? 'idle';
    const scale = 1.5;
    const a = createActor(this, id, 150, 228, { scale, flip: this.flip });
    a.setDepth(10);
    a.play(pose as never);
    this.actor = a;
    const gd = loadData();
    if (gd.units[id] && this.textures.exists(`mech_${id}`)) {
      this.placeholder = new ImageActor(this, 360, 228, `mech_${id}`, { scale: 1, flip: this.flip });
      this.placeholder.setDepth(10);
      this.add.text(360, 236, '占位方块（对照）', { ...TEXT_STYLE, color: '#9ad0ff' }).setOrigin(0.5, 0).setDepth(30);
    }
    const p = doll.def.poses[pose];
    const unit = gd.units[id];
    this.info.setText(
      `${unit?.name ?? id}  [${this.index + 1}/${this.ids.length}]\n` +
        `动作 ${pose}  (${this.poseIndex + 1}/${this.poseNames().length})  ${p.keys.length} 帧  ${p.fps} fps${p.loop ? ' 循环' : ''}\n` +
        `部件 ${Object.keys(doll.def.parts).length}   画布 ${doll.def.canvas.w}x${doll.def.canvas.h}   原点 (${doll.def.origin.x},${doll.def.origin.y})`,
    );
    this.drawOverlay();
    void (a instanceof DollActor);
  }

  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const id = this.currentId();
    if (!id || !this.grid || !this.actor) return;
    const def = dollRegistry.get(id)!.def;
    const s = 1.5;
    const ox = this.actor.x;
    const oy = this.actor.y;
    const left = ox - def.origin.x * s;
    const top = oy - def.origin.y * s;
    g.lineStyle(1, 0x9ad0ff, 0.6);
    g.strokeRect(left + 0.5, top + 0.5, def.canvas.w * s, def.canvas.h * s);
    g.lineStyle(1, 0xffd60a, 0.9);
    g.lineBetween(ox - 6, oy, ox + 6, oy);
    g.lineBetween(ox, oy - 6, ox, oy + 6);
  }
}
