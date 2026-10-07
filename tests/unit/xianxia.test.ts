import { describe, expect, it } from 'vitest';
import { breeze, stepFollow, type FollowState } from '../../src/core/follow';
import { realmName } from '../../src/core/realm';
import { deploymentIds } from '../../src/core/scenario';

describe('realmName', () => {
  it('names levels as cultivation realms', () => {
    expect(realmName(1)).toBe('炼气一层');
    expect(realmName(5)).toBe('炼气五层');
    expect(realmName(9)).toBe('炼气九层');
    expect(realmName(10)).toBe('筑基初期');
    expect(realmName(15)).toBe('筑基中期');
    expect(realmName(19)).toBe('筑基后期');
    expect(realmName(20)).toBe('金丹初期');
    expect(realmName(89)).toBe('渡劫后期');
    expect(realmName(200)).toBe('渡劫圆满');
    expect(realmName(0)).toBe('炼气一层');
  });
});

describe('stepFollow', () => {
  it('lags behind forward acceleration, then settles back to rest', () => {
    let s: FollowState = { angle: 0, vel: 0 };
    for (let i = 0; i < 10; i++) s = stepFollow(s, 2000, 1 / 60);
    expect(s.angle).toBeGreaterThan(0.05);
    for (let i = 0; i < 240; i++) s = stepFollow(s, 0, 1 / 60);
    expect(Math.abs(s.angle)).toBeLessThan(0.01);
  });

  it('never exceeds its limit, and the breeze is small', () => {
    let s: FollowState = { angle: 0, vel: 0 };
    for (let i = 0; i < 60; i++) s = stepFollow(s, -50000, 1 / 60);
    expect(s.angle).toBeGreaterThanOrEqual(-0.9);
    for (let t = 0; t < 10; t += 0.1) expect(Math.abs(breeze(t, 1))).toBeLessThan(0.08);
  });
});

describe('deploymentIds', () => {
  it('uses the character id for both stats records, with legacy unit/pilot still accepted', () => {
    expect(deploymentIds({ character: 'linxuan', team: 'player', x: 0, y: 0 })).toEqual({ unit: 'linxuan', pilot: 'linxuan' });
    expect(deploymentIds({ unit: 'a', pilot: 'b', team: 'enemy', x: 0, y: 0 })).toEqual({ unit: 'a', pilot: 'b' });
  });
});
