// Drop-in experience
export { AppShell, type AppShellProps } from "./components/layout/AppShell.tsx";

// State and commands, for hosts that build their own UI around the world
export { useWorldStore, type WorldStore, type PanelTab, type Quality, type Selection, type CameraPresetId, type ViewInsets, type SoundSettings, type BackendInfo } from "./state/useWorldStore.ts";
export { liveWorld } from "./state/liveWorld.ts";
export { commands, connectBackend, getBackend } from "./state/backendClient.ts";
export { runDemo, loadSprint, togglePlay, submitFromDialog } from "./components/actions.ts";

// Building blocks
export { WorldCanvas } from "./world/WorldCanvas.tsx";
export { AgentLabelsOverlay } from "./world/AgentLabelsOverlay.tsx";
export { CAMERA_PRESETS } from "./world/cameraPresets.ts";
export { TopBar } from "./components/layout/TopBar.tsx";
export { NavRail } from "./components/layout/NavRail.tsx";
export { LoadingScreen } from "./components/layout/LoadingScreen.tsx";
export { SidePanel } from "./components/panels/SidePanel.tsx";
export { TaskDialog } from "./components/panels/TaskDialog.tsx";
export { CameraBar } from "./components/controls/CameraBar.tsx";
export { SimulationControls } from "./components/controls/SimulationControls.tsx";
export { ActivityList } from "./components/activity/ActivityFeed.tsx";

// Audio
export { soundEngine } from "./audio/soundEngine.ts";
export { useSoundEffects } from "./audio/useSoundEffects.ts";
