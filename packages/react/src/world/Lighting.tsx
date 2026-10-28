import { Environment, Lightformer } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { useWorldStore } from "../state/useWorldStore";

/** Blue-hour exterior + warm interior. One shadow-casting light; everything else is cheap fill. */
export function Lighting() {
  const high = useWorldStore((s) => s.quality === "high");
  const sun = useRef<THREE.DirectionalLight>(null);

  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -17;
    cam.right = 17;
    cam.top = 13;
    cam.bottom = -13;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 3;
    light.target.position.set(0, 0, 1);
    light.target.updateMatrixWorld();
  }, []);

  return (
    <>
      <hemisphereLight args={["#8fb4ff", "#1a1410", 0.75]} />
      <ambientLight intensity={0.12} color="#9fb6d6" />
      <directionalLight ref={sun} position={[-9, 18, 12]} intensity={1.35} color="#cfdcff" castShadow={high} />
      {/* warm practicals over the work zones (no shadows) */}
      <pointLight position={[-8.25, 3, -3.6]} intensity={14} distance={9} decay={2} color="#ffc98a" />
      <pointLight position={[8.25, 3, -3.6]} intensity={14} distance={9} decay={2} color="#ffc98a" />
      <pointLight position={[0, 3.2, 0.2]} intensity={12} distance={8} decay={2} color="#ffd6a0" />
      <pointLight position={[-5, 3, 5.6]} intensity={10} distance={8} decay={2} color="#ffd2a0" />
      <pointLight position={[7.5, 3, 6.2]} intensity={10} distance={8} decay={2} color="#ffd2a0" />
      {high && (
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={1.6} color="#7aa2ff" position={[0, 6, -14]} scale={[30, 6, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#ffb07a" position={[0, 2, -14]} scale={[30, 1.5, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          <Lightformer form="circle" intensity={0.8} color="#ffd6a0" position={[10, 4, 8]} scale={4} />
        </Environment>
      )}
    </>
  );
}
