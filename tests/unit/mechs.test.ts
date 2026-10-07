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
      // non-human weapon sides face forward after import (people face where their face looks)
      if (held[w] && rig.species !== 'human') expect(rig.parts.find((p) => p.id === held[w])!.x).toBeGreaterThanOrEqual(-2);
    });
  }
});

import { archetypeOf, poseNames, samplePose, solvePose } from '../../src/core/rig';

const EXPECTED: Record<string, string> = {
  yunheng: 'humanoid', linxuan: 'humanoid', suqinghan: 'humanoid', shipojun: 'humanoid',
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

describe('species', () => {
  it('cultivators are human with cloth parts; 天工 mechs are constructs or beasts', () => {
    const gd = loadData();
    for (const entry of rigs) {
      const rig = JSON.parse(readFileSync(`public/${entry.rig}`, 'utf8')) as RigDef;
      expect(rig.species, entry.id).toBeDefined();
      expect(gd.units[entry.id].species, entry.id).toBe(rig.species);
      if (rig.species === 'human') expect(rig.follow?.length ?? 0, entry.id).toBeGreaterThan(0);
    }
    expect(gd.units.zhulong.species).toBe('beast');
    expect(gd.units.xuetang.species).toBe('construct');
  });
});

import { absoluteToRelative } from '../../src/core/rig';

describe('修士 poses (ported from the 云衡 package, absolute angles)', () => {
  const rig = JSON.parse(readFileSync('public/mechs/yunheng/yunheng.rig.json', 'utf8')) as RigDef;
  const at = (pose: string, t: number) => solvePose(rig, samplePose(rig, pose, t));
  const angle = (ts: ReturnType<typeof solvePose>, id: string) => ts.find((x) => x.id === id)!.angle;

  it('converts world angles to parent-relative ones', () => {
    const rel = absoluteToRelative(rig, { upper_arm_l: -1, forearm_hand_l: -0.6 });
    expect(rel.upper_arm_l).toBeCloseTo(-1);
    expect(rel.forearm_hand_l).toBeCloseTo(0.4);
    expect(rel.sleeve_l).toBeCloseTo(1); // unlisted parts stay upright in world space
  });

  it('keeps the feet flat while walking and carries the sword tilted', () => {
    for (let t = 0; t < 0.9; t += 0.05) {
      const ts = at('walk', t);
      expect(Math.abs(angle(ts, 'foot_l'))).toBeLessThanOrEqual(0.16);
      expect(Math.abs(angle(ts, 'foot_r'))).toBeLessThanOrEqual(0.16);
    }
    expect(angle(at('idle', 0), 'weapon')).toBeCloseTo(-0.5, 1);
  });

  it('slash lifts the sword arm and sweeps the blade up', () => {
    const mid = at('melee', 0.325);
    expect(angle(mid, 'upper_arm_l')).toBeCloseTo(-1.25, 1);
    expect(angle(mid, 'weapon')).toBeCloseTo(-2.05, 1);
  });
});
