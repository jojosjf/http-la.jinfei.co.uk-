import type { Scene } from 'phaser';
import { createUnit, unitDomain } from '../core/unit';
import { loadData } from '../data';
import type { BattleScript, BattleSide } from './BattleScene';

declare global {
  interface Window {
    __battleDemo?: { round: number; playing: boolean };
  }
}

/**
 * `?view=battle&a=<unit>&d=<unit>&w=<weapon>&cw=<counter weapon>&kill=1&crit=1&terrain=<id>&ateam=enemy&dteam=player`
 * plays a scripted exchange on the battle screen in a loop, without touching the map.
 * For checking imported mech art and attack effects.
 */
export function startBattleDemo(scene: Scene, params: URLSearchParams): void {
  const gd = loadData();
  const aId = params.get('a') ?? 'zhaoye';
  const dId = params.get('d') ?? 'xuetang';
  const aDef = gd.units[aId] ?? Object.values(gd.units)[0];
  const dDef = gd.units[dId] ?? Object.values(gd.units)[1];
  const terrain = gd.terrain[params.get('terrain') ?? 'plain'] ?? gd.terrain.plain;
  const w = gd.weapons[params.get('w') ?? aDef.weapons[0]] ?? gd.weapons[aDef.weapons[0]];
  const cw = params.has('cw') ? gd.weapons[params.get('cw')!] : gd.weapons[dDef.weapons[0]];
  const kill = params.get('kill') === '1';
  const crit = params.get('crit') === '1';
  // a = player side, d = enemy side unless ?ateam=enemy / ?dteam=player
  const aEnemy = params.get('ateam') === 'enemy';
  const dEnemy = params.get('dteam') !== 'player';
  const pilotFor = (enemy: boolean) => gd.pilots[enemy ? 'captain' : 'linkai'] ?? Object.values(gd.pilots)[0];
  const pilotA = pilotFor(aEnemy);
  const pilotD = pilotFor(dEnemy);

  const side = (def: typeof aDef, pilot: typeof pilotA, team: 'player' | 'enemy'): BattleSide => {
    const st = createUnit('demo', def, pilot, gd.weapons, team, 0, 0);
    return { def, pilot, team, hp: st.hp, maxHp: def.hp, en: st.en, maxEn: def.en, terrain, domain: unitDomain(def, terrain) };
  };

  const state: { round: number; playing: boolean } = { round: 0, playing: false };
  window.__battleDemo = state;
  const play = (): void => {
    const left = side(aDef, pilotA, aEnemy ? 'enemy' : 'player');
    const right = side(dDef, pilotD, dEnemy ? 'enemy' : 'player');
    const dmg = kill ? right.hp : Math.round(right.hp * 0.35);
    const script: BattleScript = {
      left,
      right,
      strikes: [
        {
          side: 'left',
          weapon: w,
          result: { hit: true, crit: crit || kill, damage: dmg, hitChance: 90, critChance: 20 },
          defense: 'counter',
          targetHpAfter: right.hp - dmg,
          attackerEnAfter: Math.max(0, left.en - w.en),
          targetDestroyed: kill,
        },
      ],
    };
    if (!kill && cw) {
      script.strikes.push({
        side: 'right',
        weapon: cw,
        result: { hit: state.round % 2 === 1, crit: false, damage: 900, hitChance: 60, critChance: 0 },
        defense: 'counter',
        targetHpAfter: state.round % 2 === 1 ? left.hp - 900 : left.hp,
        attackerEnAfter: right.en,
        targetDestroyed: false,
      });
    }
    state.playing = true;
    scene.scene.launch('Battle', {
      script,
      onDone: () => {
        state.playing = false;
        state.round++;
        scene.time.delayedCall(600, play);
      },
    });
  };
  play();
}
