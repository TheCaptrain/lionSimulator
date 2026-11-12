# Product Overview

Lion Simulator ("Evolution Sim") is a browser-based 2D evolution and predator/prey simulation drawn on an HTML canvas.

- Lions (carnivores) hunt gazelles. Gazelles (herbivores) graze grass that grows in fertile areas, mostly along rivers and lakes plus some inland patches.
- Grass is eaten down and regrows, so herds have to move on. Animals keep to a home range and only roam further when hungry. Their home slowly shifts toward where they feed.
- Each agent has a DNA object of numeric traits (speed, size, vision, aggression, fleefullness, metabolism, color, sociability, wanderlust and others). Offspring inherit mutated DNA.
- Agents run a simple state machine: WANDERING, EATING, FLEEING, ATTACKING.
- Dead agents become corpses with a `flesh` value that carnivores can eat. They rot, become skeletons, and are removed.
- Kin recognition and herding are based on DNA color hue distance.
- Users can click an agent to open the DNA editor, and use the UI panel for sim speed and the debug targeting toggle.
- The world is 12000x12000 with pan and zoom camera controls. It has savannah, villages, trees with shadows, rivers and lakes, and a day and night cycle.
