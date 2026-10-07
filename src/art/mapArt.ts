import Phaser from 'phaser';
import { TILE } from '../config';
import { mulberry32 } from '../core/rng';
import { E, N, S, W, neighborMask, tileHash } from '../core/tilemask';
import type { GameMap, TerrainDef } from '../core/types';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

const isWater = (id: string): boolean => id === 'sea' || id === 'river';
const isRoadLike = (id: string): boolean => id === 'road' || id === 'city' || id === 'base';
const isMountain = (id: string): boolean => id === 'mountain';
const isBase = (id: string): boolean => id === 'base';

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
const px = (ctx: Ctx, x: number, y: number, color: string): void => rect(ctx, x, y, 1, 1, color);
const ri = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

/** Pixel-perfect filled circle (no anti-aliasing). */
function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  if (r < 0) return;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy + 0.25));
    rect(ctx, cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}

/** Isosceles peak drawn row by row: lit left face, shaded right face, 1px outline, optional snow cap. */
function peak(
  ctx: Ctx,
  apexX: number,
  apexY: number,
  baseY: number,
  baseHalf: number,
  light: string,
  dark: string,
  snowRows: number,
): void {
  const h = baseY - apexY;
  for (let i = 0; i <= h; i++) {
    const y = apexY + i;
    const half = Math.round((baseHalf * i) / h);
    rect(ctx, apexX - half - 1, y, half * 2 + 3, 1, PAL.rock.outline);
    const snow = i < snowRows;
    rect(ctx, apexX - half, y, half + 1, 1, snow ? PAL.rock.snow : light);
    rect(ctx, apexX + 1, y, half, 1, snow ? PAL.rock.snowShade : dark);
  }
}

/**
 * Paints the whole map once into a canvas texture: edge-aware water, roads and bridges,
 * then props (trees, peaks, buildings, hangars) that may overlap neighbouring cells.
 * Everything is drawn with integer rectangles so it stays crisp pixel art.
 */
class MapPainter {
  constructor(
    private readonly ctx: Ctx,
    private readonly map: GameMap,
    private readonly seed: number,
  ) {}

  paint(): void {
    const { width, height } = this.map;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.base(x, y);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.edges(x, y);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.props(x, y);
    this.grid();
  }

  private id(x: number, y: number): string {
    return this.map.tiles[y][x];
  }

  private rng(x: number, y: number, salt = 0): Rng {
    return mulberry32(tileHash(x, y, this.seed + salt * 7919));
  }

  // ------------------------------------------------------------ pass 1: base fills

  private base(x: number, y: number): void {
    const ox = x * TILE;
    const oy = y * TILE;
    const rng = this.rng(x, y);
    switch (this.id(x, y)) {
      case 'forest':
        this.grass(ox, oy, rng, PAL.forestFloor.base, PAL.forestFloor.alt);
        break;
      case 'mountain':
        this.rockBase(x, y, ox, oy, rng);
        break;
      case 'road':
        this.road(x, y, ox, oy, rng);
        break;
      case 'city':
        this.cityBase(ox, oy);
        break;
      case 'base':
        this.baseConcrete(ox, oy);
        break;
      case 'sea':
      case 'river':
        this.water(x, y, ox, oy, rng);
        break;
      default:
        this.grass(ox, oy, rng, PAL.grass.base, PAL.grass.alt, this.zone(x, y));
        this.meadowProps(x, y, ox, oy, rng);
    }
  }

  /** Low-frequency 0..2 tone index so grass forms gentle patches instead of per-tile noise. */
  private zone(x: number, y: number): number {
    return tileHash(Math.floor(x / 3), Math.floor(y / 2), this.seed + 99) % 3;
  }

  /** Rare bushes, rocks and flower clusters on open ground. */
  private meadowProps(x: number, y: number, ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    if (neighborMask(this.map, x, y, isWater, false) !== 0) return;
    const roll = rng();
    if (roll < 0.07) {
      const bx = ox + ri(rng, 6, 24);
      const by = oy + ri(rng, 8, 24);
      disc(ctx, bx + 1, by + 2, 3, PAL.shadow);
      disc(ctx, bx, by, 4, PAL.tree.outline);
      disc(ctx, bx, by, 3, PAL.tree.dark);
      disc(ctx, bx - 1, by - 1, 1, PAL.tree.light);
      disc(ctx, bx + 4, by + 1, 3, PAL.tree.outline);
      disc(ctx, bx + 4, by + 1, 2, PAL.tree.mid);
    } else if (roll < 0.11) {
      const rx = ox + ri(rng, 4, 24);
      const ry = oy + ri(rng, 6, 26);
      rect(ctx, rx + 1, ry + 3, 5, 1, PAL.shadow);
      rect(ctx, rx - 1, ry, 6, 3, PAL.rock.outline);
      rect(ctx, rx, ry, 4, 2, PAL.rock.base);
      px(ctx, rx, ry, PAL.rock.light);
    } else if (roll < 0.17) {
      for (let i = 0; i < 3; i++) {
        const fx = ox + ri(rng, 3, 27);
        const fy = oy + ri(rng, 3, 27);
        px(ctx, fx, fy, i === 1 ? PAL.grass.flower2 : PAL.grass.flower);
        px(ctx, fx, fy + 1, PAL.grass.dark);
      }
    }
  }

  private grass(ox: number, oy: number, rng: Rng, base: string, alt: string, zone = 0): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, zone === 1 ? alt : zone === 2 ? PAL.grass.alt2 : base);
    for (let i = 0; i < 3; i++) {
      rect(ctx, ox + ri(rng, 0, 26), oy + ri(rng, 0, 27), ri(rng, 3, 6), ri(rng, 2, 5), rng() < 0.5 ? alt : PAL.grass.alt2);
    }
    for (let i = 0; i < 7; i++) {
      const bx = ox + ri(rng, 1, 30);
      const by = oy + ri(rng, 1, 29);
      const c = rng() < 0.6 ? PAL.grass.dark : PAL.grass.light;
      px(ctx, bx, by, c);
      px(ctx, bx, by + 1, c);
      if (rng() < 0.5) px(ctx, bx + 1, by, c);
    }
    if (rng() < 0.08) {
      const fx = ox + ri(rng, 2, 28);
      const fy = oy + ri(rng, 2, 28);
      px(ctx, fx, fy, PAL.grass.flower);
      px(ctx, fx + 1, fy, PAL.grass.flower2);
      px(ctx, fx, fy + 1, PAL.grass.dark);
    }
  }

  private water(x: number, y: number, ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    const wm = neighborMask(this.map, x, y, isWater);
    const deep = wm === (N | E | S | W);
    rect(ctx, ox, oy, TILE, TILE, deep ? PAL.water.deep : PAL.water.base);
    for (let i = 0; i < 3; i++) {
      rect(ctx, ox + ri(rng, 0, 24), oy + ri(rng, 0, 29), ri(rng, 4, 8), ri(rng, 1, 2), PAL.water.shallow);
    }
    for (let i = 0; i < 3; i++) {
      const wx = ox + ri(rng, 1, 26);
      const wy = oy + ri(rng, 2, 28);
      rect(ctx, wx, wy, 3, 1, PAL.water.wave);
      px(ctx, wx + 3, wy + 1, PAL.water.wave);
      rect(ctx, wx + 1, wy + 2, 3, 1, PAL.water.waveDark);
    }
  }

  private rockBase(x: number, y: number, ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, PAL.rock.base);
    for (let i = 0; i < 4; i++) {
      rect(ctx, ox + ri(rng, 0, 26), oy + ri(rng, 0, 27), ri(rng, 3, 7), ri(rng, 2, 4), rng() < 0.5 ? PAL.rock.light : PAL.rock.dark);
    }
    // grass fringe on sides facing non-mountain land so the rock does not end in a hard square
    const mm = neighborMask(this.map, x, y, (id) => isMountain(id) || isWater(id));
    if (!(mm & S)) rect(ctx, ox, oy + TILE - 3, TILE, 3, PAL.rock.grassFringe);
    if (!(mm & N)) rect(ctx, ox, oy, TILE, 2, PAL.rock.grassFringe);
    if (!(mm & E)) rect(ctx, ox + TILE - 2, oy, 2, TILE, PAL.rock.grassFringe);
    if (!(mm & W)) rect(ctx, ox, oy, 2, TILE, PAL.rock.grassFringe);
  }

  private road(x: number, y: number, ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    const wm = neighborMask(this.map, x, y, isWater, false);
    const bridgeEW = (wm & N) !== 0 && (wm & S) !== 0;
    const bridgeNS = (wm & E) !== 0 && (wm & W) !== 0;
    if (bridgeEW || bridgeNS) {
      this.water(x, y, ox, oy, rng);
      this.bridge(ox, oy, bridgeEW);
      return;
    }
    this.grass(ox, oy, rng, PAL.grass.base, PAL.grass.alt);
    const rm = neighborMask(this.map, x, y, isRoadLike, true);
    const cx = ox + TILE / 2;
    const cy = oy + TILE / 2;
    const shape = (color: string, inset: number): void => {
      const s = 8 + inset;
      rect(ctx, cx - s, cy - s, s * 2, s * 2, color);
      if (rm & N) rect(ctx, cx - s, oy, s * 2, TILE / 2, color);
      if (rm & S) rect(ctx, cx - s, cy, s * 2, TILE / 2, color);
      if (rm & E) rect(ctx, cx, cy - s, TILE / 2, s * 2, color);
      if (rm & W) rect(ctx, ox, cy - s, TILE / 2, s * 2, color);
    };
    shape(PAL.dirt.edge, 1);
    shape(PAL.dirt.base, 0);
    // wheel tracks along the arms
    const h = (rm & E) !== 0 || (rm & W) !== 0;
    const v = (rm & N) !== 0 || (rm & S) !== 0;
    if (h) {
      const x0 = rm & W ? ox : cx - 8;
      const x1 = rm & E ? ox + TILE : cx + 8;
      rect(ctx, x0, cy - 4, x1 - x0, 1, PAL.dirt.track);
      rect(ctx, x0, cy + 3, x1 - x0, 1, PAL.dirt.track);
    }
    if (v) {
      const y0 = rm & N ? oy : cy - 8;
      const y1 = rm & S ? oy + TILE : cy + 8;
      rect(ctx, cx - 4, y0, 1, y1 - y0, PAL.dirt.track);
      rect(ctx, cx + 3, y0, 1, y1 - y0, PAL.dirt.track);
    }
    for (let i = 0; i < 4; i++) px(ctx, cx - 7 + ri(rng, 0, 14), cy - 7 + ri(rng, 0, 14), PAL.dirt.light);
  }

  private bridge(ox: number, oy: number, ew: boolean): void {
    const ctx = this.ctx;
    const c = 16;
    if (ew) {
      rect(ctx, ox, oy + c + 9, TILE, 2, PAL.shadow);
      rect(ctx, ox, oy + c - 8, TILE, 16, PAL.bridge.plank);
      for (let k = 0; k < TILE; k += 4) rect(ctx, ox + k, oy + c - 8, 1, 16, PAL.bridge.plankDark);
      rect(ctx, ox, oy + c - 7, TILE, 1, PAL.bridge.plankLight);
      rect(ctx, ox, oy + c - 10, TILE, 2, PAL.bridge.rail);
      rect(ctx, ox, oy + c + 8, TILE, 2, PAL.bridge.rail);
      for (let k = 2; k < TILE; k += 8) {
        rect(ctx, ox + k, oy + c - 12, 2, 4, PAL.bridge.rail);
        rect(ctx, ox + k, oy + c + 7, 2, 4, PAL.bridge.rail);
      }
    } else {
      rect(ctx, ox + c + 9, oy, 2, TILE, PAL.shadow);
      rect(ctx, ox + c - 8, oy, 16, TILE, PAL.bridge.plank);
      for (let k = 0; k < TILE; k += 4) rect(ctx, ox + c - 8, oy + k, 16, 1, PAL.bridge.plankDark);
      rect(ctx, ox + c - 7, oy, 1, TILE, PAL.bridge.plankLight);
      rect(ctx, ox + c - 10, oy, 2, TILE, PAL.bridge.rail);
      rect(ctx, ox + c + 8, oy, 2, TILE, PAL.bridge.rail);
      for (let k = 2; k < TILE; k += 8) {
        rect(ctx, ox + c - 12, oy + k, 4, 2, PAL.bridge.rail);
        rect(ctx, ox + c + 7, oy + k, 4, 2, PAL.bridge.rail);
      }
    }
  }

  /** 坊市 ground: grey brick paving with offset courses. */
  private cityBase(ox: number, oy: number): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, PAL.city.paving);
    for (let row = 0; row < TILE; row += 4) {
      rect(ctx, ox, oy + row, TILE, 1, PAL.city.pavingDark);
      const off = (row / 4) % 2 ? 4 : 0;
      for (let col = off; col < TILE; col += 8) rect(ctx, ox + col, oy + row, 1, 4, PAL.city.pavingDark);
      rect(ctx, ox, oy + row + 1, TILE, 1, PAL.city.pavingLight);
    }
  }

  /** 山门 ground: large flagstones with dark joints. */
  private baseConcrete(ox: number, oy: number): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, PAL.base.stone);
    for (const [x, y, w, h] of [
      [0, 0, 15, 11],
      [16, 0, 16, 7],
      [16, 8, 16, 9],
      [0, 12, 10, 10],
      [11, 12, 4, 10],
      [0, 23, 18, 9],
      [16, 18, 16, 6],
      [19, 25, 13, 7],
    ] as const) {
      rect(ctx, ox + x, oy + y, w, 1, PAL.base.stoneLight);
      rect(ctx, ox + x + w - 1, oy + y, 1, h, PAL.base.joint);
      rect(ctx, ox + x, oy + y + h - 1, w, 1, PAL.base.joint);
    }
  }

  // ------------------------------------------------------------ pass 2: edge transitions

  private edges(x: number, y: number): void {
    const ctx = this.ctx;
    const ox = x * TILE;
    const oy = y * TILE;
    const id = this.id(x, y);
    if (isWater(id)) {
      const lm = neighborMask(this.map, x, y, (t) => !isWater(t), false);
      if (lm & N) {
        rect(ctx, ox, oy, TILE, 2, PAL.water.foam);
        rect(ctx, ox, oy + 2, TILE, 1, PAL.water.shallow);
      }
      if (lm & S) {
        rect(ctx, ox, oy + TILE - 2, TILE, 2, PAL.water.foam);
        rect(ctx, ox, oy + TILE - 3, TILE, 1, PAL.water.shallow);
      }
      if (lm & W) {
        rect(ctx, ox, oy, 2, TILE, PAL.water.foam);
        rect(ctx, ox + 2, oy, 1, TILE, PAL.water.shallow);
      }
      if (lm & E) {
        rect(ctx, ox + TILE - 2, oy, 2, TILE, PAL.water.foam);
        rect(ctx, ox + TILE - 3, oy, 1, TILE, PAL.water.shallow);
      }
      return;
    }
    if (id === 'road') {
      const wm = neighborMask(this.map, x, y, isWater, false);
      if (((wm & N) && (wm & S)) || ((wm & E) && (wm & W))) return; // bridge: no sand
    }
    const wm = neighborMask(this.map, x, y, isWater, false);
    if (wm & N) {
      rect(ctx, ox, oy, TILE, 3, PAL.sand.base);
      rect(ctx, ox, oy + 3, TILE, 1, PAL.sand.dark);
    }
    if (wm & S) {
      rect(ctx, ox, oy + TILE - 3, TILE, 3, PAL.sand.base);
      rect(ctx, ox, oy + TILE - 4, TILE, 1, PAL.sand.dark);
    }
    if (wm & W) {
      rect(ctx, ox, oy, 3, TILE, PAL.sand.base);
      rect(ctx, ox + 3, oy, 1, TILE, PAL.sand.dark);
    }
    if (wm & E) {
      rect(ctx, ox + TILE - 3, oy, 3, TILE, PAL.sand.base);
      rect(ctx, ox + TILE - 4, oy, 1, TILE, PAL.sand.dark);
    }
  }

  // ------------------------------------------------------------ pass 3: props

  private props(x: number, y: number): void {
    const ox = x * TILE;
    const oy = y * TILE;
    const rng = this.rng(x, y, 1);
    switch (this.id(x, y)) {
      case 'forest':
        this.trees(ox, oy, rng);
        break;
      case 'mountain':
        this.peaks(ox, oy, rng);
        break;
      case 'city':
        this.buildings(ox, oy, rng);
        break;
      case 'base':
        this.baseProps(x, y, ox, oy);
        break;
      default:
        break;
    }
  }

  private trees(ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    const slots: Array<[number, number]> = [
      [8, 10],
      [22, 8],
      [12, 24],
      [26, 22],
      [4, 22],
      [18, 16],
    ];
    const count = ri(rng, 3, 4);
    const chosen = slots
      .map((s) => ({ s, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .slice(0, count)
      .map(({ s }) => ({ x: ox + s[0] + ri(rng, -2, 2), y: oy + s[1] + ri(rng, -2, 2), r: ri(rng, 5, 6) }))
      .sort((a, b) => a.y - b.y);
    for (const t of chosen) {
      disc(ctx, t.x + 1, t.y + 3, t.r - 1, PAL.shadow);
      rect(ctx, t.x - 1, t.y + t.r - 2, 2, 4, PAL.tree.trunk);
      px(ctx, t.x, t.y + t.r, PAL.tree.trunkDark);
      disc(ctx, t.x, t.y, t.r + 1, PAL.tree.outline);
      disc(ctx, t.x, t.y, t.r, PAL.tree.dark);
      disc(ctx, t.x - 1, t.y - 1, t.r - 2, PAL.tree.mid);
      disc(ctx, t.x - 2, t.y - 2, t.r - 4, PAL.tree.light);
    }
  }

  private peaks(ox: number, oy: number, rng: Rng): void {
    const ctx = this.ctx;
    if (rng() < 0.6) {
      peak(ctx, ox + ri(rng, 6, 26), oy + ri(rng, 8, 11), oy + 26, ri(rng, 7, 9), PAL.rock.base, PAL.rock.dark, 0);
    }
    const snow = rng() < 0.45 ? ri(rng, 4, 7) : 0;
    peak(ctx, ox + ri(rng, 12, 20), oy + ri(rng, 2, 5), oy + 27, ri(rng, 12, 14), PAL.rock.light, PAL.rock.dark, snow);
    for (let i = 0; i < 2; i++) {
      const rx = ox + ri(rng, 2, 27);
      const ry = oy + ri(rng, 24, 29);
      rect(ctx, rx, ry, 3, 2, PAL.rock.dark);
      px(ctx, rx, ry, PAL.rock.light);
    }
  }

  /** 坊市: two small houses with white walls, dark tiled roofs with upturned eaves, red doors. */
  private buildings(ox: number, oy: number, rng: Rng): void {
    const bottom = oy + TILE - 3;
    const tall = rng() < 0.5;
    this.house(ox + 2, bottom, 13, tall ? 13 : 10, rng);
    this.house(ox + 17, bottom - (tall ? 0 : 2), 13, tall ? 10 : 14, rng);
  }

  private house(bx: number, bottom: number, w: number, h: number, rng: Rng): void {
    const ctx = this.ctx;
    const top = bottom - h;
    const i = ri(rng, 0, PAL.city.wall.length - 1);
    rect(ctx, bx + 2, top + 3, w, h - 1, PAL.shadow);
    // walls
    rect(ctx, bx - 1, top + 3, w + 2, h - 2, PAL.outline);
    rect(ctx, bx, top + 4, w, h - 4, PAL.city.wall[i]);
    rect(ctx, bx + w - 2, top + 4, 2, h - 4, PAL.city.wallShade[i]);
    // red pillars and door
    rect(ctx, bx + 1, top + 5, 1, h - 6, PAL.city.pillar);
    rect(ctx, bx + w - 3, top + 5, 1, h - 6, PAL.city.pillar);
    rect(ctx, bx + Math.floor(w / 2) - 2, bottom - 5, 4, 5, PAL.city.door);
    rect(ctx, bx + Math.floor(w / 2) - 2, bottom - 5, 4, 1, PAL.city.lattice);
    if (h >= 12) rect(ctx, bx + 3, top + 6, 3, 2, PAL.city.lattice);
    // roof with upturned eaves
    rect(ctx, bx - 2, top, w + 4, 4, PAL.outline);
    rect(ctx, bx - 1, top + 1, w + 2, 2, PAL.city.roof);
    rect(ctx, bx, top - 1, w, 2, PAL.outline);
    rect(ctx, bx + 1, top, w - 2, 1, PAL.city.roofLight);
    px(ctx, bx - 3, top - 1, PAL.outline);
    px(ctx, bx + w + 2, top - 1, PAL.outline);
    px(ctx, bx - 2, top, PAL.city.roofDark);
    px(ctx, bx + w + 1, top, PAL.city.roofDark);
    rect(ctx, bx, top + 3, w, 1, PAL.city.roofDark);
    // lantern
    if (rng() < 0.6) {
      const lx = bx + (rng() < 0.5 ? 2 : w - 3);
      rect(ctx, lx, top + 4, 1, 1, PAL.outline);
      rect(ctx, lx - 1, top + 5, 3, 3, PAL.city.lantern);
      px(ctx, lx, top + 6, PAL.city.lanternGlow);
    }
  }

  /** 山门 grounds: a 牌坊 gate and a glowing 阵法台 altar alternate, ringed by a stone balustrade. */
  private baseProps(x: number, y: number, ox: number, oy: number): void {
    const bm = neighborMask(this.map, x, y, isBase, true);
    if (!(bm & N)) this.balustrade(ox, oy, TILE, true);
    if (!(bm & S)) this.balustrade(ox, oy + TILE - 3, TILE, true);
    if (!(bm & W)) this.balustrade(ox, oy, TILE, false);
    if (!(bm & E)) this.balustrade(ox + TILE - 3, oy, TILE, false);
    if ((x + y) % 2 === 0) this.paifang(ox, oy);
    else this.altar(ox, oy);
  }

  private paifang(ox: number, oy: number): void {
    const ctx = this.ctx;
    const l = ox + 6;
    const r = ox + 24;
    const top = oy + 8;
    const bottom = oy + 28;
    rect(ctx, l + 2, top + 4, 2, bottom - top - 2, PAL.shadow);
    rect(ctx, r + 2, top + 4, 2, bottom - top - 2, PAL.shadow);
    for (const cx of [l, r]) {
      rect(ctx, cx - 1, top + 2, 4, bottom - top - 2, PAL.outline);
      rect(ctx, cx, top + 3, 2, bottom - top - 4, PAL.base.pillar);
      rect(ctx, cx + 1, top + 3, 1, bottom - top - 4, PAL.base.pillarDark);
      rect(ctx, cx - 2, bottom - 2, 6, 2, PAL.base.stoneDark);
    }
    // beam and plaque
    rect(ctx, l - 1, top + 6, r - l + 4, 3, PAL.outline);
    rect(ctx, l, top + 7, r - l + 2, 1, PAL.base.pillar);
    rect(ctx, ox + 12, top + 9, 8, 5, PAL.outline);
    rect(ctx, ox + 13, top + 10, 6, 3, PAL.base.plaque);
    rect(ctx, ox + 14, top + 11, 4, 1, PAL.base.gold);
    // roof with upturned eaves
    rect(ctx, l - 4, top + 1, r - l + 10, 4, PAL.outline);
    rect(ctx, l - 3, top + 2, r - l + 8, 2, PAL.base.roof);
    rect(ctx, l - 1, top - 1, r - l + 4, 3, PAL.outline);
    rect(ctx, l, top, r - l + 2, 1, PAL.base.roofLight);
    px(ctx, l - 5, top, PAL.outline);
    px(ctx, r + 6, top, PAL.outline);
    px(ctx, ox + 16, top - 2, PAL.base.gold);
  }

  private altar(ox: number, oy: number): void {
    const ctx = this.ctx;
    const cx = ox + TILE / 2;
    const cy = oy + TILE / 2 + 1;
    disc(ctx, cx + 1, cy + 2, 11, PAL.shadow);
    disc(ctx, cx, cy, 12, PAL.outline);
    disc(ctx, cx, cy, 11, PAL.base.altarDark);
    disc(ctx, cx, cy, 10, PAL.base.altar);
    disc(ctx, cx, cy, 7, PAL.base.runeDim);
    disc(ctx, cx, cy, 6, PAL.base.altar);
    disc(ctx, cx, cy, 2, PAL.base.rune);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      px(ctx, Math.round(cx + Math.cos(a) * 8.5), Math.round(cy + Math.sin(a) * 8.5), PAL.base.rune);
    }
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]] as const) px(ctx, cx + dx, cy + dy, PAL.base.runeDim);
  }

  private balustrade(x: number, y: number, len: number, horizontal: boolean): void {
    const ctx = this.ctx;
    if (horizontal) {
      rect(ctx, x, y, len, 3, PAL.base.railDark);
      rect(ctx, x, y, len, 1, PAL.base.rail);
      for (let k = 2; k < len; k += 7) rect(ctx, x + k, y - 1, 2, 4, PAL.base.rail);
    } else {
      rect(ctx, x, y, 3, len, PAL.base.railDark);
      rect(ctx, x, y, 1, len, PAL.base.rail);
      for (let k = 2; k < len; k += 7) rect(ctx, x - 1, y + k, 4, 2, PAL.base.rail);
    }
  }

  // ------------------------------------------------------------ grid

  private grid(): void {
    const ctx = this.ctx;
    const W_ = this.map.width * TILE;
    const H_ = this.map.height * TILE;
    for (let x = TILE - 1; x < W_; x += TILE) rect(ctx, x, 0, 1, H_, PAL.grid);
    for (let y = TILE - 1; y < H_; y += TILE) rect(ctx, 0, y, W_, 1, PAL.grid);
  }
}

/** Renders the map into a canvas texture and returns its key. Re-rendering replaces the texture. */
export function renderMapTexture(
  scene: Phaser.Scene,
  map: GameMap,
  _terrain: Record<string, TerrainDef>,
  seed: number,
  key = 'map',
): string {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, map.width * TILE, map.height * TILE);
  if (!tex) throw new Error('could not create map canvas texture');
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  new MapPainter(ctx, map, seed).paint();
  tex.refresh();
  return key;
}
