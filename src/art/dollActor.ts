import Phaser from 'phaser';
import { poseName, resolvePose, resolveSocket, type BattlePose } from '../core/doll';
import { dollFrameRef, dollRegistry, type LoadedDoll } from './dollRegistry';

/**
 * What the battle screen needs from a mech on stage, whether it is a placeholder image
 * or an imported paper doll. Tweens target `node` (x, y, alpha).
 */
export interface BattleActor {
  readonly node: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  setFlip(flip: boolean): void;
  setDepth(depth: number): void;
  play(pose: BattlePose): void;
  flash(color: number): void;
  unflash(): void;
  /** World position of a named socket; falls back to a sensible point (dir = facing, +1 right). */
  socket(name: string, dir: number): { x: number; y: number };
  /** Semi-transparent copy at the current position; the caller destroys it. */
  ghost(): Phaser.GameObjects.GameObject & { alpha: number };
  destroy(): void;
}

interface ActorOptions {
  scale?: number;
  animate?: boolean;
  pose?: string;
  key?: number;
  flip?: boolean;
}

export class ImageActor implements BattleActor {
  readonly node: Phaser.GameObjects.Image;
  private scale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly textureKey: string,
    opts: ActorOptions = {},
  ) {
    this.scale = opts.scale ?? 1;
    this.node = scene.add.image(x, y, textureKey).setOrigin(0.5, 1).setScale(this.scale);
    if (opts.flip) this.setFlip(true);
  }
  get x(): number {
    return this.node.x;
  }
  get y(): number {
    return this.node.y;
  }
  get height(): number {
    return this.node.displayHeight;
  }
  setFlip(flip: boolean): void {
    this.node.setFlipX(flip);
  }
  setDepth(depth: number): void {
    this.node.setDepth(depth);
  }
  play(): void {
    // placeholder blocks have no poses
  }
  flash(color: number): void {
    this.node.setTintFill(color);
  }
  unflash(): void {
    this.node.clearTint();
  }
  socket(_name: string, dir: number): { x: number; y: number } {
    return { x: this.node.x + dir * 34 * this.scale, y: this.node.y - 44 * this.scale };
  }
  ghost(): Phaser.GameObjects.Image {
    return this.scene.add
      .image(this.node.x, this.node.y, this.textureKey)
      .setOrigin(0.5, 1)
      .setScale(this.scale)
      .setFlipX(this.node.flipX)
      .setAlpha(0.45)
      .setDepth(this.node.depth - 1);
  }
  destroy(): void {
    this.node.destroy();
  }
}

export class DollActor implements BattleActor {
  readonly node: Phaser.GameObjects.Container;
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private readonly scale: number;
  private flipped = false;
  private pose = 'idle';
  private key = 0;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly doll: LoadedDoll,
    x: number,
    y: number,
    opts: ActorOptions = {},
  ) {
    this.scale = opts.scale ?? 1;
    this.node = scene.add.container(x, y).setScale(this.scale);
    const parts = Object.entries(doll.def.parts).sort((a, b) => a[1].z - b[1].z);
    for (const [name] of parts) {
      const ref = dollFrameRef(doll, name, 0);
      const img = scene.add.image(0, 0, ref.key, ref.frame).setOrigin(0, 0);
      this.images.set(name, img);
      this.node.add(img);
    }
    if (opts.flip) this.setFlip(true);
    this.pose = poseName(doll.def, opts.pose ?? 'idle');
    this.key = opts.key ?? 0;
    if (opts.animate === false) this.apply();
    else this.play(this.pose as BattlePose);
  }

  get x(): number {
    return this.node.x;
  }
  get y(): number {
    return this.node.y;
  }
  get height(): number {
    return this.doll.def.canvas.h * this.scale;
  }
  get currentPose(): string {
    return this.pose;
  }
  get currentKey(): number {
    return this.key;
  }

  setFlip(flip: boolean): void {
    this.flipped = flip;
    this.node.setScale(flip ? -this.scale : this.scale, this.scale);
  }

  setDepth(depth: number): void {
    this.node.setDepth(depth);
  }

  /** Start a pose. Non-looping poses hold their last key briefly and then return to idle. */
  play(pose: BattlePose | string): void {
    this.stopTimer();
    this.pose = poseName(this.doll.def, pose);
    this.key = 0;
    this.apply();
    const p = this.doll.def.poses[this.pose];
    const delay = Math.max(16, Math.round(1000 / p.fps));
    this.timer = this.scene.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        this.key++;
        if (this.key >= p.keys.length) {
          if (p.loop) {
            this.key = 0;
          } else {
            this.stopTimer();
            if (this.pose !== 'idle') this.play('idle');
            return;
          }
        }
        this.apply();
      },
    });
  }

  private stopTimer(): void {
    this.timer?.remove(false);
    this.timer = null;
  }

  private apply(): void {
    for (const r of resolvePose(this.doll.def, this.pose, this.key)) {
      const img = this.images.get(r.part);
      if (!img) continue;
      const ref = dollFrameRef(this.doll, r.part, r.frameIndex);
      if (img.frame.name !== ref.frame || img.texture.key !== ref.key) img.setTexture(ref.key, ref.frame);
      img.setOrigin(r.frame.w ? r.pivot.x / r.frame.w : 0, r.frame.h ? r.pivot.y / r.frame.h : 0);
      img.setPosition(r.x, r.y);
      img.setVisible(!r.hidden);
    }
  }

  flash(color: number): void {
    for (const img of this.images.values()) img.setTintFill(color);
  }

  unflash(): void {
    for (const img of this.images.values()) img.clearTint();
  }

  socket(name: string, dir: number): { x: number; y: number } {
    const s = resolveSocket(this.doll.def, name, this.pose, this.key);
    const sx = this.flipped ? -1 : 1;
    if (s) return { x: this.node.x + s.x * sx * this.scale, y: this.node.y + s.y * this.scale };
    return { x: this.node.x + dir * 40 * this.scale, y: this.node.y - this.doll.def.canvas.h * 0.55 * this.scale };
  }

  ghost(): Phaser.GameObjects.Container {
    const g = new DollActor(this.scene, this.doll, this.node.x, this.node.y, {
      scale: this.scale,
      animate: false,
      pose: this.pose,
      key: this.key,
      flip: this.flipped,
    });
    g.node.setAlpha(0.45).setDepth(this.node.depth - 1);
    return g.node;
  }

  destroy(): void {
    this.stopTimer();
    this.node.destroy(true);
  }
}

/** A doll when one was imported for this unit, otherwise the procedural placeholder block mech. */
export function createActor(scene: Phaser.Scene, unitId: string, x: number, y: number, opts: ActorOptions = {}): BattleActor {
  const doll = dollRegistry.get(unitId);
  if (doll) return new DollActor(scene, doll, x, y, opts);
  return new ImageActor(scene, x, y, `mech_${unitId}`, opts);
}
