import { describe, expect, it } from 'vitest';
import { applyRoster, isCampaignState, newCampaign, recordStage } from '../../src/core/campaign';
import { dueEvents, isHolding, nearestFree, stageOutcome, type EventUnit } from '../../src/core/events';
import type { ScenarioEvent, UnitState } from '../../src/core/types';

const unit = (unitId: string, team: 'player' | 'enemy', o: Partial<EventUnit> = {}): EventUnit => ({
  unitId,
  pilotId: unitId,
  team,
  hp: 1000,
  maxHp: 1000,
  alive: true,
  ...o,
});

describe('scenario events', () => {
  const events: ScenarioEvent[] = [
    { when: { type: 'start' } },
    { when: { type: 'turn', turn: 2 } },
    { when: { type: 'defeated', who: 'fenlu' } },
    { when: { type: 'hpBelow', who: 'yanwuchang', pct: 50 } },
    { when: { type: 'battle', a: 'yunheng', b: 'yanwuchang' } },
    { when: { type: 'clear' } },
  ];
  const boss = unit('mingwang', 'enemy', { pilotId: 'yanwuchang' });

  it('fires start / turn / clear only at their moment', () => {
    expect(dueEvents(events, new Set(), { type: 'start' }, [])).toEqual([0]);
    expect(dueEvents(events, new Set(), { type: 'turn', turn: 2 }, [])).toEqual([1]);
    expect(dueEvents(events, new Set(), { type: 'turn', turn: 3 }, [])).toEqual([]);
    expect(dueEvents(events, new Set(), { type: 'clear' }, [])).toEqual([5]);
  });

  it('never fires an event twice', () => {
    expect(dueEvents(events, new Set([0]), { type: 'start' }, [])).toEqual([]);
  });

  it('defeated waits until every unit with that id is down', () => {
    const a = unit('fenlu', 'enemy');
    const b = unit('fenlu', 'enemy');
    expect(dueEvents(events, new Set(), { type: 'status' }, [a, { ...b, alive: false }])).toEqual([]);
    expect(dueEvents(events, new Set(), { type: 'status' }, [{ ...a, alive: false }, { ...b, alive: false }])).toEqual([2]);
  });

  it('hpBelow matches a boss by the pilot riding the puppet, and only while it stands', () => {
    expect(dueEvents(events, new Set(), { type: 'status' }, [{ ...boss, hp: 600 }])).toEqual([]);
    expect(dueEvents(events, new Set(), { type: 'status' }, [{ ...boss, hp: 499 }])).toEqual([3]);
    expect(dueEvents(events, new Set(), { type: 'status' }, [{ ...boss, hp: 0, alive: false }])).toEqual([]);
  });

  it('battle fires for the pair in either order', () => {
    const yh = { unitId: 'yunheng', pilotId: 'yunheng' };
    const yw = { unitId: 'mingwang', pilotId: 'yanwuchang' };
    expect(dueEvents(events, new Set(), { type: 'battle', a: yh, b: yw }, [])).toEqual([4]);
    expect(dueEvents(events, new Set(), { type: 'battle', a: yw, b: yh }, [])).toEqual([4]);
    expect(dueEvents(events, new Set(), { type: 'battle', a: yh, b: { unitId: 'fenlu', pilotId: 'fenlu' } }, [])).toEqual([]);
  });
});

describe('stage outcome', () => {
  const hero = unit('yunheng', 'player');
  const friend = unit('shipojun', 'player');
  const grunt = unit('fenlu', 'enemy');
  const boss = unit('mingwang', 'enemy', { pilotId: 'yanwuchang', boss: true });

  it('annihilate: all enemies down wins, all players down loses', () => {
    const s = { win: 'annihilate' as const, lose: 'annihilate' as const };
    expect(stageOutcome(s, [hero, grunt])).toBeNull();
    expect(stageOutcome(s, [hero, { ...grunt, alive: false }])).toBe('win');
    expect(stageOutcome(s, [{ ...hero, alive: false }, friend, grunt])).toBeNull();
    expect(stageOutcome(s, [{ ...hero, alive: false }, { ...friend, alive: false }, grunt])).toBe('lose');
  });

  it('boss: defeating the boss wins even with grunts left', () => {
    const s = { win: 'boss' as const, lose: 'leader' as const };
    expect(stageOutcome(s, [hero, grunt, boss])).toBeNull();
    expect(stageOutcome(s, [hero, grunt, { ...boss, alive: false }])).toBe('win');
  });

  it('leader: losing 云衡 loses even if others stand, and defeat beats victory', () => {
    const s = { win: 'boss' as const, lose: 'leader' as const };
    expect(stageOutcome(s, [{ ...hero, alive: false }, friend, boss])).toBe('lose');
    expect(stageOutcome(s, [hero, { ...friend, alive: false }, boss])).toBeNull();
    expect(stageOutcome({ ...s, leaders: ['shipojun'] }, [hero, { ...friend, alive: false }, boss])).toBe('lose');
    expect(stageOutcome(s, [{ ...hero, alive: false }, { ...boss, alive: false }])).toBe('lose');
  });
});

describe('hold and placement', () => {
  it('hold: true holds until released; a number releases on that turn', () => {
    expect(isHolding(true, 9)).toBe(true);
    expect(isHolding(3, 2)).toBe(true);
    expect(isHolding(3, 3)).toBe(false);
    expect(isHolding(false, 1)).toBe(false);
    expect(isHolding(undefined, 1)).toBe(false);
  });

  it('nearestFree finds the closest acceptable tile', () => {
    const size = { width: 5, height: 5 };
    expect(nearestFree({ x: 2, y: 2 }, size, () => true)).toEqual({ x: 2, y: 2 });
    const taken = new Set(['2,2', '2,1']);
    const p = nearestFree({ x: 2, y: 2 }, size, (x, y) => !taken.has(`${x},${y}`))!;
    expect(Math.abs(p.x - 2) + Math.abs(p.y - 2)).toBe(1);
    expect(nearestFree({ x: 0, y: 0 }, size, () => false)).toBeNull();
  });
});

describe('campaign', () => {
  const u = (pilotId: string, team: 'player' | 'enemy', level: number, exp: number): UnitState =>
    ({ uid: pilotId, unitId: pilotId, pilotId, team, level, exp } as UnitState);

  it('carries 灵石 and player growth into the next stage', () => {
    const c = recordStage(newCampaign(), [u('yunheng', 'player', 7, 40), u('fenlu', 'enemy', 4, 0)], 9000);
    expect(c).toEqual({ money: 9000, roster: { yunheng: { level: 7, exp: 40 } } });
    const fresh = u('yunheng', 'player', 5, 0);
    applyRoster(fresh, c);
    expect(fresh).toMatchObject({ level: 7, exp: 40 });
    const foe = u('yunheng', 'enemy', 5, 0);
    applyRoster(foe, c);
    expect(foe.level).toBe(5);
  });

  it('recognises a saved campaign', () => {
    expect(isCampaignState(newCampaign())).toBe(true);
    expect(isCampaignState({ money: '1' })).toBe(false);
    expect(isCampaignState(null)).toBe(false);
  });
});
