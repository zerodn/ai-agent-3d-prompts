import type { AgentId } from "../agents/agentTypes.ts";

/** The fixed event vocabulary shared by the simulation and any real backend. */
export const EVENT_TYPES = [
  "system.ready", "system.started", "system.paused", "system.resumed", "system.reset", "system.speed_changed",
  "task.created", "task.assigned", "task.status_changed", "task.completed", "task.failed", "task.blocked", "task.unblocked",
  "plan.created", "research.completed", "implementation.started", "implementation.submitted",
  "qa.started", "qa.passed", "qa.failed", "review.started", "review.approved", "review.changes_requested",
  "agent.message", "agent.arrived", "agent.paused", "agent.resumed", "agent.ambient",
] as const;

export type AgentEventType = (typeof EVENT_TYPES)[number];
export type EventSeverity = "info" | "success" | "warning" | "error";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  /** Wall-clock milliseconds. */
  timestamp: number;
  /** Backend clock, seconds. */
  simTime: number;
  agentId?: AgentId;
  targetAgentId?: AgentId;
  taskId?: string;
  message: string;
  severity: EventSeverity;
  /** Belongs in the human-facing activity feed. */
  feed: boolean;
  metadata?: Record<string, unknown>;
}

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

export function isAgentEventType(value: unknown): value is AgentEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

/** An agent-to-agent communication (drawn as an arc, counted as a message). */
export function isCommunication(event: AgentEvent): boolean {
  return event.targetAgentId !== undefined && (event.type === "agent.message" || event.type === "task.assigned");
}
