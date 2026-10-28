import type { AgentId, AgentState } from "../agents/agentTypes.ts";
import type { AgentEvent } from "../events/eventTypes.ts";
import type { CreateTaskInput, Task } from "../tasks/taskTypes.ts";

export type SimulationStatus = "ready" | "running" | "paused";
export type CommLinkKind = "message" | "assign" | "report";

export interface CommLink {
  id: string;
  from: AgentId;
  to: AgentId;
  kind: CommLinkKind;
  /** Backend clock, seconds. */
  startedAt: number;
  endsAt: number;
}

/** Everything the 3D layer and UI need to draw one moment of the world. */
export interface WorldSnapshot {
  clock: number;
  status: SimulationStatus;
  speed: number;
  agents: AgentState[];
  tasks: Task[];
  links: CommLink[];
}

export type BackendKind = "mock" | "websocket";

/**
 * The only seam between the world (3D + UI) and whatever drives it.
 * Implement this to plug in a real orchestrator; nothing above it needs to change.
 */
export interface AgentBackend {
  readonly kind: BackendKind;
  readonly label: string;
  /** True when no real inference happens. The UI must say so. */
  readonly simulated: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  reset(): Promise<void>;
  setSpeed(multiplier: number): Promise<void>;
  submitTask(input: CreateTaskInput): Promise<Task>;
  pauseAgent(id: AgentId): Promise<void>;
  resumeAgent(id: AgentId): Promise<void>;
  getSnapshot(): WorldSnapshot | null;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  subscribeSnapshot(listener: (snapshot: WorldSnapshot) => void): () => void;
}
