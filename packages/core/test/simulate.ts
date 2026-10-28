/**
 * Headless engine tests. Run with: node --experimental-strip-types test/simulate.ts
 * Prints ✓/✗ per check and exits 1 on any failure.
 */
import { AGENTS } from "../src/agents/AgentRegistry.ts";
import { isCommunication, type AgentEvent, type AgentEventType } from "../src/events/eventTypes.ts";
import { SimulationEngine } from "../src/simulation/SimulationEngine.ts";
import { matchWorkTemplate, GENERIC_TEMPLATE } from "../src/simulation/workContent.ts";
import { canTransition, isTerminal } from "../src/simulation/WorkflowStateMachine.ts";
import { slotFor } from "../src/simulation/worldLayout.ts";
import { DEMO_TASK } from "../src/tasks/taskActions.ts";
import { HOTFIX_TITLE, MIGRATION_TITLE, SPRINT_TASKS, TASK_BACKLOG } from "../src/tasks/taskBacklog.ts";
import type { Task, WorkflowPhase } from "../src/tasks/taskTypes.ts";

const DT = 1 / 30;
let failures = 0;
let section = "";

function group(name: string): void {
  section = name;
  console.log(`\n${name}`);
}

function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail === undefined ? "" : ` (${typeof detail === "string" ? detail : JSON.stringify(detail)})`}`);
  }
}

function run(engine: SimulationEngine, until: () => boolean, maxSeconds: number): number {
  const steps = Math.ceil(maxSeconds / DT);
  for (let i = 0; i < steps; i++) {
    if (until()) break;
    engine.tick(DT);
  }
  return engine.getClock();
}

function collect(engine: SimulationEngine): AgentEvent[] {
  const events: AgentEvent[] = [];
  engine.events.subscribe((e) => events.push(e));
  return events;
}

function phaseOrder(task: Task): WorkflowPhase[] {
  return ["queued", ...task.history.map((h) => h.to)];
}

function runDemo(): { engine: SimulationEngine; events: AgentEvent[]; task: Task; clock: number } {
  const engine = new SimulationEngine({ now: () => 0 });
  const events = collect(engine);
  engine.emitBootEvents();
  engine.start();
  const created = engine.submitTask(DEMO_TASK);
  // The task is "done" when review approves; Orion's announcement (task.completed) closes the run.
  const finished = () => events.some((e) => e.taskId === created.id && (e.type === "task.completed" || e.type === "task.failed"));
  const clock = run(engine, finished, 200);
  return { engine, events, task: engine.getTask(created.id)!, clock };
}

// 1 ---------------------------------------------------------------------------
group("1. Workflow state machine");
check("testing --tests_failed--> allowed", canTransition("testing", "tests_failed"));
check("queued --approved--> rejected", !canTransition("queued", "approved"));
check("done is terminal", isTerminal("done") && !canTransition("done", "abort"));

// 2 ---------------------------------------------------------------------------
group("2. Demo workflow");
const demo = runDemo();
const types = new Set<AgentEventType>(demo.events.map((e) => e.type));
check("boot events ≥ 3", demo.events.filter((e) => e.simTime === 0 && (e.type === "system.ready" || e.type === "agent.message")).length >= 3);
check("task done/completed", demo.task.phase === "done" && demo.task.status === "completed", `${demo.task.phase}/${demo.task.status}`);
check("iteration === 2", demo.task.iteration === 2, demo.task.iteration);
check("progress === 1", demo.task.progress === 1, demo.task.progress);
check("all subtasks done", demo.task.subtasks.length > 0 && demo.task.subtasks.every((s) => s.done));
check("findings non-empty", demo.task.findings.length > 0);
const required: AgentEventType[] = [
  "task.created", "task.assigned", "plan.created", "research.completed", "implementation.started",
  "implementation.submitted", "qa.failed", "qa.passed", "review.approved", "task.completed",
];
const missing = required.filter((t) => !types.has(t));
check("required events emitted", missing.length === 0, missing);
const comms = demo.events.filter(isCommunication).length;
check("≥ 7 agent-to-agent communications", comms >= 7, comms);
const expectedOrder: WorkflowPhase[] = ["queued", "intake", "planning", "research", "implementation", "testing", "implementation", "testing", "review", "done"];
check("phase order", phaseOrder(demo.task).join(">") === expectedOrder.join(">"), phaseOrder(demo.task).join(" → "));
check("completes in < 100 sim s", demo.clock < 100, `${demo.clock.toFixed(2)} s`);
console.log(`    demo finished at ${demo.clock.toFixed(2)} sim s`);

// 3 ---------------------------------------------------------------------------
group("3. Determinism");
const again = runDemo();
check("second run within 0.05 sim s", Math.abs(again.clock - demo.clock) <= 0.05, `${demo.clock} vs ${again.clock}`);
check("same event sequence", again.events.map((e) => e.type).join() === demo.events.map((e) => e.type).join());

// 4 ---------------------------------------------------------------------------
group("4. Pause / resume / reset");
{
  const engine = new SimulationEngine();
  engine.start();
  const task = engine.submitTask(DEMO_TASK);
  run(engine, () => engine.getTask(task.id)!.phase === "research", 60);
  engine.pause();
  const before = JSON.stringify(engine.snapshot());
  for (let i = 0; i < 60; i++) engine.tick(DT);
  check("paused snapshot does not change", JSON.stringify(engine.snapshot()) === before);
  engine.resume();
  const progressBefore = engine.getTask(task.id)!.progress;
  for (let i = 0; i < 60; i++) engine.tick(DT);
  check("resumed progresses", engine.getTask(task.id)!.progress > progressBefore || engine.getTask(task.id)!.phase !== "research");

  const owner = engine.getTask(task.id)!.assignedAgentId!;
  engine.pauseAgent(owner);
  check(`pauseAgent(${owner}) blocks the task`, engine.getTask(task.id)!.status === "blocked" && !!engine.getTask(task.id)!.blockedReason);
  const frozen = engine.getTask(task.id)!.progress;
  for (let i = 0; i < 90; i++) engine.tick(DT);
  check("paused owner makes no progress", engine.getTask(task.id)!.progress === frozen);
  engine.resumeAgent(owner);
  check("resumeAgent unblocks", engine.getTask(task.id)!.status !== "blocked" && engine.getTask(task.id)!.blockedReason === null);

  const random = engine.submitTask({ title: "Add an audit log to the admin API", priority: "medium" });
  run(engine, () => isTerminal(engine.getTask(random.id)!.phase) && isTerminal(engine.getTask(task.id)!.phase), 400);
  check("random task terminates", isTerminal(engine.getTask(random.id)!.phase), engine.getTask(random.id)!.phase);

  engine.reset();
  const s = engine.snapshot();
  const atHome = s.agents.every((a) => {
    const def = AGENTS.find((d) => d.id === a.id)!;
    const home = slotFor(def.home, def.seat);
    return a.status === "idle" && a.location === def.home && a.position.x === home.x && a.position.z === home.z;
  });
  check("reset: 0 tasks, ready, clock 0", s.tasks.length === 0 && s.status === "ready" && s.clock === 0);
  check("reset: agents idle at stations", atHome);
}

// 5 ---------------------------------------------------------------------------
group("5. Concurrency + priority");
{
  const engine = new SimulationEngine();
  engine.start();
  const low = engine.submitTask({ title: "Redesign the analytics dashboard cards", priority: "low" });
  const medium = engine.submitTask({ title: "Ship full-text search for the help center", priority: "medium" });
  const critical = engine.submitTask({ title: "Fix memory leak in the image-processing worker", priority: "critical" });
  engine.tick(DT);
  const phase = (t: Task) => engine.getTask(t.id)!.phase;
  check("critical started", phase(critical) !== "queued");
  check("medium started", phase(medium) !== "queued");
  check("low stays queued", phase(low) === "queued");
  run(engine, () => [low, medium, critical].every((t) => isTerminal(phase(t))), 600);
  check("all three finish", [low, medium, critical].every((t) => isTerminal(phase(t))), [low, medium, critical].map(phase));
}

// 6 ---------------------------------------------------------------------------
group("6. Backlog + sprint");
{
  const titles = new Set(TASK_BACKLOG.map((t) => t.title));
  check("≥ 15 backlog tasks with unique titles", TASK_BACKLOG.length >= 15 && titles.size === TASK_BACKLOG.length, TASK_BACKLOG.length);
  const generic = TASK_BACKLOG.filter((t) => matchWorkTemplate(t.title, t.description) === GENERIC_TEMPLATE);
  check("≤ 2 fall through to the generic template", generic.length <= 2, generic.map((t) => t.title));
  check("sprint has 8 tasks", SPRINT_TASKS.length === 8);

  const engine = new SimulationEngine();
  engine.start();
  const sprint = SPRINT_TASKS.map((input) => engine.submitTask(input));
  const all = () => sprint.map((t) => engine.getTask(t.id)!);
  const clock = run(engine, () => all().every((t) => isTerminal(t.phase)), 1500);
  const tasks = all();
  check("sprint terminates", tasks.every((t) => isTerminal(t.phase)), `${clock.toFixed(1)} s`);
  const hotfix = tasks.find((t) => t.title === HOTFIX_TITLE)!;
  check("hot-fix done at iteration 3", hotfix.phase === "done" && hotfix.iteration === 3, `${hotfix.phase} @${hotfix.iteration}`);
  const migration = tasks.find((t) => t.title === MIGRATION_TITLE)!;
  check("migration failed", migration.phase === "failed", migration.phase);
  const done = tasks.filter((t) => t.phase === "done").length;
  check("≥ 5 of 8 complete", done >= 5, done);
  check("every task has subtasks and findings", tasks.every((t) => t.subtasks.length > 0 && t.findings.length > 0));
  console.log(`    sprint finished at ${clock.toFixed(1)} sim s, ${done}/8 done`);
}

// 7 ---------------------------------------------------------------------------
group("7. Always-on soak (2 simulated hours)");
{
  const engine = new SimulationEngine({ config: { maxRetainedTasks: 12 } });
  let events = 0;
  engine.events.subscribe(() => {
    events += 1;
  });
  engine.start();
  engine.setSpeed(4);
  let submitted = 0;
  let maxTasks = 0;
  let maxLinks = 0;
  const step = 0.1;
  for (let t = 0; t < 7200; t += step * 4) {
    const s = engine.snapshot();
    if (s.tasks.filter((x) => !isTerminal(x.phase)).length < 3) {
      engine.submitTask(TASK_BACKLOG[submitted % TASK_BACKLOG.length]);
      submitted += 1;
    }
    engine.tick(step);
    maxTasks = Math.max(maxTasks, s.tasks.length);
    maxLinks = Math.max(maxLinks, s.links.length);
  }
  const finalCount = engine.snapshot().tasks.length;
  console.log(`    ${submitted} tasks submitted, ${events} events, peak ${maxTasks} tasks / ${maxLinks} links in memory`);
  check("processed many tasks", submitted > 60, submitted);
  check("retained tasks stay bounded", maxTasks <= 12 + 3 + 1 && finalCount <= 16, maxTasks);
  check("comm links stay bounded", maxLinks <= 8, maxLinks);
}

console.log(failures ? `\n✗ ${failures} check(s) failed (last group: ${section})` : "\n✓ all checks passed");
process.exit(failures ? 1 : 0);
