# Product Overview

Lion Simulator ("Evolution Sim") is a browser-based 2D evolution and predator/prey simulation drawn on an HTML canvas.

- Lions (carnivores) hunt gazelles. Gazelles (herbivores) eat plant food that spawns in fertile zones.
- Each agent has a DNA object of numeric traits (speed, size, vision, aggression, fleefullness, metabolism, color and others). Offspring inherit mutated DNA.
- Agents run a simple state machine: WANDERING, EATING, FLEEING, ATTACKING.
- Dead agents become corpses with a `flesh` value that carnivores can eat. They then become skeletons and are removed.
- Kin recognition is based on DNA color hue distance.
- Users can click an agent to open the DNA editor, click a food zone to edit its parameters, and use the UI panel for sim speed and the debug targeting toggle.
- The world is a 3000x3000 area with pan and zoom camera controls and a town background.
