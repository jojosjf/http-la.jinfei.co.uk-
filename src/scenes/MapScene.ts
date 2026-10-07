import Phaser from 'phaser';
import { renderMapTexture } from '../art/mapArt';
import { chooseDefense, planAction, type DefenseChoice } from '../ai/simple';
import { GAME_WIDTH, TILE } from '../config';
import {
  canAttack,
  critChance,
  finalDamage,
  hitChance,
  resolveStrike,
  type Combatant,
  type DefenseAction,
  type StrikeResult,
} from '../core/battle';
import { inBounds, key, manhattan, parseKey } from '../core/grid';
import { MORALE, addMorale } from '../core/morale';
import { movementRange, pathTo, stoppableTiles, type Reach } from '../core/pathfinding';
import { inWeaponRange, tilesInRange } from '../core/range';
import { realmName } from '../core/realm';
import {
  ACCEL_MOVE,
  activeSpiritLabels,
  castSpirit,
  consumeAttackSpirits,
  consumeDefenseSpirits,
  expireTurnSpirits,
  isSpiritId,
  SPIRITS,
  spiritBlocked,
  type SpiritId,
} from '../core/spirit';
import { applyRoster, isCampaignState, newCampaign, recordStage, type CampaignState } from '../core/campaign';
import { DEFAULT_LEADERS, dueEvents, isHolding, matches, nearestFree, stageOutcome, type EventCheck, type EventUnit, type Outcome } from '../core/events';
import { mulberry32 } from '../core/rng';
import { buildMap, deploymentIds } from '../core/scenario';
import type { DialogueLine, Deployment, GameMap, ScenarioDef, TerrainDef, UnitDef, UnitState, Vec2, WeaponDef } from '../core/types';
import {
  UNAVAILABLE_TEXT,
  consumeWeapon,
  createUnit,
  unitDomain,
  weaponAvailability,
  type Unavailable,
} from '../core/unit';
import { loadData, type GameData } from '../data';
import { installDebugHook, type DebugState } from '../debug';
import { Dialogue, type Speaker } from '../ui/Dialogue';
import { Hud, TEXT_STYLE, type Menu, type PreviewSide, type UnitInfo } from '../ui/Hud';
import type { BattleScript, BattleSide, BattleStrike } from './BattleScene';

type State =
  | 'idle'
  | 'unitSelected'
  | 'actionMenu'
  | 'weaponSelect'
  | 'targetSelect'
  | 'systemMenu'
  | 'spiritSelect'
  | 'busy'
  | 'enemyPhase'
  | 'dialogue'
  | 'gameOver';

interface WeaponOption {
  weapon: WeaponDef;
  unavailable: Unavailable | null;
  targets: UnitState[];
}

interface Selection {
  unit: UnitState;
  origin: Vec2;
  reach: Reach;
  stoppable: Set<string>;
  options: WeaponOption[];
  weapon: WeaponDef | null;
  targets: UnitState[];
  targetIndex: number;
}

interface UnitView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
}

interface Highlights {
  move?: Iterable<string>;
  attack?: Vec2[];
  target?: Vec2;
}

const DIR_KEYS: Record<string, Vec2> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};
const CONFIRM_KEYS = new Set(['KeyZ', 'Enter', 'Space']);
const CANCEL_KEYS = new Set(['KeyX', 'Escape', 'Backspace']);
const END_TURN_KEYS = new Set(['KeyE', 'Tab']);

const IDLE_HINT = '方向键 移动   Z 选择   E 结束回合';
const LEVEL_EXP = 100;
/** Fixed seed for the procedural map art so a stage always looks the same. */
const ART_SEED = 20261006;
const BATTLE_ANIM_KEY = 'sf.battleAnim';
/** Stage-start save: `{ scenarioId, campaign }`, read by BootScene to resume. */
export const SAVE_KEY = 'wjl.save';
const NARRATOR = '旁白';

export interface MapParams {
  scenarioId?: string;
  seed?: number;
  campaign?: CampaignState;
}

/**
 * The tactical map: player phase state machine, enemy phase, on-map battle animation v0.
 * All rules live in src/core; this scene only orchestrates and renders.
 */
export class MapScene extends Phaser.Scene {
  private gd!: GameData;
  private scenario!: ScenarioDef;
  private map!: GameMap;
  private units: UnitState[] = [];
  private views = new Map<string, UnitView>();
  private cursorPos: Vec2 = { x: 0, y: 0 };
  private cursorImg!: Phaser.GameObjects.Image;
  private hl!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private _state: State = 'idle';
  /** Recent state transitions ("ms:state"), surfaced through the debug hook for test diagnostics. */
  private history: string[] = [];
  private sel: Selection | null = null;
  private menu: Menu | null = null;
  private turn = 1;
  private phase: 'player' | 'enemy' = 'player';
  private money = 0;
  private seed = 0;
  private rng: () => number = Math.random;
  private battleAnim = true;
  private inBattle = false;
  private dialogue!: Dialogue;
  /** Campaign carried into this stage, and (after a clear) what the next stage inherits. */
  private campaign: CampaignState = newCampaign();
  /** Campaign as it stood when this stage began, for 重玩本话. */
  private startCampaign: CampaignState = newCampaign();
  private fired = new Set<number>();
  private outcome: Outcome = null;

  constructor() {
    super('Map');
  }

  private get state(): State {
    return this._state;
  }

  private set state(v: State) {
    this._state = v;
    this.history.push(`${Math.round(performance.now())}:${v}`);
    if (this.history.length > 60) this.history.shift();
  }

  init(params: MapParams = {}): void {
    this.gd = loadData();
    this.scenario = this.gd.scenarios[params.scenarioId ?? 's01'] ?? this.gd.scenarios.s01;
    this.campaign = isCampaignState(params.campaign) ? params.campaign : newCampaign();
    this.fired = new Set();
    this.outcome = null;
    this.map = buildMap(this.scenario);
    const url = new URLSearchParams(window.location.search);
    const urlSeed = url.get('seed');
    this.seed = params.seed ?? (urlSeed !== null ? Number(urlSeed) : Date.now() % 1_000_000);
    this.rng = mulberry32(this.seed);
    this.units = [];
    this.views = new Map();
    this.sel = null;
    this.menu = null;
    this.turn = 1;
    this.phase = 'player';
    this.money = this.campaign.money;
    this.state = 'busy';
    this.inBattle = false;
    try {
      this.battleAnim = localStorage.getItem(BATTLE_ANIM_KEY) !== 'off';
    } catch {
      this.battleAnim = true;
    }
  }

  create(): void {
    this.buildTiles();
    this.hl = this.add.graphics().setDepth(5);
    for (const d of this.scenario.deploy) this.spawn(d);

    this.cursorImg = this.add.image(0, 0, 'cursor').setOrigin(0).setDepth(30);
    this.tweens.add({ targets: this.cursorImg, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1 });

    this.hud = new Hud(this);
    this.dialogue = new Dialogue(this);
    this.saveProgress();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.width * TILE, this.map.height * TILE);
    cam.setRoundPixels(true);
    const first = this.units.find((u) => u.team === 'player');
    this.setCursor(first?.x ?? 0, first?.y ?? 0);
    cam.centerOn(this.cursorImg.x + TILE / 2, this.cursorImg.y + TILE / 2);
    cam.startFollow(this.cursorImg, true, 0.2, 0.2, -TILE / 2, -TILE / 2);

    this.setupInput();
    installDebugHook({
      ready: true,
      getState: () => this.snapshot(),
      setCursor: (x, y) => {
        if (this.state === 'idle' || this.state === 'unitSelected') this.setCursor(x, y);
      },
      setBattleAnim: (on) => this.setBattleAnim(on),
      confirm: () => this.onConfirm(),
      menuMove: (n: number) => this.menu?.move(n),
      castSpirit: (uid: string, id: string) => {
        const u = this.units.find((x) => x.uid === uid);
        if (u && isSpiritId(id) && !spiritBlocked(u, id, this.spiritContext(u))) castSpirit(u, id, this.spiritContext(u));
      },
      cancel: () => this.onCancel(),
      endTurn: () => this.onEndTurn(),
      defeat: (uid: string) => void this.debugDefeat(uid),
      mapImage: () => this.textures.getBase64(`map_${this.scenario.id}`),
    });

    void this.startPlayerTurn(true);
  }

  // ---------------------------------------------------------------- setup

  private buildTiles(): void {
    const key = renderMapTexture(this, this.map, this.gd.terrain, ART_SEED, `map_${this.scenario.id}`);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
  }

  private spawn(d: Deployment): UnitState {
    const ids = deploymentIds(d);
    const def = this.gd.units[ids.unit];
    const pilot = this.gd.pilots[ids.pilot];
    const u = createUnit(`u${this.units.length}`, def, pilot, this.gd.weapons, d.team, d.x, d.y);
    if (d.boss) u.boss = true;
    if (d.hold !== undefined) u.hold = d.hold;
    applyRoster(u, this.campaign);
    this.units.push(u);

    const frame = this.add.image(0, 0, u.team === 'player' ? 'team_player' : 'team_enemy').setOrigin(0);
    const body = this.add.image(0, 0, `unit_${def.id}`).setOrigin(0);
    if (u.team === 'enemy') body.setFlipX(true);
    const hpBar = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [frame, body, hpBar];
    if (u.boss) {
      // 首领 badge: gold diamond in the top-left corner
      const badge = this.add.graphics();
      badge.fillStyle(0x000000, 1);
      badge.fillTriangle(1, 5, 5, 1, 9, 5);
      badge.fillTriangle(1, 5, 5, 9, 9, 5);
      badge.fillStyle(0xffd60a, 1);
      badge.fillTriangle(2, 5, 5, 2, 8, 5);
      badge.fillTriangle(2, 5, 5, 8, 8, 5);
      parts.push(badge);
    }
    const container = this.add.container(u.x * TILE, u.y * TILE, parts).setDepth(10);
    this.views.set(u.uid, { container, body, hpBar });
    this.refreshView(u);
    return u;
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown', (ev: KeyboardEvent) => this.onKey(ev.code));
      const K = Phaser.Input.Keyboard.KeyCodes;
      kb.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE, K.TAB]);
    }
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
  }

  // ---------------------------------------------------------------- queries

  private terrainAt(x: number, y: number): TerrainDef {
    return this.gd.terrain[this.map.tiles[y][x]];
  }

  private unitAt(x: number, y: number): UnitState | undefined {
    return this.units.find((u) => u.alive && u.x === x && u.y === y);
  }

  private combatant(u: UnitState, at?: Vec2): Combatant {
    const def = this.gd.units[u.unitId];
    const pilot = this.gd.pilots[u.pilotId];
    const pos = at ?? u;
    const terrain = this.terrainAt(pos.x, pos.y);
    return { def, pilot, state: u, terrain, domain: unitDomain(def, terrain) };
  }

  private unitInfo(u: UnitState): UnitInfo {
    const def = this.gd.units[u.unitId];
    const pilot = this.gd.pilots[u.pilotId];
    const realm = realmName(u.level);
    const title = def.title ?? (pilot.name !== def.name ? pilot.name : '');
    const rider = def.species && def.species !== 'human' && pilot.name !== def.name ? `${pilot.name} 驾驭` : '';
    return {
      name: u.boss ? `${def.name} [首领]` : def.name,
      sub: rider || (def.species === 'human' || !def.species ? [realm, title].filter(Boolean).join(' · ') : title || realm),
      team: u.team,
      hp: u.hp,
      maxHp: def.hp,
      en: u.en,
      maxEn: def.en,
      morale: u.morale,
      sp: u.sp,
      maxSp: u.team === 'player' ? pilot.sp : 0,
      spirits: activeSpiritLabels(u),
    };
  }

  /** One fighter, one name; legacy test units still show 驾驶员 / 机体. */
  private displayName(c: Combatant): string {
    return c.pilot.name === c.def.name ? c.def.name : `${c.pilot.name} / ${c.def.name}`;
  }

  private weaponOptions(u: UnitState, moved: boolean): WeaponOption[] {
    const def = this.gd.units[u.unitId];
    const a = this.combatant(u);
    const options: WeaponOption[] = [];
    for (const wid of def.weapons) {
      const w = this.gd.weapons[wid];
      if (!w) continue;
      const unavailable = weaponAvailability(u, w, moved);
      const targets = unavailable
        ? []
        : this.units.filter(
            (o) =>
              o.alive &&
              o.team !== u.team &&
              inWeaponRange(manhattan(u, o), w) &&
              canAttack({ attacker: a, defender: this.combatant(o), weapon: w, defense: 'counter' }),
          );
      options.push({ weapon: w, unavailable, targets });
    }
    return options;
  }

  private snapshot(): DebugState {
    return {
      state: this.state,
      history: [...this.history],
      inBattle: this.inBattle,
      battleAnim: this.battleAnim,
      stoppable: this.sel ? [...this.sel.stoppable] : [],
      targets: this.sel ? this.sel.targets.map((t) => t.uid) : [],
      menuIndex: this.menu?.index ?? -1,
      scenario: this.scenario.id,
      outcome: this.outcome,
      turn: this.turn,
      phase: this.phase,
      cursor: { ...this.cursorPos },
      money: this.money,
      seed: this.seed,
      units: this.units.map((u) => ({
        uid: u.uid,
        unitId: u.unitId,
        team: u.team,
        x: u.x,
        y: u.y,
        hp: u.hp,
        en: u.en,
        morale: u.morale,
        alive: u.alive,
        acted: u.acted,
        sp: u.sp,
        spirits: activeSpiritLabels(u),
      })),
    };
  }

  // ---------------------------------------------------------------- rendering helpers

  private refreshView(u: UnitState): void {
    const v = this.views.get(u.uid);
    if (!v) return;
    v.container.setPosition(u.x * TILE, u.y * TILE).setVisible(u.alive);
    if (u.acted) v.body.setTint(0x777777);
    else v.body.clearTint();
    const def = this.gd.units[u.unitId];
    const ratio = Math.max(0, Math.min(1, u.hp / def.hp));
    const g = v.hpBar;
    g.clear();
    g.fillStyle(0x000000, 0.85);
    g.fillRect(2, 28, 28, 3);
    g.fillStyle(ratio > 0.5 ? 0x4cd964 : ratio > 0.25 ? 0xffd60a : 0xff3b30, 1);
    g.fillRect(3, 29, Math.round(26 * ratio), 1);
  }

  private setCursor(x: number, y: number): void {
    if (!inBounds(this.map, x, y)) return;
    this.cursorPos = { x, y };
    this.cursorImg.setPosition(x * TILE, y * TILE);
    this.updateCursorInfo();
  }

  private updateCursorInfo(): void {
    const { x, y } = this.cursorPos;
    const t = this.terrainAt(x, y);
    const u = this.unitAt(x, y);
    const screenX = x * TILE - this.cameras.main.scrollX;
    const side = screenX < GAME_WIDTH / 2 ? 'right' : 'left';
    this.hud.setCursorInfo({ name: t.name, evade: t.evade, defense: t.defense, x, y }, u ? this.unitInfo(u) : null, side);
  }

  private drawHighlights(h: Highlights): void {
    const g = this.hl;
    g.clear();
    if (h.move) {
      g.fillStyle(0x3b82f6, 0.42);
      for (const k of h.move) {
        const { x, y } = parseKey(k);
        g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      }
    }
    if (h.attack) {
      g.fillStyle(0xef4444, 0.38);
      for (const t of h.attack) g.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
    }
    if (h.target) {
      g.lineStyle(2, 0xfacc15, 1);
      g.strokeRect(h.target.x * TILE + 1, h.target.y * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  private clearHighlights(): void {
    this.hl.clear();
  }

  private menuPos(width: number): Vec2 {
    const cam = this.cameras.main;
    const sx = this.cursorPos.x * TILE - cam.scrollX;
    const sy = this.cursorPos.y * TILE - cam.scrollY;
    return { x: sx < GAME_WIDTH / 2 ? sx + TILE + 8 : sx - width - 8, y: sy - 8 };
  }

  private closeMenu(): void {
    this.menu?.destroy();
    this.menu = null;
    this.hud.closeMenu();
  }

  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private floatText(u: UnitState, text: string, color: string): void {
    const t = this.add
      .text(u.x * TILE + TILE / 2, u.y * TILE + 6, text, { ...TEXT_STYLE, color, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(40);
    this.tweens.add({
      targets: t,
      y: t.y - 16,
      alpha: { from: 1, to: 0 },
      duration: 750,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ---------------------------------------------------------------- input

  private onKey(code: string): void {
    if (this.state === 'dialogue') {
      if (CONFIRM_KEYS.has(code)) this.dialogue.advance();
      else if (CANCEL_KEYS.has(code)) this.dialogue.skip();
      return;
    }
    if (this.state === 'gameOver') {
      if (code === 'KeyR') this.restartStage();
      else if (CONFIRM_KEYS.has(code)) this.onConfirm();
      return;
    }
    if (this.state === 'busy' || this.state === 'enemyPhase') return;
    const dir = DIR_KEYS[code];
    if (dir) this.onDir(dir);
    else if (CONFIRM_KEYS.has(code)) this.onConfirm();
    else if (CANCEL_KEYS.has(code)) this.onCancel();
    else if (END_TURN_KEYS.has(code)) this.onEndTurn();
  }

  private onDir(d: Vec2): void {
    if (this.menu) {
      if (d.y !== 0) this.menu.move(d.y);
      return;
    }
    if (this.state === 'targetSelect' && this.sel) {
      const n = this.sel.targets.length;
      if (n === 0) return;
      const step = d.x + d.y > 0 ? 1 : -1;
      this.sel.targetIndex = (this.sel.targetIndex + step + n) % n;
      this.focusTarget();
      return;
    }
    if (this.state === 'idle' || this.state === 'unitSelected') {
      this.setCursor(this.cursorPos.x + d.x, this.cursorPos.y + d.y);
    }
  }

  private onConfirm(): void {
    switch (this.state) {
      case 'dialogue':
        this.dialogue.advance();
        break;
      case 'gameOver':
        if (this.outcome === 'win') this.goToNextStage();
        break;
      case 'idle': {
        const u = this.unitAt(this.cursorPos.x, this.cursorPos.y);
        if (u && u.team === 'player' && !u.acted) this.selectUnit(u);
        else if (!u) this.openSystemMenu();
        break;
      }
      case 'unitSelected':
        if (this.sel?.stoppable.has(key(this.cursorPos.x, this.cursorPos.y))) void this.moveSelected(this.cursorPos);
        break;
      case 'actionMenu':
      case 'weaponSelect':
      case 'systemMenu':
      case 'spiritSelect':
        this.menu?.confirm();
        break;
      case 'targetSelect':
        void this.playerAttack();
        break;
      default:
        break;
    }
  }

  private onCancel(): void {
    switch (this.state) {
      case 'dialogue':
        this.dialogue.skip();
        break;
      case 'unitSelected':
        this.deselect();
        break;
      case 'actionMenu':
        this.undoMove();
        break;
      case 'weaponSelect':
      case 'spiritSelect':
        this.closeMenu();
        this.clearHighlights();
        this.openActionMenu();
        break;
      case 'targetSelect':
        this.hud.hidePreview();
        this.openWeaponMenu();
        break;
      case 'systemMenu':
        this.closeMenu();
        this.state = 'idle';
        break;
      default:
        break;
    }
  }

  private onEndTurn(): void {
    if (this.state === 'idle') void this.endPlayerTurn();
  }

  private tileAt(p: Phaser.Input.Pointer): Vec2 | null {
    const x = Math.floor(p.worldX / TILE);
    const y = Math.floor(p.worldY / TILE);
    return inBounds(this.map, x, y) ? { x, y } : null;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const t = this.tileAt(p);
    if (!t) return;
    if (this.state === 'idle' || this.state === 'unitSelected') {
      if (t.x !== this.cursorPos.x || t.y !== this.cursorPos.y) this.setCursor(t.x, t.y);
    } else if (this.state === 'targetSelect' && this.sel) {
      const i = this.sel.targets.findIndex((u) => u.x === t.x && u.y === t.y);
      if (i >= 0 && i !== this.sel.targetIndex) {
        this.sel.targetIndex = i;
        this.focusTarget();
      }
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.state === 'dialogue' || this.state === 'gameOver') {
      if (p.rightButtonDown()) this.onCancel();
      else this.onConfirm();
      return;
    }
    if (this.state === 'busy' || this.state === 'enemyPhase') return;
    if (p.rightButtonDown()) {
      this.onCancel();
      return;
    }
    const t = this.tileAt(p);
    if (!t) return;
    if (this.state === 'idle' || this.state === 'unitSelected') {
      this.setCursor(t.x, t.y);
      this.onConfirm();
    } else if (this.state === 'targetSelect' && this.sel) {
      const i = this.sel.targets.findIndex((u) => u.x === t.x && u.y === t.y);
      if (i >= 0) {
        this.sel.targetIndex = i;
        this.focusTarget();
        this.onConfirm();
      }
    }
  }

  // ---------------------------------------------------------------- player phase flow

  private selectUnit(u: UnitState): void {
    const def = this.gd.units[u.unitId];
    const blocked = new Set(this.units.filter((o) => o.alive && o.team !== u.team).map((o) => key(o.x, o.y)));
    const occupied = new Set(this.units.filter((o) => o.alive && o.uid !== u.uid).map((o) => key(o.x, o.y)));
    const reach = movementRange({
      map: this.map,
      terrain: this.gd.terrain,
      start: u,
      move: def.move + (u.spirit?.accel ? ACCEL_MOVE : 0),
      moveTypes: def.moveTypes,
      blocked,
    });
    const stoppable = new Set(stoppableTiles(reach, occupied, u).map((t) => key(t.x, t.y)));
    this.sel = { unit: u, origin: { x: u.x, y: u.y }, reach, stoppable, options: [], weapon: null, targets: [], targetIndex: 0 };
    this.state = 'unitSelected';
    this.drawHighlights({ move: stoppable });
    this.hud.setHint('选择移动目标   Z 确定   X 取消');
  }

  private deselect(): void {
    this.sel = null;
    this.clearHighlights();
    this.state = 'idle';
    this.hud.setHint(IDLE_HINT);
  }

  private async moveSelected(dest: Vec2): Promise<void> {
    const sel = this.sel;
    if (!sel) return;
    this.state = 'busy';
    this.clearHighlights();
    const path = pathTo(sel.reach, dest);
    if (path.length > 1) await this.moveAlong(sel.unit, path);
    this.openActionMenu();
  }

  private openActionMenu(): void {
    const sel = this.sel;
    if (!sel) return;
    const u = sel.unit;
    const moved = u.x !== sel.origin.x || u.y !== sel.origin.y;
    u.moved = moved;
    sel.options = this.weaponOptions(u, moved);
    const canAtk = sel.options.some((o) => !o.unavailable && o.targets.length > 0);
    this.state = 'actionMenu';
    this.setCursor(u.x, u.y);
    const width = 90;
    const pos = this.menuPos(width);
    this.menu = this.hud.openMenu(
      [
        { label: '攻击', enabled: canAtk },
        { label: '神通', enabled: this.gd.pilots[u.pilotId].spirits.length > 0 },
        { label: '待机', enabled: true },
      ],
      {
        ...pos,
        width,
        onSelect: (i) => {
          if (i === 0) this.openWeaponMenu();
          else if (i === 1) this.openSpiritMenu();
          else if (i === 2) this.finishAction(u);
        },
      },
    );
    this.hud.setHint('上下 选择   Z 确定   X 撤销移动');
  }

  private spiritContext(u: UnitState): { maxHp: number; maxEn: number; moved: boolean } {
    const def = this.gd.units[u.unitId];
    return { maxHp: def.hp, maxEn: def.en, moved: u.moved };
  }

  private openSpiritMenu(): void {
    const sel = this.sel;
    if (!sel) return;
    const u = sel.unit;
    this.closeMenu();
    this.state = 'spiritSelect';
    const ids = this.gd.pilots[u.pilotId].spirits.filter(isSpiritId);
    const width = 200;
    const pos = this.menuPos(width);
    this.menu = this.hud.openMenu(
      ids.map((id) => {
        const blocked = spiritBlocked(u, id, this.spiritContext(u));
        return { label: `${id} ${SPIRITS[id].cost}  ${blocked ?? SPIRITS[id].desc}`, enabled: !blocked };
      }),
      { ...pos, width, onSelect: (i) => this.useSpirit(u, ids[i]) },
    );
    const maxSp = this.gd.pilots[u.pilotId].sp;
    this.hud.setHint(`神识 ${u.sp}/${maxSp}   Z 使用   X 返回`);
  }

  /** Cast a 神通 for the selected unit and return to its menu (神行 re-opens movement). */
  private useSpirit(u: UnitState, id: SpiritId): void {
    if (spiritBlocked(u, id, this.spiritContext(u))) return;
    castSpirit(u, id, this.spiritContext(u));
    this.closeMenu();
    this.floatText(u, id, '#ffe38f');
    this.refreshView(u);
    this.updateCursorInfo();
    const sel = this.sel;
    if (id === '神行' && sel && !u.moved) {
      this.selectUnit(u);
      return;
    }
    this.openActionMenu();
  }

  private openWeaponMenu(): void {
    const sel = this.sel;
    if (!sel) return;
    this.closeMenu();
    this.state = 'weaponSelect';
    const width = 190;
    const pos = this.menuPos(width);
    const items = sel.options.map((o) => ({
      label:
        `${o.weapon.name} ${o.weapon.power} ${o.weapon.rangeMin}-${o.weapon.rangeMax}` +
        (o.unavailable ? ` ${UNAVAILABLE_TEXT[o.unavailable]}` : o.targets.length ? '' : ' 无目标'),
      enabled: !o.unavailable && o.targets.length > 0,
    }));
    this.menu = this.hud.openMenu(items, {
      ...pos,
      width,
      onSelect: (i) => this.beginTargeting(sel.options[i]),
      onChange: (i) => {
        const w = sel.options[i].weapon;
        this.drawHighlights({ attack: tilesInRange(sel.unit, w.rangeMin, w.rangeMax, this.map) });
      },
    });
    this.hud.setHint('上下 选择武器   Z 确定   X 返回');
  }

  private beginTargeting(opt: WeaponOption): void {
    const sel = this.sel;
    if (!sel || opt.targets.length === 0) return;
    this.closeMenu();
    sel.weapon = opt.weapon;
    sel.targets = opt.targets;
    sel.targetIndex = 0;
    this.state = 'targetSelect';
    this.focusTarget();
    this.hud.setHint('方向键 切换目标   Z 攻击   X 返回');
  }

  private focusTarget(): void {
    const sel = this.sel;
    if (!sel || !sel.weapon) return;
    const target = sel.targets[sel.targetIndex];
    const w = sel.weapon;
    this.setCursor(target.x, target.y);
    this.drawHighlights({ attack: tilesInRange(sel.unit, w.rangeMin, w.rangeMax, this.map), target });
    const choice = chooseDefense(this.combatant(target), this.combatant(sel.unit), this.gd);
    this.showPreview(sel.unit, target, w, choice);
  }

  private async playerAttack(): Promise<void> {
    const sel = this.sel;
    if (!sel || !sel.weapon) return;
    const target = sel.targets[sel.targetIndex];
    if (!target) return;
    this.state = 'busy';
    this.clearHighlights();
    this.closeMenu();
    await this.executeAttack(sel.unit, target, sel.weapon);
    this.finishAction(sel.unit);
  }

  private finishAction(u: UnitState): void {
    u.acted = true;
    this.refreshView(u);
    this.sel = null;
    this.closeMenu();
    this.hud.hidePreview();
    this.clearHighlights();
    if (this.checkEnd()) return;
    this.state = 'idle';
    this.hud.setHint(IDLE_HINT);
    this.updateCursorInfo();
    const remaining = this.units.some((o) => o.alive && o.team === 'player' && !o.acted);
    if (!remaining) this.time.delayedCall(250, () => void this.endPlayerTurn());
  }

  private undoMove(): void {
    const sel = this.sel;
    if (!sel) return;
    this.closeMenu();
    sel.unit.x = sel.origin.x;
    sel.unit.y = sel.origin.y;
    sel.unit.moved = false;
    this.refreshView(sel.unit);
    this.setCursor(sel.unit.x, sel.unit.y);
    this.state = 'unitSelected';
    this.drawHighlights({ move: sel.stoppable });
    this.hud.setHint('选择移动目标   Z 确定   X 取消');
  }

  private openSystemMenu(): void {
    this.closeMenu();
    this.state = 'systemMenu';
    const width = 120;
    const pos = this.menuPos(width);
    this.menu = this.hud.openMenu(
      [
        { label: '结束回合', enabled: true },
        { label: '作战目标', enabled: true },
        { label: `战斗演出：${this.battleAnim ? '开' : '关'}`, enabled: true },
        { label: '重玩本话', enabled: true },
        { label: '从第1话开始', enabled: true },
        { label: '返回', enabled: true },
      ],
      {
        ...pos,
        width,
        onSelect: (i) => {
          if (i === 0) {
            this.closeMenu();
            void this.endPlayerTurn();
          } else if (i === 1) {
            this.closeMenu();
            void this.talk([{ who: NARRATOR, text: this.objectivesText() }]).then(() => {
              this.state = 'idle';
            });
          } else if (i === 2) {
            this.setBattleAnim(!this.battleAnim);
            this.openSystemMenu();
            this.menu?.move(2);
          } else if (i === 3) {
            this.restartStage();
          } else if (i === 4) {
            this.scene.restart({ scenarioId: 's01', campaign: newCampaign() } satisfies MapParams);
          } else {
            this.closeMenu();
            this.state = 'idle';
          }
        },
      },
    );
  }

  private setBattleAnim(on: boolean): void {
    this.battleAnim = on;
    try {
      localStorage.setItem(BATTLE_ANIM_KEY, on ? 'on' : 'off');
    } catch {
      // storage unavailable: setting lasts for this session only
    }
  }

  // ---------------------------------------------------------------- turns

  private async startPlayerTurn(first = false): Promise<void> {
    this.state = 'busy';
    this.phase = 'player';
    if (!first) this.turn++;
    for (const u of this.units) {
      if (!u.alive) continue;
      u.acted = false;
      u.moved = false;
      if (u.team === 'player') expireTurnSpirits(u);
      if (!first) this.applyRecovery(u);
      if (typeof u.hold === 'number' && !isHolding(u.hold, this.turn)) u.hold = false;
      this.refreshView(u);
    }
    this.hud.setTurn(`第${this.turn}回合   灵石 ${this.money}`);
    if (first) {
      await this.hud.banner(this.scenario.title, 900);
      await this.runEvents({ type: 'start' });
      await this.talk([{ who: NARRATOR, text: this.objectivesText() }]);
    } else {
      await this.runEvents({ type: 'turn', turn: this.turn });
    }
    if (this.checkEnd()) return;
    await this.hud.banner(`第 ${this.turn} 回合   我方行动`);
    const firstUnit = this.units.find((u) => u.alive && u.team === 'player');
    if (firstUnit) this.setCursor(firstUnit.x, firstUnit.y);
    this.state = 'idle';
    this.hud.setHint(IDLE_HINT);
    this.updateCursorInfo();
  }

  private applyRecovery(u: UnitState): void {
    const t = this.terrainAt(u.x, u.y);
    const def = this.gd.units[u.unitId];
    if (t.hpRecover > 0) u.hp = Math.min(def.hp, u.hp + Math.floor((def.hp * t.hpRecover) / 100));
    if (t.enRecover > 0) u.en = Math.min(def.en, u.en + Math.floor((def.en * t.enRecover) / 100));
  }

  private async endPlayerTurn(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'systemMenu') return;
    this.closeMenu();
    this.sel = null;
    this.clearHighlights();
    this.hud.hidePreview();
    await this.runEnemyPhase();
  }

  private async runEnemyPhase(): Promise<void> {
    this.state = 'enemyPhase';
    this.phase = 'enemy';
    this.hud.setHint('敌方行动中...');
    for (const u of this.units) if (u.team === 'enemy') expireTurnSpirits(u);
    await this.hud.banner('敌方行动');
    for (const e of [...this.units]) {
      if (!e.alive || e.team !== 'enemy') continue;
      this.setCursor(e.x, e.y);
      await this.delay(220);
      const plan = planAction({
        map: this.map,
        data: this.gd,
        units: this.units,
        actor: e,
        combatant: (u, at) => this.combatant(u, at),
        hold: isHolding(e.hold, this.turn),
      });
      if (plan.path.length > 1) await this.moveAlong(e, plan.path);
      e.moved = plan.path.length > 1;
      if (plan.attack) {
        await this.executeAttack(e, plan.attack.target, plan.attack.weapon);
        if (this.checkEnd()) return;
      }
      e.acted = true;
      this.refreshView(e);
      await this.delay(120);
    }
    await this.startPlayerTurn();
  }

  /** True (and the stage-end sequence starts) once the scenario's victory or defeat condition holds. */
  private checkEnd(): boolean {
    if (this.outcome) return true;
    const outcome = stageOutcome(this.scenario, this.eventUnits());
    if (!outcome) return false;
    this.outcome = outcome;
    this.state = 'busy';
    this.sel = null;
    this.closeMenu();
    this.hud.hidePreview();
    this.clearHighlights();
    void this.endStage(outcome);
    return true;
  }

  private async endStage(outcome: 'win' | 'lose'): Promise<void> {
    if (outcome === 'win') {
      // the stage's remaining enemies withdraw
      for (const u of this.units) {
        if (u.alive && u.team === 'enemy') {
          u.alive = false;
          void this.destroyUnit(u);
        }
      }
      await this.runEvents({ type: 'clear' });
      this.campaign = recordStage(this.campaign, this.units, this.money);
      const next = this.scenario.next;
      if (next) this.saveProgress(next);
      const earned = this.money - this.startCampaign.money;
      const roster = this.units
        .filter((u) => u.team === 'player')
        .map((u) => `${this.gd.units[u.unitId].name.padEnd(4, '　')} ${realmName(u.level)}`);
      this.hud.showResult(`${this.scenario.title}  完`, [`获得灵石 ${earned}    累计 ${this.money}`, '', ...roster], next ? 'Z 进入下一话' : '第一卷「剑骨」完 · 敬请期待');
      this.state = 'gameOver';
      this.hud.setHint(next ? 'Z 进入下一话   R 重玩本话' : 'R 重玩本话');
    } else {
      const leaders = this.scenario.leaders ?? DEFAULT_LEADERS;
      const fallen = this.units.find((u) => u.team === 'player' && !u.alive && leaders.some((id) => matches(u, id)));
      this.state = 'gameOver';
      this.hud.setHint('按 R 重新开始本话');
      void this.hud.banner(fallen ? `${this.gd.units[fallen.unitId].name} 败退   GAME OVER` : 'GAME OVER', -1);
    }
  }

  private restartStage(): void {
    this.scene.restart({ scenarioId: this.scenario.id, campaign: this.startCampaign } satisfies MapParams);
  }

  private goToNextStage(): void {
    const next = this.scenario.next;
    if (!next || !this.gd.scenarios[next]) return;
    this.scene.restart({ scenarioId: next, campaign: this.campaign } satisfies MapParams);
  }

  private saveProgress(scenarioId = this.scenario.id): void {
    if (scenarioId === this.scenario.id) this.startCampaign = this.campaign;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ scenarioId, campaign: this.campaign }));
    } catch {
      // storage unavailable: progress lasts for this session only
    }
  }

  // ---------------------------------------------------------------- scenario events

  private eventUnits(): EventUnit[] {
    return this.units.map((u) => ({
      unitId: u.unitId,
      pilotId: u.pilotId,
      team: u.team,
      hp: u.hp,
      maxHp: this.gd.units[u.unitId].hp,
      alive: u.alive,
      boss: u.boss,
    }));
  }

  /** Fires every due event in order: dialogue first, then reinforcements, morale, 神通 and releases. */
  private async runEvents(check: EventCheck): Promise<void> {
    const events = this.scenario.events ?? [];
    for (;;) {
      const due = dueEvents(events, this.fired, check, this.eventUnits());
      if (due.length === 0) return;
      for (const i of due) {
        this.fired.add(i);
        const e = events[i];
        if (e.talk) await this.talk(e.talk);
        if (e.spawn) await this.reinforce(e.spawn);
        for (const m of e.morale ?? []) {
          for (const u of this.named(m.who)) {
            addMorale(u, m.add);
            this.floatText(u, `战意+${m.add}`, '#ffd60a');
          }
        }
        for (const sp of e.spirit ?? []) {
          for (const u of this.named(sp.who)) {
            if (!isSpiritId(sp.id) || spiritBlocked(u, sp.id, this.spiritContext(u))) continue;
            castSpirit(u, sp.id, this.spiritContext(u));
            this.floatText(u, sp.id, '#ff9ad5');
          }
        }
        for (const who of e.release ?? []) for (const u of this.named(who)) u.hold = false;
      }
      // a status check may cascade (an event's spawn can satisfy another); start/turn/clear fire once
      if (check.type !== 'status') return;
    }
  }

  private named(who: string): UnitState[] {
    return this.units.filter((u) => u.alive && matches(u, who));
  }

  private async reinforce(list: Deployment[]): Promise<void> {
    for (const d of list) {
      const def = this.gd.units[deploymentIds(d).unit];
      const spot = nearestFree(d, this.map, (x, y) => {
        if (this.unitAt(x, y)) return false;
        const t = this.terrainAt(x, y);
        return def.moveTypes.some((m) => t.cost[m] !== undefined);
      });
      if (!spot) continue;
      const u = this.spawn({ ...d, ...spot });
      this.setCursor(u.x, u.y);
      const v = this.views.get(u.uid);
      if (v) {
        v.container.setAlpha(0);
        await this.tweenP({ targets: v.container, alpha: 1, duration: 260 });
      }
      this.floatText(u, d.team === 'player' ? '参战' : '增援', d.team === 'player' ? '#9ad0ff' : '#ff8a80');
      await this.delay(120);
    }
  }

  /** Plays a conversation; the scene sits in the 'dialogue' state until it is dismissed. */
  private async talk(lines: DialogueLine[]): Promise<void> {
    if (lines.length === 0) return;
    const prev = this.state;
    const cursor = { ...this.cursorPos };
    this.state = 'dialogue';
    await this.dialogue.play(
      lines.map((l) => {
        const u = l.who === NARRATOR ? undefined : this.units.find((x) => x.alive && matches(x, l.who));
        return { speaker: this.speaker(l.who), text: l.text, focus: u ? () => this.setCursor(u.x, u.y) : undefined };
      }),
    );
    this.setCursor(cursor.x, cursor.y);
    this.state = prev === 'dialogue' ? 'busy' : prev;
  }

  private speaker(who: string): Speaker {
    if (who === NARRATOR) return { name: null, portrait: null, team: null };
    const deployed = this.units.find((u) => matches(u, who));
    const pilot = this.gd.pilots[who];
    const unit = this.gd.units[who];
    const name = pilot?.name ?? unit?.name ?? who;
    const team = deployed?.team ?? null;
    let portrait: Speaker['portrait'] = null;
    if (this.textures.exists(`portraitL_${who}`)) portrait = { key: `portraitL_${who}`, scale: 1 };
    else {
      const icon = `unit_${deployed?.unitId ?? who}`;
      if (this.textures.exists(icon)) portrait = { key: icon, scale: 2, flip: team === 'enemy' };
    }
    return { name, portrait, team };
  }

  private objectivesText(): string {
    const s = this.scenario;
    const win = s.winText ?? (s.win === 'boss' ? '击败敌方首领' : '击败全部敌人');
    const lose = s.loseText ?? (s.lose === 'leader' ? '云衡被击败' : '我方全灭');
    return `【胜利条件】${win}\n【失败条件】${lose}`;
  }

  /** Test hook: takes a unit down as if it had been defeated, then runs the usual checks. */
  private async debugDefeat(uid: string): Promise<void> {
    const u = this.units.find((x) => x.uid === uid);
    if (!u || !u.alive) return;
    u.hp = 0;
    u.alive = false;
    this.views.get(u.uid)?.container.setVisible(false);
    const prev = this.state;
    this.state = 'busy';
    await this.runEvents({ type: 'status' });
    if (this.checkEnd()) return;
    this.state = prev;
  }

  // ---------------------------------------------------------------- battle

  private showPreview(attacker: UnitState, defender: UnitState, weapon: WeaponDef, choice: DefenseChoice): void {
    const a = this.combatant(attacker);
    const d = this.combatant(defender);
    const input = { attacker: a, defender: d, weapon, defense: choice.action };
    const left: PreviewSide = {
      name: this.displayName(a),
      action: weapon.name,
      hit: hitChance(input),
      damage: finalDamage(input, false),
      crit: critChance(input),
      hp: attacker.hp,
      maxHp: a.def.hp,
    };
    let right: PreviewSide;
    const dName = this.displayName(d);
    if (choice.action === 'counter' && choice.weapon) {
      const ci = { attacker: d, defender: a, weapon: choice.weapon, defense: 'counter' as const };
      right = {
        name: dName,
        action: `反击 ${choice.weapon.name}`,
        hit: hitChance(ci),
        damage: finalDamage(ci, false),
        crit: critChance(ci),
        hp: defender.hp,
        maxHp: d.def.hp,
      };
    } else {
      right = {
        name: dName,
        action: choice.action === 'defend' ? '防御' : '回避',
        hit: null,
        damage: null,
        crit: null,
        hp: defender.hp,
        maxHp: d.def.hp,
      };
    }
    this.hud.showPreview(left, right);
  }

  private async executeAttack(attacker: UnitState, defender: UnitState, weapon: WeaponDef): Promise<void> {
    await this.runEvents({ type: 'battle', a: attacker, b: defender });
    const a = this.combatant(attacker);
    const d = this.combatant(defender);
    const choice = chooseDefense(d, a, this.gd);
    this.showPreview(attacker, defender, weapon, choice);
    this.setCursor(defender.x, defender.y);
    await this.delay(300);

    // The player's unit always stands on the left of the battle screen.
    const left = attacker.team === 'player' ? attacker : defender;
    const sideOf = (u: UnitState): 'left' | 'right' => (u === left ? 'left' : 'right');
    const script: BattleScript = {
      left: this.battleSide(left),
      right: this.battleSide(left === attacker ? defender : attacker),
      strikes: [],
    };

    // Resolve everything up front; the presentation below only shows the numbers.
    const first = this.applyStrike(a, d, weapon, choice.action);
    script.strikes.push({ side: sideOf(attacker), weapon, ...first });
    if (attacker.alive && defender.alive && choice.action === 'counter' && choice.weapon) {
      const counter = this.applyStrike(d, a, choice.weapon, 'counter');
      script.strikes.push({ side: sideOf(defender), weapon: choice.weapon, ...counter });
    }

    if (this.battleAnim) {
      this.hud.hidePreview();
      await this.playBattleScene(script);
      for (const u of [attacker, defender]) {
        this.refreshView(u);
        if (!u.alive) this.views.get(u.uid)?.container.setVisible(false);
      }
    } else {
      for (const s of script.strikes) {
        const att = s.side === sideOf(attacker) ? attacker : defender;
        const def = att === attacker ? defender : attacker;
        await this.animateStrike(att, def, s.weapon, s.result);
        this.refreshView(att);
        this.refreshView(def);
        this.showPreview(attacker, defender, weapon, choice);
        if (s.targetDestroyed) await this.destroyUnit(def);
      }
      await this.delay(300);
    }
    this.hud.hidePreview();
    this.updateCursorInfo();
    await this.runEvents({ type: 'status' });
  }

  private battleSide(u: UnitState): BattleSide {
    const c = this.combatant(u);
    return {
      def: c.def,
      pilot: c.pilot,
      team: u.team,
      hp: u.hp,
      maxHp: c.def.hp,
      en: u.en,
      maxEn: c.def.en,
      terrain: c.terrain,
      domain: c.domain,
    };
  }

  /** Rolls one strike and applies it to both unit states; returns what the presentation needs. */
  private applyStrike(
    a: Combatant,
    d: Combatant,
    weapon: WeaponDef,
    defense: DefenseAction,
  ): Omit<BattleStrike, 'side' | 'weapon'> {
    consumeWeapon(a.state, weapon);
    const result = resolveStrike({ attacker: a, defender: d, weapon, defense }, this.rng);
    if (result.hit) {
      d.state.hp = Math.max(0, d.state.hp - result.damage);
      if (d.state.hold && result.damage > 0) d.state.hold = false;
      addMorale(a.state, MORALE.onHit);
      addMorale(d.state, MORALE.onDamaged);
      if (d.state.hp === 0) {
        d.state.alive = false;
        addMorale(a.state, MORALE.onKill);
        for (const u of this.units) {
          if (u.alive && u.team === d.state.team) addMorale(u, MORALE.onAllyLost);
        }
        this.grantRewards(a.state, d.def);
      }
    } else {
      addMorale(d.state, MORALE.onEvade);
    }
    consumeAttackSpirits(a.state);
    consumeDefenseSpirits(d.state, result.hit);
    return {
      result,
      defense,
      targetHpAfter: d.state.hp,
      attackerEnAfter: a.state.en,
      targetDestroyed: !d.state.alive,
    };
  }

  private playBattleScene(script: BattleScript): Promise<void> {
    return new Promise((resolve) => {
      this.inBattle = true;
      this.scene.launch('Battle', {
        script,
        onDone: () => {
          this.inBattle = false;
          resolve();
        },
      });
    });
  }

  private grantRewards(killer: UnitState, victim: UnitDef): void {
    killer.exp += victim.exp * (killer.spirit?.effort ? 2 : 1);
    while (killer.exp >= LEVEL_EXP) {
      killer.exp -= LEVEL_EXP;
      killer.level++;
      this.floatText(killer, 'LEVEL UP', '#ffd60a');
    }
    if (killer.team === 'player' && victim.money > 0) {
      this.money += victim.money * (killer.spirit?.luck ? 2 : 1);
      this.hud.setTurn(`第${this.turn}回合   灵石 ${this.money}`);
    }
  }

  private async animateStrike(att: UnitState, def: UnitState, weapon: WeaponDef, r: StrikeResult): Promise<void> {
    const av = this.views.get(att.uid);
    const dv = this.views.get(def.uid);
    if (!av || !dv) return;
    const dx = Math.sign(def.x - att.x);
    const dy = Math.sign(def.y - att.y);
    await this.tweenP({
      targets: av.container,
      x: att.x * TILE + dx * 8,
      y: att.y * TILE + dy * 8,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    if (weapon.kind === 'ranged') {
      const shot = this.add
        .rectangle(att.x * TILE + TILE / 2, att.y * TILE + TILE / 2, weapon.beam ? 6 : 4, weapon.beam ? 2 : 4, weapon.beam ? 0xff7bff : 0xfff1a8)
        .setDepth(25);
      await this.tweenP({
        targets: shot,
        x: def.x * TILE + TILE / 2,
        y: def.y * TILE + TILE / 2,
        duration: Math.min(260, 60 * manhattan(att, def) + 80),
      });
      shot.destroy();
    }
    if (r.hit) {
      dv.body.setTintFill(0xffffff);
      this.cameras.main.shake(120, r.crit ? 0.008 : 0.004);
      this.floatText(def, r.crit ? `${r.damage} CRITICAL` : `${r.damage}`, r.crit ? '#ff6b6b' : '#ffffff');
      await this.delay(130);
      dv.body.clearTint();
    } else {
      this.floatText(def, 'MISS', '#9ad0ff');
      await this.tweenP({ targets: dv.container, x: def.x * TILE + dx * 6, duration: 70, yoyo: true });
    }
    await this.delay(320);
  }

  private async destroyUnit(u: UnitState): Promise<void> {
    const v = this.views.get(u.uid);
    if (!v) return;
    const boom = this.add.circle(u.x * TILE + TILE / 2, u.y * TILE + TILE / 2, 4, 0xffb347, 0.9).setDepth(35);
    this.tweens.add({ targets: boom, radius: 20, alpha: 0, duration: 350, onComplete: () => boom.destroy() });
    await this.tweenP({ targets: v.container, alpha: 0, duration: 350 });
    v.container.setVisible(false).setAlpha(1);
  }

  private async moveAlong(u: UnitState, path: Vec2[]): Promise<void> {
    const v = this.views.get(u.uid);
    if (!v) return;
    v.container.setDepth(11);
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      await this.tweenP({ targets: v.container, x: p.x * TILE, y: p.y * TILE, duration: 70 });
      u.x = p.x;
      u.y = p.y;
      this.setCursor(p.x, p.y);
    }
    v.container.setDepth(10);
  }
}
