# Project Structure

```
index.html              Page shell, styles, UI panel and DNA editor markup
assets/                 Static assets (audio)
src/
  main.js               Entry point: init, update loop, draw loop, click selection
  constants.js          Global config object `c`
  camera.js             Camera state, pan/zoom, screenToWorld
  ui.js                 UI listeners, showEditor (agent DNA sliders)
  agents/
    agent.js            Base Agent: state machine, steering, grazing, home range, herding, metabolism, reproduction, drawing
    dna.js              DNA_BLUEPRINT, createDNA, mutation
    lion.js             Carnivore
    gazelle.js          Herbivore
    spawn.js            Starting herds (gazelles) and prides (lions)
  world/
    water.js            Rivers and lakes: generateWater, isWater(x, y), drawWater. Rivers are a drainage tree (height map + priority-flood), so they branch and never cross
    grass.js            Grass field on a 100 unit grid: fertility map (near water + inland patches), regrowth, grazing, drawing
    village.js          Villages: clearings, round huts, wells, paths, hut shadows
    biomes.js           Biomes (village, savannah): getBiome(x, y), drawGround
    trees.js            Savannah trees (acacia, baobab, bush) and their shadows
    daynight.js         Time of day, getSun() (shadow direction/length), night lighting overlay
    shadows.js          Draws all shadows in one pass
  effects/
    blood.js            BloodParticle
  utils/
    vector.js           Vector math
    canvas.js           Path helpers (addCircle, addEllipse) and isInView
    noise.js            Value noise (valueNoise, layeredNoise)
```

## Where to put things

- New species: add a file in `src/agents/` extending `Agent`, then add it to `spawn.js`.
- New heritable trait: add it to `DNA_BLUEPRINT` in `src/agents/dna.js`, then read it in `agent.js` or the species file.
- New global tunable: add it to `constants.js`.
- New world systems (weather, spawners and so on): add them under `src/world/` and call them from `main.js` `update()`.
- New visual effects: add them under `src/effects/`.

- Anything that moves or spawns should respect water via `isWater(x, y)` from `world/water.js`. Land agents slow down in water (`c.WATER_SPEED_MULT`, `c.WATER_ENERGY_MULT`). Future fish should live in water instead.
- Food: herbivores graze `world/grass.js` (`grassAt`, `eatGrass`, `findGrass`). Carnivores eat carcasses (`_findMeat`). There are no food zones or food entities any more. Grass amounts are in energy units, so eating a unit of grass gives a unit of energy.
- Roaming: each animal has a `home` and `homeRadius()` (species `homeBase` times the `wanderlust` DNA trait). `_applyHomePull` leashes wandering and searching, and fleeing or hunting ignores it. Home drifts toward where the animal grazes, and babies inherit the parent's home.
- Herding lives in `agent.js` (`_applyHerdForces`, `_colorAffinity`, `_refreshHerd`). Species set a `herdProfile` in their constructor, and the `sociability` DNA trait scales it. Colour decides who counts as herd (see `_colorAffinity`). Gazelles spread alarm through the herd in `_checkFlee`. Lions answer pride hunt calls (`_callPride`).
- Anything that casts a shadow exposes an `addXShadows(ctx, view, sun)` function that adds sub-paths with `addCircle` (`utils/canvas.js`), and is called from `shadows.js`. Shadow offset is `sun.shadowX/Y` times the object's `height`.
- Generation order in `main.js` `init()`: water, villages, grass, trees. Animals are spawned after that.
- Draw functions for large world layers take a `view` rectangle from `getViewBounds(canvas)` and skip anything off-screen.
- Agents are updated with `agent.update(agents)`. The world systems (water, grass) are modules the agents import directly.

File names are lowercase snake_case.
