# Tech Stack

- Vanilla JavaScript using native ES modules (`<script type="module" src="./src/main.js">`). No bundler, no framework, no package.json.
- Rendering uses the Canvas 2D API (`#simCanvas`). The UI is plain HTML and CSS in `index.html`, plus DOM code in `ui.js` and `ui/`.
- Because ES modules are used, the app must be served over HTTP (for example `npx serve .` or the VS Code Live Server extension). Opening `index.html` via `file://` will fail.
- Imports use relative paths and always include the `.js` extension.
- There are no tests, linter or build step at present.

## Conventions

- Global tunables live in `constants.js` as the exported object `c` (world size, `SIM_SPEED`, `DEBUG_MODE`, timing values).
- Simulation uses a fixed step. `c.SIM_SPEED` is the per-step size (do not change it to change speed) and time-dependent logic multiplies by it. Speed is `c.TIME_SCALE`, the number of steps `main.js` runs per frame (0 = paused), limited by a per-frame time budget.
- Trait definitions (min, max, step, label) live in `DNA_BLUEPRINT` (`src/agents/dna.js`). The DNA editor UI builds its sliders from them. Add new traits there.
- Species subclass `Agent` (`src/agents/lion.js`, `src/agents/gazelle.js`). Offspring are created with `new this.constructor(...)`.
- Code style is 2-space indent in newer files, double quotes, and `_prefix` for private methods.
- Some DNA keys are read with fallbacks between snake_case and camelCase (e.g. `max_speed` / `maxSpeed`, `kin_recogn` / `kinRecognition`). Check the actual DNA key names before relying on a trait.

## Known quirks

- `main.js` loads `sounds/jump.mp3`, which does not exist in the repo. Audio assets live in `assets/`.
