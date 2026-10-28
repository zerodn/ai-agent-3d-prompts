import { isTerminal } from "../simulation/WorkflowStateMachine.ts";
import { TASK_BACKLOG } from "./taskBacklog.ts";
import type { CreateTaskInput, Task } from "./taskTypes.ts";

export const DEMO_TASK: CreateTaskInput = {
  title: "Build a user authentication API with JWT support",
  description:
    "Register and login endpoints, short-lived access tokens with refresh-token rotation, and middleware that protects private routes.",
  priority: "high",
  isDemo: true,
  script: { qaFailsOn: [1], reviewChangesOn: [] },
};

export const TASK_SUGGESTIONS: readonly string[] = [
  DEMO_TASK.title,
  ...TASK_BACKLOG.filter((t) => !t.script).slice(0, 4).map((t) => t.title),
];

/** Deterministic when `rng` is seeded; defaults to Math.random for UI "Surprise me". */
export function pickRandomTask(exclude: readonly string[] = [], rng: () => number = Math.random): CreateTaskInput {
  const pool = TASK_BACKLOG.filter((t) => !exclude.includes(t.title));
  const source = pool.length ? pool : TASK_BACKLOG;
  return source[Math.floor(rng() * source.length)];
}

export function isTaskActive(task: Task): boolean {
  return task.phase !== "queued" && !isTerminal(task.phase);
}

export function isTaskPending(task: Task): boolean {
  return !isTerminal(task.phase);
}

const GROUP: Record<string, number> = { active: 0, queued: 1, done: 2 };

function taskGroup(task: Task): number {
  if (isTerminal(task.phase)) return GROUP.done;
  return task.phase === "queued" ? GROUP.queued : GROUP.active;
}

/** Active first, then queued, then done; newest first within a group. */
export function sortTasksForList(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => taskGroup(a) - taskGroup(b) || b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

export type TaskFilter = "all" | "active" | "queued" | "done";

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  switch (filter) {
    case "active":
      return tasks.filter(isTaskActive);
    case "queued":
      return tasks.filter((t) => t.phase === "queued");
    case "done":
      return tasks.filter((t) => isTerminal(t.phase));
    default:
      return [...tasks];
  }
}
