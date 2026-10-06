import type { GameMap } from './types';

/** 4-neighbour bit flags used by the map renderer for edge-aware tiles. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

/**
 * Bitmask of the 4 neighbours of (x, y) whose terrain id satisfies `pred`.
 * Tiles outside the map count as matching when `outside` is true, so shorelines
 * and road ends are not drawn along the map border.
 */
export function neighborMask(
  map: GameMap,
  x: number,
  y: number,
  pred: (terrainId: string) => boolean,
  outside = true,
): number {
  const test = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return outside;
    return pred(map.tiles[ny][nx]);
  };
  let m = 0;
  if (test(x, y - 1)) m |= N;
  if (test(x + 1, y)) m |= E;
  if (test(x, y + 1)) m |= S;
  if (test(x - 1, y)) m |= W;
  return m;
}

/** Deterministic per-tile hash so procedural detail is stable between runs. */
export function tileHash(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
