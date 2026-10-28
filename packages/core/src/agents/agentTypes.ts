import type { LocationId, Vec2 } from "../simulation/worldLayout.ts";

export const AGENT_IDS = ["orion", "iris", "piper", "kai", "quinn", "rex"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type AgentRole = "orchestrator" | "researcher" | "product_manager" | "engineer" | "qa" | "reviewer";

export type AgentStatus = "idle" | "walking" | "working" | "thinking" | "communicating" | "success" | "error";

/** Static description of an agent. Hosts may restyle these (name, colour) without touching the engine. */
export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: AgentRole;
  roleLabel: string;
  tagline: string;
  color: string;
  home: LocationId;
  /** Index 0..5 used for shared ring locations so agents never overlap. */
  seat: number;
}

/** Serialisable runtime state; a real backend sends exactly this shape. */
export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  activity: string;
  currentTaskId: string | null;
  progress: number;
  location: LocationId | null;
  destination: LocationId | null;
  position: Vec2;
  heading: number;
  path: Vec2[];
  facingAgentId: AgentId | null;
  paused: boolean;
}
