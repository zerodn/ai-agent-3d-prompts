import type { AgentId } from "../agents/agentTypes.ts";
import type { AgentEvent } from "../events/eventTypes.ts";
import type { CreateTaskInput } from "../tasks/taskTypes.ts";
import type { WorldSnapshot } from "./AgentBackend.ts";

/** WebSocket wire protocol (JSON). A real server implements the server side of this. */

export type BackendCommand =
  | { name: "start" | "stop" | "pause" | "resume" | "reset" }
  | { name: "setSpeed"; multiplier: number }
  | { name: "submitTask"; input: CreateTaskInput }
  | { name: "pauseAgent" | "resumeAgent"; agentId: AgentId };

export interface CommandMessage {
  type: "command";
  id: string;
  command: BackendCommand;
}

export type ServerMessage =
  | { type: "event"; event: AgentEvent }
  | { type: "snapshot"; snapshot: WorldSnapshot }
  | { type: "ack"; id: string; ok: true; result?: unknown }
  | { type: "ack"; id: string; ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Shallow structural check; trusts the server for nested shapes. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;
  switch (data.type) {
    case "event":
      return isRecord(data.event) ? (data as unknown as ServerMessage) : null;
    case "snapshot":
      return isRecord(data.snapshot) ? (data as unknown as ServerMessage) : null;
    case "ack":
      return typeof data.id === "string" && typeof data.ok === "boolean" ? (data as unknown as ServerMessage) : null;
    default:
      return null;
  }
}
