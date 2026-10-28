import { DEMO_TASK, getAgent, pickRandomTask, TASK_SUGGESTIONS, type AgentId, type TaskPriority } from "@agent-world/core";
import { Dices, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { submitFromDialog } from "../actions";
import { cx, Segmented } from "../ui";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];

export function TaskDialog() {
  const dialog = useWorldStore((s) => s.dialog);
  const closeDialog = useWorldStore((s) => s.closeDialog);
  if (!dialog.open) return null;
  return <DialogBody key={dialog.preferredAgentId ?? "any"} preferredAgentId={dialog.preferredAgentId} onClose={closeDialog} />;
}

function DialogBody({ preferredAgentId, onClose }: { preferredAgentId: AgentId | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const titleRef = useRef<HTMLInputElement>(null);
  const simulated = useWorldStore((s) => s.backend.simulated);
  const preferred = preferredAgentId ? getAgent(preferredAgentId) : null;

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fill = (input: { title: string; description?: string; priority?: TaskPriority }) => {
    setTitle(input.title);
    setDescription(input.description ?? "");
    setPriority(input.priority ?? "medium");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const isDemo = t === DEMO_TASK.title;
    void submitFromDialog({
      ...(isDemo ? DEMO_TASK : {}),
      title: t,
      description: description.trim() || undefined,
      priority,
      preferredAgentId: preferredAgentId ?? undefined,
    });
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="aaw-dialog-title" onSubmit={submit} className="surface w-full max-w-[520px] space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="aaw-dialog-title" className="text-[16px] font-semibold">
              New task
            </h2>
            <p className="text-[12.5px] text-mist-500">The Orchestrator picks it up and routes it through plan, research, build, QA and review.</p>
          </div>
          <button type="button" className="btn btn-quiet w-[30px] px-0" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {preferred && (
          <p className="rounded-[10px] border border-signal/25 bg-signal/[0.07] px-3 py-2 text-[12.5px] text-mist-300">
            Requested from <span style={{ color: preferred.color }}>{preferred.name}</span> — routed via the Orchestrator so the full workflow still applies.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {TASK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => fill(s === DEMO_TASK.title ? DEMO_TASK : { title: s })}
              className={cx(
                "max-w-full truncate rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                title === s ? "border-signal/50 bg-signal/10 text-signal-strong" : "border-white/[0.08] text-mist-300 hover:bg-white/5",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="block space-y-1">
          <span className="eyebrow">Title</span>
          <input ref={titleRef} className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Add rate limiting to the public API" maxLength={140} />
        </label>
        <label className="block space-y-1">
          <span className="eyebrow">Description</span>
          <textarea className="field min-h-[78px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional context for the team" maxLength={600} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow">Priority</span>
          <Segmented label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: <span className="capitalize">{p}</span> }))} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button type="button" className="btn btn-ghost" onClick={() => fill(DEMO_TASK)}>
            <Sparkles size={14} />
            Use demo task
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fill(pickRandomTask([title]))}>
            <Dices size={14} />
            Surprise me
          </button>
          <span className="ml-auto flex gap-1.5">
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Submit
            </button>
          </span>
        </div>
        {simulated && (
          <p className="border-t border-white/[0.06] pt-3 text-[11.5px] text-warn/90">
            Simulation mode — agents act out the workflow; no AI inference or code execution happens.
          </p>
        )}
      </form>
    </div>
  );
}
