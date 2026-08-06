export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { this.x /= n; this.y /= n; return this; }

    setMag(n) { return this.normalize().mult(n); }

    magSq() { return this.x * this.x + this.y * this.y; }
    mag() { return Math.sqrt(this.magSq()); }

    normalize() {
        let m = this.mag();
        if (m !== 0) this.div(m);
        return this;
    }

    dist(v) {
        let dx = this.x - v.x;
        let dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    copy() { return new Vector(this.x, this.y); }

    static fromAngle(angle) {
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
}