"use client";

import type { AgentBackend } from "@agent-world/core";
import { useEffect } from "react";
import { useWorldStore } from "../state/useWorldStore";
import { loadSoundSettings, saveSoundSettings, soundEngine } from "./soundEngine";

/** Mount once: wires backend events to cues and mirrors store settings into the engine. */
export function useSoundEffects(backend: AgentBackend): void {
  useEffect(() => {
    useWorldStore.getState().setSound(loadSoundSettings());
  }, []);

  useEffect(() => backend.subscribe((e) => soundEngine.play(e)), [backend]);

  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    soundEngine.configure(useWorldStore.getState().sound);
    soundEngine.setRunning(useWorldStore.getState().simStatus === "running");
    return useWorldStore.subscribe((s, prev) => {
      if (s.sound !== prev.sound) {
        soundEngine.configure(s.sound);
        saveSoundSettings(s.sound);
      }
      if (s.simStatus !== prev.simStatus) soundEngine.setRunning(s.simStatus === "running");
    });
  }, []);
}
