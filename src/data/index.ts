import { deploymentIds } from '../core/scenario';
import type { PilotDef, ScenarioDef, TerrainDef, UnitDef, WeaponDef } from '../core/types';
import pilots from './pilots.json';
import s01 from './scenarios/s01.json';
import terrain from './terrain.json';
import units from './units.json';
import weapons from './weapons.json';

export interface GameData {
  terrain: Record<string, TerrainDef>;
  units: Record<string, UnitDef>;
  pilots: Record<string, PilotDef>;
  weapons: Record<string, WeaponDef>;
  scenarios: Record<string, ScenarioDef>;
}

/** All static game data, bundled as JSON. Later this is generated from spreadsheets. */
export function loadData(): GameData {
  return {
    terrain: terrain as unknown as Record<string, TerrainDef>,
    units: units as unknown as Record<string, UnitDef>,
    pilots: pilots as unknown as Record<string, PilotDef>,
    weapons: weapons as unknown as Record<string, WeaponDef>,
    scenarios: { s01: s01 as unknown as ScenarioDef },
  };
}

/** Cross-reference checks. Returns a list of human-readable problems (empty = OK). */
export function validateData(gd: GameData): string[] {
  const errors: string[] = [];
  for (const u of Object.values(gd.units)) {
    if (u.weapons.length === 0) errors.push(`unit ${u.id}: no weapons`);
    for (const w of u.weapons) if (!gd.weapons[w]) errors.push(`unit ${u.id}: unknown weapon ${w}`);
    if (u.moveTypes.length === 0) errors.push(`unit ${u.id}: no move types`);
  }
  for (const s of Object.values(gd.scenarios)) {
    if (s.rows.length !== s.height) errors.push(`${s.id}: ${s.rows.length} rows, expected ${s.height}`);
    s.rows.forEach((row, y) => {
      const glyphs = [...row];
      if (glyphs.length !== s.width) errors.push(`${s.id}: row ${y} has ${glyphs.length} glyphs, expected ${s.width}`);
      for (const ch of glyphs) {
        const tid = s.legend[ch];
        if (!tid) errors.push(`${s.id}: row ${y} unknown glyph '${ch}'`);
        else if (!gd.terrain[tid]) errors.push(`${s.id}: legend '${ch}' -> unknown terrain ${tid}`);
      }
    });
    const seen = new Set<string>();
    for (const d of s.deploy) {
      const { unit, pilot } = deploymentIds(d);
      if (!gd.units[unit]) errors.push(`${s.id}: unknown character body ${unit}`);
      if (!gd.pilots[pilot]) errors.push(`${s.id}: unknown character cultivation record ${pilot}`);
      if (d.x < 0 || d.y < 0 || d.x >= s.width || d.y >= s.height) errors.push(`${s.id}: ${unit} deployed out of bounds`);
      const k = `${d.x},${d.y}`;
      if (seen.has(k)) errors.push(`${s.id}: two units deployed at ${k}`);
      seen.add(k);
    }
  }
  return errors;
}
