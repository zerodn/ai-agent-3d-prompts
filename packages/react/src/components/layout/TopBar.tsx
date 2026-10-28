import { isTerminal } from "@agent-world/core";
import { forwardRef, useMemo } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { SimulationControls } from "../controls/SimulationControls";
import { clockLabel, cx } from "../ui";

export const TopBar = forwardRef<HTMLDivElement>(function TopBar(_, ref) {
  const agents = useWorldStore((s) => s.agents);
  const tasks = useWorldStore((s) => s.tasks);
  const status = useWorldStore((s) => s.simStatus);
  const clock = useWorldStore((s) => s.clock);
  const backend = useWorldStore((s) => s.backend);

  const metrics = useMemo(() => {
    const active = agents.filter((a) => !a.paused && (a.currentTaskId || a.status === "working" || a.status === "thinking" || a.status === "communicating")).length;
    const pending = tasks.filter((t) => !isTerminal(t.phase)).length;
    const completed = tasks.filter((t) => t.phase === "done").length;
    return [
      { label: "Agents", value: agents.length || 6 },
      { label: "Active", value: active },
      { label: "Pending", value: pending },
      { label: "Completed", value: completed },
    ];
  }, [agents, tasks]);

  const dot = status === "running" ? "bg-ok pulse-dot" : status === "paused" ? "bg-warn" : "bg-mist-500";

  return (
    <header ref={ref} className="surface pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold tracking-tight">AI Agent World</h1>
        <p className={cx("text-[11.5px]", backend.simulated ? "text-warn" : "text-ok")}>
          {backend.simulated ? "Simulation mode · no live inference" : `Live backend · ${backend.label}`}
        </p>
      </div>
      <dl className="flex items-center gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <dt className="eyebrow !text-[9.5px]">{m.label}</dt>
            <dd className="font-mono text-[15px] font-semibold tabular-nums">{m.value}</dd>
          </div>
        ))}
        <div className="text-center">
          <dt className="eyebrow !text-[9.5px]">Status</dt>
          <dd className="flex items-center gap-1.5 text-[12.5px] capitalize">
            <span className={cx("h-2 w-2 rounded-full", dot)} />
            {status}
            <span className="font-mono text-[11px] text-mist-500 tabular-nums">{clockLabel(clock)}</span>
          </dd>
        </div>
      </dl>
      <div className="ml-auto">
        <SimulationControls />
      </div>
    </header>
  );
});
