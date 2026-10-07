import { deploymentIds } from '../core/scenario';
import { isSpiritId } from '../core/spirit';
import type { Deployment, PilotDef, ScenarioDef, TerrainDef, UnitDef, WeaponDef } from '../core/types';
import pilots from './pilots.json';
import s01 from './scenarios/s01.json';
import s02 from './scenarios/s02.json';
import s03 from './scenarios/s03.json';
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
    scenarios: {
      s01: s01 as unknown as ScenarioDef,
      s02: s02 as unknown as ScenarioDef,
      s03: s03 as unknown as ScenarioDef,
    },
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
    const checkDeploy = (d: Deployment, where: string): void => {
      const { unit, pilot } = deploymentIds(d);
      if (!gd.units[unit]) errors.push(`${s.id}: ${where} unknown character body ${unit}`);
      if (!gd.pilots[pilot]) errors.push(`${s.id}: ${where} unknown character cultivation record ${pilot}`);
      if (d.x < 0 || d.y < 0 || d.x >= s.width || d.y >= s.height) {
        errors.push(`${s.id}: ${where} ${unit} out of bounds`);
        return;
      }
      const tid = s.legend[[...s.rows[d.y]][d.x]];
      const moves = gd.units[unit]?.moveTypes ?? [];
      if (gd.terrain[tid] && moves.length && !moves.some((m) => gd.terrain[tid].cost[m] !== undefined)) {
        errors.push(`${s.id}: ${where} ${unit} stands on impassable ${tid} at ${d.x},${d.y}`);
      }
    };
    for (const d of s.deploy) {
      checkDeploy(d, 'deploy');
      const k = `${d.x},${d.y}`;
      if (seen.has(k)) errors.push(`${s.id}: two units deployed at ${k}`);
      seen.add(k);
    }
    // everyone who can appear in this stage, by body and cultivation id
    const cast = new Set<string>();
    const addCast = (d: Deployment): void => {
      const { unit, pilot } = deploymentIds(d);
      cast.add(unit).add(pilot);
    };
    s.deploy.forEach(addCast);
    (s.events ?? []).forEach((e) => e.spawn?.forEach(addCast));
    const known = (who: string): boolean => cast.has(who);
    (s.events ?? []).forEach((e, i) => {
      const where = `event ${i}`;
      e.spawn?.forEach((d) => checkDeploy(d, where));
      const w = e.when;
      if ((w.type === 'defeated' || w.type === 'hpBelow') && !known(w.who)) errors.push(`${s.id}: ${where} names ${w.who}, not in this stage`);
      if (w.type === 'battle' && (!known(w.a) || !known(w.b))) errors.push(`${s.id}: ${where} battle ${w.a}/${w.b} not in this stage`);
      for (const l of e.talk ?? []) {
        if (/^[a-z_0-9]+$/.test(l.who) && !gd.pilots[l.who] && !gd.units[l.who]) errors.push(`${s.id}: ${where} unknown speaker ${l.who}`);
        if ([...l.text].length > 60) errors.push(`${s.id}: ${where} line too long (${[...l.text].length} > 60): ${l.text.slice(0, 12)}…`);
      }
      for (const m of e.morale ?? []) if (!known(m.who)) errors.push(`${s.id}: ${where} morale for unknown ${m.who}`);
      for (const sp of e.spirit ?? []) {
        if (!known(sp.who)) errors.push(`${s.id}: ${where} 神通 for unknown ${sp.who}`);
        if (!isSpiritId(sp.id)) errors.push(`${s.id}: ${where} unknown 神通 ${sp.id}`);
      }
      for (const who of e.release ?? []) if (!known(who)) errors.push(`${s.id}: ${where} release unknown ${who}`);
    });
    if (s.win === 'boss' && !s.deploy.some((d) => d.boss) && !(s.events ?? []).some((e) => e.spawn?.some((d) => d.boss))) {
      errors.push(`${s.id}: win "boss" but no boss is deployed`);
    }
    if (s.next && !gd.scenarios[s.next]) errors.push(`${s.id}: next stage ${s.next} does not exist`);
  }
  return errors;
}
