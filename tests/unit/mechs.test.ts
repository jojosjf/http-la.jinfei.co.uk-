import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heldParts, validateRig, weaponSide, type RigDef } from '../../src/core/rig';

const index = JSON.parse(readFileSync('public/mechs/index.json', 'utf8')) as { dolls: Array<{ id: string; rig?: string; icon?: string }> };
const rigs = index.dolls.filter((d) => d.rig);

describe('imported 天工仙甲 rigs', () => {
  it('are listed', () => {
    expect(rigs.length).toBeGreaterThan(0);
  });

  for (const entry of rigs) {
    it(`${entry.id} is a valid, complete rig`, () => {
      const rig = JSON.parse(readFileSync(`public/${entry.rig}`, 'utf8')) as RigDef;
      expect(rig.id).toBe(entry.id);
      expect(validateRig(rig)).toEqual([]);
      expect(existsSync(`public/mechs/${entry.id}/${rig.image}`)).toBe(true);
      if (entry.icon) expect(existsSync(`public/${entry.icon}`)).toBe(true);
      const held = heldParts(rig);
      const w = weaponSide(rig);
      // the weapon side, when there is a held item, faces forward after import
      if (held[w]) expect(rig.parts.find((p) => p.id === held[w])!.x).toBeGreaterThanOrEqual(-2);
    });
  }
});
