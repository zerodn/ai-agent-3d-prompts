import { AGENTS, getAgent, type AgentDefinition } from "@agent-world/core";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { liveWorld } from "../state/liveWorld";
import { useWorldStore } from "../state/useWorldStore";
import { AgentAnimator } from "./AgentAnimator";
import { AgentCharacter, RIGS, type AgentCharacterHandle } from "./AgentCharacter";
import { agentRenderPositions, writeAnchor } from "./labelAnchors";
import { blobTexture } from "./proceduralTextures";
import { geometries, glowMaterial, materials, sharedMaterial } from "./sharedResources";

const CLICK_TOLERANCE_PX = 5;
const CHEST_Y = 1.25;

export function AgentsLayer() {
  const showPaths = useWorldStore((s) => s.overlays.paths);
  return (
    <group>
      {AGENTS.map((def) => (
        <Agent key={def.id} def={def} />
      ))}
      {showPaths && AGENTS.map((def) => <PathTrail key={def.id} def={def} />)}
      <CommLinks />
    </group>
  );
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function Agent({ def }: { def: AgentDefinition }) {
  const root = useRef<THREE.Group>(null);
  const character = useRef<AgentCharacterHandle>(null);
  const statusRing = useRef<THREE.Mesh>(null);
  const pulseRing = useRef<THREE.Mesh>(null);
  const rig = RIGS[def.role];
  const selected = useWorldStore((s) => s.selection?.kind === "agent" && s.selection.id === def.id);
  const hovered = useWorldStore((s) => s.hovered === `agent:${def.id}`);
  const select = useWorldStore((s) => s.select);
  const setTab = useWorldStore((s) => s.setTab);
  const setHovered = useWorldStore((s) => s.setHovered);
  const requestCamera = useWorldStore((s) => s.requestCamera);

  // Per-agent materials whose opacity animates independently; disposed on unmount.
  const { ringMat, pulseMat } = useMemo(
    () => ({
      ringMat: new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }),
      pulseMat: new THREE.MeshBasicMaterial({ color: "#6fe3a4", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    }),
    [def.color],
  );
  useLayoutEffect(
    () => () => {
      ringMat.dispose();
      pulseMat.dispose();
    },
    [ringMat, pulseMat],
  );

  const state = useMemo(
    () => ({
      animator: new AgentAnimator(),
      pos: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      heading: 0,
      initialised: false,
      lastStatus: "idle",
      pulseAge: 99,
      projected: new THREE.Vector3(),
    }),
    [],
  );

  useLayoutEffect(() => {
    agentRenderPositions.set(def.id, state.pos);
    return () => {
      agentRenderPositions.delete(def.id);
    };
  }, [def.id, state.pos]);

  useFrame((frame, delta) => {
    const a = liveWorld.agents.get(def.id);
    const g = root.current;
    if (!a || !g) return;
    const dt = Math.min(delta, 0.1);
    const s = state;
    s.prev.copy(s.pos);
    const tx = a.position.x;
    const tz = a.position.z;
    if (!s.initialised || Math.hypot(tx - s.pos.x, tz - s.pos.z) > 4) {
      s.pos.set(tx, 0, tz);
      s.prev.copy(s.pos);
      s.heading = a.heading;
      s.initialised = true;
    } else {
      s.pos.x = THREE.MathUtils.damp(s.pos.x, tx, 12, dt);
      s.pos.z = THREE.MathUtils.damp(s.pos.z, tz, 12, dt);
      s.heading += shortestAngle(s.heading, a.heading) * (1 - Math.exp(-9 * dt));
    }
    g.position.copy(s.pos);
    g.rotation.y = s.heading;

    const running = liveWorld.snapshot?.status === "running";
    const speedFactor = a.paused || !running ? 0.15 : 1;
    const walkSpeed = dt > 0 ? s.pos.distanceTo(s.prev) / dt : 0;
    const pose = s.animator.update(a.status, dt, speedFactor, walkSpeed);
    character.current?.applyPose(pose);

    const w = s.animator.weights;
    ringMat.opacity = 0.22 + 0.55 * Math.min(1, w.working + w.communicating + w.thinking);

    if (a.status !== s.lastStatus && (a.status === "success" || a.status === "error")) {
      s.pulseAge = 0;
      pulseMat.color.set(a.status === "success" ? "#6fe3a4" : "#f2b46a");
    }
    s.lastStatus = a.status;
    s.pulseAge += dt;
    const pulseT = Math.min(1, s.pulseAge / 0.9);
    pulseMat.opacity = pulseT < 1 ? (1 - pulseT) * 0.8 : 0;
    if (pulseRing.current) {
      const sc = 0.6 + pulseT * 1.8;
      pulseRing.current.scale.set(sc, 1, sc);
      pulseRing.current.visible = pulseT < 1;
    }
    if (statusRing.current) statusRing.current.rotation.y += dt * 0.6;

    // Speech-bubble anchor in screen space.
    const cam = frame.camera as THREE.PerspectiveCamera;
    const labelY = rig.labelY * rig.scale + pose.bounce;
    s.projected.set(s.pos.x, labelY, s.pos.z).project(cam);
    const onScreen = s.projected.z < 1 && Math.abs(s.projected.x) < 1.1 && Math.abs(s.projected.y) < 1.1;
    const x = (s.projected.x * 0.5 + 0.5) * frame.size.width;
    const y = (-s.projected.y * 0.5 + 0.5) * frame.size.height;
    const dist = cam.position.distanceTo(s.pos);
    const scale = THREE.MathUtils.clamp(6.5 / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(dist, 0.1)), 0.72, 1.05);
    writeAnchor(def.id, x, y, scale, onScreen);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_TOLERANCE_PX) return;
    e.stopPropagation();
    select({ kind: "agent", id: def.id });
    setTab("agents");
    requestCamera({ focus: { x: state.pos.x, y: 1, z: state.pos.z }, distance: 7.5 });
  };

  const blob = useMemo(
    () => sharedMaterial("blob", () => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false })),
    [],
  );

  return (
    <group ref={root}>
      <AgentCharacter ref={character} def={def} />
      <mesh geometry={geometries.plane()} material={blob} rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} scale={1.3} />
      <mesh ref={statusRing} geometry={geometries.ring()} material={ringMat} position={[0, 0.02, 0]} scale={[1.25, 1, 1.25]} />
      <mesh ref={pulseRing} geometry={geometries.ring()} material={pulseMat} position={[0, 0.03, 0]} visible={false} />
      {(selected || hovered) && (
        <mesh geometry={geometries.ring()} material={glowMaterial("#ffffff", selected ? 0.9 : 0.45)} position={[0, 0.025, 0]} scale={[1.55, 1, 1.55]} />
      )}
      <mesh
        geometry={geometries.cylinderLow()}
        material={materials.hit()}
        position={[0, 1, 0]}
        scale={[0.9, 2.1, 0.9]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(`agent:${def.id}`);
        }}
        onPointerOut={() => setHovered(null)}
      />
    </group>
  );
}

const TRAIL_MAX = 64;
const TRAIL_SPACING = 0.32;

/** Discs flowing along the remaining path, plus a breathing destination marker. */
function PathTrail({ def }: { def: AgentDefinition }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  const material = glowMaterial(def.color, 0.75);
  const markerMat = glowMaterial(def.color, 0.6);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(0.16, 1, 0.16) }), []);

  useFrame((frame) => {
    const mesh = ref.current;
    const a = liveWorld.agents.get(def.id);
    const start = agentRenderPositions.get(def.id);
    if (!mesh || !a || !start) return;
    const path = a.path;
    let n = 0;
    if (path.length) {
      let offset = (frame.clock.elapsedTime * 0.9) % TRAIL_SPACING;
      let px = start.x;
      let pz = start.z;
      for (const p of path) {
        const seg = Math.hypot(p.x - px, p.z - pz);
        while (offset < seg && n < TRAIL_MAX) {
          const t = offset / seg;
          tmp.p.set(px + (p.x - px) * t, 0.03, pz + (p.z - pz) * t);
          tmp.m.compose(tmp.p, tmp.q, tmp.s);
          mesh.setMatrixAt(n, tmp.m);
          n += 1;
          offset += TRAIL_SPACING;
        }
        offset -= seg;
        px = p.x;
        pz = p.z;
        if (n >= TRAIL_MAX) break;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    const mk = marker.current;
    if (mk) {
      const last = path[path.length - 1];
      mk.visible = !!last;
      if (last) {
        const b = 0.9 + Math.sin(frame.clock.elapsedTime * 4) * 0.12;
        mk.position.set(last.x, 0.03, last.z);
        mk.scale.set(b, 1, b);
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={ref} args={[geometries.disc(), material, TRAIL_MAX]} frustumCulled={false} />
      <mesh ref={marker} geometry={geometries.ring()} material={markerMat} visible={false} />
    </group>
  );
}

const LINK_SLOTS = 6;
const TUBE_SEG = 28;
const TUBE_RADIAL = 6;
const PACKETS_PER_LINK = 3;

function createTubeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const verts = (TUBE_SEG + 1) * TUBE_RADIAL;
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const index: number[] = [];
  for (let i = 0; i < TUBE_SEG; i++) {
    for (let j = 0; j < TUBE_RADIAL; j++) {
      const a = i * TUBE_RADIAL + j;
      const b = i * TUBE_RADIAL + ((j + 1) % TUBE_RADIAL);
      const c = (i + 1) * TUBE_RADIAL + j;
      const d = (i + 1) * TUBE_RADIAL + ((j + 1) % TUBE_RADIAL);
      index.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(index);
  return g;
}

interface LinkScratch {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  pt: THREE.Vector3;
  tan: THREE.Vector3;
  nrm: THREE.Vector3;
  bin: THREE.Vector3;
  up: THREE.Vector3;
  d: THREE.Vector3;
}

const WHITE = new THREE.Color("#ffffff");

function bezier(out: THREE.Vector3, s: LinkScratch, t: number): THREE.Vector3 {
  const u = 1 - t;
  return out
    .copy(s.p0)
    .multiplyScalar(u * u)
    .addScaledVector(s.p1, 2 * u * t)
    .addScaledVector(s.p2, t * t);
}

/**
 * Glowing arcs between talking agents with packets travelling sender → receiver.
 * A fixed pool of slots with preallocated buffers: no geometry is created while the app runs.
 */
function CommLinks() {
  const tubes = useRef<(THREE.Mesh | null)[]>([]);
  const packets = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => {
    const slots = Array.from({ length: LINK_SLOTS }, () => ({
      geometry: createTubeGeometry(),
      material: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      linkId: null as string | null,
    }));
    const packetMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const scratch: LinkScratch = {
      p0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
      p2: new THREE.Vector3(),
      pt: new THREE.Vector3(),
      tan: new THREE.Vector3(),
      nrm: new THREE.Vector3(),
      bin: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      d: new THREE.Vector3(),
    };
    return { slots, packetMat, scratch, m: new THREE.Matrix4(), q: new THREE.Quaternion(), sc: new THREE.Vector3(), color: new THREE.Color() };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const s of pool.slots) {
        s.geometry.dispose();
        s.material.dispose();
      }
      pool.packetMat.dispose();
    },
    [pool],
  );

  useFrame(() => {
    const snap = liveWorld.snapshot;
    const packetMesh = packets.current;
    if (!snap || !packetMesh) return;
    const elapsed = (performance.now() - liveWorld.receivedAt) / 1000;
    const clock = snap.status === "running" ? snap.clock + Math.min(elapsed, 0.1) * snap.speed : snap.clock;
    const links = snap.links;

    // Release slots whose link is gone; assign new links to free slots.
    for (const slot of pool.slots) {
      if (slot.linkId && !links.some((l) => l.id === slot.linkId)) slot.linkId = null;
    }
    for (const link of links) {
      if (pool.slots.some((s) => s.linkId === link.id)) continue;
      const free = pool.slots.find((s) => s.linkId === null);
      if (free) free.linkId = link.id;
    }

    let packetCount = 0;
    pool.slots.forEach((slot, i) => {
      const mesh = tubes.current[i];
      if (!mesh) return;
      const link = slot.linkId ? links.find((l) => l.id === slot.linkId) : undefined;
      const from = link && agentRenderPositions.get(link.from);
      const to = link && agentRenderPositions.get(link.to);
      if (!link || !from || !to) {
        mesh.visible = false;
        return;
      }
      const s = pool.scratch;
      s.p0.set(from.x, CHEST_Y, from.z);
      s.p2.set(to.x, CHEST_Y, to.z);
      const dist = s.p0.distanceTo(s.p2);
      s.p1.addVectors(s.p0, s.p2).multiplyScalar(0.5);
      s.p1.y += 0.6 + dist * 0.22;

      const radius = link.kind === "assign" ? 0.038 : 0.026;
      const pos = slot.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let k = 0; k <= TUBE_SEG; k++) {
        const t = k / TUBE_SEG;
        bezier(s.pt, s, t);
        // derivative of the quadratic bezier
        s.d.copy(s.p2).sub(s.p1);
        s.tan
          .copy(s.p1)
          .sub(s.p0)
          .multiplyScalar(2 * (1 - t))
          .addScaledVector(s.d, 2 * t)
          .normalize();
        s.nrm.crossVectors(s.tan, s.up);
        if (s.nrm.lengthSq() < 1e-6) s.nrm.set(1, 0, 0);
        s.nrm.normalize();
        s.bin.crossVectors(s.nrm, s.tan).normalize();
        const taper = Math.min(1, Math.min(t, 1 - t) * 8 + 0.35);
        for (let j = 0; j < TUBE_RADIAL; j++) {
          const ang = (j / TUBE_RADIAL) * Math.PI * 2;
          const c = Math.cos(ang) * radius * taper;
          const sn = Math.sin(ang) * radius * taper;
          const o = (k * TUBE_RADIAL + j) * 3;
          arr[o] = s.pt.x + s.nrm.x * c + s.bin.x * sn;
          arr[o + 1] = s.pt.y + s.nrm.y * c + s.bin.y * sn;
          arr[o + 2] = s.pt.z + s.nrm.z * c + s.bin.z * sn;
        }
      }
      pos.needsUpdate = true;

      const age = clock - link.startedAt;
      const life = link.endsAt - link.startedAt;
      const fade = Math.min(1, age / 0.25, Math.max(0, (link.endsAt - clock) / 0.45));
      slot.material.color.set(getAgent(link.from).color);
      slot.material.opacity = 0.75 * Math.max(0, fade);
      mesh.visible = true;

      pool.color.set(getAgent(link.from).color).lerp(WHITE, 0.35);
      for (let k = 0; k < PACKETS_PER_LINK; k++) {
        const t = ((age / life) * 1.6 + k / PACKETS_PER_LINK) % 1;
        bezier(s.pt, s, t);
        const size = 0.11 * Math.max(0.2, fade);
        pool.sc.set(size, size, size);
        pool.m.compose(s.pt, pool.q, pool.sc);
        packetMesh.setMatrixAt(packetCount, pool.m);
        packetMesh.setColorAt(packetCount, pool.color);
        packetCount += 1;
      }
    });
    packetMesh.count = packetCount;
    packetMesh.instanceMatrix.needsUpdate = true;
    if (packetMesh.instanceColor) packetMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {pool.slots.map((slot, i) => (
        <mesh
          key={i}
          ref={(m) => {
            tubes.current[i] = m;
          }}
          geometry={slot.geometry}
          material={slot.material}
          visible={false}
          frustumCulled={false}
        />
      ))}
      <instancedMesh ref={packets} args={[geometries.sphereLow(), pool.packetMat, LINK_SLOTS * PACKETS_PER_LINK]} frustumCulled={false} />
    </group>
  );
}
