#!/usr/bin/env node
/**
 * Generates the sample paper doll for 苍穹 (public/mechs/cangqiong) by drawing each part
 * with the Canvas API in headless Chromium, so the import pipeline can be exercised
 * before any real pixel art exists. Re-run after editing: node tools/gen-sample-doll.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = new URL('../public/mechs/cangqiong/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><body><script>
const C = { base:'#4aa3ff', shade:'#2f74c4', dark:'#1c3f70', light:'#a8d4ff', white:'#e8f4ff', outline:'#0b0c10',
  yellow:'#ffd60a', visor:'#7ff0ff', joint:'#5c6478', gun:'#343a48', fire:'#ffb347', beam:'#ff7bff', beamCore:'#ffe3ff' };
function part(w, h, rects, outline = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  if (outline) { g.fillStyle = C.outline; for (const [x,y,rw,rh] of rects) g.fillRect(x-1, y-1, rw+2, rh+2); }
  for (const [x,y,rw,rh,c] of rects) { g.fillStyle = C[c] ?? c; g.fillRect(x,y,rw,rh); }
  return cv.toDataURL('image/png');
}
window.parts = {
  head: part(20, 20, [[4,6,12,12,'base'],[9,0,2,7,'light'],[2,2,6,3,'yellow'],[12,2,6,3,'yellow'],[0,8,3,2,'light'],
    [6,10,8,3,'visor'],[3,11,2,4,'dark'],[15,11,2,4,'dark'],[7,16,6,2,'shade']]),
  torso: part(36, 40, [[12,0,12,4,'shade'],[6,2,24,18,'base'],[8,4,9,8,'light'],[19,4,9,8,'shade'],[15,10,6,6,'dark'],[16,11,4,2,'visor'],
    [9,13,6,2,'dark'],[21,13,6,2,'dark'],[11,20,14,8,'gun'],[13,22,10,1,'joint'],[13,25,10,1,'joint'],[8,28,20,6,'base'],[14,29,8,3,'yellow'],
    [4,32,10,8,'base'],[22,32,10,8,'base'],[6,34,6,2,'light']]),
  backpack: part(40, 34, [[0,6,6,10,'shade'],[34,6,6,10,'shade'],[6,4,28,22,'dark'],[10,0,20,6,'shade'],[4,22,10,12,'joint'],[26,22,10,12,'joint'],
    [6,30,6,3,'fire'],[28,30,6,3,'fire']]),
  legs: part(44, 50, [[6,0,12,16,'shade'],[26,0,12,16,'shade'],[5,14,14,6,'base'],[25,14,14,6,'base'],[6,20,12,20,'base'],[26,20,12,20,'base'],
    [8,22,3,10,'light'],[28,22,3,10,'light'],[8,40,8,4,'dark'],[28,40,8,4,'dark'],[2,44,20,6,'dark'],[22,44,20,6,'dark'],[4,45,6,2,'joint'],[24,45,6,2,'joint']]),
  arm_back: part(16, 36, [[0,0,16,12,'shade'],[2,2,10,3,'base'],[3,12,10,10,'dark'],[2,21,12,4,'joint'],[3,25,10,8,'shade'],[4,33,8,3,'dark']]),
  arm_front: part(16, 36, [[0,0,16,12,'base'],[2,2,10,3,'light'],[3,12,10,10,'shade'],[2,21,12,4,'joint'],[3,25,10,8,'base'],[4,33,8,3,'dark']]),
  arm_front_aim: part(38, 14, [[0,0,16,14,'base'],[2,2,10,3,'light'],[14,3,12,8,'shade'],[24,3,14,8,'base'],[34,4,4,6,'dark']]),
  rifle: part(36, 12, [[4,2,24,6,'gun'],[26,4,10,3,'joint'],[34,4,2,3,'light'],[8,0,8,3,'gun'],[12,8,4,4,'gun'],[18,8,5,4,'joint']]),
  saber: part(10, 44, [[3,34,4,10,'joint'],[2,0,6,34,'beam'],[4,2,2,30,'beamCore']], false),
};
</script></body>`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(PAGE);
const parts = await page.evaluate(() => window.parts);
await browser.close();

for (const [name, dataUrl] of Object.entries(parts)) {
  writeFileSync(new URL(`${name}.png`, OUT), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

const F = (name, w, h) => [{ image: `${name}.png`, x: 0, y: 0, w, h }];
const doll = {
  id: 'cangqiong',
  version: 1,
  canvas: { w: 128, h: 128 },
  origin: { x: 64, y: 128 },
  parts: {
    backpack: { z: 0, pivot: { x: 0, y: 0 }, frames: F('backpack', 40, 34) },
    legs: { z: 1, pivot: { x: 0, y: 0 }, frames: F('legs', 44, 50) },
    arm_back: { z: 2, pivot: { x: 0, y: 0 }, frames: F('arm_back', 16, 36) },
    torso: { z: 3, pivot: { x: 0, y: 0 }, frames: F('torso', 36, 40) },
    head: { z: 4, pivot: { x: 0, y: 0 }, frames: F('head', 20, 20) },
    arm_front: { z: 5, pivot: { x: 0, y: 0 }, frames: [...F('arm_front', 16, 36), ...F('arm_front_aim', 38, 14)] },
    rifle: { z: 6, pivot: { x: 0, y: 0 }, frames: F('rifle', 36, 12), visible: false },
    saber: { z: 6, pivot: { x: 0, y: 0 }, frames: F('saber', 10, 44), visible: false },
  },
  layout: {
    backpack: { x: 44, y: 42 },
    legs: { x: 42, y: 78 },
    arm_back: { x: 36, y: 48 },
    torso: { x: 46, y: 44 },
    head: { x: 54, y: 27 },
    arm_front: { x: 76, y: 48 },
    rifle: { x: 100, y: 47 },
    saber: { x: 84, y: 8 },
  },
  sockets: { muzzle: { part: 'rifle', x: 36, y: 5 } },
  poses: {
    idle: {
      fps: 3,
      loop: true,
      keys: [{}, { torso: { dy: 1 }, head: { dy: 1 }, arm_back: { dy: 1 }, arm_front: { dy: 1 }, backpack: { dy: 1 } }],
    },
    shoot: {
      fps: 8,
      loop: false,
      keys: [
        { arm_front: { frame: 1 }, rifle: { hidden: false } },
        { arm_front: { frame: 1, dx: -2 }, rifle: { hidden: false, dx: -3 }, torso: { dx: -1 }, head: { dx: -1 } },
        { arm_front: { frame: 1 }, rifle: { hidden: false } },
      ],
    },
    melee: {
      fps: 8,
      loop: false,
      keys: [
        { saber: { hidden: false, dy: -6 }, arm_front: { dy: -8 }, torso: { dx: 2 } },
        { saber: { hidden: false, dx: 8, dy: 12 }, arm_front: { dx: 4, dy: 6 }, torso: { dx: 4 }, head: { dx: 3 } },
        { saber: { hidden: false, dx: 4, dy: 4 }, arm_front: { dx: 2, dy: 2 } },
      ],
    },
    hit: {
      fps: 8,
      loop: false,
      keys: [
        { torso: { dx: -4 }, head: { dx: -6, dy: 2 }, arm_front: { dx: -4 }, arm_back: { dx: -4 }, backpack: { dx: -4 } },
        { torso: { dx: -2 }, head: { dx: -3, dy: 1 }, arm_front: { dx: -2 }, arm_back: { dx: -2 }, backpack: { dx: -2 } },
      ],
    },
    down: {
      fps: 4,
      loop: false,
      keys: [{ torso: { dy: 6 }, head: { dx: -2, dy: 8 }, arm_front: { dy: 8 }, arm_back: { dy: 8 }, backpack: { dy: 6 }, legs: { dy: 3 } }],
    },
  },
};
writeFileSync(new URL('cangqiong.doll.json', OUT), JSON.stringify(doll, null, 2) + '\n');
writeFileSync(
  new URL('../index.json', OUT),
  JSON.stringify({ dolls: [{ id: 'cangqiong', doll: 'mechs/cangqiong/cangqiong.doll.json' }] }, null, 2) + '\n',
);
console.log(`wrote ${Object.keys(parts).length} part images + cangqiong.doll.json + index.json`);
