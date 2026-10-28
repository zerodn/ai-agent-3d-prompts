import { type AgentEvent, type AgentId } from "@agent-world/core";
import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { AgentAvatar, clockLabel, SeverityDot } from "../ui";

export const ActivityRow = memo(function ActivityRow({ event, onAgent }: { event: AgentEvent; onAgent?: (id: AgentId) => void }) {
  const clickable = !!(onAgent && event.agentId);
  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => event.agentId && onAgent?.(event.agentId)}
        className="flex w-full items-start gap-2 rounded-[8px] px-1.5 py-1 text-left enabled:hover:bg-white/[0.04]"
      >
        <SeverityDot severity={event.severity} />
        <span className="w-10 shrink-0 font-mono text-[11px] text-mist-500 tabular-nums">{clockLabel(event.simTime)}</span>
        {event.agentId && (
          <span className="flex shrink-0 items-center gap-0.5">
            <AgentAvatar id={event.agentId} size={16} />
            {event.targetAgentId && (
              <>
                <ArrowRight size={10} className="text-mist-500" />
                <AgentAvatar id={event.targetAgentId} size={16} />
              </>
            )}
          </span>
        )}
        <span className="min-w-0 text-[12.5px] leading-snug text-mist-300">{event.message}</span>
      </button>
    </li>
  );
});

export function ActivityList({ events, empty }: { events: readonly AgentEvent[]; empty?: string }) {
  const select = useWorldStore((s) => s.select);
  const setTab = useWorldStore((s) => s.setTab);
  const onAgent = (id: AgentId) => {
    select({ kind: "agent", id });
    setTab("agents");
  };
  if (!events.length) return <p className="px-1.5 text-[12.5px] text-mist-500">{empty ?? "Nothing yet."}</p>;
  return (
    <ul className="space-y-0.5">
      {events.map((e) => (
        <ActivityRow key={e.id} event={e} onAgent={onAgent} />
      ))}
    </ul>
  );
}
