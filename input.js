export class InputTracker {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.clickTriggered = false;

    window.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.clickTriggered = true; });
    canvas.addEventListener('mouseup', e => { if (e.button === 0) this.clickTriggered = false; });
  }

  getSnapshot() {
    return {
      keys: {
        w: this.keys['w'] || this.keys['arrowup'],
        s: this.keys['s'] || this.keys['arrowdown'],
        a: this.keys['a'] || this.keys['arrowleft'],
        d: this.keys['d'] || this.keys['arrowright']
      },
      mouse: this.mouse,
      click: this.clickTriggered
    };
  }
}