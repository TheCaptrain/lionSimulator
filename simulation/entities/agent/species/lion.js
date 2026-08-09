import { Agent } from "../agent.js";

export class Lion extends Agent {
  constructor(x, y, dna = null) {
    super(x, y, dna);
    this.type = "lion";
    this.role = "predator";
    this.isCarnivore = true;

    // Stronger and larger
    this.radius = 14;
    // this.max_speed = 3.0;
  }

  // Override: Lions look specifically for prey (gazelles) to attack
  _checkCombat(agents) {
    const nearbyPrey = agents.filter(
      (a) => a.role === "prey" && !a.isDead
    );

    let closestPrey = null;
    let closestDistSq = Infinity;

    for (const prey of nearbyPrey) {
      const dx = prey.pos.x - this.pos.x;
      const dy = prey.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < this.vision_range ** 2 && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestPrey = prey;
      }
    }

    if (closestPrey) {
      this.currentState = "ATTACKING";
      this.targetPosition = closestPrey.pos;
      this._seek(closestPrey.pos);
      this._resolveAttack(closestPrey);
      return true;
    }

    return false;
  }

  drawBody(ctx) {
    const r = this.radius;
    const baseHue = this.dna.color ?? 40;

    // Tail
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${baseHue}, 50%, 30%)`;
    ctx.lineWidth = r * 0.2;
    ctx.moveTo(-r * 1.2, 0);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.5, -r * 1.8, 0);
    ctx.stroke();

    // Body & Mane
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 60%, 50%)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 70%, 30%)`;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 60%, 60%)`;
    ctx.fill();

    // Ears
    ctx.fillStyle = `hsl(${baseHue}, 60%, 40%)`;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 0.6, side * r * 0.5, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });

    // Eyes
    ctx.fillStyle = "white";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 0.9, side * r * 0.2, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fangs (Attacking)
    if (this.currentState === "ATTACKING") {
      ctx.fillStyle = "#fff";
      [-0.3, 0.3].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(r * 1.0, offset * r);
        ctx.lineTo(r * 1.2, offset * 0.67 * r);
        ctx.lineTo(r * 1.5, offset * 0.33 * r);
        ctx.fill();
      });
    }
  }

  drawCorpse(ctx, r = this.radius) {
    const baseHue = this.dna?.color ?? 40;
    const corpseColor = `hsl(${baseHue}, 40%, 25%)`;
    const maneColor = `hsl(${baseHue}, 50%, 15%)`;

    // 1. Body (Oval)
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = corpseColor;
    ctx.fill();

    // 2. Battle Scars (Cuts)
    ctx.strokeStyle = "rgba(139, 0, 0, 0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5 + i * 5, -r * 0.3);
      ctx.lineTo(-r * 0.8 + i * 5, r * 0.3);
      ctx.stroke();
    }

    // 3. Mane (Matted/Dark)
    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = maneColor;
    ctx.fill();

    // 4. Head
    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = corpseColor;
    ctx.fill();

    // 5. "X" Eyes
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 1.5;
    [-1, 1].forEach((side) => {
      const ex = r * 0.9;
      const ey = side * r * 0.2;
      const s = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(ex - s, ey - s);
      ctx.lineTo(ex + s, ey + s);
      ctx.moveTo(ex + s, ey - s);
      ctx.lineTo(ex - s, ey + s);
      ctx.stroke();
    });
  }

  drawSkeleton(ctx, r = this.radius) {
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 2;

    // 1. Spine
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, 0);
    ctx.lineTo(r * 0.5, 0);
    ctx.stroke();

    // 2. Ribs
    for (let i = 0; i < 4; i++) {
      const x = -r + i * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.4);
      ctx.lineTo(x, r * 0.4);
      ctx.stroke();
    }

    // 3. Skull
    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f5f5";
    ctx.fill();
    ctx.stroke();

    // 4. Eye Sockets
    ctx.fillStyle = "#1a1a1a";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 0.8, side * r * 0.15, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}