import { c } from "../../../constants.js";
import { Vector } from "../../../utils/Vector.js";
import * as DNA from "./DNA.js";

export class Agent {
  constructor(x, y, dna = null) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.acc = new Vector(0, 0);

    this.dna = dna || DNA.createDNA();
    if (!this.dna) console.error("DNA failed to initialize!");

    // Vital Stats
    this.energy = 100;
    this.maxEnergy = 200;
    this.hitPoints = 100;
    this.age = 0;
    this.isDead = false;

    // Movement & DNA Expressed Attributes
    this.heading = Math.random() * Math.PI * 2;
    this.maxSpeed = c.SPEED_MAP[this.dna.speed_label] ?? this.dna.speed ?? 2.5;
    this.radius = c.BASE_AGENT_RADIUS * (c.SIZE_MAP[this.dna.size_label] ?? 1.0);
    this.sensingRange = this.dna.sensingRange ?? 200;

    // Movement Constants & Variance
    this.MAX_TURN_RATE = 0.05;
    this.FRICTION = 0.95;

    // Behavior & State
    this.currentState = "WANDERING";
    this.behaviorTimer = 0;
    this.targetPosition = null;

    // Reproduction
    this.reproductionPoints = 0;
    this.reproductionThreshold = 900;
    this.didHaveOffspring = false;
  }

  update(foods, agents) {
    this.acc.x = 0;
    this.acc.y = 0;

    this._separate(agents);
    this._handleMetabolism();
    this._manageBrain(foods, agents);
    this._handleReproduction(agents);
    this._applyPhysics();
    this._smoothRotate();
  }

  die() {
    this.isDead = true;
  }

  identifyRelationship(otherAgent) {
    const diff = Math.abs(this.dna.color - otherAgent.dna.color);
    const colorDistance = diff > 180 ? 360 - diff : diff;
    return colorDistance <= (this.dna.kin_recognition ?? 15) ? "Family" : "Stranger";
  }

  findFood(foods) {
    if (!foods?.length) return;
    if (this.energy / this.maxEnergy > (this.dna.hungerThreshold ?? 0.8)) return;

    const dt = c.SIM_SPEED;
    const viewDistSq = this.sensingRange ** 2;
    let closestFood = null;
    let closestDistSq = Infinity;

    for (const food of foods) {
      if (food.isEaten || food.isSkeleton) continue;

      const dx = food.pos.x - this.pos.x;
      const dy = food.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > viewDistSq) continue;

      // Handle Eating Range
      if (Math.sqrt(distSq) < this.radius + food.radius) {
        const bite = 0.2 * dt;

        if (food.nutritionValue > bite) {
          food.nutritionValue -= bite;
          this.energy += bite;
          this.vel.x *= 0.8;
          this.vel.y *= 0.8;
        } else {
          this.energy += food.nutritionValue;
          food.nutritionValue = 0;
          if (food.type === "plant") food.isEaten = true;
        }

        this.energy = Math.min(this.energy, this.maxEnergy);
        this.acc.x = 0;
        this.acc.y = 0;
        this.targetPosition = food.pos;
        return;
      }

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestFood = food;
      }
    }

    if (closestFood) {
      this.targetPosition = closestFood.pos;
      this._seek(closestFood.pos);
    } else {
      this.targetPosition = null;
    }
  }

  // --- Internal Behavior & Perception ---

  _manageBrain(foods, agents) {
    const dt = c.SIM_SPEED;

    if (this.behaviorTimer > 0) {
      this.behaviorTimer -= dt;
      if (this.currentState === "ATTACKING") this._checkCombat(agents);
      else if (this.currentState === "FLEEING") this._checkFlee(agents);
      else if (this.currentState === "EATING") this.findFood(foods);
      else this._wander();
      return;
    }

    if (this._checkFlee(agents)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = 60;
    } else if (this._checkCombat(agents)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = 40;
    } else if (this.energy / this.maxEnergy < (this.dna.hungerThreshold ?? 0.8)) {
      this.currentState = "EATING";
      this.findFood(foods);
      this.behaviorTimer = 10;
    } else {
      this.currentState = "WANDERING";
      this._wander();
      this.behaviorTimer = 1;
    }
  }

  _getNearbyAgents(agents) {
    const visionRange = this.dna.agentVisionRange ?? 150;
    const visionRangeSq = visionRange ** 2;
    const kinSensitivity = this.dna.kin_recogn ?? 15;

    let enemies = [];
    let familyCount = 0;

    for (const other of agents) {
      if (other === this || other.isDead) continue;

      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < visionRangeSq) {
        const isKin = Math.abs(this.dna.color - other.dna.color) < kinSensitivity;
        if (isKin) {
          familyCount++;
        } else {
          enemies.push({ target: other, distSq });
        }
      }
    }

    enemies.sort((a, b) => a.distSq - b.distSq);
    return { enemies, familyCount };
  }

  _checkFlee(agents) {
    const { enemies, familyCount } = this._getNearbyAgents(agents);
    if (!enemies.length) return false;

    const fearfulness = this.dna.fleefullness ?? 0.5;
    const fearScore = enemies.length * fearfulness - familyCount * 0.1;

    if (fearScore > 0.6) {
      const closestThreat = enemies[0].target;
      const escapeVector = {
        x: this.pos.x - (closestThreat.pos.x - this.pos.x),
        y: this.pos.y - (closestThreat.pos.y - this.pos.y),
      };

      this.targetPosition = escapeVector;
      this._seek(escapeVector);
      return true;
    }

    return false;
  }

  _checkCombat(agents) {
    const { enemies, familyCount } = this._getNearbyAgents(agents);
    if (!enemies.length) return false;

    const aggression = this.dna.aggression ?? 0.5;
    const combatConfidence = aggression + familyCount * 0.1 - enemies.length * 0.05;

    if (combatConfidence > 0.4) {
      const closestThreat = enemies[0].target;
      this.currentState = "ATTACKING";
      this.targetPosition = closestThreat.pos;
      this._seek(closestThreat.pos);
      this._resolveAttack(closestThreat);
      return true;
    }

    return false;
  }

  _resolveAttack(target) {
    const dt = c.SIM_SPEED;
    const speed = this.vel.mag();
    if (speed < 0.1) return;

    const dirX = this.vel.x / speed;
    const dirY = this.vel.y / speed;

    const mouthX = this.pos.x + dirX * this.radius;
    const mouthY = this.pos.y + dirY * this.radius;

    const dx = target.pos.x - mouthX;
    const dy = target.pos.y - mouthY;
    const distFromMouth = Math.sqrt(dx * dx + dy * dy);

    if (distFromMouth < target.radius + 5) {
      const damage = 20.5 * dt;
      target.hitPoints -= damage;
      target.energy -= damage;
      this.energy = Math.max(0, this.energy - damage * 0.2);

      const angle = Math.atan2(dy, dx);
      const impactStrength = 1.5 * dt;

      target.vel.x += Math.cos(angle) * impactStrength;
      target.vel.y += Math.sin(angle) * impactStrength;
      this.vel.x -= Math.cos(angle) * (impactStrength * 0.5);
      this.vel.y -= Math.sin(angle) * (impactStrength * 0.5);
      target.didGetHit = true;
    }
  }

  // --- Steering & Physics ---

  _seek(targetPos) {
    const dt = c.SIM_SPEED;
    const angleToTarget = Math.atan2(targetPos.y - this.pos.y, targetPos.x - this.pos.x);
    const diff = Math.atan2(Math.sin(angleToTarget - this.heading), Math.cos(angleToTarget - this.heading));


    const turnSpeed = 0.1 * dt;
    if (Math.abs(diff) > turnSpeed) {
      this.heading += Math.sign(diff) * turnSpeed;
    } else {
      this.heading = angleToTarget;
    }

    this.acc.x += Math.cos(this.heading) * 0.2 * dt;
    this.acc.y += Math.sin(this.heading) * 0.2 * dt;
  }

  _wander() {
    const dt = c.SIM_SPEED;

    this.heading += (Math.random() - 0.5) * 0.2 * dt;
    const speed = 0.2 * dt;

    this.acc.x += Math.cos(this.heading) * speed;
    this.acc.y += Math.sin(this.heading) * speed;
  }

  _separate(agents) {
    const dt = c.SIM_SPEED;
    const perception = this.radius * 1.5;
    const steer = { x: 0, y: 0 };
    let count = 0;

    for (const other of agents) {
      if (other === this) continue;

      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > 0 && d < perception) {
        steer.x += (dx / d) / d;
        steer.y += (dy / d) / d;
        count++;
      }
    }

    if (count > 0) {
      steer.x /= count;
      steer.y /= count;

      const mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
      if (mag > 0) {
        steer.x = (steer.x / mag) * this.maxSpeed;
        steer.y = (steer.y / mag) * this.maxSpeed;

        this.acc.x += (steer.x - this.vel.x) * 1.5 * dt;
        this.acc.y += (steer.y - this.vel.y) * 1.5 * dt;
      }
    }
  }



  _handleMetabolism() {
    const timeDelta = (1 / 60) * c.SIM_SPEED;

    this.age += timeDelta / 6;

    const baseRate = (this.dna.metabolism ?? 0.5) * timeDelta;
    const movementCost = this.vel.mag() * 0.02 * c.SIM_SPEED;
    this.energy -= baseRate + movementCost;

    if (this.age >= (this.dna.max_age ?? 100) || this.energy <= 0) {
      this.energy = 0;
    }
  }

  _handleReproduction(agents) {
    const dt = c.SIM_SPEED;

    if (this.energy > 100) {
      this.reproductionPoints += dt;
    } else if (this.energy < 50) {
      this.reproductionPoints = Math.max(0, this.reproductionPoints - dt);
    }

    if (this.reproductionPoints >= this.reproductionThreshold) {
      this.reproductionPoints = 0;
      this.energy -= 10;
      agents.push(this._birth());
      this.didHaveOffspring = true;
    }
  }

  _birth() {
    const offspringDNA = DNA.createDNA(this.dna);
    return new Agent(this.pos.x + 20, this.pos.y, offspringDNA);
  }

  _applyPhysics() {
    if (this.acc.magSq() > 0) {
      this.vel.add(this.acc.mult(c.SIM_SPEED));
    }

    this.vel.mult(this.FRICTION);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  _smoothRotate() {
    const dt = c.SIM_SPEED;
    let targetAngle;

    if (this.vel.magSq() > 0.1) {
      targetAngle = Math.atan2(this.vel.y, this.vel.x);
    } else if (this.acc.magSq() > 0) {
      targetAngle = Math.atan2(this.acc.y, this.acc.x);
    } else {
      return;
    }

    const currentTurnRate = (this.MAX_TURN_RATE / (1 + this.vel.mag() * 2)) * dt;
    const diff = Math.atan2(Math.sin(targetAngle - this.heading), Math.cos(targetAngle - this.heading));

    if (Math.abs(diff) > currentTurnRate) {
      this.heading += Math.sign(diff) * currentTurnRate;
    } else {
      this.heading = targetAngle;
    }
  }

  // --- Drawing Logic ---

  draw(ctx, isSelected) {
    if (c.DEBUG_MODE && this.targetPosition) {
      this._drawDebugLine(ctx, this.targetPosition);
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.heading);

    if (this.isDead) ctx.globalAlpha = 0.3;

    this._drawLionBody(ctx);

    if (isSelected || this.currentState !== "WANDERING") {
      this._drawStatusRing(ctx, isSelected);
    }

    ctx.rotate(-this.heading);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(Math.floor(this.hitPoints), 0, -this.radius * 2.5);
    ctx.fillText(`Energy: ${Math.floor(this.energy)}`, 0, -this.radius * 2.5 + 14);
    ctx.restore();
  }

  _drawLionBody(ctx) {
    const r = this.radius;
    const baseHue = this.dna.color ?? 40;

    // Tail
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${baseHue}, 50%, 30%)`;
    ctx.lineWidth = r * 0.2;
    ctx.moveTo(-r * 1.2, 0);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.5, -r * 1.8, 0);
    ctx.stroke();

    // Main Body & Mane
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

    // Ears & Eyes
    ctx.fillStyle = `hsl(${baseHue}, 60%, 40%)`;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 0.6, side * r * 0.5, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "white";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(r * 0.9, side * r * 0.2, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fangs (When attacking)
    if (this.currentState === "ATTACKING") {
      ctx.fillStyle = "#fff";
      [-0.3, 0.3].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(r * 1.0, offset * r);
        ctx.lineTo(r * 1.2, (offset * 0.67) * r);
        ctx.lineTo(r * 1.5, (offset * 0.33) * r);
        ctx.fill();
      });
    }
  }

  _drawStatusRing(ctx, isSelected) {
    const colors = {
      ATTACKING: "red",
      FLEEING: "orange",
      EATING: "green",
    };

    ctx.lineWidth = 3;
    ctx.strokeStyle = isSelected ? "yellow" : colors[this.currentState] ?? "white";

    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawDebugLine(ctx, target) {
    const colors = {
      ATTACKING: "rgba(255, 50, 50, 0.6)",
      EATING: "rgba(50, 255, 50, 0.6)",
      FLEEING: "rgba(255, 165, 0, 0.6)",
    };

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = colors[this.currentState] ?? "rgba(255, 255, 255, 0.2)";
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}