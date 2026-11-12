import { c } from "../constants.js";
import { layeredNoise } from "../utils/noise.js";

// Rivers and lakes. Water is stored as a coarse grid so isWater() is O(1),
// which lets agents (and later fish) query it every frame.


const CELL = 40; // isWater() grid resolution in world units
const SHORE_WIDTH = 40; // extra width drawn around water as a shoreline

const WATER_COLOR = "#1d4e7a";
const SHORE_COLOR = "#2d6a96";

// Drainage network. The land gets a bumpy height map, water flows downhill to
// a few outlets on the world edge, and every cell drains into exactly one
// neighbour. That makes the rivers a tree: streams join bigger streams, and
// they can never cross.
const FLOW_CELL = 100; // height map / flow resolution in world units
const TERRAIN_WAVELENGTH = 2800; // size of the biggest hills
const OUTLET_COUNT = 3; // places where rivers leave the world
const RIVER_MIN_FLOW = 220; // cells that must drain through a cell before it becomes a river
const RIVER_HEAD_WIDTH = 14; // width of a stream where it starts
const RIVER_WIDTH_PER_SQRT_FLOW = 3.2; // how quickly rivers widen as more land drains into them
const MAX_RIVER_WIDTH = 340;
const LAKE_MIN_DEPTH = 0.12; // how deep a basin must be to fill with a lake
const MAX_LAKE_CELLS = 350; // upper limit on total lake size (cells of FLOW_CELL squared)
const FLAT_SLOPE_MIN = 0.00002; // tiny random slope so water crosses flat areas
const FLAT_SLOPE_MAX = 0.00012;

const rivers = []; // each: [{ x, y, w }, { x, y, w }] (one river segment)
const lakes = []; // each: [{ x, y, r }, ...] (overlapping circles form a blob)

let grid = new Uint8Array(0);
let cols = 0;
let rows = 0;

const rand = (min, max) => min + Math.random() * (max - min);

export function isWater(x, y) {
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
  return grid[gy * cols + gx] === 1;
}

export function randomLandPoint() {
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * c.WORLD_WIDTH;
    const y = Math.random() * c.WORLD_HEIGHT;
    if (!isWater(x, y)) return { x, y };
  }
  return { x: c.WORLD_WIDTH / 2, y: c.WORLD_HEIGHT / 2 };
}

export function generateWater() {
  cols = Math.ceil(c.WORLD_WIDTH / CELL);
  rows = Math.ceil(c.WORLD_HEIGHT / CELL);
  grid = new Uint8Array(cols * rows);
  rivers.length = 0;
  lakes.length = 0;

  const drainage = buildDrainage();
  rivers.push(...makeRivers(drainage));
  lakes.push(makeLakes(drainage));

  rivers.forEach(stampRiver);
  lakes.forEach((lake) => lake.forEach((circle) => stampCircle(circle.x, circle.y, circle.r)));
}

// ---------------------------------------------------------------------------
// Height map: smooth value noise, a few layers deep

function terrainHeight(x, y, seed) {
  return layeredNoise(x, y, seed, TERRAIN_WAVELENGTH);
}

// ---------------------------------------------------------------------------
// Drainage: priority-flood from the outlets. Cells are visited lowest first,
// and each one remembers the neighbour it was reached from. That neighbour is
// where its water flows. Basins get filled up, which is where lakes form.

function buildDrainage() {
  const fw = Math.ceil(c.WORLD_WIDTH / FLOW_CELL);
  const fh = Math.ceil(c.WORLD_HEIGHT / FLOW_CELL);
  const n = fw * fh;
  const seed = Math.floor(Math.random() * 100000);

  const elevation = new Float32Array(n);
  for (let gy = 0; gy < fh; gy++) {
    for (let gx = 0; gx < fw; gx++) {
      elevation[gy * fw + gx] = terrainHeight((gx + 0.5) * FLOW_CELL, (gy + 0.5) * FLOW_CELL, seed);
    }
  }

  const filled = new Float32Array(n);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const order = []; // cells in the order they were reached: parents before children
  const heap = makeHeap(filled);

  for (const i of pickOutlets(fw, fh)) {
    filled[i] = elevation[i];
    closed[i] = 1;
    heap.push(i);
  }

  while (heap.size() > 0) {
    const i = heap.pop();
    order.push(i);
    const gx = i % fw;
    const gy = (i - gx) / fw;

    for (const [nx, ny] of [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]]) {
      if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
      const j = ny * fw + nx;
      if (closed[j]) continue;
      closed[j] = 1;
      parent[j] = i;
      // The random slope makes water wander across flat ground instead of running dead straight
      filled[j] = Math.max(elevation[j], filled[i] + rand(FLAT_SLOPE_MIN, FLAT_SLOPE_MAX));
      heap.push(j);
    }
  }

  // Count how many cells drain through each cell (itself included)
  const flow = new Float32Array(n).fill(1);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    if (parent[i] >= 0) flow[parent[i]] += flow[i];
  }

  return { fw, fh, parent, flow, elevation, filled };
}

// Picks spots around the edge of the world, spread apart from each other.
function pickOutlets(fw, fh) {
  const ring = [];
  for (let x = 0; x < fw; x++) ring.push(x);
  for (let y = 1; y < fh; y++) ring.push(y * fw + fw - 1);
  for (let x = fw - 2; x >= 0; x--) ring.push((fh - 1) * fw + x);
  for (let y = fh - 2; y >= 1; y--) ring.push(y * fw);

  const minGap = Math.floor(ring.length / (OUTLET_COUNT * 2));
  const picked = [];
  for (let attempt = 0; attempt < 200 && picked.length < OUTLET_COUNT; attempt++) {
    const k = Math.floor(Math.random() * ring.length);
    const farEnough = picked.every((p) => {
      const d = Math.abs(p - k);
      return Math.min(d, ring.length - d) >= minGap;
    });
    if (farEnough) picked.push(k);
  }
  return picked.map((k) => ring[k]);
}

// Minimal binary min-heap of cell indices, ordered by keys[index].
function makeHeap(keys) {
  const items = [];
  return {
    size: () => items.length,
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[items[p]] <= keys[items[i]]) break;
        [items[p], items[i]] = [items[i], items[p]];
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length > 0) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && keys[items[l]] < keys[items[m]]) m = l;
          if (r < items.length && keys[items[r]] < keys[items[m]]) m = r;
          if (m === i) break;
          [items[m], items[i]] = [items[i], items[m]];
          i = m;
        }
      }
      return top;
    },
  };
}

// ---------------------------------------------------------------------------
// Rivers: every cell with enough land draining through it joins the network.

function makeRivers({ fw, fh, parent, flow }) {
  const n = fw * fh;
  const isRiver = (i) => flow[i] >= RIVER_MIN_FLOW;

  // One shared node per river cell, nudged off the grid so bends look natural.
  // Neighbouring segments share nodes, so junctions are exact.
  const nodes = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (!isRiver(i)) continue;
    const gx = i % fw;
    const gy = (i - gx) / fw;
    const width = Math.min(
      MAX_RIVER_WIDTH,
      RIVER_HEAD_WIDTH + RIVER_WIDTH_PER_SQRT_FLOW * Math.sqrt(flow[i] - RIVER_MIN_FLOW)
    );
    nodes[i] = {
      x: (gx + 0.5 + rand(-0.3, 0.3)) * FLOW_CELL,
      y: (gy + 0.5 + rand(-0.3, 0.3)) * FLOW_CELL,
      w: width,
    };

    // Outlets run right out to the edge of the world
    if (parent[i] < 0) {
      if (gx === 0) nodes[i].x = 0;
      else if (gx === fw - 1) nodes[i].x = c.WORLD_WIDTH;
      else if (gy === 0) nodes[i].y = 0;
      else nodes[i].y = c.WORLD_HEIGHT;
    }
  }

  // Relax each node toward its neighbours in the tree to take out the grid look
  for (let pass = 0; pass < 3; pass++) {
    const sumX = new Float32Array(n);
    const sumY = new Float32Array(n);
    const count = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      if (!nodes[i] || parent[i] < 0) continue;
      sumX[parent[i]] += nodes[i].x;
      sumY[parent[i]] += nodes[i].y;
      count[parent[i]]++;
    }
    const next = [];
    for (let i = 0; i < n; i++) {
      if (!nodes[i] || parent[i] < 0) continue; // outlets stay put
      const p = nodes[parent[i]];
      const kids = count[i];
      const avgX = kids ? sumX[i] / kids : nodes[i].x;
      const avgY = kids ? sumY[i] / kids : nodes[i].y;
      next.push([i, (nodes[i].x * 2 + p.x + avgX) / 4, (nodes[i].y * 2 + p.y + avgY) / 4]);
    }
    for (const [i, x, y] of next) {
      nodes[i].x = x;
      nodes[i].y = y;
    }
  }

  const segments = [];
  for (let i = 0; i < n; i++) {
    if (nodes[i] && parent[i] >= 0) segments.push([nodes[i], nodes[parent[i]]]);
  }
  return segments;
}

// Basins that had to be filled to let water out become lakes. Only the deepest
// cells are kept, so one huge basin cannot flood the whole map.
function makeLakes({ fw, fh, elevation, filled }) {
  const deep = [];
  for (let i = 0; i < fw * fh; i++) {
    const depth = filled[i] - elevation[i];
    if (depth >= LAKE_MIN_DEPTH) deep.push({ i, depth });
  }
  deep.sort((a, b) => b.depth - a.depth);

  return deep.slice(0, MAX_LAKE_CELLS).map(({ i }) => {
    const gx = i % fw;
    const gy = (i - gx) / fw;
    return { x: (gx + 0.5) * FLOW_CELL, y: (gy + 0.5) * FLOW_CELL, r: FLOW_CELL * 0.75 };
  });
}

function stampCircle(x, y, r) {
  const gx0 = Math.max(0, Math.floor((x - r) / CELL));
  const gx1 = Math.min(cols - 1, Math.floor((x + r) / CELL));
  const gy0 = Math.max(0, Math.floor((y - r) / CELL));
  const gy1 = Math.min(rows - 1, Math.floor((y + r) / CELL));
  const rSq = r * r;

  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const dx = (gx + 0.5) * CELL - x;
      const dy = (gy + 0.5) * CELL - y;
      if (dx * dx + dy * dy <= rSq) grid[gy * cols + gx] = 1;
    }
  }
}

function stampRiver(points) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stampCircle(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        (a.w + (b.w - a.w) * t) / 2
      );
    }
  }
}

// `view` is { left, right, top, bottom } in world units; off-screen water is skipped.
export function drawWater(ctx, view) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Shoreline first, then the water on top of it.
  drawPass(ctx, view, SHORE_COLOR, SHORE_WIDTH);
  drawPass(ctx, view, WATER_COLOR, 0);

  ctx.restore();
}

function drawPass(ctx, view, color, extra) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  for (const river of rivers) {
    for (let i = 0; i < river.length - 1; i++) {
      const a = river[i];
      const b = river[i + 1];
      const margin = Math.max(a.w, b.w) + extra;
      if (
        Math.max(a.x, b.x) + margin < view.left ||
        Math.min(a.x, b.x) - margin > view.right ||
        Math.max(a.y, b.y) + margin < view.top ||
        Math.min(a.y, b.y) - margin > view.bottom
      ) {
        continue;
      }
      ctx.lineWidth = (a.w + b.w) / 2 + extra;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const lake of lakes) {
    for (const circle of lake) {
      const r = circle.r + extra / 2;
      if (
        circle.x + r < view.left ||
        circle.x - r > view.right ||
        circle.y + r < view.top ||
        circle.y - r > view.bottom
      ) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
