import type { AgentId } from "../agents/agentTypes.ts";

export type WorkflowPhase = "queued" | "intake" | "planning" | "research" | "implementation" | "testing" | "review" | "done" | "failed";
export type TaskStatus = "queued" | "assigned" | "in_progress" | "testing" | "review" | "blocked" | "completed" | "failed";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export type WorkflowSignal =
  | "picked_up"
  | "delegated"
  | "plan_ready"
  | "findings_published"
  | "submitted"
  | "tests_passed"
  | "tests_failed"
  | "approved"
  | "changes_requested"
  | "abort";

export const PHASE_STATUS: Record<WorkflowPhase, TaskStatus> = {
  queued: "queued",
  intake: "assigned",
  planning: "in_progress",
  research: "in_progress",
  implementation: "in_progress",
  testing: "testing",
  review: "review",
  done: "completed",
  failed: "failed",
};

export const PHASE_LABEL: Record<WorkflowPhase, string> = {
  queued: "Queued",
  intake: "Intake",
  planning: "Planning",
  research: "Research",
  implementation: "Implementation",
  testing: "Testing",
  review: "Code review",
  done: "Done",
  failed: "Failed",
};

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface PhaseTransition {
  from: WorkflowPhase;
  to: WorkflowPhase;
  signal: WorkflowSignal;
  /** Backend clock, seconds. */
  at: number;
}

export interface TaskScript {
  /** Implementation iterations (1-based) on which QA must fail. */
  qaFailsOn?: number[];
  /** Implementation iterations (1-based) on which review must request changes. */
  reviewChangesOn?: number[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  phase: WorkflowPhase;
  assignedAgentId: AgentId | null;
  progress: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  iteration: number;
  subtasks: Subtask[];
  findings: string[];
  history: PhaseTransition[];
  isDemo: boolean;
  preferredAgentId: AgentId | null;
  blockedReason: string | null;
  script?: TaskScript;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  preferredAgentId?: AgentId;
  isDemo?: boolean;
  script?: TaskScript;
}
