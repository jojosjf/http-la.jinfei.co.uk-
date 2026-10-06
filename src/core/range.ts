import { inBounds, manhattan } from './grid';
import type { GameMap, Vec2 } from './types';

/** All tiles whose Manhattan distance from `center` is within [min, max]. */
export function tilesInRange(center: Vec2, min: number, max: number, map: GameMap): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (!inBounds(map, x, y)) continue;
      const d = manhattan(center, { x, y });
      if (d >= min && d <= max) out.push({ x, y });
    }
  }
  return out;
}

export function inWeaponRange(dist: number, w: { rangeMin: number; rangeMax: number }): boolean {
  return dist >= w.rangeMin && dist <= w.rangeMax;
}
