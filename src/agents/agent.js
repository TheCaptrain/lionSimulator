import { c } from "../constants.js";
import { Vector } from "../utils/vector.js";
import * as DNA from "./dna.js";
import { isWater } from "../world/water.js";
import { eatGrass, grassAt, findGrass } from "../world/grass.js";

// Module Constants
const MAX_TURN_RATE = 0.05;
const FRICTION = 0.95;

// Herd neighbours are re-scanned every few steps and the result is reused,
// so herding costs far less than scanning every agent every step.
const HERD_REFRESH_TICKS = 6;
const HERD_FULL_STRENGTH_WEIGHT = 3; // this many close-kin neighbours give full pull
const HERD_ALARM_THRESHOLD = 0.25; // sociability * kinship needed to follow a herdmate's alarm

// Grazing
const GRAZE_HERE_MIN = 12; // graze right where you stand if the cell has at least this much
const GRAZE_WANTED_MIN = 20; // only head for patches with at least this much...
const GRAZE_STARVING_MIN = 6; // ...or this much when starving
const MIN_GRASS_SIGHT = 250; // even short sighted animals can see grass this far
const GRAZE_SEARCH_COOLDOWN = 30; // steps to wait before searching again after finding nothing

// Home range
const HOME_RADIUS_DEFAULT = 800;

// Commitment: once an animal picks something to chase, flee from or eat, it
// sticks with it this many steps (about 1 second at 1x) before looking around again
const FOCUS_STEPS = 60;
const FLEE_AIM_DISTANCE = 300; // how far ahead to aim when running away

// Drawing
const LABEL_MIN_ZOOM = 0.6; // animals show HP / energy / state text at this zoom or closer

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

    // Multiplies c.ATTACK_DAMAGE. Species override this in their constructors.
    this.attackStrength = 1;

    // Home range. Normally an animal stays within homeRadius() of `home` and is
    // pulled back if it strays. The home slowly moves to where it feeds, and
    // starving animals roam further. Species set homeBase in their constructors.
    this.home = { x, y };
    this.homeBase = HOME_RADIUS_DEFAULT;

    // Grazing: where it is heading to eat, and a pause after a fruitless search
    this.grazeTarget = null;
    this.grazeCooldown = 0;

    // Result of the last look at nearby animals (see _getNearbyAgents), reused to avoid garbage
    this._scan = { enemyCount: 0, familyCount: 0, closest: null };

    // Commitment (see FOCUS_STEPS): what it is chasing or eating, the direction
    // it is running away in, and how many steps until it looks around again
    this.focus = null;
    this.fleeDir = null;
    this.focusTimer = 0;

    // Herding. Species override `herdProfile` in their constructors.
    //   range        how far away herd members are noticed
    //   cohesion     pull toward the herd's centre
    //   alignment    pull toward the herd's direction of travel
    //   comfortBase  personal-space radius; no pull inside it (grows with herd size)
    //   hungerSplit  hungry animals drift away from the group (fission-fusion)
    this.herdProfile = {
      range: 300,
      cohesion: 1.0,
      alignment: 0.8,
      comfortBase: 40,
      hungerSplit: false,
    };
    this._herd = null; // cached summary of nearby herd members
    this._herdTimer = Math.floor(Math.random() * HERD_REFRESH_TICKS);

    // Reproduction
    this.reproductionPoints = 0;
    this.reproductionThreshold = 900;
    this.didHaveOffspring = false;
  }

  update(world) {
    if (this.isCorpse) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.acc.x = 0;
      this.acc.y = 0;

      if (this.flesh > 0) {
        // Uneaten meat rots away
        this.flesh = Math.max(0, this.flesh - c.CORPSE_ROT_RATE);
      } else {
        // Bare bones stay for a while, then the body is removed from the world
        this.skeletonTimer = (this.skeletonTimer ?? c.SKELETON_LIFETIME) - 1;
        if (this.skeletonTimer <= 0) this.isGone = true;
      }
      return;
    }

    if (!this.isDead) {
      this.acc.x = 0;
      this.acc.y = 0;

      this.inWater = isWater(this.pos.x, this.pos.y);

      this._separate(world);
      this._handleMetabolism();
      this._manageBrain(world);
      this._handleReproduction(world);
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

  // Whether this animal wants to eat right now. Species can override this.
  // Below SURVIVAL_EAT_BELOW every animal eats, whatever its hunger threshold DNA says.
  _isHungry() {
    const threshold = Math.max(this.dna.hungerThreshold ?? 0.8, c.SURVIVAL_EAT_BELOW);
    return this.energy / this.maxEnergy < threshold;
  }

  // Returns true if the agent is eating or heading for food, false if it has
  // nothing to go for (so the caller can have it search instead of standing still).
  // Carnivores eat meat from carcasses; everyone else grazes.
  findFood(world) {
    if (!this._isHungry()) return false;
    return this.isCarnivore ? this._findMeat(world) : this._findGrass();
  }

  // --- Grazing ---

  _findGrass() {
    // Standing on enough grass: just eat it
    if (grassAt(this.pos.x, this.pos.y) >= GRAZE_HERE_MIN) {
      this._graze();
      return true;
    }

    const starving = this.energy / this.maxEnergy < c.SURVIVAL_EAT_BELOW;
    const wanted = starving ? GRAZE_STARVING_MIN : GRAZE_WANTED_MIN;

    // Drop the target if the patch has been eaten down on the way
    if (this.grazeTarget && grassAt(this.grazeTarget.x, this.grazeTarget.y) < wanted / 2) {
      this.grazeTarget = null;
    }

    if (!this.grazeTarget) {
      if (this.grazeCooldown > 0) {
        this.grazeCooldown--;
      } else {
        const range = Math.max(this.visionRange, MIN_GRASS_SIGHT);
        const homeRadius = starving ? Infinity : this._homeRadius();
        this.grazeTarget = findGrass(this.pos.x, this.pos.y, range, wanted, this.home, homeRadius);
        if (!this.grazeTarget) this.grazeCooldown = GRAZE_SEARCH_COOLDOWN;
      }
    }

    if (this.grazeTarget) {
      this.targetPosition = this.grazeTarget;
      this._seek(this.grazeTarget);
      return true;
    }

    // Nowhere better to go: finish what is left on this cell rather than stand hungry
    if (grassAt(this.pos.x, this.pos.y) > 0.5) {
      this._graze();
      return true;
    }

    this.targetPosition = null;
    return false;
  }

  _graze() {
    this.energy = Math.min(
      this.maxEnergy,
      this.energy + eatGrass(this.pos.x, this.pos.y, c.GRAZE_BITE)
    );

    // Stand still and eat, and let home drift toward good feeding ground
    this.vel.x *= 0.8;
    this.vel.y *= 0.8;
    this.acc.x = 0;
    this.acc.y = 0;
    this.targetPosition = null;
    this.home.x += (this.pos.x - this.home.x) * c.HOME_DRIFT;
    this.home.y += (this.pos.y - this.home.y) * c.HOME_DRIFT;
  }

  // --- Roaming ---

  _homeRadius() {
    return this.homeBase * (this.dna.wanderlust ?? 1);
  }

  // Gentle pull back toward home once the animal has strayed past its home
  // radius. The radius stretches as the animal gets hungrier (up to 2.5x
  // when starving), so hungry animals roam further to find food.
  _applyHomePull() {
    const dx = this.home.x - this.pos.x;
    const dy = this.home.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    const hunger = 1 - Math.min(1, Math.max(0, this.energy / this.maxEnergy));
    const radius = this._homeRadius() * (1 + 3 * Math.max(0, hunger - 0.5));
    if (dist <= radius || dist === 0) return;

    const excess = Math.min(1, (dist - radius) / radius);
    const force = 0.2 * c.SIM_SPEED * c.HOME_PULL * (0.4 + 1.6 * excess);
    this.acc.x += (dx / dist) * force;
    this.acc.y += (dy / dist) * force;
  }

  // --- Eating meat ---

  _findMeat(world) {
    // Keep eating (or heading for) the same carcass for a while instead of looking every step
    let body = this.focus;
    const stillGood = body && body.isCorpse && (body.flesh ?? 0) > 0;
    if (!(stillGood && this._stayFocused())) {
      body = world.nearestMeat(this.pos.x, this.pos.y, this.visionRange);
      if (!body) {
        this.focus = null;
        this.targetPosition = null;
        return false;
      }
      this._setFocus(body);
    }

    const dx = body.pos.x - this.pos.x;
    const dy = body.pos.y - this.pos.y;
    const reach = this.radius + body.radius;
    if (dx * dx + dy * dy < reach * reach) {
      this._eatCorpse(body);
      return true;
    }

    this.targetPosition = body.pos;
    this._seek(body.pos);
    return true;
  }

  _eatCorpse(corpse) {
    const bite = 1 * c.SIM_SPEED;

    const actualBite = Math.min(bite, corpse.flesh ?? 0);
    corpse.flesh = (corpse.flesh ?? 0) - actualBite;
    this.energy = Math.min(this.maxEnergy, this.energy + actualBite);

    this.vel.x *= 0.8;
    this.vel.y *= 0.8;
    this.acc.x = 0;
    this.acc.y = 0;
    this.targetPosition = corpse.pos;
  }
  // --- Internal Behavior & Perception ---

  _manageBrain(world) {
    const dt = c.SIM_SPEED;

    // Execute ongoing movement/steering for current state every tick
    this._executeState(world);

    // Decrement behavior lock timer if set
    if (this.behaviorTimer > 0) {
      this.behaviorTimer -= dt;
      return;
    }

    // Only re-evaluate perception/brain once per second (~60 frames)
    this.decisionTimer++;
    if (this.decisionTimer >= this.decisionInterval) {
      this.decisionTimer = 0;
      this._dropFocus(); // a fresh decision starts with a fresh look around
      this._evaluateState(world);
    }
  }

  // --- Commitment ---

  _setFocus(target) {
    this.focus = target;
    this.focusTimer = FOCUS_STEPS;
  }

  _dropFocus() {
    this.focus = null;
    this.fleeDir = null;
    this.focusTimer = 0;
  }

  // True while still committed to the current focus (counts down one step per call)
  _stayFocused() {
    if (this.focusTimer <= 0) return false;
    this.focusTimer--;
    return true;
  }

  _chase(target) {
    this.targetPosition = target.pos;
    this._seek(target.pos);
    this._resolveAttack(target);
  }

  // Commits to running in direction (dx, dy) and takes the first step
  _startFleeing(world, dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    this.fleeDir = { x: dx / len, y: dy / len };
    this.focusTimer = FOCUS_STEPS;
    this._runAway(world);
  }

  _runAway(world) {
    // Own object: targetPosition can point at another animal's pos, which must not be overwritten
    const aim = (this._fleeAim ??= { x: 0, y: 0 });
    aim.x = this.pos.x + this.fleeDir.x * FLEE_AIM_DISTANCE;
    aim.y = this.pos.y + this.fleeDir.y * FLEE_AIM_DISTANCE;
    this.targetPosition = aim;
    this._seek(aim);
  }

  _executeState(world) {
    switch (this.currentState) {
      case "ATTACKING":
        // Keep chasing the same target for a while instead of looking around every step
        if (this.focus && !this.focus.isDead && this._stayFocused()) {
          this._chase(this.focus);
        } else {
          if (this.focus?.isDead) this.behaviorTimer = 0; // target is down: decide what next soon
          this.focus = null;
          this._checkCombat(world);
        }
        break;
      case "FLEEING":
        // Keep running the same way for a while, then look again
        if (this.fleeDir && this._stayFocused()) this._runAway(world);
        else this._checkFlee(world);
        break;
      case "EATING":
        // No food in sight: wander to search for some rather than standing still.
        // The herd searches together.
        if (!this.findFood(world)) {
          this._wander();
          this._applyHerdForces(world);
          this._applyHomePull();
        }
        break;
      default:
        this._wander();
        this._applyHerdForces(world);
        this._applyHomePull();
        break;
    }
  }

  _evaluateState(world) {
    if (this._checkFlee(world)) {
      this.currentState = "FLEEING";
      this.behaviorTimer = 60;
    } else if (this._isHungry()) {
      if (this.findFood(world)) {
        this.currentState = "EATING";
        this.behaviorTimer = 60;
      } else if (this.isCarnivore && this._checkCombat(world)) {
        // Hungry predator with no carcass in sight: hunt live prey
        this.currentState = "ATTACKING";
        this.behaviorTimer = 40;
      } else {
        this.currentState = "EATING"; // search (see _executeState)
        this.behaviorTimer = 60;
      }
    } else if (this._checkCombat(world)) {
      this.currentState = "ATTACKING";
      this.behaviorTimer = 40;
    } else {
      this.currentState = "WANDERING";
      this._wander();
      this._applyHomePull();
      this.behaviorTimer = 20;
    }
  }

  // Looks at the animals within this one's sight and sums them up: how many
  // are kin, how many are not, and which non-kin one is closest. The result
  // object is reused, so read it before scanning again.
  _getNearbyAgents(world) {
    const range = this.dna.agentVisionRange ?? 150;
    const kinSensitivity = this.dna.kinRecognition ?? this.dna.kin_recogn ?? 15;
    const scan = this._scan;
    scan.enemyCount = 0;
    scan.familyCount = 0;
    scan.closest = null;
    let closestSq = Infinity;

    for (const other of world.near(this.pos.x, this.pos.y, range)) {
      if (other === this || other.isDead) continue;

      if (Math.abs(this.dna.color - other.dna.color) < kinSensitivity) {
        scan.familyCount++;
      } else {
        scan.enemyCount++;
        const dx = other.pos.x - this.pos.x;
        const dy = other.pos.y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < closestSq) {
          closestSq = distSq;
          scan.closest = other;
        }
      }
    }
    return scan;
  }

  _checkFlee(world) {
    const scan = this._getNearbyAgents(world);
    if (scan.enemyCount === 0) return false;

    const fearfulness = this.dna.fleefullness ?? 0.5;
    const fearScore = scan.enemyCount * fearfulness - scan.familyCount * 0.1;

    if (fearScore > 0.6) {
      const threat = scan.closest;
      this._startFleeing(world, this.pos.x - threat.pos.x, this.pos.y - threat.pos.y);
      return true;
    }

    return false;
  }

  _checkCombat(world) {
    const scan = this._getNearbyAgents(world);
    if (scan.enemyCount === 0) return false;

    const aggression = this.dna.aggression ?? 0.5;
    const combatConfidence =
      aggression + scan.familyCount * 0.1 - scan.enemyCount * 0.05;

    if (combatConfidence > 0.4) {
      this.currentState = "ATTACKING";
      this._setFocus(scan.closest);
      this._chase(scan.closest);
      return true;
    }

    return false;
  }
  _resolveAttack(target) {
    const dt = c.SIM_SPEED;

    // A bite lands when the target is within reach of this animal's body edge.
    // (It used to depend on the direction of travel and a minimum speed that
    // slower animals never reached, so they could chase prey but never bite it.)
    const dx = target.pos.x - this.pos.x;
    const dy = target.pos.y - this.pos.y;
    const reach = this.radius + target.radius + c.BITE_REACH;

    if (dx * dx + dy * dy < reach * reach) {
      const damage = c.ATTACK_DAMAGE * this.attackStrength * dt;
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

    // Turning scales with movement speed, otherwise fast animals have a huge
    // turning circle and orbit their target without ever reaching it
    const turnSpeed = 0.1 * dt * c.MOVE_SPEED_SCALE;
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

  // --- Herding ---
  // Boids-style cohesion and alignment (separation is _separate), driven by
  // the animal's sociability. Colour decides who counts as herd: only animals of
  // the same species with a similar hue are followed, and the closer the hue,
  // the stronger the pull. So a mixed area sorts itself into colour-matched herds.

  // 1 for the same hue (within kin recognition), fading to 0 at twice that.
  _colorAffinity(other) {
    const kin = this.dna.kin_recogn ?? 15;
    const diff = Math.abs(this.dna.color - other.dna.color);
    const hueDistance = diff > 180 ? 360 - diff : diff;
    if (hueDistance <= kin) return 1;
    if (hueDistance >= kin * 2) return 0;
    return 1 - (hueDistance - kin) / kin;
  }

  // Summarises the herd around this animal: centre, average heading, total
  // kinship weight, and the closest herdmate that is currently fleeing.
  _refreshHerd(world) {
    const range = this.herdProfile.range;
    let weight = 0;
    let cx = 0;
    let cy = 0;
    let hx = 0;
    let hy = 0;
    let count = 0;
    let alarmMate = null;
    let alarmWeight = 0;

    for (const other of world.near(this.pos.x, this.pos.y, range)) {
      if (other === this || other.isDead || other.type !== this.type) continue;

      const w = this._colorAffinity(other);
      if (w <= 0) continue;

      weight += w;
      count++;
      cx += other.pos.x * w;
      cy += other.pos.y * w;

      const speed = other.vel.mag();
      if (speed > 0.0001) {
        hx += (other.vel.x / speed) * w;
        hy += (other.vel.y / speed) * w;
      }

      // Only a herdmate that has itself just seen a threat counts as an alarm
      if ((other.sawThreatTimer ?? 0) > 0 && w > alarmWeight) {
        alarmMate = other;
        alarmWeight = w;
      }
    }

    this._herd =
      count === 0
        ? null
        : {
            x: cx / weight,
            y: cy / weight,
            hx: hx / weight,
            hy: hy / weight,
            weight,
            count,
            alarmMate,
            alarmWeight,
          };
  }

  _updateHerdCache(world) {
    if (++this._herdTimer >= HERD_REFRESH_TICKS) {
      this._herdTimer = 0;
      this._refreshHerd(world);
    }
  }

  // True if a herdmate is running and this animal is social (and close enough
  // in colour) to join in. Used by prey to spread alarm through the herd.
  _herdIsAlarmed() {
    const h = this._herd;
    if (!h || !h.alarmMate) return false;
    return (this.dna.sociability ?? 0.5) * h.alarmWeight >= HERD_ALARM_THRESHOLD;
  }

  // Adds herd steering to this step's acceleration. `boost` strengthens it,
  // e.g. when the herd is under attack and needs to run as one.
  _applyHerdForces(world, boost = 1) {
    this._updateHerdCache(world);
    const h = this._herd;
    if (!h) return;

    const p = this.herdProfile;
    const sociability = this.dna.sociability ?? 0.5;

    // More close kin nearby means a stronger pull, up to a limit
    let strength =
      sociability * Math.min(1, h.weight / HERD_FULL_STRENGTH_WEIGHT) * boost;
    if (p.hungerSplit) {
      // Fission-fusion: hungry animals spread out to find food, fed ones regroup
      strength *= Math.min(1, (this.energy / this.maxEnergy) * 1.5);
    }
    if (strength <= 0) return;

    const unit = 0.2 * c.SIM_SPEED; // same base push as _wander

    // Cohesion. Nothing inside personal space; the pull grows with distance, so
    // animals out on the edge of the group are drawn in hardest (selfish herd).
    const dx = h.x - this.pos.x;
    const dy = h.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const comfort = p.comfortBase + 14 * Math.sqrt(h.count);
    if (dist > comfort) {
      const pull = Math.min(1, (dist - comfort) / Math.max(1, p.range - comfort));
      const force = unit * p.cohesion * strength * (0.3 + 0.7 * pull);
      this.acc.x += (dx / dist) * force;
      this.acc.y += (dy / dist) * force;
    }

    // Alignment: head the way the herd is heading. The average heading is
    // shorter the more the herd disagrees, so a milling herd pulls less.
    const align = Math.hypot(h.hx, h.hy);
    if (align > 0.01) {
      const force = unit * p.alignment * strength * align;
      this.acc.x += (h.hx / align) * force;
      this.acc.y += (h.hy / align) * force;
    }
  }

  _separate(world) {
    const dt = c.SIM_SPEED;
    const perception = this.radius * 1.5;
    const steer = { x: 0, y: 0 };
    let count = 0;

    for (const other of world.near(this.pos.x, this.pos.y, perception)) {
      if (other === this || other.isDead) continue;

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

    // Cost of being alive, plus a cost per world unit actually travelled
    const baseRate = (this.dna.metabolism ?? 1) * c.SIM_SPEED * c.BASE_ENERGY_DRAIN;
    const swimMult = this.inWater ? c.WATER_ENERGY_MULT : 1;
    const distance = this.vel.mag() * c.MOVE_SPEED_SCALE;
    const movementCost = distance * c.MOVE_ENERGY_COST * swimMult;
    this.energy -= baseRate + movementCost;
  }

  _handleReproduction(world) {
    const dt = c.SIM_SPEED;

    if (this.energy > 100) {
      this.reproductionPoints += dt;
    } else if (this.energy < 50) {
      this.reproductionPoints = Math.max(0, this.reproductionPoints - dt);
    }

    // Waits (keeping its points) until it has the energy to actually pay for a baby
    if (this.reproductionPoints >= this.reproductionThreshold && this.energy >= 100) {
      this.reproductionPoints = 0;

      // The baby's energy comes from the parent, so breeding cannot create energy
      this.energy -= c.OFFSPRING_ENERGY;
      const baby = this._birth();
      baby.energy = c.OFFSPRING_ENERGY;
      world.add(baby);
      this.didHaveOffspring = true;
    }
  }

  _birth() {
    const offspringDNA = DNA.createDNA(this.dna);
    const baby = new this.constructor(this.pos.x + 20, this.pos.y, offspringDNA);
    baby.home = { x: this.home.x, y: this.home.y }; // grows up in the parent's range
    return baby;
  }

  _applyPhysics() {
    if (this.acc.magSq() > 0) {
      this.vel.add(this.acc.mult(c.SIM_SPEED));
    }

    this.vel.mult(FRICTION);

    // Swimming is slow: the same velocity covers less ground in water
    const stepMult = c.MOVE_SPEED_SCALE * (this.inWater ? c.WATER_SPEED_MULT : 1);
    this.pos.x += this.vel.x * stepMult;
    this.pos.y += this.vel.y * stepMult;

    // The world has an edge: stop there instead of running off the map
    if (this.pos.x < 0) { this.pos.x = 0; this.vel.x = Math.max(0, this.vel.x); }
    else if (this.pos.x > c.WORLD_WIDTH) { this.pos.x = c.WORLD_WIDTH; this.vel.x = Math.min(0, this.vel.x); }
    if (this.pos.y < 0) { this.pos.y = 0; this.vel.y = Math.max(0, this.vel.y); }
    else if (this.pos.y > c.WORLD_HEIGHT) { this.pos.y = c.WORLD_HEIGHT; this.vel.y = Math.min(0, this.vel.y); }

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

    const currentTurnRate =
      (MAX_TURN_RATE / (1 + this.vel.mag() * 2)) * dt * c.MOVE_SPEED_SCALE;
    const diff = normalizeAngle(targetAngle - this.heading);

    if (Math.abs(diff) > currentTurnRate) {
      this.heading += Math.sign(diff) * currentTurnRate;
    } else {
      this.heading = targetAngle;
    }
  }

  // --- Drawing Logic ---

  draw(ctx, isSelected, zoom = 1) {
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

    // Text is slow to draw and unreadable when small, so only label animals
    // when zoomed in close enough to read it, or when one is selected
    if (isSelected || zoom >= LABEL_MIN_ZOOM) {
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
