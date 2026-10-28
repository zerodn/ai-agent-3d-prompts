import { AgentController, type AgentAction, type AgentWorld } from "../agents/AgentController.ts";
import { AGENTS, getAgent } from "../agents/AgentRegistry.ts";
import type { AgentId } from "../agents/agentTypes.ts";
import type { AgentEvent, AgentEventType, EventSeverity } from "../events/eventTypes.ts";
import type { CommLink, CommLinkKind, SimulationStatus, WorldSnapshot } from "../integrations/AgentBackend.ts";
import { PHASE_LABEL, PHASE_STATUS, type CreateTaskInput, type Task, type WorkflowPhase, type WorkflowSignal } from "../tasks/taskTypes.ts";
import { EventBus, createRng, hashString, randomBetween } from "./EventBus.ts";
import { resolveConfig, type SimulationConfig, type SimulationConfigOverrides } from "./simulationConfig.ts";
import { pickNext } from "./TaskScheduler.ts";
import { matchWorkTemplate, shortTitle, WORK_TEMPLATES, type WorkTemplate } from "./workContent.ts";
import { applySignal, isTerminal } from "./WorkflowStateMachine.ts";
import { LOCATIONS, locationLabel, type LocationId } from "./worldLayout.ts";

export interface SimulationEngineOptions {
  config?: SimulationConfigOverrides;
  /** Domain-specific canned content; defaults to the built-in software templates. */
  workTemplates?: readonly WorkTemplate[];
  /** Wall clock for event timestamps (injectable for tests). */
  now?: () => number;
}

/** Which agent owns each phase. */
const PHASE_OWNER: Record<WorkflowPhase, AgentId | null> = {
  queued: null,
  intake: "orion",
  planning: "piper",
  research: "iris",
  implementation: "kai",
  testing: "quinn",
  review: "rex",
  done: "orion",
  failed: null,
};

const AMBIENT_SPOTS: readonly LocationId[] = ["collab", "lounge", "planning"];

interface AmbientState {
  idleSince: number | null;
  nextAmbientAt: number;
}

type EmitInput = {
  agentId?: AgentId;
  targetAgentId?: AgentId;
  taskId?: string;
  severity?: EventSeverity;
  feed?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * The whole mock brain: pure TypeScript, deterministic for a given seed and input sequence.
 * Rendering never calls into this directly; it goes through an AgentBackend.
 */
export class SimulationEngine {
  readonly config: SimulationConfig;
  readonly events = new EventBus<AgentEvent>();
  readonly snapshots = new EventBus<WorldSnapshot>();

  private readonly templates: readonly WorkTemplate[];
  private readonly now: () => number;
  private readonly controllers = new Map<AgentId, AgentController>();
  private readonly ambient = new Map<AgentId, AmbientState>();
  private tasks = new Map<string, Task>();
  private taskOrder = new Map<string, number>();
  private taskRngs = new Map<string, () => number>();
  private links: CommLink[] = [];
  private clock = 0;
  private status: SimulationStatus = "ready";
  private speed: number;
  private rng: () => number;
  private eventSeq = 0;
  private taskSeq = 0;
  private linkSeq = 0;

  constructor(options: SimulationEngineOptions = {}) {
    this.config = resolveConfig(options.config);
    this.templates = options.workTemplates ?? WORK_TEMPLATES;
    this.now = options.now ?? Date.now;
    this.speed = this.config.defaultSpeed;
    this.rng = createRng(this.config.seed);
    const world: AgentWorld = {
      controller: (id) => this.controller(id),
      onArrived: (agent, location, taskId) => this.onArrived(agent, location, taskId),
      walkSpeed: () => this.config.walkSpeed,
    };
    for (const def of AGENTS) this.controllers.set(def.id, new AgentController(def, world));
    this.resetAmbient();
  }

  // ---------------------------------------------------------------- commands

  start(): void {
    if (this.status === "running") return;
    const wasPaused = this.status === "paused";
    this.status = "running";
    this.emit(wasPaused ? "system.resumed" : "system.started", wasPaused ? "Simulation resumed" : "Simulation started", { severity: "info" });
    this.publish();
  }

  /** Halt without clearing state; `start()` continues from here. */
  stop(): void {
    if (this.status === "ready") return;
    this.status = "ready";
    this.emit("system.paused", "Simulation stopped", { severity: "info" });
    this.publish();
  }

  pause(): void {
    if (this.status !== "running") return;
    this.status = "paused";
    this.emit("system.paused", "Simulation paused", { severity: "info" });
    this.publish();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "running";
    this.emit("system.resumed", "Simulation resumed", { severity: "info" });
    this.publish();
  }

  reset(): void {
    this.tasks = new Map();
    this.taskOrder = new Map();
    this.taskRngs = new Map();
    this.links = [];
    this.clock = 0;
    this.status = "ready";
    this.eventSeq = 0;
    this.taskSeq = 0;
    this.linkSeq = 0;
    this.rng = createRng(this.config.seed);
    for (const c of this.controllers.values()) c.reset();
    this.resetAmbient();
    this.emit("system.reset", "Simulation reset: all agents back at their stations", { severity: "info" });
    this.publish();
  }

  setSpeed(multiplier: number): void {
    const allowed = this.config.speeds;
    const next = allowed.reduce((best, s) => (Math.abs(s - multiplier) < Math.abs(best - multiplier) ? s : best), allowed[0]);
    if (next === this.speed) return;
    this.speed = next;
    this.emit("system.speed_changed", `Speed set to ${next}×`, { feed: false, metadata: { speed: next } });
    this.publish();
  }

  submitTask(input: CreateTaskInput): Task {
    const title = input.title.trim();
    if (!title) throw new Error("Task title is required");
    this.taskSeq += 1;
    const id = `T-${String(this.taskSeq).padStart(3, "0")}`;
    const task: Task = {
      id,
      title,
      description: input.description?.trim() ?? "",
      priority: input.priority ?? "medium",
      status: "queued",
      phase: "queued",
      assignedAgentId: null,
      progress: 0,
      createdAt: this.clock,
      updatedAt: this.clock,
      completedAt: null,
      iteration: 0,
      subtasks: [],
      findings: [],
      history: [],
      isDemo: input.isDemo ?? false,
      preferredAgentId: input.preferredAgentId ?? null,
      blockedReason: null,
      script: input.script,
    };
    this.tasks.set(id, task);
    this.taskOrder.set(id, this.taskSeq);
    this.taskRngs.set(id, createRng((hashString(title) ^ this.config.seed ^ this.taskSeq) >>> 0));
    const requested = task.preferredAgentId ? ` (requested for ${getAgent(task.preferredAgentId).name})` : "";
    this.emit("task.created", `New task ${id}: ${shortTitle(title)}${requested}`, {
      taskId: id,
      metadata: { priority: task.priority, isDemo: task.isDemo },
    });
    this.publish();
    return task;
  }

  pauseAgent(id: AgentId): void {
    const c = this.controller(id);
    if (c.state.paused) return;
    c.state.paused = true;
    this.emit("agent.paused", `${c.def.name} is paused`, { agentId: id, severity: "warning" });
    for (const task of this.tasks.values()) {
      if (task.assignedAgentId === id && !isTerminal(task.phase)) this.block(task.id, c.def.name);
    }
    this.publish();
  }

  resumeAgent(id: AgentId): void {
    const c = this.controller(id);
    if (!c.state.paused) return;
    c.state.paused = false;
    this.emit("agent.resumed", `${c.def.name} is back to work`, { agentId: id, severity: "info" });
    for (const task of this.tasks.values()) {
      if (task.assignedAgentId === id && task.status === "blocked") {
        this.updateTask(task.id, (t) => ({ ...t, status: PHASE_STATUS[t.phase], blockedReason: null }));
        this.emit("task.unblocked", `${task.id} unblocked: ${c.def.name} resumed`, { taskId: task.id, agentId: id });
      }
    }
    this.publish();
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getStatus(): SimulationStatus {
    return this.status;
  }

  getClock(): number {
    return this.clock;
  }

  emitBootEvents(): void {
    this.emit("system.ready", "AI Agent World is ready. Simulation mode: no live inference.", { severity: "info" });
    for (const c of this.controllers.values()) {
      this.emit("agent.message", `${c.def.name} is at the ${locationLabel(c.state.location)}`, { agentId: c.id });
    }
  }

  // ---------------------------------------------------------------- loop

  tick(realDtSeconds: number): void {
    if (this.status !== "running") return;
    const dt = Math.max(0, realDtSeconds) * this.speed;
    if (dt === 0) return;
    this.clock += dt;
    for (const c of this.controllers.values()) c.step(dt);
    this.runScheduler();
    this.runAmbient();
    if (this.links.length && this.links[0].endsAt <= this.clock) this.links = this.links.filter((l) => l.endsAt > this.clock);
    this.pruneFinishedTasks();
    this.publish();
  }

  /** Drop the oldest finished tasks beyond `maxRetainedTasks`, once their closing announcement has played. */
  private pruneFinishedTasks(): void {
    const max = this.config.maxRetainedTasks;
    let finished = 0;
    for (const t of this.tasks.values()) if (isTerminal(t.phase)) finished += 1;
    if (finished <= max) return;
    const removable = [...this.tasks.values()]
      .filter((t) => isTerminal(t.phase) && !this.isTaskReferenced(t.id))
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    for (const t of removable.slice(0, finished - max)) {
      this.tasks.delete(t.id);
      this.taskOrder.delete(t.id);
      this.taskRngs.delete(t.id);
    }
  }

  private isTaskReferenced(taskId: string): boolean {
    for (const c of this.controllers.values()) if (c.references(taskId)) return true;
    return false;
  }

  snapshot(): WorldSnapshot {
    return {
      clock: this.clock,
      status: this.status,
      speed: this.speed,
      agents: [...this.controllers.values()].map((c) => ({
        ...c.state,
        position: { ...c.state.position },
        path: c.state.path.map((p) => ({ ...p })),
      })),
      // Tasks are replaced, never mutated, so sharing references is safe.
      tasks: [...this.tasks.values()],
      links: [...this.links],
    };
  }

  // ---------------------------------------------------------------- scheduling

  private runScheduler(): void {
    const tasks = [...this.tasks.values()];
    const next = pickNext(tasks, this.config.maxConcurrentTasks, (t) => this.taskOrder.get(t.id) ?? 0);
    for (const task of next) this.startIntake(task.id);
  }

  private runAmbient(): void {
    const { ambient, returnHomeDelay } = this.config;
    for (const c of this.controllers.values()) {
      const a = this.ambient.get(c.id);
      if (!a || c.state.paused) continue;
      if (c.busy) {
        if (c.hasTaskWork) a.idleSince = null;
        continue;
      }
      if (a.idleSince === null) {
        a.idleSince = this.clock;
        a.nextAmbientAt = Math.max(a.nextAmbientAt, this.clock + randomBetween(this.rng, ambient.minGap, ambient.maxGap) / 2);
        continue;
      }
      const home = c.def.home;
      if (c.state.location !== home) {
        if (this.clock - a.idleSince >= returnHomeDelay) {
          c.enqueue({ kind: "move", to: home, slot: c.def.seat, ambient: true, activity: `Heading back to the ${locationLabel(home)}` });
        }
        continue;
      }
      if (this.clock < a.nextAmbientAt) continue;
      const spot = AMBIENT_SPOTS[Math.floor(this.rng() * AMBIENT_SPOTS.length)];
      const stay = randomBetween(this.rng, ambient.minStay, ambient.maxStay);
      a.nextAmbientAt = this.clock + stay + randomBetween(this.rng, ambient.minGap, ambient.maxGap);
      c.enqueue(
        { kind: "move", to: spot, slot: c.def.seat, ambient: true, activity: `Stretching legs at the ${locationLabel(spot)}` },
        {
          kind: "call",
          ambient: true,
          fn: () => this.emit("agent.ambient", `${c.def.name} drops by the ${locationLabel(spot)}`, { agentId: c.id, feed: false }),
        },
        { kind: "wait", until: () => false, timeout: stay, ambient: true, status: "idle", activity: `Taking a break at the ${locationLabel(spot)}` },
        { kind: "move", to: home, slot: c.def.seat, ambient: true, activity: `Heading back to the ${locationLabel(home)}` },
      );
    }
  }

  private resetAmbient(): void {
    const { minGap, maxGap } = this.config.ambient;
    for (const def of AGENTS) {
      this.ambient.set(def.id, { idleSince: null, nextAmbientAt: randomBetween(this.rng, minGap, maxGap) });
    }
  }

  // ---------------------------------------------------------------- choreography

  private startIntake(taskId: string): void {
    this.signal(taskId, "picked_up");
    const task = this.task(taskId);
    const d = this.config.durations;
    const orion = this.controller("orion");
    orion.enqueue(
      { kind: "move", to: "hub", taskId, activity: `Heading to the hub for ${taskId}` },
      { kind: "work", taskId, duration: d.intakeThink, status: "thinking", activity: `Triaging "${shortTitle(task.title, 32)}"`, onProgress: (f) => this.setPhaseProgress(taskId, "intake", f) },
      this.talk("orion", "piper", d.assign, "assign", taskId, `Briefing Piper on ${taskId}`, null),
      {
        kind: "call",
        taskId,
        fn: () => {
          this.emit("task.assigned", `Orion assigned ${taskId} to Piper for planning`, { agentId: "orion", targetAgentId: "piper", taskId });
          this.signal(taskId, "delegated");
        },
      },
    );
  }

  private startPlanning(taskId: string): void {
    const d = this.config.durations;
    const piper = this.controller("piper");
    const template = this.template(taskId);
    piper.enqueue(
      { kind: "move", to: "planning", slot: 0, taskId, activity: "Walking to the planning board" },
      { kind: "work", taskId, duration: d.breakdown, status: "working", activity: `Breaking ${taskId} into task cards`, onProgress: (f) => this.setPhaseProgress(taskId, "planning", f) },
      {
        kind: "call",
        taskId,
        fn: () => {
          const subtasks = template.subtasks.map((title, i) => ({ id: `${taskId}-S${i + 1}`, title, done: false }));
          this.updateTask(taskId, (t) => ({ ...t, subtasks, updatedAt: this.clock }));
          this.emit("plan.created", `Piper broke ${taskId} into ${subtasks.length} task cards`, {
            agentId: "piper",
            taskId,
            metadata: { subtasks: subtasks.map((s) => s.title) },
          });
        },
      },
      this.talk("piper", "iris", d.coordinate, "message", taskId, "Handing the plan to Iris", `Piper → Iris: plan for ${taskId} is ready, please research the open questions`),
      { kind: "call", taskId, fn: () => this.signal(taskId, "plan_ready") },
    );
  }

  private startResearch(taskId: string): void {
    const d = this.config.durations;
    const iris = this.controller("iris");
    const template = this.template(taskId);
    iris.enqueue(
      { kind: "move", to: "research", slot: 0, taskId, activity: "Walking to the Research Station" },
      { kind: "work", taskId, duration: d.research, status: "working", activity: `Researching ${taskId}`, onProgress: (f) => this.setPhaseProgress(taskId, "research", f) },
      {
        kind: "call",
        taskId,
        fn: () => this.updateTask(taskId, (t) => ({ ...t, findings: [...template.findings], updatedAt: this.clock })),
      },
      this.talk("iris", "kai", d.publish, "message", taskId, "Sharing findings with Kai", `Iris → Kai: ${template.findings.length} findings for ${taskId}`),
      {
        kind: "call",
        taskId,
        fn: () => {
          this.emit("research.completed", `Iris published ${template.findings.length} research findings for ${taskId}`, {
            agentId: "iris",
            taskId,
            severity: "success",
            metadata: { findings: template.findings },
          });
          this.signal(taskId, "findings_published");
        },
      },
    );
  }

  private startImplementation(taskId: string): void {
    const d = this.config.durations;
    const kai = this.controller("kai");
    const iteration = this.task(taskId).iteration;
    const duration = iteration <= 1 ? d.implement : d.fix;
    kai.enqueue(
      { kind: "move", to: "dev", slot: 0, taskId, activity: "Walking to the Engineering Station" },
      {
        kind: "call",
        taskId,
        fn: () =>
          this.emit("implementation.started", iteration <= 1 ? `Kai started implementing ${taskId}` : `Kai is reworking ${taskId} (attempt ${iteration})`, {
            agentId: "kai",
            taskId,
            metadata: { iteration },
          }),
      },
      {
        kind: "work",
        taskId,
        duration,
        status: "working",
        activity: iteration <= 1 ? `Implementing ${taskId}` : `Fixing ${taskId} (attempt ${iteration})`,
        onProgress: (f) => {
          this.setPhaseProgress(taskId, "implementation", f);
          this.tickSubtasks(taskId, f);
        },
      },
      this.talk("kai", "quinn", d.submit, "message", taskId, "Handing the build to Quinn", `Kai → Quinn: build #${iteration} of ${taskId} is ready for testing`),
      {
        kind: "call",
        taskId,
        fn: () => {
          this.emit("implementation.submitted", `Kai submitted build #${iteration} of ${taskId} for testing`, { agentId: "kai", taskId, metadata: { iteration } });
          this.signal(taskId, "submitted");
        },
      },
    );
  }

  private startTesting(taskId: string): void {
    const d = this.config.durations;
    const quinn = this.controller("quinn");
    const template = this.template(taskId);
    quinn.enqueue(
      { kind: "move", to: "testing", slot: 0, taskId, activity: "Walking to the QA Lab" },
      { kind: "call", taskId, fn: () => this.emit("qa.started", `Quinn is testing ${taskId}`, { agentId: "quinn", taskId, feed: false }) },
      { kind: "work", taskId, duration: d.test, status: "working", activity: `Running the test suite for ${taskId}`, onProgress: (f) => this.setPhaseProgress(taskId, "testing", f) },
      {
        kind: "call",
        taskId,
        fn: () => {
          const task = this.task(taskId);
          const fails = this.outcome(task, task.script?.qaFailsOn, this.config.qaFailRate);
          const test = template.tests[(task.iteration - 1) % template.tests.length];
          if (fails) {
            quinn.enqueue(
              { kind: "emote", taskId, status: "error", duration: d.errorEmote, activity: `Test failed: "${test}"` },
              this.talk("quinn", "kai", d.report, "report", taskId, "Reporting the failure to Kai", `Quinn → Kai: "${test}" fails on build #${task.iteration}`),
              {
                kind: "call",
                taskId,
                fn: () => {
                  this.emit("qa.failed", `Quinn failed build #${task.iteration} of ${taskId}: "${test}"`, {
                    agentId: "quinn",
                    taskId,
                    severity: "warning",
                    metadata: { test, iteration: task.iteration },
                  });
                  this.rework(taskId, "tests_failed");
                },
              },
            );
          } else {
            quinn.enqueue(
              { kind: "emote", taskId, status: "success", duration: d.celebrate, activity: "All tests green" },
              this.talk("quinn", "rex", d.report, "report", taskId, "Passing the build to Rex", `Quinn → Rex: ${taskId} passed QA, ready for review`),
              {
                kind: "call",
                taskId,
                fn: () => {
                  this.emit("qa.passed", `Quinn passed build #${task.iteration} of ${taskId}`, { agentId: "quinn", taskId, severity: "success", metadata: { iteration: task.iteration } });
                  this.signal(taskId, "tests_passed");
                },
              },
            );
          }
        },
      },
    );
  }

  private startReview(taskId: string): void {
    const d = this.config.durations;
    const rex = this.controller("rex");
    const template = this.template(taskId);
    rex.enqueue(
      { kind: "move", to: "review", slot: 0, taskId, activity: "Walking to the Review Station" },
      { kind: "call", taskId, fn: () => this.emit("review.started", `Rex is reviewing ${taskId}`, { agentId: "rex", taskId, feed: false }) },
      { kind: "work", taskId, duration: d.review, status: "thinking", activity: `Reviewing the diff for ${taskId}`, onProgress: (f) => this.setPhaseProgress(taskId, "review", f) },
      {
        kind: "call",
        taskId,
        fn: () => {
          const task = this.task(taskId);
          const changes = this.outcome(task, task.script?.reviewChangesOn, this.config.reviewChangeRate);
          const note = template.reviewNotes[(task.iteration - 1) % template.reviewNotes.length];
          if (changes) {
            rex.enqueue(
              { kind: "emote", taskId, status: "error", duration: d.errorEmote, activity: "Changes requested" },
              this.talk("rex", "kai", d.report, "report", taskId, "Walking Kai through the review", `Rex → Kai: ${note}`),
              {
                kind: "call",
                taskId,
                fn: () => {
                  this.emit("review.changes_requested", `Rex requested changes on ${taskId}: ${note}`, {
                    agentId: "rex",
                    taskId,
                    severity: "warning",
                    metadata: { note, iteration: task.iteration },
                  });
                  this.rework(taskId, "changes_requested");
                },
              },
            );
          } else {
            rex.enqueue(
              { kind: "emote", taskId, status: "success", duration: d.celebrate, activity: "Approved" },
              this.talk("rex", "orion", d.report, "report", taskId, "Reporting approval to Orion", `Rex → Orion: ${taskId} is approved`),
              {
                kind: "call",
                taskId,
                fn: () => {
                  this.emit("review.approved", `Rex approved ${taskId}`, { agentId: "rex", taskId, severity: "success" });
                  this.signal(taskId, "approved");
                },
              },
            );
          }
        },
      },
    );
  }

  private finalize(taskId: string): void {
    const d = this.config.durations;
    const task = this.task(taskId);
    this.controller("orion").enqueue(
      { kind: "move", to: "hub", taskId, activity: "Returning to the hub" },
      { kind: "emote", taskId, status: "success", duration: d.announce, activity: `Shipped ${taskId}` },
      {
        kind: "call",
        taskId,
        fn: () =>
          this.emit("task.completed", `${taskId} shipped: ${shortTitle(task.title)}`, {
            agentId: "orion",
            taskId,
            severity: "success",
            metadata: { iterations: task.iteration },
          }),
      },
    );
  }

  private rework(taskId: string, signal: "tests_failed" | "changes_requested"): void {
    const task = this.task(taskId);
    if (task.iteration >= this.config.maxIterations) {
      this.signal(taskId, "abort");
      this.updateTask(taskId, (t) => ({ ...t, assignedAgentId: null }));
      this.emit("task.failed", `${taskId} failed after ${task.iteration} iterations`, {
        taskId,
        agentId: "orion",
        severity: "error",
        metadata: { iterations: task.iteration, reason: signal },
      });
      this.publish();
      return;
    }
    this.signal(taskId, signal);
  }

  // ---------------------------------------------------------------- helpers

  private talk(from: AgentId, to: AgentId, duration: number, kind: CommLinkKind, taskId: string, activity: string, message: string | null): AgentAction {
    return {
      kind: "talk",
      target: to,
      duration,
      activity,
      taskId,
      onStart: () => {
        this.linkSeq += 1;
        this.links.push({ id: `L-${this.linkSeq}`, from, to, kind, startedAt: this.clock, endsAt: this.clock + this.config.linkDuration });
        if (message) this.emit("agent.message", message, { agentId: from, targetAgentId: to, taskId, metadata: { kind } });
      },
    };
  }

  /** A scripted task follows its script exactly; otherwise the per-task RNG decides, and the last iteration always passes. */
  private outcome(task: Task, scripted: number[] | undefined, rate: number): boolean {
    if (task.script) return (scripted ?? []).includes(task.iteration);
    const rng = this.taskRngs.get(task.id) ?? this.rng;
    return rng() < rate && task.iteration < this.config.maxIterations;
  }

  private signal(taskId: string, signal: WorkflowSignal): void {
    const before = this.task(taskId);
    const after = applySignal(before, signal, this.clock, this.config);
    const owner = PHASE_OWNER[after.phase];
    this.tasks.set(taskId, { ...after, assignedAgentId: owner ?? after.assignedAgentId });
    this.emit("task.status_changed", `${taskId}: ${PHASE_LABEL[before.phase]} → ${PHASE_LABEL[after.phase]}`, {
      taskId,
      feed: false,
      metadata: { from: before.phase, to: after.phase, signal, iteration: after.iteration },
    });
    if (owner && this.controller(owner).state.paused && !isTerminal(after.phase)) this.block(taskId, getAgent(owner).name);
    switch (after.phase) {
      case "planning":
        this.startPlanning(taskId);
        break;
      case "research":
        this.startResearch(taskId);
        break;
      case "implementation":
        this.startImplementation(taskId);
        break;
      case "testing":
        this.startTesting(taskId);
        break;
      case "review":
        this.startReview(taskId);
        break;
      case "done":
        this.finalize(taskId);
        break;
      default:
        break;
    }
  }

  private block(taskId: string, agentName: string): void {
    const reason = `${agentName} is paused`;
    this.updateTask(taskId, (t) => ({ ...t, status: "blocked", blockedReason: reason }));
    this.emit("task.blocked", `${taskId} blocked: ${reason}`, { taskId, severity: "warning" });
  }

  private setPhaseProgress(taskId: string, phase: WorkflowPhase, fraction: number): void {
    const task = this.tasks.get(taskId);
    if (!task || task.phase !== phase) return;
    const [start, end] = this.config.phaseProgress[phase];
    const progress = start + (end - start) * fraction;
    if (Math.abs(progress - task.progress) < 1e-6) return;
    this.tasks.set(taskId, { ...task, progress, updatedAt: this.clock });
  }

  private tickSubtasks(taskId: string, fraction: number): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.subtasks.length) return;
    const doneCount = Math.min(task.subtasks.length, Math.floor(fraction * task.subtasks.length + 1e-9));
    if (task.subtasks.filter((s) => s.done).length >= doneCount) return;
    this.tasks.set(taskId, { ...task, subtasks: task.subtasks.map((s, i) => (i < doneCount && !s.done ? { ...s, done: true } : s)) });
  }

  private updateTask(taskId: string, fn: (task: Task) => Task): void {
    const task = this.tasks.get(taskId);
    if (task) this.tasks.set(taskId, fn(task));
  }

  private task(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    return task;
  }

  private template(taskId: string): WorkTemplate {
    const task = this.task(taskId);
    return matchWorkTemplate(task.title, task.description, this.templates);
  }

  private controller(id: AgentId): AgentController {
    const c = this.controllers.get(id);
    if (!c) throw new Error(`Unknown agent: ${id}`);
    return c;
  }

  private onArrived(agent: AgentController, location: LocationId, taskId: string | undefined): void {
    this.emit("agent.arrived", `${agent.def.name} arrived at the ${LOCATIONS[location].label}`, {
      agentId: agent.id,
      taskId,
      feed: false,
      metadata: { location },
    });
  }

  private emit(type: AgentEventType, message: string, input: EmitInput = {}): void {
    this.eventSeq += 1;
    const event: AgentEvent = {
      id: `E-${this.eventSeq}`,
      type,
      timestamp: this.now(),
      simTime: this.clock,
      message,
      severity: input.severity ?? "info",
      feed: input.feed ?? true,
    };
    if (input.agentId) event.agentId = input.agentId;
    if (input.targetAgentId) event.targetAgentId = input.targetAgentId;
    if (input.taskId) event.taskId = input.taskId;
    if (input.metadata) event.metadata = input.metadata;
    this.events.emit(event);
  }

  private publish(): void {
    if (this.snapshots.size) this.snapshots.emit(this.snapshot());
  }
}

