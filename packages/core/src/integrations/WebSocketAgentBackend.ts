import type { AgentId } from "../agents/agentTypes.ts";
import type { AgentEvent } from "../events/eventTypes.ts";
import { EventBus } from "../simulation/EventBus.ts";
import type { CreateTaskInput, Task } from "../tasks/taskTypes.ts";
import type { AgentBackend, WorldSnapshot } from "./AgentBackend.ts";
import { parseServerMessage, type BackendCommand, type CommandMessage } from "./protocol.ts";

export interface WebSocketAgentBackendOptions {
  url: string;
  label?: string;
  /** Set true only if the server is itself a simulation. */
  simulated?: boolean;
  commandTimeoutMs?: number;
  /** Override for environments without a global WebSocket. */
  createSocket?: (url: string) => WebSocket;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Talks to a real orchestrator over the JSON protocol in `protocol.ts`. */
export class WebSocketAgentBackend implements AgentBackend {
  readonly kind = "websocket" as const;
  readonly label: string;
  readonly simulated: boolean;

  private readonly options: WebSocketAgentBackendOptions;
  private socket: WebSocket | null = null;
  private latest: WorldSnapshot | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly events = new EventBus<AgentEvent>();
  private readonly snapshots = new EventBus<WorldSnapshot>();

  constructor(options: WebSocketAgentBackendOptions) {
    this.options = options;
    this.label = options.label ?? "Live backend";
    this.simulated = options.simulated ?? false;
  }

  connect(): Promise<void> {
    if (this.socket) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const socket = this.options.createSocket ? this.options.createSocket(this.options.url) : new WebSocket(this.options.url);
      this.socket = socket;
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error(`Could not connect to ${this.options.url}`)), { once: true });
      socket.addEventListener("message", (e: MessageEvent) => {
        if (typeof e.data === "string") this.handle(e.data);
      });
      socket.addEventListener("close", () => {
        this.socket = null;
        this.failPending(new Error("Connection closed"));
      });
    });
  }

  async disconnect(): Promise<void> {
    this.socket?.close();
    this.socket = null;
    this.failPending(new Error("Disconnected"));
  }

  async start(): Promise<void> {
    await this.send({ name: "start" });
  }

  async stop(): Promise<void> {
    await this.send({ name: "stop" });
  }

  async pause(): Promise<void> {
    await this.send({ name: "pause" });
  }

  async resume(): Promise<void> {
    await this.send({ name: "resume" });
  }

  async reset(): Promise<void> {
    await this.send({ name: "reset" });
  }

  async setSpeed(multiplier: number): Promise<void> {
    await this.send({ name: "setSpeed", multiplier });
  }

  async submitTask(input: CreateTaskInput): Promise<Task> {
    return (await this.send({ name: "submitTask", input })) as Task;
  }

  async pauseAgent(agentId: AgentId): Promise<void> {
    await this.send({ name: "pauseAgent", agentId });
  }

  async resumeAgent(agentId: AgentId): Promise<void> {
    await this.send({ name: "resumeAgent", agentId });
  }

  getSnapshot(): WorldSnapshot | null {
    return this.latest;
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    return this.events.subscribe(listener);
  }

  subscribeSnapshot(listener: (snapshot: WorldSnapshot) => void): () => void {
    return this.snapshots.subscribe(listener);
  }

  private send(command: BackendCommand): Promise<unknown> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Backend is not connected"));
    const id = crypto.randomUUID();
    const message: CommandMessage = { type: "command", id, command };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command "${command.name}" timed out`));
      }, this.options.commandTimeoutMs ?? 10_000);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify(message));
    });
  }

  private handle(raw: string): void {
    const message = parseServerMessage(raw);
    if (!message) return;
    switch (message.type) {
      case "event":
        this.events.emit(message.event);
        break;
      case "snapshot":
        this.latest = message.snapshot;
        this.snapshots.emit(message.snapshot);
        break;
      case "ack": {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error));
        break;
      }
    }
  }

  private failPending(error: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
}
