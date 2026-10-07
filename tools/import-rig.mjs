#!/usr/bin/env node
/**
 * Import mechs from the 「天工仙甲」 ragdoll prototype (mecha-ragdoll-v1) into the game.
 *
 *   node tools/import-rig.mjs <prototype-dir> [id ...] [--out public/mechs] [--scale 0.32] [--max-height 140] [--max-width 170] [--colors 48] [--species human] [--facing left]
 *
 * For each mech it reads characters.json, rigs/<id>.json and the 4x4 part atlas, then:
 *  1. finds every part like the prototype does (largest opaque connected region per cell);
 *  2. resizes each part to its rig display size x scale with an area-average filter,
 *     hardens the alpha edge and maps all parts onto one shared palette (real pixel art at game size);
 *  3. mirrors the mech when its weapon is on the left so the weapon side faces forward (+x);
 *  4. packs the parts into <id>.png and writes <id>.rig.json (rig v2, see src/core/rig.ts)
 *     plus a 32x32 map icon composed from the rest pose;
 *  5. registers the mech in <out>/index.json and prints a report of anything suspicious.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PNG } from 'pngjs';

// ---------------------------------------------------------------- image helpers

export function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

export function newImage(w, h) {
  return { width: w, height: h, data: new Uint8Array(w * h * 4) };
}

export function writePng(path, img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** Largest opaque 4-connected region per atlas cell (alpha > 64, >= 50 px), like the prototype's slicer. */
export function findRegions(img, cols, rows) {
  const { width: W, height: H, data } = img;
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  const regions = [];
  for (let start = 0; start < W * H; start++) {
    if (visited[start] || data[start * 4 + 3] <= 64) continue;
    let read = 0;
    let write = 1;
    let count = 0;
    let sx = 0;
    let sy = 0;
    let x0 = W;
    let y0 = H;
    let x1 = 0;
    let y1 = 0;
    queue[0] = start;
    visited[start] = 1;
    while (read < write) {
      const p = queue[read++];
      const x = p % W;
      const y = (p - x) / W;
      count++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const n = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of n) {
        if (q >= 0 && !visited[q] && data[q * 4 + 3] > 64) {
          visited[q] = 1;
          queue[write++] = q;
        }
      }
    }
    if (count < 50) continue;
    const tile = Math.min(cols - 1, Math.floor((sx / count / W) * cols)) + cols * Math.min(rows - 1, Math.floor((sy / count / H) * rows));
    if (!regions[tile] || count > regions[tile].count) regions[tile] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count };
  }
  return regions;
}

/** Area-average resample of a source rectangle to w x h (premultiplied), optional horizontal mirror. */
export function resample(src, rect, w, h, mirror = false) {
  const out = newImage(w, h);
  const fx = rect.w / w;
  const fy = rect.h / h;
  for (let ty = 0; ty < h; ty++) {
    const syA = rect.y + ty * fy;
    const syB = syA + fy;
    for (let tx = 0; tx < w; tx++) {
      const sxA = rect.x + tx * fx;
      const sxB = sxA + fx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let y = Math.floor(syA); y < Math.ceil(syB); y++) {
        const wy = Math.min(syB, y + 1) - Math.max(syA, y);
        if (wy <= 0 || y < 0 || y >= src.height) continue;
        for (let x = Math.floor(sxA); x < Math.ceil(sxB); x++) {
          const wx = Math.min(sxB, x + 1) - Math.max(sxA, x);
          if (wx <= 0 || x < 0 || x >= src.width) continue;
          const k = wx * wy;
          const i = (y * src.width + x) * 4;
          const al = src.data[i + 3] / 255;
          r += src.data[i] * al * k;
          g += src.data[i + 1] * al * k;
          b += src.data[i + 2] * al * k;
          a += al * k;
          area += k;
        }
      }
      const o = (ty * w + (mirror ? w - 1 - tx : tx)) * 4;
      const alpha = area > 0 ? a / area : 0;
      if (alpha >= 0.5) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

/** Median-cut palette of at most n colours over the opaque pixels of all images. */
export function medianCut(images, n) {
  const px = [];
  for (const img of images) {
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) px.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
  }
  if (px.length === 0) return [];
  let boxes = [px];
  while (boxes.length < n) {
    let bi = -1;
    let bestRange = 0;
    let bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          bi = i;
          bestCh = c;
        }
      }
    });
    if (bi < 0 || bestRange < 6) break;
    const box = boxes[bi].sort((p, q) => p[bestCh] - q[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    const s = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) s[c] += p[c];
    return s.map((v) => Math.round(v / box.length));
  });
}

export function applyPalette(img, pal) {
  if (pal.length === 0) return;
  const cache = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    let best = cache.get(key);
    if (best === undefined) {
      let bd = Infinity;
      pal.forEach((p, k) => {
        const dr = p[0] - img.data[i];
        const dg = p[1] - img.data[i + 1];
        const db = p[2] - img.data[i + 2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      cache.set(key, best);
    }
    const p = pal[best];
    img.data[i] = p[0];
    img.data[i + 1] = p[1];
    img.data[i + 2] = p[2];
  }
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      if (!src.data[s + 3]) continue;
      const X = dx + x;
      const Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      const d = (Y * dst.width + X) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = 255;
    }
  }
}

/** 1px outline around the opaque silhouette (makes tiny map icons readable). */
export function outline(img, rgb) {
  const { width: W, height: H, data } = img;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] === 255;
  const marks = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push((y * W + x) * 4);
    }
  }
  for (const i of marks) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
}

/** Shelf packer with 1px padding. Returns frames in input order and the sheet size. */
export function pack(images, maxWidth = 256) {
  const order = images.map((img, i) => i).sort((a, b) => images[b].height - images[a].height);
  const frames = [];
  let x = 1;
  let y = 1;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const img = images[i];
    if (x + img.width + 1 > maxWidth && x > 1) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    frames[i] = { x, y, w: img.width, h: img.height };
    x += img.width + 1;
    width = Math.max(width, x);
    shelf = Math.max(shelf, img.height);
  }
  const sheet = newImage(width, y + shelf + 1);
  images.forEach((img, i) => blit(sheet, img, frames[i].x, frames[i].y));
  return { frames, sheet };
}

/** 32x32 map icon: compose the rest pose in layer order, fit it into 28x27, outline it. */
export function composeIcon(parts, images, palette) {
  const minX = Math.min(...parts.map((p) => p.x - p.w / 2));
  const maxX = Math.max(...parts.map((p) => p.x + p.w / 2));
  const top = Math.min(...parts.map((p) => p.y - p.h / 2));
  const comp = newImage(Math.ceil(maxX - minX) + 2, Math.ceil(-top) + 2);
  parts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.layer - b.p.layer || a.i - b.i)
    .forEach(({ p, i }) => blit(comp, images[i], Math.round(p.x - p.w / 2 - minX), Math.round(p.y - p.h / 2 - top)));
  const fit = Math.min(28 / comp.width, 27 / comp.height);
  const iw = Math.max(1, Math.round(comp.width * fit));
  const ih = Math.max(1, Math.round(comp.height * fit));
  const small = resample(comp, { x: 0, y: 0, w: comp.width, h: comp.height }, iw, ih);
  if (palette?.length) applyPalette(small, palette);
  const icon = newImage(32, 32);
  blit(icon, small, Math.floor((32 - iw) / 2), 28 - ih);
  outline(icon, [11, 12, 16]);
  return icon;
}

// ---------------------------------------------------------------- conversion

const r2 = (v) => Math.round(v * 100) / 100;

/** 神兽 / 妖兽 among the 天工仙甲 roster; everything else is a 机关傀儡 (construct). */
const BEASTS = new Set(['baize', 'qianlin', 'zhulong']);
/** Cloth / hair parts that get secondary motion in game (mirrors src/core/follow.ts FOLLOW_PART). */
const FOLLOW = /^(hair|robe|skirt|sleeve|ribbon|sash|tassel|cape|scarf)/;

export function convertMech(protoDir, id, opts = {}) {
  const scaleOpt = opts.scale ?? 0.32;
  const maxHeight = opts.maxHeight ?? 140;
  const maxWidth = opts.maxWidth ?? 170;
  const colors = opts.colors ?? 48;
  const chars = JSON.parse(readFileSync(join(protoDir, 'characters.json'), 'utf8'));
  const ch = chars.find((c) => c.id === id);
  if (!ch) throw new Error(`${id}: not in characters.json`);
  const src = JSON.parse(readFileSync(join(protoDir, 'rigs', `${id}.json`), 'utf8'));
  const atlas = readPng(join(protoDir, src.atlas ?? ch.atlas));
  const cols = src.atlasColumns ?? 4;
  const rows = src.atlasRows ?? 4;
  const report = [];

  // Explicit crop rectangles (atlas-regions.json, one per tile) beat alpha-based detection.
  const regionsPath = join(protoDir, 'atlas-regions.json');
  const explicit = existsSync(regionsPath) ? JSON.parse(readFileSync(regionsPath, 'utf8')) : null;
  const regions = explicit ? explicit.map((r) => (r && r.w > 0 && r.h > 0 ? { x: r.x, y: r.y, w: r.w, h: r.h } : undefined)) : findRegions(atlas, cols, rows);
  if (explicit) report.push(`使用 atlas-regions.json 的 ${regions.filter(Boolean).length} 个裁切矩形（${cols}×${rows} 图集）`);
  const cw = atlas.width / cols;
  const chh = atlas.height / rows;
  if (!explicit) regions.forEach((r, tile) => {
    if (!r) return;
    const cx0 = (tile % cols) * cw;
    const cy0 = Math.floor(tile / cols) * chh;
    const over = Math.max(cx0 - r.x, r.x + r.w - (cx0 + cw), cy0 - r.y, r.y + r.h - (cy0 + chh));
    if (over > 2) report.push(`格 ${tile} 越界 ${Math.round(over)}px（部件超出 4×4 格子）`);
  });

  const bodies = src.bodies;
  const minY = Math.min(...bodies.map((b) => b.y - b.h / 2));
  // Stand on the soles when there are feet (a hanging sword or tail must not lift the figure).
  const feet = bodies.filter((b) => /^foot/.test(b.id));
  const maxY = feet.length ? Math.max(...feet.map((b) => b.y + b.h / 2)) : Math.max(...bodies.map((b) => b.y + b.h / 2));
  const restHeight = maxY - minY;
  const restWidth = Math.max(...bodies.map((b) => b.x + b.w / 2)) - Math.min(...bodies.map((b) => b.x - b.w / 2));
  const scale = Math.min(scaleOpt, maxHeight / restHeight, maxWidth / restWidth);
  // Held items: leaves joined to a hand by a detachable joint (or a part named weapon).
  const heldIds = new Set(bodies.filter((b) => b.id === 'weapon').map((b) => b.id));
  for (const j of src.joints) {
    if (!j.detachable) continue;
    if (/hand|forearm/.test(j.a) && !/arm|hand/.test(j.b)) heldIds.add(j.b);
    if (/hand|forearm/.test(j.b) && !/arm|hand/.test(j.a)) heldIds.add(j.a);
  }
  const heldX = bodies.filter((b) => heldIds.has(b.id)).map((b) => b.x);
  // Mirror when the held item(s) sit on the left, so the weapon side faces forward (+x).
  let mirror = heldX.length > 0 && heldX.reduce((a, v) => a + v, 0) / heldX.length < -1;
  const isHuman = (src.species ?? ch.species ?? opts.species) === 'human' || bodies.some((b) => /^hair/.test(b.id));
  if (isHuman) {
    // People face where their face looks, not where the sword hangs: the brief asks for art facing right,
    // so only mirror when the package says the figure faces left.
    mirror = (src.facing ?? ch.facing ?? opts.facing) === 'left';
  } else if (heldX.length === 0) {
    // No hand-held weapon: face the head (or drill / beak) forward.
    const rootBody = bodies.find((b) => b.id === 'torso') ?? bodies.slice().sort((a, b) => b.mass - a.mass)[0];
    const lead = bodies.find((b) => b.id === 'head') ?? bodies.find((b) => b.id === 'drill') ?? bodies.find((b) => b.id === 'beak');
    if (lead && rootBody && lead !== rootBody) mirror = lead.x < rootBody.x - 4;
    else if (lead) {
      const tail = bodies.find((b) => /^tail/.test(b.id));
      mirror = tail ? lead.x < tail.x : false;
    }
  }
  const sx = mirror ? -1 : 1;

  const images = [];
  const parts = [];
  for (const b of bodies) {
    const region = regions[b.tile];
    if (!region) {
      report.push(`部件 ${b.id}：图集第 ${b.tile} 格是空的`);
      continue;
    }
    const w = Math.max(1, Math.round(b.w * scale));
    const h = Math.max(1, Math.round(b.h * scale));
    images.push(resample(atlas, region, w, h, mirror));
    parts.push({ id: b.id, x: r2(b.x * sx * scale), y: r2((b.y - maxY) * scale), w, h, layer: b.layer ?? 0, mass: b.mass ?? 1 });
  }
  const ids = new Set(parts.map((p) => p.id));
  const joints = [];
  for (const j of src.joints) {
    if (!ids.has(j.a) || !ids.has(j.b)) continue;
    joints.push({
      a: j.a,
      b: j.b,
      anchor: [r2(j.anchor[0] * sx * scale), r2((j.anchor[1] - maxY) * scale)],
      min: mirror ? -j.max : j.min,
      max: mirror ? -j.min : j.max,
      detachable: Boolean(j.detachable),
    });
  }
  const root = ids.has('torso') ? 'torso' : parts.slice().sort((a, b) => b.mass - a.mass)[0].id;

  // Drop parts that lost their connection to the root (e.g. a missing tile in the chain).
  const reached = new Set([root]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const j of joints) {
      if (reached.has(j.a) !== reached.has(j.b)) {
        reached.add(reached.has(j.a) ? j.b : j.a);
        grew = true;
      }
    }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    if (reached.has(parts[i].id)) continue;
    report.push(`部件 ${parts[i].id}：与主体断开（上游部件缺失），已移除`);
    parts.splice(i, 1);
    images.splice(i, 1);
  }
  for (let i = joints.length - 1; i >= 0; i--) if (!reached.has(joints[i].a) || !reached.has(joints[i].b)) joints.splice(i, 1);

  const palette = medianCut(images, colors);
  for (const img of images) applyPalette(img, palette);
  const { frames, sheet } = pack(images);
  parts.forEach((p, i) => (p.frame = frames[i]));

  const outId = opts.as ?? id;
  const species = src.species ?? ch.species ?? opts.species ?? (BEASTS.has(id) ? 'beast' : bodies.some((b) => /^hair/.test(b.id)) ? 'human' : 'construct');
  const rig = {
    id: outId,
    name: src.name ?? ch.name ?? id,
    version: 2,
    image: `${outId}.png`,
    species,
    ...(parts.some((p) => FOLLOW.test(p.id)) ? { follow: parts.map((p) => p.id).filter((pid) => FOLLOW.test(pid)) } : {}),
    root,
    height: Math.round(restHeight * scale),
    parts: parts.map(({ id: pid, frame, x, y, w, h, layer, mass }) => ({ id: pid, frame, x, y, w, h, layer, mass })),
    joints,
    source: { from: 'mecha-ragdoll-v1', scale: r2(scale), mirrored: mirror, colors: palette.length },
  };

  const icon = composeIcon(parts, images, palette);

  // Portrait for the battle panel (28x28) and dialogue (64x64), if the package has one.
  let portraits = null;
  const portraitPath = ['original/approved-portrait.png', 'portrait.png'].map((f) => join(protoDir, f)).find((f) => existsSync(f));
  if (portraitPath) {
    const src = readPng(portraitPath);
    const side = Math.min(src.width, src.height);
    const rect = { x: Math.floor((src.width - side) / 2), y: 0, w: side, h: side };
    const opaque = (img) => {
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
      return img;
    };
    portraits = { small: opaque(resample(src, rect, 28, 28)), large: opaque(resample(src, rect, 64, 64)) };
  }

  return { rig, sheet, icon, portraits, report };
}

// ---------------------------------------------------------------- cli

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(name);
    if (i < 0) return dflt;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const out = opt('--out', 'public/mechs');
  const scale = Number(opt('--scale', '0.32'));
  const maxHeight = Number(opt('--max-height', '140'));
  const maxWidth = Number(opt('--max-width', '170'));
  const colors = Number(opt('--colors', '48'));
  const species = opt('--species', undefined);
  const facing = opt('--facing', undefined);
  const [protoDir, ...wanted] = args;
  if (!protoDir) {
    console.error('usage: node tools/import-rig.mjs <prototype-dir> [id ...] [--out public/mechs] [--scale 0.32]');
    process.exit(2);
  }
  const all = JSON.parse(readFileSync(join(protoDir, 'characters.json'), 'utf8')).map((c) => c.id);
  const ids = wanted.length ? wanted : all;
  const indexPath = join(out, 'index.json');
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { dolls: [] };
  index.dolls ??= [];
  for (const id of ids) {
    const { rig, sheet, icon, portraits, report } = convertMech(protoDir, id, { scale, maxHeight, maxWidth, colors, species, facing });
    const dir = join(out, id);
    mkdirSync(dir, { recursive: true });
    writePng(join(dir, `${id}.png`), sheet);
    writePng(join(dir, 'icon.png'), icon);
    writeFileSync(join(dir, `${id}.rig.json`), JSON.stringify(rig, null, 1) + '\n');
    const entry = { id, rig: `mechs/${id}/${id}.rig.json`, icon: `mechs/${id}/icon.png` };
    if (portraits) {
      writePng(join(dir, 'portrait_s.png'), portraits.small);
      writePng(join(dir, 'portrait.png'), portraits.large);
      entry.portrait = `mechs/${id}/portrait_s.png`;
      entry.portraitLarge = `mechs/${id}/portrait.png`;
    }
    const i = index.dolls.findIndex((d) => d.id === id);
    if (i >= 0) index.dolls[i] = entry;
    else index.dolls.push(entry);
    console.log(
      `${id.padEnd(10)} ${rig.name}  部件 ${rig.parts.length}  关节 ${rig.joints.length}  高 ${rig.height}px  缩放 ${rig.source.scale}` +
        `${rig.source.mirrored ? '  已镜像' : ''}  图集 ${sheet.width}x${sheet.height}  ${rig.source.colors} 色`,
    );
    for (const line of report) console.log(`  ! ${line}`);
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
}
