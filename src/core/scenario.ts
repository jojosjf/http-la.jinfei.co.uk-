import type { Deployment, GameMap, ScenarioDef } from './types';

/** Body and cultivation record ids of a deployment (a character id stands for both). */
export function deploymentIds(d: Deployment): { unit: string; pilot: string } {
  return { unit: d.unit ?? d.character ?? '', pilot: d.pilot ?? d.character ?? d.unit ?? '' };
}

/** Expand a scenario's glyph rows into a terrain-id grid. Throws on malformed data. */
export function buildMap(s: ScenarioDef): GameMap {
  if (s.rows.length !== s.height) {
    throw new Error(`scenario ${s.id}: expected ${s.height} rows, got ${s.rows.length}`);
  }
  const tiles = s.rows.map((row, y) => {
    const glyphs = [...row];
    if (glyphs.length !== s.width) {
      throw new Error(`scenario ${s.id}: row ${y} has ${glyphs.length} glyphs, expected ${s.width}`);
    }
    return glyphs.map((ch, x) => {
      const id = s.legend[ch];
      if (!id) throw new Error(`scenario ${s.id}: unknown glyph '${ch}' at ${x},${y}`);
      return id;
    });
  });
  return { width: s.width, height: s.height, tiles };
}
