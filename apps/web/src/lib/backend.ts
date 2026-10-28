import { createBackend, type AgentBackend } from "@agent-world/core";

/**
 * Next.js-specific env mapping. Other hosts (e.g. Landium) call `createBackend` with their own config.
 * NEXT_PUBLIC_AGENT_BACKEND=websocket + NEXT_PUBLIC_AGENT_WS_URL=wss://… selects a live backend.
 */
export function createBackendFromEnv(): AgentBackend {
  const kind = process.env.NEXT_PUBLIC_AGENT_BACKEND === "websocket" ? "websocket" : "mock";
  return createBackend({ kind, url: process.env.NEXT_PUBLIC_AGENT_WS_URL });
}
