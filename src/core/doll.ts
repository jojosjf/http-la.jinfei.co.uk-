/**
 * 布娃娃（paper-doll）机体格式：一台机体由若干部件图层拼成，动作 = 每帧对部件的
 * 平移 / 换帧 / 显隐。只有整数位移，没有旋转缩放，所以像素不会糊。
 * 本文件是纯逻辑（无 Phaser），供加载器、渲染器、预览页和转换脚本共用。
 */

export interface DollFrame {
  /** Image file (relative to the doll json). Omit to use the doll's default `image`. */
  image?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Per-frame pivot override (frame pixel coords). */
  pivot?: { x: number; y: number };
}

export interface DollPart {
  /** Draw order, low first. */
  z: number;
  /** Point inside the frame that is placed at the part's layout position. */
  pivot: { x: number; y: number };
  frames: DollFrame[];
  /** Default visibility (weapons that only appear in some poses set false). */
  visible?: boolean;
}

export interface DollKey {
  dx?: number;
  dy?: number;
  frame?: number;
  hidden?: boolean;
}

export interface DollPose {
  fps: number;
  loop: boolean;
  /** One entry per animation frame: part name -> overrides. Parts not listed keep their rest state. */
  keys: Array<Record<string, DollKey>>;
}

export interface DollDef {
  id: string;
  version: 1;
  /** Default sprite sheet (relative to the doll json). */
  image?: string;
  /** Design canvas the layout coordinates refer to. */
  canvas: { w: number; h: number };
  /** Ground contact point in canvas coords (usually bottom centre). Drawn facing right. */
  origin: { x: number; y: number };
  parts: Record<string, DollPart>;
  /** Rest position of each part's pivot, in canvas coords. */
  layout: Record<string, { x: number; y: number }>;
  /** Named attachment points (muzzle, hand...) relative to a part's pivot. */
  sockets?: Record<string, { part: string; x: number; y: number }>;
  /** Must contain `idle`. Battle uses idle / shoot / melee / hit / down and falls back to idle. */
  poses: Record<string, DollPose>;
}

export const REQUIRED_POSES = ['idle'] as const;
export const BATTLE_POSES = ['idle', 'shoot', 'melee', 'hit', 'down'] as const;
export type BattlePose = (typeof BATTLE_POSES)[number];

export interface ResolvedPart {
  part: string;
  frameIndex: number;
  frame: DollFrame;
  /** Position of the pivot relative to the doll origin (so the origin is at 0,0). */
  x: number;
  y: number;
  pivot: { x: number; y: number };
  z: number;
  hidden: boolean;
}

/** Validate a doll definition. Returns human-readable problems; empty = OK. */
export function validateDoll(def: DollDef): string[] {
  const errors: string[] = [];
  const where = `doll ${def.id ?? '?'}`;
  if (!def.id) errors.push('doll: missing id');
  if (def.version !== 1) errors.push(`${where}: unsupported version ${String(def.version)}`);
  if (!def.canvas || def.canvas.w <= 0 || def.canvas.h <= 0) errors.push(`${where}: invalid canvas`);
  if (!def.origin) errors.push(`${where}: missing origin`);
  const parts = def.parts ?? {};
  if (Object.keys(parts).length === 0) errors.push(`${where}: no parts`);
  for (const [name, p] of Object.entries(parts)) {
    if (!p.frames || p.frames.length === 0) errors.push(`${where}: part ${name} has no frames`);
    for (const [i, f] of (p.frames ?? []).entries()) {
      if (!f.image && !def.image) errors.push(`${where}: part ${name} frame ${i} has no image and the doll has no default image`);
      if (f.w <= 0 || f.h <= 0) errors.push(`${where}: part ${name} frame ${i} has an empty rect`);
    }
    if (!def.layout?.[name]) errors.push(`${where}: part ${name} has no layout position`);
  }
  for (const name of Object.keys(def.layout ?? {})) {
    if (!parts[name]) errors.push(`${where}: layout references unknown part ${name}`);
  }
  for (const [name, s] of Object.entries(def.sockets ?? {})) {
    if (!parts[s.part]) errors.push(`${where}: socket ${name} references unknown part ${s.part}`);
  }
  const poses = def.poses ?? {};
  for (const req of REQUIRED_POSES) if (!poses[req]) errors.push(`${where}: missing required pose ${req}`);
  for (const [pname, pose] of Object.entries(poses)) {
    if (!pose.keys || pose.keys.length === 0) errors.push(`${where}: pose ${pname} has no keys`);
    if (!(pose.fps > 0)) errors.push(`${where}: pose ${pname} has invalid fps`);
    for (const [k, key] of (pose.keys ?? []).entries()) {
      for (const [part, ov] of Object.entries(key)) {
        if (!parts[part]) errors.push(`${where}: pose ${pname} key ${k} references unknown part ${part}`);
        else if (ov.frame !== undefined && (ov.frame < 0 || ov.frame >= parts[part].frames.length)) {
          errors.push(`${where}: pose ${pname} key ${k} part ${part} frame ${ov.frame} out of range`);
        }
      }
    }
  }
  return errors;
}

/** Pose to use for a requested battle pose, falling back to idle. */
export function poseName(def: DollDef, wanted: string): string {
  return def.poses[wanted] ? wanted : 'idle';
}

/** Where every part sits (relative to the origin) at key `keyIndex` of `pose`, sorted by z. */
export function resolvePose(def: DollDef, pose: string, keyIndex: number): ResolvedPart[] {
  const p = def.poses[poseName(def, pose)];
  const n = p.keys.length;
  const key = p.keys[((keyIndex % n) + n) % n] ?? {};
  const out: ResolvedPart[] = [];
  for (const [name, part] of Object.entries(def.parts)) {
    const ov = key[name] ?? {};
    const frameIndex = Math.min(Math.max(ov.frame ?? 0, 0), part.frames.length - 1);
    const frame = part.frames[frameIndex];
    const rest = def.layout[name];
    out.push({
      part: name,
      frameIndex,
      frame,
      x: rest.x + (ov.dx ?? 0) - def.origin.x,
      y: rest.y + (ov.dy ?? 0) - def.origin.y,
      pivot: frame.pivot ?? part.pivot,
      z: part.z,
      hidden: ov.hidden ?? !(part.visible ?? true),
    });
  }
  return out.sort((a, b) => a.z - b.z);
}

/** Socket position relative to the origin for the given pose key (null if the socket is unknown). */
export function resolveSocket(def: DollDef, socket: string, pose: string, keyIndex: number): { x: number; y: number } | null {
  const s = def.sockets?.[socket];
  if (!s) return null;
  const part = resolvePose(def, pose, keyIndex).find((r) => r.part === s.part);
  if (!part) return null;
  return { x: part.x + s.x, y: part.y + s.y };
}

/** Every distinct image file a doll needs. */
export function dollImages(def: DollDef): string[] {
  const set = new Set<string>();
  if (def.image) set.add(def.image);
  for (const p of Object.values(def.parts)) for (const f of p.frames) if (f.image) set.add(f.image);
  return [...set];
}
