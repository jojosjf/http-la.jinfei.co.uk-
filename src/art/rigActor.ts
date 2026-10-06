import Phaser from 'phaser';
import { getPose, samplePose, solvePose, subtree, weaponSide, type PartTransform, type RigDef } from '../core/rig';
import type { BattleActor } from './dollActor';
import type { LoadedRig } from './dollRegistry';

type MBody = MatterJS.BodyType;
type MConstraint = MatterJS.ConstraintType;
const M = (Phaser.Physics.Matter as unknown as { Matter: typeof MatterJS }).Matter;

interface Link {
  a: string;
  b: string;
  min: number;
  max: number;
  c: MConstraint | null;
}

interface RigActorOptions {
  flip?: boolean;
  pose?: string;
}

/** Ragdolls currently simulated, per scene, stepped by `stepRagdolls`. */
const active = new WeakMap<Phaser.Scene, Set<RigActor>>();

/**
 * Skeletal mech: alive it is posed from the pose library through forward kinematics;
 * when destroyed (or when a part is knocked off) the affected parts become Matter rigid
 * bodies joined by pin constraints with soft angle limits, like the prototype's ragdoll.
 * The scene must enable Matter physics with `autoUpdate: false` and call `stepRagdolls`.
 */
export class RigActor implements BattleActor {
  readonly node: Phaser.GameObjects.Container;
  private readonly def: RigDef;
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private facing = 1;
  private pose = 'idle';
  private time = 0;
  private bodies = new Map<string, MBody>();
  private links: Link[] = [];
  private loose = new Set<string>();
  private dead = false;
  private group = 0;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    rig: LoadedRig,
    x: number,
    y: number,
    opts: RigActorOptions = {},
  ) {
    this.def = rig.def;
    this.node = scene.add.container(x, y);
    const sorted = this.def.parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.layer - b.p.layer || a.i - b.i);
    for (const { p } of sorted) {
      const img = scene.add.image(0, 0, rig.texture, p.id).setOrigin(0.5, 0.5);
      this.images.set(p.id, img);
      this.node.add(img);
    }
    this.setFlip(Boolean(opts.flip));
    this.pose = opts.pose ?? 'idle';
    this.apply();
    this.onUpdate = (_t, delta) => this.tick(delta);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onUpdate);
  }

  get x(): number {
    return this.node.x;
  }
  get y(): number {
    return this.node.y;
  }
  get height(): number {
    return this.def.height;
  }
  get currentPose(): string {
    return this.dead ? 'down' : this.pose;
  }
  get isRagdoll(): boolean {
    return this.dead;
  }

  setFlip(flip: boolean): void {
    this.facing = flip ? -1 : 1;
    for (const img of this.images.values()) img.setFlipX(flip);
    this.apply();
  }

  setDepth(depth: number): void {
    this.node.setDepth(depth);
  }

  play(pose: string): void {
    if (this.dead) return;
    if (pose === 'down') {
      this.collapse(-this.facing, false);
      return;
    }
    this.pose = pose;
    this.time = 0;
  }

  flash(color: number): void {
    for (const img of this.images.values()) img.setTintFill(color);
  }

  unflash(): void {
    for (const img of this.images.values()) img.clearTint();
  }

  /** muzzle = weapon-arm hand (spells / shots point it forward), blade = weapon centre; world coordinates. */
  socket(name: string, dir: number): { x: number; y: number } {
    const w = weaponSide(this.def);
    const id = name === 'blade' ? 'weapon' : `forearm_hand_${w}`;
    const img = this.images.get(id) ?? this.images.get(this.def.root)!;
    const part = this.def.parts.find((p) => p.id === id);
    const reach = part ? part.h * 0.4 : 0;
    // hand end of the forearm: along the part's local +y
    const ax = -Math.sin(img.rotation) * reach;
    const ay = Math.cos(img.rotation) * reach;
    void dir;
    return { x: this.node.x + img.x + ax, y: this.node.y + img.y + ay };
  }

  ghost(): Phaser.GameObjects.Container {
    const g = this.scene.add.container(this.node.x, this.node.y).setDepth(this.node.depth - 1).setAlpha(0.45);
    for (const img of this.images.values()) {
      g.add(
        this.scene.add
          .image(img.x, img.y, img.texture.key, img.frame.name)
          .setRotation(img.rotation)
          .setFlipX(img.flipX)
          .setVisible(img.visible),
      );
    }
    return g;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onUpdate);
    this.removePhysics();
    this.node.destroy(true);
  }

  // ------------------------------------------------------------------ animation

  private tick(deltaMs: number): void {
    if (!this.node.active) return;
    const dt = (deltaMs / 1000) * this.scene.time.timeScale;
    if (!this.dead) {
      this.time += dt;
      const pose = getPose(this.def, this.pose);
      if (!pose.loop && this.time >= pose.duration && this.pose !== 'idle') {
        this.pose = 'idle';
        this.time = 0;
      }
      this.apply();
    }
    this.syncBodies();
  }

  /** Canonical (facing +1) transforms of the animated parts. */
  private solveCanonical(): PartTransform[] {
    return solvePose(this.def, samplePose(this.def, this.pose, this.time), 1, this.loose.size ? this.loose : undefined);
  }

  private apply(): void {
    if (this.dead) return;
    for (const t of this.solveCanonical()) {
      const img = this.images.get(t.id);
      if (!img) continue;
      img.setPosition(Math.round(t.x * this.facing), Math.round(t.y));
      img.setRotation(t.angle * this.facing);
    }
  }

  private syncBodies(): void {
    for (const [id, body] of this.bodies) {
      if (!this.dead && !this.loose.has(id)) continue;
      const img = this.images.get(id);
      if (!img) continue;
      img.setPosition(Math.round(body.position.x - this.node.x), Math.round(body.position.y - this.node.y));
      img.setRotation(body.angle);
    }
  }

  // ------------------------------------------------------------------ physics

  private world(): Phaser.Physics.Matter.World | null {
    const m = (this.scene as Phaser.Scene & { matter?: Phaser.Physics.Matter.MatterPhysics }).matter;
    return m?.world ?? null;
  }

  /** Creates bodies (at the current pose) for `ids` and pin constraints between them. */
  private makeBodies(ids: Set<string>, transforms: Map<string, { x: number; y: number; angle: number }>): void {
    const matter = (this.scene as Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics }).matter;
    if (!this.group) this.group = M.Body.nextGroup(true);
    for (const p of this.def.parts) {
      if (!ids.has(p.id) || this.bodies.has(p.id)) continue;
      const t = transforms.get(p.id);
      if (!t) continue;
      const body = matter.add.rectangle(t.x, t.y, Math.max(3, p.w * 0.78), Math.max(3, p.h * 0.78), {
        angle: t.angle,
        friction: 0.8,
        frictionAir: 0.02,
        restitution: 0.05,
        chamfer: { radius: 2 },
        collisionFilter: { group: this.group, category: 0x0001, mask: 0xffff },
      });
      M.Body.setMass(body, Math.max(0.3, p.mass));
      this.bodies.set(p.id, body);
    }
    const byId = new Map(this.def.parts.map((p) => [p.id, p]));
    for (const j of this.def.joints) {
      if (!ids.has(j.a) || !ids.has(j.b)) continue;
      if (this.links.some((l) => (l.a === j.a && l.b === j.b) || (l.a === j.b && l.b === j.a))) continue;
      const A = this.bodies.get(j.a)!;
      const B = this.bodies.get(j.b)!;
      const parent = byId.get(j.a)!;
      const ta = transforms.get(j.a)!;
      const lx = (j.anchor[0] - parent.x) * this.facing;
      const ly = j.anchor[1] - parent.y;
      const c = Math.cos(ta.angle);
      const s = Math.sin(ta.angle);
      const wx = ta.x + lx * c - ly * s;
      const wy = ta.y + lx * s + ly * c;
      const constraint = matter.add.constraint(A, B, 0, 1, {
        pointA: { x: wx - A.position.x, y: wy - A.position.y },
        pointB: { x: wx - B.position.x, y: wy - B.position.y },
        damping: 0.18,
      });
      const [min, max] = this.facing < 0 ? [-j.max, -j.min] : [j.min, j.max];
      this.links.push({ a: j.a, b: j.b, min, max, c: constraint });
    }
  }

  private worldTransforms(): Map<string, { x: number; y: number; angle: number }> {
    const m = new Map<string, { x: number; y: number; angle: number }>();
    for (const [id, img] of this.images) m.set(id, { x: this.node.x + img.x, y: this.node.y + img.y, angle: img.rotation });
    return m;
  }

  private cut(a: string, b: string): void {
    for (const l of this.links) {
      if (!((l.a === a && l.b === b) || (l.a === b && l.b === a)) || !l.c) continue;
      this.world()?.removeConstraint(l.c);
      l.c = null;
    }
  }

  /** Knock a part (and everything hanging from it) off a living mech, e.g. the weapon. */
  drop(partId: string, dir = -this.facing): void {
    if (this.dead || !this.world() || this.loose.has(partId)) return;
    const ids = subtree(this.def, partId);
    this.apply();
    this.makeBodies(ids, this.worldTransforms());
    for (const id of ids) {
      this.loose.add(id);
      const b = this.bodies.get(id);
      if (b) {
        M.Body.setVelocity(b, { x: dir * 2.2, y: -3 });
        M.Body.setAngularVelocity(b, dir * 0.15);
      }
    }
    this.register();
  }

  /**
   * Destroyed: the whole mech becomes a ragdoll. `dir` is the direction it is knocked towards.
   * Detachable joints (hand-held weapon) break; a severe hit also tears off the off-side arm.
   */
  collapse(dir: number, severe: boolean): void {
    if (this.dead) return;
    if (!this.world()) {
      this.dead = true;
      return;
    }
    this.apply();
    const all = new Set(this.def.parts.map((p) => p.id));
    this.makeBodies(all, this.worldTransforms());
    this.dead = true;
    for (const j of this.def.joints) if (j.detachable) this.cut(j.a, j.b);
    let severed = new Set<string>();
    if (severe) {
      const off = weaponSide(this.def) === 'l' ? 'r' : 'l';
      const arm = `upper_arm_${off}`;
      const j = this.def.joints.find((x) => (x.a === arm || x.b === arm) && (x.a === this.def.root || x.b === this.def.root));
      if (j) {
        this.cut(j.a, j.b);
        severed = subtree(this.def, arm);
      }
    }
    for (const [id, b] of this.bodies) {
      const extra = id === 'weapon' || severed.has(id) ? 1.8 : 1;
      M.Body.setVelocity(b, { x: dir * (1.6 + Math.random() * 1.2) * extra, y: -(1.5 + Math.random() * 1.5) * extra });
      M.Body.setAngularVelocity(b, dir * (0.04 + Math.random() * 0.06) * extra);
    }
    this.register();
  }

  private register(): void {
    let set = active.get(this.scene);
    if (!set) active.set(this.scene, (set = new Set()));
    set.add(this);
  }

  /** Soft joint limits (applied before each physics step), as in the prototype. */
  preStep(): void {
    for (const l of this.links) {
      if (!l.c) continue;
      const A = this.bodies.get(l.a);
      const B = this.bodies.get(l.b);
      if (!A || !B) continue;
      const rel = Math.atan2(Math.sin(B.angle - A.angle), Math.cos(B.angle - A.angle));
      const target = Math.max(l.min, Math.min(l.max, rel));
      if (Math.abs(target - rel) > 0.002) {
        const v = Math.max(-0.12, Math.min(0.12, B.angularVelocity + (target - rel) * 0.025));
        M.Body.setAngularVelocity(B, v);
      }
    }
  }

  /** Pull pinned points back together after contacts so joints never visibly separate. */
  postStep(): void {
    for (let pass = 0; pass < 6; pass++) {
      for (const l of this.links) {
        if (!l.c) continue;
        const A = l.c.bodyA as MBody;
        const B = l.c.bodyB as MBody;
        const pa = l.c.pointA;
        const pb = l.c.pointB;
        const ax = A.position.x + pa.x;
        const ay = A.position.y + pa.y;
        const bx = B.position.x + pb.x;
        const by = B.position.y + pb.y;
        const total = A.inverseMass + B.inverseMass;
        if (!total) continue;
        const wa = A.inverseMass / total;
        const wb = B.inverseMass / total;
        M.Body.setPosition(A, { x: A.position.x + (bx - ax) * wa, y: A.position.y + (by - ay) * wa });
        M.Body.setPosition(B, { x: B.position.x - (bx - ax) * wb, y: B.position.y - (by - ay) * wb });
      }
    }
  }

  private removePhysics(): void {
    const w = this.world();
    if (w) {
      for (const l of this.links) if (l.c) w.removeConstraint(l.c);
      for (const b of this.bodies.values()) w.remove(b);
    }
    this.links = [];
    this.bodies.clear();
    active.get(this.scene)?.delete(this);
  }
}

/** Static ground for ragdolls to land on. */
export function addGround(scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics }, y: number, width: number): void {
  scene.matter.add.rectangle(width / 2, y + 10, width * 4, 20, { isStatic: true, friction: 0.9 });
}

/**
 * Advance every ragdoll in the scene. Call from the scene's update with the frame delta;
 * honours `scene.time.timeScale` (fast-forward) with fixed 1/120 s substeps.
 */
export function stepRagdolls(scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics }, deltaMs: number): void {
  const set = active.get(scene);
  if (!set || set.size === 0) return;
  const sim = Math.min(250, deltaMs * scene.time.timeScale);
  const steps = Math.max(1, Math.round(sim / (1000 / 120)));
  for (let i = 0; i < steps; i++) {
    for (const a of set) a.preStep();
    scene.matter.world.step(1000 / 120);
    for (const a of set) a.postStep();
  }
}
