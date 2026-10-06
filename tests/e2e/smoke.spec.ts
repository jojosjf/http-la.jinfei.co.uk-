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

test('boots, moves a unit, undoes, and survives an enemy phase', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=42');
  await page.waitForFunction(() => window.__srpg?.ready === true, null, { timeout: 30_000 });
  await waitState(page, ['idle']);

  let s = await state(page);
  expect(s.turn).toBe(1);
  expect(s.phase).toBe('player');
  expect(s.units).toHaveLength(8);
  await page.screenshot({ path: 'test-results/01-boot.png' });

  // Select 苍穹 at (2,10) and show its movement range.
  await page.evaluate(() => window.__srpg!.setCursor(2, 10));
  await page.keyboard.press('KeyZ');
  s = await waitState(page, ['unitSelected']);
  expect(s.stoppable).toContain('6,10');
  await page.screenshot({ path: 'test-results/02-move-range.png' });

  // Move 4 tiles right along the open ground, then open the action menu.
  await page.evaluate(() => window.__srpg!.setCursor(6, 10));
  await page.keyboard.press('KeyZ');
  s = await waitState(page, ['actionMenu']);
  expect(s.units.find((u) => u.unitId === 'cangqiong')).toMatchObject({ x: 6, y: 10 });
  await page.screenshot({ path: 'test-results/03-action-menu.png' });

  // Cancel undoes the move.
  await page.keyboard.press('KeyX');
  s = await waitState(page, ['unitSelected']);
  expect(s.units.find((u) => u.unitId === 'cangqiong')).toMatchObject({ x: 2, y: 10 });
  await page.keyboard.press('KeyX');
  await waitState(page, ['idle']);

  // End the turn: the enemy phase runs and turn 2 begins.
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

test('auto-plays the stage to the end without wedging', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await page.goto('/?seed=7');
  await page.waitForFunction(() => window.__srpg?.ready === true, null, { timeout: 30_000 });

  let previewShot = false;
  let battles = 0;
  for (let round = 0; round < 60; round++) {
    const s = await waitState(page, ['idle', 'gameOver'], 90_000);
    if (s.state === 'gameOver') break;

    const unit = s.units.find((u) => u.team === 'player' && u.alive && !u.acted);
    if (!unit) {
      await page.keyboard.press('KeyE');
      continue;
    }
    const enemies = s.units.filter((u) => u.team === 'enemy' && u.alive);

    await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [unit.x, unit.y] as const);
    await page.keyboard.press('KeyZ');
    const sel = await waitState(page, ['unitSelected']);

    // Pick the reachable tile closest to the nearest enemy (but not adjacent to the heavy unit, keep it simple).
    const tiles = sel.stoppable.map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    const best = tiles.reduce((acc, t) => {
      const d = Math.min(...enemies.map((e) => dist(t, e)));
      return d < acc.d ? { t, d } : acc;
    }, { t: { x: unit.x, y: unit.y }, d: Infinity });
    await page.evaluate(([x, y]) => window.__srpg!.setCursor(x, y), [best.t.x, best.t.y] as const);
    await page.keyboard.press('KeyZ');
    await waitState(page, ['actionMenu']);

    // First enabled item: 攻击 when a target exists, otherwise 待机.
    await page.keyboard.press('KeyZ');
    const after = await waitState(page, ['weaponSelect', 'idle', 'busy', 'gameOver', 'enemyPhase']);
    if (after.state === 'weaponSelect') {
      await page.keyboard.press('KeyZ');
      const ts = await waitState(page, ['targetSelect']);
      expect(ts.targets.length).toBeGreaterThan(0);
      if (!previewShot) {
        await page.screenshot({ path: 'test-results/05-battle-preview.png' });
        previewShot = true;
      }
      await page.keyboard.press('KeyZ');
      battles++;
    }
  }

  const final = await state(page);
  await page.screenshot({ path: 'test-results/06-autoplay-end.png' });
  expect(battles).toBeGreaterThan(0);
  expect(final.state === 'gameOver' || final.turn >= 3).toBe(true);
  expect(errors).toEqual([]);
});
