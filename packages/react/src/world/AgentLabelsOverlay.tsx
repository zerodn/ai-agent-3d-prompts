"use client";

import { AGENTS, type AgentId, type AgentState } from "@agent-world/core";
import { useEffect, useRef } from "react";
import { useWorldStore } from "../state/useWorldStore";
import { labelAnchors } from "./labelAnchors";

function bubbleVisible(agent: AgentState | undefined, selected: boolean, hovered: boolean, speech: boolean): boolean {
  if (!agent) return false;
  if (selected || hovered || agent.paused) return true;
  return speech && (agent.status === "communicating" || agent.status === "success" || agent.status === "error");
}

/**
 * DOM speech bubbles over the canvas (not drei <Html>, which breaks under React 19 StrictMode).
 * Content comes from the throttled store; positions come from `labelAnchors` via one rAF loop.
 */
export function AgentLabelsOverlay() {
  const agents = useWorldStore((s) => s.agents);
  const selection = useWorldStore((s) => s.selection);
  const hovered = useWorldStore((s) => s.hovered);
  const speech = useWorldStore((s) => s.overlays.speech);
  const nodes = useRef(new Map<AgentId, HTMLDivElement>());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      for (const [id, el] of nodes.current) {
        const a = labelAnchors.get(id);
        if (!a || !a.onScreen) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${a.scale.toFixed(3)})`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {AGENTS.map((def) => {
        const agent = agents.find((a) => a.id === def.id);
        const selected = selection?.kind === "agent" && selection.id === def.id;
        const isHovered = hovered === `agent:${def.id}`;
        if (!bubbleVisible(agent, selected, isHovered, speech)) return null;
        const tone = agent?.status === "success" ? "success" : agent?.status === "error" ? "error" : undefined;
        return (
          <div
            key={def.id}
            className="agent-bubble"
            style={{ visibility: "hidden" }}
            ref={(el) => {
              if (el) nodes.current.set(def.id, el);
              else nodes.current.delete(def.id);
            }}
          >
            <div className="agent-bubble-inner" data-tone={tone}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: def.color }} />
              <span className="font-semibold text-mist-100">{def.name}</span>
              <span className="agent-bubble-activity">{agent?.paused ? "Paused" : agent?.activity}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
