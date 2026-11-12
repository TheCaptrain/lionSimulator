import { Lion } from "./lion.js";
import { Gazelle } from "./gazelle.js";
import { createDNA } from "./dna.js";
import { randomGrassPoint } from "../world/grass.js";
import { isWater, randomLandPoint } from "../world/water.js";

// The starting animals. Gazelles start in herds on fertile grassland and lions
// in prides near them. Members of a group share a colour (give or take a step)
// and a home, so herds are obvious from the start.

const GAZELLE_HERDS = 30;
const GAZELLES_PER_HERD = [7, 13];
const LION_PRIDES = 10;
const LIONS_PER_PRIDE = [3, 5];
const HERD_SPREAD = 250; // how far members start from the centre of their group
const PRIDE_DISTANCE = [600, 1200]; // how far a pride starts from the nearest herd

const randInt = ([min, max]) => min + Math.floor(Math.random() * (max - min + 1));
const randRange = ([min, max]) => min + Math.random() * (max - min);

// A random dry spot near `centre`, falling back to the centre itself
function pointNear(centre, spread) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = spread * Math.sqrt(Math.random());
    const x = centre.x + Math.cos(angle) * dist;
    const y = centre.y + Math.sin(angle) * dist;
    if (!isWater(x, y)) return { x, y };
  }
  return { x: centre.x, y: centre.y };
}

function spawnGroup(Species, centre, count, hue, agents) {
  for (let i = 0; i < count; i++) {
    const p = pointNear(centre, HERD_SPREAD);
    const dna = createDNA();
    // Colours come in steps of 10, so one step either way keeps the group kin
    dna.color = (hue + (Math.floor(Math.random() * 3) - 1) * 10 + 360) % 360;

    const animal = new Species(p.x, p.y, dna);
    animal.home = { x: centre.x, y: centre.y };
    agents.push(animal);
  }
}

export function spawnAnimals() {
  const agents = [];
  const herdCentres = [];

  for (let h = 0; h < GAZELLE_HERDS; h++) {
    const centre = randomGrassPoint();
    herdCentres.push(centre);
    const hue = Math.floor(Math.random() * 36) * 10;
    spawnGroup(Gazelle, centre, randInt(GAZELLES_PER_HERD), hue, agents);
  }

  for (let p = 0; p < LION_PRIDES; p++) {
    // Near a herd, but not on top of it
    const herd = herdCentres[Math.floor(Math.random() * herdCentres.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(PRIDE_DISTANCE);
    let centre = { x: herd.x + Math.cos(angle) * dist, y: herd.y + Math.sin(angle) * dist };
    if (isWater(centre.x, centre.y)) centre = randomLandPoint();

    const hue = Math.floor(Math.random() * 36) * 10;
    spawnGroup(Lion, centre, randInt(LIONS_PER_PRIDE), hue, agents);
  }

  return agents;
}
