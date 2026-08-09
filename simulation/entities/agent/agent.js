import { c } from "../../../constants.js";
import { Vector } from "../../../utils/Vector.js";
import * as DNA from "./DNA.js";

// Module Constants
const MAX_TURN_RATE = 0.05;
const FRICTION = 0.95;

const STATE_COLORS = {
  ATTACKING: "red",
  FLEEING: "orange",
  EATING: "green",
  WANDERING: "blue",
};

const DEBUG_COLORS = {
  ATTACKING: "rgba(255, 50, 50, 0.6)",
  EATING: "rgba(50, 255, 50, 0.6)",
  FLEEING: "rgba(255, 165, 0, 0.6)",
  WANDERING: "rgba(50, 50, 0, 0.6)",
};

// Helper: Normalizes an angle in radians to [-PI, PI]
function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

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

    // Movement & Expressed Attributes
    this.heading = Math.random() * Math.PI * 2;
    this.maxSpeed = this.dna.maxSpeed ?? this.dna.max_speed;
    this.radius =
      c.BASE_AGENT_RADIUS * (c.SIZE_MAP[this.dna.size_label] ?? 1.0);
    this.visionRange = this.dna.visionRange ?? this.dna.vision_range ?? 200;

    // Behavior & State
    this.currentState = "WANDERING";
    this.behaviorTimer = 0;
    this.targetPosition = null;

    // Decision Throttling (Evaluates ~1 time per second at 60 FPS)
    this.decisionInterval = 60;
    this.decisionTimer = Math.floor(Math.random() * this.decisionInterval);

    // Reproduction
    this.reproductionPoints = 0;
    this.reproductionThreshold = 900;
    this.didHaveOffspring = false;
  }

  update(foods, agents) {
    if (this.isCorpse) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.acc.x = 0;
      this.acc.y = 0;

      if (this.flesh <= 0) {
        this.skeletonTimer = (this.skeletonTimer || 100) - 1;
        if (this.skeletonTimer <= 0) {
          this.isDead = true;
        }
      }
      return;
    }

    if (!this.isDead) {
      this.acc.x = 0;
      this.acc.y = 0;

      this._separate(agents);
      this._handleMetabolism();
      this._manageBrain(foods, agents);
      this._handleReproduction(agents);
      this._applyPhysics();
      this._smoothRotate();
    }
  }

  die() {
    this.isDead = true;
  }

  identifyRelationship(otherAgent) {
    const diff = Math.abs(this.dna.color - otherAgent.dna.color);
    const colorDistance = diff > 180 ? 360 - diff : diff;
    return colorDistance <=
      (this.dna.kinRecognition ?? this.dna.kin_recognition ?? 15)
      ? "Family"
      : "Stranger";
  }

  findFood(foods, agents) {
    if (this.energy / this.maxEnergy > (this.dna.hungerThreshold ?? 0.8))
      return;

    const targets = this._getFoodTargets(foods, agents);
    if (!targets.length) return;

    const viewDistSq = this.visionRange ** 2;
    let closestTarget = null;
    let closestDistSq = Infinity;

    for (const target of targets) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > viewDistSq) continue;

      const combinedRadiusSq = (this.radius + target.radius) ** 2;
      if (distSq < combinedRadiusSq) {
        this._eatTarget(target);
        return;
      }

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestTarget = target;
      }
    }

    if (closestTarget) {
      this.targetPosition = closestTarget.pos;
      this._seek(closestTarget.pos);
    } else {
      this.targetPosition = null;
    }
  }

  _getFoodTargets(foods, agents) {
    const targets = [];

    if (this.isCarnivore) {
      if (agents?.length) {
        for (const agent of agents) {
          if (agent !== this && !agent.isSkeleton && (agent.flesh ?? 0) > 0) {
            targets.push({
              pos: agent.pos,
              radius: agent.radius,
              raw: agent,
              isCorpse: true,
            });
          }
        }
      }
    } else {
      if (foods?.length) {
        for (const food of foods) {
          if (!food.isEaten && food.type !== "meat") {
            targets.push({
              pos: food.pos,
              radius: food.radius,
              raw: food,
              isCorpse: false,
            });
          }
        }
      }
    }

    return targets;
  }

  _eatTarget(target) {
    const dt = c.SIM_SPEED;
    const bite = 1 * dt;

    if (target.isCorpse) {
      const corpse = target.raw;
      if (!corpse.isCorpse) {
        const damage = 20.5 * dt;
        corpse.hitPoints = (corpse.hitPoints ?? 0) - damage;
        corpse.didGetHit = true;
      } else {
        const currentFlesh = corpse.flesh ?? 0;
        const actualBite = Math.min(bite, currentFlesh);
        corpse.flesh = currentFlesh - actualBite;
        this.energy += actualBite;
      }
    } else {
      const food = target.raw;
      const nutrition = food.nutritionValue ?? 0;

      if (nutrition > bite) {
        food.nutritionValue = nutrition - bite;
        this.energy += bite;
      } else {
        this.energy += nutrition;
        food.nutritionValue = 0;
        food.isEaten = true;
      }
    }

    this.vel.x *= 0.8;
    this.vel.y *= 0.8;
    this.acc.x = 0;
    this.acc.y = 0;
    this.targetPosition = target.pos;
  }

  // --- Internal Behavior & Perception ---

  _manageBrain(foods, agents) {
    const dt = c.SIM_SPEED;

    // Execute ongoing movement/steering for current state every tick
    this._executeState(foods, agents);

    // Decrement behavior lock timer if set
    if (this.behaviorTimer > 0) {
      this.behaviorTimer -= dt;
      return;
    }

    // Only re-evaluate perception/brain once per second (~60 frames)
    this.decisionTimer++;
    if (this.decisionTimer >= this.decisionInterval) {
      this.decisionTimer = 0;
      this._evaluateState(foods, agents);
    }
  }

  _executeState(foods, agents) {
    switch (this.currentState) {
      case "ATTACKING":
        this._checkCombat(agents);
        break;
      case "FLEEING":
        this._checkFlee(agents);
        break;
      case "EATING":
        this.findFood(foods, agents);
        break;
      default:
        this._wander();
        break;
    }
  }

  _evaluateState(foods, agents) {
    const hungerThreshold = this.dna.hungerThreshold ?? 0.8;

    if (this._checkFlee(agents)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = 60;
    } else if (this.energy / this.maxEnergy < hungerThreshold) {
      this.currentState = "EATING";
      this.findFood(foods, agents);
      this.behaviorTimer = 60;
    } else if (this._checkCombat(agents)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = 40;
    } else {
      this.currentState = "WANDERING";
      this._wander();
      this.behaviorTimer = 20;
    }
  }

  _getNearbyAgents(agents) {
    const visionRange = this.dna.agentVisionRange ?? 150;
    const visionRangeSq = visionRange ** 2;
    const kinSensitivity = this.dna.kinRecognition ?? this.dna.kin_recogn ?? 15;

    const enemies = [];
    let familyCount = 0;

    for (const other of agents) {
      if (other === this || other.isDead) continue;

      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < visionRangeSq) {
        const isKin =
          Math.abs(this.dna.color - other.dna.color) < kinSensitivity;
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
    const combatConfidence =
      aggression + familyCount * 0.1 - enemies.length * 0.05;

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
    const distSqFromMouth = dx * dx + dy * dy;
    const reachSq = (target.radius + 5) ** 2;

    if (distSqFromMouth < reachSq) {
      const damage = 20.5 * dt;
      target.hitPoints -= damage;

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
    const angleToTarget = Math.atan2(
      targetPos.y - this.pos.y,
      targetPos.x - this.pos.x
    );
    const diff = normalizeAngle(angleToTarget - this.heading);

    const turnSpeed = 0.1 * dt;
    if (Math.abs(diff) > turnSpeed) {
      this.heading += Math.sign(diff) * turnSpeed;
    } else {
      this.heading = angleToTarget;
    }

    this.acc.x += Math.cos(this.heading) * 0.2 * dt * this.maxSpeed;
    this.acc.y += Math.sin(this.heading) * 0.2 * dt * this.maxSpeed;
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
        steer.x /= mag;
        steer.y /= mag;

        this.acc.x += (steer.x - this.vel.x) * 1.5 * dt;
        this.acc.y += (steer.y - this.vel.y) * 1.5 * dt;
      }
    }
  }

  _handleMetabolism() {
    const timeDelta = (1 / 60) * c.SIM_SPEED;

    this.age += timeDelta / 6;

    const baseRate = (this.dna.metabolism ?? 1) * c.SIM_SPEED * 0.001;
    const movementCost = this.vel.mag() * 0.002 * c.SIM_SPEED;
    this.energy -= baseRate + movementCost;
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
    return new this.constructor(this.pos.x + 20, this.pos.y, offspringDNA);
  }

  _applyPhysics() {
    if (this.acc.magSq() > 0) {
      this.vel.add(this.acc.mult(c.SIM_SPEED));
    }

    this.vel.mult(FRICTION);
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

    const currentTurnRate = (MAX_TURN_RATE / (1 + this.vel.mag() * 2)) * dt;
    const diff = normalizeAngle(targetAngle - this.heading);

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

    if (this.isCorpse) {
      if (this.flesh > 0) {
        this.drawCorpse(ctx);
      } else {
        this.drawSkeleton(ctx);
      }
    } else {
      if (this.isDead) ctx.globalAlpha = 0.3;
      this.drawBody(ctx);
    }

    if (isSelected || (this.currentState !== "WANDERING" && !this.isCorpse)) {
      this._drawStatusRing(ctx, isSelected);
    }

    ctx.rotate(-this.heading);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";

    if (this.isCorpse) {
      ctx.fillText(`Meat: ${Math.floor(this.flesh)}`, 0, -this.radius * 2.5);
    } else {
      ctx.fillText(Math.floor(this.hitPoints), 0, -this.radius * 2.5);
      ctx.fillText(
        `Energy: ${Math.floor(this.energy)}`,
        0,
        -this.radius * 2.5 + 14
      );
      ctx.fillText(this.currentState, 0, this.radius * 2.5 + 12);
    }

    ctx.restore();
  }

  drawBody(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.dna.color ?? 0}, 50%, 50%)`;
    ctx.fill();
  }

  _drawStatusRing(ctx, isSelected) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = isSelected
      ? "yellow"
      : STATE_COLORS[this.currentState] ?? "white";

    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawDebugLine(ctx, target) {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle =
      DEBUG_COLORS[this.currentState] ?? "rgba(255, 255, 255, 0.2)";
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
