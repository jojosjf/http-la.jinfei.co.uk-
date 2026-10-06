#!/usr/bin/env node
/**
 * Convert a whole-body sprite sheet (one row per pose, one column per frame) into the
 * game's paper-doll JSON as a single-part doll. This is the path for artists who already
 * have full-frame animations rather than separated parts.
 *
 *   node tools/sheet-to-doll.mjs public/mechs/<id>/<id>_sheet.json
 *
 * <id>_sheet.json:
 * {
 *   "id": "cangqiong", "image": "cangqiong_sheet.png",
 *   "cell": [128, 128], "origin": [64, 128],
 *   "poses": { "idle": 2, "shoot": 3, "melee": 3, "hit": 2, "down": 1 },   // row order = this order
 *   "fps":   { "idle": 3, "shoot": 8, "melee": 8, "hit": 8, "down": 4 },   // optional
 *   "loop":  { "idle": true },                                              // optional, default: only idle loops
 *   "muzzle": [110, 56]                                                     // optional, pixel in the cell
 * }
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const DEFAULT_FPS = { idle: 3, shoot: 8, melee: 8, hit: 8, down: 4 };

export function sheetToDoll(spec, sheetW, sheetH) {
  if (!spec.id) throw new Error('sheet spec needs an id');
  if (!Array.isArray(spec.cell) || spec.cell.length !== 2) throw new Error('cell must be [w, h]');
  const [cw, ch] = spec.cell;
  const cols = Math.floor(sheetW / cw);
  const rows = Math.floor(sheetH / ch);
  const order = spec.order ?? Object.keys(spec.poses ?? {});
  if (order.length === 0) throw new Error('poses is empty');
  if (!order.includes('idle')) throw new Error('pose "idle" is required');
  if (rows < order.length) throw new Error(`sheet has ${rows} rows of ${ch}px but ${order.length} poses are listed`);
  const origin = spec.origin ?? [Math.floor(cw / 2), ch];

  const frames = [];
  const poses = {};
  order.forEach((pose, row) => {
    const n = spec.poses[pose];
    if (!(n >= 1)) throw new Error(`pose ${pose} needs at least 1 frame`);
    if (n > cols) throw new Error(`pose ${pose} has ${n} frames but the sheet only has ${cols} columns`);
    const keys = [];
    for (let i = 0; i < n; i++) {
      frames.push({ x: i * cw, y: row * ch, w: cw, h: ch });
      keys.push({ body: { frame: frames.length - 1 } });
    }
    poses[pose] = {
      fps: spec.fps?.[pose] ?? DEFAULT_FPS[pose] ?? 6,
      loop: spec.loop?.[pose] ?? pose === 'idle',
      keys,
    };
  });

  const sockets = {};
  if (Array.isArray(spec.muzzle)) sockets.muzzle = { part: 'body', x: spec.muzzle[0], y: spec.muzzle[1] };

  return {
    id: spec.id,
    version: 1,
    image: spec.image ?? `${spec.id}_sheet.png`,
    canvas: { w: cw, h: ch },
    origin: { x: origin[0], y: origin[1] },
    parts: { body: { z: 0, pivot: { x: 0, y: 0 }, frames } },
    layout: { body: { x: 0, y: 0 } },
    sockets,
    poses,
  };
}

/** Width/height from a PNG's IHDR chunk, no decoder needed. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG file');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (isMain) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath) {
    console.error('usage: node tools/sheet-to-doll.mjs <id>_sheet.json [out.doll.json]');
    process.exit(2);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const dir = dirname(specPath);
  const image = spec.image ?? `${spec.id}_sheet.png`;
  const { width, height } = pngSize(readFileSync(join(dir, image)));
  const doll = sheetToDoll(spec, width, height);
  const out = outPath ?? join(dir, `${spec.id}.doll.json`);
  writeFileSync(out, JSON.stringify(doll, null, 2) + '\n');
  console.log(`wrote ${out}: ${doll.parts.body.frames.length} frames, ${Object.keys(doll.poses).length} poses (sheet ${width}x${height})`);
  console.log(`register it in public/mechs/index.json:  { "id": "${spec.id}", "doll": "mechs/${spec.id}/${spec.id}.doll.json" }`);
}
