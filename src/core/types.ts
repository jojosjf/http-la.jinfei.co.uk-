/** 空 / 陆 / 海 / 宇 — the four combat domains a unit can be in. */
export type Domain = 'air' | 'land' | 'sea' | 'space';
/** Terrain adaptation grade. '-' means the unit/weapon cannot operate in that domain at all. */
export type Grade = 'A' | 'B' | 'C' | 'D' | '-';
export type Adapt = Record<Domain, Grade>;
export type Size = 'S' | 'M' | 'L' | 'LL';
/** How a unit can traverse the map. A unit with 'air' is treated as airborne. */
export type MoveType = 'land' | 'air' | 'sea' | 'space';
export type Team = 'player' | 'enemy';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TerrainDef {
  id: string;
  name: string;
  /** Domain for a non-flying unit standing on this tile. */
  domain: 'land' | 'sea' | 'space';
  /** Movement cost per move type. Missing = impassable for that move type. */
  cost: Partial<Record<MoveType, number>>;
  /** Added to the defender's evasion (percentage points). */
  evade: number;
  /** Armor bonus in percent while standing here. */
  defense: number;
  /** HP / EN recovered at the start of the owner's turn, in percent of max. */
  hpRecover: number;
  enRecover: number;
  /** Placeholder colour, "#rrggbb". */
  color: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  power: number;
  rangeMin: number;
  rangeMax: number;
  /** Hit modifier in percentage points. */
  hit: number;
  /** Critical modifier in percentage points. */
  crit: number;
  /** EN consumed per use. */
  en: number;
  /** Ammo per sortie; null = unlimited. */
  ammo: number | null;
  /** Minimum morale (气力) required. */
  morale: number;
  /** Adaptation against a target in each domain. */
  adapt: Adapt;
  /** P-weapon: usable after moving. */
  postMove: boolean;
  /** Beam attribute (I-field / beam coat interaction, later). */
  beam: boolean;
  kind: 'melee' | 'ranged';
  /** Presentation only: sword 飞剑 / thunder 雷法 / ice 冰 / fire 火; default picks by kind/beam/ammo. */
  fx?: 'sword' | 'thunder' | 'ice' | 'fire';
}

export interface UnitDef {
  id: string;
  name: string;
  hp: number;
  en: number;
  armor: number;
  mobility: number;
  /** 限界 — caps (pilot hit + mobility) and (pilot evade + mobility). */
  limit: number;
  move: number;
  size: Size;
  moveTypes: MoveType[];
  adapt: Adapt;
  weapons: string[];
  /** Money / exp awarded to whoever destroys this unit. */
  money: number;
  exp: number;
  color: string;
  /** human 修士 / construct 机关傀儡 / beast 神兽妖兽: affects defeat text and presentation only. */
  species?: Species;
  /** Faction or title shown under the name, e.g. 青云剑宗 / 天工宗傀儡. */
  title?: string;
}

export type Species = 'human' | 'construct' | 'beast';

export interface PilotDef {
  id: string;
  name: string;
  level: number;
  melee: number;
  ranged: number;
  hit: number;
  evade: number;
  skill: number;
  defense: number;
  sp: number;
  adapt: Adapt;
  /** Spirit command ids (not implemented yet in the vertical slice). */
  spirits: string[];
  moraleStart?: number;
}

export interface UnitState {
  uid: string;
  unitId: string;
  pilotId: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  en: number;
  sp: number;
  morale: number;
  ammo: Record<string, number>;
  acted: boolean;
  moved: boolean;
  level: number;
  exp: number;
  alive: boolean;
}

export interface GameMap {
  width: number;
  height: number;
  /** tiles[y][x] = terrain id */
  tiles: string[][];
}

/**
 * A character on the map. In 问剑录 a character is one fighter: `character` names both its body
 * record (units.json: 气血 / 灵力 / 法宝) and its cultivation record (pilots.json). Legacy test
 * scenarios may still give `unit` and `pilot` separately.
 */
export interface Deployment {
  character?: string;
  unit?: string;
  pilot?: string;
  team: Team;
  x: number;
  y: number;
}

export interface ScenarioDef {
  id: string;
  title: string;
  width: number;
  height: number;
  /** Single-character glyph -> terrain id. */
  legend: Record<string, string>;
  /** One string per row, `width` glyphs each. */
  rows: string[];
  deploy: Deployment[];
  win: 'annihilate';
  lose: 'annihilate';
}
