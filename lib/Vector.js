class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  sub(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  mult(scalar) {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  div(scalar) {
    if (scalar === 0) return new Vector(0, 0);
    return new Vector(this.x / scalar, this.y / scalar);
  }

  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const m = this.mag();
    if (m === 0) return new Vector(0, 0);
    return this.div(m);
  }

  limit(max) {
    if (this.mag() > max) {
      return this.normalize().mult(max);
    }
    return new Vector(this.x, this.y);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  dist(v) {
    return this.sub(v).mag();
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  copy() {
    return new Vector(this.x, this.y);
  }

  static fromAngle(angle, magnitude = 1) {
    return new Vector(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }

  static random() {
    const angle = Math.random() * Math.PI * 2;
    return Vector.fromAngle(angle);
  }
}

module.exports = { Vector };
