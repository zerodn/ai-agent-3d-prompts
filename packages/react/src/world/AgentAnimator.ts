import type { AgentStatus } from "@agent-world/core";

/** Joint angles (radians) and offsets (metres) applied to a procedural robot. */
export interface Pose {
  bounce: number;
  lean: number;
  headX: number;
  headY: number;
  headZ: number;
  armLX: number;
  armRX: number;
  armLZ: number;
  armRZ: number;
  legLX: number;
  legRX: number;
}

const KEYS: (keyof Pose)[] = ["bounce", "lean", "headX", "headY", "headZ", "armLX", "armRX", "armLZ", "armRZ", "legLX", "legRX"];

export function emptyPose(): Pose {
  return { bounce: 0, lean: 0, headX: 0, headY: 0, headZ: 0, armLX: 0, armRX: 0, armLZ: 0, armRZ: 0, legLX: 0, legRX: 0 };
}

type PoseFn = (out: Pose, t: number, walkPhase: number) => void;

/** Pure pose functions, one per animation state. They write into `out` to avoid per-frame allocation. */
const POSES: Record<AgentStatus, PoseFn> = {
  idle: (o, t) => {
    o.bounce = Math.sin(t * 1.8) * 0.012;
    o.headY = Math.sin(t * 0.45) * 0.22;
    o.headX = Math.sin(t * 0.7) * 0.04;
    o.armLX = Math.sin(t * 1.8) * 0.03;
    o.armRX = -Math.sin(t * 1.8) * 0.03;
    o.armLZ = -0.08;
    o.armRZ = 0.08;
  },
  walking: (o, _t, p) => {
    const s = Math.sin(p);
    o.legLX = s * 0.62;
    o.legRX = -s * 0.62;
    o.armLX = -s * 0.5;
    o.armRX = s * 0.5;
    o.armLZ = -0.1;
    o.armRZ = 0.1;
    o.bounce = Math.abs(Math.cos(p)) * 0.045;
    o.lean = 0.08;
  },
  working: (o, t) => {
    o.lean = 0.22;
    o.headX = 0.22 + Math.sin(t * 1.3) * 0.03;
    o.armLX = -1.15 + Math.sin(t * 17) * 0.07;
    o.armRX = -1.15 + Math.sin(t * 17 + 1.7) * 0.07;
    o.armLZ = 0.18;
    o.armRZ = -0.18;
    o.bounce = Math.sin(t * 2.2) * 0.006;
  },
  thinking: (o, t) => {
    o.headZ = 0.22;
    o.headX = -0.12;
    o.headY = Math.sin(t * 0.6) * 0.1;
    o.armRX = -2.05;
    o.armRZ = -0.32;
    o.armLX = -0.25;
    o.armLZ = 0.35;
    o.bounce = Math.sin(t * 1.5) * 0.01;
  },
  communicating: (o, t) => {
    o.armRX = -0.95 + Math.sin(t * 4.2) * 0.35;
    o.armRZ = 0.25 + Math.sin(t * 2.1) * 0.1;
    o.armLX = -0.45 + Math.sin(t * 3.1 + 1) * 0.2;
    o.armLZ = -0.15;
    o.headY = Math.sin(t * 1.9) * 0.12;
    o.headX = Math.sin(t * 3.7) * 0.05;
    o.bounce = Math.abs(Math.sin(t * 4.2)) * 0.015;
  },
  success: (o, t) => {
    o.bounce = Math.abs(Math.sin(t * 8.5)) * 0.13;
    o.armLX = -2.75;
    o.armRX = -2.75;
    o.armLZ = -0.35 + Math.sin(t * 8.5) * 0.1;
    o.armRZ = 0.35 - Math.sin(t * 8.5) * 0.1;
    o.headX = -0.2;
  },
  error: (o, t) => {
    o.lean = 0.32;
    o.headX = 0.48;
    o.headZ = Math.sin(t * 1.2) * 0.06;
    o.armLX = 0.1;
    o.armRX = 0.1;
    o.armLZ = 0.04;
    o.armRZ = -0.04;
    o.bounce = -0.035;
  },
};

const STATES = Object.keys(POSES) as AgentStatus[];

/**
 * Keeps a weight per state, damps weights towards the active one with delta time,
 * and returns the weighted sum of pose functions. Allocation-free per frame.
 */
export class AgentAnimator {
  readonly weights: Record<AgentStatus, number> = { idle: 1, walking: 0, working: 0, thinking: 0, communicating: 0, success: 0, error: 0 };
  private readonly scratch = emptyPose();
  readonly pose = emptyPose();
  private time = Math.random() * 10;
  private walkPhase = 0;

  /** `speedFactor` < 1 freezes animation (paused agent / paused sim). `walkSpeed` is metres per second. */
  update(status: AgentStatus, delta: number, speedFactor: number, walkSpeed: number): Pose {
    const dt = delta * speedFactor;
    this.time += dt;
    this.walkPhase += dt * (2.6 + walkSpeed * 2.4);
    const k = 1 - Math.exp(-9 * delta);
    let total = 0;
    for (const s of STATES) {
      const target = s === status ? 1 : 0;
      this.weights[s] += (target - this.weights[s]) * k;
      total += this.weights[s];
    }
    const pose = this.pose;
    for (const key of KEYS) pose[key] = 0;
    for (const s of STATES) {
      const w = this.weights[s] / (total || 1);
      if (w < 0.002) continue;
      const scratch = this.scratch;
      for (const key of KEYS) scratch[key] = 0;
      POSES[s](scratch, this.time, this.walkPhase);
      for (const key of KEYS) pose[key] += scratch[key] * w;
    }
    return pose;
  }
}
