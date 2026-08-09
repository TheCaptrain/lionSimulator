import { c } from "./constants.js";
import * as DNA from "./simulation/entities/agent/DNA.js";
import { ZONE_BLUEPRINT } from "./simulation/systems/food_system.js";

export function initUIListeners() {
  document.getElementById("close-editor").onclick = () => {
    document.getElementById("editor-panel").style.display = "none";
  };

  document.getElementById("master-speed").oninput = (e) => {
    c.SIM_SPEED = parseFloat(e.target.value);
  };

  const debugToggle = document.getElementById("debug-toggle");
  debugToggle.addEventListener("change", (e) => {
    c.DEBUG_MODE = e.target.checked;
  });
}

export function showEditor(agent) {
  const container = document.getElementById("dynamic-sliders");
  container.innerHTML = "";

  for (const key in agent.dna) {
    const value = agent.dna[key];
    const config = DNA.DNA_BLUEPRINT[key];

    if (!config) continue;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<label>${config.label}: <span id="label-${key}">${value.toFixed(2)}</span></label><input type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}" style="width:100%">`;

    const input = wrapper.querySelector("input");
    input.oninput = (e) => {
      const val = parseFloat(e.target.value);
      agent.dna[key] = val;
      document.getElementById(`label-${key}`).innerText = val.toFixed(2);

      if (key === "size") {
        agent.radius = 10 * val;
      } else if (key === "max_speed") {
         agent.max_speed = 100 * val; ////////////////only these work
      } else if (key === "vision") {
        agent.vision_range = val;
      }
    };
    container.appendChild(wrapper);
  }
  document.getElementById("editor-panel").style.display = "block";
}

export function showZoneEditor(zone) {
  const container = document.getElementById("dynamic-sliders");
  container.innerHTML = `<h3>Editing: ${zone.label}</h3>`;

  for (const key in ZONE_BLUEPRINT) {
    const config = ZONE_BLUEPRINT[key];
    const value = zone[key];

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<label>${config.label}: <span id="val-${key}">${value}</span></label><input type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}" style="width:100%">`;

    const input = wrapper.querySelector("input");
    input.oninput = (e) => {
      const val = parseFloat(e.target.value);
      zone[key] = val;
      document.getElementById(`val-${key}`).innerText = val;
    };
    container.appendChild(wrapper);
  }
  document.getElementById("editor-panel").style.display = "block";
}