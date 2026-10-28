import { getAgent, type AgentId, type AgentStatus, type EventSeverity, type TaskPriority, type TaskStatus } from "@agent-world/core";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function AgentAvatar({ id, size = 24 }: { id: AgentId; size?: number }) {
  const def = getAgent(id);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink-950"
      style={{ width: size, height: size, background: def.color, fontSize: size * 0.45 }}
      title={`${def.name} · ${def.roleLabel}`}
    >
      {def.name[0]}
    </span>
  );
}

const STATUS_STYLE: Record<AgentStatus | "paused", string> = {
  idle: "bg-white/5 text-mist-500",
  walking: "bg-signal/10 text-signal",
  working: "bg-signal/15 text-signal-strong",
  thinking: "bg-[#a78bfa]/15 text-[#c4b5fd]",
  communicating: "bg-signal/15 text-signal-strong",
  success: "bg-ok/15 text-ok",
  error: "bg-warn/15 text-warn",
  paused: "bg-warn/15 text-warn",
};

export function StatusPill({ status, paused }: { status: AgentStatus; paused?: boolean }) {
  const key = paused ? "paused" : status;
  return <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[key])}>{key}</span>;
}

const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  queued: "bg-white/5 text-mist-500",
  assigned: "bg-signal/10 text-signal",
  in_progress: "bg-signal/15 text-signal-strong",
  testing: "bg-ok/10 text-ok",
  review: "bg-[#f08a7e]/15 text-[#f5b0a7]",
  blocked: "bg-warn/15 text-warn",
  completed: "bg-ok/15 text-ok",
  failed: "bg-bad/15 text-bad",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={cx("rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", TASK_STATUS_STYLE[status])}>{status.replace("_", " ")}</span>;
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  critical: "text-bad border-bad/40",
  high: "text-warn border-warn/40",
  medium: "text-mist-300 border-white/15",
  low: "text-mist-500 border-white/10",
};

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  return <span className={cx("rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide", PRIORITY_STYLE[priority])}>{priority}</span>;
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: color }} />
    </div>
  );
}

const SEVERITY_COLOR: Record<EventSeverity, string> = { info: "#7cc4d6", success: "#6fe3a4", warning: "#f2b46a", error: "#ff8a7a" };

export function SeverityDot({ severity }: { severity: EventSeverity }) {
  return <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[severity] }} />;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[9px] border border-white/[0.08] bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-[26px] rounded-[7px] px-2.5 text-[12px] font-medium transition-colors",
            o.value === value ? "bg-white/10 text-mist-100" : "text-mist-500 hover:text-mist-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1">
      <span>
        <span className="block text-[13px] text-mist-100">{label}</span>
        {hint && <span className="block text-[11.5px] text-mist-500">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7cc4d6]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Relative time on the backend clock ("just now", "12s ago", "3m ago"). */
export function relTime(at: number, clock: number): string {
  const d = Math.max(0, clock - at);
  if (d < 3) return "just now";
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

export function clockLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
