import Phaser from 'phaser';
import { createActor, ImageActor, type BattleActor } from '../art/dollActor';
import { dollRegistry } from '../art/dollRegistry';
import { addGround, RigActor, stepRagdolls } from '../art/rigActor';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { poseNames } from '../core/rig';
import { loadData } from '../data';
import { TEXT_STYLE } from '../ui/Hud';

declare global {
  interface Window {
    __dolls?: {
      ids: string[];
      current(): { id: string | null; pose: string | null; kind: 'rig' | 'doll' | null; ragdoll: boolean; follow: Record<string, number> };
      setPose(name: string): void;
      select(id: string): void;
      die(severe?: boolean): void;
      dropWeapon(): void;
      reset(): void;
      dash(dx: number): void;
    };
  }
}

const GROUND_Y = 236;
const SCALE_DOLL = 1.5;

/**
 * Artist preview page: `?view=dolls`. Shows each imported mech (skeletal rig or paper doll)
 * next to its placeholder. Left/Right = mech, Up/Down = pose, F = flip, G = frame,
 * D = destroy (ragdoll), S = destroy with severed arm, W = knock the weapon away, R = reset.
 */
export class DollViewerScene extends Phaser.Scene {
  private ids: string[] = [];
  private index = 0;
  private poseIndex = 0;
  private flip = false;
  private grid = true;
  private actor: BattleActor | null = null;
  private placeholder: BattleActor | null = null;
  private placeholderLabel: Phaser.GameObjects.Text | null = null;
  private overlay!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super({
      key: 'DollViewer',
      physics: {
        default: 'matter',
        matter: { gravity: { x: 0, y: 0.9 }, autoUpdate: false, enableSleeping: false, positionIterations: 10, velocityIterations: 8, constraintIterations: 10 },
      },
    });
  }

  update(_t: number, delta: number): void {
    stepRagdolls(this, delta);
  }

  create(): void {
    this.ids = dollRegistry.ids();
    const bg = this.add.graphics();
    bg.fillStyle(0x1b2a3a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x24364a, 1);
    for (let x = 0; x < GAME_WIDTH; x += 16) for (let y = (x / 16) % 2 ? 16 : 0; y < GAME_HEIGHT; y += 32) bg.fillRect(x, y, 16, 16);
    bg.fillStyle(0x2c3e50, 1);
    bg.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    bg.fillStyle(0x3d5266, 1);
    bg.fillRect(0, GROUND_Y, GAME_WIDTH, 1);
    addGround(this, GROUND_Y, GAME_WIDTH);
    this.overlay = this.add.graphics().setDepth(20);
    this.info = this.add.text(8, 6, '', TEXT_STYLE).setDepth(30).setLineSpacing(2);
    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 14, '←→角色 ↑↓动作 F翻转 D倒下 S重创 W兵器脱手 R复原', { ...TEXT_STYLE, color: '#cfd8dc' })
      .setOrigin(1, 0)
      .setDepth(30);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const k: Record<string, () => void> = {
        ArrowRight: () => this.select(this.index + 1),
        ArrowLeft: () => this.select(this.index - 1),
        ArrowDown: () => this.setPoseIndex(this.poseIndex + 1),
        ArrowUp: () => this.setPoseIndex(this.poseIndex - 1),
        KeyF: () => {
          this.flip = !this.flip;
          this.rebuild();
        },
        KeyG: () => {
          this.grid = !this.grid;
          this.drawOverlay();
        },
        KeyD: () => this.die(false),
        KeyS: () => this.die(true),
        KeyW: () => this.dropWeapon(),
        KeyR: () => this.rebuild(),
        Space: () => this.rebuild(),
      };
      k[ev.code]?.();
    });

    window.__dolls = {
      ids: this.ids,
      current: () => ({
        id: this.currentId(),
        pose: this.currentPoseName(),
        kind: this.kind(),
        ragdoll: this.actor instanceof RigActor && this.actor.isRagdoll,
        follow: this.followSnapshot(),
      }),
      dash: (dx: number) => {
        if (this.actor) this.tweens.add({ targets: this.actor.node, x: this.actor.x + dx, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
      },
      setPose: (name) => {
        const i = this.poseNames().indexOf(name);
        if (i >= 0) this.setPoseIndex(i);
      },
      select: (id) => {
        const i = this.ids.indexOf(id);
        if (i >= 0) this.select(i);
      },
      die: (severe = false) => this.die(severe),
      dropWeapon: () => this.dropWeapon(),
      reset: () => this.rebuild(),
    };

    this.rebuild();
  }

  private followSnapshot(): Record<string, number> {
    const a = this.actor;
    const id = this.currentId();
    const rig = id ? dollRegistry.getRig(id) : undefined;
    if (!(a instanceof RigActor) || !rig) return {};
    return Object.fromEntries((rig.def.follow ?? []).map((f) => [f, a.followAngle(f)]));
  }

  private currentId(): string | null {
    return this.ids[this.index] ?? null;
  }

  private kind(): 'rig' | 'doll' | null {
    const id = this.currentId();
    if (!id) return null;
    return dollRegistry.getRig(id) ? 'rig' : 'doll';
  }

  private poseNames(): string[] {
    const id = this.currentId();
    if (!id) return [];
    const rig = dollRegistry.getRig(id);
    if (rig) return poseNames(rig.def);
    const doll = dollRegistry.get(id);
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
    if (this.actor instanceof RigActor && !this.actor.isRagdoll) {
      this.actor.play(this.currentPoseName() ?? 'idle');
      this.refreshInfo();
    } else {
      this.rebuild();
    }
  }

  private die(severe: boolean): void {
    const a = this.actor;
    if (!(a instanceof RigActor) || a.isRagdoll) return;
    a.collapse(this.flip ? 1 : -1, severe);
    this.refreshInfo();
    // 修士 fade into light after falling; constructs and beasts stay as wreck / body.
    if (a.species === 'human') this.time.delayedCall(900, () => void a.dissolve(900));
  }

  private dropWeapon(): void {
    if (this.actor instanceof RigActor) this.actor.drop('weapon');
  }

  private rebuild(): void {
    this.actor?.destroy();
    this.placeholder?.destroy();
    this.placeholderLabel?.destroy();
    this.actor = null;
    this.placeholder = null;
    this.placeholderLabel = null;
    const id = this.currentId();
    if (!id) {
      this.info.setText('没有找到导入的角色。\n运行 node tools/import-rig.mjs <原型目录> 或把 doll.json 登记到 public/mechs/index.json。');
      this.overlay.clear();
      return;
    }
    const pose = this.currentPoseName() ?? 'idle';
    const isRig = this.kind() === 'rig';
    const a = createActor(this, id, 150, GROUND_Y, { scale: isRig ? 1 : SCALE_DOLL, flip: this.flip });
    a.setDepth(10);
    a.play(pose as never);
    this.actor = a;
    const gd = loadData();
    if (gd.units[id] && this.textures.exists(`mech_${id}`)) {
      this.placeholder = new ImageActor(this, 380, GROUND_Y, `mech_${id}`, { scale: 1, flip: this.flip });
      this.placeholder.setDepth(10);
      this.placeholderLabel = this.add.text(380, GROUND_Y + 4, '占位方块（对照）', { ...TEXT_STYLE, color: '#9ad0ff' }).setOrigin(0.5, 0).setDepth(30);
    }
    this.refreshInfo();
    this.drawOverlay();
  }

  private refreshInfo(): void {
    const id = this.currentId();
    if (!id) return;
    const unit = loadData().units[id];
    const rig = dollRegistry.getRig(id);
    const pose = this.currentPoseName() ?? 'idle';
    const head = `${unit?.name ?? rig?.def.name ?? id}  [${this.index + 1}/${this.ids.length}]`;
    if (rig) {
      const state = this.actor instanceof RigActor && this.actor.isRagdoll ? '布娃娃物理' : `动作 ${pose} (${this.poseIndex + 1}/${this.poseNames().length})`;
      const kind = { human: '修士', construct: '机关傀儡', beast: '神兽' }[rig.def.species ?? 'construct'];
      this.info.setText(`${head}  ${kind}\n${state}\n部件 ${rig.def.parts.length}  关节 ${rig.def.joints.length}  随动 ${rig.def.follow?.length ?? 0}  高 ${rig.def.height}px`);
      return;
    }
    const doll = dollRegistry.get(id)!;
    const p = doll.def.poses[pose];
    this.info.setText(
      `${head}  布娃娃\n动作 ${pose}  (${this.poseIndex + 1}/${this.poseNames().length})  ${p.keys.length} 帧  ${p.fps} fps${p.loop ? ' 循环' : ''}\n` +
        `部件 ${Object.keys(doll.def.parts).length}   画布 ${doll.def.canvas.w}x${doll.def.canvas.h}`,
    );
  }

  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const id = this.currentId();
    if (!id || !this.grid || !this.actor) return;
    const ox = this.actor.x;
    const oy = this.actor.y;
    const doll = dollRegistry.get(id);
    if (doll && !dollRegistry.getRig(id)) {
      const def = doll.def;
      g.lineStyle(1, 0x9ad0ff, 0.6);
      g.strokeRect(ox - def.origin.x * SCALE_DOLL + 0.5, oy - def.origin.y * SCALE_DOLL + 0.5, def.canvas.w * SCALE_DOLL, def.canvas.h * SCALE_DOLL);
    }
    g.lineStyle(1, 0xffd60a, 0.9);
    g.lineBetween(ox - 6, oy, ox + 6, oy);
    g.lineBetween(ox, oy - 6, ox, oy + 6);
  }
}
