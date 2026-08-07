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

    this.energy = 100;
    this.hitPoints = 100;
    this.maxEnergy = 200;
    this.heading = Math.random() * Math.PI * 2;

    this.MAX_TURN_RATE = 0.05;
    this.FRICTION = 0.95;
    this.WALL_BOUNCE_FORCE = 0.5;
    this.WALL_MARGIN = 30;

    this.behaviorTimer = 0;
    this.currentState = "WANDERING";

    this.reproductionPoints = 0;
    this.reproductionThreshold = 900;

    this.max_speed = c.SPEED_MAP[this.dna.speed_label] || 2.5;
    this.radius = c.BASE_AGENT_RADIUS * (c.SIZE_MAP[this.dna.size_label] || 1.0);
    this.sensingRange = this.dna.sensingRange;
    this.maxSpeed = this.dna.speed;
  }

  _seek(targetPos) {
    const dt = c.SIM_SPEED;
    const dx = targetPos.x - this.pos.x;
    const dy = targetPos.y - this.pos.y;
    const angleToFood = Math.atan2(dy, dx);

    let diff = angleToFood - this.heading;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const turnSpeed = 0.1 * dt;
    if (Math.abs(diff) > turnSpeed) {
      this.heading += diff > 0 ? turnSpeed : -turnSpeed;
    } else {
      this.heading = angleToFood;
    }

    this.acc.x += Math.cos(this.heading) * 0.2 * dt;
    this.acc.y += Math.sin(this.heading) * 0.2 * dt;
  }

  _separate(agents) {
    const dt = c.SIM_SPEED;
    let perception = this.radius * 1.5;
    let steer = { x: 0, y: 0 };
    let count = 0;

    for (let other of agents) {
      if (other === this) continue;

      let dx = this.pos.x - other.pos.x;
      let dy = this.pos.y - other.pos.y;
      let d = Math.sqrt(dx * dx + dy * dy);

      if (d < perception && d > 0) {
        let diffX = dx / d;
        let diffY = dy / d;
        steer.x += diffX / d;
        steer.y += diffY / d;
        count++;
      }
    }

    if (count > 0) {
      steer.x /= count;
      steer.y /= count;

      let mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
      if (mag > 0) {
        steer.x = (steer.x / mag) * this.max_speed;
        steer.y = (steer.y / mag) * this.max_speed;

        let steerForceX = steer.x - this.vel.x;
        let steerForceY = steer.y - this.vel.y;

        this.acc.x += steerForceX * 1.5 * dt;
        this.acc.y += steerForceY * 1.5 * dt;
      }
    }
  }

  findFood(foods) {
    if (!foods || foods.length === 0) return;
    if (this.energy / this.maxEnergy > (this.dna.hungerThreshold ?? 0.8)) return;

    const dt = c.SIM_SPEED;
    let closest = null;
    let record = Infinity;
    const range = this.sensingRange ?? 200;
    const viewDistSq = range * range;

    for (let food of foods) {
      if (food.isEaten || food.isSkeleton) continue;
      let dx = food.pos.x - this.pos.x;
      let dy = food.pos.y - this.pos.y;
      let dSq = dx * dx + dy * dy;

      if (dSq > viewDistSq) continue;

      let d = Math.sqrt(dSq);
      if (d < this.radius + food.radius) {
        const bite = 0.2 * dt;
        if (food.nutritionValue > bite) {
          food.nutritionValue -= bite;
          this.energy += bite;
          this.vel.x *= 0.8;
          this.vel.y *= 0.8;
        } else {
          this.energy += food.nutritionValue;
          food.nutritionValue = 0;
          if (food.type === "plant") {
            food.isEaten = true;
          }
        }

        if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;

        this.acc.x = 0;
        this.acc.y = 0;
        this.targetPosition = food.pos;
        return;
      }

      if (dSq < record) {
        record = dSq;
        closest = food;
      }
    }

    if (closest) {
      this.targetPosition = closest.pos;
      this._seek(closest.pos);
    } else {
      this.targetPosition = null;
    }
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
    } else if (this.energy / this.maxEnergy < this.dna.hungerThreshold) {
      this.currentState = "EATING";
      this.findFood(foods);
      this.behaviorTimer = 10;
    } else {
      this.currentState = "WANDERING";
      this._wander();
      this.behaviorTimer = 1;
    }
  }

  _handleMetabolism() {
    const SECONDS_PER_UNIT = 6;
    const framesPerSecond = 60;

    const timeDelta = (1 / framesPerSecond) * c.SIM_SPEED;

    const agingRate = timeDelta / SECONDS_PER_UNIT;
    this.age = (this.age || 0) + agingRate;

    const baseRate = (this.dna.metabolism || 0.5) * timeDelta;
    const movementCost = this.vel.mag() * 0.02 * c.SIM_SPEED;
    this.energy -= baseRate + movementCost;

    if (this.age >= (this.dna.max_age || 100)) {
      this.energy = 0;
    }

    if (this.energy <= 0) {
      this.energy = 0;
    }
  }

  die() {
    this.isDead = true;
  }

  identifyRelationship(otherAgent) {
    let diff = Math.abs(this.dna.color - otherAgent.dna.color);
    let colorDistance = diff > 180 ? 360 - diff : diff;

    if (colorDistance <= this.dna.kin_recognition) {
      return "Family";
    } else {
      return "Stranger";
    }
  }

  _handleReproduction(agents) {
    const dt = c.SIM_SPEED;

    if (this.energy > 100) {
      this.reproductionPoints += 1 * dt;
    } else if (this.energy < 50) {
      this.reproductionPoints = Math.max(0, this.reproductionPoints - 1 * dt);
    }

    if (this.reproductionPoints >= this.reproductionThreshold) {
      this.reproductionPoints = 0;
      this.energy -= 10;

      const child = this._birth();
      agents.push(child);
      this.didHaveOffspring = true;
      console.log(`[${this.id}] New agent born!`);
    }
  }

  _birth() {
    const offspringDNA = DNA.createDNA(this.dna);
    return new Agent(this.pos.x + 20, this.pos.y, offspringDNA);
  }

  _updateBehavior(agents) {
    const dt = c.SIM_SPEED;

    if (this.behaviorTimer > 0) {
      this.behaviorTimer -= dt;

      if (this.currentState === "ATTACKING") this._checkCombat(agents);
      if (this.currentState === "FLEEING") this._checkFlee(agents);
      return;
    }

    if (this._checkFlee(agents)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = Math.floor(Math.random() * 60) + 30;
    } else if (this._checkCombat(agents)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = Math.floor(Math.random() * 40) + 20;
    } else {
      this.currentState = "WANDERING";
      this.behaviorTimer = 10;
      this._wander();
    }
  }

  _checkFlee(agents) {
    const agentDetectionVisionRadius = this.dna.agentVisionRange ?? 150;
    const fleefullnessTrait = this.dna.fleefullness ?? 0.5;
    const kinRecognitionSensitivity = this.dna.kin_recogn ?? 15;

    let nearbyDetectedEnemies = [];
    let localFamilyMemberCount = 0;

    for (let otherAgent of agents) {
      if (otherAgent === this || otherAgent.isDead) continue;

      const deltaX = otherAgent.pos.x - this.pos.x;
      const deltaY = otherAgent.pos.y - this.pos.y;
      const distanceToAgentSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceToAgentSquared < agentDetectionVisionRadius * agentDetectionVisionRadius) {
        const geneticColorDifference = Math.abs(this.dna.color - otherAgent.dna.color);

        if (geneticColorDifference < kinRecognitionSensitivity) {
          localFamilyMemberCount++;
        } else {
          nearbyDetectedEnemies.push({
            target: otherAgent,
            distSq: distanceToAgentSquared,
          });
        }
      }
    }

    if (nearbyDetectedEnemies.length > 0) {
      nearbyDetectedEnemies.sort((a, b) => a.distSq - b.distSq);
      const closestThreat = nearbyDetectedEnemies[0].target;
      const enemyDensity = nearbyDetectedEnemies.length;

      const fearScore = enemyDensity * fleefullnessTrait - localFamilyMemberCount * 0.1;

      if (fearScore > 0.6) {
        const escapeVector = {
          x: this.pos.x - (closestThreat.pos.x - this.pos.x),
          y: this.pos.y - (closestThreat.pos.y - this.pos.y),
        };

        this.targetPosition = escapeVector;
        this._seek(escapeVector);
        return true;
      }
    }

    return false;
  }

  _checkCombat(agents) {
    const agentDetectionVisionRadius = this.dna.agentVisionRange || 150;
    const baseAggressionTrait = this.dna.aggression || 0.5;
    const kinRecognitionSensitivity = this.dna.kin_recogn || 15;

    let nearbyDetectedEnemies = [];
    let localFamilyMemberCount = 0;

    for (let otherAgent of agents) {
      if (otherAgent === this || otherAgent.isDead) continue;

      const deltaX = otherAgent.pos.x - this.pos.x;
      const deltaY = otherAgent.pos.y - this.pos.y;
      const distanceToAgentSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceToAgentSquared < agentDetectionVisionRadius * agentDetectionVisionRadius) {
        const geneticColorDifference = Math.abs(this.dna.color - otherAgent.dna.color);

        if (geneticColorDifference < kinRecognitionSensitivity) {
          localFamilyMemberCount++;
        } else {
          nearbyDetectedEnemies.push({
            target: otherAgent,
            distSq: distanceToAgentSquared,
          });
        }
      }
    }

    if (nearbyDetectedEnemies.length > 0) {
      nearbyDetectedEnemies.sort((a, b) => a.distSq - b.distSq);
      const closestThreat = nearbyDetectedEnemies[0].target;
      const enemyDensity = nearbyDetectedEnemies.length;

      const combatConfidenceScore =
        baseAggressionTrait + localFamilyMemberCount * 0.1 - enemyDensity * 0.05;

      if (combatConfidenceScore > 0.4) {
        this.currentState = "ATTACKING";
        this.targetPosition = closestThreat.pos;
        this._seek(closestThreat.pos);
        this._resolveAttack(closestThreat);
        return true;
      }
    }

    return false;
  }

  _resolveAttack(target) {
    const dt = c.SIM_SPEED;
    const speed = Math.sqrt(this.vel.x ** 2 + this.vel.y ** 2);
    if (speed < 0.1) return;

    const fx = this.vel.x / speed;
    const fy = this.vel.y / speed;

    const mouthX = this.pos.x + fx * this.radius;
    const mouthY = this.pos.y + fy * this.radius;

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

  _wander() {
    const dt = c.SIM_SPEED;
    this.heading += (Math.random() - 0.5) * 0.2 * dt;

    const speed = 0.2 * dt;
    const forceX = Math.cos(this.heading) * speed;
    const forceY = Math.sin(this.heading) * speed;

    this.acc.x += forceX;
    this.acc.y += forceY;
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

    let speed = this.vel.mag();
    let currentTurnRate = (this.MAX_TURN_RATE / (1 + speed * 2)) * dt;

    let diff = targetAngle - this.heading;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) > currentTurnRate) {
      this.heading += diff > 0 ? currentTurnRate : -currentTurnRate;
    } else {
      this.heading = targetAngle;
    }
  }

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
    const baseHue = this.dna.color || 40;

    ctx.beginPath();
    ctx.strokeStyle = `hsl(${baseHue}, 50%, 30%)`;
    ctx.lineWidth = r * 0.2;
    ctx.moveTo(-r * 1.2, 0);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.5, -r * 1.8, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-r * 0.3, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 60%, 50%)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 70%, 30%)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 60%, 60%)`;
    ctx.fill();

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

    if (this.currentState === "ATTACKING") {
      ctx.fillStyle = "#fff";

      ctx.beginPath();
      ctx.moveTo(r * 1.0, -r * 0.3);
      ctx.lineTo(r * 1.2, -r * 0.2);
      ctx.lineTo(r * 1.5, -r * 0.1);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(r * 1.0, r * 0.3);
      ctx.lineTo(r * 1.2, r * 0.2);
      ctx.lineTo(r * 1.5, r * 0.1);
      ctx.fill();
    }
  }

  _drawStatusRing(ctx, isSelected) {
    ctx.lineWidth = 3;
    if (isSelected) ctx.strokeStyle = "yellow";
    else if (this.currentState === "ATTACKING") ctx.strokeStyle = "red";
    else if (this.currentState === "FLEEING") ctx.strokeStyle = "orange";
    else if (this.currentState === "EATING") ctx.strokeStyle = "green";

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

    let color = "rgba(255, 255, 255, 0.2)";
    if (this.currentState === "ATTACKING") color = "rgba(255, 50, 50, 0.6)";
    if (this.currentState === "EATING") color = "rgba(50, 255, 50, 0.6)";
    if (this.currentState === "FLEEING") color = "rgba(255, 165, 0, 0.6)";

    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}