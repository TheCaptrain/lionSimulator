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