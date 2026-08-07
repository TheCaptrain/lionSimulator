import { c } from "../../../constants.js";
import { Vector } from "../../../utils/Vector.js";
import * as DNA from "./DNA.js";

export class Agent {
  constructor(x, y, dna = null) {
    this.pos = { x, y };
    this.dna = dna;
    this.energy = 100; // Starting energy
    this.hitPoints = 100; // Starting energy
    this.maxEnergy = 200;
    this.radius = 10;
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.acc = new Vector(0, 0);
    this.heading = Math.random() * Math.PI * 2;

    this.MAX_TURN_RATE = 0.05;
    this.FRICTION = 0.95;
    this.WALL_BOUNCE_FORCE = 0.5;
    this.WALL_MARGIN = 30;

    this.behaviorTimer = 0;
    this.currentState = "WANDERING";

    this.reproductionPoints = 0;
    this.reproductionThreshold = 900;

    this.dna = dna || DNA.createDNA();
    if (!this.dna) console.error("DNA failed to initialize!");
    this.max_speed = c.SPEED_MAP[this.dna.speed_label] || 2.5;
    this.radius =
      c.BASE_AGENT_RADIUS * (c.SIZE_MAP[this.dna.size_label] || 1.0);

    this.sensingRange = this.dna.sensingRange;
    this.maxSpeed = this.dna.speed;
  }

  _seek(targetPos) {
    // 1. Find the angle to the food
    

    const dx = targetPos.x - this.pos.x;
    const dy = targetPos.y - this.pos.y;
    const angleToFood = Math.atan2(dy, dx);

    // 2. Find the shortest way to turn toward that angle
    let diff = angleToFood - this.heading;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    // 3. Apply a Turning Force
    // We nudge the heading toward the food
    const turnSpeed = 0.1;
    if (Math.abs(diff) > turnSpeed) {
      this.heading += diff > 0 ? turnSpeed : -turnSpeed;
    } else {
      this.heading = angleToFood;
    }

    // 4. Apply a Moving Force (The "Gas Pedal")
    // Push the agent forward in the direction it's now facing
    this.acc.x += Math.cos(this.heading) * 0.2;
    this.acc.y += Math.sin(this.heading) * 0.2;
  }

  _separate(agents) {
    let perception = this.radius * 1.5; // Distance to start pushing away
    let steer = { x: 0, y: 0 };
    let count = 0;

    for (let other of agents) {
      if (other === this) continue;

      let dx = this.pos.x - other.pos.x;
      let dy = this.pos.y - other.pos.y;
      let d = Math.sqrt(dx * dx + dy * dy);

      if (d < perception && d > 0) {
        // Calculate vector pointing away, weighted by distance
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

      // Normalize and scale to max speed/force
      let mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
      if (mag > 0) {
        steer.x = (steer.x / mag) * this.max_speed;
        steer.y = (steer.y / mag) * this.max_speed;

        let steerForceX = steer.x - this.vel.x;
        let steerForceY = steer.y - this.vel.y;

        // Apply the force (limit to max force)
        this.acc.x += steerForceX * 1.5; // Strength of separation
        this.acc.y += steerForceY * 1.5;
      }
    }
  }

  findFood(foods) {
    if (!foods || foods.length === 0) return;
    if (this.energy / this.maxEnergy > (this.dna.hungerThreshold ?? 0.8)) return;

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

        // --- THE EATING LOGIC (Moved from update) ---
        let d = Math.sqrt(dSq);
        if (d < this.radius + food.radius) {
            const bite = 0.2;
            if (food.nutritionValue > bite) {
                food.nutritionValue -= bite;
                this.energy += bite;
                this.vel.x *= 0.8; // Slow down
                this.vel.y *= 0.8;
            } else {
                this.energy += food.nutritionValue;
                food.nutritionValue = 0;
                if (food.type === "plant") {
                  food.isEaten = true;
              }            }

            if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
            
            this.acc.x = 0;
            this.acc.y = 0;
            this.targetPosition = food.pos;
            return; // Stop searching once we've found food to eat
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

    // 1. Physical/Social constraints (Always apply)
    this._separate(agents);
    this._handleMetabolism();

    // 2. The Decision Tree (The Brain)
    // We only reconsider state if the timer is 0
    this._manageBrain(foods, agents);

    // 3. Reproduction & Physics
    this._handleReproduction(agents);
    this._applyPhysics();
    this._smoothRotate();
  }

  _manageBrain(foods, agents) {
    // A. Sticky Timer: If active, just keep doing what we were doing
    if (this.behaviorTimer > 0) {
      this.behaviorTimer--;
      if (this.currentState === "ATTACKING") this._checkCombat(agents);
      else if (this.currentState === "FLEEING") this._checkFlee(agents);
      else if (this.currentState === "EATING") this.findFood(foods);
      else this._wander();
      return;
    }

    // B. Re-evaluate Priorities (The Ladder)
    // Priority 1: Fear
    if (this._checkFlee(agents)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = 60;
    }
    // Priority 2: Aggression
    else if (this._checkCombat(agents)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = 40;
    }
    // Priority 3: Hunger
    else if (this.energy / this.maxEnergy < this.dna.hungerThreshold) {
      this.currentState = "EATING";
      this.findFood(foods);
      this.behaviorTimer = 10;
    }
    // Priority 4: Chill
    else {
      this.currentState = "WANDERING";
      this._wander();
      this.behaviorTimer = 1;
    }
  }

  _handleMetabolism() {
    // Configuration
    const SECONDS_PER_UNIT = 6; // 1 unit of Age = 60 seconds
    const framesPerSecond = 60;

    // The "Time Delta" (How much time passed in this specific tick)
    // We multiply by our global simulation speed from your slider
    const timeDelta = (1 / framesPerSecond) * c.SIM_SPEED;

    // 1. Aging Logic
    // Convert seconds passed into "Age Units"
    const agingRate = timeDelta / SECONDS_PER_UNIT;
    this.age = (this.age || 0) + agingRate;

    // 2. Energy Drain
    // metabolism is now "energy lost per second"
    const baseRate = (this.dna.metabolism || 1) * timeDelta;
    const movementCost = this.vel.mag() * 0.02;
    this.energy -= baseRate + movementCost;

    // 3. Death Checks
    if (this.age >= (this.dna.max_age || 100)) {
      this.energy = 0;
      //this.die();
    }

    if (this.energy <= 0) {
      this.energy = 0;
      //this.die();
    }
  }



  die() {
    this.isDead = true;
    // You could also trigger a "death animation" or drop food here
  }
  // Inside your Agent class
  identifyRelationship(otherAgent) {
    // 1. Calculate the distance between colors (0 to 180 degrees)
    let diff = Math.abs(this.dna.color - otherAgent.dna.color);
    let colorDistance = diff > 180 ? 360 - diff : diff;

    // 2. Check if they are "Close" based on this agent's own DNA threshold
    if (colorDistance <= this.dna.kin_recognition) {
      return "Family";
    } else {
      return "Stranger";
    }
  }

  _handleReproduction(agents) {
    const dt = c.SIM_SPEED; // Global time multiplier

    // 1. Point Management (Scaled by speed)
    if (this.energy > 100) {
      // Accumulate points faster if sim speed is high
      this.reproductionPoints += 1 * dt;
    } else if (this.energy < 50) {
      // Lose points faster if sim speed is high
      this.reproductionPoints = Math.max(0, this.reproductionPoints - 1 * dt);
    }

    // 2. Birth Logic
    // Threshold remains the same because points are now time-scaled
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
    // Use your helper to handle all mutation logic automatically
    const offspringDNA = DNA.createDNA(this.dna);

    // Return the new child with the mutated DNA
    return new Agent(
      this.pos.x + 10,
      this.pos.y,
      offspringDNA
    );
  }

  _updateBehavior(agents) {
    // 1. Countdown the "stickiness" timer
    if (this.behaviorTimer > 0) {
      this.behaviorTimer--;

      // Continue doing the current action
      if (this.currentState === "ATTACKING") this._checkCombat(agents);
      if (this.currentState === "FLEEING") this._checkFlee(agents);
      return;
    }

    // 2. Timer is zero: Time to reconsider what to do
    // Priority 1: Should I run?
    if (this._checkFlee(agents)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = Math.floor(Math.random() * 60) + 30; // 30-90 ticks
    }
    // Priority 2: Should I fight?
    else if (this._checkCombat(agents)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = Math.floor(Math.random() * 40) + 20; // 20-60 ticks
    }
    // Priority 3: Just wander/eat
    else {
      this.currentState = "WANDERING";
      this.behaviorTimer = 10; // Check for threats again soon
      this._wander();
    }
  }

  _checkFlee(agents) {
    // 1. DNA-Derived Constraints
    const agentDetectionVisionRadius = this.dna.agentVisionRange ?? 150;
    const fleefullnessTrait = this.dna.fleefullness ?? 0.5;
    const kinRecognitionSensitivity = this.dna.kin_recogn ?? 15;

    let nearbyDetectedEnemies = [];
    let localFamilyMemberCount = 0;

    // 2. Scan surroundings
    for (let otherAgent of agents) {
      if (otherAgent === this || otherAgent.isDead) continue;

      const deltaX = otherAgent.pos.x - this.pos.x;
      const deltaY = otherAgent.pos.y - this.pos.y;
      const distanceToAgentSquared = deltaX * deltaX + deltaY * deltaY;

      if (
        distanceToAgentSquared <
        agentDetectionVisionRadius * agentDetectionVisionRadius
      ) {
        const geneticColorDifference = Math.abs(
          this.dna.color - otherAgent.dna.color
        );

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

    // 3. Fear Logic
    if (nearbyDetectedEnemies.length > 0) {
      nearbyDetectedEnemies.sort((a, b) => a.distSq - b.distSq);
      const closestThreat = nearbyDetectedEnemies[0].target;
      const enemyDensity = nearbyDetectedEnemies.length;

      /* CALCULATE FEAR SCORE:
           High Fleefullness + Many Enemies = High Fear
           More Family members = Lower Fear
        */
      const fearScore =
        enemyDensity * fleefullnessTrait - localFamilyMemberCount * 0.1;

      // 4. Execution of Fleeing
      if (fearScore > 0.6) {
        // "Flee" is just Seeking the opposite direction
        const escapeVector = {
          x: this.pos.x - (closestThreat.pos.x - this.pos.x),
          y: this.pos.y - (closestThreat.pos.y - this.pos.y),
        };

        // this.isAttacking = false; // Stop attacking to focus on running
        // this.isFleeing = true; // Stop attacking to focus on running
        this.targetPosition = escapeVector;

        this._seek(escapeVector);
        return true;
      }
    }

    return false;
  }
  _checkCombat(agents) {
    // this.isAttacking = false;

    // 1. DNA-Derived Constraints
    const agentDetectionVisionRadius = this.dna.agentVisionRange || 150;
    const baseAggressionTrait = this.dna.aggression || 0.5;
    const kinRecognitionSensitivity = this.dna.kin_recogn || 15; // Using your DNA trait

    // 2. Environmental Awareness
    let nearbyDetectedEnemies = [];
    let localFamilyMemberCount = 0;

    for (let otherAgent of agents) {
      if (otherAgent === this || otherAgent.isDead) continue;

      const deltaX = otherAgent.pos.x - this.pos.x;
      const deltaY = otherAgent.pos.y - this.pos.y;
      const distanceToAgentSquared = deltaX * deltaX + deltaY * deltaY;

      // Check if agent is within the specific DNA detection radius
      if (
        distanceToAgentSquared <
        agentDetectionVisionRadius * agentDetectionVisionRadius
      ) {
        const geneticColorDifference = Math.abs(
          this.dna.color - otherAgent.dna.color
        );

        // Using kinRecognitionSensitivity to define 'Family'
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

    // 3. Strategic Decision Making
    if (nearbyDetectedEnemies.length > 0) {
      nearbyDetectedEnemies.sort((a, b) => a.distSq - b.distSq);
      const closestThreat = nearbyDetectedEnemies[0].target;

      const enemyDensity = nearbyDetectedEnemies.length;

      // Calculate confidence based on the crowd
      const combatConfidenceScore =
        baseAggressionTrait +
        localFamilyMemberCount * 0.1 -
        enemyDensity * 0.05;

      // 4. Execution
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
    // 1. Calculate the Attacker's Heading
    const speed = Math.sqrt(this.vel.x ** 2 + this.vel.y ** 2);
    if (speed < 0.1) return; // Cannot attack if not moving/facing a direction

    const fx = this.vel.x / speed; // Forward X unit
    const fy = this.vel.y / speed; // Forward Y unit

    // 2. Project the "Mouth" to the front edge of the circle
    const mouthX = this.pos.x + fx * this.radius;
    const mouthY = this.pos.y + fy * this.radius;

    // 3. Measure distance from THIS Mouth to the TARGET'S center
    const dx = target.pos.x - mouthX;
    const dy = target.pos.y - mouthY;
    const distFromMouth = Math.sqrt(dx * dx + dy * dy);

    // 4. Collision Check: Mouth must be inside or touching the target's radius
    // We add a small 'reach' buffer (e.g., 5px)
    if (distFromMouth < target.radius + 5) {
      const damage = 20.5;
      target.hitPoints -= damage;
      target.energy -= damage;
      this.energy = Math.max(0, this.energy - damage * 0.2);
      // Knockback physics using the collision angle
      const angle = Math.atan2(dy, dx);
      const impactStrength = 1.5;

      target.vel.x += Math.cos(angle) * impactStrength;
      target.vel.y += Math.sin(angle) * impactStrength;
      this.vel.x -= Math.cos(angle) * (impactStrength * 0.5);
      this.vel.y -= Math.sin(angle) * (impactStrength * 0.5);
      target.didGetHit = true;
      // if (target.energy <= 0) {
      //   //target.isDead = true;
      // }
    }
  }
  _wander() {
    // 1. Randomly nudge the heading to create a wavy path
    this.heading += (Math.random() - 0.5) * 0.2;

    // 2. Calculate the push force based on the new heading
    // This replaces the "x += 0.2" with a direction-aware version
    const speed = 0.2;
    const forceX = Math.cos(this.heading) * speed;
    const forceY = Math.sin(this.heading) * speed;

    // 3. Apply it to acceleration
    this.acc.x += forceX;
    this.acc.y += forceY;
  }

  _applyPhysics() {
    // If we have acceleration (seeking food), add it to velocity
    if (this.acc.magSq() > 0) {
      this.vel.add(this.acc.mult(c.SIM_SPEED));
    }

    this.vel.mult(this.FRICTION);

    // Update position
    this.pos.add(this.vel);

    // Reset acc
    this.acc.mult(0);
  }

  _smoothRotate() {
    let targetAngle;

    // 1. If moving, face the velocity.
    // 2. If stationary but seeking, face the acceleration.
    if (this.vel.magSq() > 0.1) {
      targetAngle = Math.atan2(this.vel.y, this.vel.x);
    } else if (this.acc.magSq() > 0) {
      targetAngle = Math.atan2(this.acc.y, this.acc.x);
    } else {
      return; // Truly idle
    }

    // 3. Dynamic Turn Rate: Fast when slow, slow when fast
    let speed = this.vel.mag();
    let currentTurnRate = this.MAX_TURN_RATE / (1 + speed * 2);

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
    // 1. DEBUG TARGETING (Absolute coordinates)
    if (c.DEBUG_MODE && this.targetPosition) {
      this._drawDebugLine(ctx, this.targetPosition);
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.heading);

    if (this.isDead) ctx.globalAlpha = 0.3;

    // 2. RENDER ABSTRACTION
    this._drawLionBody(ctx);

    // 3. STATE INDICATORS
    if (isSelected || this.currentState !== "WANDERING") {
      this._drawStatusRing(ctx, isSelected);
    }

    // 4. TEXT INFO
    ctx.rotate(-this.heading);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(Math.floor(this.energy), 0, -this.radius * 2.5);

    ctx.restore();
  }

  _drawDebugLine(ctx, target, color) {
    ctx.beginPath();
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small circle at target destination
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawLionBody(ctx) {
    const r = this.radius;
    const baseHue = this.dna.color || 40;

    // Tail
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${baseHue}, 50%, 30%)`;
    ctx.lineWidth = r * 0.2;
    ctx.moveTo(-r * 1.2, 0);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.5, -r * 1.8, 0);
    ctx.stroke();

    // Body (Oval)
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${baseHue}, 60%, 50%)`;
    ctx.fill();

    // Mane
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

if (this.currentState === "ATTACKING") {
    ctx.fillStyle = "#fff";
    
    // Top Fang (Pushed higher and made longer)
    ctx.beginPath();
    ctx.moveTo(r * 1.0, -r * 0.3); // Base
    ctx.lineTo(r * 1.2, -r * 0.2); // Tip (length increased to 1.6)
    ctx.lineTo(r * 1.5, -r * 0.1); // Back to head
    ctx.fill();

    // Bottom Fang (Pushed lower and made longer)
    ctx.beginPath();
    ctx.moveTo(r * 1.0, r * 0.3);  // Base
    ctx.lineTo(r * 1.2, r * 0.2);  // Tip
    ctx.lineTo(r * 1.5, r * 0.1);  // Back to head
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

    // Target Dot
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

}
