import { Agent } from "../agent.js";

export class Gazelle extends Agent {
  constructor(x, y, dna = null) {
    super(x, y, dna);
    this.type = "gazelle";
    this.role = "prey";
    this.isCarnivore = false;

    this.radius = 10;
    // this.max_speed = 3.6;
    this.legCycle = Math.random() * Math.PI * 2;

    // Cache HSL strings to avoid runtime string allocations
    const baseHue = this.dna?.color ?? 35;
    this.colors = {
      legStroke: `hsl(${baseHue}, 40%, 30%)`,
      bodyFill: `hsl(${baseHue}, 55%, 48%)`,
      neckFill: `hsl(${baseHue}, 55%, 50%)`,
      headFill: `hsl(${baseHue}, 52%, 52%)`,
      snoutFill: `hsl(${baseHue}, 40%, 60%)`,
      earFill: `hsl(${baseHue}, 45%, 40%)`
    };
  }

  _checkFlee(agents) {
    const nearbyLions = agents.filter(
      (a) => a.role === "predator" && !a.isDead
    );

    for (const lion of nearbyLions) {
      const dx = lion.pos.x - this.pos.x;
      const dy = lion.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < this.vision_range ** 2) {
        const escapeVector = {
          x: this.pos.x - dx,
          y: this.pos.y - dy,
        };
        this.targetPosition = escapeVector;
        this._seek(escapeVector);
        return true;
      }
    }
    return false;
  }

  drawBody(ctx) {
    const r = this.radius;

    // Animate legs while moving
    const speed = this.vel ? this.vel.mag() : 0;
    if (speed > 0.1) {
      this.legCycle += speed * 0.3;
    }

    const legOffset = Math.sin(this.legCycle) * r * 0.35;

    // 1. LEGS (Drawn behind body)
    ctx.strokeStyle = this.colors.legStroke;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = "round";

    ctx.beginPath();
    // Back Legs
    ctx.moveTo(-r * 0.5, -r * 0.3);
    ctx.lineTo(-r * 0.75 + legOffset, -r * 0.85);
    ctx.moveTo(-r * 0.5, r * 0.3);
    ctx.lineTo(-r * 0.75 - legOffset, r * 0.85);

    // Front Legs
    ctx.moveTo(r * 0.4, -r * 0.3);
    ctx.lineTo(r * 0.65 - legOffset, -r * 0.8);
    ctx.moveTo(r * 0.4, r * 0.3);
    ctx.lineTo(r * 0.65 + legOffset, r * 0.8);
    ctx.stroke();

    // 2. TAIL
    ctx.beginPath();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = r * 0.14;
    ctx.moveTo(-r * 1.0, 0);
    ctx.quadraticCurveTo(-r * 1.25, Math.sin(this.legCycle * 2) * r * 0.25, -r * 1.35, 0);
    ctx.stroke();

    // 3. MAIN BODY
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, 0, r * 1.05, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.bodyFill;
    ctx.fill();

    // White Underbelly Patch
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, 0, r * 0.75, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f4f4ee";
    ctx.fill();

    // 4. NECK & HEAD
    // Neck bridge
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.35);
    ctx.lineTo(r * 0.95, -r * 0.25);
    ctx.lineTo(r * 0.95, r * 0.25);
    ctx.lineTo(r * 0.2, r * 0.35);
    ctx.closePath();
    ctx.fillStyle = this.colors.neckFill;
    ctx.fill();

    // Head base
    ctx.beginPath();
    ctx.ellipse(r * 0.9, 0, r * 0.42, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.headFill;
    ctx.fill();

    // Snout / Muzzle
    ctx.beginPath();
    ctx.ellipse(r * 1.25, 0, r * 0.28, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.snoutFill;
    ctx.fill();

    // Nose tip
    ctx.beginPath();
    ctx.arc(r * 1.48, 0, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    // 5. EARS
    ctx.fillStyle = this.colors.earFill;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(r * 0.65, side * r * 0.42, r * 0.3, r * 0.11, side * 0.45, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. EYES
    ctx.fillStyle = "#0a0a0a";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 1.0, side * r * 0.22, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. HORNS (Sweeping backwards)
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = "round";

    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(r * 0.75, side * r * 0.15);
      ctx.quadraticCurveTo(
        r * 0.2, side * r * 0.4,
        -r * 0.25, side * r * 0.35
      );
      ctx.stroke();
    });
  }

  drawCorpse(ctx, r = this.radius) {
    const baseHue = this.dna?.color ?? 35;
    const corpseColor = `hsl(${baseHue}, 30%, 25%)`;

    ctx.save();
    ctx.rotate(Math.PI / 12);

    // 1. Limbs (Bent and fallen sideways)
    ctx.strokeStyle = `hsl(${baseHue}, 25%, 20%)`;
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Back legs
    ctx.moveTo(-r * 0.5, r * 0.1);
    ctx.lineTo(-r * 0.9, r * 0.4);
    ctx.lineTo(-r * 0.7, r * 0.7);
    // Front legs
    ctx.moveTo(r * 0.4, r * 0.1);
    ctx.lineTo(r * 0.7, r * 0.5);
    ctx.lineTo(r * 0.9, r * 0.7);
    ctx.stroke();

    // 2. Collapsed Main Body
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, 0, r * 1.0, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = corpseColor;
    ctx.fill();

    // 3. Faded Underbelly
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, r * 0.15, r * 0.75, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#c2c2ba";
    ctx.fill();

    // 4. Neck & Head (Resting on ground)
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.1);
    ctx.lineTo(r * 0.8, r * 0.1);
    ctx.lineTo(r * 0.6, r * 0.3);
    ctx.lineTo(r * 0.1, r * 0.2);
    ctx.closePath();
    ctx.fillStyle = corpseColor;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(r * 0.9, r * 0.15, r * 0.38, r * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Sweeping Horns (Side profile)
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(r * 0.85, 0);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.6, r * 0.1, -r * 0.7);
    ctx.moveTo(r * 0.95, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.65, r * 0.2, -r * 0.75);
    ctx.stroke();

    // 6. "X" Eye
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 1.8;
    const ex = r * 0.95;
    const ey = r * 0.1;
    const s = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(ex - s, ey - s);
    ctx.lineTo(ex + s, ey + s);
    ctx.moveTo(ex + s, ey - s);
    ctx.lineTo(ex - s, ey + s);
    ctx.stroke();

    ctx.restore();
  }

  drawSkeleton(ctx, r = this.radius) {
    ctx.save();
    ctx.rotate(Math.PI / 12);
    ctx.strokeStyle = "#e8e8e0";
    ctx.lineWidth = 1.5;

    // 1. Fallen Limbs (Bones)
    ctx.lineCap = "round";
    ctx.beginPath();
    // Back legs
    ctx.moveTo(-r * 0.5, r * 0.1);
    ctx.lineTo(-r * 0.9, r * 0.4);
    ctx.lineTo(-r * 0.7, r * 0.7);
    // Front legs
    ctx.moveTo(r * 0.4, r * 0.1);
    ctx.lineTo(r * 0.7, r * 0.5);
    ctx.lineTo(r * 0.9, r * 0.7);
    ctx.stroke();

    // 2. Curving Spine
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, 0);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.1, r * 0.8, r * 0.12);
    ctx.stroke();

    // 3. Ribs (Side profile curved downwards)
    for (let i = 0; i < 6; i++) {
      const x = -r * 0.6 + i * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.05);
      ctx.quadraticCurveTo(x + r * 0.05, r * 0.25, x, r * 0.35);
      ctx.stroke();
    }

    // 4. Skull (Side view resting on ground)
    ctx.beginPath();
    ctx.ellipse(r * 0.9, r * 0.15, r * 0.35, r * 0.18, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f5ee";
    ctx.fill();
    ctx.stroke();

    // 5. Eye Socket (Empty dark hole)
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(r * 0.95, r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // 6. Bare Horn Cores (Side profile matching corpse)
    ctx.strokeStyle = "#4a4a40";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(r * 0.85, 0);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.6, r * 0.1, -r * 0.7);
    ctx.moveTo(r * 0.95, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.65, r * 0.2, -r * 0.75);
    ctx.stroke();

    ctx.restore();
  }
}