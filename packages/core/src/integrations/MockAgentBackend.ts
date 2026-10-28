import type { AgentId } from "../agents/agentTypes.ts";
import type { AgentEvent } from "../events/eventTypes.ts";
import { SimulationEngine, type SimulationEngineOptions } from "../simulation/SimulationEngine.ts";
import type { CreateTaskInput, Task } from "../tasks/taskTypes.ts";
import type { AgentBackend, WorldSnapshot } from "./AgentBackend.ts";

export interface MockAgentBackendOptions extends SimulationEngineOptions {
  /** Monotonic clock in ms; defaults to performance.now. */
  clock?: () => number;
}

/** Runs the deterministic SimulationEngine locally, ticking it at `tickHz`. No inference happens. */
export class MockAgentBackend implements AgentBackend {
  readonly kind = "mock" as const;
  readonly label = "Local simulation";
  readonly simulated = true;
  readonly engine: SimulationEngine;

  private readonly clock: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private booted = false;
  private latest: WorldSnapshot | null = null;
  private unsubscribeEngine: (() => void) | null = null;

  constructor(options: MockAgentBackendOptions = {}) {
    this.engine = new SimulationEngine(options);
    this.clock = options.clock ?? (() => performance.now());
  }

  async connect(): Promise<void> {
    if (this.timer) return;
    this.unsubscribeEngine = this.engine.snapshots.subscribe((s) => {
      this.latest = s;
    });
    this.latest = this.engine.snapshot();
    // Reconnects (e.g. React StrictMode effects) must not repeat the boot lines.
    if (!this.booted) this.engine.emitBootEvents();
    this.booted = true;
    this.engine.snapshots.emit(this.latest);
    this.lastTick = this.clock();
    this.timer = setInterval(() => this.step(), 1000 / this.engine.config.tickHz);
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribeEngine?.();
    this.unsubscribeEngine = null;
  }

  async start(): Promise<void> {
    this.engine.start();
  }

  async stop(): Promise<void> {
    this.engine.stop();
  }

  async pause(): Promise<void> {
    this.engine.pause();
  }

  async resume(): Promise<void> {
    this.engine.resume();
  }

  async reset(): Promise<void> {
    this.engine.reset();
  }

  async setSpeed(multiplier: number): Promise<void> {
    this.engine.setSpeed(multiplier);
  }

  async submitTask(input: CreateTaskInput): Promise<Task> {
    return this.engine.submitTask(input);
  }

  async pauseAgent(id: AgentId): Promise<void> {
    this.engine.pauseAgent(id);
  }

  async resumeAgent(id: AgentId): Promise<void> {
    this.engine.resumeAgent(id);
  }

  getSnapshot(): WorldSnapshot | null {
    return this.latest;
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    return this.engine.events.subscribe(listener);
  }

  subscribeSnapshot(listener: (snapshot: WorldSnapshot) => void): () => void {
    return this.engine.snapshots.subscribe(listener);
  }

  private step(): void {
    const now = this.clock();
    // Clamp so a sleeping tab does not make agents teleport.
    const dt = Math.min((now - this.lastTick) / 1000, this.engine.config.maxStepSeconds);
    this.lastTick = now;
    this.engine.tick(dt);
  }
}
