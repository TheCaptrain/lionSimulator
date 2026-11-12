// constants.js
export const c = {
    DEBUG_MODE: false,
    // Size of one simulation step. Fixed: do not change this to change speed.
    SIM_SPEED: 0.1,
    // How many steps run per frame. 0 = paused, 1 = normal. Set by the speed slider.
    TIME_SCALE: 1,
    // This is how big the playable area is
    
    WORLD_WIDTH: 12000,
    WORLD_HEIGHT: 12000,

    // --- Energy economy (all per simulation step) ---
    // Energy an animal burns just by being alive, times its metabolism and SIM_SPEED.
    // 0.01 * 0.1 = 0.001 per step: about 80k steps (roughly 22 minutes at 1x) to
    // burn from 100 energy down to the point where starvation starts.
    BASE_ENERGY_DRAIN: 0.01,
    // Extra energy per world unit travelled (swimming multiplies this)
    MOVE_ENERGY_COST: 0.0008,
    // A parent hands this much energy to its baby. It must have at least 100 to breed.
    OFFSPRING_ENERGY: 40,
    MAX_HIT_POINTS: 100,
    // Hit points a well-fed animal heals per step (was 0.01, halved)
    HP_REGEN_RATE: 0.005,
    // Base damage per step while an attacker's mouth is touching its target.
    // Each species scales it with its own attackStrength.
    ATTACK_DAMAGE: 20.5,
    // How far past touching an attacker can still land a bite (world units)
    BITE_REACH: 10,
    // Uneaten meat rots away at this much flesh per step; bones last a while, then vanish
    CORPSE_ROT_RATE: 0.005,
    SKELETON_LIFETIME: 3000,

    // --- Grazing and roaming ---
    // Energy a grazing animal eats per step (grass cells hold up to 60)
    GRAZE_BITE: 0.15,
    // Every animal eats once it drops below this fraction of max energy,
    // whatever its hunger threshold DNA says, so low thresholds do not mean starving to death
    SURVIVAL_EAT_BELOW: 0.3,
    // Animals stay near a home and are pulled back when they stray past their
    // home radius (HOME_PULL times a wander push). Starving animals roam further.
    HOME_PULL: 3,
    // Each grazing step moves home this fraction of the way to where the animal is
    // feeding, so homes slowly shift toward good grass
    HOME_DRIFT: 0.002,

    // Multiplies how far an animal's velocity moves it each step. Steering, energy
    // use and combat are unaffected, so this only changes how fast they cover ground.
    MOVE_SPEED_SCALE: 12,

    // Land animals can swim, but slowly and at a higher energy cost
    WATER_SPEED_MULT: 0.35,
    WATER_ENERGY_MULT: 2,
    // Screen size is handled by window.innerWidth/Height
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    BASE_AGENT_RADIUS: 10,
    SIZE_MAP: { "Small": 0.7, "Medium": 1.0, "Large": 1.5 },
    SPEED_MAP: { "Slow": 1.5, "Normal": 2.5, "Fast": 4.0 },
    // Adding the timing/physics constants from your python classes
    CHEW_TIME: 40,
    GESTATION_TIME: 120,
    MAX_LIFESPAN: 5000

    
};