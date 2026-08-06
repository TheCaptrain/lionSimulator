# Create directories
New-Item -ItemType Directory -Force -Path "simulation/entities/agent", "ui", "utils"

# Initialize Root Files
"<!DOCTYPE html>
<html>
<head>
    <title>Evolution Sim</title>
    <style>body { margin: 0; background: #0f1114; overflow: hidden; }</style>
</head>
<body>
    <canvas id='simCanvas'></canvas>
    <script type='module' src='main.js'></script>
</body>
</html>" | Out-File -FilePath index.html

"import { c } from './constants.js';
import { Vector } from './utils/Vector.js';

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

function loop() {
    // Game loop logic here
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);" | Out-File -FilePath main.js

"export const c = {
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    FPS: 60
};" | Out-File -FilePath constants.js

# Initialize Utils
"export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    // Add math methods here
}" | Out-File -FilePath utils/Vector.js

# Initialize Simulation Files
"" | Out-File -FilePath simulation/environment.js
"export class Food {}
export class FertileZone {}" | Out-File -FilePath simulation/entities/food.js
"export class DNA {}" | Out-File -FilePath simulation/entities/agent/DNA.js
"export class Agent {
    constructor(x, y, dna) {
        this.pos = {x, y};
    }
}" | Out-File -FilePath simulation/entities/agent/agent.js

# Initialize UI Files
"export class Slider {}
export class Button {}" | Out-File -FilePath ui/elements.js
"export class DNAEditor {}" | Out-File -FilePath ui/agent_edit.js

Write-Host "JS File Structure Created Successfully!" -ForegroundColor Green