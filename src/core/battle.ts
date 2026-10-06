import type { Adapt, Domain, Grade, PilotDef, TerrainDef, UnitDef, UnitState, WeaponDef } from './types';

/**
 * Combat formulas — first draft from docs/game-plan.md §6.
 * Everything here is pure and side-effect free so it can be unit tested and used by the AI.
 */

export const GRADE_FACTOR: Record<Grade, number> = { A: 1.0, B: 0.8, C: 0.6, D: 0.4, '-': 0 };
/** Hit-rate penalty for operating in a poorly adapted domain. */
export const GRADE_HIT: Record<Grade, number> = { A: 0, B: -10, C: -20, D: -30, '-': -100 };
export const SIZE_RANK: Record<UnitDef['size'], number> = { S: 0, M: 1, L: 2, LL: 3 };

export const BASE_HIT = 70;
export const SIZE_HIT_PER_RANK = 10;
export const CRIT_MULT = 1.5;
export const CRIT_CAP = 50;
export const DEFEND_MULT = 0.5;
export const EVADE_HIT_MULT = 0.5;
export const MIN_DAMAGE = 10;

export type DefenseAction = 'counter' | 'defend' | 'evade';

export interface Combatant {
  def: UnitDef;
  pilot: PilotDef;
  state: UnitState;
  domain: Domain;
  terrain: TerrainDef;
}

export interface StrikeInput {
  attacker: Combatant;
  defender: Combatant;
  weapon: WeaponDef;
  /** What the defender chose. 'counter' has no effect on the incoming strike itself. */
  defense: DefenseAction;
}

export interface StrikeResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  hitChance: number;
  critChance: number;
}

const GRADE_ORDER: Grade[] = ['-', 'D', 'C', 'B', 'A'];

export function minGrade(a: Grade, b: Grade): Grade {
  return GRADE_ORDER.indexOf(a) <= GRADE_ORDER.indexOf(b) ? a : b;
}

export function combinedGrade(unit: Adapt, pilot: Adapt, domain: Domain): Grade {
  return minGrade(unit[domain], pilot[domain]);
}

export function gradeOf(c: Combatant): Grade {
  return combinedGrade(c.def.adapt, c.pilot.adapt, c.domain);
}

/** False if the weapon cannot reach the defender's domain or the attacker cannot operate where it is. */
export function canAttack(i: StrikeInput): boolean {
  if (i.weapon.adapt[i.defender.domain] === '-') return false;
  if (gradeOf(i.attacker) === '-') return false;
  return true;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function hitChance(i: StrikeInput): number {
  const a = i.attacker;
  const d = i.defender;
  const acc = Math.min(a.pilot.hit + a.def.mobility, a.def.limit);
  const eva = Math.min(d.pilot.evade + d.def.mobility, d.def.limit);
  const sizeMod = (SIZE_RANK[d.def.size] - SIZE_RANK[a.def.size]) * SIZE_HIT_PER_RANK;
  let hit =
    BASE_HIT +
    (acc - eva) +
    i.weapon.hit +
    GRADE_HIT[gradeOf(a)] -
    GRADE_HIT[gradeOf(d)] -
    d.terrain.evade +
    sizeMod;
  if (i.defense === 'evade') hit *= EVADE_HIT_MULT;
  return Math.round(clamp(hit, 0, 100));
}

export function critChance(i: StrikeInput): number {
  const raw = (i.attacker.pilot.skill - i.defender.pilot.skill) / 2 + i.weapon.crit;
  return Math.round(clamp(raw, 0, CRIT_CAP));
}

export function finalDamage(i: StrikeInput, crit: boolean): number {
  const a = i.attacker;
  const d = i.defender;
  const atkStat = i.weapon.kind === 'melee' ? a.pilot.melee : a.pilot.ranged;
  const weaponGrade = minGrade(gradeOf(a), i.weapon.adapt[d.domain]);
  const atk = i.weapon.power * ((atkStat + a.state.morale) / 200) * GRADE_FACTOR[weaponGrade];
  const def =
    d.def.armor *
    ((d.pilot.defense + d.state.morale) / 200) *
    GRADE_FACTOR[gradeOf(d)] *
    (1 + d.terrain.defense / 100);
  let dmg = Math.max(atk - def, MIN_DAMAGE);
  if (crit) dmg *= CRIT_MULT;
  if (i.defense === 'defend') dmg *= DEFEND_MULT;
  return Math.floor(dmg);
}

/** Roll one strike. `rng` must return [0, 1). */
export function resolveStrike(i: StrikeInput, rng: () => number): StrikeResult {
  const hc = hitChance(i);
  const cc = critChance(i);
  const hit = rng() * 100 < hc;
  const crit = hit && rng() * 100 < cc;
  return { hit, crit, damage: hit ? finalDamage(i, crit) : 0, hitChance: hc, critChance: cc };
}
