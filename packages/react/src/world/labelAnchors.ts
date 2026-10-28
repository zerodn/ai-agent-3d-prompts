import type { AgentId } from "@agent-world/core";

/** Screen-space anchors for DOM speech bubbles, written in useFrame, read by a single rAF loop. */
export interface LabelAnchor {
  x: number;
  y: number;
  scale: number;
  onScreen: boolean;
}

export const labelAnchors = new Map<AgentId, LabelAnchor>();

/** Rendered (damped) agent positions, written by the 3D layer; used by camera follow, comm arcs and UI focus. */
export const agentRenderPositions = new Map<AgentId, { x: number; y: number; z: number }>();

export function writeAnchor(id: AgentId, x: number, y: number, scale: number, onScreen: boolean): void {
  const a = labelAnchors.get(id);
  if (a) {
    a.x = x;
    a.y = y;
    a.scale = scale;
    a.onScreen = onScreen;
  } else {
    labelAnchors.set(id, { x, y, scale, onScreen });
  }
}
