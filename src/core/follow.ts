/**
 * Secondary motion for hair, robes, sleeves and ribbons: each such part carries an extra local
 * angle driven by a damped spring. Horizontal acceleration of the body makes the part lag behind
 * (positive angle swings a hanging part towards -x, i.e. backwards), plus a light idle breeze.
 */
export interface FollowState {
  angle: number;
  vel: number;
}

export interface FollowOptions {
  stiffness: number;
  damping: number;
  /** Radians of lag per px/s² of horizontal acceleration. */
  gain: number;
  /** Hard limit on the extra angle. */
  max: number;
}

export const FOLLOW_DEFAULTS: FollowOptions = { stiffness: 55, damping: 7, gain: 0.0006, max: 0.9 };

/** Parts that follow by default, from their names. */
export const FOLLOW_PART = /^(hair|robe|skirt|sleeve|ribbon|sash|tassel|cape|scarf|tail_ribbon)/;

/** Advance one spring by dt seconds given the attachment's horizontal acceleration (px/s², facing-corrected). */
export function stepFollow(s: FollowState, accelX: number, dt: number, o: FollowOptions = FOLLOW_DEFAULTS): FollowState {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  let { angle, vel } = s;
  const ax = Math.max(-4000, Math.min(4000, accelX));
  for (let i = 0; i < steps; i++) {
    const acc = -o.stiffness * angle - o.damping * vel + o.gain * ax * o.stiffness;
    vel += acc * h;
    angle += vel * h;
    if (angle > o.max) {
      angle = o.max;
      vel = Math.min(0, vel);
    } else if (angle < -o.max) {
      angle = -o.max;
      vel = Math.max(0, vel);
    }
  }
  return { angle, vel };
}

/** Gentle breeze so cloth is never perfectly still (phase differs per part). */
export function breeze(time: number, phase: number): number {
  return 0.05 * Math.sin(time * 2.1 + phase) + 0.02 * Math.sin(time * 3.7 + phase * 1.7);
}
