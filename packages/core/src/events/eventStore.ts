import type { AgentId } from "../agents/agentTypes.ts";
import { isCommunication, type AgentEvent } from "./eventTypes.ts";

/** Pure selectors over an event log (oldest first). */

export function appendEvents(log: readonly AgentEvent[], incoming: readonly AgentEvent[], max: number): AgentEvent[] {
  const next = log.concat(incoming);
  return next.length > max ? next.slice(next.length - max) : next;
}

export function feedEvents(log: readonly AgentEvent[]): AgentEvent[] {
  return log.filter((e) => e.feed);
}

export function messageEvents(log: readonly AgentEvent[]): AgentEvent[] {
  return log.filter(isCommunication);
}

export function eventsForAgent(log: readonly AgentEvent[], agentId: AgentId): AgentEvent[] {
  return log.filter((e) => e.feed && (e.agentId === agentId || e.targetAgentId === agentId));
}

export function communicationsForAgent(log: readonly AgentEvent[], agentId: AgentId): AgentEvent[] {
  return log.filter((e) => isCommunication(e) && (e.agentId === agentId || e.targetAgentId === agentId));
}

export function eventsForTask(log: readonly AgentEvent[], taskId: string): AgentEvent[] {
  return log.filter((e) => e.taskId === taskId);
}

/** The newest `count` events, newest first. */
export function latest(log: readonly AgentEvent[], count: number): AgentEvent[] {
  return log.slice(Math.max(0, log.length - count)).reverse();
}
