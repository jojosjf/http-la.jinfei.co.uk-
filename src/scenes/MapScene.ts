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
import { mulberry32 } from '../core/rng';
import { buildMap } from '../core/scenario';
import type { Deployment, GameMap, ScenarioDef, TerrainDef, UnitDef, UnitState, Vec2, WeaponDef } from '../core/types';
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
import { Hud, TEXT_STYLE, type Menu, type PreviewSide, type UnitInfo } from '../ui/Hud';

type State =
  | 'idle'
  | 'unitSelected'
  | 'actionMenu'
  | 'weaponSelect'
  | 'targetSelect'
  | 'systemMenu'
  | 'busy'
  | 'enemyPhase'
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
  private state: State = 'idle';
  private sel: Selection | null = null;
  private menu: Menu | null = null;
  private turn = 1;
  private phase: 'player' | 'enemy' = 'player';
  private money = 0;
  private seed = 0;
  private rng: () => number = Math.random;

  constructor() {
    super('Map');
  }

  init(params: { scenarioId?: string; seed?: number } = {}): void {
    this.gd = loadData();
    this.scenario = this.gd.scenarios[params.scenarioId ?? 's01'];
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
    this.money = 0;
    this.state = 'busy';
  }

  create(): void {
    this.buildTiles();
    this.hl = this.add.graphics().setDepth(5);
    for (const d of this.scenario.deploy) this.spawn(d);

    this.cursorImg = this.add.image(0, 0, 'cursor').setOrigin(0).setDepth(30);
    this.tweens.add({ targets: this.cursorImg, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1 });

    this.hud = new Hud(this);

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
    });

    void this.startPlayerTurn(true);
  }

  // ---------------------------------------------------------------- setup

  private buildTiles(): void {
    const key = renderMapTexture(this, this.map, this.gd.terrain, ART_SEED, `map_${this.scenario.id}`);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
  }

  private spawn(d: Deployment): void {
    const def = this.gd.units[d.unit];
    const pilot = this.gd.pilots[d.pilot];
    const u = createUnit(`u${this.units.length}`, def, pilot, this.gd.weapons, d.team, d.x, d.y);
    this.units.push(u);

    const frame = this.add.image(0, 0, u.team === 'player' ? 'team_player' : 'team_enemy').setOrigin(0);
    const body = this.add.image(0, 0, `unit_${def.id}`).setOrigin(0);
    if (u.team === 'enemy') body.setFlipX(true);
    const hpBar = this.add.graphics();
    const container = this.add.container(u.x * TILE, u.y * TILE, [frame, body, hpBar]).setDepth(10);
    this.views.set(u.uid, { container, body, hpBar });
    this.refreshView(u);
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
    return {
      unit: def.name,
      pilot: pilot.name,
      team: u.team,
      hp: u.hp,
      maxHp: def.hp,
      en: u.en,
      maxEn: def.en,
      morale: u.morale,
      level: u.level,
    };
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
      stoppable: this.sel ? [...this.sel.stoppable] : [],
      targets: this.sel ? this.sel.targets.map((t) => t.uid) : [],
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
    if (this.state === 'gameOver') {
      if (code === 'KeyR') this.scene.restart({ scenarioId: this.scenario.id });
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
      case 'unitSelected':
        this.deselect();
        break;
      case 'actionMenu':
        this.undoMove();
        break;
      case 'weaponSelect':
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
    if (this.state === 'busy' || this.state === 'enemyPhase' || this.state === 'gameOver') return;
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
      move: def.move,
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
        { label: '精神', enabled: false },
        { label: '待机', enabled: true },
      ],
      {
        ...pos,
        width,
        onSelect: (i) => {
          if (i === 0) this.openWeaponMenu();
          else if (i === 2) this.finishAction(u);
        },
      },
    );
    this.hud.setHint('上下 选择   Z 确定   X 撤销移动');
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
    this.state = 'systemMenu';
    const width = 90;
    const pos = this.menuPos(width);
    this.menu = this.hud.openMenu(
      [
        { label: '结束回合', enabled: true },
        { label: '返回', enabled: true },
      ],
      {
        ...pos,
        width,
        onSelect: (i) => {
          this.closeMenu();
          if (i === 0) void this.endPlayerTurn();
          else this.state = 'idle';
        },
      },
    );
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
      if (!first) this.applyRecovery(u);
      this.refreshView(u);
    }
    this.hud.setTurn(`第${this.turn}回合   资金 ${this.money}`);
    if (first) await this.hud.banner(this.scenario.title, 900);
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

  private checkEnd(): boolean {
    const enemies = this.units.filter((u) => u.alive && u.team === 'enemy').length;
    const players = this.units.filter((u) => u.alive && u.team === 'player').length;
    if (enemies > 0 && players > 0) return false;
    this.state = 'gameOver';
    this.sel = null;
    this.closeMenu();
    this.hud.hidePreview();
    this.clearHighlights();
    this.hud.setHint('按 R 重新开始');
    void this.hud.banner(enemies === 0 ? `STAGE CLEAR   资金 ${this.money}` : 'GAME OVER', -1);
    return true;
  }

  // ---------------------------------------------------------------- battle

  private showPreview(attacker: UnitState, defender: UnitState, weapon: WeaponDef, choice: DefenseChoice): void {
    const a = this.combatant(attacker);
    const d = this.combatant(defender);
    const input = { attacker: a, defender: d, weapon, defense: choice.action };
    const left: PreviewSide = {
      name: `${a.pilot.name} / ${a.def.name}`,
      action: weapon.name,
      hit: hitChance(input),
      damage: finalDamage(input, false),
      crit: critChance(input),
      hp: attacker.hp,
      maxHp: a.def.hp,
    };
    let right: PreviewSide;
    const dName = `${d.pilot.name} / ${d.def.name}`;
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
    const a = this.combatant(attacker);
    const d = this.combatant(defender);
    const choice = chooseDefense(d, a, this.gd);
    this.showPreview(attacker, defender, weapon, choice);
    this.setCursor(defender.x, defender.y);
    await this.delay(300);
    await this.strike(a, d, weapon, choice.action);
    this.showPreview(attacker, defender, weapon, choice);
    if (attacker.alive && defender.alive && choice.action === 'counter' && choice.weapon) {
      await this.delay(200);
      await this.strike(d, a, choice.weapon, 'counter');
      this.showPreview(attacker, defender, weapon, choice);
    }
    await this.delay(300);
    this.hud.hidePreview();
    this.updateCursorInfo();
  }

  private async strike(a: Combatant, d: Combatant, weapon: WeaponDef, defense: DefenseAction): Promise<void> {
    consumeWeapon(a.state, weapon);
    const r = resolveStrike({ attacker: a, defender: d, weapon, defense }, this.rng);
    await this.animateStrike(a.state, d.state, weapon, r);
    if (r.hit) {
      d.state.hp = Math.max(0, d.state.hp - r.damage);
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
    this.refreshView(d.state);
    this.refreshView(a.state);
    if (!d.state.alive) await this.destroyUnit(d.state);
  }

  private grantRewards(killer: UnitState, victim: UnitDef): void {
    killer.exp += victim.exp;
    while (killer.exp >= LEVEL_EXP) {
      killer.exp -= LEVEL_EXP;
      killer.level++;
      this.floatText(killer, 'LEVEL UP', '#ffd60a');
    }
    if (killer.team === 'player' && victim.money > 0) {
      this.money += victim.money;
      this.hud.setTurn(`第${this.turn}回合   资金 ${this.money}`);
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
