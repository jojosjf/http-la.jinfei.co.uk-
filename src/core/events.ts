import type { ScenarioDef, ScenarioEvent, Team, Vec2 } from './types';

/** What the event and victory checks need to know about a unit. */
export interface EventUnit {
  unitId: string;
  pilotId: string;
  team: Team;
  hp: number;
  maxHp: number;
  alive: boolean;
  boss?: boolean;
}

/** The moment being checked: stage start, a player turn starting, after a strike, before a battle, after a clear. */
export type EventCheck =
  | { type: 'start' }
  | { type: 'turn'; turn: number }
  | { type: 'status' }
  | { type: 'battle'; a: { unitId: string; pilotId: string }; b: { unitId: string; pilotId: string } }
  | { type: 'clear' };

export const DEFAULT_LEADERS = ['yunheng'];

/** A unit answers to its body id or its cultivation id (a boss pilot riding a puppet). */
export function matches(u: { unitId: string; pilotId: string }, who: string): boolean {
  return u.unitId === who || u.pilotId === who;
}

/** Indices of the not-yet-fired events that fire at this moment, in file order. */
export function dueEvents(
  events: readonly ScenarioEvent[],
  fired: ReadonlySet<number>,
  check: EventCheck,
  units: readonly EventUnit[],
): number[] {
  const out: number[] = [];
  events.forEach((e, i) => {
    if (fired.has(i)) return;
    if (triggers(e, check, units)) out.push(i);
  });
  return out;
}

function triggers(e: ScenarioEvent, check: EventCheck, units: readonly EventUnit[]): boolean {
  const w = e.when;
  switch (w.type) {
    case 'start':
    case 'clear':
      return check.type === w.type;
    case 'turn':
      return check.type === 'turn' && check.turn === w.turn;
    case 'defeated': {
      if (check.type !== 'status') return false;
      const named = units.filter((u) => matches(u, w.who));
      return named.length > 0 && named.every((u) => !u.alive);
    }
    case 'hpBelow':
      return (
        check.type === 'status' &&
        units.some((u) => u.alive && matches(u, w.who) && u.hp * 100 < w.pct * u.maxHp)
      );
    case 'battle':
      return (
        check.type === 'battle' &&
        ((matches(check.a, w.a) && matches(check.b, w.b)) || (matches(check.a, w.b) && matches(check.b, w.a)))
      );
  }
}

export type Outcome = 'win' | 'lose' | null;

/** Victory / defeat by the scenario's conditions. Defeat is checked first. */
export function stageOutcome(s: Pick<ScenarioDef, 'win' | 'lose' | 'leaders'>, units: readonly EventUnit[]): Outcome {
  const players = units.filter((u) => u.team === 'player');
  if (!players.some((u) => u.alive)) return 'lose';
  if (s.lose === 'leader') {
    const leaders = s.leaders ?? DEFAULT_LEADERS;
    if (players.some((u) => !u.alive && leaders.some((id) => matches(u, id)))) return 'lose';
  }
  const enemies = units.filter((u) => u.team === 'enemy');
  if (!enemies.some((u) => u.alive)) return 'win';
  if (s.win === 'boss') {
    const bosses = enemies.filter((u) => u.boss);
    if (bosses.length > 0 && bosses.every((u) => !u.alive)) return 'win';
  }
  return null;
}

/** True while a `hold` unit should stay where it is. */
export function isHolding(hold: boolean | number | undefined, turn: number): boolean {
  if (hold === true) return true;
  return typeof hold === 'number' && turn < hold;
}

/**
 * The free tile nearest to `want` (by Manhattan distance, then row-major order) that `ok` accepts,
 * searching up to `maxRadius` away. Null if there is none.
 */
export function nearestFree(
  want: Vec2,
  size: { width: number; height: number },
  ok: (x: number, y: number) => boolean,
  maxRadius = 6,
): Vec2 | null {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const rest = r - Math.abs(dy);
      for (const dx of rest === 0 ? [0] : [-rest, rest]) {
        const x = want.x + dx;
        const y = want.y + dy;
        if (x < 0 || y < 0 || x >= size.width || y >= size.height) continue;
        if (ok(x, y)) return { x, y };
      }
    }
  }
  return null;
}
