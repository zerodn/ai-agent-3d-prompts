import type { AgentDefinition, AgentId, AgentState, AgentStatus } from "./agentTypes.ts";
import {
  arrivalHeading,
  distance,
  headingTowards,
  locationLabel,
  route,
  slotFor,
  type LocationId,
} from "../simulation/worldLayout.ts";

interface ActionBase {
  taskId?: string;
  /** Ambient actions are dropped as soon as real work arrives. */
  ambient?: boolean;
}

export type AgentAction = ActionBase &
  (
    | { kind: "move"; to: LocationId; slot?: number; activity?: string }
    | { kind: "work"; duration: number; status: "working" | "thinking"; activity: string; onProgress?: (fraction: number) => void }
    | { kind: "talk"; target: AgentId; duration: number; activity: string; onStart?: () => void }
    | { kind: "emote"; status: "success" | "error"; duration: number; activity: string }
    | { kind: "wait"; until: () => boolean; timeout: number; face?: AgentId; status?: AgentStatus; activity: string }
    | { kind: "call"; fn: () => void }
  );

export interface AgentWorld {
  controller(id: AgentId): AgentController;
  onArrived(agent: AgentController, location: LocationId, taskId: string | undefined): void;
  walkSpeed(): number;
}

interface RunningAction {
  action: AgentAction;
  elapsed: number;
  started: boolean;
}

const EPS = 1e-9;
/** Upper bound on actions processed per step, so a buggy zero-time loop cannot hang the engine. */
const MAX_ACTIONS_PER_STEP = 32;

export class AgentController {
  readonly def: AgentDefinition;
  readonly state: AgentState;
  private readonly world: AgentWorld;
  private queue: AgentAction[] = [];
  private current: RunningAction | null = null;

  constructor(def: AgentDefinition, world: AgentWorld) {
    this.def = def;
    this.world = world;
    const home = slotFor(def.home, def.seat);
    this.state = {
      id: def.id,
      status: "idle",
      activity: `Idle at ${locationLabel(def.home)}`,
      currentTaskId: null,
      progress: 0,
      location: def.home,
      destination: null,
      position: { ...home },
      heading: arrivalHeading(def.home, home),
      path: [],
      facingAgentId: null,
      paused: false,
    };
  }

  get id(): AgentId {
    return this.def.id;
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** True while doing (or queued to do) real, non-ambient work. */
  get hasTaskWork(): boolean {
    return (this.current !== null && !this.current.action.ambient) || this.queue.some((a) => !a.ambient);
  }

  /** True while any queued or running action belongs to the task. */
  references(taskId: string): boolean {
    return this.current?.action.taskId === taskId || this.queue.some((a) => a.taskId === taskId);
  }

  enqueue(...actions: AgentAction[]): void {
    if (actions.some((a) => !a.ambient)) this.dropAmbient();
    this.queue.push(...actions);
  }

  /** Cancel wandering so task work starts immediately. The agent stops where it stands. */
  dropAmbient(): void {
    this.queue = this.queue.filter((a) => !a.ambient);
    if (this.current?.action.ambient) {
      this.finishCurrent();
      this.state.path = [];
      this.state.destination = null;
    }
  }

  /** Put the agent back at home, idle, with an empty queue. */
  reset(): void {
    this.queue = [];
    this.current = null;
    const home = slotFor(this.def.home, this.def.seat);
    Object.assign(this.state, {
      status: "idle",
      activity: `Idle at ${locationLabel(this.def.home)}`,
      currentTaskId: null,
      progress: 0,
      location: this.def.home,
      destination: null,
      position: { ...home },
      heading: arrivalHeading(this.def.home, home),
      path: [],
      facingAgentId: null,
      paused: false,
    } satisfies Partial<AgentState>);
  }

  step(dt: number): void {
    if (this.state.paused) return;
    let remaining = dt;
    for (let i = 0; i < MAX_ACTIONS_PER_STEP; i++) {
      if (!this.current) {
        const next = this.queue.shift();
        if (!next) {
          this.becomeIdle();
          return;
        }
        this.current = { action: next, elapsed: 0, started: false };
      }
      const running = this.current;
      if (!running.started) {
        running.started = true;
        this.begin(running.action);
      }
      const consumed = this.advance(running, remaining);
      if (this.current === running && this.isFinished(running)) this.finishCurrent();
      remaining -= consumed;
      // Keep going only while there is time left, or the next action may be instantaneous.
      if (this.current && remaining <= EPS) return;
      if (!this.current && remaining <= EPS && !this.queue.some(isInstant)) return;
    }
  }

  private begin(action: AgentAction): void {
    const s = this.state;
    s.currentTaskId = action.taskId ?? null;
    s.progress = 0;
    switch (action.kind) {
      case "move": {
        const target = slotFor(action.to, action.slot ?? 0);
        s.path = route(s.position, target);
        s.destination = action.to;
        s.facingAgentId = null;
        if (s.path.length) {
          s.location = null;
          s.status = "walking";
          s.activity = action.activity ?? `Walking to ${locationLabel(action.to)}`;
        }
        break;
      }
      case "work":
        s.status = action.status;
        s.activity = action.activity;
        break;
      case "talk": {
        s.status = "communicating";
        s.activity = action.activity;
        this.faceEachOther(action.target);
        action.onStart?.();
        break;
      }
      case "emote":
        s.status = action.status;
        s.activity = action.activity;
        break;
      case "wait":
        s.status = action.status ?? "idle";
        s.activity = action.activity;
        if (action.face) this.faceAgent(action.face);
        break;
      case "call":
        action.fn();
        break;
    }
  }

  /** Returns the simulation time consumed. */
  private advance(running: RunningAction, dt: number): number {
    const action = running.action;
    switch (action.kind) {
      case "move":
        return this.walk(action.to, dt, action.taskId);
      case "work": {
        const used = Math.min(dt, action.duration - running.elapsed);
        running.elapsed += used;
        const fraction = action.duration > 0 ? Math.min(1, running.elapsed / action.duration) : 1;
        this.state.progress = fraction;
        action.onProgress?.(fraction);
        return used;
      }
      case "talk": {
        const used = Math.min(dt, action.duration - running.elapsed);
        running.elapsed += used;
        this.state.progress = action.duration > 0 ? running.elapsed / action.duration : 1;
        this.faceEachOther(action.target);
        return used;
      }
      case "emote": {
        const used = Math.min(dt, action.duration - running.elapsed);
        running.elapsed += used;
        return used;
      }
      case "wait": {
        if (action.until()) {
          running.elapsed = Infinity;
          return 0;
        }
        const used = Math.min(dt, action.timeout - running.elapsed);
        running.elapsed += used;
        return used;
      }
      case "call":
        return 0;
    }
  }

  private isFinished(running: RunningAction): boolean {
    const action = running.action;
    switch (action.kind) {
      case "move":
        return this.state.path.length === 0;
      case "work":
      case "talk":
      case "emote":
        return running.elapsed >= action.duration - EPS;
      case "wait":
        return running.elapsed === Infinity || running.elapsed >= action.timeout - EPS;
      case "call":
        return true;
    }
  }

  private finishCurrent(): void {
    const running = this.current;
    this.current = null;
    if (!running) return;
    if (running.action.kind === "talk") {
      const target = this.world.controller(running.action.target);
      if (target.state.facingAgentId === this.id) target.state.facingAgentId = null;
      this.state.facingAgentId = null;
    }
  }

  private walk(to: LocationId, dt: number, taskId: string | undefined): number {
    const s = this.state;
    const speed = this.world.walkSpeed();
    let budget = dt * speed;
    while (s.path.length && budget > EPS) {
      const next = s.path[0];
      const d = distance(s.position, next);
      if (d > EPS) s.heading = headingTowards(s.position, next);
      if (d <= budget) {
        s.position = { x: next.x, z: next.z };
        budget -= d;
        s.path.shift();
      } else {
        const t = budget / d;
        s.position = { x: s.position.x + (next.x - s.position.x) * t, z: s.position.z + (next.z - s.position.z) * t };
        budget = 0;
      }
    }
    if (!s.path.length) this.arrive(to, taskId);
    return dt - budget / speed;
  }

  private arrive(to: LocationId, taskId: string | undefined): void {
    const s = this.state;
    const wasWalking = s.location === null;
    s.location = to;
    s.destination = null;
    s.heading = arrivalHeading(to, s.position);
    if (wasWalking) this.world.onArrived(this, to, taskId);
  }

  private becomeIdle(): void {
    const s = this.state;
    s.status = "idle";
    s.currentTaskId = null;
    s.progress = 0;
    s.destination = null;
    s.activity = s.location ? `Idle at ${locationLabel(s.location)}` : "Idle";
  }

  private faceAgent(id: AgentId): void {
    const other = this.world.controller(id);
    this.state.heading = headingTowards(this.state.position, other.state.position);
    this.state.facingAgentId = id;
  }

  private faceEachOther(targetId: AgentId): void {
    this.faceAgent(targetId);
    const target = this.world.controller(targetId);
    if (target.state.status !== "walking") {
      target.state.heading = headingTowards(target.state.position, this.state.position);
    }
    target.state.facingAgentId = this.id;
  }
}

function isInstant(action: AgentAction): boolean {
  return action.kind === "call";
}
