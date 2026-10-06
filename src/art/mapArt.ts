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

  private cityBase(ox: number, oy: number): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, PAL.city.asphalt);
    rect(ctx, ox, oy, TILE, 3, PAL.city.sidewalk);
    rect(ctx, ox, oy + TILE - 3, TILE, 3, PAL.city.sidewalk);
    rect(ctx, ox, oy, 3, TILE, PAL.city.sidewalk);
    rect(ctx, ox + TILE - 3, oy, 3, TILE, PAL.city.sidewalk);
    rect(ctx, ox + 3, oy + 3, TILE - 6, 1, PAL.city.sidewalkDark);
    rect(ctx, ox + 3, oy + 3, 1, TILE - 6, PAL.city.sidewalkDark);
    rect(ctx, ox + 3, oy + TILE - 4, TILE - 6, 1, PAL.city.asphaltDark);
    rect(ctx, ox + TILE - 4, oy + 3, 1, TILE - 6, PAL.city.asphaltDark);
  }

  private baseConcrete(ox: number, oy: number): void {
    const ctx = this.ctx;
    rect(ctx, ox, oy, TILE, TILE, PAL.base.concrete);
    for (let k = 0; k < TILE; k += 8) {
      rect(ctx, ox + k, oy, 1, TILE, PAL.base.concreteDark);
      rect(ctx, ox, oy + k, TILE, 1, PAL.base.concreteDark);
      rect(ctx, ox + k + 1, oy, 1, TILE, PAL.base.line);
      rect(ctx, ox, oy + k + 1, TILE, 1, PAL.base.line);
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

  private buildings(ox: number, oy: number, rng: Rng): void {
    const bottom = oy + TILE - 5;
    const specs = [
      { bx: ox + 5, w: 10, h: ri(rng, 12, 20) },
      { bx: ox + 18, w: 10, h: ri(rng, 10, 22) },
    ];
    for (const s of specs) {
      const idx = ri(rng, 0, PAL.city.wall.length - 1);
      this.building(s.bx, bottom, s.w, s.h, PAL.city.wall[idx], PAL.city.wallShade[idx], rng);
    }
  }

  private building(bx: number, bottom: number, w: number, h: number, wall: string, shade: string, rng: Rng): void {
    const ctx = this.ctx;
    const top = bottom - h;
    rect(ctx, bx + 2, top + 2, w, h, PAL.shadow);
    rect(ctx, bx - 1, top - 1, w + 2, h + 2, PAL.outline);
    rect(ctx, bx, top, w, h, wall);
    rect(ctx, bx + w - 2, top, 2, h, shade);
    rect(ctx, bx, top, w, 2, rng() < 0.3 ? PAL.city.roofAlt : PAL.city.roof);
    for (let wy = top + 4; wy < bottom - 4; wy += 3) {
      for (let wx = bx + 2; wx < bx + w - 3; wx += 3) {
        rect(ctx, wx, wy, 1, 2, rng() < 0.55 ? PAL.city.winLit : PAL.city.winDark);
      }
    }
    rect(ctx, bx + Math.floor(w / 2) - 1, bottom - 3, 2, 3, PAL.city.door);
    if (h >= 18) rect(ctx, bx + 2, top - 4, 1, 4, PAL.outline);
  }

  private baseProps(x: number, y: number, ox: number, oy: number): void {
    const ctx = this.ctx;
    const bm = neighborMask(this.map, x, y, isBase, true);
    for (const [dir, draw] of [
      [N, (): void => this.hazardStrip(ox, oy, TILE, 1, true)],
      [S, (): void => this.hazardStrip(ox, oy + TILE - 1, TILE, 1, true)],
      [W, (): void => this.hazardStrip(ox, oy, 1, TILE, false)],
      [E, (): void => this.hazardStrip(ox + TILE - 1, oy, 1, TILE, false)],
    ] as const) {
      if (!(bm & dir)) draw();
    }
    if ((x + y) % 2 === 0) {
      const hx = ox + 3;
      const hy = oy + 6;
      const hw = 26;
      const hh = 21;
      rect(ctx, hx + 2, hy + 2, hw, hh, PAL.shadow);
      rect(ctx, hx - 1, hy - 1, hw + 2, hh + 2, PAL.outline);
      rect(ctx, hx, hy, hw, hh, PAL.base.hangar);
      for (let k = 0; k < hw; k += 2) rect(ctx, hx + k, hy, 1, 7, k % 4 === 0 ? PAL.base.hangarLight : PAL.base.hangarDark);
      rect(ctx, hx, hy + 7, hw, 1, PAL.outline);
      rect(ctx, hx + hw - 3, hy + 8, 3, hh - 8, PAL.base.hangarDark);
      rect(ctx, hx + 7, hy + 9, 12, 1, PAL.base.hazard);
      rect(ctx, hx + 7, hy + 10, 12, 11, PAL.base.door);
      rect(ctx, hx + 13, hy + 10, 1, 11, PAL.base.hangarDark);
      px(ctx, hx + 1, hy + 1, PAL.base.red);
    } else {
      const cx = ox + TILE / 2;
      const cy = oy + TILE / 2;
      disc(ctx, cx, cy, 11, PAL.base.padRing);
      disc(ctx, cx, cy, 10, PAL.base.pad);
      rect(ctx, cx - 6, cy - 6, 3, 13, PAL.base.padH);
      rect(ctx, cx + 3, cy - 6, 3, 13, PAL.base.padH);
      rect(ctx, cx - 3, cy - 1, 6, 3, PAL.base.padH);
    }
  }

  private hazardStrip(x: number, y: number, w: number, h: number, horizontal: boolean): void {
    const ctx = this.ctx;
    rect(ctx, x, y, w, h, PAL.base.hazardDark);
    const len = horizontal ? w : h;
    for (let k = 0; k < len; k += 6) {
      if (horizontal) rect(ctx, x + k, y, 3, h, PAL.base.hazard);
      else rect(ctx, x, y + k, w, 3, PAL.base.hazard);
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
