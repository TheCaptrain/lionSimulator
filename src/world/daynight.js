import { c } from "../constants.js";

// Time of day runs 0..1: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
// It advances with c.SIM_SPEED, so the sim speed slider also speeds up the days.

const DAY_LENGTH = 3000; // sim time units per full day
// Shadow length per unit of object height. It eases from MIN at noon toward MAX
// at the horizon, so shadows keep stretching right until they fade out.
export const MIN_SHADOW_LENGTH = 0.3;
export const MAX_SHADOW_LENGTH = 6;
const NIGHT_DARKNESS = 0.6;

let time = 0.3; // start in the morning

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function updateDayNight() {
  time = (time + c.SIM_SPEED / DAY_LENGTH) % 1;
}

export function getClockText() {
  const totalMinutes = Math.floor(time * 24 * 60);
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Describes the sun right now. Shadow values are per unit of object height.
export function getSun() {
  const height = Math.sin(2 * Math.PI * (time - 0.25)); // -1 (midnight) .. 1 (noon)
  const dayProgress = clamp((time - 0.25) / 0.5, 0, 1); // 0 at sunrise, 1 at sunset
  const light = clamp((height + 0.15) / 0.45, 0, 1);

  let shadowLength = 0;
  let shadowAlpha = 0;
  if (height > 0) {
    // cot(elevation) is the true shadow length; tanh eases it into [MIN, MAX]
    const cotElevation = Math.sqrt(1 - height * height) / Math.max(height, 0.001);
    const range = MAX_SHADOW_LENGTH - MIN_SHADOW_LENGTH;
    shadowLength = MIN_SHADOW_LENGTH + range * Math.tanh(cotElevation / range);

    // Opacity follows the sun's height: darkest at noon, fading steadily
    // through the afternoon (and mirrored in the morning) to nothing at the horizon
    shadowAlpha = 0.35 * height;
  }

  return {
    height,
    darkness: NIGHT_DARKNESS * (1 - light),
    // Warm glow around sunrise and sunset
    twilight: 0.18 * clamp(1 - Math.abs(height) / 0.3, 0, 1),
    // Sun in the east at sunrise throws shadows west (-x), and the reverse at sunset
    shadowLength,
    shadowX: -Math.cos(Math.PI * dayProgress) * shadowLength,
    shadowY: 0.35 * shadowLength,
    shadowAlpha,
  };
}

// Draws the night/twilight tint over the whole screen. Call after the world is drawn.
export function drawLighting(ctx, canvas, sun) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (sun.twilight > 0.001) {
    ctx.fillStyle = `rgba(255, 120, 40, ${sun.twilight})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (sun.darkness > 0.001) {
    ctx.fillStyle = `rgba(8, 12, 45, ${sun.darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
}
