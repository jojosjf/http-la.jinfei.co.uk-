import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dollImages, poseName, resolvePose, resolveSocket, validateDoll, type DollDef } from '../../src/core/doll';
// @ts-expect-error plain ESM tool script without types
import { convertAseprite } from '../../tools/aseprite-to-doll.mjs';

function sample(): DollDef {
  return {
    id: 't',
    version: 1,
    image: 'sheet.png',
    canvas: { w: 64, h: 64 },
    origin: { x: 32, y: 64 },
    parts: {
      body: { z: 1, pivot: { x: 0, y: 0 }, frames: [{ x: 0, y: 0, w: 20, h: 30 }] },
      head: { z: 2, pivot: { x: 5, y: 10 }, frames: [{ x: 20, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 10, h: 10 }] },
      gun: { z: 3, pivot: { x: 0, y: 0 }, frames: [{ x: 40, y: 0, w: 16, h: 4 }], visible: false },
    },
    layout: { body: { x: 22, y: 34 }, head: { x: 32, y: 30 }, gun: { x: 40, y: 40 } },
    sockets: { muzzle: { part: 'gun', x: 16, y: 2 } },
    poses: {
      idle: { fps: 2, loop: true, keys: [{}, { head: { dy: 1 } }] },
      shoot: { fps: 8, loop: false, keys: [{ gun: { hidden: false, dx: 2 }, head: { frame: 1 } }] },
    },
  };
}

describe('validateDoll', () => {
  it('accepts a well-formed doll', () => {
    expect(validateDoll(sample())).toEqual([]);
  });

  it('reports missing idle, unknown parts and out-of-range frames', () => {
    const d = sample();
    delete d.poses.idle;
    d.poses.shoot.keys[0].nose = { dx: 1 };
    d.poses.shoot.keys[0].head = { frame: 5 };
    const errs = validateDoll(d);
    expect(errs.some((e) => e.includes('missing required pose idle'))).toBe(true);
    expect(errs.some((e) => e.includes('unknown part nose'))).toBe(true);
    expect(errs.some((e) => e.includes('frame 5 out of range'))).toBe(true);
  });
});

describe('resolvePose', () => {
  it('places parts relative to the origin, sorted by z, honouring rest visibility', () => {
    const r = resolvePose(sample(), 'idle', 0);
    expect(r.map((p) => p.part)).toEqual(['body', 'head', 'gun']);
    expect(r[0]).toMatchObject({ x: 22 - 32, y: 34 - 64, hidden: false });
    expect(r[2].hidden).toBe(true);
  });

  it('applies key offsets, frame swaps and un-hiding, wrapping the key index', () => {
    const d = sample();
    expect(resolvePose(d, 'idle', 1).find((p) => p.part === 'head')?.y).toBe(30 + 1 - 64);
    expect(resolvePose(d, 'idle', 3).find((p) => p.part === 'head')?.y).toBe(30 + 1 - 64);
    const shoot = resolvePose(d, 'shoot', 0);
    expect(shoot.find((p) => p.part === 'gun')).toMatchObject({ hidden: false, x: 40 + 2 - 32 });
    expect(shoot.find((p) => p.part === 'head')?.frameIndex).toBe(1);
  });

  it('falls back to idle for unknown poses', () => {
    expect(poseName(sample(), 'dance')).toBe('idle');
    expect(resolvePose(sample(), 'dance', 0)).toEqual(resolvePose(sample(), 'idle', 0));
  });

  it('resolves sockets relative to the origin and lists images', () => {
    expect(resolveSocket(sample(), 'muzzle', 'shoot', 0)).toEqual({ x: 40 + 2 - 32 + 16, y: 40 - 64 + 2 });
    expect(resolveSocket(sample(), 'nope', 'idle', 0)).toBeNull();
    expect(dollImages(sample())).toEqual(['sheet.png']);
  });
});

describe('sample doll asset', () => {
  it('public/mechs/cangqiong is valid and listed in the index', () => {
    const def = JSON.parse(readFileSync('public/mechs/cangqiong/cangqiong.doll.json', 'utf8')) as DollDef;
    expect(validateDoll(def)).toEqual([]);
    const index = JSON.parse(readFileSync('public/mechs/index.json', 'utf8')) as { dolls: Array<{ id: string }> };
    expect(index.dolls.map((d) => d.id)).toContain('cangqiong');
    for (const img of dollImages(def)) expect(() => readFileSync(`public/mechs/cangqiong/${img}`)).not.toThrow();
  });
});

describe('convertAseprite', () => {
  const frame = (name: string, i: number, rect: [number, number, number, number], src: [number, number], trimmed = true) => ({
    filename: `${name}#${i}`,
    frame: { x: rect[0], y: rect[1], w: rect[2], h: rect[3] },
    rotated: false,
    trimmed,
    spriteSourceSize: { x: src[0], y: src[1], w: rect[2], h: rect[3] },
    sourceSize: { w: 64, h: 64 },
    duration: 125,
  });
  const ase = {
    frames: [
      frame('body', 0, [0, 0, 20, 30], [22, 34]),
      frame('body', 1, [0, 0, 20, 30], [22, 35]),
      frame('body', 2, [0, 0, 20, 30], [22, 34]),
      frame('gun', 0, [20, 0, 0, 0], [0, 0]),
      frame('gun', 1, [20, 0, 0, 0], [0, 0]),
      frame('gun', 2, [20, 0, 16, 4], [40, 40]),
    ],
    meta: {
      image: 'robot.png',
      layers: [{ name: 'body', opacity: 255, blendMode: 'normal' }, { name: 'gun', opacity: 255, blendMode: 'normal' }],
      frameTags: [
        { name: 'idle', from: 0, to: 1, direction: 'forward' },
        { name: 'shoot', from: 2, to: 2, direction: 'forward' },
      ],
      slices: [{ name: 'muzzle@gun', keys: [{ frame: 2, bounds: { x: 54, y: 41, w: 2, h: 2 } }] }],
    },
  };

  it('turns layers into parts, tags into poses and slices into sockets', () => {
    const doll = convertAseprite(ase) as DollDef;
    expect(validateDoll(doll)).toEqual([]);
    expect(doll.id).toBe('robot');
    expect(doll.canvas).toEqual({ w: 64, h: 64 });
    expect(Object.keys(doll.parts)).toEqual(['body', 'gun']);
    expect(doll.layout.body).toEqual({ x: 22, y: 34 });
    expect(doll.parts.gun.visible).toBe(false);
    expect(doll.poses.idle.keys[1]).toEqual({ body: { dy: 1 } });
    expect(doll.poses.shoot.keys[0].gun).toEqual({ hidden: false });
    expect(doll.poses.idle.loop).toBe(true);
    expect(doll.poses.shoot.loop).toBe(false);
    expect(doll.sockets?.muzzle).toEqual({ part: 'gun', x: 55 - 40, y: 42 - 40 });
    expect(doll.poses.idle.fps).toBe(8);
  });
});
