import * as THREE from "three";

/**
 * Lazily created, process-wide pools. Everything here lives for the page's lifetime and is
 * created once, so mounting/unmounting components never leaks GPU memory.
 */
const geometryPool = new Map<string, THREE.BufferGeometry>();
const materialPool = new Map<string, THREE.Material>();

export function sharedGeometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometryPool.get(key);
  if (!g) {
    g = make();
    geometryPool.set(key, g);
  }
  return g as T;
}

export function sharedMaterial<T extends THREE.Material>(key: string, make: () => T): T {
  let m = materialPool.get(key);
  if (!m) {
    m = make();
    materialPool.set(key, m);
  }
  return m as T;
}

export const geometries = {
  box: () => sharedGeometry("box", () => new THREE.BoxGeometry(1, 1, 1)),
  cylinder: () => sharedGeometry("cylinder", () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24)),
  cylinderLow: () => sharedGeometry("cylinderLow", () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
  sphere: () => sharedGeometry("sphere", () => new THREE.SphereGeometry(0.5, 20, 14)),
  sphereLow: () => sharedGeometry("sphereLow", () => new THREE.SphereGeometry(0.5, 10, 8)),
  capsule: () => sharedGeometry("capsule", () => new THREE.CapsuleGeometry(0.5, 1, 6, 12)),
  disc: () => sharedGeometry("disc", () => new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2)),
  ring: () => sharedGeometry("ring", () => new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2)),
  plane: () => sharedGeometry("plane", () => new THREE.PlaneGeometry(1, 1)),
  torus: () => sharedGeometry("torus", () => new THREE.TorusGeometry(0.5, 0.04, 8, 40)),
  cone: () => sharedGeometry("cone", () => new THREE.ConeGeometry(0.5, 1, 12)),
};

export const materials = {
  wall: () => sharedMaterial("wall", () => new THREE.MeshStandardMaterial({ color: "#121a26", roughness: 0.9, metalness: 0.05 })),
  glass: () =>
    sharedMaterial(
      "glass",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#9fc7e0",
          roughness: 0.08,
          metalness: 0,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    ),
  frame: () => sharedMaterial("frame", () => new THREE.MeshStandardMaterial({ color: "#2a3444", roughness: 0.45, metalness: 0.7 })),
  metal: () => sharedMaterial("metal", () => new THREE.MeshStandardMaterial({ color: "#8d99ab", roughness: 0.35, metalness: 0.8 })),
  darkMetal: () => sharedMaterial("darkMetal", () => new THREE.MeshStandardMaterial({ color: "#1c232e", roughness: 0.5, metalness: 0.6 })),
  ceramic: () => sharedMaterial("ceramic", () => new THREE.MeshStandardMaterial({ color: "#d9dee6", roughness: 0.55, metalness: 0.05 })),
  joint: () => sharedMaterial("joint", () => new THREE.MeshStandardMaterial({ color: "#2b323d", roughness: 0.6, metalness: 0.4 })),
  desk: () => sharedMaterial("desk", () => new THREE.MeshStandardMaterial({ color: "#2a2f38", roughness: 0.55, metalness: 0.25 })),
  deskTop: () => sharedMaterial("deskTop", () => new THREE.MeshStandardMaterial({ color: "#c9b79c", roughness: 0.62, metalness: 0.02 })),
  fabric: () => sharedMaterial("fabric", () => new THREE.MeshStandardMaterial({ color: "#3a4659", roughness: 0.95, metalness: 0 })),
  screenOff: () => sharedMaterial("screenOff", () => new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.3, metalness: 0.2 })),
  visor: () => sharedMaterial("visor", () => new THREE.MeshStandardMaterial({ color: "#0b1118", roughness: 0.15, metalness: 0.6 })),
  leaf: () => sharedMaterial("leaf", () => new THREE.MeshStandardMaterial({ color: "#2f6b4f", roughness: 0.8 })),
  pot: () => sharedMaterial("pot", () => new THREE.MeshStandardMaterial({ color: "#5a4a3f", roughness: 0.85 })),
  hit: () => sharedMaterial("hit", () => new THREE.MeshBasicMaterial({ visible: false })),
};

/** Emissive accent in an agent colour, pooled per colour. */
export function accentMaterial(color: string): THREE.MeshStandardMaterial {
  return sharedMaterial(`accent:${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }));
}

/** Body shell tinted slightly towards the agent colour, pooled per colour. */
export function tintedMaterial(color: string): THREE.MeshStandardMaterial {
  return sharedMaterial(`tint:${color}`, () => {
    const c = new THREE.Color("#dfe4ea").lerp(new THREE.Color(color), 0.18);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.25 });
  });
}

/** Additive unlit material for glows and trails, pooled per colour. */
export function glowMaterial(color: string, opacity = 0.85): THREE.MeshBasicMaterial {
  return sharedMaterial(
    `glow:${color}:${opacity}`,
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
  );
}
