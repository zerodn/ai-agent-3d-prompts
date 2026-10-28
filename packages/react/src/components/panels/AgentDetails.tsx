import { communicationsForAgent, eventsForAgent, getAgent, locationLabel, type AgentId } from "@agent-world/core";
import { ArrowLeft, Crosshair, Eye, EyeOff, Pause, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { commands } from "../../state/backendClient";
import { useWorldStore } from "../../state/useWorldStore";
import { agentRenderPositions } from "../../world/labelAnchors";
import { ActivityList } from "../activity/ActivityFeed";
import { AgentAvatar, Segmented, StatusPill } from "../ui";

export function AgentDetails({ id, onBack }: { id: AgentId; onBack: () => void }) {
  const def = getAgent(id);
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === id));
  const tasks = useWorldStore((s) => s.tasks);
  const events = useWorldStore((s) => s.events);
  const followAgentId = useWorldStore((s) => s.followAgentId);
  const follow = useWorldStore((s) => s.follow);
  const openDialog = useWorldStore((s) => s.openDialog);
  const requestCamera = useWorldStore((s) => s.requestCamera);
  const [tab, setTab] = useState<"activity" | "comms">("activity");

  const activity = useMemo(() => eventsForAgent(events, id).reverse(), [events, id]);
  const comms = useMemo(() => communicationsForAgent(events, id).reverse(), [events, id]);
  const task = agent?.currentTaskId ? tasks.find((t) => t.id === agent.currentTaskId) : undefined;
  const following = followAgentId === id;

  const focus = () => {
    const p = agentRenderPositions.get(id);
    if (p) requestCamera({ focus: { x: p.x, y: 1, z: p.z }, distance: 7.5 });
  };

  return (
    <div className="space-y-4">
      <button type="button" className="btn btn-quiet -ml-2 h-7 px-2" onClick={onBack}>
        <ArrowLeft size={14} />
        All agents
      </button>
      <div className="flex items-center gap-3">
        <AgentAvatar id={id} size={40} />
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">{def.name}</h2>
          <p className="text-[12.5px] text-mist-300">{def.roleLabel}</p>
          <p className="text-[11.5px] text-mist-500">{def.tagline}</p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-[11px] border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px]">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Now</span>
          {agent && <StatusPill status={agent.status} paused={agent.paused} />}
        </div>
        <p className="text-mist-100">{agent?.paused ? "Paused by operator" : agent?.activity}</p>
        <p className="text-mist-500">Location: {locationLabel(agent?.location ?? agent?.destination ?? null)}</p>
        <p className="text-mist-500">Task: {task ? `${task.id} · ${task.title}` : "None"}</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className="btn btn-ghost" onClick={() => openDialog(id)}>
          <Plus size={14} />
          Assign task
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void (agent?.paused ? commands.resumeAgent(id) : commands.pauseAgent(id))}>
          {agent?.paused ? <Play size={14} /> : <Pause size={14} />}
          {agent?.paused ? "Resume agent" : "Pause agent"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => follow(following ? null : id)}>
          {following ? <EyeOff size={14} /> : <Eye size={14} />}
          {following ? "Stop following" : "Follow"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={focus}>
          <Crosshair size={14} />
          Focus camera
        </button>
      </div>

      <Segmented
        label="Agent history"
        value={tab}
        onChange={setTab}
        options={[
          { value: "activity", label: `Activity · ${activity.length}` },
          { value: "comms", label: `Communication · ${comms.length}` },
        ]}
      />
      <ActivityList events={tab === "activity" ? activity : comms} empty={`No ${tab === "activity" ? "activity" : "messages"} for ${def.name} yet.`} />
    </div>
  );
}
