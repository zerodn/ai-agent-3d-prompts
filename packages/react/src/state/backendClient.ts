import type { AgentBackend, AgentId, CreateTaskInput, Task } from "@agent-world/core";
import { resetMirror, useWorldStore } from "./useWorldStore";

let current: AgentBackend | null = null;

export function getBackend(): AgentBackend | null {
  return current;
}

/** Wire a backend's events and snapshots into the store. Returns a disposer. */
export function connectBackend(backend: AgentBackend): () => void {
  const store = useWorldStore.getState();
  current = backend;
  resetMirror();
  store.setBackend({ kind: backend.kind, label: backend.label, simulated: backend.simulated, connected: false, error: null });
  const offEvents = backend.subscribe((e) => useWorldStore.getState().pushEvent(e));
  const offSnapshots = backend.subscribeSnapshot((s) => useWorldStore.getState().applySnapshot(s));
  let disposed = false;
  backend
    .connect()
    .then(() => {
      if (disposed) return;
      useWorldStore.getState().setBackend({ connected: true, error: null });
      const snapshot = backend.getSnapshot();
      if (snapshot) useWorldStore.getState().applySnapshot(snapshot);
    })
    .catch((err: unknown) => {
      if (!disposed) useWorldStore.getState().setBackend({ connected: false, error: errorMessage(err) });
    });
  return () => {
    disposed = true;
    offEvents();
    offSnapshots();
    void backend.disconnect();
    if (current === backend) current = null;
    useWorldStore.getState().setBackend({ connected: false });
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function run<T>(fn: (b: AgentBackend) => Promise<T>): Promise<T | undefined> {
  const backend = current;
  if (!backend) return undefined;
  try {
    return await fn(backend);
  } catch (err) {
    useWorldStore.getState().setBackend({ error: errorMessage(err) });
    return undefined;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Everything the UI may ask the backend to do. Rendering never mutates simulation state directly. */
export const commands = {
  start: () => run((b) => b.start()),
  pause: () => run((b) => b.pause()),
  resume: () => run((b) => b.resume()),
  reset: () => run((b) => b.reset()),
  setSpeed: (multiplier: number) => run((b) => b.setSpeed(multiplier)),
  submitTask: (input: CreateTaskInput): Promise<Task | undefined> => run((b) => b.submitTask(input)),
  /** Staggered so the orchestrator visibly picks tasks up one by one. */
  submitTasks: async (inputs: readonly CreateTaskInput[], gapMs = 220): Promise<Task[]> => {
    const created: Task[] = [];
    for (const [i, input] of inputs.entries()) {
      if (i > 0) await wait(gapMs);
      const task = await commands.submitTask(input);
      if (task) created.push(task);
    }
    return created;
  },
  pauseAgent: (id: AgentId) => run((b) => b.pauseAgent(id)),
  resumeAgent: (id: AgentId) => run((b) => b.resumeAgent(id)),
  /** Start a ready simulation, or resume a paused one, so new work visibly moves. */
  ensureRunning: async () => {
    const status = useWorldStore.getState().simStatus;
    if (status === "ready") await commands.start();
    else if (status === "paused") await commands.resume();
  },
  autoStartIfReady: async (autoStart: boolean) => {
    if (autoStart && useWorldStore.getState().simStatus === "ready") await commands.start();
  },
};
