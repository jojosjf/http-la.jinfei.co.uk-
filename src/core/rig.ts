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
  /** Local angles by part id; `_W` / `_O` suffixes mean weapon-arm side / off side. */
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
      { t: 0, a: { thigh_l: 0.3, thigh_r: -0.3, shin_l: 0.1, shin_r: 0.35, upper_arm_l: -0.15, upper_arm_r: 0.15 }, dy: 0 },
      { t: 0.25, a: {}, dy: -2 },
      { t: 0.5, a: { thigh_l: -0.3, thigh_r: 0.3, shin_l: 0.35, shin_r: 0.1, upper_arm_l: 0.15, upper_arm_r: -0.15 }, dy: 0 },
      { t: 0.75, a: {}, dy: -2 },
      { t: 1, a: { thigh_l: 0.3, thigh_r: -0.3, shin_l: 0.1, shin_r: 0.35, upper_arm_l: -0.15, upper_arm_r: 0.15 }, dy: 0 },
    ],
  },
  melee: {
    duration: 0.6,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 0.35, a: { torso: -0.12, head: 0.06, upper_arm_W: -2.7, forearm_hand_W: -0.35, weapon: -0.4, thigh_l: -0.15, thigh_r: 0.1 }, dx: -2, dy: 1 },
      { t: 0.6, a: { torso: 0.16, head: -0.08, upper_arm_W: -0.55, forearm_hand_W: -0.15, weapon: 0.5, upper_arm_O: 0.35, thigh_l: 0.25, thigh_r: -0.2 }, dx: 4, dy: 2 },
      { t: 1, a: { torso: 0.06, upper_arm_W: -0.3, weapon: 0.2 }, dx: 1 },
    ],
  },
  shoot: {
    duration: 0.6,
    loop: false,
    keys: [
      { t: 0, a: {} },
      { t: 0.3, a: { torso: 0.06, head: -0.05, upper_arm_W: -1.35, forearm_hand_W: -0.15, weapon: -0.3, upper_arm_O: 2.3, forearm_hand_O: 0.4 } },
      { t: 0.75, a: { torso: 0.03, upper_arm_W: -1.45, forearm_hand_W: -0.1, weapon: -0.3, upper_arm_O: 2.4, forearm_hand_O: 0.5 }, dx: -2 },
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

/** Which side ("l" / "r") holds the weapon: the side of the part the weapon is jointed to. */
export function weaponSide(rig: RigDef): 'l' | 'r' {
  const j = rig.joints.find((x) => x.a === 'weapon' || x.b === 'weapon');
  const holder = j ? (j.a === 'weapon' ? j.b : j.a) : '';
  return holder.endsWith('_r') ? 'r' : 'l';
}

function resolveName(name: string, w: 'l' | 'r'): string {
  const o = w === 'l' ? 'r' : 'l';
  if (name.endsWith('_W')) return name.slice(0, -2) + '_' + w;
  if (name.endsWith('_O')) return name.slice(0, -2) + '_' + o;
  return name;
}

export function getPose(rig: RigDef, name: string): RigPose {
  return rig.poses?.[name] ?? POSE_LIBRARY[name] ?? POSE_LIBRARY.idle;
}

export function poseNames(rig: RigDef): string[] {
  return [...new Set([...Object.keys(POSE_LIBRARY), ...Object.keys(rig.poses ?? {})])];
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
    angles[resolveName(n, w)] = lerp(k0.a?.[n] ?? 0, k1.a?.[n] ?? 0, f);
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
