import { c } from "./constants.js";

export const camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.1,
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
    const zoomSpeed = 0.001;
    camera.zoom -= e.deltaY * zoomSpeed;
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

export function screenToWorld(mouseX, mouseY, canvas) {
  return {
    x: (mouseX - canvas.width / 2) / camera.zoom + camera.x,
    y: (mouseY - canvas.height / 2) / camera.zoom + camera.y,
  };
}