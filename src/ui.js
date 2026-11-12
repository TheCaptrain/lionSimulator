import { c } from "./constants.js";
import * as DNA from "./agents/dna.js";


export function initUIListeners() {
  document.getElementById("close-editor").onclick = () => {
    document.getElementById("editor-panel").style.display = "none";
  };

  const speedSlider = document.getElementById("master-speed");
  const speedLabel = document.getElementById("speed-label");
  const showSpeed = () => {
    speedLabel.textContent = c.TIME_SCALE === 0 ? "Paused" : `${c.TIME_SCALE}x`;
  };
  speedSlider.oninput = (e) => {
    c.TIME_SCALE = parseFloat(e.target.value);
    showSpeed();
  };
  speedSlider.value = c.TIME_SCALE;
  showSpeed();

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
