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

// Add these to the bottom of your src/entities.js file

export class Enemy {
  constructor(id, x, y, type = 'grunt') {
    this.id = id;
    this.x = x;
    this.y = y;
    this.size = type === 'elite' ? 15 : 12;
    this.hp = type === 'elite' ? 100 : 45;
    this.speed = type === 'elite' ? 2.0 : 1.5;
    this.color = type === 'elite' ? '#ff33aa' : '#ff3333';
    
    // AI State Machine Configurations
    // States: 'PATROL', 'ALERT', 'CHASE'
    this.state = 'PATROL'; 
    this.alertTimer = 0; // Tracks the 1-second delay
    this.angle = Math.random() * Math.PI * 2; // Direction they are looking
    this.lastShot = 0;
    
    // Patrol path memory anchors
    this.patrolTarget = { x: this.x, y: this.y };
    this.patrolWait = 0;
    
    // Fields of View
    this.fovRadius = 350; // Sight range in pixels
    this.fovAngle = Math.PI / 3; // 60-degree cone of vision
  }

  update(host, client, checkGlobalCollisions, spawnBulletCallback) {
    if (this.hp <= 0) return;

    // 1. Pick the closest active player inside the world
    let currentTarget = null;
    let minDist = this.fovRadius;

    [host, client].forEach(p => {
      if (p && !p.isDead) {
        let dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (dist < minDist) {
          // Check if player falls inside their visual field cone
          let angleToPlayer = Math.atan2(p.y - this.y, p.x - this.x);
          let angleDiff = Math.atan2(Math.sin(angleToPlayer - this.angle), Math.cos(angleToPlayer - this.angle));
          
          if (Math.abs(angleDiff) < this.fovAngle / 2) {
            // Simple Raycast Check: Verify no solid walls block direct vision line
            let wallBlocked = false;
            let steps = 10;
            for(let i = 1; i <= steps; i++) {
              let checkX = this.x + (p.x - this.x) * (i / steps);
              let checkY = this.y + (p.y - this.y) * (i / steps);
              if (checkGlobalCollisions(checkX, checkY, 4)) {
                wallBlocked = true;
                break;
              }
            }
            if (!wallBlocked) {
              currentTarget = p;
              minDist = dist;
            }
          }
        }
      }
    });

    // 2. Execute AI Core State Logic
    if (this.state === 'PATROL') {
      if (currentTarget) {
        this.state = 'ALERT';
        this.alertTimer = 60; // 60 frames = exactly 1 second at 60Hz
      } else {
        // Handle random office scouting loops
        if (Math.hypot(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y) < 20 || this.patrolWait > 200) {
          this.patrolWait = 0;
          this.patrolTarget = {
            x: this.x + (Math.random() - 0.5) * 300,
            y: this.y + (Math.random() - 0.5) * 300
          };
        }
        this.patrolWait++;
        
        let moveAngle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x);
        this.angle = moveAngle; // Face towards movement direction
        
        let nX = this.x + Math.cos(moveAngle) * (this.speed * 0.5);
        let nY = this.y + Math.sin(moveAngle) * (this.speed * 0.5);
        if (!checkGlobalCollisions(nX, nY, this.size)) {
          this.x = nX; this.y = nY;
        }
      }
    } 
    else if (this.state === 'ALERT') {
      if (!currentTarget) {
        this.state = 'PATROL'; // Lost sight during alert build-up
      } else {
        this.angle = Math.atan2(currentTarget.y - this.y, currentTarget.x - this.x);
        this.alertTimer--;
        if (this.alertTimer <= 0) {
          this.state = 'CHASE';
        }
      }
    } 
    else if (this.state === 'CHASE') {
      if (!currentTarget) {
        this.state = 'PATROL'; // Lost sight completely
      } else {
        this.angle = Math.atan2(currentTarget.y - this.y, currentTarget.x - this.x);
        
        // Chase and approach target vector bounds
        let nX = this.x + Math.cos(this.angle) * this.speed;
        let nY = this.y + Math.sin(this.angle) * this.speed;
        if (!checkGlobalCollisions(nX, nY, this.size)) {
          this.x = nX; this.y = nY;
        }

        // Ranged combat execution loop (Shoot every 1.2 seconds)
        if (Date.now() - this.lastShot > 1200) {
          this.lastShot = Date.now();
          spawnBulletCallback(this.x, this.y, this.angle, 'enemy');
        }

        // Close-range contact fallback physical damage
        if (Math.hypot(currentTarget.x - this.x, currentTarget.y - this.y) < currentTarget.size + this.size) {
          currentTarget.hp -= 0.5;
          if (currentTarget.hp <= 0) currentTarget.isDead = true;
        }
      }
    }
  }

  draw(ctx) {
    if (this.hp <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Draw standard or elite mesh indicator profiles
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#110202';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Visual weapon barrel indicator line
    ctx.fillStyle = '#444';
    ctx.fillRect(2, -2, 10, 4);
    ctx.restore();

    // 3. Render Floating Visual Interface Alert Feedback Symbols
    if (this.state === 'ALERT') {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', this.x, this.y - 20);
    } else if (this.state === 'CHASE') {
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!!', this.x, this.y - 20);
    }
  }
}
