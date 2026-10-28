import type { AgentBackend, BackendKind } from "./AgentBackend.ts";
import { MockAgentBackend, type MockAgentBackendOptions } from "./MockAgentBackend.ts";
import { WebSocketAgentBackend } from "./WebSocketAgentBackend.ts";

export interface CreateBackendOptions {
  kind?: BackendKind;
  /** Required when kind is "websocket". */
  url?: string;
  mock?: MockAgentBackendOptions;
}

/**
 * Host-agnostic backend factory. The host app maps its own env vars
 * (NEXT_PUBLIC_*, VITE_*, ...) onto these options.
 */
export function createBackend(options: CreateBackendOptions = {}): AgentBackend {
  if (options.kind === "websocket") {
    if (!options.url) throw new Error("A WebSocket URL is required for the websocket backend");
    return new WebSocketAgentBackend({ url: options.url });
  }
  return new MockAgentBackend(options.mock);
}
