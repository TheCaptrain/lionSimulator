import { c } from "./constants.js";
import { Lion } from "./simulation/entities/agent/species/lion.js";
import { Gazelle } from "./simulation/entities/agent/species/gazelle.js";
import { BloodParticle } from "./simulation/graphics/blood.js";
import { FoodSystem } from "./simulation/systems/food_system.js";
import { camera, initCamera, screenToWorld } from "./camera.js";
import { generateTownLayout, drawTown } from "./backgrounds/town.js";
import { initUIListeners, showEditor, showZoneEditor } from "./ui.js";

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const foodSystem = new FoodSystem();

let particles = [];
let agents = [];
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
  camera.zoom = 0.5;

  generateTownLayout();
  // bgMusic.play();

  particles = [];
  agents = [];

  for (let i = 0; i < 15; i++) {
    agents.push(
      new Lion(Math.random() * c.WORLD_WIDTH, Math.random() * c.WORLD_HEIGHT)
    );
  }

  for (let i = 0; i < 100; i++) {
    agents.push(
      new Gazelle(Math.random() * c.WORLD_WIDTH, Math.random() * c.WORLD_HEIGHT)
    );
  }
}

function update() {
  const livingAgents = agents.filter((a) => !a.isDead).length;
  document.getElementById("pop-count").textContent = livingAgents;

  foodSystem.update();

  agents.forEach((agent) => {
    agent.update(foodSystem.foods, agents);

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

    if (agent.energy >= 60 && !agent.isDead && agent.energy <= 120) {
      agent.hitPoints += 0.01;
    }
  });

  particles.forEach((p) => p.update());
  particles = particles.filter((p) => p.life > 0);

  //remove your dead
  // agents = agents.filter((agent) => !agent.isDead);

  // if (selectedAgent?.isDead) {
  //   selectedAgent = null;
  //   document.getElementById("editor-panel").style.display = "none";
  // }
}

function draw() {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawTown(ctx);

  particles.forEach((p) => {
    if (p.isPool) p.draw(ctx);
  });
  foodSystem.draw(ctx);
  agents.forEach((agent) => {
    if (!agent || !agent.dna) return;
    agent.draw(ctx, agent === selectedAgent);
  });
  particles.forEach((p) => {
    if (!p.isPool) p.draw(ctx);
  });

  ctx.restore();
}

function gameLoop() {
  update();
  draw();
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

  selectedAgent = agents.find((a) => {
    const dist = Math.sqrt((a.pos.x - worldX) ** 2 + (a.pos.y - worldY) ** 2);
    return dist < a.radius * 2;
  });

  if (selectedAgent) {
    showEditor(selectedAgent);
    // bgMusic.play();
    return;
  }

  const clickedZone = foodSystem.zones.find((zone) => {
    return (
      worldX >= zone.x &&
      worldX <= zone.x + zone.w &&
      worldY >= zone.y &&
      worldY <= zone.y + zone.h
    );
  });

  if (clickedZone) {
    selectedAgent = null;
    showZoneEditor(clickedZone);
    return;
  }
});

document.getElementById("close-editor").addEventListener("click", () => {
  selectedAgent = null;
});

init();
gameLoop();