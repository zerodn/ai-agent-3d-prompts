"use client";

import { SIMULATION_CONFIG, type AgentBackend } from "@agent-world/core";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useSoundEffects } from "../../audio/useSoundEffects";
import { commands, connectBackend } from "../../state/backendClient";
import { useWorldStore, type Quality } from "../../state/useWorldStore";
import { AgentLabelsOverlay } from "../../world/AgentLabelsOverlay";
import { loadSprint, togglePlay } from "../actions";
import { CameraBar } from "../controls/CameraBar";
import { SidePanel } from "../panels/SidePanel";
import { TaskDialog } from "../panels/TaskDialog";
import { LoadingScreen } from "./LoadingScreen";
import { NavRail } from "./NavRail";
import { TopBar } from "./TopBar";

// three and R3F only load in the browser, after the shell has painted.
const WorldCanvas = lazy(() => import("../../world/WorldCanvas").then((m) => ({ default: m.WorldCanvas })));

export interface AppShellProps {
  /** Any `AgentBackend`: the local simulation, a WebSocket orchestrator, or a host-specific adapter. */
  backend: AgentBackend;
  /** Start the simulation once the scene is ready. Defaults to the engine config. */
  autoStart?: boolean;
  /** Force a rendering quality instead of detecting it (`?quality=high|low` in the URL also works). */
  quality?: Quality;
}

function initialQuality(forced?: Quality): { quality: Quality; auto: boolean } {
  if (forced) return { quality: forced, auto: false };
  const param = new URLSearchParams(window.location.search).get("quality");
  if (param === "high" || param === "low") return { quality: param, auto: false };
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.innerWidth < 768;
  return { quality: weak || reducedMotion || narrow ? "low" : "high", auto: false };
}

const noopSubscribe = () => () => {};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The whole AI Agent World experience: 3D office, floating UI and sound, driven by one backend. */
export function AppShell({ backend, autoStart = SIMULATION_CONFIG.autoStart, quality }: AppShellProps) {
  // false during SSR and hydration, true afterwards: the canvas is client-only.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const sceneReady = useWorldStore((s) => s.sceneReady);
  const connected = useWorldStore((s) => s.backend.connected);

  useSoundEffects(backend);

  useLayoutEffect(() => {
    const q = initialQuality(quality);
    useWorldStore.getState().setQuality(q.quality, q.auto);
  }, [quality]);

  useEffect(() => connectBackend(backend), [backend]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!sceneReady || !connected || autoStarted.current) return;
    autoStarted.current = true;
    void commands.autoStartIfReady(autoStart);
  }, [sceneReady, connected, autoStart]);

  // Report how much of the viewport the floating UI covers so the camera can fit the free area.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      const nav = navRef.current?.getBoundingClientRect();
      const top = topRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      const cam = cameraRef.current?.getBoundingClientRect();
      const desktop = r.width >= 768;
      let bottom = r.bottom;
      if (cam) bottom = Math.min(bottom, cam.top - 8);
      if (!desktop) {
        if (panel) bottom = Math.min(bottom, panel.top);
        if (nav) bottom = Math.min(bottom, nav.top);
      }
      useWorldStore.getState().setViewInsets({
        left: desktop && nav ? Math.round(nav.right - r.left) : 0,
        top: top ? Math.round(top.bottom - r.top) : 0,
        right: desktop && panel ? Math.round(r.right - panel.left) : 0,
        bottom: Math.round(Math.max(0, r.bottom - bottom)),
      });
    };
    const ro = new ResizeObserver(measure);
    for (const el of [root, navRef.current, topRef.current, panelRef.current, cameraRef.current]) if (el) ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWorldStore.getState();
      if (s.dialog.open || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          void togglePlay();
          break;
        case "n":
        case "N":
          e.preventDefault();
          s.openDialog();
          break;
        case "b":
        case "B":
          void loadSprint();
          break;
        case "m":
        case "M":
          s.setSound({ enabled: !s.sound.enabled });
          break;
        case "Escape":
          s.select(null);
          s.follow(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={rootRef} className="aaw-root">
      {mounted && (
        <Suspense fallback={null}>
          <WorldCanvas />
        </Suspense>
      )}
      <AgentLabelsOverlay />
      <div className="pointer-events-none absolute inset-0 flex gap-3 p-3 max-md:flex-col max-md:gap-2 max-md:p-2">
        <NavRail ref={navRef} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <TopBar ref={topRef} />
          <div className="flex min-h-0 flex-1 items-end justify-center">
            <CameraBar ref={cameraRef} />
          </div>
        </div>
        <SidePanel ref={panelRef} />
      </div>
      <TaskDialog />
      <LoadingScreen />
    </div>
  );
}
