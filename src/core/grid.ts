import type { GameMap, Vec2 } from './types';

export const key = (x: number, y: number): string => `${x},${y}`;

export function parseKey(k: string): Vec2 {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export const DIRS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
