import { c } from "../constants.js";
import { isWater } from "./water.js";
import { addCircle, isInView } from "../utils/canvas.js";

// Villages: a dirt clearing with a well in the middle, round thatched huts
// around it and worn paths between them.

export const villages = [];

const VILLAGE_COUNT = 6;
const MIN_GAP = 1500; // clear space between villages
const HUT_HEIGHT_FACTOR = 1.4; // hut height relative to its radius (for shadows)

const rand = (min, max) => min + Math.random() * (max - min);

export function generateVillages() {
  villages.length = 0;

  for (let attempt = 0; attempt < 500 && villages.length < VILLAGE_COUNT; attempt++) {
    const r = rand(450, 700);
    const edge = r + 400;
    const x = rand(edge, c.WORLD_WIDTH - edge);
    const y = rand(edge, c.WORLD_HEIGHT - edge);

    if (!areaIsDry(x, y, r)) continue;
    if (villages.some((v) => Math.hypot(v.x - x, v.y - y) < v.r + r + MIN_GAP)) continue;

    villages.push(makeVillage(x, y, r));
  }
}

function areaIsDry(x, y, r) {
  if (isWater(x, y)) return false;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (isWater(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
    if (isWater(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5)) return false;
  }
  return true;
}

function makeVillage(x, y, r) {
  const huts = [];
  const target = Math.floor(rand(8, 15));

  for (let attempt = 0; attempt < 300 && huts.length < target; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rand(120, r * 0.8);
    const hr = rand(35, 55);
    const hx = x + Math.cos(angle) * dist;
    const hy = y + Math.sin(angle) * dist;

    if (isWater(hx, hy)) continue;
    if (huts.some((h) => Math.hypot(h.x - hx, h.y - hy) < h.r + hr + 25)) continue;

    huts.push({
      x: hx,
      y: hy,
      r: hr,
      height: hr * HUT_HEIGHT_FACTOR,
      wallColor: `hsl(25, 35%, ${rand(26, 34)}%)`,
      roofColor: `hsl(${rand(34, 42)}, 45%, ${rand(38, 48)}%)`,
      spokeColor: "rgba(60, 40, 15, 0.45)",
    });
  }

  return { x, y, r, huts };
}

// Dirt clearing and paths. Draw before shadows.
export function drawVillageGround(ctx, view) {
  for (const v of villages) {
    if (!isInView(view, v.x, v.y, v.r)) continue;

    const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.r);
    grad.addColorStop(0, "rgba(140, 108, 66, 1)");
    grad.addColorStop(0.7, "rgba(140, 108, 66, 0.9)");
    grad.addColorStop(1, "rgba(140, 108, 66, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(112, 84, 50, 0.8)";
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const h of v.huts) {
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(h.x, h.y);
    }
    ctx.stroke();
  }
}

// Huts and wells. `zoom` is used to skip fine detail when zoomed out.
export function drawVillageBuildings(ctx, view, zoom) {
  for (const v of villages) {
    if (!isInView(view, v.x, v.y, v.r)) continue;

    // Well in the middle: stone ring around dark water
    ctx.fillStyle = "#77736b";
    ctx.beginPath();
    ctx.arc(v.x, v.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d4e7a";
    ctx.beginPath();
    ctx.arc(v.x, v.y, 19, 0, Math.PI * 2);
    ctx.fill();

    for (const h of v.huts) {
      // Wall
      ctx.fillStyle = h.wallColor;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();

      // Thatched roof
      ctx.fillStyle = h.roofColor;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 0.9, 0, Math.PI * 2);
      ctx.fill();

      if (zoom < 0.15) continue;

      // Thatch lines running from the peak to the eaves
      ctx.strokeStyle = h.spokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(h.x + Math.cos(a) * h.r * 0.9, h.y + Math.sin(a) * h.r * 0.9);
      }
      ctx.stroke();

      // Peak
      ctx.fillStyle = h.wallColor;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Adds hut shadows to the current path. A cone's shadow is a circle that
// shrinks toward the tip, so it is built from circles along the shadow line.
export function addHutShadows(ctx, view, sun) {
  for (const v of villages) {
    // Extra margin so long low-sun shadows from the edge huts are not cut off
    if (!isInView(view, v.x, v.y, v.r + 600)) continue;

    for (const h of v.huts) {
      const dx = sun.shadowX * h.height;
      const dy = sun.shadowY * h.height;
      // Enough circles that they overlap into one continuous shadow
      const steps = Math.max(5, Math.ceil(Math.hypot(dx, dy) / (h.r * 0.4)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        addCircle(ctx, h.x + dx * t, h.y + dy * t, h.r * (1 - 0.85 * t));
      }
    }
  }
}
