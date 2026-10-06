import { describe, expect, it } from 'vitest';
import { key } from '../../src/core/grid';
import { movementRange, pathTo, stoppableTiles, tileCost } from '../../src/core/pathfinding';
import type { GameMap, TerrainDef } from '../../src/core/types';

const T: Record<string, TerrainDef> = {
  plain: { id: 'plain', name: '平原', domain: 'land', cost: { land: 1, air: 1 }, evade: 0, defense: 0, hpRecover: 0, enRecover: 0, color: '#000' },
  mountain: { id: 'mountain', name: '山地', domain: 'land', cost: { land: 3, air: 1 }, evade: 20, defense: 20, hpRecover: 0, enRecover: 0, color: '#000' },
  sea: { id: 'sea', name: '海', domain: 'sea', cost: { sea: 1, air: 1 }, evade: 0, defense: 0, hpRecover: 0, enRecover: 0, color: '#000' },
};

// 5x3 map: row 1 has a mountain at x=2, row 2 is sea.
const map: GameMap = {
  width: 5,
  height: 3,
  tiles: [
    ['plain', 'plain', 'plain', 'plain', 'plain'],
    ['plain', 'plain', 'mountain', 'plain', 'plain'],
    ['sea', 'sea', 'sea', 'sea', 'sea'],
  ],
};

describe('tileCost', () => {
  it('takes the cheapest of the unit move types and null when impassable', () => {
    expect(tileCost(T.mountain, ['land'])).toBe(3);
    expect(tileCost(T.mountain, ['land', 'air'])).toBe(1);
    expect(tileCost(T.sea, ['land'])).toBeNull();
    expect(tileCost(T.sea, ['land', 'sea'])).toBe(1);
  });
});

describe('movementRange', () => {
  it('spends movement points on terrain cost and respects the budget', () => {
    const r = movementRange({ map, terrain: T, start: { x: 0, y: 0 }, move: 3, moveTypes: ['land'], blocked: new Set() });
    expect(r.costs.get(key(3, 0))).toBe(3);
    expect(r.costs.has(key(4, 0))).toBe(false);
    // mountain at (2,1) costs 3: reachable via (1,1)? cost 2 + 3 = 5 > 3, via (2,0) 2 + 3 = 5 -> unreachable
    expect(r.costs.has(key(2, 1))).toBe(false);
    // land unit never enters the sea
    expect([...r.costs.keys()].some((k) => k.endsWith(',2'))).toBe(false);
  });

  it('flyers ignore terrain cost', () => {
    const r = movementRange({ map, terrain: T, start: { x: 0, y: 0 }, move: 3, moveTypes: ['land', 'air'], blocked: new Set() });
    expect(r.costs.get(key(2, 1))).toBe(3);
    expect(r.costs.get(key(0, 2))).toBe(2);
  });

  it('does not pass through blocked tiles', () => {
    const r = movementRange({
      map,
      terrain: T,
      start: { x: 0, y: 0 },
      move: 4,
      moveTypes: ['land'],
      blocked: new Set([key(1, 0), key(1, 1)]),
    });
    expect(r.costs.has(key(1, 0))).toBe(false);
    expect(r.costs.has(key(2, 0))).toBe(false);
  });
});

describe('pathTo / stoppableTiles', () => {
  const r = movementRange({ map, terrain: T, start: { x: 0, y: 0 }, move: 3, moveTypes: ['land'], blocked: new Set() });

  it('returns a path from start to target inclusive', () => {
    const p = pathTo(r, { x: 3, y: 0 });
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 3, y: 0 });
    expect(p).toHaveLength(4);
  });

  it('returns an empty path for unreachable tiles', () => {
    expect(pathTo(r, { x: 4, y: 0 })).toEqual([]);
  });

  it('excludes occupied tiles but keeps the start', () => {
    const stops = stoppableTiles(r, new Set([key(1, 0)]), { x: 0, y: 0 });
    expect(stops.some((t) => t.x === 1 && t.y === 0)).toBe(false);
    expect(stops.some((t) => t.x === 0 && t.y === 0)).toBe(true);
  });
});
