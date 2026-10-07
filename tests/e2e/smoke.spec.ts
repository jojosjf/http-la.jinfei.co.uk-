import { expect, test, type Page } from '@playwright/test';
import type { DebugState } from '../../src/debug';

async function state(page: Page): Promise<DebugState> {
  return page.evaluate(() => window.__srpg!.getState());
}

/** Waits for one of the wanted states, clicking through any story dialogue that isn't wanted. */
async function waitState(page: Page, wanted: string[], timeout = 20_000): Promise<DebugState> {
  try {
    await page.waitForFunction(
      (list) => {
        const st = window.__srpg?.getState().state;
        if (st === 'dialogue' && !list.includes(st)) window.__srpg!.confirm();
        return st !== undefined && list.includes(st);
      },
      wanted,
      { timeout },
    );
  } catch (e) {
    const s = await state(page).catch(() => null);
    throw new Error(`${(e as Error).message}\nwanted ${wanted.join('|')}, state ${s?.state}\nhistory: ${s?.history.join(' ')}`);
  }
  return state(page);
}

/** Waits until it is the player's turn `turn` (dialogue clicked through). */
async function waitTurn(page: Page, turn: number, timeout = 90_000): Promise<DebugState> {
  await page.waitForFunction(
    (t) => {
      const st = window.__srpg?.getState();
      if (st?.state === 'dialogue') window.__srpg!.confirm();
      return st?.turn === t && st.state === 'idle';
    },
    turn,
    { timeout },
  );
  return state(page);
}

/** Confirm through the debug hook: synchronous, so no key-queue timing races in the auto-player. */
const confirm = (page: Page): Promise<void> => page.evaluate(() => window.__srpg!.confirm());

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function boot(page: Page, seed: number): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__srpg?.ready === true, null, { timeout: 30_000 });
}

/**
 * Plays one player action with a crude policy: pick the first unit that has not acted,
 * move to the reachable tile nearest an enemy, attack with the first usable weapon if any,
 * otherwise wait. Returns 'attacked' | 'waited' | 'endTurn'. `onTarget` runs right before the
 * attack is confirmed so tests can observe the targetSelect / battle states.
 */
async function playOneAction(page: Page, onTarget?: () => Promise<void>): Promise<'attacked' | 'waited' | 'endTurn'> {
  const s = await waitState(page, ['idle'], 90_000);
  const unit = s.units.find((u) => u.team === 'player' && u.alive && !u.acted);
  if (!unit) {
    await page.evaluate(() => window.__srpg!.endTurn());
    return 'endTurn';
  }
  const enemies = s.units.filter((u) => u.team === 'enemy' && u.alive);
  await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [unit.x, unit.y] as const);
  await confirm(page);
  const sel = await waitState(page, ['unitSelected']);
  const tiles = sel.stoppable.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
  const best = tiles.reduce(
    (acc, t) => {
      const d = Math.min(...enemies.map((e) => dist(t, e)));
      return d < acc.d ? { t, d } : acc;
    },
    { t: { x: unit.x, y: unit.y }, d: Infinity },
  );
  await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [best.t.x, best.t.y] as const);
  await confirm(page);
  const menu = await waitState(page, ['actionMenu']);
  // the menu opens on 攻击 when a target exists, else on 神通; skip to 待机 (row 2) in that case
  if (menu.menuIndex === 1) await page.evaluate(() => window.__srpg!.menuMove(1));
  await confirm(page);
  const after = await waitState(page, ['weaponSelect', 'idle', 'busy', 'gameOver', 'enemyPhase']);
  if (after.state !== 'weaponSelect') return 'waited';
  await confirm(page);
  const ts = await waitState(page, ['targetSelect']);
  expect(ts.targets.length).toBeGreaterThan(0);
  await confirm(page);
  if (onTarget) await onTarget();
  return 'attacked';
}

test('boots, moves a unit, undoes, and survives an enemy phase', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page, 42);
  await waitState(page, ['idle']);

  let s = await state(page);
  expect(s.turn).toBe(1);
  expect(s.phase).toBe('player');
  expect(s.units).toHaveLength(8);
  expect(s.battleAnim).toBe(true);
  await page.screenshot({ path: 'test-results/01-boot.png' });

  await page.evaluate(() => window.__srpg!.setCursor(2, 10));
  await page.keyboard.press('KeyZ');
  s = await waitState(page, ['unitSelected']);
  expect(s.stoppable).toContain('6,10');
  await page.screenshot({ path: 'test-results/02-move-range.png' });

  await page.evaluate(() => window.__srpg!.setCursor(6, 10));
  await page.keyboard.press('KeyZ');
  s = await waitState(page, ['actionMenu']);
  expect(s.units.find((u) => u.unitId === 'yunheng')).toMatchObject({ x: 6, y: 10 });
  await page.screenshot({ path: 'test-results/03-action-menu.png' });

  await page.keyboard.press('KeyX');
  s = await waitState(page, ['unitSelected']);
  expect(s.units.find((u) => u.unitId === 'yunheng')).toMatchObject({ x: 2, y: 10 });
  await page.keyboard.press('KeyX');
  await waitState(page, ['idle']);

  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__srpg?.getState().phase === 'enemy', null, { timeout: 10_000 });
  s = await waitTurn(page, 2, 60_000);
  expect(s.units.filter((u) => u.team === 'enemy').some((u) => u.x < 15)).toBe(true);
  await page.screenshot({ path: 'test-results/04-turn2.png' });

  expect(errors).toEqual([]);
});

test('shows the cut-away battle scene and fast-forwards it on a key press', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await boot(page, 7);

  let sawBattle = false;
  for (let i = 0; i < 20 && !sawBattle; i++) {
    const outcome = await playOneAction(page, async () => {
      await page.waitForFunction(() => window.__srpg?.getState().inBattle === true, null, { timeout: 10_000 });
      sawBattle = true;
      await page.waitForTimeout(1300);
      await page.screenshot({ path: 'test-results/07-battle-scene.png' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/08-battle-hit.png' });
      await page.keyboard.press('KeyZ'); // fast-forward
      await page.waitForFunction(() => window.__srpg?.getState().inBattle === false, null, { timeout: 20_000 });
    });
    if (outcome === 'endTurn') await waitState(page, ['idle', 'gameOver'], 120_000);
  }
  expect(sawBattle).toBe(true);
  const s = await waitState(page, ['idle', 'enemyPhase', 'gameOver', 'busy'], 60_000);
  expect(['idle', 'enemyPhase', 'gameOver', 'busy']).toContain(s.state);
  expect(errors).toEqual([]);
});

test('auto-plays the stage to the end without wedging (battle animation off)', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await boot(page, 7);
  await page.evaluate(() => window.__srpg!.setBattleAnim(false));

  let battles = 0;
  let previewShot = false;
  for (let round = 0; round < 60; round++) {
    const s = await waitState(page, ['idle', 'gameOver'], 90_000);
    if (s.state === 'gameOver') break;
    const outcome = await playOneAction(page, async () => {
      if (!previewShot) {
        previewShot = true;
      }
    });
    if (outcome === 'attacked') battles++;
  }

  const final = await state(page);
  await page.screenshot({ path: 'test-results/06-autoplay-end.png' });
  expect(battles).toBeGreaterThan(0);
  expect(final.state === 'gameOver' || final.turn >= 3).toBe(true);
  expect(errors).toEqual([]);
});

test('doll viewer shows the imported sample mech and cycles poses', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?view=dolls');
  await page.waitForFunction(() => window.__dolls !== undefined, null, { timeout: 30_000 });
  const ids = await page.evaluate(() => window.__dolls!.ids);
  expect(ids).toContain('cangqiong');
  await page.evaluate(() => window.__dolls!.select('cangqiong'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/09-doll-idle.png' });

  await page.evaluate(() => window.__dolls!.setPose('shoot'));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__dolls!.current().pose)).toBe('shoot');
  await page.screenshot({ path: 'test-results/10-doll-shoot.png' });

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__dolls!.current().pose)).toBe('melee');
  await page.screenshot({ path: 'test-results/11-doll-melee.png' });
  expect(errors).toEqual([]);
});

test('照夜 rig: poses, weapon knock-off and ragdoll death in the viewer', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?view=dolls');
  await page.waitForFunction(() => window.__dolls !== undefined, null, { timeout: 30_000 });
  await page.evaluate(() => window.__dolls!.select('zhaoye'));
  expect(await page.evaluate(() => window.__dolls!.current())).toMatchObject({ id: 'zhaoye', kind: 'rig', pose: 'idle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/12-rig-idle.png' });

  await page.evaluate(() => window.__dolls!.setPose('melee'));
  await page.waitForTimeout(230);
  await page.screenshot({ path: 'test-results/13-rig-melee-windup.png' });
  await page.waitForTimeout(160);
  await page.screenshot({ path: 'test-results/14-rig-melee-strike.png' });

  await page.evaluate(() => window.__dolls!.setPose('shoot'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/15-rig-cast.png' });

  await page.evaluate(() => window.__dolls!.reset());
  await page.evaluate(() => window.__dolls!.dropWeapon());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/16-rig-weapon-dropped.png' });

  await page.evaluate(() => window.__dolls!.die(true));
  expect(await page.evaluate(() => window.__dolls!.current().ragdoll)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/17-rig-ragdoll-falling.png' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/18-rig-ragdoll-rest.png' });
  expect(errors).toEqual([]);
});

test('battle demo: 照夜 vs 血螳 — slash kill, counter exchange, 照夜 destroyed', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?view=battle&a=zhaoye&d=xuetang&w=guandao&kill=1');
  await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
  await page.waitForTimeout(1050);
  await page.screenshot({ path: 'test-results/19-demo-slash.png' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'test-results/20-demo-kill.png' });

  await page.goto('/?view=battle&a=xuetang&ateam=enemy&d=zhaoye&dteam=player&w=lian_feng&cw=lingguang&kill=0');
  await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'test-results/21-demo-zhaoye-hit-and-cast.png' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/22-demo-zhaoye-cast.png' });

  await page.goto('/?view=battle&a=xuetang&ateam=enemy&d=zhaoye&dteam=player&w=xue_lian&kill=1&crit=1');
  await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
  await page.waitForTimeout(3800);
  await page.screenshot({ path: 'test-results/23-demo-zhaoye-destroyed.png' });
  expect(errors).toEqual([]);
});

test('every imported mech poses without errors (screenshots per pose)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.goto('/?view=dolls');
  await page.waitForFunction(() => window.__dolls !== undefined, null, { timeout: 30_000 });
  const ids = await page.evaluate(() => window.__dolls!.ids.filter((id) => id !== 'cangqiong'));
  expect(ids.length).toBe(28);
  for (const id of ids) {
    await page.evaluate((x) => window.__dolls!.select(x), id);
    expect(await page.evaluate(() => window.__dolls!.current().kind)).toBe('rig');
    for (const [pose, at] of [
      ['melee', 230],
      ['melee', 390],
      ['shoot', 330],
    ] as const) {
      await page.evaluate((p) => window.__dolls!.setPose(p), pose);
      await page.waitForTimeout(at);
      await page.screenshot({ path: `test-results/poses/${id}-${pose}-${at}.png`, clip: { x: 0, y: 120, width: 560, height: 380 } });
    }
  }
  expect(errors).toEqual([]);
});

test('non-humanoid mechs fight on the battle screen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  const bouts: Array<[string, string]> = [
    ['/?view=battle&a=baize&d=tieliao&kill=1', '24-baize-vs-tieliao'],
    ['/?view=battle&a=zhaoye&d=zhulong&w=lingguang', '25-zhaoye-vs-zhulong'],
    ['/?view=battle&a=huiyuan&ateam=enemy&d=duzhu&kill=1', '26-huiyuan-vs-duzhu'],
    ['/?view=battle&a=tiancheng&ateam=enemy&d=qianlin&dteam=player&w=tiancheng_pao', '27-tiancheng-vs-qianlin'],
  ];
  for (const [url, name] of bouts) {
    await page.goto(url);
    await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
    await page.waitForTimeout(1050);
    await page.screenshot({ path: `test-results/${name}-a.png` });
    await page.waitForTimeout(2300);
    await page.screenshot({ path: `test-results/${name}-b.png` });
  }
  expect(errors).toEqual([]);
});

test('修士: cloth follows a dash, defeat dissolves into light, battle effects', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await page.goto('/?view=dolls');
  await page.waitForFunction(() => window.__dolls !== undefined, null, { timeout: 30_000 });
  await page.evaluate(() => window.__dolls!.select('linxuan'));
  expect(await page.evaluate(() => window.__dolls!.current())).toMatchObject({ id: 'linxuan', kind: 'rig' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/30-linxuan-idle.png' });
  await page.evaluate(() => window.__dolls!.dash(40));
  await page.waitForTimeout(120);
  const follow = await page.evaluate(() => window.__dolls!.current().follow);
  expect(Math.max(...Object.values(follow).map(Math.abs))).toBeGreaterThan(0.05);
  await page.screenshot({ path: 'test-results/31-linxuan-dash-cloth.png' });
  await page.evaluate(() => window.__dolls!.reset());
  await page.evaluate(() => window.__dolls!.die(true));
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/32-linxuan-fallen.png' });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'test-results/33-linxuan-dissolving.png' });

  const bouts: Array<[string, string, number]> = [
    ['/?view=battle&a=linxuan&d=xuetang&w=yujian_shu', '34-yujian', 1400],
    ['/?view=battle&a=linxuan&d=heilei&w=tianhe_jianzhen', '35-jianzhen', 1500],
    ['/?view=battle&a=suqinghan&d=fenlu&w=zhangxin_lei', '36-zhangxin-lei', 1250],
    ['/?view=battle&a=suqinghan&d=suohun&w=hanshuang_jue', '37-hanshuang', 1250],
    ['/?view=battle&a=xuetang&ateam=enemy&d=shipojun&dteam=player&w=xue_lian&kill=1&crit=1', '38-shipojun-defeated', 3800],
  ];
  for (const [url, name, at] of bouts) {
    await page.goto(url);
    await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
    await page.waitForTimeout(at);
    await page.screenshot({ path: `test-results/${name}.png` });
  }
  expect(errors).toEqual([]);
});

test('云衡 (imported protagonist): poses, cloth, weapon drop, defeat, and battle with portrait', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await page.goto('/?view=dolls');
  await page.waitForFunction(() => window.__dolls !== undefined, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__dolls!.ids[0])).toBe('yunheng');
  await page.evaluate(() => window.__dolls!.select('yunheng'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/40-yunheng-idle.png' });
  for (const [pose, at] of [['walk', 300], ['melee', 210], ['melee', 380], ['shoot', 320], ['hit', 120], ['block', 330]] as const) {
    await page.evaluate((p) => window.__dolls!.setPose(p), pose);
    await page.waitForTimeout(at);
    await page.screenshot({ path: `test-results/41-yunheng-${pose}-${at}.png` });
  }
  await page.evaluate(() => window.__dolls!.reset());
  await page.evaluate(() => window.__dolls!.dash(40));
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'test-results/42-yunheng-dash.png' });
  await page.evaluate(() => window.__dolls!.reset());
  await page.evaluate(() => window.__dolls!.dropWeapon());
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/43-yunheng-drop.png' });
  await page.evaluate(() => window.__dolls!.die(true));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/44-yunheng-fallen.png' });

  await page.goto('/?view=battle&a=yunheng&d=xuetang&w=liuyun_jian');
  await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/45-yunheng-battle-slash.png' });
  await page.goto('/?view=battle&a=yunheng&d=heilei&w=jianxia_qixing');
  await page.waitForFunction(() => window.__battleDemo?.playing === true, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/46-yunheng-battle-qixing.png' });
  expect(errors).toEqual([]);
});

test('神通: menu, 神行 widens movement, effects show and expire next turn', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await boot(page, 42);
  await waitState(page, ['idle']);
  const lead = (await state(page)).units.find((u) => u.unitId === 'yunheng')!;
  await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [lead.x, lead.y] as const);
  await confirm(page);
  const before = (await waitState(page, ['unitSelected'])).stoppable.length;
  await confirm(page); // stay in place -> action menu
  await waitState(page, ['actionMenu']);
  // 攻击 is disabled (nothing in range), so the cursor already rests on 神通
  await confirm(page);
  await waitState(page, ['spiritSelect']);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'test-results/50-spirit-menu.png' });
  await page.evaluate(() => window.__srpg!.menuMove(5)); // 神行
  await confirm(page);
  const after = await waitState(page, ['unitSelected']);
  expect(after.stoppable.length).toBeGreaterThan(before);
  const me = after.units.find((u) => u.unitId === 'yunheng')!;
  expect(me.spirits).toContain('神行');
  expect(me.sp).toBe(60 - 10);
  await page.evaluate((uid) => window.__srpg!.castSpirit(uid, '破妄'), me.uid);
  await page.evaluate((uid) => window.__srpg!.castSpirit(uid, '狂怒'), me.uid); // 30 left < 35: refused
  await page.evaluate((uid) => window.__srpg!.castSpirit(uid, '身法'), me.uid);
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/51-spirit-range.png' });
  const mid = (await state(page)).units.find((u) => u.uid === me.uid)!;
  expect(mid.spirits).toEqual(['破妄', '身法', '神行']);
  expect(mid.sp).toBe(60 - 10 - 20 - 15);
  await page.evaluate(() => window.__srpg!.cancel());
  await waitState(page, ['idle']);
  await page.evaluate(() => window.__srpg!.endTurn());
  await waitTurn(page, 2);
  // turn-long effects (破妄, 神行) expired; 身法 lasts until he is attacked
  const next = (await state(page)).units.find((u) => u.uid === me.uid)!.spirits;
  expect(next).not.toContain('破妄');
  expect(next).not.toContain('神行');
  expect(errors).toEqual([]);
});

test('story: 第1话 opens with dialogue; clearing each stage leads on, keeps progress, and bosses end 第2话/第3话', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await boot(page, 5);
  await page.evaluate(() => window.__srpg!.setBattleAnim(false));

  // opening conversation, then the objectives
  let s = await waitState(page, ['dialogue']);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/60-dialogue.png' });
  await page.evaluate(() => window.__srpg!.cancel()); // skip the conversation
  await page.waitForTimeout(400);
  s = await waitState(page, ['dialogue', 'idle']);
  if (s.state === 'dialogue') {
    await page.screenshot({ path: 'test-results/61-objectives.png' });
    await page.evaluate(() => window.__srpg!.cancel());
  }
  s = await waitState(page, ['idle']);
  expect(s.scenario).toBe('s01');

  const defeatAll = async (team: 'enemy' | 'player', filter: (u: DebugState['units'][number]) => boolean = () => true): Promise<void> => {
    for (const u of (await state(page)).units.filter((x) => x.team === team && x.alive && filter(x))) {
      const st = await waitState(page, ['idle', 'gameOver']);
      if (st.state === 'gameOver') return;
      await page.evaluate((uid) => window.__srpg!.defeat(uid), u.uid);
    }
  };

  // 第1话: wipe the ambush -> clear dialogue -> stage complete
  await defeatAll('enemy');
  s = await waitState(page, ['gameOver'], 60_000);
  expect(s.outcome).toBe('win');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/62-stage-clear.png' });
  await confirm(page);

  // 第2话: 林玄 is already fighting; the boss holds until turn 3, when reinforcements come
  s = await waitState(page, ['dialogue'], 30_000);
  expect(s.scenario).toBe('s02');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wjl.save') ?? '{}').scenarioId)).toBe('s02');
  s = await waitState(page, ['idle'], 60_000);
  await page.screenshot({ path: 'test-results/63-s02.png' });
  expect(s.units.filter((u) => u.team === 'player').map((u) => u.unitId)).toContain('linxuan');
  const boss = s.units.find((u) => u.unitId === 'mingwang')!;
  const enemiesAtStart = s.units.filter((u) => u.team === 'enemy').length;
  await page.evaluate(() => window.__srpg!.endTurn());
  await waitTurn(page, 2);
  const afterHold = (await state(page)).units.find((u) => u.uid === boss.uid)!;
  expect([afterHold.x, afterHold.y]).toEqual([boss.x, boss.y]); // held its post
  await page.evaluate(() => window.__srpg!.endTurn());
  s = await waitTurn(page, 3);
  expect(s.units.filter((u) => u.team === 'enemy').length).toBe(enemiesAtStart + 2);

  await page.evaluate((uid) => window.__srpg!.defeat(uid), boss.uid);
  s = await waitState(page, ['gameOver'], 60_000);
  expect(s.outcome).toBe('win');
  expect(s.units.filter((u) => u.team === 'enemy' && u.alive)).toHaveLength(0); // the rest withdrew
  await confirm(page);

  // 第3话 resumes from the save after a reload; losing 云衡 is a defeat
  s = await waitState(page, ['idle'], 60_000);
  expect(s.scenario).toBe('s03');
  await page.reload();
  s = await waitState(page, ['idle'], 60_000);
  expect(s.scenario).toBe('s03');
  await page.screenshot({ path: 'test-results/64-s03.png' });
  expect(s.units.find((u) => u.unitId === 'tiancheng')).toBeTruthy();
  await defeatAll('player', (u) => u.unitId === 'yunheng');
  s = await waitState(page, ['gameOver'], 30_000);
  expect(s.outcome).toBe('lose');
  expect(errors).toEqual([]);
});
