import Phaser from 'phaser';
import { TILE } from '../config';
import type { UnitDef } from '../core/types';
import { loadData, validateData } from '../data';

type Rect = [number, number, number, number];

/** Body parts (x, y, w, h) for the placeholder mecha silhouettes, inside a 32x32 cell. */
const MEDIUM: Rect[] = [
  [13, 5, 6, 5], // head
  [11, 10, 10, 9], // torso
  [7, 10, 4, 5], // shoulder L
  [21, 10, 4, 5], // shoulder R
  [7, 15, 3, 6], // arm L
  [22, 15, 3, 6], // arm R
  [11, 19, 4, 8], // leg L
  [17, 19, 4, 8], // leg R
  [9, 26, 6, 2], // foot L
  [17, 26, 6, 2], // foot R
];
const LARGE: Rect[] = [
  [13, 3, 6, 5],
  [9, 8, 14, 11],
  [4, 8, 5, 7],
  [23, 8, 5, 7],
  [5, 15, 4, 6],
  [23, 15, 4, 6],
  [10, 19, 5, 8],
  [17, 19, 5, 8],
  [8, 26, 7, 2],
  [17, 26, 7, 2],
];

const hexToInt = (hex: string): number => parseInt(hex.replace('#', ''), 16);

/**
 * Generates every placeholder texture procedurally (tiles, unit icons, cursor, team frames)
 * so the vertical slice needs zero art files. Real pixel art replaces these later by key.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const gd = loadData();
    const problems = validateData(gd);
    if (problems.length) console.warn('[data] problems:\n' + problems.join('\n'));

    for (const u of Object.values(gd.units)) {
      this.makeUnit(u);
      this.makeMech(u);
    }
    this.makeMisc();

    this.scene.start('Map', { scenarioId: 's01' });
  }

  private makeUnit(u: UnitDef): void {
    const base = hexToInt(u.color);
    const c = Phaser.Display.Color.IntegerToColor(base);
    const dark = c.clone().darken(35).color;
    const light = c.clone().lighten(45).color;
    const rects = u.size === 'L' || u.size === 'LL' ? LARGE : MEDIUM;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x0b0c10, 1);
    for (const [x, y, w, h] of rects) g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(base, 1);
    for (const [x, y, w, h] of rects) g.fillRect(x, y, w, h);
    const [tx, ty, tw, th] = rects[1];
    g.fillStyle(dark, 1);
    g.fillRect(tx + tw - 3, ty + 1, 2, th - 2);
    const [hx, hy, hw] = rects[0];
    g.fillStyle(light, 1);
    g.fillRect(hx + 1, hy + 2, hw - 2, 1);
    g.generateTexture(`unit_${u.id}`, TILE, TILE);
    g.destroy();
  }

  /** 96x96 (110 for L/LL) placeholder mech for the battle screen, built from outlined blocks. */
  private makeMech(u: UnitDef): void {
    const base = hexToInt(u.color);
    const c = Phaser.Display.Color.IntegerToColor(base);
    const shade = c.clone().darken(30).color;
    const dark = c.clone().darken(55).color;
    const light = c.clone().lighten(40).color;
    const visor = u.id.startsWith('e_') ? 0xff6a6a : 0x7ff0ff;
    const s = u.size === 'L' || u.size === 'LL' ? 1.15 : 1;
    const size = Math.ceil(96 * s);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const R = (x: number, y: number, w: number, h: number, color: number): void => {
      g.fillStyle(color, 1);
      g.fillRect(Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s));
    };
    const parts: Rect[] = [
      [30, 26, 36, 28], // backpack
      [26, 46, 8, 12], [62, 46, 8, 12], // thrusters
      [35, 61, 11, 13], [50, 61, 11, 13], // thighs
      [34, 73, 12, 15], [50, 73, 12, 15], // shins
      [30, 87, 17, 7], [49, 87, 17, 7], // feet
      [38, 51, 20, 7], // waist
      [31, 56, 12, 10], [53, 56, 12, 10], // skirt armour
      [34, 29, 28, 23], // torso
      [22, 42, 10, 13], [64, 42, 10, 13], // upper arms
      [21, 54, 12, 13], [63, 54, 12, 13], // forearms
      [23, 66, 8, 7], [65, 66, 8, 7], // hands
      [20, 28, 14, 15], [62, 28, 14, 15], // shoulders
      [44, 25, 8, 4], // neck
      [41, 13, 14, 13], // head
      [39, 9, 5, 5], [52, 9, 5, 5], [46, 10, 4, 3], // v-fin
    ];
    for (const [x, y, w, h] of parts) R(x - 1, y - 1, w + 2, h + 2, 0x0b0c10);
    R(30, 26, 36, 28, dark);
    R(26, 46, 8, 12, dark);
    R(62, 46, 8, 12, dark);
    R(28, 56, 4, 3, 0xffb347);
    R(64, 56, 4, 3, 0xffb347);
    R(35, 61, 11, 13, shade);
    R(50, 61, 11, 13, shade);
    R(34, 73, 12, 15, base);
    R(50, 73, 12, 15, base);
    R(36, 75, 3, 4, light);
    R(52, 75, 3, 4, light);
    R(30, 87, 17, 7, dark);
    R(49, 87, 17, 7, dark);
    R(32, 88, 6, 2, shade);
    R(56, 88, 6, 2, shade);
    R(38, 51, 20, 7, dark);
    R(31, 56, 12, 10, base);
    R(53, 56, 12, 10, base);
    R(34, 29, 28, 23, base);
    R(36, 31, 11, 9, shade);
    R(49, 31, 11, 9, shade);
    R(36, 31, 11, 2, light);
    R(45, 41, 6, 7, dark);
    R(46, 42, 4, 2, visor);
    R(22, 42, 10, 13, shade);
    R(64, 42, 10, 13, shade);
    R(21, 54, 12, 13, base);
    R(63, 54, 12, 13, base);
    R(23, 66, 8, 7, dark);
    R(65, 66, 8, 7, dark);
    R(20, 28, 14, 15, base);
    R(62, 28, 14, 15, base);
    R(22, 30, 10, 3, light);
    R(64, 30, 10, 3, light);
    R(20, 40, 14, 3, shade);
    R(62, 40, 14, 3, shade);
    R(44, 25, 8, 4, dark);
    R(41, 13, 14, 13, base);
    R(42, 14, 12, 2, light);
    R(43, 18, 10, 3, visor);
    R(39, 9, 5, 5, 0xffd60a);
    R(52, 9, 5, 5, 0xffd60a);
    R(46, 10, 4, 3, 0xffd60a);
    g.generateTexture(`mech_${u.id}`, size, size);
    g.destroy();
  }

  private makeMisc(): void {
    const spark = this.make.graphics({ x: 0, y: 0 }, false);
    spark.fillStyle(0xffffff, 1);
    spark.fillRect(0, 0, 3, 3);
    spark.generateTexture('spark', 3, 3);
    spark.destroy();
    const cursor = this.make.graphics({ x: 0, y: 0 }, false);
    cursor.fillStyle(0xffffff, 1);
    const L = 9;
    for (const [cx, cy, sx, sy] of [
      [0, 0, 1, 1],
      [TILE, 0, -1, 1],
      [0, TILE, 1, -1],
      [TILE, TILE, -1, -1],
    ] as const) {
      const x0 = sx > 0 ? cx : cx - 2;
      const y0 = sy > 0 ? cy : cy - 2;
      cursor.fillRect(sx > 0 ? cx : cx - L, y0, L, 2);
      cursor.fillRect(x0, sy > 0 ? cy : cy - L, 2, L);
    }
    cursor.generateTexture('cursor', TILE, TILE);
    cursor.destroy();

    for (const [key, color] of [
      ['team_player', 0x60a5fa],
      ['team_enemy', 0xf87171],
    ] as const) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(color, 1);
      g.fillRect(0, 0, TILE, 1);
      g.fillRect(0, TILE - 1, TILE, 1);
      g.fillRect(0, 0, 1, TILE);
      g.fillRect(TILE - 1, 0, 1, TILE);
      g.generateTexture(key, TILE, TILE);
      g.destroy();
    }
  }
}
