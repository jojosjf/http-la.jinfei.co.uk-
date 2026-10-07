#!/usr/bin/env node
/**
 * Generates placeholder 修士 rigs (rig v2) until the real character atlases arrive:
 *   linxuan 林玄 (剑修), suqinghan 苏清寒 (法修), shipojun 石破军 (体修)
 * Parts are drawn with the Canvas API in headless Chromium at game resolution, then packed,
 * given a map icon, and registered in public/mechs/index.json like imported mechs.
 * Hair, robe, sleeves and ribbon are separate parts so the game can give them secondary motion.
 *
 *   node tools/gen-cultivators.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { composeIcon, pack, writePng } from './import-rig.mjs';

const OUT = 'public/mechs';

const CHARS = [
  {
    id: 'linxuan',
    name: '林玄',
    hair: ['#1b1b28', '#34344a', '#0b0b12'],
    robe: ['#eef2f8', '#c6d0e0', '#8e9ab0'],
    trim: ['#4a7fc0', '#2d5a96'],
    inner: ['#33507a', '#22385a'],
    skin: ['#f3cfac', '#d9a983'],
    eye: '#1d2a44',
    sleeves: true,
    weapon: 'sword',
    build: 1,
    hairStyle: 'ponytail',
  },
  {
    id: 'suqinghan',
    name: '苏清寒',
    hair: ['#d8e4f4', '#aebfd8', '#7f90ac'],
    robe: ['#bfe6ff', '#8fc6ec', '#5d93bf'],
    trim: ['#ffffff', '#d8eaff'],
    inner: ['#e9f6ff', '#b9d6ee'],
    skin: ['#f6d9be', '#dcb391'],
    eye: '#2a5d9a',
    sleeves: true,
    weapon: null,
    build: 0.9,
    hairStyle: 'long',
  },
  {
    id: 'shipojun',
    name: '石破军',
    hair: ['#3a2416', '#5a3a22', '#21140b'],
    robe: ['#8a5a2a', '#6c4520', '#4a2e14'],
    trim: ['#d8b04a', '#a8822a'],
    inner: ['#3d3a36', '#2a2724'],
    skin: ['#d9a072', '#b47c52'],
    eye: '#2a1a10',
    sleeves: false,
    weapon: null,
    build: 1.2,
    hairStyle: 'topknot',
  },
];

/** Part layout (canonical: facing +x, origin at the feet). */
function layout(c) {
  const b = c.build;
  const tw = Math.round(22 * b);
  const P = {
    hair_back: { w: c.hairStyle === 'topknot' ? 14 : 22, h: c.hairStyle === 'long' ? 44 : c.hairStyle === 'topknot' ? 12 : 34, x: -7, y: c.hairStyle === 'long' ? -78 : c.hairStyle === 'topknot' ? -104 : -84, layer: 0 },
    ribbon: { w: 5, h: 30, x: -12, y: -52, layer: 0 },
    upper_arm_l: { w: Math.round(8 * b), h: 16, x: -Math.round(13 * b), y: -66, layer: 1 },
    forearm_hand_l: { w: Math.round(8 * b), h: 16, x: -Math.round(14 * b), y: -51, layer: 1 },
    sleeve_l: { w: 13, h: 15, x: -Math.round(15 * b), y: -49, layer: 2 },
    thigh_l: { w: 8, h: 14, x: -4, y: -40, layer: 2 },
    thigh_r: { w: 8, h: 14, x: 4, y: -40, layer: 2 },
    shin_l: { w: 7, h: 26, x: -4, y: -18, layer: 2 },
    shin_r: { w: 7, h: 26, x: 4, y: -18, layer: 2 },
    foot_l: { w: 11, h: 5, x: -2, y: -3, layer: 3 },
    foot_r: { w: 11, h: 5, x: 6, y: -3, layer: 3 },
    robe: { w: Math.round(30 * b), h: c.sleeves ? 34 : 20, x: 0, y: c.sleeves ? -36 : -44, layer: 4 },
    torso: { w: tw, h: 26, x: 0, y: -66, layer: 5 },
    head: { w: 24, h: 24, x: 2, y: -91, layer: 6 },
    upper_arm_r: { w: Math.round(8 * b), h: 16, x: Math.round(13 * b), y: -66, layer: 7 },
    forearm_hand_r: { w: Math.round(8 * b), h: 16, x: Math.round(14 * b), y: -51, layer: 7 },
    sleeve_r: { w: 13, h: 15, x: Math.round(15 * b), y: -49, layer: 8 },
    weapon: { w: 7, h: 40, x: Math.round(16 * b), y: -27, layer: 8 },
  };
  if (!c.sleeves) {
    delete P.sleeve_l;
    delete P.sleeve_r;
    delete P.ribbon;
  }
  if (!c.weapon) delete P.weapon;
  const ax = (id) => Math.round(P[id].x);
  const joints = [
    ['torso', 'head', [0, -79]],
    ['head', 'hair_back', c.hairStyle === 'topknot' ? [-2, -100] : [-4, -98]],
    ['torso', 'robe', [0, c.sleeves ? -54 : -54]],
    ['torso', 'thigh_l', [-4, -50]],
    ['torso', 'thigh_r', [4, -50]],
    ['thigh_l', 'shin_l', [-4, -31]],
    ['thigh_r', 'shin_r', [4, -31]],
    ['shin_l', 'foot_l', [-4, -6]],
    ['shin_r', 'foot_r', [4, -6]],
    ['torso', 'upper_arm_l', [ax('upper_arm_l') + 2, -74]],
    ['torso', 'upper_arm_r', [ax('upper_arm_r') - 2, -74]],
    ['upper_arm_l', 'forearm_hand_l', [ax('upper_arm_l'), -59]],
    ['upper_arm_r', 'forearm_hand_r', [ax('upper_arm_r'), -59]],
    ['forearm_hand_l', 'sleeve_l', [ax('forearm_hand_l'), -56]],
    ['forearm_hand_r', 'sleeve_r', [ax('forearm_hand_r'), -56]],
    ['torso', 'ribbon', [-9, -66]],
    ['forearm_hand_r', 'weapon', [ax('forearm_hand_r') + 1, -44]],
  ].filter(([a, b]) => P[a] && P[b]);
  return { P, joints };
}

const LIMITS = {
  head: [-0.4, 0.4], hair_back: [-0.9, 0.9], robe: [-0.5, 0.5], ribbon: [-1, 1], sleeve_l: [-0.8, 0.8], sleeve_r: [-0.8, 0.8],
  thigh_l: [-0.9, 0.9], thigh_r: [-0.9, 0.9], shin_l: [0, 1.4], shin_r: [0, 1.4], foot_l: [-0.3, 0.3], foot_r: [-0.3, 0.3],
  upper_arm_l: [-1.6, 0.6], upper_arm_r: [-1.6, 0.6], forearm_hand_l: [-1.6, 0], forearm_hand_r: [-1.6, 0], weapon: [-0.3, 0.3],
};
const MASS = { torso: 5, head: 3, robe: 1.5, hair_back: 0.6, ribbon: 0.3, sleeve_l: 0.4, sleeve_r: 0.4, weapon: 1.2 };

/** Browser-side painter: returns { partId: dataURL } for one character. */
const PAINTER = String.raw`
window.paint = (c, P) => {
  const out = {};
  const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
  const outline = (cv, col) => {
    const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height); const a = (x, y) => x >= 0 && y >= 0 && x < cv.width && y < cv.height && d.data[(y * cv.width + x) * 4 + 3] > 0;
    const marks = [];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (!a(x, y) && (a(x-1,y)||a(x+1,y)||a(x,y-1)||a(x,y+1))) marks.push([x, y]);
    g.fillStyle = col; for (const [x, y] of marks) g.fillRect(x, y, 1, 1);
  };
  const disc = (g, cx, cy, rx, ry, col) => { g.fillStyle = col; for (let y = -ry; y <= ry; y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); } };
  const R = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = '#14121c';
  const part = (id, draw) => { if (!P[id]) return; const { w, h } = P[id]; const cv = mk(w, h); draw(cv.getContext('2d'), w, h); outline(cv, O); out[id] = cv.toDataURL(); };
  const inset = (w, h) => [1, 1, w - 2, h - 2];

  part('hair_back', (g, w, h) => {
    if (c.hairStyle === 'topknot') { disc(g, w/2|0, h/2|0, w/2-2, h/2-2, c.hair[0]); R(g, 3, 3, w-8, 2, c.hair[1]); R(g, w/2-1, h-3, 3, 2, c.trim[0]); return; }
    const [x, y, ww, hh] = inset(w, h);
    R(g, x+2, y, ww-4, hh-4, c.hair[0]); R(g, x, y+3, ww, hh-10, c.hair[0]); R(g, x+3, y+hh-6, ww-6, 4, c.hair[0]);
    R(g, x+3, y+2, 3, hh-8, c.hair[1]); R(g, x+ww-5, y+4, 2, hh-12, c.hair[2]);
    if (c.hairStyle === 'ponytail') R(g, x+ww/2-2|0, y+1, 4, 3, c.trim[0]);
  });
  part('ribbon', (g, w, h) => { R(g, 1, 1, w-2, h-3, c.trim[0]); R(g, 1, 1, 1, h-3, c.trim[1]); R(g, 0, h-4, w, 3, c.trim[1]); });
  for (const s of ['l', 'r']) {
    const back = s === 'l';
    part('upper_arm_' + s, (g, w, h) => { R(g, 1, 0, w-2, h-1, c.sleeves ? c.robe[back ? 1 : 0] : c.skin[back ? 1 : 0]); R(g, w-3, 1, 2, h-3, c.sleeves ? c.robe[2] : c.skin[1]); if (!c.sleeves) R(g, 1, 0, w-2, 4, c.robe[0]); });
    part('forearm_hand_' + s, (g, w, h) => { R(g, 1, 0, w-2, h-5, c.sleeves ? c.inner[back ? 1 : 0] : c.skin[back ? 1 : 0]); if (!c.sleeves) R(g, 1, 2, w-2, 3, c.trim[0]); disc(g, w/2|0, h-4, w/2-1, 3, c.skin[back ? 1 : 0]); R(g, (w/2|0)-1, h-5, 3, 1, c.skin[1]); });
    part('sleeve_' + s, (g, w, h) => { R(g, 2, 0, w-4, h-2, c.robe[back ? 1 : 0]); R(g, 1, 3, w-2, h-5, c.robe[back ? 1 : 0]); R(g, 1, h-4, w-2, 2, c.trim[back ? 1 : 0]); R(g, w-4, 1, 2, h-5, c.robe[2]); });
    part('thigh_' + s, (g, w, h) => { R(g, 1, 0, w-2, h-1, c.inner[back ? 1 : 0]); });
    part('shin_' + s, (g, w, h) => { R(g, 1, 0, w-2, h-1, c.inner[back ? 1 : 0]); R(g, 1, h-5, w-2, 3, c.trim[1]); });
    part('foot_' + s, (g, w, h) => { R(g, 1, 1, w-2, h-2, '#2a2430'); R(g, w-4, 1, 3, h-3, '#3d3644'); });
  }
  part('robe', (g, w, h) => {
    for (let y = 0; y < h - 1; y++) { const spread = Math.round((y / h) * 4); R(g, 3 - Math.min(2, spread), y, w - 6 + Math.min(4, spread * 2), 1, c.robe[0]); }
    R(g, 2, h - 4, w - 4, 3, c.trim[0]); R(g, (w/2|0) - 1, 0, 3, h - 4, c.trim[1]); R(g, w - 6, 2, 3, h - 7, c.robe[1]); R(g, 4, 3, 2, h - 9, c.robe[1]);
  });
  part('torso', (g, w, h) => {
    R(g, 2, 1, w-4, h-3, c.robe[0]); R(g, 1, 4, w-2, h-8, c.robe[0]);
    for (let i = 0; i < 9; i++) R(g, (w/2|0) - 4 + i, 1 + i, 2, 1, c.trim[0]);
    R(g, (w/2|0) - 3, 3, 4, 7, c.inner[0]);
    R(g, 1, h - 8, w - 2, 4, c.trim[1]); R(g, (w/2|0) - 1, h - 9, 3, 6, c.trim[0]);
    R(g, w - 5, 3, 3, h - 12, c.robe[1]);
  });
  part('head', (g, w, h) => {
    disc(g, 12, 13, 9, 9, c.skin[0]); R(g, 18, 12, 3, 6, c.skin[1]);
    R(g, 4, 3, 16, 6, c.hair[0]); R(g, 3, 5, 5, 12, c.hair[0]); R(g, 13, 7, 7, 3, c.hair[0]); R(g, 6, 4, 6, 2, c.hair[1]);
    R(g, 13, 13, 2, 3, c.eye); R(g, 18, 13, 2, 3, c.eye); R(g, 13, 13, 1, 1, '#ffffff'); R(g, 18, 13, 1, 1, '#ffffff');
    R(g, 16, 19, 3, 1, c.skin[1]);
    if (c.hairStyle === 'topknot') { R(g, 9, 0, 6, 4, c.hair[0]); R(g, 10, 1, 3, 1, c.hair[1]); }
  });
  part('weapon', (g, w, h) => {
    R(g, 2, 0, 3, 7, '#5a3a22'); R(g, 0, 7, 7, 2, '#d8b04a'); R(g, 2, 9, 3, h - 11, '#dfe8f2'); R(g, 3, 10, 1, h - 13, '#ffffff'); R(g, 3, h - 2, 1, 1, '#dfe8f2');
  });
  return out;
};`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body><script>${PAINTER}</script></body>`);

const indexPath = `${OUT}/index.json`;
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
for (const c of CHARS) {
  const { P, joints } = layout(c);
  const urls = await page.evaluate(([cc, pp]) => window.paint(cc, pp), [c, P]);
  const ids = Object.keys(P);
  const images = ids.map((id) => {
    const png = PNG.sync.read(Buffer.from(urls[id].split(',')[1], 'base64'));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  });
  const parts = ids.map((id) => ({ id, x: P[id].x, y: P[id].y, w: P[id].w, h: P[id].h, layer: P[id].layer, mass: MASS[id] ?? 1 }));
  const { frames, sheet } = pack(images);
  parts.forEach((p, i) => (p.frame = frames[i]));
  const rig = {
    id: c.id,
    name: c.name,
    version: 2,
    image: `${c.id}.png`,
    species: 'human',
    root: 'torso',
    height: Math.round(-Math.min(...parts.map((p) => p.y - p.h / 2))),
    follow: ids.filter((id) => /^(hair|robe|sleeve|ribbon)/.test(id)),
    parts: parts.map(({ id, frame, x, y, w, h, layer, mass }) => ({ id, frame, x, y, w, h, layer, mass })),
    joints: joints.map(([a, b, anchor]) => ({ a, b, anchor, min: (LIMITS[b] ?? [-0.5, 0.5])[0], max: (LIMITS[b] ?? [-0.5, 0.5])[1], detachable: b === 'weapon' })),
    source: { from: 'tools/gen-cultivators.mjs', placeholder: true },
  };
  mkdirSync(`${OUT}/${c.id}`, { recursive: true });
  writePng(`${OUT}/${c.id}/${c.id}.png`, sheet);
  writePng(`${OUT}/${c.id}/icon.png`, composeIcon(parts, images, null));
  writeFileSync(`${OUT}/${c.id}/${c.id}.rig.json`, JSON.stringify(rig, null, 1) + '\n');
  const entry = { id: c.id, rig: `mechs/${c.id}/${c.id}.rig.json`, icon: `mechs/${c.id}/icon.png` };
  const i = index.dolls.findIndex((d) => d.id === c.id);
  if (i >= 0) index.dolls[i] = entry;
  else index.dolls.unshift(entry);
  console.log(`${c.id} ${c.name}: ${parts.length} parts, height ${rig.height}px, follow ${rig.follow.join(',')}`);
}
// cultivators first, in roster order
const ours = CHARS.map((c) => index.dolls.find((d) => d.id === c.id));
index.dolls = [...ours, ...index.dolls.filter((d) => !CHARS.some((c) => c.id === d.id))];
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
await browser.close();
