import type { AgentDefinition, AgentRole } from "@agent-world/core";
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import type * as THREE from "three";
import type { Pose } from "./AgentAnimator";
import { accentMaterial, geometries, materials, tintedMaterial } from "./sharedResources";

export interface Rig {
  scale: number;
  hipY: number;
  shoulderY: number;
  headY: number;
  labelY: number;
}

export const RIGS: Record<AgentRole, Rig> = {
  orchestrator: { scale: 1.12, hipY: 0.8, shoulderY: 0.6, headY: 0.82, labelY: 2.05 },
  researcher: { scale: 0.98, hipY: 0.76, shoulderY: 0.56, headY: 0.78, labelY: 1.88 },
  product_manager: { scale: 1.0, hipY: 0.78, shoulderY: 0.57, headY: 0.8, labelY: 1.9 },
  engineer: { scale: 1.04, hipY: 0.78, shoulderY: 0.58, headY: 0.8, labelY: 1.95 },
  qa: { scale: 0.96, hipY: 0.74, shoulderY: 0.55, headY: 0.77, labelY: 1.85 },
  reviewer: { scale: 1.06, hipY: 0.8, shoulderY: 0.59, headY: 0.8, labelY: 1.97 },
};

export interface AgentCharacterHandle {
  applyPose(pose: Pose): void;
}

/** Procedural robot from shared primitives: torso, head with visor, arms, legs, role silhouette. */
export const AgentCharacter = forwardRef<AgentCharacterHandle, { def: AgentDefinition }>(function AgentCharacter({ def }, ref) {
  const rig = RIGS[def.role];
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  useImperativeHandle(
    ref,
    () => ({
      applyPose(p: Pose) {
        if (hips.current) hips.current.position.y = rig.hipY + p.bounce;
        if (torso.current) torso.current.rotation.x = p.lean;
        if (head.current) head.current.rotation.set(p.headX, p.headY, p.headZ);
        if (armL.current) armL.current.rotation.set(p.armLX, 0, p.armLZ);
        if (armR.current) armR.current.rotation.set(p.armRX, 0, p.armRZ);
        if (legL.current) legL.current.rotation.x = p.legLX;
        if (legR.current) legR.current.rotation.x = p.legRX;
      },
    }),
    [rig.hipY],
  );

  const shell = tintedMaterial(def.color);
  const accent = accentMaterial(def.color);
  const joint = materials.joint();
  const visor = materials.visor();

  return (
    <group scale={rig.scale}>
      <group ref={hips} position={[0, rig.hipY, 0]}>
        {/* legs */}
        {(
          [
            [legL, -0.12],
            [legR, 0.12],
          ] as const
        ).map(([r, x]) => (
          <group key={x} ref={r} position={[x, 0, 0]}>
            <mesh geometry={geometries.capsule()} material={joint} position={[0, -0.34, 0]} scale={[0.17, 0.42, 0.17]} castShadow />
            <mesh geometry={geometries.box()} material={shell} position={[0, -rig.hipY + 0.05, 0.05]} scale={[0.17, 0.1, 0.28]} castShadow />
          </group>
        ))}
        {/* pelvis */}
        <mesh geometry={geometries.box()} material={joint} position={[0, 0.02, 0]} scale={[0.38, 0.12, 0.24]} />
        <group ref={torso}>
          <mesh geometry={geometries.capsule()} material={shell} position={[0, 0.34, 0]} scale={[0.5, 0.3, 0.36]} castShadow />
          <mesh geometry={geometries.box()} material={accent} position={[0, 0.4, 0.18]} scale={[0.16, 0.08, 0.02]} />
          {/* arms */}
          {(
            [
              [armL, -0.31],
              [armR, 0.31],
            ] as const
          ).map(([r, x]) => (
            <group key={x} ref={r} position={[x, rig.shoulderY, 0]}>
              <mesh geometry={geometries.sphereLow()} material={joint} scale={0.13} />
              <mesh geometry={geometries.capsule()} material={shell} position={[0, -0.24, 0]} scale={[0.12, 0.32, 0.12]} castShadow />
              <mesh geometry={geometries.sphereLow()} material={joint} position={[0, -0.47, 0]} scale={0.11} />
              {def.role === "product_manager" && x < 0 && (
                <mesh geometry={geometries.box()} material={accent} position={[0.05, -0.5, 0.1]} rotation-x={-0.4} scale={[0.2, 0.26, 0.015]} />
              )}
            </group>
          ))}
          {/* head */}
          <group ref={head} position={[0, rig.headY, 0]}>
            <mesh geometry={geometries.cylinderLow()} material={joint} position={[0, -0.1, 0]} scale={[0.1, 0.1, 0.1]} />
            <mesh geometry={geometries.box()} material={shell} position={[0, 0.07, 0]} scale={[0.34, 0.28, 0.3]} castShadow />
            <mesh geometry={geometries.box()} material={visor} position={[0, 0.09, 0.15]} scale={[0.28, 0.11, 0.02]} />
            <mesh geometry={geometries.box()} material={accent} position={[0, 0.09, 0.162]} scale={[0.2, 0.025, 0.005]} />
            <RoleDetail role={def.role} color={def.color} />
          </group>
        </group>
      </group>
    </group>
  );
});

function RoleDetail({ role, color }: { role: AgentRole; color: string }): ReactNode {
  const accent = accentMaterial(color);
  const metal = materials.metal();
  switch (role) {
    case "orchestrator":
      return (
        <group position={[0, 0.24, 0]}>
          {[-0.1, 0, 0.1].map((x) => (
            <mesh key={x} geometry={geometries.cone()} material={accent} position={[x, x === 0 ? 0.07 : 0.04, 0]} scale={[0.06, x === 0 ? 0.14 : 0.09, 0.06]} />
          ))}
          <mesh geometry={geometries.box()} material={metal} position={[0, -0.02, 0]} scale={[0.32, 0.03, 0.26]} />
        </group>
      );
    case "researcher":
      return (
        <group position={[-0.08, 0.09, 0.17]} rotation-x={Math.PI / 2}>
          <mesh geometry={geometries.cylinderLow()} material={metal} scale={[0.12, 0.06, 0.12]} />
          <mesh geometry={geometries.cylinderLow()} material={accent} position={[0, 0.031, 0]} scale={[0.08, 0.005, 0.08]} />
        </group>
      );
    case "product_manager":
      return <mesh geometry={geometries.box()} material={accent} position={[0, 0.23, -0.02]} scale={[0.22, 0.02, 0.18]} />;
    case "engineer":
      return (
        <group>
          <mesh geometry={geometries.torus()} material={metal} position={[0, 0.1, 0]} rotation-z={Math.PI / 2} scale={[0.4, 0.4, 0.6]} />
          <mesh geometry={geometries.cylinderLow()} material={accent} position={[0.19, 0.08, 0]} rotation-z={Math.PI / 2} scale={[0.09, 0.04, 0.09]} />
          <mesh geometry={geometries.cylinderLow()} material={accent} position={[-0.19, 0.08, 0]} rotation-z={Math.PI / 2} scale={[0.09, 0.04, 0.09]} />
          <mesh geometry={geometries.box()} material={metal} position={[0.14, -0.02, 0.12]} rotation-y={-0.7} scale={[0.015, 0.015, 0.14]} />
        </group>
      );
    case "qa":
      return (
        <group>
          {[-0.09, 0.09].map((x) => (
            <group key={x} position={[x, 0.21, 0]}>
              <mesh geometry={geometries.cylinderLow()} material={metal} position={[0, 0.06, 0]} scale={[0.015, 0.12, 0.015]} />
              <mesh geometry={geometries.sphereLow()} material={accent} position={[0, 0.13, 0]} scale={0.06} />
            </group>
          ))}
        </group>
      );
    case "reviewer":
      return (
        <group position={[0.08, 0.09, 0.17]}>
          <mesh geometry={geometries.torus()} material={accent} scale={[0.13, 0.13, 0.4]} />
          <mesh geometry={geometries.box()} material={metal} position={[0.06, -0.08, 0]} rotation-z={0.5} scale={[0.008, 0.1, 0.008]} />
        </group>
      );
  }
}
