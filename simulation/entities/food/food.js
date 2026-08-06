// simulation/entities/food/food.js
export class Food {
  constructor(x, y, config, type = "plant", corpseData = null) {
    this.pos = { x, y };
    this.type = type;
    this.corpseData = corpseData; // { hue: number, heading: number }

    this.maxSize = config.maxSize || 15;
    this.maxNutrition = config.nutrition || 5;
    this.nutritionValue = this.type === "meat" ? this.maxNutrition : 1.0;
    this.growthRate = config.growthRate || 0.1;
    this.isEaten = false;
  }

  get radius() {
    // If it's meat or a skeleton, return the full size so it doesn't shrink
    if (this.type === "meat" || this.isSkeleton) {
        return this.maxSize;
    }

    // Plants still use the shrinking/growing logic
    const ratio = this.nutritionValue / this.maxNutrition;
    return Math.max(0, ratio * this.maxSize);
}

//   update(speed) {
//     if (this.isEaten) return;

//     // Only plants grow over time. Meat usually decays or stays static.
//     if (this.type === "plant" && this.nutritionValue < this.maxNutrition) {
//       this.nutritionValue += this.growthRate * speed;
//     }

//     if (this.nutritionValue <= 0.1) {
//       this.isEaten = true;
//     }
//   }

update(speed) {
    if (this.isEaten) return;

    // 1. Plant Growth
    if (this.type === "plant" && this.nutritionValue < this.maxNutrition) {
        this.nutritionValue += this.growthRate * speed;
    }

    // 2. Meat to Skeleton Transition
    // When nutrition hits 0, if it's meat, turn it into a skeleton instead of deleting
    if (this.nutritionValue <= 0) {
        if (this.type === "meat" && !this.isSkeleton) {
            this.isSkeleton = true;
            this.nutritionValue = 0; 
        } else if (this.type === "plant") {
            this.isEaten = true;
        }
    }

    // 3. Optional: Skeleton Decay (so the map doesn't fill up with bones)  TODO
    // if (this.isSkeleton) {
    //     this.skeletonLife = (this.skeletonLife || 1000) - (1 * speed);
    //     if (this.skeletonLife <= 0) this.isEaten = true;
    // }
    
}

  draw(ctx) {
    // Inside the draw(ctx) method of Food.js

    if (this.isSkeleton) {
      const r = this.maxSize; // Use maxSize to keep skeleton scale consistent
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.corpseData.heading);

      ctx.strokeStyle = "#e0e0e0"; // Bone white
      ctx.lineWidth = 2;

      // 1. Spine
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.stroke();

      // 2. Ribs
      for (let i = 0; i < 4; i++) {
        let x = -r + i * r * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, -r * 0.4);
        ctx.lineTo(x, r * 0.4);
        ctx.stroke();
      }

      // 3. Skull (Simplified)
      ctx.beginPath();
      ctx.arc(r * 0.7, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#f5f5f5";
      ctx.fill();
      ctx.stroke();

      // 4. Eye Sockets (Empty)
      ctx.fillStyle = "#1a1a1a";
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.arc(r * 0.8, side * r * 0.15, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      return; // Stop drawing meat/plant logic
    }

    if (this.isEaten || this.radius <= 0) return;

    if (this.type === "meat" && this.corpseData) {
      const r = this.radius;
      // Use original hue, but drop saturation (40%) and lightness (25%) for a "browned" look
      const baseHue = this.corpseData.hue;
      const corpseColor = `hsl(${baseHue}, 40%, 25%)`;
      const maneColor = `hsl(${baseHue}, 50%, 15%)`;

      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.corpseData.heading);

      // 1. Body (Oval)
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = corpseColor;
      ctx.fill();

      // 2. Battle Scars (Cuts)
      ctx.strokeStyle = "rgba(139, 0, 0, 0.6)"; // Deep blood red
      ctx.lineWidth = 2;
      // Draw three diagonal claw marks
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5 + i * 5, -r * 0.3);
        ctx.lineTo(-r * 0.8 + i * 5, r * 0.3);
        ctx.stroke();
      }

      // 3. Mane (Matted/Dark)
      ctx.beginPath();
      ctx.arc(r * 0.5, 0, r * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = maneColor;
      ctx.fill();

      // 4. Head
      ctx.beginPath();
      ctx.arc(r * 0.7, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = corpseColor;
      ctx.fill();

      // 5. "X" Eyes
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 1.5;
      [-1, 1].forEach((side) => {
        const ex = r * 0.9;
        const ey = side * r * 0.2;
        const s = r * 0.12; // size of X
        ctx.beginPath();
        ctx.moveTo(ex - s, ey - s);
        ctx.lineTo(ex + s, ey + s);
        ctx.moveTo(ex + s, ey - s);
        ctx.lineTo(ex - s, ey + s);
        ctx.stroke();
      });

      ctx.restore();
    } else {
      // Standard Plant Drawing
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#4CAF50";
      ctx.fill();
    }
  }
}
