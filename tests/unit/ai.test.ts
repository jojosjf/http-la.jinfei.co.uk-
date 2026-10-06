import { describe, expect, it } from 'vitest';
import { chooseDefense, planAction } from '../../src/ai/simple';
import type { Combatant } from '../../src/core/battle';
import { manhattan } from '../../src/core/grid';
import type { GameMap, UnitState, Vec2 } from '../../src/core/types';
import { createUnit, unitDomain } from '../../src/core/unit';
import { loadData } from '../../src/data';

const gd = loadData();
const map: GameMap = {
  width: 12,
  height: 3,
  tiles: Array.from({ length: 3 }, () => Array.from({ length: 12 }, () => 'plain')),
};

function mk(uid: string, unitId: string, pilotId: string, team: 'player' | 'enemy', x: number, y: number): UnitState {
  return createUnit(uid, gd.units[unitId], gd.pilots[pilotId], gd.weapons, team, x, y);
}

function ctx(units: UnitState[], actor: UnitState) {
  const combatant = (u: UnitState, at?: Vec2): Combatant => {
    const def = gd.units[u.unitId];
    const pos = at ?? u;
    const terrain = gd.terrain[map.tiles[pos.y][pos.x]];
    return { def, pilot: gd.pilots[u.pilotId], state: u, terrain, domain: unitDomain(def, terrain) };
  };
  return { map, data: gd, units, actor, combatant };
}

describe('planAction', () => {
  it('attacks a player unit it can reach', () => {
    const enemy = mk('e', 'e_quanya', 'grunt_a', 'enemy', 0, 1);
    const player = mk('p', 'tiejuren', 'shiyan', 'player', 4, 1);
    const plan = planAction(ctx([enemy, player], enemy));
    expect(plan.attack).not.toBeNull();
    expect(plan.attack?.target.uid).toBe('p');
    expect(manhattan(plan.dest, player)).toBeLessThanOrEqual(plan.attack!.weapon.rangeMax);
    expect(manhattan(plan.dest, player)).toBeGreaterThanOrEqual(plan.attack!.weapon.rangeMin);
  });

  it('walks towards the nearest player unit when nothing is in reach', () => {
    const enemy = mk('e', 'e_yeniu', 'heavy', 'enemy', 0, 1);
    const player = mk('p', 'cangqiong', 'linkai', 'player', 11, 1);
    const plan = planAction(ctx([enemy, player], enemy));
    expect(plan.attack).toBeNull();
    expect(manhattan(plan.dest, player)).toBeLessThan(manhattan(enemy, player));
    expect(plan.path[0]).toEqual({ x: 0, y: 1 });
    expect(plan.path[plan.path.length - 1]).toEqual(plan.dest);
  });

  it('prefers the target it can destroy', () => {
    const enemy = mk('e', 'e_liaoya', 'captain', 'enemy', 5, 1);
    const weak = mk('w', 'jifeng', 'zhouyu', 'player', 6, 1);
    weak.hp = 300;
    const tank = mk('t', 'tiejuren', 'shiyan', 'player', 4, 1);
    const plan = planAction(ctx([enemy, weak, tank], enemy));
    expect(plan.attack?.target.uid).toBe('w');
  });
});

describe('chooseDefense', () => {
  it('counters when a weapon reaches the attacker, otherwise evades (player) / defends (enemy)', () => {
    const enemy = mk('e', 'e_quanya', 'grunt_a', 'enemy', 0, 1);
    const player = mk('p', 'jifeng', 'zhouyu', 'player', 1, 1);
    const c = ctx([enemy, player], enemy);
    expect(chooseDefense(c.combatant(player), c.combatant(enemy), gd).action).toBe('counter');

    const far = mk('f', 'e_yeniu', 'heavy', 'enemy', 9, 1); // claw 1, cannon 2-6; attacker at distance 8
    const sniper = mk('s', 'jifeng', 'zhouyu', 'player', 1, 1);
    expect(chooseDefense(c.combatant(far), c.combatant(sniper), gd)).toEqual({ action: 'defend', weapon: null });
    // player with only melee/short weapons vs a far attacker -> evade
    const tank = mk('t', 'tiejuren', 'shiyan', 'player', 1, 1);
    expect(chooseDefense(c.combatant(tank), c.combatant(far), gd).action).toBe('evade');
  });
});
