import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useWorldStore, type ViewInsets } from "../state/useWorldStore";
import { agentRenderPositions } from "./labelAnchors";
import { CAMERA_LIMITS, CAMERA_PRESETS } from "./cameraPresets";

/** Scale preset distance so the same part of the office stays visible when floating UI eats the screen. */
export function fitFactor(width: number, height: number, insets: ViewInsets): number {
  const freeW = Math.max(160, width - insets.left - insets.right);
  const freeH = Math.max(160, height - insets.top - insets.bottom);
  return THREE.MathUtils.clamp(Math.max((1.17 * height) / freeW, (0.96 * height) / freeH), 1, 2.2);
}

function clampTarget(v: THREE.Vector3): void {
  const t = CAMERA_LIMITS.target;
  v.x = THREE.MathUtils.clamp(v.x, t.minX, t.maxX);
  v.y = THREE.MathUtils.clamp(v.y, t.minY, t.maxY);
  v.z = THREE.MathUtils.clamp(v.z, t.minZ, t.maxZ);
}

export function CameraController() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const request = useWorldStore((s) => s.camera);
  const insets = useWorldStore((s) => s.viewInsets);
  const followAgentId = useWorldStore((s) => s.followAgentId);

  const goal = useMemo(
    () => ({ active: false, target: new THREE.Vector3(), dir: new THREE.Vector3(), distance: 20, tmp: new THREE.Vector3() }),
    [],
  );

  // Centre the projection in the free area between the floating panels.
  useLayoutEffect(() => {
    const ox = (insets.right - insets.left) / 2;
    const oy = (insets.bottom - insets.top) / 2;
    camera.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, insets]);

  // A new request nonce sets a goal; the frame loop damps towards it.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { width, height } = size;
    const fit = fitFactor(width, height, useWorldStore.getState().viewInsets);
    if (request.preset) {
      const p = CAMERA_PRESETS[request.preset];
      goal.target.set(...p.target);
      goal.tmp.set(...p.position).sub(goal.target);
      goal.distance = THREE.MathUtils.clamp(goal.tmp.length() * fit, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
      goal.dir.copy(goal.tmp).normalize();
    } else if (request.focus) {
      goal.target.set(request.focus.x, request.focus.y, request.focus.z);
      goal.dir.copy(camera.position).sub(c.target).normalize();
      goal.distance = THREE.MathUtils.clamp((request.distance ?? 8) * Math.min(fit, 1.5), CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
    } else return;
    clampTarget(goal.target);
    goal.active = true;
    // First request: jump instead of flying in from the default camera.
    if (request.nonce <= 1) {
      c.target.copy(goal.target);
      camera.position.copy(goal.target).addScaledVector(goal.dir, goal.distance);
      c.update();
      goal.active = false;
    }
  }, [request, camera, size, goal]);

  // Any user drag cancels a camera move and releases follow mode.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => {
      goal.active = false;
      if (useWorldStore.getState().followAgentId) useWorldStore.getState().follow(null);
    };
    c.addEventListener("start", onStart);
    return () => c.removeEventListener("start", onStart);
  }, [goal]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, 0.1);

    if (followAgentId) {
      const p = agentRenderPositions.get(followAgentId);
      if (p) {
        // Move the target towards the agent and carry the camera along so the offset is kept.
        const bx = c.target.x;
        const bz = c.target.z;
        c.target.x = THREE.MathUtils.damp(c.target.x, p.x, 4, dt);
        c.target.y = THREE.MathUtils.damp(c.target.y, 1, 4, dt);
        c.target.z = THREE.MathUtils.damp(c.target.z, p.z, 4, dt);
        camera.position.x += c.target.x - bx;
        camera.position.z += c.target.z - bz;
      }
    } else if (goal.active) {
      const offset = goal.tmp.copy(camera.position).sub(c.target);
      const dist = offset.length();
      offset.normalize();
      c.target.x = THREE.MathUtils.damp(c.target.x, goal.target.x, 4, dt);
      c.target.y = THREE.MathUtils.damp(c.target.y, goal.target.y, 4, dt);
      c.target.z = THREE.MathUtils.damp(c.target.z, goal.target.z, 4, dt);
      offset.lerp(goal.dir, 1 - Math.exp(-3 * dt)).normalize();
      const nextDist = THREE.MathUtils.damp(dist, goal.distance, 2.6, dt);
      camera.position.copy(c.target).addScaledVector(offset, nextDist);
      if (c.target.distanceTo(goal.target) < 0.02 && Math.abs(nextDist - goal.distance) < 0.05 && offset.distanceTo(goal.dir) < 0.005) goal.active = false;
    }
    clampTarget(c.target);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      minPolarAngle={CAMERA_LIMITS.minPolarAngle}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
    />
  );
}
