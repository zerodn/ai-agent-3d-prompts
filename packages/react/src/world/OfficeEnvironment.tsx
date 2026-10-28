import { createRng, FLOOR } from "@agent-world/core";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useWorldStore } from "../state/useWorldStore";
import { floorTexture, glowTexture, skyTexture, windowsTexture } from "./proceduralTextures";
import { geometries, materials } from "./sharedResources";

const WALL_HEIGHT = 3.6;

/** Static meshes never move: skip per-frame matrix recomputation. */
function freeze(object: THREE.Object3D | null): void {
  if (!object) return;
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    o.matrixAutoUpdate = false;
  });
}

export function OfficeEnvironment() {
  const quality = useWorldStore((s) => s.quality);
  const staticRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => freeze(staticRef.current), []);

  return (
    <group>
      <group ref={staticRef}>
        <Floor />
        <Walls />
        <Partitions />
        <Plants />
        <Sky />
      </group>
      <Skyline count={quality === "high" ? 260 : 120} />
      <DustMotes count={quality === "high" ? 260 : 90} />
    </group>
  );
}

function Floor() {
  const material = useMemo(() => {
    const map = floorTexture().clone();
    map.needsUpdate = true;
    map.repeat.set(FLOOR.width / 8, FLOOR.depth / 8);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.15, color: "#ffffff" });
  }, []);
  useLayoutEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
  const cx = (FLOOR.minX + FLOOR.maxX) / 2;
  const cz = (FLOOR.minZ + FLOOR.maxZ) / 2;
  return (
    <mesh geometry={geometries.plane()} material={material} rotation-x={-Math.PI / 2} position={[cx, 0, cz]} scale={[FLOOR.width, FLOOR.depth, 1]} receiveShadow />
  );
}

function Walls() {
  const wall = materials.wall();
  const frame = materials.frame();
  const glass = materials.glass();
  const mullions = useMemo(() => Array.from({ length: 11 }, (_, i) => FLOOR.minX + (i * FLOOR.width) / 10), []);
  return (
    <group>
      {/* Back window wall: low sill, glass, mullions, header beam */}
      <mesh geometry={geometries.box()} material={wall} position={[0, 0.3, FLOOR.minZ - 0.1]} scale={[FLOOR.width, 0.6, 0.2]} receiveShadow />
      <mesh geometry={geometries.plane()} material={glass} position={[0, 2.1, FLOOR.minZ - 0.05]} scale={[FLOOR.width, 3, 1]} />
      <mesh geometry={geometries.box()} material={frame} position={[0, WALL_HEIGHT + 0.05, FLOOR.minZ - 0.1]} scale={[FLOOR.width + 0.4, 0.14, 0.24]} />
      {mullions.map((x) => (
        <mesh key={x} geometry={geometries.box()} material={frame} position={[x, WALL_HEIGHT / 2, FLOOR.minZ - 0.1]} scale={[0.08, WALL_HEIGHT, 0.12]} />
      ))}
      {/* Side walls */}
      {[FLOOR.minX - 0.1, FLOOR.maxX + 0.1].map((x) => (
        <mesh key={x} geometry={geometries.box()} material={wall} position={[x, WALL_HEIGHT / 2, (FLOOR.minZ + FLOOR.maxZ) / 2]} scale={[0.2, WALL_HEIGHT, FLOOR.depth + 0.4]} receiveShadow />
      ))}
      {/* Skirting along the front edge so the floor reads as a room */}
      <mesh geometry={geometries.box()} material={frame} position={[0, 0.04, FLOOR.maxZ]} scale={[FLOOR.width, 0.08, 0.06]} />
    </group>
  );
}

/** Low glass partitions between zones. */
const PARTITIONS: { x: number; z: number; w: number; rot: number }[] = [
  { x: -3.4, z: -4.3, w: 3.6, rot: Math.PI / 2 },
  { x: 3.4, z: -4.3, w: 3.6, rot: Math.PI / 2 },
  { x: -10.6, z: 2.0, w: 6.4, rot: 0 },
  { x: 10.6, z: 2.0, w: 6.4, rot: 0 },
  { x: -1.6, z: 6.4, w: 3.2, rot: Math.PI / 2 },
];

function Partitions() {
  const glass = materials.glass();
  const frame = materials.frame();
  return (
    <group>
      {PARTITIONS.map((p) => (
        <group key={`${p.x}:${p.z}`} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          <mesh geometry={geometries.plane()} material={glass} position={[0, 0.6, 0]} scale={[p.w, 1.1, 1]} />
          <mesh geometry={geometries.box()} material={frame} position={[0, 1.17, 0]} scale={[p.w, 0.04, 0.05]} />
          <mesh geometry={geometries.box()} material={frame} position={[0, 0.03, 0]} scale={[p.w, 0.06, 0.07]} />
          <mesh geometry={geometries.box()} material={frame} position={[-p.w / 2, 0.6, 0]} scale={[0.05, 1.2, 0.05]} />
          <mesh geometry={geometries.box()} material={frame} position={[p.w / 2, 0.6, 0]} scale={[0.05, 1.2, 0.05]} />
        </group>
      ))}
    </group>
  );
}

const PLANTS: [number, number, number][] = [
  [-14.2, -8.7, 1.1],
  [14.2, -8.7, 1.0],
  [-14.2, 10.6, 0.9],
  [14.2, 10.6, 1.0],
  [-3.4, -1.8, 0.8],
  [3.4, -1.8, 0.8],
  [2.0, 9.2, 0.9],
];

function Plants() {
  const pot = materials.pot();
  const leaf = materials.leaf();
  return (
    <group>
      {PLANTS.map(([x, z, s]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]} scale={s}>
          <mesh geometry={geometries.cylinderLow()} material={pot} position={[0, 0.22, 0]} scale={[0.5, 0.44, 0.5]} castShadow />
          <mesh geometry={geometries.capsule()} material={leaf} position={[0, 0.85, 0]} scale={[0.42, 0.42, 0.42]} castShadow />
          <mesh geometry={geometries.sphereLow()} material={leaf} position={[0.18, 1.15, 0.05]} scale={0.5} />
          <mesh geometry={geometries.sphereLow()} material={leaf} position={[-0.16, 1.05, -0.08]} scale={0.42} />
        </group>
      ))}
    </group>
  );
}

function Sky() {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, depthWrite: false }), []);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometries.plane()} material={material} position={[0, 18, -110]} scale={[420, 80, 1]} renderOrder={-1} />;
}

/** ~260 towers in one draw call, emissive lit-window texture. */
function Skyline({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b111b",
        roughness: 0.8,
        metalness: 0.3,
        emissive: "#ffffff",
        emissiveMap: windowsTexture(),
        emissiveIntensity: 0.9,
      }),
    [],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rng = createRng(1979);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const band = rng();
      const z = -16 - band * 70;
      const spread = 40 + band * 110;
      const x = (rng() * 2 - 1) * spread;
      const h = 6 + rng() * (14 + band * 40);
      const w = 3 + rng() * 6;
      p.set(x, h / 2 - 2, z);
      s.set(w, h, 3 + rng() * 5);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count]);

  return <instancedMesh ref={ref} args={[geometries.box(), material, 260]} frustumCulled={false} />;
}

/** Slow-drifting dust motes: one Points cloud, positions updated in place. */
function DustMotes({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const rng = createRng(42);
    const max = 260;
    const positions = new Float32Array(max * 3);
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) {
      seeds[i * 4] = FLOOR.minX + rng() * FLOOR.width;
      seeds[i * 4 + 1] = 0.3 + rng() * 3;
      seeds[i * 4 + 2] = FLOOR.minZ + rng() * FLOOR.depth;
      seeds[i * 4 + 3] = rng() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, seeds };
  }, []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.05,
        map: glowTexture(),
        color: "#9ad7e6",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useLayoutEffect(() => geometry.setDrawRange(0, count), [geometry, count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const ph = seeds[i * 4 + 3];
      arr[i * 3] = seeds[i * 4] + Math.sin(t * 0.07 + ph) * 0.6;
      arr[i * 3 + 1] = seeds[i * 4 + 1] + Math.sin(t * 0.11 + ph * 2) * 0.25;
      arr[i * 3 + 2] = seeds[i * 4 + 2] + Math.cos(t * 0.05 + ph) * 0.6;
    }
    attr.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
