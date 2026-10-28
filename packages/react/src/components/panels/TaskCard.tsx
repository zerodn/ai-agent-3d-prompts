import { getAgent, PHASE_LABEL, type Task } from "@agent-world/core";
import { RefreshCw } from "lucide-react";
import { memo } from "react";
import { AgentAvatar, cx, PriorityTag, ProgressBar, relTime, TaskStatusBadge } from "../ui";

export function taskColor(task: Task): string {
  if (task.phase === "done") return "#6fe3a4";
  if (task.phase === "failed") return "#ff8a7a";
  if (task.status === "blocked") return "#f2b46a";
  return task.assignedAgentId ? getAgent(task.assignedAgentId).color : "#7c8797";
}

export const TaskCard = memo(function TaskCard({
  task,
  clock,
  compact,
  selected,
  onSelect,
}: {
  task: Task;
  clock: number;
  compact?: boolean;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className={cx(
        "w-full rounded-[11px] border p-2.5 text-left transition-colors",
        selected ? "border-signal/50 bg-signal/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-mist-500">{task.id}</span>
        <TaskStatusBadge status={task.status} />
        {task.isDemo && <span className="rounded bg-[#a78bfa]/20 px-1.5 py-px text-[10px] font-semibold text-[#c4b5fd]">DEMO</span>}
        <span className="ml-auto">
          <PriorityTag priority={task.priority} />
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium leading-snug text-mist-100">{task.title}</p>
      {!compact && task.description && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-mist-500">{task.description}</p>}
      <div className="mt-2">
        <ProgressBar value={task.progress} color={taskColor(task)} />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-mist-500">
        {task.assignedAgentId ? <AgentAvatar id={task.assignedAgentId} size={16} /> : null}
        <span className="truncate">{task.phase === "queued" ? "Waiting for orchestrator" : PHASE_LABEL[task.phase]}</span>
        {task.iteration > 1 && (
          <span className="flex items-center gap-0.5 text-warn" title="Implementation attempts">
            <RefreshCw size={11} />
            {task.iteration - 1}
          </span>
        )}
        <span className="ml-auto shrink-0">{relTime(task.updatedAt, clock)}</span>
      </div>
    </button>
  );
});
