import {
  getAgent,
  HUB_CENTER,
  isTerminal,
  LOCATIONS,
  MISSION_CONTROL,
  PHASE_LABEL,
  shortTitle,
  STATIONS,
  type AgentState,
  type StationDef,
  type Task,
} from "@agent-world/core";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { liveWorld } from "../state/liveWorld";
import { useWorldStore } from "../state/useWorldStore";
import { screenTexture } from "./proceduralTextures";
import { accentMaterial, geometries, glowMaterial, materials } from "./sharedResources";
import { STATION_OWNER } from "./stationOwners";

const CLICK_TOLERANCE_PX = 5;

export function Workstations() {
  return (
    <group>
      <ScreenScroller />
      {(Object.values(STATIONS) as StationDef[]).map((s) => (
        <Desk key={s.id} station={s} />
      ))}
      <OperationsHub />
      <MissionControl />
      <PlanningBoard />
      <CollabTable />
      <Lounge />
    </group>
  );
}

/** One owner for the shared screen texture's scroll offset. */
function ScreenScroller() {
  useFrame((_, delta) => {
    const t = screenTexture();
    t.offset.y = (t.offset.y + delta * 0.04) % 1;
  });
  return null;
}

function isBusy(status: string | undefined): boolean {
  return status === "working" || status === "thinking";
}

function Desk({ station }: { station: StationDef }) {
  const owner = STATION_OWNER[station.id];
  const color = getAgent(owner).color;
  const select = useWorldStore((s) => s.select);
  const setHovered = useWorldStore((s) => s.setHovered);
  const setTab = useWorldStore((s) => s.setTab);
  const requestCamera = useWorldStore((s) => s.requestCamera);
  const hovered = useWorldStore((s) => s.hovered === `station:${station.id}`);

  // Per-desk screen material so each desk can glow independently; disposed on unmount.
  const screen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: "#ffffff",
        emissiveMap: screenTexture(),
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.1,
      }),
    [],
  );
  useLayoutEffect(() => () => screen.dispose(), [screen]);

  useFrame((_, delta) => {
    const agent = liveWorld.agents.get(owner);
    const atDesk = agent?.location === station.id;
    const target = isBusy(agent?.status) && atDesk ? 1.7 : 0.35;
    screen.emissiveIntensity = THREE.MathUtils.damp(screen.emissiveIntensity, target, 4, delta);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_TOLERANCE_PX) return;
    e.stopPropagation();
    select({ kind: "station", id: station.id });
    setTab("agents");
    requestCamera({ focus: { x: station.position.x, y: 0.8, z: station.position.z + 0.6 }, distance: 7 });
  };

  const monitors = station.id === "dev" || station.id === "ops" ? [-0.48, 0, 0.48] : [-0.27, 0.27];
  const { x, z } = station.position;

  return (
    <group position={[x, 0, z]} rotation-y={station.rotation}>
      {/* desk */}
      <RoundedBox args={[1.9, 0.07, 0.9]} radius={0.025} smoothness={2} position={[0, 0.76, 0]} material={materials.deskTop()} castShadow receiveShadow />
      <mesh geometry={geometries.box()} material={materials.desk()} position={[-0.88, 0.37, 0]} scale={[0.06, 0.74, 0.8]} castShadow />
      <mesh geometry={geometries.box()} material={materials.desk()} position={[0.88, 0.37, 0]} scale={[0.06, 0.74, 0.8]} castShadow />
      <mesh geometry={geometries.box()} material={accentMaterial(color)} position={[0, 0.72, 0.45]} scale={[1.6, 0.012, 0.012]} />
      {/* monitors */}
      {monitors.map((mx) => (
        <group key={mx} position={[mx, 0.79, -0.22]} rotation-y={-mx * 0.35}>
          <mesh geometry={geometries.box()} material={materials.darkMetal()} position={[0, 0.12, 0]} scale={[0.04, 0.24, 0.04]} />
          <mesh geometry={geometries.box()} material={materials.darkMetal()} position={[0, 0.42, -0.01]} scale={[0.52, 0.32, 0.03]} castShadow />
          <mesh geometry={geometries.plane()} material={screen} position={[0, 0.42, 0.006]} scale={[0.48, 0.28, 1]} />
        </group>
      ))}
      {/* chair (agent stands in front; chair is pushed aside) */}
      <group position={[0.62, 0, 0.95]} rotation-y={0.5}>
        <mesh geometry={geometries.cylinderLow()} material={materials.darkMetal()} position={[0, 0.22, 0]} scale={[0.06, 0.44, 0.06]} />
        <mesh geometry={geometries.box()} material={materials.fabric()} position={[0, 0.46, 0]} scale={[0.46, 0.08, 0.44]} castShadow />
        <mesh geometry={geometries.box()} material={materials.fabric()} position={[0, 0.78, 0.2]} scale={[0.44, 0.56, 0.07]} castShadow />
      </group>
      {/* hit box */}
      <mesh
        geometry={geometries.box()}
        material={materials.hit()}
        position={[0, 0.7, 0]}
        scale={[2, 1.4, 1.1]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(`station:${station.id}`);
        }}
        onPointerOut={() => setHovered(null)}
      />
      {hovered && <mesh geometry={geometries.ring()} material={glowMaterial("#ffffff", 0.35)} position={[0, 0.01, 0.2]} scale={[2.4, 1, 1.6]} />}
    </group>
  );
}

function OperationsHub() {
  const ring = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: getAgent("orion").color, transparent: true, opacity: 0.5, toneMapped: false }), []);
  useLayoutEffect(() => () => material.dispose(), [material]);
  useFrame((state, delta) => {
    const orion = liveWorld.agents.get("orion");
    const active = orion?.location === "hub" && (isBusy(orion.status) || orion.status === "communicating" || orion.status === "success");
    const pulse = active ? 0.65 + Math.sin(state.clock.elapsedTime * 5) * 0.3 : 0.28;
    material.opacity = THREE.MathUtils.damp(material.opacity, pulse, 6, delta);
    if (ring.current) ring.current.rotation.z += delta * (active ? 0.8 : 0.15);
  });
  return (
    <group position={[HUB_CENTER.x, 0, HUB_CENTER.z]}>
      <mesh geometry={geometries.cylinder()} material={materials.darkMetal()} position={[0, 0.42, 0]} scale={[1.9, 0.84, 1.9]} castShadow receiveShadow />
      <mesh geometry={geometries.cylinder()} material={materials.screenOff()} position={[0, 0.86, 0]} scale={[1.75, 0.04, 1.75]} />
      <mesh ref={ring} geometry={geometries.torus()} material={material} position={[0, 0.9, 0]} rotation-x={-Math.PI / 2} scale={[1.6, 1.6, 1.6]} />
      <mesh geometry={geometries.cylinder()} material={accentMaterial(getAgent("orion").color)} position={[0, 0.9, 0]} scale={[0.3, 0.02, 0.3]} />
    </group>
  );
}

const MC_W = 1024;
const MC_H = 384;

/** Wall screen drawn on a canvas; redrawn a few times per second and only when content changed. */
function MissionControl() {
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = MC_W;
    canvas.height = MC_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    return { canvas, texture, material };
  }, []);
  useLayoutEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );
  const last = useRef({ at: -1, sig: "" });

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - last.current.at < 0.25) return;
    last.current.at = now;
    const snap = liveWorld.snapshot;
    if (!snap) return;
    const active = snap.tasks.filter((t) => !isTerminal(t.phase)).slice(0, 5);
    const done = snap.tasks.filter((t) => t.phase === "done").length;
    const sig = `${snap.status}|${done}|${active.map((t) => `${t.id}${t.phase}${Math.round(t.progress * 50)}${t.status}`).join()}|${snap.agents.map((a) => a.status[0]).join("")}`;
    if (sig === last.current.sig) return;
    last.current.sig = sig;
    drawMissionControl(canvas, snap.status, active, done, snap.agents);
    texture.needsUpdate = true;
  });

  return (
    <group position={[MISSION_CONTROL.x, 0, MISSION_CONTROL.z]}>
      <mesh geometry={geometries.box()} material={materials.darkMetal()} position={[0, 2.3, -0.08]} scale={[8.4, 3.3, 0.12]} castShadow />
      <mesh geometry={geometries.plane()} material={material} position={[0, 2.3, 0]} scale={[8, 3, 1]} />
      <mesh geometry={geometries.box()} material={materials.darkMetal()} position={[0, 0.3, -0.08]} scale={[0.3, 0.6, 0.1]} />
    </group>
  );
}

function drawMissionControl(canvas: HTMLCanvasElement, status: string, tasks: readonly Task[], done: number, agents: readonly AgentState[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, MC_H);
  g.addColorStop(0, "#08131f");
  g.addColorStop(1, "#050a10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MC_W, MC_H);
  ctx.strokeStyle = "rgba(124,196,214,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, MC_W - 12, MC_H - 12);

  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#9ad7e6";
  ctx.fillText("MISSION CONTROL", 28, 44);
  ctx.font = "500 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#7c8797";
  ctx.fillText(`Simulation · ${status.toUpperCase()} · ${done} shipped`, 250, 44);

  ctx.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  if (!tasks.length) {
    ctx.fillStyle = "#7c8797";
    ctx.fillText("No tasks in flight. Press Run demo or Load sprint.", 28, 110);
  }
  tasks.forEach((t, i) => {
    const y = 88 + i * 46;
    const color = t.assignedAgentId ? getAgent(t.assignedAgentId).color : "#7c8797";
    ctx.fillStyle = "#b7c1cf";
    ctx.fillText(t.id, 28, y + 16);
    ctx.fillStyle = "#eef2f7";
    ctx.fillText(shortTitle(t.title, 40), 110, y + 16);
    ctx.fillStyle = t.status === "blocked" ? "#f2b46a" : color;
    ctx.fillText(t.status === "blocked" ? "Blocked" : PHASE_LABEL[t.phase], 600, y + 16);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(760, y + 4, 230, 12);
    ctx.fillStyle = color;
    ctx.fillRect(760, y + 4, 230 * Math.max(0.02, t.progress), 12);
  });

  agents.forEach((a, i) => {
    const def = getAgent(a.id);
    const x = 28 + i * 165;
    const y = MC_H - 36;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x + 7, y - 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eef2f7";
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(def.name, x + 22, y);
    ctx.fillStyle = "#7c8797";
    ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(a.paused ? "paused" : a.status, x + 22 + ctx.measureText(def.name).width * 1.15 + 6, y);
  });
}

const MAX_CARDS = 24;

/** Whiteboard with instanced sticky cards that follow the plan's subtasks. */
function PlanningBoard() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: "#ffffff", emissiveIntensity: 0.08 }), []);
  const cardGeometry = useMemo(() => new THREE.BoxGeometry(0.72, 0.24, 0.02), []);
  useLayoutEffect(
    () => () => {
      material.dispose();
      cardGeometry.dispose();
    },
    [material, cardGeometry],
  );
  useLayoutEffect(() => {
    if (ref.current) ref.current.count = 0;
  }, []);
  const last = useRef({ at: -1, sig: "" });
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), todo: new THREE.Color("#f4d58d"), done: new THREE.Color("#6fe3a4") }), []);

  useFrame((state) => {
    const mesh = ref.current;
    const snap = liveWorld.snapshot;
    if (!mesh || !snap) return;
    const now = state.clock.elapsedTime;
    if (now - last.current.at < 0.3) return;
    last.current.at = now;
    const tasks = snap.tasks.filter((t) => t.subtasks.length && !isTerminal(t.phase)).slice(-4);
    const sig = tasks.map((t) => `${t.id}:${t.subtasks.map((s) => (s.done ? 1 : 0)).join("")}`).join("|");
    if (sig === last.current.sig) return;
    last.current.sig = sig;
    let n = 0;
    tasks.forEach((t, col) => {
      t.subtasks.slice(0, 6).forEach((s, row) => {
        if (n >= MAX_CARDS) return;
        tmp.m.makeTranslation(-1.35 + col * 0.9, 0.95 - row * 0.32, 0.03);
        mesh.setMatrixAt(n, tmp.m);
        mesh.setColorAt(n, s.done ? tmp.done : tmp.todo);
        n += 1;
      });
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const slot = LOCATIONS.planning.slots[0];
  return (
    <group position={[slot.x - 1.25, 0, (LOCATIONS.planning.slots[0].z + LOCATIONS.planning.slots[1].z) / 2]} rotation-y={Math.PI / 2}>
      <mesh geometry={geometries.box()} material={materials.ceramic()} position={[0, 1.55, 0]} scale={[3.8, 2.1, 0.05]} castShadow />
      <mesh geometry={geometries.box()} material={materials.frame()} position={[0, 1.55, -0.02]} scale={[3.9, 2.2, 0.04]} />
      <mesh geometry={geometries.box()} material={materials.frame()} position={[-1.5, 0.25, 0]} scale={[0.05, 0.5, 0.05]} />
      <mesh geometry={geometries.box()} material={materials.frame()} position={[1.5, 0.25, 0]} scale={[0.05, 0.5, 0.05]} />
      <group position={[0, 1.55, 0]}>
        <instancedMesh ref={ref} args={[cardGeometry, material, MAX_CARDS]} frustumCulled={false} />
      </group>
    </group>
  );
}

function CollabTable() {
  const c = LOCATIONS.collab.center ?? { x: -5, z: 5.6 };
  const stools = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 6), []);
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh geometry={geometries.cylinder()} material={materials.deskTop()} position={[0, 0.74, 0]} scale={[1.9, 0.06, 1.9]} castShadow receiveShadow />
      <mesh geometry={geometries.cylinderLow()} material={materials.darkMetal()} position={[0, 0.37, 0]} scale={[0.16, 0.74, 0.16]} />
      {stools.map((a) => (
        <mesh key={a} geometry={geometries.cylinderLow()} material={materials.fabric()} position={[Math.sin(a) * 1.3, 0.24, Math.cos(a) * 1.3]} scale={[0.36, 0.48, 0.36]} castShadow />
      ))}
    </group>
  );
}

function Lounge() {
  const c = LOCATIONS.lounge.center ?? { x: 7.5, z: 6.2 };
  const sofas = useMemo(() => [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2], []);
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh geometry={geometries.cylinder()} material={materials.deskTop()} position={[0, 0.38, 0]} scale={[1.4, 0.06, 1.4]} castShadow receiveShadow />
      <mesh geometry={geometries.cylinderLow()} material={materials.darkMetal()} position={[0, 0.18, 0]} scale={[0.14, 0.36, 0.14]} />
      {sofas.map((a) => (
        <group key={a} position={[Math.sin(a) * 3, 0, Math.cos(a) * 3]} rotation-y={a + Math.PI}>
          <mesh geometry={geometries.box()} material={materials.fabric()} position={[0, 0.22, 0]} scale={[2.2, 0.44, 0.8]} castShadow />
          <mesh geometry={geometries.box()} material={materials.fabric()} position={[0, 0.55, -0.32]} scale={[2.2, 0.5, 0.18]} castShadow />
        </group>
      ))}
    </group>
  );
}
