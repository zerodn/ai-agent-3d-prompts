import { SIMULATION_CONFIG } from "@agent-world/core";
import { Layers, Pause, Play, Plus, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { commands } from "../../state/backendClient";
import { useWorldStore } from "../../state/useWorldStore";
import { loadSprint, runDemo, togglePlay } from "../actions";
import { Segmented } from "../ui";

export function SimulationControls() {
  const status = useWorldStore((s) => s.simStatus);
  const speed = useWorldStore((s) => s.speed);
  const sound = useWorldStore((s) => s.sound);
  const setSound = useWorldStore((s) => s.setSound);
  const openDialog = useWorldStore((s) => s.openDialog);
  const [confirmReset, setConfirmReset] = useState(false);

  const playLabel = status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className="btn btn-ghost" onClick={() => void togglePlay()} title={`${playLabel} (Space)`}>
        {status === "running" ? <Pause size={14} /> : <Play size={14} />}
        {playLabel}
      </button>
      <Segmented
        label="Simulation speed"
        value={speed}
        onChange={(v) => void commands.setSpeed(v)}
        options={SIMULATION_CONFIG.speeds.map((s) => ({ value: s, label: `${s}×` }))}
      />
      <button
        type="button"
        className="btn btn-quiet w-[30px] px-0"
        onClick={() => setSound({ enabled: !sound.enabled })}
        aria-label={sound.enabled ? "Mute sound (M)" : "Unmute sound (M)"}
        title={sound.enabled ? "Mute (M)" : "Unmute (M)"}
      >
        {sound.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
      {confirmReset ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost text-warn"
            onClick={() => {
              setConfirmReset(false);
              void commands.reset();
              useWorldStore.getState().select(null);
              useWorldStore.getState().clearEvents();
            }}
          >
            Confirm reset
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn-quiet" onClick={() => setConfirmReset(true)} title="Reset the simulation">
          <RotateCcw size={14} />
          Reset
        </button>
      )}
      <span className="mx-1 hidden h-5 w-px bg-white/10 lg:block" />
      <button type="button" className="btn btn-ghost" onClick={() => void runDemo()} title="Run the scripted demo task">
        <Sparkles size={14} />
        Run demo
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => void loadSprint()} title="Load an 8-task sprint (B)">
        <Layers size={14} />
        Load sprint
      </button>
      <button type="button" className="btn btn-primary" onClick={() => openDialog()} title="New task (N)">
        <Plus size={14} />
        New task
      </button>
    </div>
  );
}
