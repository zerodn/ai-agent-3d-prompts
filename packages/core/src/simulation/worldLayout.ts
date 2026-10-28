/** Pure world data in metres. x: left(-)/right(+), z: back(-)/front(+). Heading 0 faces +z. */

export interface Vec2 {
  x: number;
  z: number;
}

export type LocationId = "hub" | "ops" | "research" | "product" | "dev" | "testing" | "review" | "planning" | "collab" | "lounge";
export type ZoneId = "operations" | "research" | "development" | "collaboration";
export type StationId = "ops" | "research" | "product" | "dev" | "testing" | "review";

export const FLOOR = { width: 30, depth: 21, minX: -15, maxX: 15, minZ: -9.5, maxZ: 11.5 } as const;
export const CORRIDOR_Z = 2.8;

export interface LocationDef {
  id: LocationId;
  label: string;
  slots: Vec2[];
  /** Fixed heading, or null when agents face the ring centre. */
  facing: number | null;
  center?: Vec2;
  zone: ZoneId;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function ring(center: Vec2, radius: number, count: number): Vec2[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: round(center.x + Math.sin(angle) * radius), z: round(center.z + Math.cos(angle) * radius) };
  });
}

const COLLAB_CENTER: Vec2 = { x: -5, z: 5.6 };
const LOUNGE_CENTER: Vec2 = { x: 7.5, z: 6.2 };

export const LOCATIONS: Record<LocationId, LocationDef> = {
  hub: { id: "hub", label: "Operations Hub", slots: [{ x: 0, z: 1.15 }], facing: Math.PI, zone: "operations" },
  ops: { id: "ops", label: "Ops Console", slots: [{ x: -8.25, z: 0.05 }], facing: Math.PI, zone: "research" },
  research: { id: "research", label: "Research Station", slots: [{ x: -10, z: -3.75 }], facing: Math.PI, zone: "research" },
  product: { id: "product", label: "Product Station", slots: [{ x: -6.5, z: -3.75 }], facing: Math.PI, zone: "research" },
  dev: { id: "dev", label: "Engineering Station", slots: [{ x: 6.5, z: -3.75 }], facing: Math.PI, zone: "development" },
  testing: { id: "testing", label: "QA Lab", slots: [{ x: 10, z: -3.75 }], facing: Math.PI, zone: "development" },
  review: { id: "review", label: "Review Station", slots: [{ x: 8.25, z: 0.05 }], facing: Math.PI, zone: "development" },
  planning: { id: "planning", label: "Planning Board", slots: [{ x: -11.4, z: 4.2 }, { x: -11.0, z: 5.6 }], facing: -Math.PI / 2, zone: "collaboration" },
  collab: { id: "collab", label: "Collaboration Table", slots: ring(COLLAB_CENTER, 1.75, 6), facing: null, center: COLLAB_CENTER, zone: "collaboration" },
  lounge: { id: "lounge", label: "Meeting Lounge", slots: ring(LOUNGE_CENTER, 2.1, 6), facing: null, center: LOUNGE_CENTER, zone: "collaboration" },
};

export interface StationDef {
  id: StationId;
  position: Vec2;
  rotation: number;
}

/** Desks sit 1.2 m behind their stand slot; monitors face +z. */
export const STATIONS: Record<StationId, StationDef> = {
  ops: { id: "ops", position: { x: -8.25, z: -1.15 }, rotation: 0 },
  research: { id: "research", position: { x: -10, z: -4.95 }, rotation: 0 },
  product: { id: "product", position: { x: -6.5, z: -4.95 }, rotation: 0 },
  dev: { id: "dev", position: { x: 6.5, z: -4.95 }, rotation: 0 },
  testing: { id: "testing", position: { x: 10, z: -4.95 }, rotation: 0 },
  review: { id: "review", position: { x: 8.25, z: -1.15 }, rotation: 0 },
};

export const HUB_CENTER: Vec2 = { x: 0, z: -0.6 };
export const MISSION_CONTROL: Vec2 = { x: 0, z: -7.4 };

export function locationLabel(id: LocationId | null | undefined): string {
  return id ? LOCATIONS[id].label : "On the move";
}

export function slotFor(location: LocationId, seat = 0): Vec2 {
  const slots = LOCATIONS[location].slots;
  return slots[((seat % slots.length) + slots.length) % slots.length];
}

export function headingTowards(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** The heading an agent standing at `slot` takes on arrival. */
export function arrivalHeading(location: LocationId, slot: Vec2): number {
  const def = LOCATIONS[location];
  if (def.facing !== null) return def.facing;
  return headingTowards(slot, def.center ?? slot);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

const EPS = 1e-3;

/** Corridor routing: step out to CORRIDOR_Z, travel along x, then step in, so paths never cut through furniture. */
export function route(from: Vec2, to: Vec2): Vec2[] {
  const points: Vec2[] = [];
  const push = (p: Vec2) => {
    const last = points.length ? points[points.length - 1] : from;
    if (distance(last, p) > EPS) points.push(p);
  };
  if (Math.abs(from.x - to.x) >= 0.6) {
    push({ x: from.x, z: CORRIDOR_Z });
    push({ x: to.x, z: CORRIDOR_Z });
  }
  push(to);
  return points;
}

export function pathLength(from: Vec2, path: readonly Vec2[]): number {
  let total = 0;
  let prev = from;
  for (const p of path) {
    total += distance(prev, p);
    prev = p;
  }
  return total;
}
