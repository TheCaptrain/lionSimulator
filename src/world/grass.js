import { c } from "../constants.js";
import { isWater, randomLandPoint } from "./water.js";
import { villages } from "./village.js";
import { layeredNoise } from "../utils/noise.js";

// Grass grows on a grid. Each cell has a fixed fertility (how well grass grows
// there) and a current amount of grass (the energy an animal gets by eating it).
//
// Fertility comes from two things: land near rivers and lakes is moist, and
// there are rich and poor patches inland. Grass regrows logistically, so a
// bare cell recovers slowly at first, then quickly, then levels off at its cap.

const CELL = 100; // world units per grass cell
const CAPACITY = 60; // most energy a single cell can hold
const GROWTH_RATE = 0.0015; // growth per sim time unit at fertility 1
const SEED_AMOUNT = CAPACITY * 0.02; // lets a fully eaten cell start growing again
const MIN_CAPACITY = 0.4; // bare-bones fertile land holds this fraction of CAPACITY; the best land holds all of it

const GROW_EVERY = 4; // grow every N steps (with a matching bigger time step)

const MOISTURE_REACH = 700; // how far from water the extra moisture reaches
const PATCH_WAVELENGTH = 2400; // size of the inland rich and poor patches
const BARE_BELOW = 0.08; // fertility under this is bare ground
const VILLAGE_TRAMPLED = 0.15; // fertility multiplier in the middle of a village

const TEXTURE_REFRESH_FRAMES = 20; // how often the drawn texture is rebuilt

let cols = 0;
let rows = 0;
let fertility = new Float32Array(0);
let capacity = new Float32Array(0); // most grass each cell can hold (poor land holds less)
let amount = new Float32Array(0);
let growable = new Uint32Array(0); // indices of cells where grass can grow
let richCells = new Uint32Array(0); // indices of well watered, fertile cells
let growTick = 0;

// Texture used for drawing
let texture = null;
let textureCtx = null;
let textureData = null;
let textureAge = TEXTURE_REFRESH_FRAMES;

export const GRASS_CAPACITY = CAPACITY;
export const GRASS_CELL = CELL;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function cellIndex(x, y) {
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
  return gy * cols + gx;
}

// Call after generateWater() and generateVillages().
export function generateGrass() {
  cols = Math.ceil(c.WORLD_WIDTH / CELL);
  rows = Math.ceil(c.WORLD_HEIGHT / CELL);
  const n = cols * rows;

  // 1. Which cells touch water, and which are mostly underwater
  const nearWater = new Uint8Array(n);
  const underwater = new Uint8Array(n);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let wet = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          if (isWater((gx + (sx + 0.5) / 3) * CELL, (gy + (sy + 0.5) / 3) * CELL)) wet++;
        }
      }
      const i = gy * cols + gx;
      if (wet > 0) nearWater[i] = 1;
      if (wet >= 5) underwater[i] = 1;
    }
  }

  // 2. Distance (in cells) from each cell to the nearest water
  const dist = distanceTransform(nearWater);

  // 3. Fertility: moisture near water plus inland patches
  const seed = Math.floor(Math.random() * 100000);
  fertility = new Float32Array(n);
  capacity = new Float32Array(n);
  amount = new Float32Array(n);
  const grow = [];
  const rich = [];

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      if (underwater[i]) continue;

      const x = (gx + 0.5) * CELL;
      const y = (gy + 0.5) * CELL;
      const moisture = Math.exp(-(dist[i] * CELL) / (MOISTURE_REACH / 2));
      const patch = layeredNoise(x, y, seed, PATCH_WAVELENGTH, 3);
      let f = smoothstep(0.3, 0.85, 0.55 * moisture + 0.55 * patch);

      // Villages are trampled bare in the middle and poor around the edge
      for (const v of villages) {
        const d = Math.hypot(x - v.x, y - v.y);
        if (d < v.r * 0.8) f *= VILLAGE_TRAMPLED;
        else if (d < v.r) f *= 0.5;
      }

      if (f < BARE_BELOW) continue;
      fertility[i] = f;
      capacity[i] = CAPACITY * (MIN_CAPACITY + (1 - MIN_CAPACITY) * f);
      amount[i] = capacity[i] * (0.5 + 0.5 * Math.random());
      grow.push(i);
      if (f >= 0.5) rich.push(i);
    }
  }

  growable = Uint32Array.from(grow);
  richCells = Uint32Array.from(rich);
  growTick = 0;
  texture = null; // rebuilt on the next draw
}

// Two pass approximation of the distance from each cell to the nearest source cell.
function distanceTransform(source) {
  const INF = 1e9;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = source[i] ? 0 : INF;
  const D = Math.SQRT2;

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      if (gx > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (gy > 0) {
        d[i] = Math.min(d[i], d[i - cols] + 1);
        if (gx > 0) d[i] = Math.min(d[i], d[i - cols - 1] + D);
        if (gx < cols - 1) d[i] = Math.min(d[i], d[i - cols + 1] + D);
      }
    }
  }
  for (let gy = rows - 1; gy >= 0; gy--) {
    for (let gx = cols - 1; gx >= 0; gx--) {
      const i = gy * cols + gx;
      if (gx < cols - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (gy < rows - 1) {
        d[i] = Math.min(d[i], d[i + cols] + 1);
        if (gx < cols - 1) d[i] = Math.min(d[i], d[i + cols + 1] + D);
        if (gx > 0) d[i] = Math.min(d[i], d[i + cols - 1] + D);
      }
    }
  }
  return d;
}

// Call once per simulation step.
export function updateGrass() {
  if (++growTick < GROW_EVERY) return;
  growTick = 0;

  const dt = c.SIM_SPEED * GROW_EVERY;
  for (let k = 0; k < growable.length; k++) {
    const i = growable[k];
    const g = amount[i];
    const cap = capacity[i];
    const growth = GROWTH_RATE * fertility[i] * (g + SEED_AMOUNT) * (1 - g / cap) * dt;
    amount[i] = g + growth > cap ? cap : g + growth;
  }
}

export function grassAt(x, y) {
  const i = cellIndex(x, y);
  return i < 0 ? 0 : amount[i];
}

export function fertilityAt(x, y) {
  const i = cellIndex(x, y);
  return i < 0 ? 0 : fertility[i];
}

// Eats up to `wanted` from the cell at (x, y). Returns how much was actually eaten.
export function eatGrass(x, y, wanted) {
  const i = cellIndex(x, y);
  if (i < 0) return 0;
  const eaten = Math.min(wanted, amount[i]);
  amount[i] -= eaten;
  return eaten;
}

// Finds a good patch of grass within `range` of (x, y). Bigger patches and
// closer ones score higher, and patches outside the animal's home range are
// worth half. Returns a point inside the chosen cell, or null.
export function findGrass(x, y, range, minAmount, home, homeRadius) {
  const cells = Math.ceil(range / CELL);
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  let best = -1;
  let bestScore = 0;

  for (let gy = Math.max(0, cy - cells); gy <= Math.min(rows - 1, cy + cells); gy++) {
    for (let gx = Math.max(0, cx - cells); gx <= Math.min(cols - 1, cx + cells); gx++) {
      const i = gy * cols + gx;
      const a = amount[i];
      if (a < minAmount) continue;

      const px = (gx + 0.5) * CELL;
      const py = (gy + 0.5) * CELL;
      const d = Math.hypot(px - x, py - y);
      if (d > range) continue;

      let score = a / (1 + d / 150);
      if (home && Math.hypot(px - home.x, py - home.y) > homeRadius) score *= 0.5;
      score *= 0.95 + Math.random() * 0.1; // stops a whole herd choosing identically
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
  }
  if (best < 0) return null;

  const bx = best % cols;
  const by = (best - bx) / cols;
  return {
    x: (bx + 0.2 + Math.random() * 0.6) * CELL,
    y: (by + 0.2 + Math.random() * 0.6) * CELL,
  };
}

// A spot with plenty of grass, for placing herds at the start.
export function randomGrassPoint() {
  if (richCells.length === 0) return randomLandPoint();
  const i = richCells[Math.floor(Math.random() * richCells.length)];
  const gx = i % cols;
  const gy = (i - gx) / cols;
  return { x: (gx + Math.random()) * CELL, y: (gy + Math.random()) * CELL };
}

// 0..1: how full the grass is across the fertile land.
export function grassFullness() {
  let total = 0;
  let max = 0;
  for (let k = 0; k < growable.length; k++) {
    const i = growable[k];
    if (fertility[i] < 0.3) continue;
    total += amount[i];
    max += capacity[i];
  }
  return max > 0 ? total / max : 0;
}

// ---------------------------------------------------------------------------
// Drawing: one pixel per cell in a small texture, stretched over the world with
// smoothing, so grass patches blend softly instead of showing square cells.

function buildTexture() {
  texture = document.createElement("canvas");
  texture.width = cols;
  texture.height = rows;
  textureCtx = texture.getContext("2d");
  textureData = textureCtx.createImageData(cols, rows);
  textureAge = TEXTURE_REFRESH_FRAMES;
}

function refreshTexture() {
  const px = textureData.data;
  for (let i = 0; i < cols * rows; i++) {
    const f = fertility[i];
    const o = i * 4;
    if (f <= 0) {
      px[o + 3] = 0;
      continue;
    }
    const lush = amount[i] / CAPACITY;
    // Dry yellow-green when grazed bare, deep green when full
    px[o] = 118 - 70 * lush;
    px[o + 1] = 138 + 4 * lush;
    px[o + 2] = 56 - 6 * lush;
    px[o + 3] = 255 * clamp(0.1 * f + 0.78 * Math.pow(lush, 0.8), 0, 0.88);
  }
  textureCtx.putImageData(textureData, 0, 0);
}

// `view` is { left, right, top, bottom } in world units.
export function drawGrass(ctx, view) {
  if (cols === 0) return;
  if (!texture) buildTexture();
  if (++textureAge >= TEXTURE_REFRESH_FRAMES) {
    textureAge = 0;
    refreshTexture();
  }

  const x0 = clamp(Math.floor(view.left / CELL) - 1, 0, cols - 1);
  const y0 = clamp(Math.floor(view.top / CELL) - 1, 0, rows - 1);
  const x1 = clamp(Math.ceil(view.right / CELL) + 1, 1, cols);
  const y1 = clamp(Math.ceil(view.bottom / CELL) + 1, 1, rows);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(texture, x0, y0, x1 - x0, y1 - y0, x0 * CELL, y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL);
  ctx.restore();
}
