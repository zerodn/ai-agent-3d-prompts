import type { CameraPresetId } from "../state/useWorldStore";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  overview: { id: "overview", label: "Overview", position: [-1.2, 20, 25], target: [-1.2, 0, 0.8] },
  hub: { id: "hub", label: "Operations Hub", position: [0.6, 7.2, 9.6], target: [0, 1, -2.4] },
  development: { id: "development", label: "Development", position: [8.2, 6.2, 5.6], target: [8.25, 0.6, -2.8] },
  research: { id: "research", label: "Research", position: [-8.2, 6.2, 5.6], target: [-8.25, 0.6, -2.8] },
  collaboration: { id: "collaboration", label: "Collaboration", position: [-3.2, 8.4, 15], target: [-6.8, 0.5, 4.6] },
};

export const CAMERA_LIMITS = {
  minDistance: 3.5,
  maxDistance: 70,
  minPolarAngle: 0.18,
  maxPolarAngle: 1.36,
  target: { minX: -14, maxX: 14, minZ: -8, maxZ: 10, minY: 0, maxY: 3 },
} as const;
