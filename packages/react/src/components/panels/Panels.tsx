import {
  AGENTS,
  feedEvents,
  filterTasks,
  isTaskActive,
  latest,
  locationLabel,
  messageEvents,
  SIMULATION_CONFIG,
  sortTasksForList,
  type AgentId,
  type TaskFilter,
} from "@agent-world/core";
import { Layers, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { agentRenderPositions } from "../../world/labelAnchors";
import { STATION_LABEL, STATION_OWNER } from "../../world/stationOwners";
import { loadSprint, runDemo } from "../actions";
import { ActivityList } from "../activity/ActivityFeed";
import { AgentAvatar, cx, Section, Segmented, StatusPill, Toggle } from "../ui";
import { AgentDetails } from "./AgentDetails";
import { TaskCard } from "./TaskCard";
import { TaskDetails } from "./TaskDetails";

/** Select an agent, switch to its panel and bring the camera to it. */
function useFocusAgent(): (id: AgentId) => void {
  const select = useWorldStore((s) => s.select);
  const setTab = useWorldStore((s) => s.setTab);
  const requestCamera = useWorldStore((s) => s.requestCamera);
  return (id) => {
    select({ kind: "agent", id });
    setTab("agents");
    const p = agentRenderPositions.get(id);
    if (p) requestCamera({ focus: { x: p.x, y: 1, z: p.z }, distance: 7.5 });
  };
}

function useSelectTask(): (id: string) => void {
  const select = useWorldStore((s) => s.select);
  const setTab = useWorldStore((s) => s.setTab);
  return (id) => {
    select({ kind: "task", id });
    setTab("tasks");
  };
}

function AgentRoster({ compact }: { compact?: boolean }) {
  const agents = useWorldStore((s) => s.agents);
  const tasks = useWorldStore((s) => s.tasks);
  const focusAgent = useFocusAgent();
  return (
    <ul className="space-y-1">
      {AGENTS.map((def) => {
        const agent = agents.find((a) => a.id === def.id);
        const task = agent?.currentTaskId ? tasks.find((t) => t.id === agent.currentTaskId) : undefined;
        return (
          <li key={def.id}>
            <button type="button" onClick={() => focusAgent(def.id)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-white/[0.04]">
              <AgentAvatar id={def.id} size={compact ? 24 : 30} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] font-medium">{def.name}</span>
                  <span className="truncate text-[11.5px] text-mist-500">{def.roleLabel}</span>
                </span>
                {!compact && (
                  <span className="block truncate text-[11.5px] text-mist-500">
                    {agent?.paused ? "Paused by operator" : agent?.activity}
                    {task ? ` · ${task.id}` : ` · ${locationLabel(agent?.location ?? null)}`}
                  </span>
                )}
              </span>
              {agent && <StatusPill status={agent.status} paused={agent.paused} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OverviewPanel() {
  const tasks = useWorldStore((s) => s.tasks);
  const events = useWorldStore((s) => s.events);
  const clock = useWorldStore((s) => s.clock);
  const simulated = useWorldStore((s) => s.backend.simulated);
  const openDialog = useWorldStore((s) => s.openDialog);
  const setTab = useWorldStore((s) => s.setTab);
  const selectTask = useSelectTask();
  const inFlight = useMemo(() => sortTasksForList(tasks.filter(isTaskActive)), [tasks]);
  const recent = useMemo(() => latest(feedEvents(events), 8), [events]);

  return (
    <div className="space-y-5">
      {tasks.length === 0 && (
        <div className="space-y-3 rounded-[12px] border border-signal/20 bg-gradient-to-br from-signal/[0.08] to-[#a78bfa]/[0.06] p-3.5">
          <div>
            <h3 className="text-[14px] font-semibold">Watch the team ship a feature</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
              Run the demo and Orion delegates a JWT auth API to Piper, Iris researches it, Kai builds it, Quinn&apos;s tests fail once, Kai fixes it, and Rex approves.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-primary" onClick={() => void runDemo()}>
              <Sparkles size={14} />
              Run demo
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void loadSprint()}>
              <Layers size={14} />
              Load sprint
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openDialog()}>
              <Plus size={14} />
              New task
            </button>
          </div>
          <p className="text-[11.5px] text-mist-500">
            The sprint queues 8 tasks: a critical hot-fix that needs two reworks, a migration that fails after {SIMULATION_CONFIG.maxIterations} attempts, and a low-priority export that waits its turn.
            {simulated && " Everything is simulated; no model is called."}
          </p>
        </div>
      )}

      <Section title="Team">
        <AgentRoster compact />
      </Section>

      <Section title="In flight" right={<span className="text-[11px] text-mist-500">{inFlight.length} active</span>}>
        {inFlight.length ? (
          <div className="space-y-1.5">
            {inFlight.map((t) => (
              <TaskCard key={t.id} task={t} clock={clock} compact onSelect={selectTask} />
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-mist-500">{tasks.length ? "Nothing in progress right now." : "No tasks yet."}</p>
        )}
      </Section>

      <Section
        title="Latest activity"
        right={
          <button type="button" className="text-[11px] text-signal hover:underline" onClick={() => setTab("activity")}>
            View all
          </button>
        }
      >
        <ActivityList events={recent} empty="Waiting for the first event." />
      </Section>
    </div>
  );
}

function AgentsPanel() {
  const selection = useWorldStore((s) => s.selection);
  const select = useWorldStore((s) => s.select);
  if (selection?.kind === "agent") return <AgentDetails id={selection.id} onBack={() => select(null)} />;
  if (selection?.kind === "station") {
    return (
      <div className="space-y-3">
        <p className="eyebrow">{STATION_LABEL[selection.id]}</p>
        <AgentDetails id={STATION_OWNER[selection.id]} onBack={() => select(null)} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-mist-500">Click an agent or a desk in the office, or pick one below.</p>
      <AgentRoster />
    </div>
  );
}

function TasksPanel() {
  const tasks = useWorldStore((s) => s.tasks);
  const clock = useWorldStore((s) => s.clock);
  const selection = useWorldStore((s) => s.selection);
  const select = useWorldStore((s) => s.select);
  const openDialog = useWorldStore((s) => s.openDialog);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const selectTask = useSelectTask();

  const counts = useMemo(
    () => ({ all: tasks.length, active: filterTasks(tasks, "active").length, queued: filterTasks(tasks, "queued").length, done: filterTasks(tasks, "done").length }),
    [tasks],
  );
  const list = useMemo(() => sortTasksForList(filterTasks(tasks, filter)), [tasks, filter]);

  const selected = selection?.kind === "task" ? tasks.find((t) => t.id === selection.id) : undefined;
  if (selected) return <TaskDetails task={selected} onBack={() => select(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="btn btn-primary" onClick={() => openDialog()}>
          <Plus size={14} />
          New task
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void runDemo()}>
          <Sparkles size={14} />
          Demo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void loadSprint()}>
          <Layers size={14} />
          Sprint
        </button>
      </div>
      <Segmented
        label="Task filter"
        value={filter}
        onChange={setFilter}
        options={(["all", "active", "queued", "done"] as const).map((f) => ({ value: f, label: <span className="capitalize">{`${f} ${counts[f]}`}</span> }))}
      />
      {list.length ? (
        <div className="space-y-1.5">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} clock={clock} onSelect={selectTask} />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-mist-500">{tasks.length ? "No tasks match this filter." : "No tasks yet. Run the demo or create one."}</p>
      )}
    </div>
  );
}

function ActivityPanel() {
  const events = useWorldStore((s) => s.events);
  const [messagesOnly, setMessagesOnly] = useState(false);
  const list = useMemo(() => (messagesOnly ? messageEvents(events) : feedEvents(events)).reverse(), [events, messagesOnly]);
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-mist-300">
        <input type="checkbox" className="h-3.5 w-3.5 accent-[#7cc4d6]" checked={messagesOnly} onChange={(e) => setMessagesOnly(e.target.checked)} />
        Messages only
      </label>
      <ActivityList events={list} empty={messagesOnly ? "No agent-to-agent messages yet." : "No activity yet."} />
    </div>
  );
}

const FPS_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 60, label: "60" },
  { value: 30, label: "30" },
];

function SettingsPanel() {
  const quality = useWorldStore((s) => s.quality);
  const qualityAuto = useWorldStore((s) => s.qualityAuto);
  const setQuality = useWorldStore((s) => s.setQuality);
  const maxFps = useWorldStore((s) => s.maxFps);
  const setMaxFps = useWorldStore((s) => s.setMaxFps);
  const overlays = useWorldStore((s) => s.overlays);
  const setOverlays = useWorldStore((s) => s.setOverlays);
  const sound = useWorldStore((s) => s.sound);
  const setSound = useWorldStore((s) => s.setSound);
  const backend = useWorldStore((s) => s.backend);
  const c = SIMULATION_CONFIG;

  const config: [string, string][] = [
    ["Max concurrent tasks", String(c.maxConcurrentTasks)],
    ["Max implementation attempts", String(c.maxIterations)],
    ["QA failure rate (unscripted)", `${Math.round(c.qaFailRate * 100)}%`],
    ["Review change rate (unscripted)", `${Math.round(c.reviewChangeRate * 100)}%`],
    ["Tick rate", `${c.tickHz} Hz`],
    ["Walk speed", `${c.walkSpeed} m/s`],
    ["Seed", String(c.seed)],
  ];

  return (
    <div className="space-y-6">
      <Section title="Rendering">
        <Segmented
          label="Rendering quality"
          value={quality}
          onChange={(q) => setQuality(q)}
          options={[
            { value: "high", label: "High quality" },
            { value: "low", label: "Performance" },
          ]}
        />
        <p className="text-[11.5px] leading-relaxed text-mist-500">
          Performance drops shadows and reflections, halves the skyline and caps resolution.
          {qualityAuto ? " Switched automatically because the frame rate dropped." : " The world switches automatically if the frame rate drops."}
        </p>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[13px]">Frame rate cap</span>
          <Segmented label="Frame rate cap" value={maxFps} onChange={setMaxFps} options={FPS_OPTIONS} />
        </div>
      </Section>

      <Section title="Overlays">
        <Toggle label="Walking paths & destinations" checked={overlays.paths} onChange={(paths) => setOverlays({ paths })} />
        <Toggle label="Agent speech indicators" hint="Bubbles while agents talk, succeed or hit an error" checked={overlays.speech} onChange={(speech) => setOverlays({ speech })} />
      </Section>

      <Section title="Sound">
        <Toggle label="Sound effects (M)" checked={sound.enabled} onChange={(enabled) => setSound({ enabled })} />
        <Toggle label="Ambient office hum" hint="Plays only while the simulation runs" checked={sound.ambient} onChange={(ambient) => setSound({ ambient })} />
        <label className="flex items-center gap-3 py-1 text-[13px]">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.volume}
            disabled={!sound.enabled}
            onChange={(e) => setSound({ volume: Number(e.target.value) })}
            className="flex-1 accent-[#7cc4d6]"
          />
          <span className="w-9 text-right font-mono text-[11.5px] text-mist-500">{Math.round(sound.volume * 100)}%</span>
        </label>
        <p className="text-[11.5px] text-mist-500">Every cue is synthesised in the browser and mirrors a real event: hand-offs, failed tests, approvals.</p>
      </Section>

      <Section title="Backend">
        <div className="space-y-1.5 rounded-[11px] border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px]">
          <p className="flex items-center gap-2">
            <span className={cx("h-2 w-2 rounded-full", backend.connected ? "bg-ok" : backend.error ? "bg-bad" : "bg-mist-500")} />
            {backend.label}
            <span className="text-mist-500">· {backend.connected ? "connected" : "disconnected"}</span>
          </p>
          {backend.error && <p className="text-bad">{backend.error}</p>}
          {backend.simulated ? (
            <p className="text-warn">Simulation mode: a deterministic local engine drives the agents. Outputs are canned templates; no LLM is called and no code runs.</p>
          ) : (
            <p className="text-mist-300">Events and snapshots stream from a live orchestrator.</p>
          )}
          <p className="text-[11.5px] text-mist-500">
            The host app chooses the backend. In the demo app set <code className="font-mono">NEXT_PUBLIC_AGENT_BACKEND=websocket</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_AGENT_WS_URL</code>.
          </p>
        </div>
      </Section>

      {backend.simulated && (
        <Section title="Simulation">
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[12.5px]">
            {config.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-mist-500">{k}</dt>
                <dd className="text-right font-mono text-mist-100">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </div>
  );
}

export const PANEL_TITLES = {
  overview: "Overview",
  agents: "Agents",
  tasks: "Tasks",
  activity: "Activity",
  settings: "Settings",
} as const;

export function ActivePanel() {
  const tab = useWorldStore((s) => s.tab);
  switch (tab) {
    case "agents":
      return <AgentsPanel />;
    case "tasks":
      return <TasksPanel />;
    case "activity":
      return <ActivityPanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return <OverviewPanel />;
  }
}
