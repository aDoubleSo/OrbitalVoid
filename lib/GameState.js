const { Vector } = require('./Vector');

const ARENA_RADIUS = 400;
const ROCKET_RADIUS = 15;
const BULLET_RADIUS = 4;
const BULLET_SPEED = 8;
const BULLET_LIFETIME = 120; // ticks
const MAX_SPEED = 6;
const THRUST_POWER = 0.15;
const ROTATION_SPEED = 0.08;
const FRICTION = 0.995;
const MAX_HEALTH = 100;
const BULLET_DAMAGE = 20;
const WALL_DAMAGE = 10;
const FIRE_COOLDOWN = 15; // ticks

class Rocket {
  constructor(id, name, x, y, angle) {
    this.id = id;
    this.name = name;
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.angle = angle;
    this.health = MAX_HEALTH;
    this.input = { up: false, down: false, left: false, right: false, fire: false };
    this.fireCooldown = 0;
    this.isBot = false;
    this.thrusting = false;
    this.turningLeft = false;
    this.turningRight = false;
  }

  update() {
    // Reset thruster states
    this.thrusting = false;
    this.turningLeft = false;
    this.turningRight = false;

    // Rotation
    if (this.input.left) {
      this.angle -= ROTATION_SPEED;
      this.turningLeft = true;
    }
    if (this.input.right) {
      this.angle += ROTATION_SPEED;
      this.turningRight = true;
    }

    // Thrust
    if (this.input.up) {
      const thrust = Vector.fromAngle(this.angle, THRUST_POWER);
      this.vel = this.vel.add(thrust);
      this.thrusting = true;
    }
    if (this.input.down) {
      const brake = Vector.fromAngle(this.angle, -THRUST_POWER * 0.5);
      this.vel = this.vel.add(brake);
    }

    // Apply friction and limit speed
    this.vel = this.vel.mult(FRICTION).limit(MAX_SPEED);

    // Update position
    this.pos = this.pos.add(this.vel);

    // Cooldown
    if (this.fireCooldown > 0) this.fireCooldown--;
  }

  canFire() {
    return this.input.fire && this.fireCooldown === 0 && this.health > 0;
  }

  fire() {
    this.fireCooldown = FIRE_COOLDOWN;
    const bulletPos = this.pos.add(Vector.fromAngle(this.angle, ROCKET_RADIUS + BULLET_RADIUS + 2));
    const bulletVel = Vector.fromAngle(this.angle, BULLET_SPEED).add(this.vel.mult(0.3));
    return new Bullet(this.id, bulletPos, bulletVel);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      x: this.pos.x,
      y: this.pos.y,
      vx: this.vel.x,
      vy: this.vel.y,
      angle: this.angle,
      health: this.health,
      thrusting: this.thrusting,
      turningLeft: this.turningLeft,
      turningRight: this.turningRight
    };
  }
}

class Bullet {
  constructor(ownerId, pos, vel) {
    this.ownerId = ownerId;
    this.pos = pos;
    this.vel = vel;
    this.lifetime = BULLET_LIFETIME;
    this.active = true;
  }

  update() {
    this.pos = this.pos.add(this.vel);
    this.lifetime--;
    if (this.lifetime <= 0) this.active = false;
  }

  serialize() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      vx: this.vel.x,
      vy: this.vel.y
    };
  }
}

class Bot {
  constructor(rocket, targetGetter, personality = {}) {
    this.rocket = rocket;
    this.getTarget = targetGetter;
    this.rocket.isBot = true;

    // Personality traits with defaults
    this.aggression = personality.aggression ?? 0.5;      // 0-1: how close they want to get
    this.accuracy = personality.accuracy ?? 0.3;          // angle threshold for firing
    this.reactionDelay = personality.reactionDelay ?? 0;  // ticks delay before reacting
    this.jitter = personality.jitter ?? 0;                // random movement noise
    this.preferredDistance = personality.preferredDistance ?? 150;

    this.reactionTimer = 0;
    this.lastDecision = { left: false, right: false, up: false, down: false, fire: false };
  }

  update() {
    const target = this.getTarget();
    if (!target) {
      this.rocket.input = { up: false, down: false, left: false, right: false, fire: false };
      return;
    }

    // Reaction delay - don't change decisions every frame
    this.reactionTimer++;
    if (this.reactionTimer < this.reactionDelay) {
      this.rocket.input = this.lastDecision;
      return;
    }
    this.reactionTimer = 0;

    const toTarget = target.pos.sub(this.rocket.pos);
    const targetAngle = toTarget.angle();
    let angleDiff = targetAngle - this.rocket.angle;

    // Normalize angle difference
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const distance = toTarget.mag();

    // Add jitter to angle perception
    const jitteredAngleDiff = angleDiff + (Math.random() - 0.5) * this.jitter;

    const decision = {
      left: jitteredAngleDiff < -0.1,
      right: jitteredAngleDiff > 0.1,
      up: Math.abs(angleDiff) < 0.5 && distance > this.preferredDistance,
      down: distance < this.preferredDistance * this.aggression,
      fire: Math.abs(angleDiff) < this.accuracy && distance < 350
    };

    this.lastDecision = decision;
    this.rocket.input = decision;
  }
}

class GameRoom {
  constructor(id) {
    this.id = id;
    this.rockets = new Map();
    this.bullets = [];
    this.state = 'waiting'; // waiting, playing, ended
    this.winner = null;
    this.bots = [];
  }

  addPlayer(id, name) {
    if (this.rockets.size >= 2) return false;

    const spawnIndex = this.rockets.size;
    const angle = spawnIndex === 0 ? 0 : Math.PI;
    const x = spawnIndex === 0 ? -200 : 200;

    const rocket = new Rocket(id, name, x, 0, angle);
    this.rockets.set(id, rocket);

    if (this.rockets.size === 2) {
      this.state = 'playing';
    }

    return true;
  }

  addBot() {
    const botId = 'bot_' + Date.now();
    const rocket = new Rocket(botId, 'Bot', 200, 0, Math.PI);
    rocket.isBot = true;
    this.rockets.set(botId, rocket);

    const bot = new Bot(rocket, () => {
      for (const [id, r] of this.rockets) {
        if (id !== botId && r.health > 0) return r;
      }
      return null;
    });
    this.bots.push(bot);

    this.state = 'playing';
    return true;
  }

  addTwoBots() {
    const bot1Id = 'bot1_' + Date.now();
    const bot2Id = 'bot2_' + Date.now();

    const rocket1 = new Rocket(bot1Id, 'Aggressor', -200, 0, 0);
    rocket1.isBot = true;
    this.rockets.set(bot1Id, rocket1);

    const rocket2 = new Rocket(bot2Id, 'Sniper', 200, 0, Math.PI);
    rocket2.isBot = true;
    this.rockets.set(bot2Id, rocket2);

    // Aggressive bot - gets close, fires often, quick reactions
    const bot1 = new Bot(rocket1, () => {
      const r = this.rockets.get(bot2Id);
      return r && r.health > 0 ? r : null;
    }, {
      aggression: 0.8,
      accuracy: 0.4,
      reactionDelay: 3,
      jitter: 0.1,
      preferredDistance: 100
    });

    // Sniper bot - keeps distance, precise shots, slower reactions
    const bot2 = new Bot(rocket2, () => {
      const r = this.rockets.get(bot1Id);
      return r && r.health > 0 ? r : null;
    }, {
      aggression: 0.3,
      accuracy: 0.2,
      reactionDelay: 8,
      jitter: 0.05,
      preferredDistance: 250
    });

    this.bots.push(bot1, bot2);
    this.state = 'playing';
    return true;
  }

  removePlayer(id) {
    this.rockets.delete(id);
    if (this.rockets.size < 2 && this.state === 'playing') {
      this.state = 'ended';
      for (const [playerId] of this.rockets) {
        this.winner = playerId;
      }
    }
  }

  setInput(id, input) {
    const rocket = this.rockets.get(id);
    if (rocket) {
      rocket.input = input;
    }
  }

  update() {
    if (this.state !== 'playing' && this.state !== 'ended') return;

    // Update bot AI
    for (const bot of this.bots) {
      bot.update();
    }

    // Update rockets
    for (const rocket of this.rockets.values()) {
      if (rocket.health <= 0) continue;

      rocket.update();

      // Fire bullets
      if (rocket.canFire()) {
        this.bullets.push(rocket.fire());
      }

      // Wall collision - instant death
      const distFromCenter = rocket.pos.mag();
      if (distFromCenter + ROCKET_RADIUS > ARENA_RADIUS) {
        rocket.health = 0;
      }
    }

    // Update bullets
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;

      bullet.update();

      // Wall collision
      if (bullet.pos.mag() > ARENA_RADIUS) {
        bullet.active = false;
        continue;
      }

      // Rocket collision
      for (const rocket of this.rockets.values()) {
        if (rocket.id === bullet.ownerId) continue;
        if (rocket.health <= 0) continue;

        const dist = bullet.pos.dist(rocket.pos);
        if (dist < ROCKET_RADIUS + BULLET_RADIUS) {
          bullet.active = false;
          rocket.takeDamage(BULLET_DAMAGE);
        }
      }
    }

    // Remove inactive bullets
    this.bullets = this.bullets.filter(b => b.active);

    // Check for winner
    if (this.state === 'playing') {
      const alive = [...this.rockets.values()].filter(r => r.health > 0);
      if (alive.length <= 1) {
        this.state = 'ended';
        this.winner = alive.length === 1 ? alive[0].id : null;
      }
    }
  }

  serialize() {
    return {
      state: this.state,
      winner: this.winner,
      arenaRadius: ARENA_RADIUS,
      rockets: [...this.rockets.values()].map(r => r.serialize()),
      bullets: this.bullets.filter(b => b.active).map(b => b.serialize())
    };
  }
}

module.exports = { GameRoom, Rocket, Bullet, Vector, ARENA_RADIUS };
