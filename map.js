export class MapEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.cacheCanvas = document.createElement('canvas');
    this.cacheCanvas.width = canvas.width;
    this.cacheCanvas.height = canvas.height;
    this.cacheCtx = this.cacheCanvas.getContext('2d');

    this.rooms = [];
    this.walls = [];
  }

  generate() {
    this.walls = [];
    this.rooms = [
      { x: 60, y: 60, w: 240, h: 180 },   
      { x: 660, y: 60, w: 240, h: 180 },  
      { x: 360, y: 220, w: 240, h: 200 }, 
      { x: 60, y: 380, w: 220, h: 180 },  
      { x: 660, y: 380, w: 240, h: 200 }  
    ];

    // Borders
    this.walls.push({ x: 0, y: 0, w: this.canvas.width, h: 20 });
    this.walls.push({ x: 0, y: this.canvas.height - 20, w: this.canvas.width, h: 20 });
    this.walls.push({ x: 0, y: 0, w: 20, h: this.canvas.height });
    this.walls.push({ x: this.canvas.width - 20, y: 0, w: 20, h: this.canvas.height });

    // Cut open doors explicitly
    this.rooms.forEach((r, idx) => {
      if (idx === 0) {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: r.h });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: 60 });
        this.walls.push({ x: r.x + r.w - 12, y: r.y + 120, w: 12, h: 60 });
      } else if (idx === 1) {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: 60 });
        this.walls.push({ x: r.x, y: r.y + 120, w: 12, h: 60 });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: r.h });
      } else if (idx === 2) {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: 110, h: 12 });
        this.walls.push({ x: r.x + 150, y: r.y + r.h - 12, w: 90, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: r.h });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: r.h });
      } else {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: r.h });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: r.h });
      }
    });

    this.preRender();
  }

  preRender() {
    this.cacheCtx.fillStyle = '#020203';
    this.cacheCtx.fillRect(0, 0, this.cacheCanvas.width, this.cacheCanvas.height);

    this.cacheCtx.strokeStyle = '#0e0f14';
    this.cacheCtx.lineWidth = 1;
    for (let i = 0; i < this.cacheCanvas.width; i += 32) {
      this.cacheCtx.beginPath(); this.cacheCtx.moveTo(i, 0); this.cacheCtx.lineTo(i, this.cacheCanvas.height); this.cacheCtx.stroke();
    }
    for (let j = 0; j < this.cacheCanvas.height; j += 32) {
      this.cacheCtx.beginPath(); this.cacheCtx.moveTo(0, j); this.cacheCtx.lineTo(this.cacheCanvas.width, j); this.cacheCtx.stroke();
    }

    this.rooms.forEach(r => {
      this.cacheCtx.fillStyle = '#090a0f';
      this.cacheCtx.fillRect(r.x, r.y, r.w, r.h);
    });

    this.cacheCtx.fillStyle = '#1c1d26';
    this.walls.forEach(w => {
      this.cacheCtx.fillRect(w.x, w.y, w.w, w.h);
      this.cacheCtx.strokeStyle = '#2d3142';
      this.cacheCtx.strokeRect(w.x, w.y, w.w, w.h);
    });
  }

  checkWallCollision(targetX, targetY, size) {
    for (let w of this.walls) {
      if (targetX + size > w.x && targetX - size < w.x + w.w &&
          targetY + size > w.y && targetY - size < w.y + w.h) {
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    ctx.drawImage(this.cacheCanvas, 0, 0);
  }
}