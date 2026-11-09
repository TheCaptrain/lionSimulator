export class BloodParticle {
    constructor(x, y, isPool = false, isHeart = false) {
        this.pos = { x, y };
        this.isPool = isPool;
        this.isHeart = isHeart;
        this.life = 1.0;
        
        // Make them last longer so you can see them
        this.decay = isPool ? 0.0002 : 0.02; 
        this.decay = isHeart ? 0.002 : this.decay ; 
        // BOOST THESE SIZES
        // Pools: 20px (big splat) | Hearts/Hits: 4px to 6px (visible chunks)
        this.size = isPool ? 20 : Math.random() * 3 + 3;
        
        this.vel = isPool ? { x: 0, y: 0 } : {
            // Make the blood spray further out
            x: (Math.random() - 0.5) * 6,
            y: (Math.random() - 0.5) * 6
        };
    }

    update() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        
        // Green for hearts, Dark Red for pools, Bright Red for hits
        if (this.isHeart) {
            ctx.fillStyle = "#00ff00";
        } else {
            ctx.fillStyle = this.isPool ? "#8b0000" : "#ff0a0a"; 
        }
        
        const currentSize = this.isPool ? this.size : this.size * (0.5 + this.life * 0.5);

        if (this.isHeart) {
            this.drawHeart(ctx, this.pos.x, this.pos.y, currentSize * 2);
        } else {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, currentSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add a tiny bright "highlight" to make it look wet/shiny
        if (!this.isPool && this.life > 0.8) {
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            if (this.isHeart) {
                this.drawHeart(ctx, this.pos.x - currentSize * 0.2, this.pos.y - currentSize * 0.2, currentSize * 0.5);
            } else {
                ctx.arc(this.pos.x - this.size * 0.2, this.pos.y - this.size * 0.2, this.size * 0.2, 0, Math.PI * 2);
            }
            ctx.fill();
        }
        
        ctx.restore();
    }

    drawHeart(ctx, x, y, size) {
        ctx.beginPath();
        const topCurveHeight = size * 0.3;
        ctx.moveTo(x, y + topCurveHeight);
        // Top left curve
        ctx.bezierCurveTo(
            x, y, 
            x - size / 2, y, 
            x - size / 2, y + topCurveHeight
        );
        // Bottom left curve
        ctx.bezierCurveTo(
            x - size / 2, y + (size + topCurveHeight) / 2, 
            x, y + (size + topCurveHeight) / 2, 
            x, y + size
        );
        // Bottom right curve
        ctx.bezierCurveTo(
            x, y + (size + topCurveHeight) / 2, 
            x + size / 2, y + (size + topCurveHeight) / 2, 
            x + size / 2, y + topCurveHeight
        );
        // Top right curve
        ctx.bezierCurveTo(
            x + size / 2, y, 
            x, y, 
            x, y + topCurveHeight
        );
        ctx.closePath();
        ctx.fill();
    }
}

// Make it visible to main.js without imports
window.BloodParticle = BloodParticle;