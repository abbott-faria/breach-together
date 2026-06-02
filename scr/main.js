import { InputTracker } from './input.js';
import { NetworkManager } from './network.js';
import { MapEngine } from './map.js';
import { Actor, Bullet } from './entities.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Instantiate Modules
const input = new InputTracker(canvas);
const map = new MapEngine(canvas);

// Local Game Collections
const player1 = new Actor(100, 120, '#ff4444', 'host');
const player2 = new Actor(140, 120, '#33ff33', 'client');
let bullets = [];

// Client Input Mirroring Cache
let clientInputsCache = { keys: {}, mouse: { x: 0, y: 0 }, click: false };

// Networking Core Callbacks Setup
const network = new NetworkManager(
  (isHost) => { if (isHost) map.generate(); }, // OnConnect
  (msg) => {                                  // OnMessage
    if (network.isHost && msg.type === 'INPUT') {
      clientInputsCache = msg.payload;
    } else if (!network.isHost && msg.type === 'SNAPSHOT') {
      // Client maps values directly from host state packets
      player1.x = msg.payload.p1.x; player1.y = msg.payload.p1.y; player1.angle = msg.payload.p1.angle; player1.hp = msg.payload.p1.hp;
      player2.x = msg.payload.p2.x; player2.y = msg.payload.p2.y; player2.angle = msg.payload.p2.angle; player2.hp = msg.payload.p2.hp;
      bullets = msg.payload.bullets.map(b => new Bullet(b.x, b.y, 0, ''));
    }
  }
);

// Setup UI Handlers
document.getElementById('btnCreate').addEventListener('click', () => network.hostLobby());
document.getElementById('btnJoin').addEventListener('click', () => {
  const code = document.getElementById('roomInput').value.trim();
  if(code) network.joinLobby(code);
});

// Initialize Offline Local Map Layout Baseline
map.generate();

// -- MAIN CORE RUNTIME ENGINE LOOP --
function masterEngineLoop() {
  const localInput = input.getSnapshot();

  if (network.isHost) {
    // 1. Host processes local moves
    player1.move(localInput.keys, (x,y,s) => map.checkWallCollision(x,y,s));
    player1.angle = Math.atan2(localInput.mouse.y - player1.y, localInput.mouse.x - player1.x);

    // 2. Host processes client moves from mirrored inputs
    if (network.connected) {
      player2.move(clientInputsCache.keys, (x,y,s) => map.checkWallCollision(x,y,s));
      player2.angle = Math.atan2(clientInputsCache.mouse.y - player2.y, clientInputsCache.mouse.x - player2.x);
    }

    // 3. Bullet spawns and collision testing
    if (localInput.click) {
      bullets.push(new Bullet(player1.x, player1.y, player1.angle, 'host'));
      input.clickTriggered = false; // Reset impulse state switch
    }
    if (clientInputsCache.click) {
      bullets.push(new Bullet(player2.x, player2.y, player2.angle, 'client'));
      clientInputsCache.click = false;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      if (map.checkWallCollision(bullets[i].x, bullets[i].y, 2)) {
        bullets.splice(i, 1);
      }
    }

    // 4. Stream host state parameters down to client
    network.send({
      type: 'SNAPSHOT',
      payload: {
        p1: player1, p2: player2,
        bullets: bullets.map(b => ({ x: b.x, y: b.y }))
      }
    });

  } else {
    // Client Upstream Logic: Send snapshot packet strings upstream
    network.send({ type: 'INPUT', payload: localInput });
  }

  // --- RENDERING ROUTINES ---
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  map.draw(ctx);
  bullets.forEach(b => b.draw(ctx));
  player1.draw(ctx);
  player2.draw(ctx);

  requestAnimationFrame(masterEngineLoop);
}

// Ignition
requestAnimationFrame(masterEngineLoop);