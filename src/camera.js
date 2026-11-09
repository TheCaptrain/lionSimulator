import { c } from "./constants.js";

export const camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.03,
  maxZoom: 5.0,
};

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

export function initCamera(canvas) {
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    c.WIDTH = canvas.width;
    c.HEIGHT = canvas.height;
  }

  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("wheel", (e) => {
    // Multiplicative zoom feels even from fully zoomed out to zoomed in
    camera.zoom *= Math.exp(-e.deltaY * 0.001);
    camera.zoom = Math.min(Math.max(camera.zoom, camera.minZoom), camera.maxZoom);
  });

  window.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      lastMousePos = { x: e.clientX, y: e.clientY };
    }
  });
}

// The world-space rectangle currently visible on screen.
export function getViewBounds(canvas) {
  const halfW = canvas.width / 2 / camera.zoom;
  const halfH = canvas.height / 2 / camera.zoom;
  return {
    left: camera.x - halfW,
    right: camera.x + halfW,
    top: camera.y - halfH,
    bottom: camera.y + halfH,
  };
}

export function screenToWorld(mouseX, mouseY, canvas) {
  return {
    x: (mouseX - canvas.width / 2) / camera.zoom + camera.x,
    y: (mouseY - canvas.height / 2) / camera.zoom + camera.y,
  };
}