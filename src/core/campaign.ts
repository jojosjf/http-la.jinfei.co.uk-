import type { UnitState } from './types';

/** What carries over between stages: 灵石 and each player character's 境界 / experience. */
export interface CampaignState {
  money: number;
  roster: Record<string, { level: number; exp: number }>;
}

export function newCampaign(): CampaignState {
  return { money: 0, roster: {} };
}

/** Campaign after a cleared stage: the stage's money and every player character's growth (fallen ones too). */
export function recordStage(c: CampaignState, units: readonly UnitState[], money: number): CampaignState {
  const roster = { ...c.roster };
  for (const u of units) {
    if (u.team === 'player') roster[u.pilotId] = { level: u.level, exp: u.exp };
  }
  return { money, roster };
}

/** Starts a freshly deployed player unit at the level it reached in earlier stages. */
export function applyRoster(u: UnitState, c: CampaignState): void {
  const r = c.roster[u.pilotId];
  if (u.team !== 'player' || !r) return;
  u.level = Math.max(u.level, r.level);
  u.exp = r.exp;
}

export function isCampaignState(v: unknown): v is CampaignState {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<CampaignState>;
  return typeof c.money === 'number' && !!c.roster && typeof c.roster === 'object';
}
