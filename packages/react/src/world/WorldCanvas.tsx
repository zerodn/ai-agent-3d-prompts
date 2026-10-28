import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useWorldStore } from "../state/useWorldStore";
import { AgentsLayer } from "./AgentsLayer";
import { CameraController } from "./CameraController";
import { CAMERA_PRESETS } from "./cameraPresets";
import { Lighting } from "./Lighting";
import { OfficeEnvironment } from "./OfficeEnvironment";
import { Workstations } from "./Workstations";

/**
 * Rendered-pixel budget per quality. A 4K wall display at DPR 1 is 8.3 MP; capping keeps the GPU
 * (and fan) calm on always-on screens while the image is upscaled smoothly by the browser.
 */
const PIXEL_BUDGET = { high: 4_200_000, low: 2_000_000 } as const;
const MAX_DPR = { high: 1.75, low: 1.2 } as const;

function useBudgetedDpr(): number {
  const quality = useWorldStore((s) => s.quality);
  const compute = () => {
    if (typeof window === "undefined") return 1;
    const css = window.innerWidth * window.innerHeight;
    const byBudget = Math.sqrt(PIXEL_BUDGET[quality] / Math.max(css, 1));
    return Math.max(0.5, Math.min(window.devicePixelRatio || 1, MAX_DPR[quality], byBudget));
  };
  const [dpr, setDpr] = useState(compute);
  useEffect(() => {
    const update = () => setDpr(compute());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);
  return dpr;
}

export function WorldCanvas() {
  const quality = useWorldStore((s) => s.quality);
  const maxFps = useWorldStore((s) => s.maxFps);
  const setQuality = useWorldStore((s) => s.setQuality);
  const select = useWorldStore((s) => s.select);
  const follow = useWorldStore((s) => s.follow);
  const dpr = useBudgetedDpr();
  const high = quality === "high";
  const down = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="absolute inset-0"
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerLeave={() => useWorldStore.getState().setHovered(null)}
    >
      <Canvas
        // Never key this on quality: shadows and dpr are reactive props (remounting tears down WebGL).
        shadows={high ? "percentage" : false}
        dpr={dpr}
        frameloop={maxFps > 0 ? "demand" : "always"}
        camera={{ position: CAMERA_PRESETS.overview.position, fov: 40, near: 0.1, far: 220 }}
        gl={{ antialias: high, powerPreference: "high-performance", stencil: false }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          scene.background = new THREE.Color("#080b10");
          scene.fog = new THREE.Fog("#0a0e15", 48, 130);
        }}
        onPointerMissed={(e) => {
          const start = down.current;
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
          select(null);
          follow(null);
        }}
      >
        <PerformanceMonitor flipflops={2} onFallback={() => setQuality("low", true)} />
        <FrameLimiter maxFps={maxFps} />
        <ReadySignal />
        <Lighting />
        <OfficeEnvironment />
        <Workstations />
        <AgentsLayer />
        <CameraController />
      </Canvas>
    </div>
  );
}

/** Flags the scene as ready after a few rendered frames (drives the loading screen). */
function ReadySignal() {
  const frames = useRef(0);
  const setSceneReady = useWorldStore((s) => s.setSceneReady);
  useFrame(() => {
    if (frames.current > 3) return;
    frames.current += 1;
    if (frames.current === 3) setSceneReady(true);
  });
  return null;
}

/** With a cap set, the Canvas renders on demand and this loop requests frames at most `maxFps` times a second. */
function FrameLimiter({ maxFps }: { maxFps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (maxFps <= 0) return;
    const interval = 1000 / maxFps;
    let last = 0;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last >= interval - 1) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [maxFps, invalidate]);
  return null;
}
