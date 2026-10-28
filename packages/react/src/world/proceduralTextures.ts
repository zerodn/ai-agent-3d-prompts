import { createRng } from "@agent-world/core";
import * as THREE from "three";

/** Canvas-generated textures, built once and cached. No binary assets. */
const cache = new Map<string, THREE.Texture>();

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, color = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Large-format tiles with soft variation and seams. One texture covers 4×4 tiles. */
export function floorTexture(): THREE.Texture {
  return cached("floor", () => {
    const [c, ctx] = canvas(512, 512);
    const rng = createRng(7);
    const tile = 128;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 26 + Math.floor(rng() * 7);
        ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 10})`;
        ctx.fillRect(x * tile, y * tile, tile, tile);
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = `rgba(255,255,255,${rng() * 0.018})`;
          ctx.fillRect(x * tile + rng() * tile, y * tile + rng() * tile, 6 + rng() * 30, 2 + rng() * 10);
        }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tile, 0);
      ctx.lineTo(i * tile, 512);
      ctx.moveTo(0, i * tile);
      ctx.lineTo(512, i * tile);
      ctx.stroke();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Blue-hour gradient for the sky behind the window wall. */
export function skyTexture(): THREE.Texture {
  return cached("sky", () => {
    const [c, ctx] = canvas(16, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#050a18");
    g.addColorStop(0.45, "#13284a");
    g.addColorStop(0.75, "#3b4f7a");
    g.addColorStop(0.9, "#a0627a");
    g.addColorStop(1, "#d9905f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    return toTexture(c);
  });
}

/** Lit office windows for the skyline towers (used as emissive map). */
export function windowsTexture(): THREE.Texture {
  return cached("windows", () => {
    const [c, ctx] = canvas(128, 256);
    const rng = createRng(11);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 4; y < 256; y += 8) {
      for (let x = 4; x < 128; x += 8) {
        if (rng() < 0.38) {
          const warm = rng() < 0.7;
          const a = 0.35 + rng() * 0.65;
          ctx.fillStyle = warm ? `rgba(255, 196, 120, ${a})` : `rgba(150, 200, 255, ${a})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Scrolling "code" for monitors. Scroll by animating `offset.y`. */
export function screenTexture(): THREE.Texture {
  return cached("screen", () => {
    const [c, ctx] = canvas(256, 256);
    const rng = createRng(23);
    ctx.fillStyle = "#06101a";
    ctx.fillRect(0, 0, 256, 256);
    const colors = ["#7cc4d6", "#9ad7e6", "#6fe3a4", "#f2b46a", "#b7c1cf", "#a78bfa"];
    for (let y = 6; y < 256; y += 9) {
      let x = 8 + Math.floor(rng() * 4) * 12;
      const tokens = 1 + Math.floor(rng() * 5);
      for (let i = 0; i < tokens && x < 240; i++) {
        const w = 10 + rng() * 46;
        ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
        ctx.globalAlpha = 0.55 + rng() * 0.45;
        ctx.fillRect(x, y, Math.min(w, 248 - x), 4);
        x += w + 6;
      }
    }
    ctx.globalAlpha = 1;
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Soft radial blob (contact shadow). */
export function blobTexture(): THREE.Texture {
  return cached("blob", () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.75)");
    g.addColorStop(0.6, "rgba(0,0,0,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return toTexture(c, false);
  });
}

/** Soft radial glow (packets, dust). */
export function glowTexture(): THREE.Texture {
  return cached("glow", () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return toTexture(c, false);
  });
}
