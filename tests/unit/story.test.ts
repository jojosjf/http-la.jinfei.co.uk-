import { describe, expect, it } from 'vitest';
import { finalDamage, type Combatant } from '../../src/core/battle';
import { deploymentIds } from '../../src/core/scenario';
import type { Deployment, ScenarioDef } from '../../src/core/types';
import { createUnit, unitDomain } from '../../src/core/unit';
import { loadData, validateData } from '../../src/data';

const gd = loadData();

function combatant(d: Deployment): Combatant {
  const ids = deploymentIds(d);
  const def = gd.units[ids.unit];
  const pilot = gd.pilots[ids.pilot];
  const terrain = gd.terrain.plain;
  return { def, pilot, state: createUnit('x', def, pilot, gd.weapons, d.team, 0, 0), terrain, domain: unitDomain(def, terrain) };
}

/** Best damage a fighter can deal at 100 战意 with weapons usable from the start. */
function bestHit(a: Combatant, d: Combatant): number {
  return Math.max(
    ...a.def.weapons
      .map((w) => gd.weapons[w])
      .filter((w) => w.morale <= a.state.morale && w.en <= a.state.en)
      .map((w) => finalDamage({ attacker: a, defender: d, weapon: w, defense: 'counter' }, false)),
  );
}

describe('第一卷 剑骨', () => {
  it('chains 第1话 → 第2话 → 第3话 and ends there', () => {
    expect(gd.scenarios.s01.next).toBe('s02');
    expect(gd.scenarios.s02.next).toBe('s03');
    expect(gd.scenarios.s03.next).toBeUndefined();
  });

  it('every stage opens and closes with dialogue and loses when 云衡 falls', () => {
    for (const s of Object.values(gd.scenarios)) {
      const kinds = (s.events ?? []).map((e) => e.when.type);
      expect(kinds, s.id).toContain('start');
      expect(kinds, s.id).toContain('clear');
      expect(s.lose, s.id).toBe('leader');
    }
  });

  it('第2话 / 第3话 each have one boss, ridden by a 天工宗 elder, holding its post', () => {
    for (const [id, pilot] of [
      ['s02', 'yanwuchang'],
      ['s03', 'lihanzhou'],
    ] as const) {
      const s = gd.scenarios[id];
      expect(s.win).toBe('boss');
      const bosses = s.deploy.filter((d) => d.boss);
      expect(bosses).toHaveLength(1);
      expect(deploymentIds(bosses[0]).pilot).toBe(pilot);
      expect(bosses[0].hold).toBeTruthy();
      // the elder speaks before the decisive duel and when the puppet breaks
      expect(s.events!.some((e) => e.when.type === 'battle' && e.when.b === pilot)).toBe(true);
      expect(s.events!.some((e) => e.when.type === 'hpBelow' && e.when.who === pilot)).toBe(true);
    }
  });

  it('林玄 joins in 第2话 and fights in 第3话', () => {
    expect(gd.scenarios.s01.deploy.some((d) => d.character === 'linxuan')).toBe(false);
    expect(gd.scenarios.s02.deploy.some((d) => d.character === 'linxuan' && d.team === 'player')).toBe(true);
    expect(gd.scenarios.s03.deploy.filter((d) => d.team === 'player')).toHaveLength(4);
  });

  it('bosses take a few rounds of the whole party and cannot one-shot 云衡', () => {
    for (const id of ['s02', 's03']) {
      const s = gd.scenarios[id];
      const boss = combatant(s.deploy.find((d) => d.boss)!);
      const party = s.deploy.filter((d) => d.team === 'player').map(combatant);
      const perRound = party.reduce((sum, p) => sum + bestHit(p, boss), 0);
      const rounds = boss.def.hp / perRound;
      expect(rounds, id).toBeGreaterThan(2);
      expect(rounds, id).toBeLessThan(6);
      const hero = party.find((p) => p.def.id === 'yunheng')!;
      expect(bestHit(boss, hero), id).toBeLessThan(hero.def.hp);
    }
  });

  it('the validator catches events that point at nobody', () => {
    const broken: ScenarioDef = {
      ...gd.scenarios.s02,
      events: [
        { when: { type: 'defeated', who: 'nobody' } },
        { when: { type: 'start' }, talk: [{ who: 'nosuchpilot', text: '……' }], spirit: [{ who: 'yanwuchang', id: '飞升' }] },
        { when: { type: 'start' }, spawn: [{ character: 'huiyuan', team: 'enemy', x: 99, y: 0 }] },
      ],
    };
    const errors = validateData({ ...gd, scenarios: { ...gd.scenarios, s02: broken } });
    expect(errors.some((e) => e.includes('nobody'))).toBe(true);
    expect(errors.some((e) => e.includes('nosuchpilot'))).toBe(true);
    expect(errors.some((e) => e.includes('飞升'))).toBe(true);
    expect(errors.some((e) => e.includes('out of bounds'))).toBe(true);
  });
});
