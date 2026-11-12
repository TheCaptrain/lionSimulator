// A bucket grid for finding things near a point without checking every one.
//
// Call rebuild() once per step with everything that has a `pos`, then query()
// as often as you like. Cost of a query depends on how big the circle is,
// not on how many things exist in the world.

// Things move a little between rebuild() and a query, so look slightly further
// out than asked. Animals move well under this per step.
const MOVE_SLACK = 8;

export class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    this.cellStart = new Int32Array(this.cols * this.rows + 1); // where each cell's items begin in `sorted`
    this.fillPos = new Int32Array(this.cols * this.rows); // scratch space used while rebuilding
    this.cellOf = new Int32Array(0); // which cell each input item landed in
    this.sorted = []; // items grouped by cell
    this.result = []; // reused by query()
  }

  _cellIndex(x, y) {
    const gx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const gy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return gy * this.cols + gx;
  }

  rebuild(items) {
    const { cellStart, fillPos } = this;
    const n = items.length;
    if (this.cellOf.length < n) this.cellOf = new Int32Array(Math.ceil(n * 1.5));
    const cellOf = this.cellOf;

    // Counting sort: count items per cell, turn counts into start positions, then place them
    cellStart.fill(0);
    for (let i = 0; i < n; i++) {
      const cell = this._cellIndex(items[i].pos.x, items[i].pos.y);
      cellOf[i] = cell;
      cellStart[cell + 1]++;
    }
    for (let i = 1; i < cellStart.length; i++) cellStart[i] += cellStart[i - 1];

    fillPos.set(cellStart.subarray(0, fillPos.length));
    this.sorted.length = n;
    for (let i = 0; i < n; i++) {
      this.sorted[fillPos[cellOf[i]]++] = items[i];
    }
  }

  // Everything within `radius` of (x, y), as of now. The returned array is
  // reused by the next query() call, so finish with it (or copy it) first.
  query(x, y, radius) {
    const out = this.result;
    out.length = 0;

    const reach = radius + MOVE_SLACK;
    const { cellSize, cols, rows, cellStart, sorted } = this;
    const gx0 = Math.max(0, Math.floor((x - reach) / cellSize));
    const gx1 = Math.min(cols - 1, Math.floor((x + reach) / cellSize));
    const gy0 = Math.max(0, Math.floor((y - reach) / cellSize));
    const gy1 = Math.min(rows - 1, Math.floor((y + reach) / cellSize));
    const radiusSq = radius * radius;

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const cell = gy * cols + gx;
        for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
          const item = sorted[k];
          const dx = item.pos.x - x;
          const dy = item.pos.y - y;
          if (dx * dx + dy * dy <= radiusSq) out.push(item);
        }
      }
    }
    return out;
  }
}
