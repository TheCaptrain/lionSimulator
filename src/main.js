import { c } from "./constants.js";
import { BloodParticle } from "./effects/blood.js";
import { camera, initCamera, screenToWorld, getViewBounds } from "./camera.js";
import { generateWater, drawWater } from "./world/water.js";
import { generateGrass, updateGrass, drawGrass, grassFullness } from "./world/grass.js";
import { spawnAnimals } from "./agents/spawn.js";
import { Population } from "./agents/population.js";
import { isInView } from "./utils/canvas.js";
import { generateVillages, drawVillageGround, drawVillageBuildings } from "./world/village.js";
import { generateTrees, drawTrees } from "./world/trees.js";
import { drawGround } from "./world/biomes.js";
import { drawShadows } from "./world/shadows.js";
import { updateDayNight, getSun, drawLighting, getClockText } from "./world/daynight.js";
import { initUIListeners, showEditor } from "./ui.js";

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

let particles = [];
const population = new Population(); // living animals, corpses and the lookup grid
let selectedAgent = null;

const jumpSound = new Audio("sounds/jump.mp3");
jumpSound.play();

// const bgMusic = new Audio("./assets/Jaws-theme-song/Jaws-theme-song.mp3");
// bgMusic.loop = true;

initCamera(canvas);
initUIListeners();

function init() {
  camera.x = c.WORLD_WIDTH / 2;
  camera.y = c.WORLD_HEIGHT / 2;
  camera.zoom = 0.1;

  // Order matters: villages avoid water, grass depends on both, trees avoid all three
  generateWater();
  generateVillages();
  generateGrass();
  generateTrees();
  // bgMusic.play();

  particles = [];
  population.reset(spawnAnimals());
}

// One fixed simulation step. Speed is changed by running more or fewer
// steps per frame (see gameLoop), never by changing the step size.
function update() {
  updateDayNight();
  updateGrass();

  population.beginStep();

  for (const agent of population.living) {
    agent.update(population);

    if (agent.didGetHit) {
      for (let i = 0; i < 3; i++) {
        particles.push(new BloodParticle(agent.pos.x, agent.pos.y, false));
      }
      agent.didGetHit = false;
    }

    if (agent.didHaveOffspring) {
      particles.push(new BloodParticle(agent.pos.x, agent.pos.y, true, true));
      agent.didHaveOffspring = false;
    }

 if (agent.hitPoints <= 0 && !agent.isDead) {
      particles.push(new BloodParticle(agent.pos.x, agent.pos.y, true));

      // Instead of spawning meat immediately, mark the agent as a corpse
      agent.isCorpse = true;
      agent.isDead = true;
      agent.flesh = agent.energy + 30; // Resources available to eat
      agent.hitPoints = 0;
      agent.speed = 0; // Freeze movement
    }

    if (agent.energy <= 20 && !agent.isDead) {
      agent.hitPoints -= 0.01;
    }

    if (agent.energy <= 5 && !agent.isDead) {
      agent.hitPoints -= 0.03;
    }

    // Well-fed animals slowly heal, up to a full set of hit points
    if (agent.energy >= 60 && !agent.isDead) {
      agent.hitPoints = Math.min(c.MAX_HIT_POINTS, agent.hitPoints + c.HP_REGEN_RATE);
    }
  }

  // Bodies rot away, and eventually vanish
  for (const body of population.corpses) body.update(population);

  // The newly dead move to the corpse list, and bodies that have rotted away are dropped
  population.endStep();
  if (selectedAgent?.isGone) {
    selectedAgent = null;
    document.getElementById("editor-panel").style.display = "none";
  }

  particles.forEach((p) => p.update());
  particles = particles.filter((p) => p.life > 0);

}

function draw() {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const view = getViewBounds(canvas);
  const sun = getSun();

  drawGround(ctx, view);
  drawGrass(ctx, view);
  drawWater(ctx, view);
  drawVillageGround(ctx, view);
  drawShadows(ctx, view, sun);
  drawVillageBuildings(ctx, view, camera.zoom);
  drawTrees(ctx, view, camera.zoom);

  particles.forEach((p) => {
    if (p.isPool) p.draw(ctx);
  });
  // Bodies first so living animals draw on top. Anything off-screen is skipped.
  const margin = 120;
  for (const body of population.corpses) {
    if (!isInView(view, body.pos.x, body.pos.y, margin)) continue;
    body.draw(ctx, body === selectedAgent, camera.zoom);
  }
  for (const agent of population.living) {
    if (!isInView(view, agent.pos.x, agent.pos.y, margin)) continue;
    agent.draw(ctx, agent === selectedAgent, camera.zoom);
  }
  particles.forEach((p) => {
    if (!p.isPool) p.draw(ctx);
  });

  ctx.restore();

  drawLighting(ctx, canvas, sun);
}

let hudFrame = 0;

function updateHud() {
  document.getElementById("clock").textContent = getClockText();

  // The grass total loops over every cell, so refresh the numbers a couple of
  // times a second rather than every frame
  if (hudFrame++ % 30 !== 0) return;
  document.getElementById("pop-count").textContent = population.living.length;
  document.getElementById("grass-pct").textContent = Math.round(grassFullness() * 100) + "%";
}

// Simulation speed: c.TIME_SCALE steps per frame (0 = paused, 1 = normal,
// fractions run a step every few frames). If steps take too long the extra
// ones are dropped, so high speeds slow down instead of freezing the page.
const FRAME_BUDGET_MS = 12;
let stepBudget = 0;

function gameLoop() {
  const frameStart = performance.now();
  stepBudget += c.TIME_SCALE;

  while (stepBudget >= 1) {
    update();
    stepBudget -= 1;

    if (performance.now() - frameStart > FRAME_BUDGET_MS) {
      stepBudget = 0;
      break;
    }
  }
  if (c.TIME_SCALE === 0) stepBudget = 0;

  draw();
  updateHud();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("click", (e) => {
  if (e.target.closest("#ui-panel") || e.target.closest("#editor-panel")) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY, canvas);

  const clicked = (a) => Math.hypot(a.pos.x - worldX, a.pos.y - worldY) < a.radius * 2;
  selectedAgent = population.living.find(clicked) ?? population.corpses.find(clicked);

  if (selectedAgent) {
    showEditor(selectedAgent);
    // bgMusic.play();
    return;
  }

});

document.getElementById("close-editor").addEventListener("click", () => {
  selectedAgent = null;
});

init();
gameLoop();