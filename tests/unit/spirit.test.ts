import { describe, expect, it } from 'vitest';
import { finalDamage, hitChance, type Combatant, type StrikeInput } from '../../src/core/battle';
import {
  activeSpiritLabels,
  castSpirit,
  consumeAttackSpirits,
  consumeDefenseSpirits,
  expireTurnSpirits,
  spiritBlocked,
  SPIRITS,
} from '../../src/core/spirit';
import { createUnit, unitDomain } from '../../src/core/unit';
import { loadData } from '../../src/data';

const gd = loadData();
const plain = gd.terrain.plain;
function fighter(id: string, team: 'player' | 'enemy'): Combatant {
  const def = gd.units[id];
  const pilot = gd.pilots[id];
  const state = createUnit(id, def, pilot, gd.weapons, team, 0, 0);
  return { def, pilot, state, terrain: plain, domain: unitDomain(def, plain) };
}
const ctx = (c: Combatant) => ({ maxHp: c.def.hp, maxEn: c.def.en, moved: false });
const strike = (a: Combatant, d: Combatant): StrikeInput => ({ attacker: a, defender: d, weapon: gd.weapons.liuyun_jian, defense: 'counter' });

describe('神通', () => {
  it('costs 神识 and refuses when short or already active', () => {
    const y = fighter('yunheng', 'player');
    const sp = y.state.sp;
    castSpirit(y.state, '狂怒', ctx(y));
    expect(y.state.sp).toBe(sp - SPIRITS['狂怒'].cost);
    expect(spiritBlocked(y.state, '狂怒', ctx(y))).toBe('已生效');
    y.state.sp = 5;
    expect(spiritBlocked(y.state, '破妄', ctx(y))).toBe('神识不足');
    expect(spiritBlocked({ ...y.state, sp: 99 }, '神行', { ...ctx(y), moved: true })).toBe('已移动');
  });

  it('破妄 hits 100%, 身法 dodges even 破妄, 凝神 shifts both ways', () => {
    const y = fighter('yunheng', 'player');
    const e = fighter('heilei', 'enemy');
    const base = hitChance(strike(y, e));
    y.state.sp = 999;
    castSpirit(y.state, '凝神', ctx(y));
    expect(hitChance(strike(y, e))).toBe(Math.min(100, base + 30));
    castSpirit(y.state, '破妄', ctx(y));
    expect(hitChance(strike(y, e))).toBe(100);
    e.state.spirit = { dodge: true };
    expect(hitChance(strike(y, e))).toBe(0);
  });

  it('狂怒 / 剑心 multiply damage, 金刚 quarters it, 坚守 sets it to 10', () => {
    const y = fighter('yunheng', 'player');
    const e = fighter('fenlu', 'enemy');
    const base = finalDamage(strike(y, e), false);
    y.state.spirit = { power: 2 };
    expect(finalDamage(strike(y, e), false)).toBe(Math.floor(base * 2));
    y.state.spirit = { power: 3 };
    expect(finalDamage(strike(y, e), false)).toBe(Math.floor(base * 3));
    y.state.spirit = {};
    e.state.spirit = { wall: true };
    expect(finalDamage(strike(y, e), false)).toBe(Math.floor(base * 0.25));
    e.state.spirit = { guts: true };
    expect(finalDamage(strike(y, e), false)).toBe(10);
  });

  it('effects expire at the right moments', () => {
    const y = fighter('yunheng', 'player');
    y.state.spirit = { focus: true, sureHit: true, wall: true, accel: true, power: 2, luck: true, effort: true, dodge: true, guts: true };
    consumeAttackSpirits(y.state);
    expect(activeSpiritLabels(y.state)).toEqual(['凝神', '破妄', '身法', '金刚', '坚守', '神行']);
    consumeDefenseSpirits(y.state, false);
    expect(activeSpiritLabels(y.state)).toEqual(['凝神', '破妄', '金刚', '坚守', '神行']);
    consumeDefenseSpirits(y.state, true);
    expireTurnSpirits(y.state);
    expect(activeSpiritLabels(y.state)).toEqual([]);
  });

  it('instant spirits restore 战意 / 气血 / 灵力 within limits', () => {
    const s = fighter('shipojun', 'player');
    s.state.sp = 999;
    s.state.hp = 100;
    castSpirit(s.state, '回春', ctx(s));
    expect(s.state.hp).toBe(100 + Math.floor(s.def.hp * 0.3));
    castSpirit(s.state, '聚气', ctx(s));
    expect(s.state.morale).toBe(110);
    expect(spiritBlocked({ ...s.state, en: s.def.en }, '灵慧', ctx(s))).toBe('灵力已满');
  });

  it('every character lists only known 神通', () => {
    for (const p of Object.values(gd.pilots)) for (const sp of p.spirits) expect(Object.keys(SPIRITS), `${p.id}: ${sp}`).toContain(sp);
  });
});
