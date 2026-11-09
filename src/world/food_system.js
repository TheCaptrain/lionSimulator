import { Food } from "./food.js";
import { c } from "../constants.js";
import { isWater } from "./water.js";

export const ZONE_BLUEPRINT = {
  x: { min: 0, max: 12000, step: 50, label: "X Position" },
  y: { min: 0, max: 12000, step: 50, label: "Y Position" },
  w: { min: 50, max: 12000, step: 50, label: "Width" },
  h: { min: 50, max: 12000, step: 50, label: "Height" },
  rate: { min: 0, max: 0.2, step: 0.001, label: "Spawn Rate" },
  growthSpeed: { min: 0.01, max: 1.0, step: 0.01, label: "Growth Speed" },
};

export class FoodSystem {
  constructor() {
    this.foods = [];
    this.zones = [
      {
        x: 300,
        y: 300,
        w: 5300,
        h: 5300,
        rate: 0.01, // How often it spawns (scaled up for the bigger zones)
        growthRate: 0.02, // How fast it grows
        maxSize: 100,
        nutrition: 50,
        label: "Japan",
      },
      {
        x: 300,
        y: 6400,
        w: 5300,
        h: 5300,
        rate: 0.01, // How often it spawns (scaled up for the bigger zones)
        growthRate: 0.01, // How fast it grows
        maxSize: 100,
        nutrition: 20,
        label: "Ireland",
      },
      {
        x: 6400,
        y: 300,
        w: 5300,
        h: 5300,
        rate: 0.01, // How often it spawns (scaled up for the bigger zones)
        growthRate: 0.01, // How fast it grows
        maxSize: 100,
        nutrition: 20,
        label: "Mexico",
      },
      {
        x: 6400,
        y: 6400,
        w: 5300,
        h: 5300,
        rate: 0.01, // How often it spawns (scaled up for the bigger zones)
        growthRate: 0.01, // How fast it grows
        maxSize: 100,
        nutrition: 20,
        label: "Alicante",
      },
    ];
  }

  update() {
    // 1. Spawn Food in Zones
    this.zones.forEach((zone) => {
      // Multiply by SIM_SPEED so spawning stays in sync with aging
      if (Math.random() < zone.rate * c.SIM_SPEED) {
        const fx = zone.x + Math.random() * zone.w;
        const fy = zone.y + Math.random() * zone.h;

        // Plants do not grow in water
        if (isWater(fx, fy)) return;

        this.foods.push(new Food(fx, fy, zone));
      }
    });

    // 2. Grow existing food
    // Pass the speed into the food's update if it has one
    this.foods.forEach((f) => f.update(c.SIM_SPEED));

    // 3. Cleanup: Remove eaten food
    this.foods = this.foods.filter((f) => !f.isEaten);
  }

  // simulation/systems/food_systems.js

  draw(ctx) {
    // 1. Draw the Growth Zones
    this.zones.forEach((zone) => {
      // Fill the area
      ctx.fillStyle = "rgba(76, 175, 80, 0.1)"; // Subtle green
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

      // Draw the border
      ctx.strokeStyle = "rgba(76, 175, 80, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);

      // Optional: Label the zone
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "12px sans-serif";
      ctx.fillText(zone.label || "Growth Zone", zone.x + 5, zone.y + 15);
    });

    // 2. Draw the actual food items
    this.foods.forEach((f) => f.draw(ctx));
  }

//   spawnMeat(x, y, energyValue, hue, heading, originalRadius) {
//     const meatConfig = {
//         nutrition: energyValue,
//         maxSize: originalRadius, // Keeps it the same size as the living lion
//         growthRate: 0 
//     };
    
//     const corpse = new Food(x, y, meatConfig, "meat", { hue, heading });
//     this.foods.push(corpse);
// }
}
