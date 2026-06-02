export class Actor {
  constructor(x, y, color, id) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.hp = 100;
    this.size = 14;
    this.color = color;
    this.isDead = false;
    this.speed = 4;
  }

  move(inputs, checkCollision) {
    if (this.isDead) return;
    let dx = 0, dy = 0;
    if (inputs.w) dy -= 1;
    if (inputs.s) dy += 1;
    if (inputs.a) dx -= 1;
    if (inputs.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx*dx + dy*dy);
      const nX = this.x + (dx / len) * this.speed;
      const nY = this.y + (dy / len) * this.speed;

      if (!checkCollision(nX, this.y, this.size)) this.x = nX;
      if (!checkCollision(this.x, nY, this.size)) this.y = nY;
    }
  }

  draw(ctx) {
    if (this.isDead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, -3, 12, 6);
    ctx.restore();

    // Healthbar
    ctx.fillStyle = '#222'; ctx.fillRect(this.x - 15, this.y - 24, 30, 4);
    ctx.fillStyle = this.color; ctx.fillRect(this.x - 15, this.y - 24, 30 * (this.hp / 100), 4);
  }
}

export class Bullet {
  constructor(x, y, angle, owner) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 12;
    this.vy = Math.sin(angle) * 12;
    this.owner = owner;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
  draw(ctx) {
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI*2); ctx.fill();
  }
}