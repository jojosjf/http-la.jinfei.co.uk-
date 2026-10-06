import type { UnitState } from './types';

/** 气力 rules (first draft, all tunable). */
export const MORALE = {
  min: 50,
  max: 150,
  onHit: 1,
  onEvade: 1,
  onDamaged: 1,
  onKill: 3,
  onAllyLost: 1,
} as const;

export function addMorale(u: UnitState, delta: number): void {
  u.morale = Math.max(MORALE.min, Math.min(MORALE.max, u.morale + delta));
}
