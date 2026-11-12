// Smooth value noise, shared by terrain features (rivers, fertility).

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth noise in 0..1. One unit of x or y is one noise "cell".
export function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const top = hash2(ix, iy, seed) * (1 - sx) + hash2(ix + 1, iy, seed) * sx;
  const bottom = hash2(ix, iy + 1, seed) * (1 - sx) + hash2(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

// Several layers of noise added together: big shapes plus finer detail.
// `wavelength` is the size of the biggest shapes, in the same units as x and y.
export function layeredNoise(x, y, seed, wavelength, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1 / wavelength;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    value += valueNoise(x * frequency, y * frequency, seed + octave) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}
