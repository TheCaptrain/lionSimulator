import { c } from "../constants.js";
import { SpatialGrid } from "../utils/spatial_grid.js";

const GRID_CELL = 128; // world units per grid cell

// Everything that lives in the world, kept in the shape the agents need:
//   living     animals that are alive (the only ones that act)
//   corpses    dead bodies, which carnivores eat. Kept apart from the living so
//              that the many "who is near me" checks never have to look at them
//   predators  the living predators, a short list gazelles can check cheaply
//
// Agents are handed this object in update(). Call beginStep() before updating
// anyone and endStep() after.
export class Population {
  constructor() {
    this.living = [];
    this.corpses = [];
    this.predators = [];
    this.newborns = [];
    this.grid = new SpatialGrid(c.WORLD_WIDTH, c.WORLD_HEIGHT, GRID_CELL);
  }

  // Starts a fresh world containing `animals`
  reset(animals) {
    this.living = animals.slice();
    this.corpses = [];
    this.predators = [];
    this.newborns = [];
  }

  // Babies join the world at the start of the next step
  add(animal) {
    this.newborns.push(animal);
  }

  beginStep() {
    if (this.newborns.length > 0) {
      for (const baby of this.newborns) this.living.push(baby);
      this.newborns.length = 0;
    }

    this.predators.length = 0;
    for (const a of this.living) {
      if (a.role === "predator") this.predators.push(a);
    }
    this.grid.rebuild(this.living);
  }

  // Moves animals that died this step to the corpse list, and drops bodies
  // that have rotted away completely.
  endStep() {
    let kept = 0;
    for (const a of this.living) {
      if (a.isDead) this.corpses.push(a);
      else this.living[kept++] = a;
    }
    this.living.length = kept;

    let bodies = 0;
    for (const b of this.corpses) {
      if (!b.isGone) this.corpses[bodies++] = b;
    }
    this.corpses.length = bodies;
  }

  // Living animals within `radius` of a point. The returned array is reused by
  // the next call, so finish with it before asking again.
  near(x, y, radius) {
    return this.grid.query(x, y, radius);
  }

  // The closest body within `range` that still has meat on it, or null
  nearestMeat(x, y, range) {
    let best = null;
    let bestSq = range * range;
    for (const body of this.corpses) {
      if ((body.flesh ?? 0) <= 0) continue;
      const dx = body.pos.x - x;
      const dy = body.pos.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestSq) {
        bestSq = distSq;
        best = body;
      }
    }
    return best;
  }
}
