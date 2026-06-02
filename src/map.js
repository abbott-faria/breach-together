export class MapEngine {
  constructor(canvas) {
    this.canvas = canvas;
    // Massive 2x canvas world size expansion!
    this.worldWidth = 1920; 
    this.worldHeight = 1280;

    this.cacheCanvas = document.createElement('canvas');
    this.cacheCanvas.width = this.worldWidth;
    this.cacheCanvas.height = this.worldHeight;
    this.cacheCtx = this.cacheCanvas.getContext('2d');

    this.rooms = [];
    this.walls = [];
    this.doors = [];
    this.boxes = [];
    this.startPoint = { x: 150, y: 150 };
    this.endPoint = { x: 0, y: 0 };
  }

  generate() {
    this.rooms = [];
    this.walls = [];
    this.doors = [];
    this.boxes = [];

    // 1. Anchor the absolute Start HQ (Safe Room)
    const startRoom = { x: 60, y: 60, w: 260, h: 200, type: 'start' };
    this.rooms.push(startRoom);
    this.startPoint = { x: startRoom.x + 80, y: startRoom.y + 100 };

    // 2. Map Room Config Node Blueprints
    const building Blueprints = [
      { x: 420, y: 60, w: 300, h: 240 },
      { x: 820, y: 80, w: 240, h: 220 },
      { x: 1160, y: 60, w: 340, h: 260 },
      { x: 1600, y: 100, w: 260, h: 300 }, // Potential East Exit Wing
      { x: 100, y: 360, w: 240, h: 240 },
      { x: 450, y: 400, w: 400, h: 300 }, // Central Courtyard Core
      { x: 950, y: 420, w: 280, h: 240 },
      { x: 1350, y: 480, w: 320, h: 280 },
      { x: 80, y: 720, w: 280, h: 320 },
      { x: 480, y: 800, w: 300, h: 240 },
      { x: 900, y: 760, w: 360, h: 300 },
      { x: 1400, y: 860, w: 400, h: 340, type: 'end' } // Massive End/Extraction Laboratory
    ];

    buildingBlueprints.forEach(b => this.rooms.push({ type: b.type || 'office', ...b }));
    const endRoom = this.rooms.find(r => r.type === 'end');
    this.endPoint = { x: endRoom.x + endRoom.w / 2, y: endRoom.y + endRoom.h / 2 };

    // 3. Build Outer Steel Boundaries
    this.walls.push({ x: 0, y: 0, w: this.worldWidth, h: 24 });
    this.walls.push({ x: 0, y: this.worldHeight - 24, w: this.worldWidth, h: 24 });
    this.walls.push({ x: 0, y: 0, w: 24, h: this.worldHeight });
    this.walls.push({ x: this.worldWidth - 24, y: 0, w: 24, h: this.worldHeight });

    // 4. Generate Procedural Wall Profiles and Doorways
    this.rooms.forEach((r) => {
      // Create doorways by leaving architectural wall segments open
      if (r.type === 'start') {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: r.h });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: 70 });
        this.walls.push({ x: r.x + r.w - 12, y: r.y + 140, w: 12, h: 60 });
        this.doors.push({ id: 'door_start', x: r.x + r.w - 12, y: r.y + 70, w: 12, h: 70, open: false, lerpOpen: 0 });
      } 
      else if (r.type === 'end') {
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: 100 });
        this.walls.push({ x: r.x, y: r.y + 180, w: 12, h: r.h - 180 });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: r.h });
        this.doors.push({ id: 'door_end', x: r.x, y: r.y + 100, w: 12, h: 80, open: false, lerpOpen: 0 });
      } 
      else {
        // Standard Building Rooms with a bottom entry corridor cut
        this.walls.push({ x: r.x, y: r.y, w: r.w, h: 12 });
        this.walls.push({ x: r.x, y: r.y + r.h - 12, w: (r.w/2) - 30, h: 12 });
        this.walls.push({ x: r.x + (r.w/2) + 30, y: r.y + r.h - 12, w: (r.w/2) - 30, h: 12 });
        this.walls.push({ x: r.x, y: r.y, w: 12, h: r.h });
        this.walls.push({ x: r.x + r.w - 12, y: r.y, w: 12, h: r.h });
        this.doors.push({ id: 'door_' + Math.random(), x: r.x + (r.w/2) - 30, y: r.y + r.h - 12, w: 60, h: 12, open: false, lerpOpen: 0 });
      }

      // 5. Scatter Breakable Office Cover (Never inside player start zones)
      let boxesToSpawn = r.type === 'start' ? 1 : 4;
      for (let i = 0; i < boxesToSpawn; i++) {
        let bX = r.x + 32 + Math.random() * (r.w - 80);
        let bY = r.y + 32 + Math.random() * (r.h - 80);
        if (Math.hypot(bX - this.startPoint.x, bY - this.startPoint.y) > 90) {
          this.boxes.push({ id: 'box_' + Math.random(), x: bX, y: bY, w: 28, h: 28, hp: 40 });
        }
      }
    });

    this.preRender();
  }

  preRender() {
    this.cacheCtx.fillStyle = '#020203';
    this.cacheCtx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    // Floor Grids
    this.cacheCtx.strokeStyle = '#0e0f14';
    this.cacheCtx.lineWidth = 1;
    for (let i = 0; i < this.worldWidth; i += 32) {
      this.cacheCtx.beginPath(); this.cacheCtx.moveTo(i, 0); this.cacheCtx.lineTo(i, this.worldHeight); this.cacheCtx.stroke();
    }
    for (let j = 0; j < this.worldHeight; j += 32) {
      this.cacheCtx.beginPath(); this.cacheCtx.moveTo(0, j); this.cacheCtx.lineTo(this.worldWidth, j); this.cacheCtx.stroke();
    }

    // Colors per room type
    this.rooms.forEach(r => {
      if (r.type === 'start') this.cacheCtx.fillStyle = '#071012'; // Safe HQ green/blue tint
      else if (r.type === 'end') this.cacheCtx.fillStyle = '#160d0d'; // Danger Zone extraction red tint
      else this.cacheCtx.fillStyle = '#090a0f'; // Normal Office floor
      this.cacheCtx.fillRect(r.x, r.y, r.w, r.h);
    });

    // Stamp Walls
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
