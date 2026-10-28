import type { AgentId, AgentState, WorldSnapshot } from "@agent-world/core";

/**
 * Mutable per-frame buffer. Written on every snapshot (30 Hz), read by the 3D layer inside useFrame.
 * Never drives React renders.
 */
export const liveWorld: {
  snapshot: WorldSnapshot | null;
  agents: Map<AgentId, AgentState>;
  /** performance.now() when the last snapshot arrived. */
  receivedAt: number;
} = {
  snapshot: null,
  agents: new Map(),
  receivedAt: 0,
};

export function writeLiveWorld(snapshot: WorldSnapshot): void {
  liveWorld.snapshot = snapshot;
  liveWorld.receivedAt = typeof performance !== "undefined" ? performance.now() : 0;
  for (const agent of snapshot.agents) liveWorld.agents.set(agent.id, agent);
}
