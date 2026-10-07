import { describe, expect, it } from 'vitest';
import { getPose, heldParts, samplePose, solvePose, subtree, validateRig, weaponSide, type RigDef } from '../../src/core/rig';

/** Torso at the origin's top, an arm hanging from its right edge, a weapon in the hand. */
function rig(): RigDef {
  const frame = { x: 0, y: 0, w: 10, h: 10 };
  return {
    id: 't',
    name: 'T',
    version: 2,
    image: 't.png',
    root: 'torso',
    height: 40,
    parts: [
      { id: 'torso', frame, x: 0, y: -30, w: 20, h: 20, layer: 0, mass: 5 },
      { id: 'upper_arm_r', frame, x: 12, y: -25, w: 4, h: 10, layer: 1, mass: 1 },
      { id: 'weapon', frame, x: 12, y: -14, w: 2, h: 12, layer: 2, mass: 1 },
    ],
    joints: [
      { a: 'torso', b: 'upper_arm_r', anchor: [12, -30], min: -1, max: 1, detachable: false },
      { a: 'weapon', b: 'upper_arm_r', anchor: [12, -20], min: -0.3, max: 0.3, detachable: true },
    ],
  };
}

const at = (ts: ReturnType<typeof solvePose>, id: string) => ts.find((t) => t.id === id)!;

describe('validateRig', () => {
  it('accepts a connected rig and reports broken ones', () => {
    expect(validateRig(rig())).toEqual([]);
    const r = rig();
    r.joints.pop();
    expect(validateRig(r).some((e) => e.includes('weapon is not connected'))).toBe(true);
    const r2 = rig();
    r2.root = 'nope';
    expect(validateRig(r2).some((e) => e.includes('root nope'))).toBe(true);
  });
});

describe('solvePose', () => {
  it('reproduces the rest layout with zero angles', () => {
    const ts = solvePose(rig(), { angles: {}, dx: 0, dy: 0 });
    expect(at(ts, 'upper_arm_r')).toMatchObject({ x: 12, y: -25, angle: 0 });
    expect(at(ts, 'weapon').x).toBeCloseTo(12);
    expect(at(ts, 'weapon').y).toBeCloseTo(-14);
  });

  it('rotates a child about the shared anchor and keeps the anchor attached', () => {
    const ts = solvePose(rig(), { angles: { upper_arm_r: -Math.PI / 2 }, dx: 0, dy: 0 });
    const arm = at(ts, 'upper_arm_r');
    // arm hung 5px below the shoulder anchor; rotated -90deg it points 5px forward (+x)
    expect(arm.x).toBeCloseTo(17);
    expect(arm.y).toBeCloseTo(-30);
    // the weapon inherits the arm's rotation (local angle 0)
    expect(at(ts, 'weapon').angle).toBeCloseTo(-Math.PI / 2);
  });

  it('applies root offset and mirrors for facing -1', () => {
    const ts = solvePose(rig(), { angles: { torso: 0.2 }, dx: 3, dy: 1 }, -1);
    expect(at(ts, 'torso')).toMatchObject({ x: -3, y: -29, angle: -0.2 });
  });

  it('leaves out skipped subtrees', () => {
    const ts = solvePose(rig(), { angles: {}, dx: 0, dy: 0 }, 1, subtree(rig(), 'upper_arm_r'));
    expect(ts.map((t) => t.id)).toEqual(['torso']);
  });
});

describe('poses', () => {
  it('resolves weapon-side aliases and interpolates between keys', () => {
    const r = rig();
    expect(weaponSide(r)).toBe('r');
    r.poses = { swing: { duration: 1, loop: false, keys: [{ t: 0, a: {} }, { t: 1, a: { upper_arm_W: -2, upper_arm_O: 1 }, dy: 4 }] } };
    const mid = samplePose(r, 'swing', 0.5);
    expect(mid.angles.upper_arm_r).toBeCloseTo(-1);
    expect(mid.angles.upper_arm_l).toBeCloseTo(0.5);
    expect(mid.dy).toBeCloseTo(2);
    expect(samplePose(r, 'swing', 5).angles.upper_arm_r).toBeCloseTo(-2);
  });

  it('loops looping poses and falls back to idle for unknown names', () => {
    const r = rig();
    const period = getPose(r, 'idle').duration;
    const a = samplePose(r, 'idle', 0.4);
    const b = samplePose(r, 'idle', 0.4 + period);
    expect(b.dy).toBeCloseTo(a.dy);
    expect(samplePose(r, 'nope', 0.4)).toEqual(a);
  });
});

describe('held items', () => {
  it('finds detachable items held by forearms and picks the forward one as the weapon side', () => {
    const frame = { x: 0, y: 0, w: 4, h: 4 };
    const part = (id: string, x: number) => ({ id, frame, x, y: -20, w: 4, h: 4, layer: 0, mass: 1 });
    const r: RigDef = {
      id: 'm', name: 'M', version: 2, image: 'm.png', root: 'torso', height: 40,
      parts: [part('torso', 0), part('forearm_hand_l', -10), part('forearm_hand_r', 10), part('sickle_l', -14), part('sickle_r', 16)],
      joints: [
        { a: 'torso', b: 'forearm_hand_l', anchor: [-6, -20], min: -1, max: 1, detachable: false },
        { a: 'torso', b: 'forearm_hand_r', anchor: [6, -20], min: -1, max: 1, detachable: false },
        { a: 'forearm_hand_l', b: 'sickle_l', anchor: [-12, -20], min: -0.3, max: 0.3, detachable: true },
        { a: 'forearm_hand_r', b: 'sickle_r', anchor: [13, -20], min: -0.3, max: 0.3, detachable: true },
      ],
      poses: { cut: { duration: 1, loop: false, keys: [{ t: 0, a: {} }, { t: 1, a: { held_W: 1, held_O: -1 } }] } },
    };
    expect(heldParts(r)).toEqual({ l: 'sickle_l', r: 'sickle_r' });
    expect(weaponSide(r)).toBe('r');
    const end = samplePose(r, 'cut', 1).angles;
    expect(end.sickle_r).toBeCloseTo(1);
    expect(end.sickle_l).toBeCloseTo(-1);
  });
});
