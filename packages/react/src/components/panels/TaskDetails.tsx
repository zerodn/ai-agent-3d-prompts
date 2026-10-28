import { agentName, PHASE_LABEL, type Task } from "@agent-world/core";
import { AlertTriangle, ArrowLeft, Check, Circle, XCircle } from "lucide-react";
import { AgentAvatar, clockLabel, PriorityTag, ProgressBar, Section, TaskStatusBadge } from "../ui";
import { taskColor } from "./TaskCard";

export function TaskDetails({ task, onBack }: { task: Task; onBack: () => void }) {
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <div className="space-y-5">
      <div>
        <button type="button" className="btn btn-quiet -ml-2 mb-1 h-7 px-2" onClick={onBack}>
          <ArrowLeft size={14} />
          All tasks
        </button>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-mist-500">{task.id}</span>
          <TaskStatusBadge status={task.status} />
          <PriorityTag priority={task.priority} />
        </div>
        <h2 className="mt-1.5 text-[16px] font-semibold leading-snug">{task.title}</h2>
        {task.description && <p className="mt-1 text-[13px] leading-relaxed text-mist-300">{task.description}</p>}
      </div>

      {task.blockedReason && (
        <div className="flex items-center gap-2 rounded-[10px] border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle size={14} />
          Blocked: {task.blockedReason}
        </div>
      )}
      {task.phase === "failed" && (
        <div className="flex items-center gap-2 rounded-[10px] border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">
          <XCircle size={14} />
          Failed after {task.iteration} implementation attempts.
        </div>
      )}

      <Section title="Workflow">
        <div className="space-y-2 rounded-[11px] border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">{PHASE_LABEL[task.phase]}</span>
            <span className="font-mono text-[12px] text-mist-500">{Math.round(task.progress * 100)}%</span>
          </div>
          <ProgressBar value={task.progress} color={taskColor(task)} />
          <div className="flex items-center gap-2 text-[12.5px] text-mist-300">
            {task.assignedAgentId && <AgentAvatar id={task.assignedAgentId} size={18} />}
            {task.assignedAgentId ? `Owned by ${agentName(task.assignedAgentId)}` : "Unassigned"}
          </div>
          {task.iteration > 1 && <p className="text-[12.5px] text-warn">Reworked {task.iteration - 1}× after QA/review feedback</p>}
        </div>
      </Section>

      <Section title={`Task cards · ${task.subtasks.length}`} right={task.subtasks.length ? <span className="text-[11px] text-mist-500">{done} done</span> : null}>
        {task.subtasks.length ? (
          <ul className="space-y-1">
            {task.subtasks.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-[12.5px]">
                {s.done ? <Check size={14} className="mt-0.5 shrink-0 text-ok" /> : <Circle size={14} className="mt-0.5 shrink-0 text-mist-500" />}
                <span className={s.done ? "text-mist-300" : "text-mist-100"}>{s.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-mist-500">Piper creates task cards during planning.</p>
        )}
      </Section>

      <Section title="Research findings">
        {task.findings.length ? (
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] text-mist-300 marker:text-signal">
            {task.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-mist-500">Iris publishes findings after research.</p>
        )}
      </Section>

      <Section title="Timeline">
        <ol className="space-y-1 text-[12px]">
          {task.history.map((h, i) => (
            <li key={i} className="flex items-center gap-2 text-mist-300">
              <span className="w-11 font-mono text-mist-500">{clockLabel(h.at)}</span>
              <span>
                {PHASE_LABEL[h.from]} → <span className="text-mist-100">{PHASE_LABEL[h.to]}</span>
              </span>
              <span className="ml-auto font-mono text-[10.5px] text-mist-500">{h.signal}</span>
            </li>
          ))}
          {!task.history.length && <li className="text-mist-500">Queued at {clockLabel(task.createdAt)}</li>}
        </ol>
      </Section>
      <p className="text-[11px] text-mist-500">Simulated output from canned templates. No code was written and no model was called.</p>
    </div>
  );
}
