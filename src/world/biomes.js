import { c } from "../constants.js";
import { villages } from "./village.js";

// Two biomes: villages (circles around each village centre) and savannah everywhere else.

export const BIOME = { SAVANNAH: "savannah", VILLAGE: "village" };

const GROUND_CELL = 250;

// A few shades of dry savannah grass, picked per cell so the ground looks patchy.
const SAVANNAH_COLORS = Array.from({ length: 12 }, (_, i) => {
  const hue = 46 + (i % 4) * 4;
  const light = 34 + (i % 3) * 4 + Math.floor(i / 4);
  return `hsl(${hue}, 38%, ${light}%)`;
});

export function getBiome(x, y) {
  for (const v of villages) {
    const dx = x - v.x;
    const dy = y - v.y;
    if (dx * dx + dy * dy < v.r * v.r) return BIOME.VILLAGE;
  }
  return BIOME.SAVANNAH;
}

// Draws the ground for the visible part of the world.
export function drawGround(ctx, view) {
  const startX = Math.max(0, Math.floor(view.left / GROUND_CELL));
  const startY = Math.max(0, Math.floor(view.top / GROUND_CELL));
  const endX = Math.min(Math.ceil(c.WORLD_WIDTH / GROUND_CELL), Math.ceil(view.right / GROUND_CELL));
  const endY = Math.min(Math.ceil(c.WORLD_HEIGHT / GROUND_CELL), Math.ceil(view.bottom / GROUND_CELL));

  for (let cx = startX; cx < endX; cx++) {
    for (let cy = startY; cy < endY; cy++) {
      const hash = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
      ctx.fillStyle = SAVANNAH_COLORS[hash % SAVANNAH_COLORS.length];
      // +1 overlap avoids hairline gaps between cells
      ctx.fillRect(cx * GROUND_CELL, cy * GROUND_CELL, GROUND_CELL + 1, GROUND_CELL + 1);
    }
  }
}
