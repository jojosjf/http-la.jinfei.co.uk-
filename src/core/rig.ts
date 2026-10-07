/**
 * Rig v2：拆件骨架机体（来自「天工仙甲」原型的 rigs/*.json，经 tools/import-rig.mjs 转换）。
 *
 * 坐标约定（导入后统一）：
 * - 单位是游戏像素；原点在机体脚底中线（rest pose 的最低点）。
 * - 「正向」朝 +x：导入时若原图武器在左侧，会把整台机体镜像，让武器朝前。
 * - 每个部件以中心点定位，图片按中心旋转；关节锚点是 rest pose 下两个部件共享的点。
 * - 姿势里的角度是相对父部件的局部角度（弧度，屏幕坐标 y 向下，正值顺时针），根部件是绝对角度。
 *
 * 本文件是纯逻辑，不依赖 Phaser：校验、动作采样和前向运动学（FK）。
 */

export interface RigPart {
  id: string;
  /** Packed sprite frame in the rig's image. */
  frame: { x: number; y: number; w: number; h: number };
  /** Rest centre relative to the origin. */
  x: number;
  y: number;
  /** Display size (equal to the frame size after import). */
  w: number;
  h: number;
  /** Draw order, low first; ties keep array order. */
  layer: number;
  mass: number;
}

export interface RigJoint {
  a: string;
  b: string;
  /** Rest-pose world point shared by both parts. */
  anchor: [number, number];
  /** Soft limits of (angle b - angle a) used by the ragdoll. */
  min: number;
  max: number;
  /** Breaks away when the mech is destroyed (hand-held weapons). */
  detachable: boolean;
}

export interface RigDef {
  id: string;
  name: string;
  version: 2;
  image: string;
  root: string;
  /** human 修士: no dismemberment, dissolves into light; construct: may lose limbs; beast: falls. */
  species?: 'human' | 'construct' | 'beast';
  /** Parts with secondary motion (hair, robe, sleeves, ribbons). Defaults to FOLLOW_PART name matches. */
  follow?: string[];
  /** Rest height in game pixels. */
  height: number;
  parts: RigPart[];
  joints: RigJoint[];
  /** Optional pose overrides / additions (same shape as POSE_LIBRARY entries). */
  poses?: Record<string, RigPose>;
  source?: Record<string, unknown>;
}

export interface RigKey {
  /** 0..1 within the pose. */
  t: number;
  /** Local angles by part id; `_W` / `_O` suffixes mean weapon-arm side / off side, `held_W` / `held_O` the item held on that side. */
  a?: Record<string, number>;
  /** Root offset in pixels (y down). */
  dx?: number;
  dy?: number;
}

export interface RigPose {
  duration: number;
  loop: boolean;
  keys: RigKey[];
}

export interface PartTransform {
  id: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * Generic humanoid poses. Parts the rig does not have are ignored, so non-humanoid rigs
 * still get the root motion (bob, lean, recoil) and whatever limbs share these names.
 */
export const POSE_LIBRARY: Record<string, RigPose> = {
  idle: {
    duration: 1.6,
    loop: true,
    keys: [
      { t: 0, a: {}, dy: 0 },
      { t: 0.5, a: { torso: 0.02, head: -0.03, upper_arm_W: -0.05, upper_arm_O: 0.05 }, dy: 1 },
      { t: 1, a: {}, dy: 0 },
    ],
  },
  walk: {
    duration: 0.7,
    loop: true,
    keys: [
      { t: 0, a: { thigh_l: 0.3, thigh_r: -0.3, leg_l: 0.3, leg_r: -0.3, shin_l: 0.1, shin_r: 0.35, upper_arm_l: -0.15, upper_arm_r: 0.15 }, dy: 0 },
      { t: 0.25, a: {}, dy: -2 },
      { t: 0.5, a: { thigh_l: -0.3, thigh_r: 0.3, leg_l: -0.3, leg_r: 0.3, shin_l: 0.35, shin_r: 0.1, upper_arm_l: 0.15, upper_arm_r: -0.15 }, dy: 0 },
      { t: 0.75, a: {}, dy: -2 },
      { t: 1, a: { thigh_l: 0.3, thigh_r: -0.3, leg_l: 0.3, leg_r: -0.3, shin_l: 0.1, shin_r: 0.35, upper_arm_l: -0.15, upper_arm_r: 0.15 }, dy: 0 },
    ],
  },
  melee: {
    duration: 0.6,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 0.35, a: { torso: -0.12, head: 0.06, upper_arm_W: -2.7, forearm_hand_W: -0.35, held_W: -0.4, thigh_l: -0.15, thigh_r: 0.1 }, dx: -2, dy: 1 },
      { t: 0.6, a: { torso: 0.16, head: -0.08, upper_arm_W: -0.55, forearm_hand_W: -0.15, held_W: 0.5, upper_arm_O: 0.35, thigh_l: 0.25, thigh_r: -0.2 }, dx: 4, dy: 2 },
      { t: 1, a: { torso: 0.06, upper_arm_W: -0.3, held_W: 0.2 }, dx: 1 },
    ],
  },
  shoot: {
    duration: 0.6,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 0.3, a: { torso: 0.06, head: -0.05, upper_arm_W: -1.35, forearm_hand_W: -0.15, held_W: -0.3, upper_arm_O: 2.3, forearm_hand_O: 0.4 } },
      { t: 0.75, a: { torso: 0.03, upper_arm_W: -1.45, forearm_hand_W: -0.1, held_W: -0.3, upper_arm_O: 2.4, forearm_hand_O: 0.5 }, dx: -2 },
      { t: 1, a: { upper_arm_W: -0.4, upper_arm_O: 0.5 } },
    ],
  },
  block: {
    duration: 0.3,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 1, a: { torso: -0.05, upper_arm_W: -1.0, forearm_hand_W: -1.1, upper_arm_O: -0.9, forearm_hand_O: -1.2, head: 0.08 }, dy: 2 },
    ],
  },
  hit: {
    duration: 0.4,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 0.25, a: { torso: -0.2, head: -0.25, upper_arm_W: 0.35, upper_arm_O: 0.4, thigh_l: 0.1, thigh_r: -0.12 }, dx: -5, dy: 2 },
      { t: 1, a: {} },
    ],
  },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Hand-held items: parts joined to a `forearm_hand_*` (or `*hand*`) part by a detachable joint,
 * or a part literally named `weapon`. Returned by side ("l" / "r" = the holding arm's suffix).
 */
export function heldParts(rig: RigDef): Partial<Record<'l' | 'r', string>> {
  const out: Partial<Record<'l' | 'r', string>> = {};
  for (const j of rig.joints) {
    for (const [holder, item] of [
      [j.a, j.b],
      [j.b, j.a],
    ]) {
      const named = item === 'weapon';
      if (!named && !(j.detachable && /hand|forearm/.test(holder))) continue;
      if (/hand|forearm|arm/.test(item)) continue;
      const side = holder.endsWith('_r') ? 'r' : holder.endsWith('_l') ? 'l' : null;
      if (side && !out[side]) out[side] = item;
    }
  }
  return out;
}

/**
 * The weapon-arm side: the holding arm whose item sits furthest forward (+x); without held
 * items, the arm side that is further forward. Defaults to "l".
 */
export function weaponSide(rig: RigDef): 'l' | 'r' {
  const held = heldParts(rig);
  const x = (id: string | undefined): number => rig.parts.find((p) => p.id === id)?.x ?? -Infinity;
  if (held.l || held.r) return x(held.r) > x(held.l) ? 'r' : 'l';
  return x('forearm_hand_r') > x('forearm_hand_l') ? 'r' : 'l';
}

function resolveName(name: string, w: 'l' | 'r', held: Partial<Record<'l' | 'r', string>>): string {
  const o = w === 'l' ? 'r' : 'l';
  if (name === 'held_W') return held[w] ?? '';
  if (name === 'held_O') return held[o] ?? '';
  if (name.endsWith('_W')) return name.slice(0, -2) + '_' + w;
  if (name.endsWith('_O')) return name.slice(0, -2) + '_' + o;
  return name;
}

/** Rig override, then the skeleton type's pose, then the generic library; unknown names fall back to idle. */
export function getPose(rig: RigDef, name: string): RigPose {
  const found = rig.poses?.[name] ?? archetypePoses(rig)[name] ?? POSE_LIBRARY[name];
  return found ?? (name === 'idle' ? POSE_LIBRARY.idle : getPose(rig, 'idle'));
}

export function poseNames(rig: RigDef): string[] {
  return [...new Set([...Object.keys(POSE_LIBRARY), ...Object.keys(archetypePoses(rig)), ...Object.keys(rig.poses ?? {})])];
}

// ---------------------------------------------------------------- skeleton archetypes

export type Archetype =
  | 'humanoid'
  | 'wheeled'
  | 'sixarm'
  | 'quadruped'
  | 'serpent'
  | 'floater'
  | 'spider'
  | 'bird'
  | 'tripod'
  | 'hexapod';

/** Classify a rig by its part names (the 天工仙甲 naming scheme). */
export function archetypeOf(rig: RigDef): Archetype {
  const has = (id: string): boolean => rig.parts.some((p) => p.id === id);
  if (has('segment_1')) return 'serpent';
  if (has('front_upper_l')) return 'quadruped';
  if (has('leg_8')) return 'spider';
  if (has('leg_upper_6')) return 'hexapod';
  if (has('leg_upper_3')) return 'tripod';
  if (has('arm_top_l')) return 'sixarm';
  if (has('wing_l') && has('talon_l')) return 'bird';
  if (has('wheel_l')) return 'wheeled';
  if ((has('thigh_l') || has('leg_l')) && has('upper_arm_l')) return 'humanoid';
  return 'floater';
}

type Angles = Record<string, number>;
interface Frame {
  a: Angles;
  dx?: number;
  dy?: number;
}

/** A looping pose sampled from a periodic function of phase (0..2pi) at n even steps. */
function cycle(duration: number, n: number, f: (ph: number) => Frame): RigPose {
  const keys: RigKey[] = [];
  for (let i = 0; i <= n; i++) {
    const fr = f((i % n) * ((2 * Math.PI) / n));
    keys.push({ t: i / n, a: fr.a, dx: fr.dx ?? 0, dy: fr.dy ?? 0 });
  }
  return { duration, loop: true, keys };
}

/** A one-shot pose from (t, frame) pairs; starts and ends at rest unless the frames say otherwise. */
function shot(duration: number, frames: Array<[number, Frame]>): RigPose {
  const keys: RigKey[] = [{ t: 0, a: {} }];
  for (const [t, fr] of frames) keys.push({ t, a: fr.a, dx: fr.dx ?? 0, dy: fr.dy ?? 0 });
  if (frames[frames.length - 1][0] < 1) keys.push({ t: 1, a: {} });
  return { duration, loop: false, keys };
}

const ids = (rig: RigDef, re: RegExp): string[] => rig.parts.map((p) => p.id).filter((id) => re.test(id));
const all = (list: string[], v: number): Angles => Object.fromEntries(list.map((id) => [id, v]));
const merge = (...xs: Angles[]): Angles => Object.assign({}, ...xs);

/** Chain from the root outwards (serpents): root's children first, following single links. */
function chainFrom(rig: RigDef, re: RegExp): string[] {
  const order: string[] = [];
  const seen = new Set([rig.root]);
  let frontier = [rig.root];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const j of rig.joints) {
        const other = j.a === id ? j.b : j.b === id ? j.a : null;
        if (!other || seen.has(other)) continue;
        seen.add(other);
        next.push(other);
        if (re.test(other)) order.push(other);
      }
    }
    frontier = next;
  }
  return order;
}

/** Parent of every part when the joint graph is walked from the root (root maps to null). */
export function parentMap(rig: RigDef): Map<string, string | null> {
  const parent = new Map<string, string | null>([[rig.root, null]]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const j of rig.joints) {
      if (parent.has(j.a) && !parent.has(j.b)) {
        parent.set(j.b, j.a);
        grew = true;
      } else if (parent.has(j.b) && !parent.has(j.a)) {
        parent.set(j.a, j.b);
        grew = true;
      }
    }
  }
  return parent;
}

/**
 * Converts world-space angles (every part not listed is upright, angle 0) into the parent-relative
 * angles this solver uses. This is how the 云衡 package's motion.js poses its skeleton: each part's
 * angle is absolute, so feet stay flat and sleeves hang regardless of what the limb above does.
 */
export function absoluteToRelative(rig: RigDef, abs: Angles): Angles {
  const parent = parentMap(rig);
  const rel: Angles = {};
  for (const p of rig.parts) {
    const par = parent.get(p.id);
    const a = abs[p.id] ?? 0;
    const pa = par ? (abs[par] ?? 0) : 0;
    if (a - pa !== 0) rel[p.id] = a - pa;
  }
  return rel;
}

/**
 * 修士 poses, ported from the 云衡 package's motion.js (absolute angles, subtle motion):
 * the sword is carried tilted (-0.5 rad), the walk swings legs ±0.21 with the shin bending only
 * on the back-swing and the foot counter-rotating to stay flat, the slash lifts the sword arm
 * (-1.25) and sweeps the blade up and forward (-0.5 → -2.05), the hit leans back and recoils.
 */
function humanPoses(rig: RigDef): Record<string, RigPose> {
  const w = weaponSide(rig);
  const o = w === 'l' ? 'r' : 'l';
  const held = heldParts(rig)[w];
  const has = new Set(rig.parts.map((p) => p.id));
  const sideSign: Record<string, number> = { [w]: 1, [o]: -1 };
  const base = (): Angles => (held ? { [held]: -0.5 } : {});
  const pick = (a: Angles): Angles => Object.fromEntries(Object.entries(a).filter(([k]) => has.has(k)));
  const rel = (a: Angles): Angles => absoluteToRelative(rig, pick(a));
  const loop = (duration: number, n: number, f: (ph: number) => { a: Angles; dx?: number; dy?: number }): RigPose => {
    const keys: RigKey[] = [];
    for (let i = 0; i <= n; i++) {
      const fr = f((i % n) * ((2 * Math.PI) / n));
      keys.push({ t: i / n, a: rel(fr.a), dx: fr.dx ?? 0, dy: fr.dy ?? 0 });
    }
    return { duration, loop: true, keys };
  };
  const once = (duration: number, n: number, f: (u: number) => { a: Angles; dx?: number; dy?: number }): RigPose => {
    const keys: RigKey[] = [];
    for (let i = 0; i <= n; i++) {
      const fr = f(i / n);
      keys.push({ t: i / n, a: rel(fr.a), dx: fr.dx ?? 0, dy: fr.dy ?? 0 });
    }
    return { duration, loop: false, keys };
  };
  return {
    idle: loop(2.7, 8, (ph) => ({ a: { ...base(), torso: 0.008 * Math.sin(ph), head: -0.01 * Math.sin(ph) }, dy: Math.sin(ph) > 0.3 ? 1 : 0 })),
    walk: loop(0.9, 8, (ph) => {
      const g = Math.sin(ph);
      const a: Angles = { ...base(), robe_back: 0.065 * g, backpack: 0.025 * g, bundle: 0.04 * g, scroll: 0.03 * g, pouch: 0.08 * g };
      for (const side of [w, o]) {
        const sg = sideSign[side];
        a[`thigh_${side}`] = 0.21 * g * sg;
        a[`leg_${side}`] = 0.21 * g * sg;
        a[`shin_${side}`] = Math.max(0, -g * sg) * 0.28;
        a[`foot_${side}`] = -g * 0.14 * sg;
        a[`upper_arm_${side}`] = 0.13 * g * sg;
        a[`forearm_hand_${side}`] = -0.12 * g * sg;
        a[`sleeve_${side}`] = 0.16 * g * sg;
        a[`robe_${side}`] = 0.07 * g * sg;
      }
      if (held) a[held] = -0.5 + a[`forearm_hand_${w}`] * 0.5;
      return { a, dy: -Math.round(Math.abs(g) * 1.5) };
    }),
    melee: once(0.65, 10, (u) => {
      const k = Math.sin(u * Math.PI);
      return {
        a: {
          ...base(),
          [`upper_arm_${w}`]: -1.25 * k,
          [`forearm_hand_${w}`]: -0.6 * k,
          [`sleeve_${w}`]: -0.9 * k,
          ...(held ? { [held]: -0.5 - 1.55 * k } : {}),
          torso: -0.04 * k,
        },
        dx: Math.round(2 * k),
      };
    }),
    shoot: once(0.6, 8, (u) => {
      const k = Math.sin(Math.min(1, u * 1.6) * (Math.PI / 2)) * (u < 0.8 ? 1 : (1 - u) / 0.2);
      return {
        a: { ...base(), [`upper_arm_${o}`]: -1.35 * k, [`forearm_hand_${o}`]: -1.45 * k, [`sleeve_${o}`]: -0.55 * k, torso: 0.03 * k, head: 0.02 * k },
        dx: -Math.round(1.5 * k),
      };
    }),
    block: once(0.3, 4, (u) => ({
      a: {
        [`upper_arm_${w}`]: -0.6 * u,
        [`forearm_hand_${w}`]: -1.3 * u,
        [`sleeve_${w}`]: -0.5 * u,
        ...(held ? { [held]: -0.5 - 1.4 * u } : {}),
        torso: -0.04 * u,
      },
      dy: Math.round(u),
    })),
    hit: once(0.38, 6, (u) => {
      const k = Math.sin(u * Math.PI);
      return { a: { ...base(), torso: u < 1 ? -0.12 * k : 0, head: -0.06 * k }, dx: -Math.round(4 * k) };
    }),
  };
}

function buildArchetypePoses(rig: RigDef): Record<string, RigPose> {
  const kind = archetypeOf(rig);
  if (kind === 'humanoid' && rig.species === 'human') return humanPoses(rig);
  switch (kind) {
    case 'quadruped': {
      const fl = ids(rig, /^front_upper_l$/);
      const fr = ids(rig, /^front_upper_r$/);
      const rl = ids(rig, /^rear_upper_l$/);
      const rr = ids(rig, /^rear_upper_r$/);
      const front = [...fl, ...fr];
      const lowerF = ids(rig, /^front_lower_/);
      const tail = ids(rig, /^tail/);
      return {
        idle: cycle(1.8, 6, (ph) => ({ a: merge({ head: 0.04 * Math.sin(ph), torso: 0.01 * Math.sin(ph) }, all(tail, 0.12 * Math.sin(ph))), dy: Math.sin(ph) > 0 ? 1 : 0 })),
        walk: cycle(0.7, 8, (ph) => ({
          a: merge(all([...fl, ...rr], 0.35 * Math.sin(ph)), all([...fr, ...rl], -0.35 * Math.sin(ph)), all(lowerF, 0.15 * Math.max(0, Math.sin(ph))), { head: 0.05 * Math.sin(2 * ph) }),
          dy: -Math.abs(Math.sin(ph)) * 2,
        })),
        melee: shot(0.65, [
          [0.35, { a: merge({ torso: -0.14, head: -0.2 }, all(front, -0.7), all(lowerF, 0.4), all(tail, -0.3)), dx: -3, dy: -2 }],
          [0.6, { a: merge({ torso: 0.16, head: 0.28 }, all(front, 0.35), all(tail, 0.25)), dx: 7, dy: 2 }],
          [0.85, { a: merge({ torso: 0.05, head: 0.1 }, all(front, 0.1)), dx: 2 }],
        ]),
        shoot: shot(0.6, [
          [0.3, { a: merge({ torso: -0.08, head: -0.32 }, all(tail, 0.3)), dy: -1 }],
          [0.7, { a: merge({ torso: -0.04, head: -0.22 }), dx: -2 }],
        ]),
        block: shot(0.3, [[1, { a: merge({ torso: 0.08, head: 0.2 }, all(front, 0.25)), dy: 3 }]]),
        hit: shot(0.4, [[0.25, { a: merge({ torso: -0.18, head: -0.3 }, all(front, -0.3), all(tail, 0.4)), dx: -6, dy: -1 }]]),
      };
    }
    case 'serpent': {
      const chain = chainFrom(rig, /^(neck|segment_\d+|tail_root|tail_tip|tail)$/);
      const wave = (ph: number, amp: number, k = 0.9): Angles => Object.fromEntries(chain.map((id, i) => [id, amp * Math.sin(ph - i * k)]));
      const root = rig.root;
      // The head is the root: turning it would swing the whole body. The first link turns back by
      // most of the head's angle so the body stays level and only the head strikes / rears.
      const head = (a: number, w: Angles): Angles => merge(w, { [root]: a }, chain[0] ? { [chain[0]]: (w[chain[0]] ?? 0) - a * 0.9 } : {});
      return {
        idle: cycle(2.0, 8, (ph) => ({ a: head(0.04 * Math.sin(ph), wave(ph, 0.1)), dy: 2 * Math.sin(ph) })),
        walk: cycle(0.9, 8, (ph) => ({ a: head(0.06 * Math.sin(ph), wave(ph, 0.16)), dy: 2 * Math.sin(ph) })),
        melee: shot(0.7, [
          [0.35, { a: head(-0.22, wave(1, 0.22)), dx: -6, dy: -3 }],
          [0.6, { a: head(0.3, wave(2.5, 0.14)), dx: 10, dy: 3 }],
          [0.85, { a: head(0.1, wave(3.5, 0.08)), dx: 3 }],
        ]),
        shoot: shot(0.7, [
          [0.3, { a: head(-0.3, wave(0.5, 0.12)), dy: -3 }],
          [0.7, { a: head(-0.18, wave(2, 0.1)), dx: -3 }],
        ]),
        block: shot(0.35, [[1, { a: head(0.12, all(chain, 0.12)), dy: 2 }]]),
        hit: shot(0.45, [[0.25, { a: head(-0.3, Object.fromEntries(chain.map((id, i) => [id, i % 2 ? 0.2 : -0.2]))), dx: -7 }]]),
      };
    }
    case 'floater': {
      const arms = ids(rig, /^(upper_arm_|arm_upper_)/);
      const lowers = ids(rig, /^(forearm_hand_|arm_lower_)/);
      const swing = ids(rig, /^(pendulum|tassel|chain_|staff)/);
      const sideSign = (id: string): number => (rig.parts.find((p) => p.id === id)?.x ?? 0) >= 0 ? 1 : -1;
      const armsOut = (v: number): Angles => Object.fromEntries(arms.map((id) => [id, v * sideSign(id)]));
      return {
        idle: cycle(2.4, 8, (ph) => ({ a: merge({ [rig.root]: 0.03 * Math.sin(ph) }, armsOut(0.08 * Math.sin(ph)), all(swing, 0.12 * Math.sin(ph + 1))), dy: -3 + 3 * Math.sin(ph) })),
        walk: cycle(1.2, 8, (ph) => ({ a: merge({ [rig.root]: 0.06 }, all(swing, -0.2 + 0.1 * Math.sin(ph))), dy: -4 + 2 * Math.sin(ph) })),
        melee: shot(0.65, [
          [0.35, { a: merge({ [rig.root]: -0.08 }, all(arms, -0.9), all(lowers, -0.4), all(swing, 0.3)), dx: -3, dy: -6 }],
          [0.6, { a: merge({ [rig.root]: 0.12 }, all(arms, -0.2), all(lowers, 0.3), all(swing, -0.4)), dx: 8, dy: -2 }],
        ]),
        shoot: shot(0.7, [
          [0.3, { a: merge({ [rig.root]: -0.05 }, armsOut(-0.9), all(lowers, -0.3)), dy: -8 }],
          [0.75, { a: merge({ [rig.root]: -0.03 }, armsOut(-1.0), all(lowers, -0.4)), dx: -2, dy: -8 }],
        ]),
        block: shot(0.3, [[1, { a: merge(armsOut(0.6), all(lowers, 0.8)), dy: 2 }]]),
        hit: shot(0.45, [[0.25, { a: merge({ [rig.root]: -0.2 }, armsOut(0.5), all(swing, 0.5)), dx: -6, dy: -2 }]]),
      };
    }
    case 'spider': {
      const legs = ids(rig, /^leg_\d$/);
      const x = (id: string): number => rig.parts.find((p) => p.id === id)?.x ?? 0;
      const front = legs.filter((id) => x(id) > 0).sort((a, b) => x(b) - x(a)).slice(0, 2);
      const odd = legs.filter((id) => Number(id.slice(4)) % 2 === 1);
      const even = legs.filter((id) => Number(id.slice(4)) % 2 === 0);
      return {
        idle: cycle(1.4, 6, (ph) => ({ a: merge(all(odd, 0.04 * Math.sin(ph)), all(even, -0.04 * Math.sin(ph)), { mandible: 0.08 * Math.sin(2 * ph) }) })),
        walk: cycle(0.5, 8, (ph) => ({ a: merge(all(odd, 0.25 * Math.sin(ph)), all(even, -0.25 * Math.sin(ph))), dy: -Math.abs(Math.sin(ph)) })),
        melee: shot(0.6, [
          [0.35, { a: merge({ [rig.root]: -0.18, head: -0.15 }, all(front, -0.8)), dx: -2, dy: -3 }],
          [0.6, { a: merge({ [rig.root]: 0.12, head: 0.2, mandible: 0.3 }, all(front, 0.4)), dx: 8, dy: 1 }],
        ]),
        shoot: shot(0.6, [
          [0.3, { a: merge({ [rig.root]: -0.12, injector: -0.4 }), dy: -2 }],
          [0.7, { a: merge({ [rig.root]: -0.06, injector: -0.2 }), dx: -2 }],
        ]),
        block: shot(0.3, [[1, { a: merge(all(legs, 0.15)), dy: 3 }]]),
        hit: shot(0.4, [[0.25, { a: merge({ [rig.root]: -0.2 }, all(odd, 0.3), all(even, -0.3)), dx: -6 }]]),
      };
    }
    case 'bird': {
      const flap = (v: number): Angles => ({ wing_l: v, wing_r: -v });
      return {
        idle: cycle(0.8, 8, (ph) => ({ a: merge(flap(0.3 * Math.sin(ph)), { tail: 0.08 * Math.sin(ph) }), dy: -2 * Math.sin(ph) })),
        walk: cycle(0.5, 8, (ph) => ({ a: merge(flap(0.45 * Math.sin(ph)), { torso: 0.1 }), dy: -3 * Math.sin(ph) })),
        melee: shot(0.65, [
          [0.35, { a: merge(flap(0.7), { torso: -0.2, head: -0.1, leg_l: -0.4, leg_r: -0.4 }), dx: -4, dy: -10 }],
          [0.6, { a: merge(flap(-0.3), { torso: 0.3, head: 0.2, leg_l: -0.9, leg_r: -0.9 }), dx: 10, dy: 4 }],
        ]),
        shoot: shot(0.7, [
          [0.3, { a: merge(flap(0.5), { torso: -0.05 }), dy: -8 }],
          [0.6, { a: merge(flap(-0.2), { torso: 0.05, bomb_pod_l: 0.3, bomb_pod_r: -0.3 }), dy: -6 }],
        ]),
        block: shot(0.3, [[1, { a: merge(flap(-0.6)), dy: 2 }]]),
        hit: shot(0.45, [[0.25, { a: merge(flap(0.8), { torso: -0.25, head: -0.3 }), dx: -7, dy: -3 }]]),
      };
    }
    case 'tripod':
    case 'hexapod': {
      const uppers = ids(rig, /^leg_upper_\d$/);
      const lowers = ids(rig, /^leg_lower_\d$/);
      const n = (id: string): number => Number(id.split('_').pop());
      const A = uppers.filter((id) => n(id) % 2 === 1);
      const B = uppers.filter((id) => n(id) % 2 === 0);
      const x = (id: string): number => rig.parts.find((p) => p.id === id)?.x ?? 0;
      const frontLeg = uppers.slice().sort((a, b) => x(b) - x(a))[0];
      const heavy = kind === 'hexapod';
      const cannons = ids(rig, /^(cannon_|bow_stock|bolt|loader_arm)/);
      return {
        idle: cycle(heavy ? 2.6 : 1.8, 6, (ph) => ({ a: { head: 0.03 * Math.sin(ph) }, dy: Math.sin(ph) > 0 ? 1 : 0 })),
        walk: cycle(heavy ? 1.2 : 0.8, 8, (ph) => ({
          a: merge(all(A, 0.2 * Math.sin(ph)), all(B, -0.2 * Math.sin(ph)), all(lowers, 0.08 * Math.sin(ph + 1))),
          dy: -Math.abs(Math.sin(ph)) * (heavy ? 1 : 2),
        })),
        melee: shot(0.7, [
          [0.35, { a: merge({ [rig.root]: -0.06 }, frontLeg ? { [frontLeg]: -0.7 } : {}), dx: -2, dy: -2 }],
          [0.6, { a: merge({ [rig.root]: 0.06 }, frontLeg ? { [frontLeg]: 0.15 } : {}), dx: heavy ? 5 : 7, dy: 2 }],
        ]),
        shoot: shot(0.7, [
          [0.3, { a: merge({ [rig.root]: -0.05 }, all(cannons, -0.12)) }],
          [0.5, { a: merge({ [rig.root]: 0.02 }, all(cannons, 0.06)), dx: heavy ? -2 : -4 }],
          [0.8, { a: merge({ [rig.root]: -0.02 }, all(cannons, -0.04)), dx: -1 }],
        ]),
        block: shot(0.3, [[1, { a: merge(all(uppers, 0.1), all(lowers, -0.1)), dy: 3 }]]),
        hit: shot(0.45, [[0.25, { a: merge({ [rig.root]: -0.08, head: -0.2 }, all(uppers, -0.1)), dx: heavy ? -3 : -6 }]]),
      };
    }
    case 'sixarm': {
      return {
        idle: cycle(2.2, 6, (ph) => ({
          a: { arm_top_l: 0.05 * Math.sin(ph), arm_top_r: -0.05 * Math.sin(ph), arm_middle_l: 0.04 * Math.sin(ph + 1), arm_middle_r: -0.04 * Math.sin(ph + 1), halo: 0.03 * Math.sin(ph) },
          dy: Math.sin(ph) > 0 ? 1 : 0,
        })),
        melee: shot(0.75, [
          [0.35, { a: { torso: -0.08, arm_top_l: -0.5, arm_middle_l: -0.3, arm_top_r: 0.2 }, dx: -3 }],
          [0.6, { a: { torso: 0.12, arm_top_l: 2.0, arm_middle_l: 1.2, arm_bottom_l: 0.6, arm_top_r: -0.2 }, dx: 6, dy: 2 }],
          [0.85, { a: { torso: 0.05, arm_top_l: 1.2, arm_middle_l: 0.6 }, dx: 2 }],
        ]),
        shoot: shot(0.8, [
          [0.25, { a: { arm_top_r: -0.35, halo: 0.2 }, dy: -2 }],
          [0.45, { a: { arm_top_r: 0.25, halo: -0.2 } }],
          [0.65, { a: { arm_top_r: -0.3, halo: 0.15 }, dx: -2 }],
        ]),
        block: shot(0.3, [[1, { a: { arm_middle_r: -0.5, arm_bottom_r: -0.3, torso: -0.04 }, dy: 2 }]]),
        hit: shot(0.45, [[0.25, { a: { torso: -0.12, head: -0.15, arm_top_l: -0.3, arm_top_r: 0.3 }, dx: -5 }]]),
      };
    }
    case 'wheeled': {
      const wheels = ids(rig, /^wheel_[lr]$/);
      return {
        walk: cycle(0.6, 8, (ph) => ({ a: merge(all(wheels, ph), { torso: 0.08, upper_arm_l: -0.2, upper_arm_r: -0.2 }), dy: Math.sin(2 * ph) > 0 ? -1 : 0 })),
      };
    }
    default:
      return {};
  }
}

const archetypeCache = new WeakMap<RigDef, Record<string, RigPose>>();

/** Poses for the rig's skeleton type (humanoids use POSE_LIBRARY directly). Memoised per rig. */
export function archetypePoses(rig: RigDef): Record<string, RigPose> {
  let poses = archetypeCache.get(rig);
  if (!poses) {
    poses = buildArchetypePoses(rig);
    archetypeCache.set(rig, poses);
  }
  return poses;
}

export interface PoseSample {
  angles: Record<string, number>;
  dx: number;
  dy: number;
}

/** Interpolated local angles and root offset of `pose` at `time` seconds (eased between keys). */
export function samplePose(rig: RigDef, name: string, time: number): PoseSample {
  const pose = getPose(rig, name);
  const w = weaponSide(rig);
  const held = heldParts(rig);
  let u = pose.duration > 0 ? time / pose.duration : 1;
  u = pose.loop ? u - Math.floor(u) : Math.min(1, Math.max(0, u));
  const keys = pose.keys;
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const span = k1.t - k0.t;
  const f = span > 0 ? smooth(Math.min(1, Math.max(0, (u - k0.t) / span))) : 1;
  const names = new Set([...Object.keys(k0.a ?? {}), ...Object.keys(k1.a ?? {})]);
  const angles: Record<string, number> = {};
  for (const n of names) {
    const id = resolveName(n, w, held);
    if (id) angles[id] = lerp(k0.a?.[n] ?? 0, k1.a?.[n] ?? 0, f);
  }
  return { angles, dx: lerp(k0.dx ?? 0, k1.dx ?? 0, f), dy: lerp(k0.dy ?? 0, k1.dy ?? 0, f) };
}

const rot = (x: number, y: number, a: number): [number, number] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};

/**
 * Forward kinematics. Places the root at its rest centre + (dx, dy) with its absolute angle,
 * then walks the joint graph: each child's absolute angle is parent + local, and its centre is
 * chosen so that both parts' copies of the joint anchor coincide. `facing` -1 mirrors the result.
 * Parts listed in `skip` (detached, owned by physics) and their subtrees are left out.
 */
export function solvePose(rig: RigDef, sample: PoseSample, facing = 1, skip?: Set<string>): PartTransform[] {
  const byId = new Map(rig.parts.map((p) => [p.id, p]));
  const root = byId.get(rig.root) ?? rig.parts[0];
  const placed = new Map<string, { x: number; y: number; angle: number }>();
  placed.set(root.id, { x: root.x + sample.dx, y: root.y + sample.dy, angle: sample.angles[root.id] ?? 0 });
  let progress = true;
  while (progress) {
    progress = false;
    for (const j of rig.joints) {
      const aDone = placed.has(j.a);
      const bDone = placed.has(j.b);
      if (aDone === bDone) continue;
      const parentId = aDone ? j.a : j.b;
      const childId = aDone ? j.b : j.a;
      if (skip?.has(childId)) continue;
      const parent = byId.get(parentId);
      const child = byId.get(childId);
      if (!parent || !child) continue;
      const pt = placed.get(parentId)!;
      const angle = pt.angle + (sample.angles[childId] ?? 0);
      const [pax, pay] = rot(j.anchor[0] - parent.x, j.anchor[1] - parent.y, pt.angle);
      const [cbx, cby] = rot(j.anchor[0] - child.x, j.anchor[1] - child.y, angle);
      placed.set(childId, { x: pt.x + pax - cbx, y: pt.y + pay - cby, angle });
      progress = true;
    }
  }
  const out: PartTransform[] = [];
  for (const p of rig.parts) {
    const t = placed.get(p.id);
    if (!t) continue;
    out.push(facing < 0 ? { id: p.id, x: -t.x, y: t.y, angle: -t.angle } : { id: p.id, x: t.x, y: t.y, angle: t.angle });
  }
  return out;
}

/** All parts reachable from `start` without crossing back towards the root (start included). */
export function subtree(rig: RigDef, start: string): Set<string> {
  const depth = new Map<string, number>([[rig.root, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const j of rig.joints) {
      const da = depth.get(j.a);
      const db = depth.get(j.b);
      if (da !== undefined && db === undefined) {
        depth.set(j.b, da + 1);
        changed = true;
      } else if (db !== undefined && da === undefined) {
        depth.set(j.a, db + 1);
        changed = true;
      }
    }
  }
  const out = new Set([start]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const j of rig.joints) {
      const [p, c] = (depth.get(j.a) ?? 0) <= (depth.get(j.b) ?? 0) ? [j.a, j.b] : [j.b, j.a];
      if (out.has(p) && !out.has(c)) {
        out.add(c);
        grew = true;
      }
    }
  }
  return out;
}

/** Validate a rig. Returns human-readable problems; empty = OK. */
export function validateRig(rig: RigDef): string[] {
  const errors: string[] = [];
  const where = `rig ${rig.id ?? '?'}`;
  if (rig.version !== 2) errors.push(`${where}: unsupported version ${String(rig.version)}`);
  if (!rig.image) errors.push(`${where}: missing image`);
  if (!Array.isArray(rig.parts) || rig.parts.length === 0) return [...errors, `${where}: no parts`];
  const ids = new Set<string>();
  for (const p of rig.parts) {
    if (ids.has(p.id)) errors.push(`${where}: duplicate part ${p.id}`);
    ids.add(p.id);
    if (!(p.frame?.w > 0 && p.frame?.h > 0)) errors.push(`${where}: part ${p.id} has an empty frame`);
  }
  if (!ids.has(rig.root)) errors.push(`${where}: root ${rig.root} is not a part`);
  for (const j of rig.joints ?? []) {
    if (!ids.has(j.a) || !ids.has(j.b)) errors.push(`${where}: joint ${j.a}-${j.b} references an unknown part`);
    if (j.min > j.max) errors.push(`${where}: joint ${j.a}-${j.b} has min > max`);
  }
  if (errors.length === 0) {
    const reached = solvePose(rig, { angles: {}, dx: 0, dy: 0 }).map((t) => t.id);
    for (const id of ids) if (!reached.includes(id)) errors.push(`${where}: part ${id} is not connected to the root`);
  }
  for (const [name, pose] of Object.entries(rig.poses ?? {})) {
    if (!pose.keys?.length) errors.push(`${where}: pose ${name} has no keys`);
  }
  return errors;
}
