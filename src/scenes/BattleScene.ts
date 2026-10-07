import Phaser from 'phaser';
import { createActor, type BattleActor } from '../art/dollActor';
import { addGround, stepRagdolls } from '../art/rigActor';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { DefenseAction, StrikeResult } from '../core/battle';
import type { Domain, PilotDef, Team, TerrainDef, UnitDef, WeaponDef } from '../core/types';
import { realmName } from '../core/realm';
import { TEXT_STYLE } from '../ui/Hud';

export type BattleSideId = 'left' | 'right';

export interface BattleSide {
  def: UnitDef;
  pilot: PilotDef;
  team: Team;
  hp: number;
  maxHp: number;
  en: number;
  maxEn: number;
  terrain: TerrainDef;
  domain: Domain;
}

export interface BattleStrike {
  /** Who attacks in this strike. */
  side: BattleSideId;
  weapon: WeaponDef;
  result: StrikeResult;
  defense: DefenseAction;
  targetHpAfter: number;
  attackerEnAfter: number;
  targetDestroyed: boolean;
}

export interface BattleScript {
  left: BattleSide;
  right: BattleSide;
  strikes: BattleStrike[];
}

export interface BattleSceneData {
  script: BattleScript;
  onDone: () => void;
}

const GROUND_Y = 206;

function defeatText(def: UnitDef): string {
  if (def.species === 'human') return `${def.name} 败退！`;
  if (def.species === 'beast') return `${def.name} 倒下了！`;
  return `${def.name} 被击毁！`;
}
const POS_X: Record<BattleSideId, number> = { left: 128, right: 352 };
const SKIP_KEYS = new Set(['KeyZ', 'KeyX', 'Enter', 'Space', 'Escape']);

interface SidePanel {
  hpBar: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  enText: Phaser.GameObjects.Text;
  hp: number;
  en: number;
}

/**
 * SRW-style cut-away battle screen: big placeholder mechs on a terrain backdrop,
 * HP/EN panels, weapon call-outs, attack effects and results. Press any confirm/cancel
 * key (or click) to fast-forward; the map applies the numbers, this scene only shows them.
 */
export class BattleScene extends Phaser.Scene {
  private script!: BattleScript;
  private onDone!: () => void;
  private mechs!: Record<BattleSideId, BattleActor>;
  private panels!: Record<BattleSideId, SidePanel>;
  private message!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fader!: Phaser.GameObjects.Rectangle;
  private finished = false;

  constructor() {
    super({
      key: 'Battle',
      physics: {
        default: 'matter',
        matter: { gravity: { x: 0, y: 0.9 }, autoUpdate: false, enableSleeping: false, positionIterations: 10, velocityIterations: 8, constraintIterations: 10 },
      },
    });
  }

  /** Thruster flames of airborne mechs, kept under their actor as it dashes and hovers. */
  private flames: Array<{ actor: BattleActor; obj: Phaser.GameObjects.Rectangle; dx: number; dy: number }> = [];

  update(_time: number, delta: number): void {
    stepRagdolls(this, delta);
    for (const f of this.flames) {
      const dead = (f.actor as BattleActor & { isRagdoll?: boolean }).isRagdoll === true;
      f.obj.setVisible(!dead && f.actor.node.alpha > 0.05);
      f.obj.setPosition(f.actor.x + f.dx, f.actor.y + f.dy);
    }
  }

  init(data: BattleSceneData): void {
    this.flames = [];
    this.script = data.script;
    this.onDone = data.onDone;
    this.finished = false;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
  }

  create(): void {
    this.drawBackground(this.script.right.terrain, this.script.right.domain);
    addGround(this, GROUND_Y, GAME_WIDTH);
    this.mechs = { left: this.placeMech('left'), right: this.placeMech('right') };
    this.panels = { left: this.makePanel('left'), right: this.makePanel('right') };

    const boxY = GAME_HEIGHT - 46;
    const box = this.add.graphics();
    box.fillStyle(0x0e1730, 0.94);
    box.fillRect(8, boxY, GAME_WIDTH - 16, 38);
    box.lineStyle(1, 0xe8eef8, 1);
    box.strokeRect(8.5, boxY + 0.5, GAME_WIDTH - 17, 37);
    this.message = this.add.text(GAME_WIDTH / 2, boxY + 19, '', TEXT_STYLE).setOrigin(0.5);

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 200, max: 420 },
      scale: { start: 1.6, end: 0 },
      gravityY: 180,
      tint: [0xfff1a8, 0xffb347, 0xffffff],
      emitting: false,
    });
    this.sparks.setDepth(40);

    this.fader = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setOrigin(0).setDepth(100);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (SKIP_KEYS.has(ev.code)) this.skip();
    });
    this.input.on('pointerdown', () => this.skip());

    void this.run();
  }

  // ------------------------------------------------------------------ flow

  private async run(): Promise<void> {
    await this.tween({ targets: this.fader, alpha: 0, duration: 220 });
    await this.wait(250);
    for (const strike of this.script.strikes) {
      await this.playStrike(strike);
      await this.wait(350);
    }
    await this.wait(300);
    await this.tween({ targets: this.fader, alpha: 1, duration: 220 });
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.scene.stop();
    this.onDone();
  }

  /** Fast-forward: everything still plays, 25x faster, so the final state is always consistent. */
  private skip(): void {
    this.tweens.timeScale = 25;
    this.time.timeScale = 25;
  }

  private async playStrike(s: BattleStrike): Promise<void> {
    const attacker = this.script[s.side];
    const defSide: BattleSideId = s.side === 'left' ? 'right' : 'left';
    const A = this.mechs[s.side];
    const D = this.mechs[defSide];
    const dir = s.side === 'left' ? 1 : -1;

    this.setMessage(`${attacker.pilot.name}：${s.weapon.name}！`);
    this.setEn(s.side, s.attackerEnAfter);
    await this.wait(420);
    A.play(s.weapon.kind === 'melee' ? 'melee' : 'shoot');

    if (s.defense === 'defend' && s.result.hit) this.setMessage('防御！');
    else if (s.defense === 'evade') this.setMessage('回避！');

    if (s.weapon.fx === 'sword') await this.flyingSwords(A, D, dir, s.weapon.power >= 3000 ? 5 : 1);
    else if (s.weapon.fx === 'thunder') await this.thunder(A, D);
    else if (s.weapon.fx === 'fire') await this.fireball(A, D, dir);
    else if (s.weapon.kind === 'melee') await this.melee(A, D, dir);
    else if (s.weapon.fx === 'ice') await this.beam(A, D, dir, 0x9fe8ff, true);
    else if (s.weapon.beam) await this.beam(A, D, dir);
    else if (s.weapon.ammo !== null && s.weapon.ammo >= 10) await this.burst(A, D, dir);
    else await this.shell(A, D, dir);

    if (!s.result.hit) {
      await this.dodge(D, dir);
      this.setMessage('MISS');
      await this.wait(400);
      return;
    }

    if (s.defense === 'defend') this.shield(D, dir);
    D.play(s.defense === 'defend' ? 'block' : 'hit');
    await this.impact(D, dir, s.result.crit);
    this.popDamage(D, s.result.damage, s.result.crit);
    this.setMessage(s.result.crit ? `会心一击！  ${s.result.damage} 伤害` : `命中！  ${s.result.damage} 伤害`);
    await this.drainHp(defSide, s.targetHpAfter);
    if (s.targetDestroyed) {
      if (!D.collapse) D.play('down');
      await this.destroy(D, -dir, s.result.crit);
      this.setMessage(defeatText(this.script[defSide].def));
      await this.wait(500);
    }
  }

  // ------------------------------------------------------------------ attacks

  /** 御剑术: one or more flying swords arc from the caster into the target, leaving afterimages. */
  private async flyingSwords(A: BattleActor, D: BattleActor, dir: number, count: number): Promise<void> {
    const start = A.socket('muzzle', dir);
    const ex = D.x - dir * 6;
    const ey = D.y - D.height * 0.5;
    const flights: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      const sx = start.x + (count > 1 ? Phaser.Math.Between(-20, 20) : 0);
      const sy = start.y - (count > 1 ? 30 + i * 10 : 6);
      const sword = this.add.container(sx, sy).setDepth(36);
      sword.add([
        this.add.rectangle(dir * 6, 0, 14, 2, 0xe8f4ff),
        this.add.rectangle(dir * 6, -1, 12, 1, 0xffffff),
        this.add.rectangle(-dir * 2, 0, 2, 6, 0xd8b04a),
        this.add.rectangle(-dir * 5, 0, 5, 2, 0x5a3a22),
      ]);
      const lift = 26 + i * 6;
      flights.push(
        new Promise<void>((resolve) => {
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 360,
            delay: i * 90,
            ease: 'Sine.easeIn',
            onUpdate: (tw) => {
              const t = tw.getValue() ?? 0;
              const x = sx + (ex - sx) * t;
              const y = sy + (ey - sy) * t - Math.sin(Math.PI * t) * lift;
              sword.setRotation(Math.atan2(y - sword.y, (x - sword.x) * dir || 0.001) * dir);
              sword.setPosition(x, y);
              if (Math.random() < 0.7) {
                const ghost = this.add.rectangle(x, y, 10, 2, 0x9fe8ff, 0.6).setRotation(sword.rotation).setDepth(35);
                this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
              }
            },
            onComplete: () => {
              sword.destroy();
              resolve();
            },
          });
        }),
      );
    }
    await Promise.all(flights);
  }

  /** 雷法: forked lightning strikes the target from the sky. */
  private async thunder(A: BattleActor, D: BattleActor): Promise<void> {
    const raise = A.socket('muzzle', 1);
    const spark = this.add.circle(raise.x, raise.y, 4, 0xd8c8ff, 1).setDepth(36);
    this.tweens.add({ targets: spark, radius: 9, alpha: 0, duration: 300, onComplete: () => spark.destroy() });
    await this.wait(200);
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xe8e0ff, 0.5).setOrigin(0).setDepth(30);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    for (let b = 0; b < 2; b++) {
      const g = this.add.graphics().setDepth(37);
      let x = D.x + Phaser.Math.Between(-8, 8);
      let y = 0;
      const ty = D.y - D.height * 0.5;
      g.lineStyle(b ? 1 : 3, b ? 0xffffff : 0xb8a0ff, 1);
      g.beginPath();
      g.moveTo(x, y);
      while (y < ty) {
        y = Math.min(ty, y + Phaser.Math.Between(10, 22));
        x += Phaser.Math.Between(-9, 9);
        g.lineTo(x, y);
      }
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 280, delay: 120, onComplete: () => g.destroy() });
    }
    this.cameras.main.shake(120, 0.006);
    await this.wait(160);
  }

  /** 火法: a blazing orb with an ember trail. */
  private async fireball(A: BattleActor, D: BattleActor, dir: number): Promise<void> {
    const m = A.socket('muzzle', dir);
    const orb = this.add.circle(m.x, m.y, 6, 0xffb347, 1).setDepth(36);
    const coreDot = this.add.circle(m.x, m.y, 3, 0xfff1a8, 1).setDepth(37);
    await new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 380,
        ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const x = m.x + (D.x - m.x) * t;
          const y = m.y + (D.y - D.height * 0.5 - m.y) * t;
          orb.setPosition(x, y);
          coreDot.setPosition(x, y);
          const ember = this.add.circle(x - dir * 4, y + Phaser.Math.Between(-3, 3), 2, Math.random() < 0.5 ? 0xff6b3d : 0xffd060, 0.9).setDepth(35);
          this.tweens.add({ targets: ember, alpha: 0, y: ember.y - 6, duration: 300, onComplete: () => ember.destroy() });
        },
        onComplete: () => resolve(),
      });
    });
    orb.destroy();
    coreDot.destroy();
  }

  private async melee(A: BattleActor, D: BattleActor, dir: number): Promise<void> {
    const home = A.x;
    await this.tween({ targets: A.node, x: D.x - dir * 64, duration: 220, ease: 'Quad.easeIn' });
    const g = this.add.graphics().setDepth(35);
    g.lineStyle(3, 0xffffff, 1);
    for (let i = 0; i < 3; i++) {
      const ox = D.x - dir * 10 + i * 6 * dir;
      g.lineBetween(ox - 26, D.y - 80 + i * 4, ox + 26, D.y - 20 + i * 4);
    }
    g.lineStyle(1, 0x9ad0ff, 1);
    g.lineBetween(D.x - 30 * dir, D.y - 84, D.x + 30 * dir, D.y - 16);
    this.cameras.main.shake(90, 0.004);
    await this.wait(120);
    g.destroy();
    this.tweens.add({ targets: A.node, x: home, duration: 260, ease: 'Quad.easeOut', delay: 180 });
  }

  private async beam(A: BattleActor, D: BattleActor, dir: number, color = 0xfff0a0, shards = false): Promise<void> {
    const { x: gx, y: gy } = A.socket('muzzle', dir);
    const flash = this.add.circle(gx, gy, 7, 0xffffff, 1).setDepth(36);
    await this.wait(80);
    flash.destroy();
    const length = Math.abs(D.x - gx) - 10;
    const glow = this.add.rectangle(gx, gy, 1, 10, color, 0.55).setOrigin(dir > 0 ? 0 : 1, 0.5).setDepth(34);
    const core = this.add.rectangle(gx, gy, 1, 4, 0xffffff, 1).setOrigin(dir > 0 ? 0 : 1, 0.5).setDepth(35);
    await Promise.all([
      this.tween({ targets: glow, width: length, duration: 110 }),
      this.tween({ targets: core, width: length, duration: 110 }),
    ]);
    if (shards) {
      for (let i = 0; i < 8; i++) {
        const sh = this.add.rectangle(D.x + Phaser.Math.Between(-14, 14), D.y - D.height * 0.5 + Phaser.Math.Between(-24, 24), 3, 7, 0xe8fbff, 1)
          .setAngle(Phaser.Math.Between(-40, 40)).setDepth(37);
        this.tweens.add({ targets: sh, alpha: 0, y: sh.y + 10, duration: 500, delay: i * 30, onComplete: () => sh.destroy() });
      }
    }
    await this.wait(160);
    await Promise.all([
      this.tween({ targets: glow, alpha: 0, duration: 160 }),
      this.tween({ targets: core, alpha: 0, duration: 160 }),
    ]);
    glow.destroy();
    core.destroy();
  }

  private async burst(A: BattleActor, D: BattleActor, dir: number): Promise<void> {
    const { x: gx, y: gy } = A.socket('muzzle', dir);
    const shots: Promise<void>[] = [];
    for (let i = 0; i < 6; i++) {
      const b = this.add.rectangle(gx, gy + (i % 2) * 3, 6, 2, 0xfff1a8, 1).setDepth(35);
      shots.push(
        this.tween({ targets: b, x: D.x + dir * 6, duration: 130, delay: i * 60, ease: 'Linear' }).then(() => b.destroy()),
      );
      const muzzle = this.add.circle(gx, gy, 4, 0xffffff, 1).setDepth(36);
      this.tweens.add({ targets: muzzle, alpha: 0, scale: 0.2, duration: 90, delay: i * 60, onComplete: () => muzzle.destroy() });
    }
    await Promise.all(shots);
  }

  private async shell(A: BattleActor, D: BattleActor, dir: number): Promise<void> {
    const muzzle = A.socket('muzzle', dir);
    const sx = muzzle.x - dir * 14;
    const sy = muzzle.y - 16;
    const ex = D.x;
    const ey = D.y - D.height * 0.45;
    const m = this.add.rectangle(sx, sy, 10, 4, 0xd8dee9, 1).setDepth(35);
    const fire = this.add.rectangle(sx, sy, 5, 3, 0xffb347, 1).setDepth(34);
    const trail: Phaser.GameObjects.Arc[] = [];
    await new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 420,
        ease: 'Sine.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          m.x = sx + (ex - sx) * t;
          m.y = sy + (ey - sy) * t - Math.sin(Math.PI * t) * 46;
          fire.setPosition(m.x - dir * 7, m.y);
          if (trail.length < 14 && Math.random() < 0.6) {
            const puff = this.add.circle(m.x - dir * 8, m.y, 3, 0xcfd8dc, 0.7).setDepth(33);
            trail.push(puff);
            this.tweens.add({ targets: puff, alpha: 0, scale: 2, duration: 360, onComplete: () => puff.destroy() });
          }
        },
        onComplete: () => resolve(),
      });
    });
    m.destroy();
    fire.destroy();
  }

  // ------------------------------------------------------------------ results

  private async impact(D: BattleActor, dir: number, crit: boolean): Promise<void> {
    const home = D.x;
    const cy = D.y - D.height * 0.45;
    D.flash(0xffffff);
    this.sparks.explode(crit ? 26 : 14, D.x, cy);
    const boom = this.add.circle(D.x, cy, 6, 0xffffff, 0.9).setDepth(36);
    this.tweens.add({ targets: boom, radius: crit ? 34 : 22, alpha: 0, duration: 260, onComplete: () => boom.destroy() });
    this.cameras.main.shake(crit ? 220 : 140, crit ? 0.012 : 0.006);
    await this.tween({ targets: D.node, x: home + dir * (crit ? 16 : 10), duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    D.unflash();
    await this.wait(80);
  }

  private shield(D: BattleActor, dir: number): void {
    const sh = this.add.rectangle(D.x - dir * 34, D.y - D.height * 0.5, 10, D.height * 0.75, 0x7fb4ff, 0.55).setDepth(34);
    this.tweens.add({ targets: sh, alpha: 0, duration: 420, onComplete: () => sh.destroy() });
  }

  private async dodge(D: BattleActor, dir: number): Promise<void> {
    const home = { x: D.x, y: D.y };
    const ghost = D.ghost();
    this.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
    await this.tween({ targets: D.node, x: home.x + dir * 36, y: home.y - 28, duration: 140, ease: 'Quad.easeOut' });
    await this.wait(200);
    await this.tween({ targets: D.node, x: home.x, y: home.y, duration: 220, ease: 'Quad.easeInOut' });
  }

  private popDamage(D: BattleActor, damage: number, crit: boolean): void {
    const t = this.add
      .text(D.x, D.y - D.height - 8, `${damage}`, { ...TEXT_STYLE, fontSize: '24px', color: crit ? '#ff6b6b' : '#ffffff' })
      .setOrigin(0.5, 1)
      .setDepth(50);
    this.tweens.add({ targets: t, y: t.y - 18, duration: 500, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 700, onComplete: () => t.destroy() });
    if (crit) {
      const c = this.add.text(D.x, D.y - D.height - 32, 'CRITICAL', { ...TEXT_STYLE, color: '#ffd60a' }).setOrigin(0.5, 1).setDepth(50);
      this.tweens.add({ targets: c, alpha: 0, y: c.y - 10, duration: 900, delay: 300, onComplete: () => c.destroy() });
    }
  }

  private async destroy(D: BattleActor, dir: number, severe: boolean): Promise<void> {
    if (D.collapse) {
      // Physical death: the rig falls apart as a ragdoll and stays on the ground as a wreck.
      const cy0 = D.y - D.height * 0.45;
      D.flash(0xffffff);
      this.cameras.main.shake(300, 0.012);
      this.sparks.explode(30, D.x, cy0);
      await this.wait(90);
      D.unflash();
      D.collapse(-dir, severe && D.species === 'construct');
      for (let i = 0; i < 5; i++) {
        const ring = this.add.circle(D.x + Phaser.Math.Between(-24, 24), cy0 + Phaser.Math.Between(-30, 30), 4, i % 2 ? 0xffb347 : 0xff6b3d, 0.95).setDepth(45);
        this.tweens.add({ targets: ring, radius: 26 + i * 4, alpha: 0, duration: 520, delay: 200 + i * 110, onComplete: () => ring.destroy() });
      }
      if (D.species === 'human' && D.dissolve) {
        await this.wait(900);
        await D.dissolve(900);
      } else {
        await this.wait(1500);
      }
      return;
    }
    await this.tween({ targets: D.node, alpha: 0.2, duration: 70, yoyo: true, repeat: 3 });
    const cy = D.y - D.height * 0.45;
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.85).setOrigin(0).setDepth(90);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    this.cameras.main.shake(400, 0.015);
    for (let i = 0; i < 6; i++) {
      const ox = D.x + Phaser.Math.Between(-30, 30);
      const oy = cy + Phaser.Math.Between(-36, 30);
      const ring = this.add.circle(ox, oy, 4, i % 2 ? 0xffb347 : 0xff6b3d, 0.95).setDepth(45);
      this.tweens.add({ targets: ring, radius: 30 + i * 4, alpha: 0, duration: 520, delay: i * 70, onComplete: () => ring.destroy() });
    }
    this.sparks.explode(40, D.x, cy);
    await this.tween({ targets: D.node, alpha: 0, y: D.y + 6, duration: 600, delay: 120 });
  }

  // ------------------------------------------------------------------ hud

  private makePanel(side: BattleSideId): SidePanel {
    const s = this.script[side];
    const w = 206;
    const x = side === 'left' ? 6 : GAME_WIDTH - w - 6;
    const y = 6;
    const g = this.add.graphics().setDepth(60);
    g.fillStyle(0x0e1730, 0.94);
    g.fillRect(x, y, w, 58);
    g.lineStyle(1, 0xe8eef8, 1);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, 57);
    g.lineStyle(1, 0x4d6aa8, 1);
    g.strokeRect(x + 1.5, y + 1.5, w - 3, 55);

    // portrait placeholder: team-coloured box with the pilot's first character
    const px = side === 'left' ? x + 5 : x + w - 33;
    g.fillStyle(s.team === 'player' ? 0x2a5aa8 : 0xa83a3a, 1);
    g.fillRect(px, y + 5, 28, 28);
    g.lineStyle(1, 0xe8eef8, 1);
    g.strokeRect(px + 0.5, y + 5.5, 27, 27);
    if (this.textures.exists(`portrait_${s.def.id}`)) {
      const img = this.add.image(px, y + 5, `portrait_${s.def.id}`).setOrigin(0, 0).setDepth(61);
      if (side === 'right') img.setFlipX(true);
    } else {
      this.add.text(px + 14, y + 19, [...s.pilot.name][0] ?? '?', { ...TEXT_STYLE, fontSize: '12px' }).setOrigin(0.5).setDepth(61);
    }

    const tx = side === 'left' ? x + 38 : x + 6;
    this.add.text(tx, y + 4, `${s.def.name}`, TEXT_STYLE).setDepth(61);
    // a 天工宗 elder riding a 镇宗傀儡 is named under the puppet
    const rider = s.def.species && s.def.species !== 'human' && s.pilot.name !== s.def.name ? `${s.pilot.name} 驾驭` : null;
    const sub = rider ?? (s.def.species === 'human' || !s.def.species ? realmName(s.pilot.level) : (s.def.title ?? realmName(s.pilot.level)));
    this.add.text(tx, y + 17, sub, { ...TEXT_STYLE, color: '#cfd8dc' }).setDepth(61);
    const hpBar = this.add.graphics().setDepth(61);
    const hpText = this.add.text(tx + 92, y + 28, '', TEXT_STYLE).setDepth(62);
    const enText = this.add.text(tx + 92, y + 41, '', { ...TEXT_STYLE, color: '#9ad0ff' }).setDepth(62);
    const panel: SidePanel = { hpBar, hpText, enText, hp: s.hp, en: s.en };
    this.panels = { ...(this.panels ?? {}), [side]: panel } as Record<BattleSideId, SidePanel>;
    this.redrawPanel(side, tx, y);
    return panel;
  }

  private redrawPanel(side: BattleSideId, tx?: number, y = 6): void {
    const s = this.script[side];
    const p = this.panels[side];
    const w = 206;
    const x0 = tx ?? (side === 'left' ? 6 + 38 : GAME_WIDTH - w - 6 + 6);
    const g = p.hpBar;
    g.clear();
    const barW = 88;
    const hpRatio = Math.max(0, Math.min(1, p.hp / s.maxHp));
    const enRatio = Math.max(0, Math.min(1, p.en / s.maxEn));
    g.fillStyle(0x000000, 0.8);
    g.fillRect(x0, y + 32, barW, 7);
    g.fillStyle(hpRatio > 0.5 ? 0x4cd964 : hpRatio > 0.25 ? 0xffd60a : 0xff3b30, 1);
    g.fillRect(x0 + 1, y + 33, Math.round((barW - 2) * hpRatio), 5);
    g.fillStyle(0x000000, 0.8);
    g.fillRect(x0, y + 45, barW, 5);
    g.fillStyle(0x5aa9ff, 1);
    g.fillRect(x0 + 1, y + 46, Math.round((barW - 2) * enRatio), 3);
    p.hpText.setText(`气血 ${Math.round(p.hp)}`);
    p.enText.setText(`灵力 ${Math.round(p.en)}`);
  }

  private setEn(side: BattleSideId, en: number): void {
    this.panels[side].en = en;
    this.redrawPanel(side);
  }

  private drainHp(side: BattleSideId, to: number): Promise<void> {
    const p = this.panels[side];
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: p.hp,
        to,
        duration: 480,
        ease: 'Quad.easeOut',
        onUpdate: (tw) => {
          p.hp = tw.getValue() ?? to;
          this.redrawPanel(side);
        },
        onComplete: () => {
          p.hp = to;
          this.redrawPanel(side);
          resolve();
        },
      });
    });
  }

  private setMessage(text: string): void {
    this.message.setText(text);
  }

  // ------------------------------------------------------------------ stage

  private placeMech(side: BattleSideId): BattleActor {
    const s = this.script[side];
    const airborne = s.domain === 'air';
    const y = airborne ? GROUND_Y - 26 : GROUND_Y;
    if (!airborne) this.add.ellipse(POS_X[side], GROUND_Y - 2, 70, 12, 0x000000, 0.3).setDepth(9);
    const actor = createActor(this, s.def.id, POS_X[side], y, { flip: side === 'right' });
    actor.setDepth(10);
    if (airborne && s.def.species === 'human') {
      // 御剑飞行: standing on a flying sword
      this.tweens.add({ targets: actor.node, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const dirx = side === 'left' ? 1 : -1;
      const parts: Array<[number, number, number, number, number]> = [
        [0, 1, 34, 3, 0xe8f4ff],
        [dirx * 2, 0, 28, 1, 0xffffff],
        [-dirx * 15, 1, 2, 7, 0xd8b04a],
        [-dirx * 20, 1, 8, 3, 0x5a3a22],
      ];
      for (const [dx, dy, w, h, c] of parts) {
        const r = this.add.rectangle(0, 0, w, h, c).setDepth(11);
        this.flames.push({ actor, obj: r, dx, dy: dy + 1 });
      }
      const glow = this.add.rectangle(0, 0, 40, 3, 0x9fe8ff, 0.35).setDepth(10);
      this.tweens.add({ targets: glow, alpha: 0.1, duration: 400, yoyo: true, repeat: -1 });
      this.flames.push({ actor, obj: glow, dx: 0, dy: 4 });
    } else if (airborne && s.def.species === 'beast') {
      // 踏云: a drifting cloud under the beast
      this.tweens.add({ targets: actor.node, y: y - 4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (const [dx, dy, w] of [[-14, 2, 22], [0, 0, 30], [14, 2, 22], [0, 4, 44]] as const) {
        const puff = this.add.rectangle(0, 0, w, 6, 0xffffff, 0.85).setDepth(9);
        this.flames.push({ actor, obj: puff, dx, dy });
      }
    } else if (airborne) {
      this.tweens.add({ targets: actor.node, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (const dx of [-12, 12]) {
        const flame = this.add.rectangle(0, 0, 6, 10, 0xffb347, 0.9).setOrigin(0.5, 0).setDepth(9);
        const core = this.add.rectangle(0, 0, 3, 6, 0xfff1a8, 1).setOrigin(0.5, 0).setDepth(9);
        this.tweens.add({ targets: [flame, core], scaleY: 1.6, alpha: 0.6, duration: 120, yoyo: true, repeat: -1 });
        this.flames.push({ actor, obj: flame, dx, dy: 2 }, { actor, obj: core, dx, dy: 2 });
      }
    }
    return actor;
  }

  private drawBackground(terrain: TerrainDef, domain: Domain): void {
    const g = this.add.graphics().setDepth(0);
    if (domain === 'space' || terrain.domain === 'space') {
      g.fillStyle(0x05060d, 1);
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      for (let i = 0; i < 90; i++) {
        g.fillStyle(i % 7 === 0 ? 0x9ad0ff : 0xffffff, 1);
        g.fillRect(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), 1, 1);
      }
      return;
    }
    const sky = [0x2b4f8f, 0x3a66ad, 0x4f82c7, 0x6ea2dc, 0x8fc1ea];
    sky.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, i * 30, GAME_WIDTH, 30);
    });
    g.fillStyle(0x8fc1ea, 1);
    g.fillRect(0, 150, GAME_WIDTH, GROUND_Y - 150);
    // clouds
    g.fillStyle(0xffffff, 0.9);
    for (const [cx, cy, cw] of [
      [60, 40, 70],
      [230, 24, 90],
      [390, 56, 60],
    ]) {
      g.fillRect(cx, cy + 6, cw, 8);
      g.fillRect(cx + 12, cy, cw - 30, 8);
      g.fillRect(cx + 6, cy + 3, cw - 14, 6);
    }

    const far = 0x4d6aa8;
    switch (terrain.id) {
      case 'mountain':
        g.fillStyle(0x6a5f49, 1);
        g.fillTriangle(-20, GROUND_Y, 90, 110, 200, GROUND_Y);
        g.fillTriangle(150, GROUND_Y, 280, 90, 420, GROUND_Y);
        g.fillTriangle(360, GROUND_Y, 460, 120, 560, GROUND_Y);
        g.fillStyle(0xf2f4f7, 1);
        g.fillTriangle(262, 108, 280, 90, 298, 108);
        g.fillStyle(0x8d8166, 1);
        g.fillTriangle(0, GROUND_Y, 160, 140, 320, GROUND_Y);
        break;
      case 'city':
        // 坊市: far rooftops, then white-walled shops with upturned eaves and red lanterns
        g.fillStyle(far, 1);
        for (let x = -10; x < GAME_WIDTH; x += 38) {
          const h = 30 + ((x * 7) % 26);
          g.fillRect(x + 4, GROUND_Y - h, 28, h);
          this.eaveRoof(g, x + 18, GROUND_Y - h, 40, 8, far);
        }
        for (let x = 6; x < GAME_WIDTH; x += 58) {
          const h = 22 + ((x * 5) % 14);
          const top = GROUND_Y - h;
          g.fillStyle(0xe6e1d4, 1);
          g.fillRect(x, top, 40, h);
          g.fillStyle(0xb9b2a2, 1);
          g.fillRect(x, top, 40, 3);
          g.fillStyle(0xa8322b, 1);
          g.fillRect(x + 2, top, 3, h);
          g.fillRect(x + 35, top, 3, h);
          g.fillStyle(0x6b2a22, 1);
          g.fillRect(x + 15, GROUND_Y - 14, 10, 14);
          g.fillStyle(0x7a5a3a, 1);
          g.fillRect(x + 8, top + 6, 5, 5);
          g.fillRect(x + 27, top + 6, 5, 5);
          this.eaveRoof(g, x + 20, top, 54, 10, 0x3b4150);
          g.fillStyle(0xe8453a, 1);
          g.fillRect(x + 1, top + 4, 4, 5);
          g.fillStyle(0xffd27a, 1);
          g.fillRect(x + 2, top + 6, 2, 1);
        }
        break;
      case 'forest':
        g.fillStyle(0x2c6a2c, 1);
        for (let x = -10; x < GAME_WIDTH + 10; x += 22) g.fillCircle(x, GROUND_Y - 14, 18);
        g.fillStyle(0x3d8a38, 1);
        for (let x = 0; x < GAME_WIDTH + 10; x += 26) g.fillCircle(x, GROUND_Y - 4, 14);
        break;
      case 'base':
        // 山门: misty peaks, a pagoda on the ridge, stone steps up to a 牌坊 gate
        g.fillStyle(0x7d93b8, 1);
        g.fillTriangle(-40, GROUND_Y, 70, 96, 190, GROUND_Y);
        g.fillTriangle(300, GROUND_Y, 420, 84, 540, GROUND_Y);
        g.fillStyle(0x92a8c8, 1);
        g.fillTriangle(120, GROUND_Y, 250, 120, 380, GROUND_Y);
        g.fillStyle(0xdfe8f2, 0.7);
        g.fillRect(0, GROUND_Y - 46, GAME_WIDTH, 6);
        g.fillRect(40, GROUND_Y - 40, 180, 4);
        // pagoda
        g.fillStyle(0x51596c, 1);
        for (let i = 0; i < 5; i++) {
          const w = 14 - i * 2;
          const y = 160 - i * 13;
          g.fillRect(420 - w / 2, y - 9, w, 9);
          this.eaveRoof(g, 420, y - 9, w + 12, 5, 0x3b4150);
        }
        g.fillRect(419, 92, 2, 8);
        // steps
        g.fillStyle(0xa6a196, 1);
        for (let i = 0; i < 4; i++) g.fillRect(170 + i * 6, GROUND_Y - 8 + i * 2, 140 - i * 12, 2);
        // 牌坊: three bays, four stone pillars, a raised centre roof over a gilt plaque
        for (const px of [176, 214, 262, 300]) {
          g.fillStyle(0x6f6b62, 1);
          g.fillRect(px + 2, GROUND_Y - 58, 4, 58);
          g.fillStyle(0x9a958a, 1);
          g.fillRect(px, GROUND_Y - 58, 4, 58);
          g.fillRect(px - 2, GROUND_Y - 6, 10, 6);
        }
        g.fillStyle(0x8a857a, 1);
        g.fillRect(176, GROUND_Y - 50, 130, 4);
        g.fillRect(214, GROUND_Y - 64, 54, 6);
        g.fillStyle(0x2c3346, 1);
        g.fillRect(224, GROUND_Y - 80, 34, 16);
        g.fillStyle(0xd9b44a, 1);
        g.fillRect(226, GROUND_Y - 78, 30, 12);
        g.fillStyle(0x2c3346, 1);
        g.fillRect(233, GROUND_Y - 74, 5, 5);
        g.fillRect(244, GROUND_Y - 74, 5, 5);
        this.eaveRoof(g, 194, GROUND_Y - 50, 52, 8, 0x2f3646);
        this.eaveRoof(g, 287, GROUND_Y - 50, 52, 8, 0x2f3646);
        this.eaveRoof(g, 241, GROUND_Y - 80, 74, 11, 0x2f3646);
        g.fillStyle(0xd9b44a, 1);
        g.fillRect(238, GROUND_Y - 93, 6, 2);
        break;
      case 'sea':
      case 'river':
        g.fillStyle(0x2f68ad, 1);
        g.fillRect(0, 150, GAME_WIDTH, GROUND_Y - 150);
        g.fillStyle(0x86bdeb, 1);
        for (let y = 156; y < GROUND_Y; y += 10) for (let x = (y * 3) % 20; x < GAME_WIDTH; x += 40) g.fillRect(x, y, 10, 1);
        break;
      default:
        g.fillStyle(0x3d7a3a, 1);
        g.fillEllipse(80, GROUND_Y + 10, 300, 80);
        g.fillEllipse(400, GROUND_Y + 16, 320, 90);
        g.fillStyle(0x2c6a2c, 1);
        for (const x of [40, 120, 330, 440]) g.fillCircle(x, GROUND_Y - 6, 7);
    }

    // ground plane
    const water = terrain.domain === 'sea';
    if (!water && (terrain.id === 'city' || terrain.id === 'base')) {
      // flagstones
      g.fillStyle(0xa6a196, 1);
      g.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
      g.fillStyle(0x7d786d, 1);
      g.fillRect(0, GROUND_Y, GAME_WIDTH, 2);
      for (let y = GROUND_Y + 10, row = 0; y < GAME_HEIGHT; y += 12, row++) {
        g.fillRect(0, y, GAME_WIDTH, 1);
        for (let x = (row % 2) * 14; x < GAME_WIDTH; x += 28) g.fillRect(x, y - 11, 1, 11);
      }
      return;
    }
    g.fillStyle(water ? 0x3b7bc4 : 0x5f9c3b, 1);
    g.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    g.fillStyle(water ? 0x2f68ad : 0x497f2e, 1);
    g.fillRect(0, GROUND_Y, GAME_WIDTH, 2);
    g.fillStyle(water ? 0x86bdeb : 0x80bb52, 0.8);
    for (let i = 0; i < 40; i++) g.fillRect(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(GROUND_Y + 4, GAME_HEIGHT - 2), 3, 1);
  }

  /** A Chinese roof: a flat ridge with eaves that sweep up at both tips; (cx, baseY) is the eave line. */
  private eaveRoof(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w: number, h: number, color: number): void {
    const half = w / 2;
    g.fillStyle(color, 1);
    g.fillRect(cx - half + 4, baseY - h + 2, w - 8, h - 2);
    g.fillRect(cx - half * 0.55, baseY - h, w * 0.55, 2);
    g.fillTriangle(cx - half, baseY - 4, cx - half + 8, baseY - h + 2, cx - half + 8, baseY);
    g.fillTriangle(cx + half, baseY - 4, cx + half - 8, baseY - h + 2, cx + half - 8, baseY);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(cx - half + 6, baseY - 1, w - 12, 1);
  }

  // ------------------------------------------------------------------ helpers

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }
}
