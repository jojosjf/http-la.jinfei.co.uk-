import type { Vec2 } from './core/types';

/** Snapshot of the map scene exposed to Playwright tests via window.__srpg. */
export interface DebugUnit {
  uid: string;
  unitId: string;
  team: string;
  x: number;
  y: number;
  hp: number;
  en: number;
  morale: number;
  alive: boolean;
  acted: boolean;
  sp: number;
  spirits: string[];
}

export interface DebugState {
  state: string;
  /** Recent state transitions, oldest first. */
  history: string[];
  /** Tiles the selected unit may stop on (state unitSelected), as "x,y" keys. */
  stoppable: string[];
  /** Targets offered in targetSelect, by uid. */
  targets: string[];
  /** Highlighted row of the open menu, or -1 when none is open. */
  menuIndex: number;
  turn: number;
  phase: string;
  /** True while the cut-away battle scene is playing. */
  inBattle: boolean;
  /** Battle animation setting (false = resolve on the map only). */
  battleAnim: boolean;
  cursor: Vec2;
  money: number;
  seed: number;
  units: DebugUnit[];
}

export interface DebugApi {
  ready: boolean;
  getState(): DebugState;
  setCursor(x: number, y: number): void;
  setBattleAnim(on: boolean): void;
  /** Same as pressing the confirm / cancel / end-turn keys, but applied synchronously. */
  confirm(): void;
  /** Move the open menu's selection (like pressing up/down n times). */
  menuMove(n: number): void;
  /** Cast a 神通 directly (tests). */
  castSpirit(uid: string, id: string): void;
  cancel(): void;
  endTurn(): void;
}

declare global {
  interface Window {
    __srpg?: DebugApi;
  }
}

export function installDebugHook(api: DebugApi): void {
  window.__srpg = api;
}
