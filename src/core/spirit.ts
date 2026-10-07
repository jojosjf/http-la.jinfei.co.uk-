import type { UnitState } from './types';

/** 神通 (spirit commands). Effects live on the unit; battle formulas read them directly. */
export interface SpiritState {
  focus?: boolean; // 凝神: hit +30 / evade +30 this turn
  sureHit?: boolean; // 破妄: 100% hit this turn
  dodge?: boolean; // 身法: next attack against this unit misses
  power?: number; // 狂怒 2 / 剑心 3: next attack damage multiplier
  wall?: boolean; // 金刚: damage taken x1/4 this turn
  guts?: boolean; // 坚守: next hit deals 10
  luck?: boolean; // 福缘: next attack's kill money x2
  effort?: boolean; // 悟道: next attack's kill exp x2
  accel?: boolean; // 神行: move +3 this turn
}

export type SpiritId = '凝神' | '破妄' | '身法' | '狂怒' | '剑心' | '金刚' | '坚守' | '聚气' | '回春' | '灵慧' | '福缘' | '悟道' | '神行';

export interface SpiritDef {
  id: SpiritId;
  cost: number;
  /** One-line description shown in the menu. */
  desc: string;
}

export const SPIRITS: Record<SpiritId, SpiritDef> = {
  凝神: { id: '凝神', cost: 15, desc: '本回合命中+30 回避+30' },
  破妄: { id: '破妄', cost: 20, desc: '本回合攻击必中' },
  身法: { id: '身法', cost: 15, desc: '下次被攻击必定回避' },
  狂怒: { id: '狂怒', cost: 35, desc: '下次攻击伤害×2' },
  剑心: { id: '剑心', cost: 55, desc: '下次攻击伤害×3' },
  金刚: { id: '金刚', cost: 30, desc: '本回合受伤×1/4' },
  坚守: { id: '坚守', cost: 20, desc: '下次被命中伤害为10' },
  聚气: { id: '聚气', cost: 30, desc: '战意+10' },
  回春: { id: '回春', cost: 25, desc: '气血回复30%' },
  灵慧: { id: '灵慧', cost: 30, desc: '灵力回复40%' },
  福缘: { id: '福缘', cost: 35, desc: '下次击破灵石×2' },
  悟道: { id: '悟道', cost: 15, desc: '下次击破经验×2' },
  神行: { id: '神行', cost: 10, desc: '本回合移动+3' },
};

export const FOCUS_BONUS = 30;
export const ACCEL_MOVE = 3;
export const GUTS_DAMAGE = 10;
export const WALL_MULT = 0.25;

export function isSpiritId(s: string): s is SpiritId {
  return s in SPIRITS;
}

export interface SpiritContext {
  maxHp: number;
  maxEn: number;
  /** True once the unit has moved this turn (神行 is then pointless). */
  moved: boolean;
}

/** Why a spirit cannot be used right now, or null. */
export function spiritBlocked(u: UnitState, id: SpiritId, ctx: SpiritContext): string | null {
  return pointless(u, id, ctx) ?? (u.sp < SPIRITS[id].cost ? '神识不足' : null);
}

/** Why using the spirit would do nothing right now (checked before the cost). */
function pointless(u: UnitState, id: SpiritId, ctx: SpiritContext): string | null {
  const s = u.spirit ?? {};
  switch (id) {
    case '凝神':
      return s.focus ? '已生效' : null;
    case '破妄':
      return s.sureHit ? '已生效' : null;
    case '身法':
      return s.dodge ? '已生效' : null;
    case '狂怒':
      return (s.power ?? 1) >= 2 ? '已生效' : null;
    case '剑心':
      return (s.power ?? 1) >= 3 ? '已生效' : null;
    case '金刚':
      return s.wall ? '已生效' : null;
    case '坚守':
      return s.guts ? '已生效' : null;
    case '聚气':
      return u.morale >= 150 ? '战意已满' : null;
    case '回春':
      return u.hp >= ctx.maxHp ? '气血已满' : null;
    case '灵慧':
      return u.en >= ctx.maxEn ? '灵力已满' : null;
    case '福缘':
      return s.luck ? '已生效' : null;
    case '悟道':
      return s.effort ? '已生效' : null;
    case '神行':
      if (ctx.moved) return '已移动';
      return s.accel ? '已生效' : null;
  }
}

/** Apply a spirit (pays its cost). Caller checks spiritBlocked first. */
export function castSpirit(u: UnitState, id: SpiritId, ctx: SpiritContext): void {
  u.sp -= SPIRITS[id].cost;
  const s = (u.spirit ??= {});
  switch (id) {
    case '凝神':
      s.focus = true;
      break;
    case '破妄':
      s.sureHit = true;
      break;
    case '身法':
      s.dodge = true;
      break;
    case '狂怒':
      s.power = Math.max(s.power ?? 1, 2);
      break;
    case '剑心':
      s.power = 3;
      break;
    case '金刚':
      s.wall = true;
      break;
    case '坚守':
      s.guts = true;
      break;
    case '聚气':
      u.morale = Math.min(150, u.morale + 10);
      break;
    case '回春':
      u.hp = Math.min(ctx.maxHp, u.hp + Math.floor(ctx.maxHp * 0.3));
      break;
    case '灵慧':
      u.en = Math.min(ctx.maxEn, u.en + Math.floor(ctx.maxEn * 0.4));
      break;
    case '福缘':
      s.luck = true;
      break;
    case '悟道':
      s.effort = true;
      break;
    case '神行':
      s.accel = true;
      break;
  }
}

/** Turn-long effects end when the unit's side starts its next phase. */
export function expireTurnSpirits(u: UnitState): void {
  if (!u.spirit) return;
  delete u.spirit.focus;
  delete u.spirit.sureHit;
  delete u.spirit.wall;
  delete u.spirit.accel;
}

/** After the unit attacked (hit or miss): one-attack effects are spent. */
export function consumeAttackSpirits(u: UnitState): void {
  if (!u.spirit) return;
  delete u.spirit.power;
  delete u.spirit.luck;
  delete u.spirit.effort;
}

/** After the unit was attacked: 身法 is spent; 坚守 only when actually hit. */
export function consumeDefenseSpirits(u: UnitState, wasHit: boolean): void {
  if (!u.spirit) return;
  delete u.spirit.dodge;
  if (wasHit) delete u.spirit.guts;
}

/** Short labels of active effects for the HUD. */
export function activeSpiritLabels(u: UnitState): string[] {
  const s = u.spirit ?? {};
  const out: string[] = [];
  if (s.focus) out.push('凝神');
  if (s.sureHit) out.push('破妄');
  if (s.dodge) out.push('身法');
  if (s.power === 2) out.push('狂怒');
  if (s.power === 3) out.push('剑心');
  if (s.wall) out.push('金刚');
  if (s.guts) out.push('坚守');
  if (s.luck) out.push('福缘');
  if (s.effort) out.push('悟道');
  if (s.accel) out.push('神行');
  return out;
}
