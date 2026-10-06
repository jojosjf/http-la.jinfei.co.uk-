import { expect, test, type Page } from '@playwright/test';
import type { DebugState } from '../../src/debug';

async function state(page: Page): Promise<DebugState> {
  return page.evaluate(() => window.__srpg!.getState());
}

async function waitState(page: Page, wanted: string[], timeout = 20_000): Promise<DebugState> {
  await page.waitForFunction(
    (list) => {
      const st = window.__srpg?.getState().state;
      return st !== undefined && list.includes(st);
    },
    wanted,
    { timeout },
  );
  return state(page);
}

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
    await page.keyboard.press('KeyE');
    return 'endTurn';
  }
  const enemies = s.units.filter((u) => u.team === 'enemy' && u.alive);
  await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [unit.x, unit.y] as const);
  await page.keyboard.press('KeyZ');
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
  await page.keyboard.press('KeyZ');
  await waitState(page, ['actionMenu']);
  await page.keyboard.press('KeyZ'); // first enabled item: 攻击 when a target exists, else 待机
  const after = await waitState(page, ['weaponSelect', 'idle', 'busy', 'gameOver', 'enemyPhase']);
  if (after.state !== 'weaponSelect') return 'waited';
  await page.keyboard.press('KeyZ');
  const ts = await waitState(page, ['targetSelect']);
  expect(ts.targets.length).toBeGreaterThan(0);
  await page.keyboard.press('KeyZ');
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
  expect(s.units.find((u) => u.unitId === 'cangqiong')).toMatchObject({ x: 6, y: 10 });
  await page.screenshot({ path: 'test-results/03-action-menu.png' });

  await page.keyboard.press('KeyX');
  s = await waitState(page, ['unitSelected']);
  expect(s.units.find((u) => u.unitId === 'cangqiong')).toMatchObject({ x: 2, y: 10 });
  await page.keyboard.press('KeyX');
  await waitState(page, ['idle']);

  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__srpg?.getState().phase === 'enemy', null, { timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const st = window.__srpg?.getState();
      return st?.turn === 2 && st.state === 'idle';
    },
    null,
    { timeout: 60_000 },
  );
  s = await state(page);
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
