# Project Structure

```
index.html              Page shell, styles, UI panel and DNA editor markup
assets/                 Static assets (audio)
src/
  main.js               Entry point: init, update loop, draw loop, click selection
  constants.js          Global config object `c`
  camera.js             Camera state, pan/zoom, screenToWorld
  ui.js                 UI listeners, showEditor (agent), showZoneEditor (food zone)
  agents/
    agent.js            Base Agent: state machine, steering, metabolism, reproduction, drawing
    dna.js              DNA_BLUEPRINT, createDNA, mutation
    lion.js             Carnivore
    gazelle.js          Herbivore
  world/
    water.js            Rivers and lakes: generateWater, isWater(x, y), drawWater. Rivers are a drainage tree (height map + priority-flood), so they branch and never cross
    village.js         Villages: clearings, round huts, wells, paths, hut shadows
    biomes.js           Biomes (village, savannah): getBiome(x, y), drawGround
    trees.js            Savannah trees (acacia, baobab, bush) and their shadows
    daynight.js         Time of day, getSun() (shadow direction/length), night lighting overlay
    shadows.js          Draws all shadows in one pass
    food.js / food_system.js are listed below
    food.js             Food entity
    food_system.js      FoodSystem: spawn zones, growth, cleanup, ZONE_BLUEPRINT
  effects/
    blood.js            BloodParticle
  utils/
    vector.js           Vector math
```

## Where to put things

- New species: add a file in `src/agents/` extending `Agent`, then spawn it in `main.js` `init()`.
- New heritable trait: add it to `DNA_BLUEPRINT` in `src/agents/dna.js`, then read it in `agent.js` or the species file.
- New global tunable: add it to `constants.js`.
- New world systems (weather, spawners and so on): add them under `src/world/` and call them from `main.js` `update()`.
- New visual effects: add them under `src/effects/`.

- Anything that moves or spawns should respect water via `isWater(x, y)` from `world/water.js`. Land agents slow down in water (`c.WATER_SPEED_MULT`, `c.WATER_ENERGY_MULT`). Future fish should live in water instead.
- Anything that casts a shadow exposes an `addXShadows(ctx, view, sun)` function that adds sub-paths with `addCircle` (`utils/canvas.js`), and is called from `shadows.js`. Shadow offset is `sun.shadowX/Y` times the object's `height`.
- Generation order in `main.js` `init()`: water, villages, trees.
- Draw functions for large world layers take a `view` rectangle from `getViewBounds(canvas)` and skip anything off-screen.

File names are lowercase snake_case.
