import {
  SIMULATION_CONFIG,
  appendEvents,
  type AgentEvent,
  type AgentId,
  type AgentState,
  type BackendKind,
  type CommLink,
  type SimulationStatus,
  type StationId,
  type Task,
  type WorldSnapshot,
} from "@agent-world/core";
import { create } from "zustand";
import { writeLiveWorld } from "./liveWorld";

export type PanelTab = "overview" | "agents" | "tasks" | "activity" | "settings";
export type Quality = "high" | "low";
export type CameraPresetId = "overview" | "hub" | "development" | "research" | "collaboration";

export type Selection = { kind: "agent"; id: AgentId } | { kind: "task"; id: string } | { kind: "station"; id: StationId } | null;

export interface CameraRequest {
  nonce: number;
  preset?: CameraPresetId;
  focus?: { x: number; y: number; z: number };
  distance?: number;
}

export interface ViewInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  ambient: boolean;
}

export interface BackendInfo {
  kind: BackendKind;
  label: string;
  simulated: boolean;
  connected: boolean;
  error: string | null;
}

export interface WorldStore {
  backend: BackendInfo;
  simStatus: SimulationStatus;
  speed: number;
  clock: number;
  agents: AgentState[];
  tasks: Task[];
  links: CommLink[];
  events: AgentEvent[];

  tab: PanelTab;
  selection: Selection;
  hovered: string | null;
  followAgentId: AgentId | null;
  dialog: { open: boolean; preferredAgentId: AgentId | null };
  camera: CameraRequest;
  viewInsets: ViewInsets;
  sceneReady: boolean;
  quality: Quality;
  qualityAuto: boolean;
  /** 0 = uncapped. A cap keeps an always-on wall display cool. */
  maxFps: number;
  overlays: { paths: boolean; speech: boolean };
  sound: SoundSettings;

  applySnapshot: (snapshot: WorldSnapshot) => void;
  pushEvent: (event: AgentEvent) => void;
  clearEvents: () => void;
  setBackend: (patch: Partial<BackendInfo>) => void;
  setTab: (tab: PanelTab) => void;
  select: (selection: Selection) => void;
  setHovered: (hovered: string | null) => void;
  follow: (id: AgentId | null) => void;
  openDialog: (preferredAgentId?: AgentId | null) => void;
  closeDialog: () => void;
  requestCamera: (request: Omit<CameraRequest, "nonce">) => void;
  setViewInsets: (insets: ViewInsets) => void;
  setSceneReady: (ready: boolean) => void;
  setQuality: (quality: Quality, auto?: boolean) => void;
  setMaxFps: (fps: number) => void;
  setOverlays: (patch: Partial<WorldStore["overlays"]>) => void;
  setSound: (patch: Partial<SoundSettings>) => void;
}

const MIRROR_INTERVAL_MS = 160;
let lastMirror = 0;
let lastSignature = "";

/** Changes that must reach the UI immediately. Positions are deliberately excluded. */
function signature(s: WorldSnapshot): string {
  let sig = `${s.status}|${s.speed}|`;
  for (const a of s.agents) sig += `${a.id}:${a.status}:${a.paused ? 1 : 0}:${a.currentTaskId ?? ""}:${a.location ?? ""};`;
  for (const t of s.tasks) sig += `${t.id}:${t.phase}:${t.status}:${t.iteration}:${t.subtasks.length}:${t.findings.length};`;
  for (const l of s.links) sig += `${l.id};`;
  return sig;
}

export const useWorldStore = create<WorldStore>()((set, get) => ({
  backend: { kind: "mock", label: "Local simulation", simulated: true, connected: false, error: null },
  simStatus: "ready",
  speed: SIMULATION_CONFIG.defaultSpeed,
  clock: 0,
  agents: [],
  tasks: [],
  links: [],
  events: [],

  tab: "overview",
  selection: null,
  hovered: null,
  followAgentId: null,
  dialog: { open: false, preferredAgentId: null },
  camera: { nonce: 0, preset: "overview" },
  viewInsets: { left: 0, top: 0, right: 0, bottom: 0 },
  sceneReady: false,
  quality: "high",
  qualityAuto: false,
  maxFps: 0,
  overlays: { paths: true, speech: true },
  sound: { enabled: true, volume: 0.6, ambient: true },

  applySnapshot: (snapshot) => {
    writeLiveWorld(snapshot);
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const sig = signature(snapshot);
    if (sig === lastSignature && now - lastMirror < MIRROR_INTERVAL_MS) return;
    lastSignature = sig;
    lastMirror = now;
    set({
      simStatus: snapshot.status,
      speed: snapshot.speed,
      clock: snapshot.clock,
      agents: snapshot.agents,
      tasks: snapshot.tasks,
      links: snapshot.links,
    });
  },
  pushEvent: (event) => set({ events: appendEvents(get().events, [event], SIMULATION_CONFIG.maxEvents) }),
  clearEvents: () => set({ events: [] }),
  setBackend: (patch) => set({ backend: { ...get().backend, ...patch } }),
  setTab: (tab) => set({ tab }),
  select: (selection) => set({ selection }),
  setHovered: (hovered) => {
    if (get().hovered !== hovered) set({ hovered });
  },
  follow: (followAgentId) => set({ followAgentId }),
  openDialog: (preferredAgentId = null) => set({ dialog: { open: true, preferredAgentId } }),
  closeDialog: () => set({ dialog: { open: false, preferredAgentId: null } }),
  requestCamera: (request) => set({ camera: { ...request, nonce: get().camera.nonce + 1 } }),
  setViewInsets: (insets) => {
    const v = get().viewInsets;
    if (v.left !== insets.left || v.top !== insets.top || v.right !== insets.right || v.bottom !== insets.bottom) set({ viewInsets: insets });
  },
  setSceneReady: (sceneReady) => set({ sceneReady }),
  setQuality: (quality, auto = false) => set({ quality, qualityAuto: auto }),
  setMaxFps: (maxFps) => set({ maxFps }),
  setOverlays: (patch) => set({ overlays: { ...get().overlays, ...patch } }),
  setSound: (patch) => set({ sound: { ...get().sound, ...patch } }),
}));

/** Reset module-level mirror state (used when a new backend connects). */
export function resetMirror(): void {
  lastMirror = 0;
  lastSignature = "";
}
