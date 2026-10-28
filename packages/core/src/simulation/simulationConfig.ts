import type { WorkflowPhase } from "../tasks/taskTypes.ts";

/** Every timing and limit of the simulation lives here. Durations are simulation seconds. */
export interface SimulationConfig {
  seed: number;
  tickHz: number;
  maxStepSeconds: number;
  walkSpeed: number;
  speeds: readonly number[];
  defaultSpeed: number;
  autoStart: boolean;
  maxConcurrentTasks: number;
  maxIterations: number;
  qaFailRate: number;
  reviewChangeRate: number;
  returnHomeDelay: number;
  ambient: { minGap: number; maxGap: number; minStay: number; maxStay: number };
  linkDuration: number;
  durations: {
    intakeThink: number;
    assign: number;
    breakdown: number;
    coordinate: number;
    research: number;
    publish: number;
    implement: number;
    fix: number;
    submit: number;
    test: number;
    review: number;
    report: number;
    celebrate: number;
    errorEmote: number;
    announce: number;
  };
  phaseProgress: Record<WorkflowPhase, readonly [number, number]>;
  maxEvents: number;
  /** Finished (done/failed) tasks kept in memory; older ones are dropped so always-on screens stay bounded. */
  maxRetainedTasks: number;
}

export const SIMULATION_CONFIG: SimulationConfig = {
  seed: 20261018,
  tickHz: 30,
  maxStepSeconds: 0.1,
  walkSpeed: 2.4,
  speeds: [0.5, 1, 2, 4],
  defaultSpeed: 1,
  autoStart: true,
  maxConcurrentTasks: 2,
  maxIterations: 3,
  qaFailRate: 0.3,
  reviewChangeRate: 0.25,
  returnHomeDelay: 2.5,
  ambient: { minGap: 18, maxGap: 40, minStay: 6, maxStay: 10 },
  linkDuration: 2.4,
  durations: {
    intakeThink: 1.8,
    assign: 1.5,
    breakdown: 4.2,
    coordinate: 2,
    research: 5.5,
    publish: 1.4,
    implement: 6.5,
    fix: 4,
    submit: 1.4,
    test: 4.5,
    review: 4,
    report: 1.5,
    celebrate: 1.4,
    errorEmote: 1.6,
    announce: 2,
  },
  phaseProgress: {
    queued: [0, 0],
    intake: [0, 0.08],
    planning: [0.08, 0.2],
    research: [0.2, 0.36],
    implementation: [0.36, 0.62],
    testing: [0.62, 0.78],
    review: [0.78, 0.94],
    done: [1, 1],
    failed: [0, 0],
  },
  maxEvents: 400,
  maxRetainedTasks: 40,
};

export type SimulationConfigOverrides = Partial<Omit<SimulationConfig, "durations" | "ambient" | "phaseProgress">> & {
  durations?: Partial<SimulationConfig["durations"]>;
  ambient?: Partial<SimulationConfig["ambient"]>;
  phaseProgress?: Partial<SimulationConfig["phaseProgress"]>;
};

/** Merge host overrides (for example a faster demo) onto the defaults. */
export function resolveConfig(overrides: SimulationConfigOverrides = {}): SimulationConfig {
  return {
    ...SIMULATION_CONFIG,
    ...overrides,
    durations: { ...SIMULATION_CONFIG.durations, ...overrides.durations },
    ambient: { ...SIMULATION_CONFIG.ambient, ...overrides.ambient },
    phaseProgress: { ...SIMULATION_CONFIG.phaseProgress, ...overrides.phaseProgress },
  };
}
