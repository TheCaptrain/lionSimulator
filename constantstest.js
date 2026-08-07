// constants.js
export const c = {
    DEBUG_MODE: false,
    SIM_SPEED: 0.1, // Set to 0.1 for 10% speed
    // This is how big the playable area is
    
    WORLD_WIDTH: 3000,
    WORLD_HEIGHT: 3000,
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