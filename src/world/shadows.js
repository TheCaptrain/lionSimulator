import { addTreeShadows } from "./trees.js";
import { addHutShadows } from "./village.js";

// All shadows go into one path and are filled once. Overlapping shadows then
// stay one flat tone instead of getting darker where they cross.
export function drawShadows(ctx, view, sun) {
  if (sun.shadowAlpha <= 0) return;

  ctx.beginPath();
  addTreeShadows(ctx, view, sun);
  addHutShadows(ctx, view, sun);
  ctx.fillStyle = `rgba(0, 0, 0, ${sun.shadowAlpha})`;
  ctx.fill();
}
