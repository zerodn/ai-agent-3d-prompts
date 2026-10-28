import { isTerminal } from "./WorkflowStateMachine.ts";
import { PRIORITY_ORDER, type Task } from "../tasks/taskTypes.ts";

export function isActive(task: Task): boolean {
  return task.phase !== "queued" && !isTerminal(task.phase);
}

export function activeCount(tasks: readonly Task[]): number {
  return tasks.filter(isActive).length;
}

/** Highest priority first, then oldest; `order` breaks ties between tasks created on the same tick. */
export function compareQueued(a: Task, b: Task, order: (t: Task) => number): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt || order(a) - order(b);
}

/** Queued tasks the orchestrator should pick up now, in order. */
export function pickNext(tasks: readonly Task[], maxConcurrent: number, order: (t: Task) => number): Task[] {
  const free = maxConcurrent - activeCount(tasks);
  if (free <= 0) return [];
  return tasks
    .filter((t) => t.phase === "queued")
    .sort((a, b) => compareQueued(a, b, order))
    .slice(0, free);
}
