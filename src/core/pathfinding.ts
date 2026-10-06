import { DIRS, inBounds, key, parseKey } from './grid';
import type { GameMap, MoveType, TerrainDef, Vec2 } from './types';

export interface MoveQuery {
  map: GameMap;
  terrain: Record<string, TerrainDef>;
  start: Vec2;
  move: number;
  moveTypes: MoveType[];
  /** Tiles that cannot be entered or passed through (enemy units). */
  blocked: Set<string>;
}

export interface Reach {
  /** key -> cheapest movement cost to reach that tile */
  costs: Map<string, number>;
  /** key -> previous key on the cheapest path (null for the start) */
  prev: Map<string, string | null>;
}

/** Cheapest cost to enter a tile for a unit with the given move types; null if impassable. */
export function tileCost(t: TerrainDef, moveTypes: MoveType[]): number | null {
  let best: number | null = null;
  for (const mt of moveTypes) {
    const c = t.cost[mt];
    if (c !== undefined && c > 0 && (best === null || c < best)) best = c;
  }
  return best;
}

/** Dijkstra flood-fill of every tile reachable within `move` points. */
export function movementRange(q: MoveQuery): Reach {
  const costs = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const startKey = key(q.start.x, q.start.y);
  costs.set(startKey, 0);
  prev.set(startKey, null);
  const frontier: string[] = [startKey];

  while (frontier.length > 0) {
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if ((costs.get(frontier[i]) ?? Infinity) < (costs.get(frontier[bi]) ?? Infinity)) bi = i;
    }
    const cur = frontier.splice(bi, 1)[0];
    const curCost = costs.get(cur) ?? 0;
    const { x, y } = parseKey(cur);

    for (const d of DIRS) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (!inBounds(q.map, nx, ny)) continue;
      const nk = key(nx, ny);
      if (q.blocked.has(nk)) continue;
      const terrain = q.terrain[q.map.tiles[ny][nx]];
      if (!terrain) continue;
      const tc = tileCost(terrain, q.moveTypes);
      if (tc === null) continue;
      const nc = curCost + tc;
      if (nc > q.move) continue;
      const old = costs.get(nk);
      if (old === undefined || nc < old) {
        costs.set(nk, nc);
        prev.set(nk, cur);
        if (!frontier.includes(nk)) frontier.push(nk);
      }
    }
  }
  return { costs, prev };
}

/** Tiles the unit may end its move on: reachable and not occupied by another unit. */
export function stoppableTiles(reach: Reach, occupied: Set<string>, start: Vec2): Vec2[] {
  const out: Vec2[] = [];
  for (const k of reach.costs.keys()) {
    if (occupied.has(k)) continue;
    out.push(parseKey(k));
  }
  const sk = key(start.x, start.y);
  if (!reach.costs.has(sk)) out.push({ ...start });
  return out;
}

/** Path from the start tile to `target` (inclusive on both ends). Empty if unreachable. */
export function pathTo(reach: Reach, target: Vec2): Vec2[] {
  let k: string | null | undefined = key(target.x, target.y);
  if (!reach.costs.has(k)) return [];
  const path: Vec2[] = [];
  while (k) {
    path.push(parseKey(k));
    k = reach.prev.get(k);
  }
  return path.reverse();
}
