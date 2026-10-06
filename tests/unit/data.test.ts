import { describe, expect, it } from 'vitest';
import { buildMap } from '../../src/core/scenario';
import { loadData, validateData } from '../../src/data';

describe('game data', () => {
  const gd = loadData();

  it('is internally consistent', () => {
    expect(validateData(gd)).toEqual([]);
  });

  it('scenario s01 builds a 20x15 map with 3 player and 5 enemy units', () => {
    const s = gd.scenarios.s01;
    const map = buildMap(s);
    expect(map.width).toBe(20);
    expect(map.height).toBe(15);
    expect(map.tiles.flat().every((t) => gd.terrain[t])).toBe(true);
    expect(s.deploy.filter((d) => d.team === 'player')).toHaveLength(3);
    expect(s.deploy.filter((d) => d.team === 'enemy')).toHaveLength(5);
  });

  it('every weapon has a sane range and adaptation', () => {
    for (const w of Object.values(gd.weapons)) {
      expect(w.rangeMin).toBeGreaterThanOrEqual(1);
      expect(w.rangeMax).toBeGreaterThanOrEqual(w.rangeMin);
      expect(Object.keys(w.adapt).sort()).toEqual(['air', 'land', 'sea', 'space']);
    }
  });
});
