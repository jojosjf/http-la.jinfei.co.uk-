import { describe, expect, it } from 'vitest';
import { E, N, S, W, neighborMask, tileHash } from '../../src/core/tilemask';
import type { GameMap } from '../../src/core/types';

const map: GameMap = {
  width: 3,
  height: 3,
  tiles: [
    ['plain', 'river', 'plain'],
    ['river', 'road', 'river'],
    ['plain', 'river', 'plain'],
  ],
};
const isWater = (id: string): boolean => id === 'river';

describe('neighborMask', () => {
  it('flags the matching 4-neighbours', () => {
    expect(neighborMask(map, 1, 1, isWater)).toBe(N | E | S | W);
    expect(neighborMask(map, 0, 0, isWater, false)).toBe(E | S);
  });

  it('treats tiles outside the map as matching only when asked', () => {
    expect(neighborMask(map, 0, 0, isWater, true)).toBe(N | E | S | W);
    expect(neighborMask(map, 0, 0, isWater, false)).toBe(E | S);
  });
});

describe('tileHash', () => {
  it('is deterministic and differs between neighbouring tiles and seeds', () => {
    expect(tileHash(3, 4, 7)).toBe(tileHash(3, 4, 7));
    expect(tileHash(3, 4, 7)).not.toBe(tileHash(4, 3, 7));
    expect(tileHash(3, 4, 7)).not.toBe(tileHash(3, 4, 8));
  });
});
