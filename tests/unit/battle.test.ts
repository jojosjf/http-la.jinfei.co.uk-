import { describe, expect, it } from 'vitest';
import {
  BASE_HIT,
  canAttack,
  critChance,
  finalDamage,
  hitChance,
  MIN_DAMAGE,
  resolveStrike,
  type Combatant,
  type StrikeInput,
} from '../../src/core/battle';
import type { Adapt, PilotDef, TerrainDef, UnitDef, WeaponDef } from '../../src/core/types';
import { createUnit } from '../../src/core/unit';

const ALL_A: Adapt = { air: 'A', land: 'A', sea: 'A', space: 'A' };

const plain: TerrainDef = { id: 'plain', name: '平原', domain: 'land', cost: { land: 1 }, evade: 0, defense: 0, hpRecover: 0, enRecover: 0, color: '#000' };
const forest: TerrainDef = { ...plain, id: 'forest', evade: 10, defense: 10 };

function unit(o: Partial<UnitDef> = {}): UnitDef {
  return {
    id: 'u',
    name: 'U',
    hp: 4000,
    en: 100,
    armor: 1000,
    mobility: 100,
    limit: 300,
    move: 5,
    size: 'M',
    moveTypes: ['land'],
    adapt: ALL_A,
    weapons: ['w'],
    money: 0,
    exp: 0,
    color: '#fff',
    ...o,
  };
}

function pilot(o: Partial<PilotDef> = {}): PilotDef {
  return { id: 'p', name: 'P', level: 1, melee: 150, ranged: 150, hit: 150, evade: 150, skill: 150, defense: 150, sp: 50, adapt: ALL_A, spirits: [], ...o };
}

const weapon: WeaponDef = {
  id: 'w',
  name: 'W',
  power: 2000,
  rangeMin: 1,
  rangeMax: 3,
  hit: 0,
  crit: 0,
  en: 0,
  ammo: null,
  morale: 100,
  adapt: ALL_A,
  postMove: true,
  beam: false,
  kind: 'ranged',
};

function combatant(def: UnitDef, p: PilotDef, terrain: TerrainDef = plain, morale = 100): Combatant {
  const state = createUnit('x', def, p, { w: weapon }, 'player', 0, 0);
  state.morale = morale;
  return { def, pilot: p, state, terrain, domain: terrain.domain };
}

const baseline = (): StrikeInput => ({ attacker: combatant(unit(), pilot()), defender: combatant(unit(), pilot()), weapon, defense: 'counter' });

describe('hitChance', () => {
  it('equal opponents on plain terrain hit at the base rate', () => {
    expect(hitChance(baseline())).toBe(BASE_HIT);
  });

  it('terrain evasion and weapon accuracy shift the rate', () => {
    const i = baseline();
    i.defender.terrain = forest;
    expect(hitChance(i)).toBe(BASE_HIT - 10);
    i.weapon = { ...weapon, hit: 30 };
    expect(hitChance(i)).toBe(BASE_HIT + 20);
  });

  it('is clamped to 0..100', () => {
    const ace = combatant(unit({ mobility: 140, limit: 400 }), pilot({ hit: 200, evade: 200 }));
    const grunt = combatant(unit({ mobility: 70 }), pilot({ hit: 110, evade: 110 }));
    expect(hitChance({ attacker: ace, defender: grunt, weapon, defense: 'counter' })).toBe(100);
    expect(hitChance({ attacker: grunt, defender: ace, weapon, defense: 'counter' })).toBe(0);
  });

  it('限界 caps the defender evasion', () => {
    const capped = combatant(unit({ mobility: 150, limit: 200 }), pilot({ evade: 200 }));
    const uncapped = combatant(unit({ mobility: 150, limit: 500 }), pilot({ evade: 200 }));
    const att = combatant(unit(), pilot());
    expect(hitChance({ attacker: att, defender: capped, weapon, defense: 'counter' })).toBeGreaterThan(
      hitChance({ attacker: att, defender: uncapped, weapon, defense: 'counter' }),
    );
  });

  it('smaller targets are harder to hit, choosing to evade halves the rate', () => {
    const i = baseline();
    i.defender.def = unit({ size: 'S' });
    expect(hitChance(i)).toBe(BASE_HIT - 10);
    i.defense = 'evade';
    expect(hitChance(i)).toBe(Math.round((BASE_HIT - 10) / 2));
  });

  it('poor terrain adaptation hurts the attacker and helps against the defender', () => {
    const i = baseline();
    i.attacker.pilot = pilot({ adapt: { ...ALL_A, land: 'C' } });
    expect(hitChance(i)).toBe(BASE_HIT - 20);
    const j = baseline();
    j.defender.def = unit({ adapt: { ...ALL_A, land: 'B' } });
    expect(hitChance(j)).toBe(BASE_HIT + 10);
  });
});

describe('finalDamage', () => {
  it('power scaled by pilot stat and morale minus armor scaled by defense and morale', () => {
    // 2000 * (150+100)/200 = 2500 ; 1000 * (150+100)/200 = 1250 -> 1250
    expect(finalDamage(baseline(), false)).toBe(1250);
  });

  it('never drops below the minimum damage', () => {
    const i = baseline();
    i.defender.def = unit({ armor: 5000 });
    expect(finalDamage(i, false)).toBe(MIN_DAMAGE);
  });

  it('applies critical, defend and terrain multipliers', () => {
    const i = baseline();
    expect(finalDamage(i, true)).toBe(1875);
    i.defense = 'defend';
    expect(finalDamage(i, false)).toBe(625);
    const j = baseline();
    j.defender.terrain = forest; // armor x1.1 -> 1375 -> 1125
    expect(finalDamage(j, false)).toBe(1125);
  });

  it('morale raises both attack and defence', () => {
    const i = baseline();
    i.attacker.state.morale = 150;
    // 2000 * 300/200 = 3000 - 1250 = 1750
    expect(finalDamage(i, false)).toBe(1750);
  });

  it('weapon adaptation grade scales attack', () => {
    const i = baseline();
    i.weapon = { ...weapon, adapt: { ...ALL_A, land: 'B' } };
    // 2500 * 0.8 = 2000 - 1250 = 750
    expect(finalDamage(i, false)).toBe(750);
  });
});

describe('canAttack / critChance / resolveStrike', () => {
  it('cannot attack a domain the weapon has no adaptation for', () => {
    const i = baseline();
    i.weapon = { ...weapon, adapt: { ...ALL_A, land: '-' } };
    expect(canAttack(i)).toBe(false);
    expect(canAttack(baseline())).toBe(true);
  });

  it('crit chance comes from skill difference and weapon modifier, capped', () => {
    const i = baseline();
    expect(critChance(i)).toBe(0);
    i.attacker.pilot = pilot({ skill: 190 });
    expect(critChance(i)).toBe(20);
    i.weapon = { ...weapon, crit: 90 };
    expect(critChance(i)).toBe(50);
  });

  it('resolveStrike is deterministic given the rng', () => {
    const i = baseline();
    const always = resolveStrike(i, () => 0);
    expect(always.hit).toBe(true);
    expect(always.damage).toBe(1250);
    const never = resolveStrike(i, () => 0.999);
    expect(never.hit).toBe(false);
    expect(never.damage).toBe(0);
  });
});
