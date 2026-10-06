#!/usr/bin/env node
/**
 * Convert an Aseprite sprite-sheet export into the game's paper-doll JSON.
 *
 * Export from Aseprite with one layer per part and one frame tag per pose:
 *   aseprite -b cangqiong.aseprite --split-layers --trim --list-layers --list-tags --list-slices \
 *     --filename-format '{layer}#{frame}' --format json-array \
 *     --sheet cangqiong.png --data cangqiong.ase.json
 *
 * then:  node tools/aseprite-to-doll.mjs cangqiong.ase.json cangqiong.doll.json
 *
 * Conventions: layer name = part name (draw order = layer order, bottom first);
 * tag name = pose (idle is required); a slice named `muzzle@rifle` becomes socket
 * `muzzle` attached to part `rifle`. Layers whose name starts with `_` are ignored.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

export function convertAseprite(ase, opts = {}) {
  const meta = ase.meta ?? {};
  const frames = Array.isArray(ase.frames) ? ase.frames : Object.entries(ase.frames).map(([filename, f]) => ({ filename, ...f }));
  const layers = (meta.layers ?? []).filter((l) => !l.name.startsWith('_') && !l.group && l.opacity !== 0);
  if (layers.length === 0) throw new Error('aseprite json has no layers; export with --split-layers --list-layers');
  const tags = meta.frameTags ?? [];
  if (!tags.some((t) => t.name === 'idle')) throw new Error('frame tag "idle" is required');
  const canvas = { w: frames[0].sourceSize.w, h: frames[0].sourceSize.h };
  const image = opts.image ?? basename(meta.image ?? 'sheet.png');

  // frames per layer, in animation-frame order
  const byLayer = new Map();
  for (const f of frames) {
    const m = /^(.*)#(\d+)$/.exec(f.filename.replace(/\.(aseprite|ase|png)$/i, ''));
    if (!m) throw new Error(`frame name "${f.filename}" does not match "{layer}#{frame}"`);
    const list = byLayer.get(m[1]) ?? [];
    list[Number(m[2])] = f;
    byLayer.set(m[1], list);
  }

  const parts = {};
  const layout = {};
  const animFrames = Math.max(...[...byLayer.values()].map((l) => l.length));
  // distinct trimmed images per layer become part frames; each anim frame maps to one of them + an offset
  const frameMapping = new Map(); // layer -> array per anim frame of { frame, x, y } (x,y = spriteSourceSize)
  layers.forEach((layer, z) => {
    const list = byLayer.get(layer.name);
    if (!list) return;
    const variants = [];
    const mapping = [];
    for (let i = 0; i < animFrames; i++) {
      const f = list[i];
      if (!f) {
        mapping[i] = null;
        continue;
      }
      const r = f.frame;
      const empty = r.w === 0 || r.h === 0 || (f.trimmed && f.spriteSourceSize.w === 0);
      if (empty) {
        mapping[i] = null;
        continue;
      }
      const sig = `${r.x},${r.y},${r.w},${r.h}`;
      let vi = variants.findIndex((v) => v.sig === sig);
      if (vi < 0) {
        variants.push({ sig, frame: { x: r.x, y: r.y, w: r.w, h: r.h } });
        vi = variants.length - 1;
      }
      mapping[i] = { frame: vi, x: f.spriteSourceSize.x, y: f.spriteSourceSize.y };
    }
    if (variants.length === 0) return;
    const rest = mapping.find((m) => m) ?? { x: 0, y: 0 };
    parts[layer.name] = { z, pivot: { x: 0, y: 0 }, frames: variants.map((v) => v.frame), visible: mapping[0] !== null };
    layout[layer.name] = { x: rest.x, y: rest.y };
    frameMapping.set(layer.name, { mapping, rest });
  });

  const poses = {};
  for (const tag of tags) {
    const keys = [];
    for (let i = tag.from; i <= tag.to; i++) {
      const key = {};
      for (const [name, { mapping, rest }] of frameMapping) {
        const m = mapping[i];
        const ov = {};
        if (!m) {
          if (parts[name].visible) ov.hidden = true;
        } else {
          if (!parts[name].visible) ov.hidden = false;
          if (m.frame !== 0) ov.frame = m.frame;
          if (m.x !== rest.x) ov.dx = m.x - rest.x;
          if (m.y !== rest.y) ov.dy = m.y - rest.y;
        }
        if (Object.keys(ov).length) key[name] = ov;
      }
      keys.push(key);
    }
    const duration = frames[tag.from]?.duration ?? 125;
    poses[tag.name] = { fps: Math.max(1, Math.round(1000 / duration)), loop: tag.name === 'idle' || tag.repeat === '0', keys };
  }

  const sockets = {};
  for (const s of meta.slices ?? []) {
    const m = /^(\w+)@(\w+)$/.exec(s.name);
    if (!m || !parts[m[2]]) continue;
    const b = s.keys?.[0]?.bounds;
    if (!b) continue;
    const rest = layout[m[2]];
    sockets[m[1]] = { part: m[2], x: b.x + Math.floor(b.w / 2) - rest.x, y: b.y + Math.floor(b.h / 2) - rest.y };
  }

  return {
    id: opts.id ?? basename(image).replace(/\.[^.]+$/, ''),
    version: 1,
    image,
    canvas,
    origin: opts.origin ?? { x: Math.floor(canvas.w / 2), y: canvas.h },
    parts,
    layout,
    sockets,
    poses,
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (isMain) {
  const [input, output, id] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node tools/aseprite-to-doll.mjs <export.json> <out.doll.json> [id]');
    process.exit(2);
  }
  const ase = JSON.parse(readFileSync(input, 'utf8'));
  const doll = convertAseprite(ase, id ? { id } : {});
  writeFileSync(output, JSON.stringify(doll, null, 2) + '\n');
  console.log(`wrote ${output}: ${Object.keys(doll.parts).length} parts, ${Object.keys(doll.poses).length} poses`);
}
