import { c } from "../constants.js";

export const townLayout = [];

export function generateTownLayout() {
  const cellSize = 400;
  const padding = 100;

  for (let x = 0; x < c.WORLD_WIDTH; x += cellSize) {
    for (let y = 0; y < c.WORLD_HEIGHT; y += cellSize) {
      if (Math.random() > 0.3) {
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
          offset: Math.random() * 15,
        });
      }
    }
  }
}

export function drawTown(ctx) {
  const cellSize = 400;
  const roadWidth = 100;

  for (let x = 0; x < c.WORLD_WIDTH; x += cellSize) {
    for (let y = 0; y < c.WORLD_HEIGHT; y += cellSize) {
      ctx.fillStyle = "#151515";
      ctx.fillRect(x, y, cellSize, cellSize);

      ctx.fillStyle = "#333";
      ctx.fillRect(
        x + roadWidth / 2,
        y + roadWidth / 2,
        cellSize - roadWidth,
        cellSize - roadWidth
      );

      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.setLineDash([20, 20]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellSize, cellSize);
      ctx.setLineDash([]);
    }
  }

  townLayout.forEach((b) => {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);

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