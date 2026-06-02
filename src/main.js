import { InputTracker } from './input.js';
import { NetworkManager } from './network.js';
import { MapEngine } from './map.js';
import { Actor, Bullet } from './entities.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const map = new MapEngine(canvas);
const input = new InputTracker(canvas);

// Dynamic Camera viewport tracking structure
const camera = { x: 0, y: 0 };

const player1 = new Actor(100, 120, '#ff4444', 'host');
const player2 = new Actor(140, 120, '#33ff33', 'client');
let bullets = [];
let enemies = [];

let clientInputsCache = { keys: {}, mouse: { x: 0, y: 0 }, click: false };

function initializeNewGameLayout() {
  map.generate();
  // Anchor spawn vectors directly out of procedural map metadata markers
  player1.x = map.startPoint.x; player1.y = map.startPoint.y;
  player2.x = map.startPoint.x + 40; player2.y = map.startPoint.y;

  if (network.isHost) {
    enemies = [
      { id: 'e1', x: 600, y: 200, hp: 50, speed: 1.5, size: 12 },
      { id: 'e2', x: 1000, y: 500, hp: 50, speed: 1.7, size: 12 },
      { id: 'e3', x: 1500, y: 900, hp: 100, speed: 1.0, size: 16 } // Heavy Unit
    ];
  }
}

const network = new NetworkManager(
  (isHost) => { initializeNewGameLayout(); },
  (msg) => {
    if (network.isHost && msg.type === 'INPUT') {
      clientInputsCache = msg.payload;
    } else if (!network.isHost && msg.type === 'SNAPSHOT') {
      const snap = msg.payload;
      player1.x = snap.p1.x; player1.y = snap.p1.y; player1.angle = snap.p1.angle; player1.hp = snap.p1.hp;
      player2.x = snap.p2.x; player2.y = snap.p2.y; player2.angle = snap.p2.angle; player2.hp = snap.p2.hp;
      
      // Mirror synced arrays directly onto client frame arrays
      map.boxes = snap.boxes;
      map.doors = snap.doors;
      enemies = snap.enemies;
      bullets = snap.bullets.map(b => new Bullet(b.x, b.y, 0, ''));
    }
  }
);

document.getElementById('btnCreate').addEventListener('click', () => network.hostLobby());
document.getElementById('btnJoin').addEventListener('click', () => {
  const code = document.getElementById('roomInput').value.trim();
  if(code) network.joinLobby(code);
});

initializeNewGameLayout();

function checkGlobalCollisions(x, y, size) {
  if (map.checkWallCollision(x, y, size)) return true;
  for (let b of map.boxes) {
    if (x + size > b.x && x - size < b.x + b.w && y + size > b.y && y - size < b.y + b.h) return true;
  }
  for (let d of map.doors) {
    if (!d.open && x + size > d.x && x - size < d.x + d.w && y + size > d.y && y - size < d.y + d.h) return true;
  }
  return false;
}

function masterEngineLoop() {
  const localInput = input.getSnapshot();
  const activeFocus = network.isHost ? player1 : player2;

  // Track viewport matrix adjustments relative to screen dimensions
  camera.x = activeFocus.x - canvas.width / 2;
  camera.y = activeFocus.y - canvas.height / 2;
  camera.x = Math.max(0, Math.min(map.worldWidth - canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(map.worldHeight - canvas.height, camera.y));

  // Translate crosshair positions to global world space coordinates
  const worldMouse = { x: localInput.mouse.x + camera.x, y: localInput.mouse.y + camera.y };

  if (network.isHost) {
    player1.move(localInput.keys, checkGlobalCollisions);
    player1.angle = Math.atan2(worldMouse.y - player1.y, worldMouse.x - player1.x);

    if (network.connected) {
      player2.move(clientInputsCache.keys, checkGlobalCollisions);
      const clientWorldMouse = { x: clientInputsCache.mouse.x + camera.x, y: clientInputsCache.mouse.y + camera.y };
      player2.angle = Math.atan2(clientWorldMouse.y - player2.y, clientWorldMouse.x - player2.x);
    }

    // Handle weapon systems impulses
    if (localInput.click) {
      bullets.push(new Bullet(player1.x, player1.y, player1.angle, 'host'));
      input.clickTriggered = false;
    }
    if (clientInputsCache.click) {
      bullets.push(new Bullet(player2.x, player2.y, player2.angle, 'client'));
      clientInputsCache.click = false;
    }

    // Door automated tracking
    map.doors.forEach(d => {
      let nearP1 = Math.hypot(player1.x - (d.x + d.w/2), player1.y - (d.y + d.h/2)) < 60;
      let nearP2 = network.connected && Math.hypot(player2.x - (d.x + d.w/2), player2.y - (d.y + d.h/2)) < 60;
      d.open = nearP1 || nearP2;
      d.lerpOpen += ((d.open ? 1 : 0) - d.lerpOpen) * 0.15;
    });

    // Update Projectiles and Hitboxes
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      let hit = checkGlobalCollisions(bullets[i].x, bullets[i].y, 2);
      
      if (!hit) {
        for (let b of map.boxes) {
          if (bullets[i].x > b.x && bullets[i].x < b.x + b.w && bullets[i].y > b.y && bullets[i].y < b.y + b.h) {
            b.hp -= 20; hit = true; break;
          }
        }
      }
      if (!hit) {
        for (let e of enemies) {
          if (Math.hypot(bullets[i].x - e.x, bullets[i].y - e.y) < e.size) {
            e.hp -= 25; hit = true; break;
          }
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    map.boxes = map.boxes.filter(b => b.hp > 0);

    // Process Basic Enemy AI Vectors
    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      if (e.hp <= 0) { enemies.splice(i, 1); continue; }
      
      let target = (network.connected && Math.hypot(player2.x - e.x, player2.y - e.y) < Math.hypot(player1.x - e.x, player1.y - e.y)) ? player2 : player1;
      let angle = Math.atan2(target.y - e.y, target.x - e.x);
      let nX = e.x + Math.cos(angle) * e.speed;
      let nY = e.y + Math.sin(angle) * e.speed;
      if (!checkGlobalCollisions(nX, nY, e.size)) { e.x = nX; e.y = nY; }
    }

    // Broadcast Snapshot Packages downstream
    network.send({
      type: 'SNAPSHOT',
      payload: {
        p1: player1, p2: player2,
        enemies: enemies,
        doors: map.doors,
        boxes: map.boxes,
        bullets: bullets.map(b => ({ x: b.x, y: b.y }))
      }
    });

  } else {
    // Client upstream execution pipeline
    network.send({ type: 'INPUT', payload: localInput });
  }

  // --- RENDERING TRANSFORM MATRICES VIA CAMERA OFFSET ---
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(-camera.x, -camera.y); // Shift world context coordinate grid system backwards

  map.draw(ctx);

  // Draw Boxes
  map.boxes.forEach(b => {
    ctx.fillStyle = '#5c4028'; ctx.strokeStyle = '#3d2a1a';
    ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
  });

  // Draw Sliding Partition Openings
  map.doors.forEach(d => {
    let isHorizontal = d.w > d.h;
    ctx.fillStyle = '#3a4f6e';
    if (isHorizontal) {
      let currentW = d.w * (1 - d.lerpOpen);
      if (currentW > 0) ctx.fillRect(d.x, d.y, currentW, d.h);
    } else {
      let currentH = d.h * (1 - d.lerpOpen);
      if (currentH > 0) ctx.fillRect(d.x, d.y, d.w, currentH);
    }
  });

  // Render Actors
  bullets.forEach(b => b.draw(ctx));
  
  enemies.forEach(e => {
    ctx.fillStyle = '#ff3333'; ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();
  });

  player1.draw(ctx);
  player2.draw(ctx);

  // Render Extraction Pad Indicator Icon Target UI marker
  ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.arc(map.endPoint.x, map.endPoint.y, 40, 0, Math.PI*2); ctx.stroke();

  ctx.restore(); // Drop camera offset state matrix back to absolute screen canvas coords
  requestAnimationFrame(masterEngineLoop);
}

requestAnimationFrame(masterEngineLoop);
