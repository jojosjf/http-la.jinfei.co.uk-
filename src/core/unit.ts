import type { Domain, PilotDef, Team, TerrainDef, UnitDef, UnitState, WeaponDef } from './types';

export function createUnit(
  uid: string,
  def: UnitDef,
  pilot: PilotDef,
  weapons: Record<string, WeaponDef>,
  team: Team,
  x: number,
  y: number,
): UnitState {
  const ammo: Record<string, number> = {};
  for (const wid of def.weapons) {
    const w = weapons[wid];
    if (w && w.ammo !== null) ammo[wid] = w.ammo;
  }
  return {
    uid,
    unitId: def.id,
    pilotId: pilot.id,
    team,
    x,
    y,
    hp: def.hp,
    en: def.en,
    sp: pilot.sp,
    morale: pilot.moraleStart ?? 100,
    ammo,
    acted: false,
    moved: false,
    level: pilot.level,
    exp: 0,
    alive: true,
  };
}

/** Which domain a unit fights in on the given terrain. Flyers are always airborne (simplification). */
export function unitDomain(def: UnitDef, terrain: TerrainDef): Domain {
  if (def.moveTypes.includes('air')) return 'air';
  return terrain.domain;
}

export type Unavailable = 'ammo' | 'en' | 'morale' | 'postMove';

export const UNAVAILABLE_TEXT: Record<Unavailable, string> = {
  ammo: '弹药不足',
  en: 'EN不足',
  morale: '气力不足',
  postMove: '移动后不可用',
};

/** Why a weapon cannot be fired right now, or null if it can. Range is checked separately. */
export function weaponAvailability(state: UnitState, w: WeaponDef, moved: boolean): Unavailable | null {
  if (moved && !w.postMove) return 'postMove';
  if (w.ammo !== null && (state.ammo[w.id] ?? 0) <= 0) return 'ammo';
  if (w.en > state.en) return 'en';
  if (state.morale < w.morale) return 'morale';
  return null;
}

export function consumeWeapon(state: UnitState, w: WeaponDef): void {
  if (w.ammo !== null) state.ammo[w.id] = Math.max(0, (state.ammo[w.id] ?? 0) - 1);
  state.en = Math.max(0, state.en - w.en);
}
