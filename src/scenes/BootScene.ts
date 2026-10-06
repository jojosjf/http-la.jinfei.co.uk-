import Phaser from 'phaser';
import { TILE } from '../config';
import type { TerrainDef, UnitDef } from '../core/types';
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

    for (const t of Object.values(gd.terrain)) this.makeTile(t);
    for (const u of Object.values(gd.units)) this.makeUnit(u);
    this.makeMisc();

    this.scene.start('Map', { scenarioId: 's01' });
  }

  private makeTile(t: TerrainDef): void {
    const base = hexToInt(t.color);
    const c = Phaser.Display.Color.IntegerToColor(base);
    const dark = c.clone().darken(25).color;
    const light = c.clone().lighten(20).color;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(base, 1);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(dark, 0.5);
    g.fillRect(0, TILE - 1, TILE, 1);
    g.fillRect(TILE - 1, 0, 1, TILE);

    switch (t.id) {
      case 'forest':
        g.fillStyle(dark, 1);
        g.fillCircle(10, 12, 5);
        g.fillCircle(21, 17, 6);
        g.fillCircle(12, 23, 4);
        break;
      case 'mountain':
        g.fillStyle(dark, 1);
        g.fillTriangle(3, 27, 16, 5, 29, 27);
        g.fillStyle(light, 1);
        g.fillTriangle(13, 10, 16, 5, 19, 10);
        break;
      case 'city':
        g.fillStyle(dark, 1);
        g.fillRect(5, 10, 8, 17);
        g.fillRect(17, 5, 9, 22);
        g.fillStyle(light, 1);
        for (let y = 12; y < 26; y += 4) {
          g.fillRect(7, y, 2, 2);
          g.fillRect(19, y - 4, 2, 2);
          g.fillRect(23, y - 4, 2, 2);
        }
        break;
      case 'base':
        g.lineStyle(2, dark, 1);
        g.strokeRect(4, 4, 24, 24);
        g.fillStyle(light, 1);
        g.fillRect(9, 9, 4, 14);
        g.fillRect(19, 9, 4, 14);
        g.fillRect(13, 15, 6, 3);
        break;
      case 'sea':
      case 'river':
        g.lineStyle(1, light, 1);
        for (const y of [10, 21]) {
          g.beginPath();
          g.moveTo(3, y + 1);
          g.lineTo(9, y - 1);
          g.lineTo(15, y + 1);
          g.lineTo(21, y - 1);
          g.lineTo(27, y + 1);
          g.strokePath();
        }
        break;
      case 'road':
        g.fillStyle(light, 0.55);
        g.fillRect(0, 12, TILE, 8);
        break;
      default:
        g.fillStyle(dark, 0.6);
        g.fillRect(8, 8, 2, 2);
        g.fillRect(22, 19, 2, 2);
        g.fillRect(14, 25, 2, 2);
    }
    g.generateTexture(`tile_${t.id}`, TILE, TILE);
    g.destroy();
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

  private makeMisc(): void {
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
