import { c } from "../constants.js";
import { isWater } from "./water.js";
import { villages } from "./village.js";
import { addEllipse, isInView } from "../utils/canvas.js";
import { MAX_SHADOW_LENGTH } from "./daynight.js";

// Savannah trees, drawn from above. Each tree has a `height` that decides
// how long its shadow is, and a canopy `r` (radius).

export const trees = [];

const CLUSTER_COUNT = 70; // groves of trees
const SCATTERED_COUNT = 500; // lone trees between the groves
const DETAIL_ZOOM = 0.12; // below this zoom, trees are drawn as a single circle

const rand = (min, max) => min + Math.random() * (max - min);

const TYPES = {
  // trunk: shadow trunk width as a fraction of canopy radius (0 = no trunk)
  acacia: { r: [45, 80], height: [170, 230], trunk: 0.14, hue: [88, 105], light: [24, 32] },
  baobab: { r: [85, 120], height: [200, 260], trunk: 0.24, hue: [75, 90], light: [20, 26] },
  bush: { r: [14, 24], height: [14, 22], trunk: 0, hue: [70, 100], light: [26, 34] },
};

export function generateTrees() {
  trees.length = 0;

  for (let i = 0; i < CLUSTER_COUNT; i++) {
    const cx = rand(0, c.WORLD_WIDTH);
    const cy = rand(0, c.WORLD_HEIGHT);
    const spread = rand(400, 900);
    const count = Math.floor(rand(6, 16));

    for (let j = 0; j < count; j++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = spread * Math.sqrt(Math.random());
      tryAddTree(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
    }
  }

  for (let i = 0; i < SCATTERED_COUNT; i++) {
    tryAddTree(rand(0, c.WORLD_WIDTH), rand(0, c.WORLD_HEIGHT));
  }
}

function tryAddTree(x, y) {
  if (x < 0 || y < 0 || x > c.WORLD_WIDTH || y > c.WORLD_HEIGHT) return;
  if (isWater(x, y)) return;
  // Keep the village clearings open
  if (villages.some((v) => Math.hypot(v.x - x, v.y - y) < v.r * 0.9)) return;

  const roll = Math.random();
  const type = roll < 0.55 ? "acacia" : roll < 0.6 ? "baobab" : "bush";
  const t = TYPES[type];

  const hue = rand(...t.hue);
  const light = rand(...t.light);

  const r = rand(...t.r);

  trees.push({
    x,
    y,
    type,
    r,
    height: rand(...t.height),
    trunkWidth: r * t.trunk,
    outerColor: `hsl(${hue}, 40%, ${light - 6}%)`,
    midColor: `hsl(${hue}, 42%, ${light}%)`,
    innerColor: `hsl(${hue}, 45%, ${light + 6}%)`,
  });
}

export function drawTrees(ctx, view, zoom) {
  const detailed = zoom >= DETAIL_ZOOM;

  for (const t of trees) {
    if (!isInView(view, t.x, t.y, t.r)) continue;

    ctx.fillStyle = t.midColor;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();

    if (!detailed) continue;

    // Darker rim, then a lighter crown offset toward the sun side
    ctx.strokeStyle = t.outerColor;
    ctx.lineWidth = t.r * 0.18;
    ctx.stroke();

    ctx.fillStyle = t.innerColor;
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.15, t.y - t.r * 0.15, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    if (t.type !== "bush") {
      ctx.fillStyle = t.outerColor;
      ctx.beginPath();
      ctx.arc(t.x + t.r * 0.25, t.y + t.r * 0.2, t.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Adds tree shadows to the current path. The canopy's shadow is an ellipse
// pushed away from the sun by the tree's height and stretched along that
// direction as the sun gets low. The trunk is a thin ellipse from the base
// to the canopy shadow.
export function addTreeShadows(ctx, view, sun) {
  for (const t of trees) {
    // Canopy ellipse can be up to ~2x its radius long, so allow for that too
    const margin = t.r * 2 + t.height * MAX_SHADOW_LENGTH;
    if (!isInView(view, t.x, t.y, margin)) continue;

    const dx = sun.shadowX * t.height;
    const dy = sun.shadowY * t.height;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Trunk: spans base to canopy centre, at least as wide as it is thick
    if (t.trunkWidth > 0) {
      addEllipse(
        ctx,
        t.x + dx / 2,
        t.y + dy / 2,
        Math.max(length / 2, t.trunkWidth),
        t.trunkWidth,
        angle
      );
    }

    // Canopy: longer along the shadow direction, slightly flat across it
    addEllipse(
      ctx,
      t.x + dx,
      t.y + dy,
      t.r * (1 + 0.12 * sun.shadowLength),
      t.r * 0.85,
      angle
    );
  }
}
