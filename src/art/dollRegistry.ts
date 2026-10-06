import Phaser from 'phaser';
import { dollImages, validateDoll, type DollDef } from '../core/doll';
import { validateRig, type RigDef } from '../core/rig';

export interface LoadedDoll {
  def: DollDef;
  /** image file name (as written in the doll json) -> Phaser texture key */
  textures: Map<string, string>;
}

export interface LoadedRig {
  def: RigDef;
  /** Texture key; every part is registered as a frame named after the part id. */
  texture: string;
}

export interface MechIndexEntry {
  id: string;
  /** Paper-doll json (v1, frame-swap parts). */
  doll?: string;
  /** Skeletal rig json (v2, rotating parts + ragdoll). Takes precedence over `doll`. */
  rig?: string;
  /** Optional 32x32 map icon PNG that replaces the placeholder `unit_<id>`. */
  icon?: string;
}

export interface MechIndex {
  dolls: MechIndexEntry[];
}

const dolls = new Map<string, LoadedDoll>();
const rigs = new Map<string, LoadedRig>();

/** Imported mech art, by unit id. Filled once by `loadMechAssets`. */
export const dollRegistry = {
  get: (id: string): LoadedDoll | undefined => dolls.get(id),
  getRig: (id: string): LoadedRig | undefined => rigs.get(id),
  has: (id: string): boolean => dolls.has(id) || rigs.has(id),
  ids: (): string[] => [...new Set([...rigs.keys(), ...dolls.keys()])],
  clear: (): void => {
    dolls.clear();
    rigs.clear();
  },
};

/** Run one loader pass and resolve when it completes (even if some files fail). */
function loadPass(scene: Phaser.Scene, add: (l: Phaser.Loader.LoaderPlugin) => void): Promise<void> {
  return new Promise((resolve) => {
    const l = scene.load;
    add(l);
    if (l.list.size === 0 && !l.isLoading()) {
      resolve();
      return;
    }
    l.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    l.start();
  });
}

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');

/**
 * Loads `mechs/index.json` and every doll / rig / icon it lists. Missing index = no imported art,
 * which is fine: callers fall back to procedural placeholders. Never throws.
 */
export async function loadMechAssets(scene: Phaser.Scene): Promise<void> {
  dollRegistry.clear();
  await loadPass(scene, (l) => l.json('mechIndex', 'mechs/index.json'));
  if (!scene.cache.json.exists('mechIndex')) return;
  const index = scene.cache.json.get('mechIndex') as Partial<MechIndex>;
  const entries = (index.dolls ?? []).filter((e) => e && typeof e.id === 'string');
  if (entries.length === 0) return;

  await loadPass(scene, (l) => {
    for (const e of entries) {
      if (e.rig) l.json(`rig:${e.id}`, e.rig);
      else if (e.doll) l.json(`doll:${e.id}`, e.doll);
      if (e.icon) l.image(`unit_${e.id}`, e.icon);
    }
  });

  const pendingDolls: Array<{ entry: MechIndexEntry; def: DollDef }> = [];
  const pendingRigs: Array<{ entry: MechIndexEntry; def: RigDef; key: string }> = [];
  await loadPass(scene, (l) => {
    for (const e of entries) {
      if (e.rig && scene.cache.json.exists(`rig:${e.id}`)) {
        const def = scene.cache.json.get(`rig:${e.id}`) as RigDef;
        const problems = validateRig(def);
        if (problems.length) {
          console.warn(`[mechs] ${e.id} rig skipped:\n` + problems.join('\n'));
          continue;
        }
        const key = `rig:${e.id}:${def.image}`;
        if (!scene.textures.exists(key)) l.image(key, dirOf(e.rig) + def.image);
        pendingRigs.push({ entry: e, def, key });
        continue;
      }
      if (!e.doll || !scene.cache.json.exists(`doll:${e.id}`)) continue;
      const def = scene.cache.json.get(`doll:${e.id}`) as DollDef;
      const problems = validateDoll(def);
      if (problems.length) {
        console.warn(`[mechs] ${e.id} skipped:\n` + problems.join('\n'));
        continue;
      }
      const base = dirOf(e.doll);
      for (const img of dollImages(def)) {
        const key = `doll:${e.id}:${img}`;
        if (!scene.textures.exists(key)) l.image(key, base + img);
      }
      pendingDolls.push({ entry: e, def });
    }
  });

  for (const { entry, def, key } of pendingRigs) {
    if (!scene.textures.exists(key)) {
      console.warn(`[mechs] ${entry.id}: image ${def.image} failed to load`);
      continue;
    }
    const tex = scene.textures.get(key);
    for (const p of def.parts) if (!tex.has(p.id)) tex.add(p.id, 0, p.frame.x, p.frame.y, p.frame.w, p.frame.h);
    rigs.set(entry.id, { def, texture: key });
  }

  for (const { entry, def } of pendingDolls) {
    const textures = new Map<string, string>();
    let ok = true;
    for (const img of dollImages(def)) {
      const key = `doll:${entry.id}:${img}`;
      if (!scene.textures.exists(key)) {
        console.warn(`[mechs] ${entry.id}: image ${img} failed to load`);
        ok = false;
        break;
      }
      textures.set(img, key);
    }
    if (!ok) continue;
    for (const [name, part] of Object.entries(def.parts)) {
      part.frames.forEach((f, i) => {
        const key = textures.get(f.image ?? def.image ?? '');
        if (!key) return;
        const tex = scene.textures.get(key);
        const frameName = `${name}#${i}`;
        if (!tex.has(frameName)) tex.add(frameName, 0, f.x, f.y, f.w, f.h);
      });
    }
    dolls.set(entry.id, { def, textures });
  }
}

/** Texture key + frame name for a part frame of a loaded doll. */
export function dollFrameRef(doll: LoadedDoll, part: string, frameIndex: number): { key: string; frame: string } {
  const p = doll.def.parts[part];
  const f = p.frames[frameIndex];
  const key = doll.textures.get(f.image ?? doll.def.image ?? '') ?? '__MISSING';
  return { key, frame: `${part}#${frameIndex}` };
}
