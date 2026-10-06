import Phaser from 'phaser';
import { dollImages, validateDoll, type DollDef } from '../core/doll';

export interface LoadedDoll {
  def: DollDef;
  /** image file name (as written in the doll json) -> Phaser texture key */
  textures: Map<string, string>;
}

export interface MechIndexEntry {
  id: string;
  /** Path (relative to the site root) of the paper-doll json. */
  doll?: string;
  /** Optional 32x32 map icon PNG that replaces the placeholder `unit_<id>`. */
  icon?: string;
}

export interface MechIndex {
  dolls: MechIndexEntry[];
}

const dolls = new Map<string, LoadedDoll>();

/** Dolls that finished loading, by unit id. Filled once by `loadMechAssets`. */
export const dollRegistry = {
  get: (id: string): LoadedDoll | undefined => dolls.get(id),
  has: (id: string): boolean => dolls.has(id),
  ids: (): string[] => [...dolls.keys()],
  clear: (): void => dolls.clear(),
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
 * Loads `mechs/index.json` and every doll / icon it lists. Missing index = no imported art,
 * which is fine: callers fall back to procedural placeholders. Never throws.
 */
export async function loadMechAssets(scene: Phaser.Scene): Promise<void> {
  dolls.clear();
  await loadPass(scene, (l) => l.json('mechIndex', 'mechs/index.json'));
  if (!scene.cache.json.exists('mechIndex')) return;
  const index = scene.cache.json.get('mechIndex') as Partial<MechIndex>;
  const entries = (index.dolls ?? []).filter((e) => e && typeof e.id === 'string');
  if (entries.length === 0) return;

  await loadPass(scene, (l) => {
    for (const e of entries) {
      if (e.doll) l.json(`doll:${e.id}`, e.doll);
      if (e.icon) l.image(`unit_${e.id}`, e.icon);
    }
  });

  const pending: Array<{ entry: MechIndexEntry; def: DollDef; base: string }> = [];
  await loadPass(scene, (l) => {
    for (const e of entries) {
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
      pending.push({ entry: e, def, base });
    }
  });

  for (const { entry, def } of pending) {
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
