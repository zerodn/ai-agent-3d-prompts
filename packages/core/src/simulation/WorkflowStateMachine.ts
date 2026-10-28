import { PHASE_STATUS, type Task, type WorkflowPhase, type WorkflowSignal } from "../tasks/taskTypes.ts";
import { SIMULATION_CONFIG, type SimulationConfig } from "./simulationConfig.ts";

const TRANSITIONS: Partial<Record<WorkflowPhase, Partial<Record<WorkflowSignal, WorkflowPhase>>>> = {
  queued: { picked_up: "intake" },
  intake: { delegated: "planning" },
  planning: { plan_ready: "research" },
  research: { findings_published: "implementation" },
  implementation: { submitted: "testing" },
  testing: { tests_passed: "review", tests_failed: "implementation" },
  review: { approved: "done", changes_requested: "implementation" },
};

const REWORK_SIGNALS = new Set<WorkflowSignal>(["tests_failed", "changes_requested"]);

export function isTerminal(phase: WorkflowPhase): boolean {
  return phase === "done" || phase === "failed";
}

export function nextPhase(phase: WorkflowPhase, signal: WorkflowSignal): WorkflowPhase | null {
  if (isTerminal(phase)) return null;
  if (signal === "abort") return "failed";
  return TRANSITIONS[phase]?.[signal] ?? null;
}

export function canTransition(phase: WorkflowPhase, signal: WorkflowSignal): boolean {
  return nextPhase(phase, signal) !== null;
}

/** Pure: returns a new task. Throws on an illegal transition. */
export function applySignal(task: Task, signal: WorkflowSignal, at: number, config: SimulationConfig = SIMULATION_CONFIG): Task {
  const to = nextPhase(task.phase, signal);
  if (to === null) throw new Error(`Illegal transition: ${task.phase} --${signal}-->`);
  const [phaseStart] = config.phaseProgress[to];
  const rework = REWORK_SIGNALS.has(signal);
  return {
    ...task,
    phase: to,
    status: PHASE_STATUS[to],
    iteration: to === "implementation" ? task.iteration + 1 : task.iteration,
    progress: to === "done" ? 1 : rework ? phaseStart : Math.max(task.progress, phaseStart),
    history: [...task.history, { from: task.phase, to, signal, at }],
    completedAt: isTerminal(to) ? at : task.completedAt,
    blockedReason: null,
    updatedAt: at,
  };
}
