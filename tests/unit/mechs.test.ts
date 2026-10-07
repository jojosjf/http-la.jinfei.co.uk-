import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heldParts, validateRig, weaponSide, type RigDef } from '../../src/core/rig';

const index = JSON.parse(readFileSync('public/mechs/index.json', 'utf8')) as { dolls: Array<{ id: string; rig?: string; icon?: string }> };
const rigs = index.dolls.filter((d) => d.rig);

describe('imported 天工仙甲 rigs', () => {
  it('are listed', () => {
    expect(rigs.length).toBeGreaterThan(0);
  });

  for (const entry of rigs) {
    it(`${entry.id} is a valid, complete rig`, () => {
      const rig = JSON.parse(readFileSync(`public/${entry.rig}`, 'utf8')) as RigDef;
      expect(rig.id).toBe(entry.id);
      expect(validateRig(rig)).toEqual([]);
      expect(existsSync(`public/mechs/${entry.id}/${rig.image}`)).toBe(true);
      if (entry.icon) expect(existsSync(`public/${entry.icon}`)).toBe(true);
      const held = heldParts(rig);
      const w = weaponSide(rig);
      // the weapon side, when there is a held item, faces forward after import
      if (held[w]) expect(rig.parts.find((p) => p.id === held[w])!.x).toBeGreaterThanOrEqual(-2);
    });
  }
});

import { archetypeOf, poseNames, samplePose, solvePose } from '../../src/core/rig';

const EXPECTED: Record<string, string> = {
  zhaoye: 'humanoid', feiyan: 'humanoid', hanyue: 'humanoid', xuanlei: 'humanoid', liuxian: 'humanoid',
  qinghe: 'floater', chilun: 'wheeled', leigu: 'humanoid', baize: 'quadruped', qianlin: 'serpent',
  tianshu: 'floater', xuetang: 'humanoid', tieliao: 'quadruped', guideng: 'floater', heilei: 'humanoid',
  duzhu: 'spider', huiyuan: 'bird', fenlu: 'humanoid', liedi: 'serpent', suohun: 'humanoid',
  chuanyun: 'tripod', mingwang: 'sixarm', tiancheng: 'hexapod', zhulong: 'serpent',
};

describe('skeleton archetypes and poses', () => {
  for (const entry of rigs) {
    const rig = JSON.parse(readFileSync(`public/${entry.rig}`, 'utf8')) as RigDef;
    it(`${entry.id} is a ${EXPECTED[entry.id]} and every pose solves and moves`, () => {
      expect(archetypeOf(rig)).toBe(EXPECTED[entry.id]);
      const rest = solvePose(rig, { angles: {}, dx: 0, dy: 0 });
      for (const pose of poseNames(rig)) {
        let moved = 0;
        for (let i = 0; i <= 10; i++) {
          const ts = solvePose(rig, samplePose(rig, pose, i * 0.07));
          expect(ts).toHaveLength(rig.parts.length);
          for (const t of ts) expect(Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.angle)).toBe(true);
          ts.forEach((t, k) => (moved = Math.max(moved, Math.hypot(t.x - rest[k].x, t.y - rest[k].y))));
        }
        // every action visibly moves something (at least 1px)
        expect(moved, `${entry.id} ${pose}`).toBeGreaterThanOrEqual(1);
      }
    });
  }
});

import { loadData } from '../../src/data';

describe('roster data', () => {
  it('every imported rig has unit stats, and every weapon reference resolves', () => {
    const gd = loadData();
    for (const entry of rigs) {
      const u = gd.units[entry.id];
      expect(u, entry.id).toBeDefined();
      expect(u.weapons.length).toBeGreaterThan(0);
      for (const w of u.weapons) expect(gd.weapons[w], `${entry.id}:${w}`).toBeDefined();
    }
  });
});
