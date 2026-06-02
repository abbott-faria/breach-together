import { InputTracker } from './input.js';
import { NetworkManager } from './network.js';
import { MapEngine } from './map.js';
import { Actor, Bullet, Enemy } from './entities.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const map = new MapEngine(canvas);
const input = new InputTracker(canvas);
const camera = { x: 0, y: 0 };

const player1 = new Actor(100, 120, '#ff4444', 'host');
const player2 = new Actor(140, 120, '#33ff33', 'client');
let bullets = [];
let enemies = [];

let clientInputsCache = { keys: {}, mouse: { x: 0, y: 0 }, click: false };

function resizeViewport() {
  const interfaceElement = document.getElementById('interface');
  const interfaceHeight = interfaceElement ? interfaceElement.offsetHeight : 60;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - interfaceHeight;
  ctx.imageSmoothingEnabled = false; 
}
resizeViewport();
window.addEventListener('resize', resizeViewport);

function spawnProceduralEnemies() {
  enemies = [];
  if (!map.rooms || map.rooms.length === 0) return;
  
  map.rooms.forEach((room, index) => {
    if (room.type === 'start') return;
    let count = room.type === 'end' ? 3 : Math.floor(Math.random() * 2) + 1;
    for(let i = 0; i < count; i++) {
      let eX = room.x + 40 + Math.random() * (room.w - 80);
      let eY = room.y + 40 + Math.random() * (room.h - 80);
      let enemyType = (room.type === 'end' || Math.random() > 0.7) ? 'elite' : 'grunt';
      let id = 'enemy_' + index + '_' + i + '_' + Math.random();
      enemies.push(new Enemy(id, eX, eY, enemyType));
    }
  });
}

function initializeNewGameLayout() {
  map.generate();
  if (map.startPoint) {
    player1.x = map.startPoint.x; player1.y = map.startPoint.y; player1.hp = 100; player1.isDead = false;
    player2.x = map.startPoint.x + 40; player2.y = map.startPoint.y; player2.hp = 100; player2.isDead = false;
  }
  spawnProceduralEnemies();
}

const network = new NetworkManager(
  (isHost) => { initializeNewGameLayout(); },
  (msg) => {
    if (network.isHost && msg.type === 'INPUT') {
      clientInputsCache = msg.payload;
    } else if (!network.isHost && msg.type === 'SNAPSHOT') {
      const snap = msg.payload;
      player1.x = snap.p1.x; player1.y = snap.p1.y; player1.angle = snap.p1.angle; player1.hp = snap.p1.hp; player1.isDead = snap.p1.isDead;
      player2.x = snap.p2.x; player2.y = snap.p2.y; player2.angle = snap.p2.angle; player2.hp = snap.p2.hp; player2.isDead = snap.p2.isDead;
      map.boxes = snap.boxes;
      map.doors = snap.doors;
      enemies = snap.enemies.map(e => {
        let n = new Enemy(e.id, e.x, e.y, e.size > 12 ? 'elite' : 'grunt');
        n.angle = e.angle; n.state = e.state; n.hp = e.hp;
        return n;
      });
      bullets = snap.bullets.map(b => new Bullet(b.x, b.y, 0, b.owner));
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
  if (map.boxes) {
    for (let b of map.boxes) {
      if (x + size > b.x && x - size < b.x + b.w && y + size > b.y && y - size < b.y + b.h) return true;
    }
  }
  if (map.doors) {
    for (let d of map.doors) {
      if (!d.open && x + size > d.x && x - size < d.x + d.w && y + size > d.y && y - size < d.y + d.h) return true;
    }
  }
  return false;
}

function masterEngineLoop() {
  const localInput = input.getSnapshot();
  const activeFocus = network.isHost ? player1 : player2;

  camera.x = activeFocus.x - canvas.width / 2;
  camera.y = activeFocus.y - canvas.height / 2;
  camera.x = Math.max(0, Math.min(map.worldWidth - canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(map.worldHeight - canvas.height, camera.y));

  const worldMouse = { x: localInput.mouse.x + camera.x, y: localInput.mouse.y + camera.y };

  if (network.isHost) {
    player1.move(localInput.keys, checkGlobalCollisions);
    player1.angle = Math.atan2(worldMouse.y - player1.y, worldMouse.x - player1.x);

    if (network.connected) {
      player2.move(clientInputsCache.keys, checkGlobalCollisions);
      const clientWorldMouse = { x: clientInputsCache.mouse.x + camera.x, y: clientInputsCache.mouse.y + camera.y };
      player2.angle = Math.atan2(clientWorldMouse.y - player2.y, clientWorldMouse.x - player2.x);
    }

    if (localInput.click && !player1.isDead) {
      bullets.push(new Bullet(player1.x, player1.y, player1.angle, 'host'));
      input.clickTriggered = false;
    }
    if (clientInputsCache.click && !player2.isDead) {
      bullets.push(new Bullet(player2.x, player2.y, player2.angle, 'client'));
      clientInputsCache.click = false;
    }

    if (map.doors) {
      map.doors.forEach(d => {
        let nearP1 = Math.hypot(player1.x - (d.x + d.w/2), player1.y - (d.y + d.h/2)) < 60;
        let nearP2 = network.connected && Math.hypot(player2.x - (d.x + d.w/2), player2.y - (d.y + d.h/2)) < 60;
        d.open = nearP1 || nearP2;
        d.lerpOpen += ((d.open ? 1 : 0) - d.lerpOpen) * 0.15;
      });
    }

    enemies.forEach(e => {
      e.update(player1, player2, checkGlobalCollisions, (bx, by, ba, owner) => {
        bullets.push(new Bullet(bx, by, ba, owner));
      });
    });

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      let b = bullets[i];
      let hit = checkGlobalCollisions(b.x, b.y, 2);
      
      if (!hit && map.boxes) {
        for (let box of map.boxes) {
          if (b.x > box.x && b.x < box.x + box.w && b.y > box.y && b.y < box.y + box.h) {
            box.hp -= 20; hit = true; break;
          }
        }
      }
      
      if (!hit) {
        if (b.owner === 'host' || b.owner === 'client') {
          for (let e of enemies) {
            if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.size) {
              e.hp -= 25; hit = true; break;
            }
          }
        } 
        else if (b.owner === 'enemy') {
          if (!player1.isDead && Math.hypot(b.x - player1.x, b.y - player1.y) < player1.size) {
            player1.hp -= 10; if (player1.hp <= 0) player1.isDead = true; hit = true;
          }
          if (!hit && network.connected && !player2.isDead && Math.hypot(b.x - player2.x, b.y - player2.y) < player2.size) {
            player2.hp -= 10; if (player2.hp <= 0) player2.isDead = true; hit = true;
          }
        }
      }

      if (hit || b.x < 0 || b.x > map.worldWidth || b.y < 0 || b.y > map.worldHeight) {
        bullets.splice(i, 1);
      }
    }

    if (map.boxes) map.boxes = map.boxes.filter(b => b.hp > 0);
    enemies = enemies.filter(e => e.hp > 0);

    network.send({
      type: 'SNAPSHOT',
      payload: {
        p1: { x: player1.x, y: player1.y, angle: player1.angle, hp: player1.hp, isDead: player1.isDead },
        p2: { x: player2.x, y: player2.y, angle: player2.angle, hp: player2.hp, isDead: player2.isDead },
        enemies: enemies.map(e => ({ id: e.id, x: e.x, y: e.y, angle: e.angle, state: e.state, hp: e.hp, size: e.size })),
        doors: map.doors,
        boxes: map.boxes,
        bullets: bullets.map(b => ({ x: b.x, y: b.y, owner: b.owner }))
      }
    });

  } else {
    network.send({ type: 'INPUT', payload: localInput });
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  map.draw(ctx);

  if (map.boxes) {
    map.boxes.forEach(b => {
      ctx.fillStyle = '#5c4028'; ctx.strokeStyle = '#3d2a1a';
      ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
  }

  if (map.doors) {
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
  }

  bullets.forEach(b => b.draw(ctx));
  enemies.forEach(e => e.draw(ctx));
  player1.draw(ctx);
  player2.draw(ctx);

  if (map.endPoint) {
    ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(map.endPoint.x, map.endPoint.y, 40, 0, Math.PI*2); ctx.stroke();
  }

  ctx.restore();
  requestAnimationFrame(masterEngineLoop);
}

requestAnimationFrame(masterEngineLoop);
