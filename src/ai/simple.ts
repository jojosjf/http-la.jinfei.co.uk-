import {
  canAttack,
  finalDamage,
  hitChance,
  type Combatant,
  type DefenseAction,
} from '../core/battle';
import { key, manhattan } from '../core/grid';
import { movementRange, pathTo, stoppableTiles } from '../core/pathfinding';
import { inWeaponRange } from '../core/range';
import type { GameMap, UnitState, Vec2, WeaponDef } from '../core/types';
import { weaponAvailability } from '../core/unit';
import type { GameData } from '../data';

export interface AiContext {
  map: GameMap;
  data: GameData;
  units: UnitState[];
  actor: UnitState;
  /** Build a combatant view of a unit, optionally as if it stood at `at`. */
  combatant(u: UnitState, at?: Vec2): Combatant;
}

export interface AiAttack {
  weapon: WeaponDef;
  target: UnitState;
  score: number;
}

export interface AiPlan {
  dest: Vec2;
  /** Full path including the start tile; length 1 = no movement. */
  path: Vec2[];
  attack: AiAttack | null;
}

/**
 * Enemy AI v0: for every reachable tile and usable weapon, score every target by
 * expected damage (hit% x damage, big bonus for a kill). If nothing is attackable,
 * walk towards the nearest foe.
 */
export function planAction(ctx: AiContext): AiPlan {
  const { actor, data, map, units } = ctx;
  const def = data.units[actor.unitId];
  const foes = units.filter((u) => u.alive && u.team !== actor.team);
  const blocked = new Set(foes.map((u) => key(u.x, u.y)));
  const occupied = new Set(units.filter((u) => u.alive && u.uid !== actor.uid).map((u) => key(u.x, u.y)));
  const reach = movementRange({
    map,
    terrain: data.terrain,
    start: actor,
    move: def.move,
    moveTypes: def.moveTypes,
    blocked,
  });
  const stops = stoppableTiles(reach, occupied, actor);
  const stay = { x: actor.x, y: actor.y };

  let best: { dest: Vec2; attack: AiAttack } | null = null;
  for (const dest of stops) {
    const moved = dest.x !== actor.x || dest.y !== actor.y;
    const moveCost = reach.costs.get(key(dest.x, dest.y)) ?? 0;
    const a = ctx.combatant(actor, dest);
    for (const wid of def.weapons) {
      const w = data.weapons[wid];
      if (!w || weaponAvailability(actor, w, moved)) continue;
      for (const foe of foes) {
        if (!inWeaponRange(manhattan(dest, foe), w)) continue;
        const input = { attacker: a, defender: ctx.combatant(foe), weapon: w, defense: 'counter' as const };
        if (!canAttack(input)) continue;
        const hit = hitChance(input) / 100;
        const dmg = finalDamage(input, false);
        let score = hit * dmg;
        if (dmg >= foe.hp) score += 2000 * hit;
        score -= moveCost * 0.01; // prefer not moving when otherwise equal
        if (!best || score > best.attack.score) best = { dest, attack: { weapon: w, target: foe, score } };
      }
    }
  }
  if (best) return { dest: best.dest, path: pathTo(reach, best.dest), attack: best.attack };

  if (foes.length === 0) return { dest: stay, path: [stay], attack: null };
  let bestDest = stay;
  let bestScore = Infinity;
  for (const dest of stops) {
    const nearest = Math.min(...foes.map((f) => manhattan(dest, f)));
    const score = nearest * 10 + (reach.costs.get(key(dest.x, dest.y)) ?? 0);
    if (score < bestScore) {
      bestScore = score;
      bestDest = dest;
    }
  }
  return { dest: bestDest, path: pathTo(reach, bestDest), attack: null };
}

export interface DefenseChoice {
  action: DefenseAction;
  weapon: WeaponDef | null;
}

/**
 * Defender's reaction: counter with the best weapon that can reach the attacker,
 * otherwise players default to evading and enemies to defending.
 */
export function chooseDefense(defender: Combatant, attacker: Combatant, data: GameData): DefenseChoice {
  const dist = manhattan(defender.state, attacker.state);
  let best: { w: WeaponDef; score: number } | null = null;
  for (const wid of defender.def.weapons) {
    const w = data.weapons[wid];
    if (!w || weaponAvailability(defender.state, w, false)) continue;
    if (!inWeaponRange(dist, w)) continue;
    const input = { attacker: defender, defender: attacker, weapon: w, defense: 'counter' as const };
    if (!canAttack(input)) continue;
    const score = (hitChance(input) / 100) * finalDamage(input, false);
    if (!best || score > best.score) best = { w, score };
  }
  if (best) return { action: 'counter', weapon: best.w };
  return { action: defender.state.team === 'player' ? 'evade' : 'defend', weapon: null };
}
