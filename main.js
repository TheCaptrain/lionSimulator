import { c } from "./constants.js";
import { Vector } from "./utils/Vector.js";
import { Agent } from "./simulation/entities/agent/agent.js";
import { BloodParticle } from "./simulation/graphics/blood.js";
import * as DNA from "./simulation/entities/agent/DNA.js";
import {
  FoodSystem,
  ZONE_BLUEPRINT,
} from "./simulation/systems/food_system.js";
const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const foodSystem = new FoodSystem();
const foodConfig = { nutrition: 50, growthRate: 0.5, maxSize: 15 };

let particles = [];
let agents = [];

const townLayout = [];
function generateTownLayout() {
  const cellSize = 400;
  const padding = 100;

  for (let x = 0; x < c.WORLD_WIDTH; x += cellSize) {
    for (let y = 0; y < c.WORLD_HEIGHT; y += cellSize) {
      if (Math.random() > 0.3) {
        // Variety: Randomize building type and vibrant colors
        const hue = Math.floor(Math.random() * 360);
        const type = Math.random() > 0.5 ? "rect" : "complex";

        townLayout.push({
          x: x + padding / 2,
          y: y + padding / 2,
          w: (cellSize - padding) * (0.7 + Math.random() * 0.3),
          h: (cellSize - padding) * (0.7 + Math.random() * 0.3),
          color: `hsl(${hue}, 40%, 35%)`,
          roofColor: `hsl(${hue}, 50%, 20%)`,
          windowColor: `hsla(${(hue + 40) % 360}, 100%, 70%, 0.3)`,
          type: type,
          offset: Math.random() * 15, // For a slight 3D perspective effect
        });
      }
    }
  }
}

const jumpSound = new Audio("sounds/jump.mp3");

// To play the sound
jumpSound.play();

// To loop background music
const bgMusic = new Audio("./assets/Jaws-theme-song/Jaws-theme-song.mp3");
bgMusic.loop = true;
bgMusic.play();

// Call this in your init()

// Ensure canvas matches screen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  c.WIDTH = canvas.width;
  c.HEIGHT = canvas.height;
}

window.addEventListener("resize", resize);
resize();

function init() {
  // Center camera in the middle of the world
  camera.x = c.WORLD_WIDTH / 2;
  camera.y = c.WORLD_HEIGHT / 2;
  camera.zoom = 0.5; // Zoom out a bit to see the world

  generateTownLayout();

  bgMusic.play();

  particles = [];
  agents = [];
  for (let i = 0; i < 50; i++) {
    agents.push(
      new Agent(Math.random() * c.WORLD_WIDTH, Math.random() * c.WORLD_HEIGHT)
    );
  }
}

function drawTown(ctx) {
  const cellSize = 400;
  const roadWidth = 100;

  // 1. Draw Roads & Sidewalks (The Grid)
  for (let x = 0; x < c.WORLD_WIDTH; x += cellSize) {
    for (let y = 0; y < c.WORLD_HEIGHT; y += cellSize) {
      // Asphalt Road (Dark Gray)
      ctx.fillStyle = "#151515";
      ctx.fillRect(x, y, cellSize, cellSize);

      // Sidewalks (Light Gray) - creates the "blocks"
      ctx.fillStyle = "#333";
      ctx.fillRect(
        x + roadWidth / 2,
        y + roadWidth / 2,
        cellSize - roadWidth,
        cellSize - roadWidth
      );

      // Road Markings (Dashed Lines)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.setLineDash([20, 20]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellSize, cellSize);
      ctx.setLineDash([]); // Reset dash for buildings
    }
  }

  // 2. Draw Buildings (Existing logic)
  townLayout.forEach((b) => {
    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);

    // Main Facade
    ctx.fillStyle = b.color;
    if (b.type === "complex") {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h * 0.6);
      ctx.lineTo(b.x + b.w * 0.6, b.y + b.h * 0.6);
      ctx.lineTo(b.x + b.w * 0.6, b.y + b.h);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Roof
    ctx.fillStyle = b.roofColor;
    const rP = 15;
    if (b.type === "complex") {
      ctx.beginPath();
      ctx.moveTo(b.x + rP, b.y + rP);
      ctx.lineTo(b.x + b.w - rP, b.y + rP);
      ctx.lineTo(b.x + b.w - rP, b.y + b.h * 0.6 - rP);
      ctx.lineTo(b.x + b.w * 0.6 - rP, b.y + b.h * 0.6 - rP);
      ctx.lineTo(b.x + b.w * 0.6 - rP, b.y + b.h - rP);
      ctx.lineTo(b.x + rP, b.y + b.h - rP);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(b.x + rP, b.y + rP, b.w - rP * 2, b.h - rP * 2);
    }

    // Windows
    ctx.fillStyle = b.windowColor;
    for (let wx = b.x + 25; wx < b.x + b.w - 25; wx += 40) {
      for (let wy = b.y + 25; wy < b.y + b.h - 25; wy += 40) {
        if (b.type === "rect" || ctx.isPointInPath(wx, wy)) {
          ctx.fillRect(wx, wy, 10, 10);
        }
      }
    }

    ctx.restore();
  });
}

function update() {
  const livingAgents = agents.filter((a) => !a.isDead).length;
  document.getElementById("pop-count").textContent = livingAgents;

  // 1. System Logic (Spawns food, cleans up eaten food)
  foodSystem.update();

  agents.forEach((agent) => {
    agent.update(foodSystem.foods, agents);

    if (agent.didGetHit) {
      for (let i = 0; i < 3; i++) {
        particles.push(new BloodParticle(agent.pos.x, agent.pos.y, false));
      }
      agent.didGetHit = false; // Reset the flag
    }

    if (agent.didHaveOffspring) {
      particles.push(new BloodParticle(agent.pos.x, agent.pos.y, true, true));

      agent.didHaveOffspring = false; // Reset the flag
    }

    if (agent.hitPoints <= 0 && !agent.isDead) {
      particles.push(new BloodParticle(agent.pos.x, agent.pos.y, true));

      foodSystem.spawnMeat(
        agent.pos.x,
        agent.pos.y,
        agent.energy + 30,
        agent.dna.color,
        agent.heading,
        agent.radius // Passing size here
      );
      agent.isDead = true;

    }

    if (agent.energy <= 20 && !agent.isDead) {
      agent.hitPoints -= 0.01;
    }

    if (agent.energy <= 5 && !agent.isDead) {
      agent.hitPoints -= 0.03;
    }

    if (agent.energy >= 60 && !agent.isDead && agent.energy <= 120 ) {
      agent.hitPoints += 0.01;
    }

  });

  particles.forEach((p) => p.update());
  particles = particles.filter((p) => p.life > 0);

  // 4. Cleanup Dead Agents
  agents = agents.filter((agent) => !agent.isDead);

  // 5. UI Maintenance
  if (selectedAgent?.isDead) {
    selectedAgent = null;
    document.getElementById("editor-panel").style.display = "none";
  }
}

function draw() {
  ctx.fillStyle = "#1a1a1a"; // Darker asphalt color
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // --- BACKGROUND LAYER ---
  // Draw Roads (Grid)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  // ... your existing grid code ...

  // Draw the Town
  drawTown(ctx);

  // --- ENTITY LAYER ---
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

let camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.1,
  maxZoom: 5.0,
};

// Zoom logic
window.addEventListener("wheel", (e) => {
  const zoomSpeed = 0.001;
  camera.zoom -= e.deltaY * zoomSpeed;
  camera.zoom = Math.min(Math.max(camera.zoom, camera.minZoom), camera.maxZoom);
});

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

window.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastMousePos = { x: e.clientX, y: e.clientY };
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    // Calculate how far the mouse moved
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    // Move the camera inversely to the mouse movement
    // We divide by zoom so that dragging feels consistent at all zoom levels
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;

    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

let selectedAgent = null;

window.addEventListener("click", (e) => {
  // 1. TOP PRIORITY: Check if we clicked the HTML Menu/Editor first
  // If the click is inside any UI div, stop and do nothing else.
  if (e.target.closest("#ui-panel") || e.target.closest("#editor-panel")) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - canvas.width / 2) / camera.zoom + camera.x;
  const worldY = (mouseY - canvas.height / 2) / camera.zoom + camera.y;

  // 2. SECOND PRIORITY: Agents
  // We check agents BEFORE zones so you can select agents standing in grass/food.
  selectedAgent = agents.find((a) => {
    const dist = Math.sqrt((a.pos.x - worldX) ** 2 + (a.pos.y - worldY) ** 2);
    return dist < a.radius * 2;
  });

  if (selectedAgent) {
    showEditor(selectedAgent);
    bgMusic.play();

    // hideZoneEditor(); // Useful if you want only one menu open at a time
    return;
  }

  // 3. THIRD PRIORITY: Zones
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

  // 4. FINAL: Empty Space
  // selectedAgent = null;
  // document.getElementById('editor-panel').style.display = 'none';
});

function showEditor(agent) {
  const container = document.getElementById("dynamic-sliders");
  container.innerHTML = "";

  for (const key in agent.dna) {
    const value = agent.dna[key];
    const config = DNA.DNA_BLUEPRINT[key];

    // Safety: Skip keys that aren't defined in the blueprint
    if (!config) continue;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
            <label>${config.label}: <span id="label-${key}">${value.toFixed(
      2
    )}</span></label>
            <input type="range" 
                   min="${config.min}" max="${config.max}" step="${
      config.step
    }" 
                   value="${value}" style="width:100%">
        `;

    const input = wrapper.querySelector("input");
    input.oninput = (e) => {
      const val = parseFloat(e.target.value);
      agent.dna[key] = val;
      document.getElementById(`label-${key}`).innerText = val.toFixed(2);

      // Sync all physical properties
      if (key === "size") {
        agent.radius = 10 * val;
      } else if (key === "speed") {
        agent.max_speed = 2.5 * val;
      } else if (key === "vision") {
        // If you have vision logic, update it here
        agent.vision_range = val;
      }
      // Note: 'color' and 'kin_recogn' usually don't need sync logic
      // because draw() and identifyRelationship() read directly from DNA every frame.
    };
    container.appendChild(wrapper);
  }
  document.getElementById("editor-panel").style.display = "block";
}

document.getElementById("close-editor").onclick = () => {
  document.getElementById("editor-panel").style.display = "none";
  selectedAgent = null;
};

document.getElementById("master-speed").oninput = (e) => {
  c.SIM_SPEED = parseFloat(e.target.value);
};

function showZoneEditor(zone) {
  const container = document.getElementById("dynamic-sliders");
  container.innerHTML = `<h3>Editing: ${zone.label}</h3>`;

  // Use the blueprint we just created
  for (const key in ZONE_BLUEPRINT) {
    const config = ZONE_BLUEPRINT[key];
    const value = zone[key];

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
            <label>${config.label}: <span id="val-${key}">${value}</span></label>
            <input type="range" min="${config.min}" max="${config.max}" 
                   step="${config.step}" value="${value}" style="width:100%">
        `;

    const input = wrapper.querySelector("input");
    input.oninput = (e) => {
      const val = parseFloat(e.target.value);
      zone[key] = val; // Update the zone object directly
      document.getElementById(`val-${key}`).innerText = val;
    };
    container.appendChild(wrapper);
  }
  document.getElementById("editor-panel").style.display = "block";
}



const debugToggle = document.getElementById("debug-toggle");

debugToggle.addEventListener("change", (e) => {
  c.DEBUG_MODE = e.target.checked;
});
init();
gameLoop();
