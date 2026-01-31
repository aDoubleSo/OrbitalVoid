const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameContainer = document.getElementById('game-container');
const gameOverScreen = document.getElementById('game-over');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id');
const joinBtn = document.getElementById('join-btn');
const practiceBtn = document.getElementById('practice-btn');
const restartBtn = document.getElementById('restart-btn');
const roomDisplay = document.getElementById('room-display');
const winnerText = document.getElementById('winner-text');

// Game state
let playerId = null;
let currentState = null;
let gameStarted = false;

// Input state
const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false
};

// Resize canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input handlers
const keyMap = {
  'KeyW': 'up',
  'ArrowUp': 'up',
  'KeyS': 'down',
  'ArrowDown': 'down',
  'KeyA': 'left',
  'ArrowLeft': 'left',
  'KeyD': 'right',
  'ArrowRight': 'right',
  'Space': 'fire'
};

window.addEventListener('keydown', (e) => {
  const action = keyMap[e.code];
  if (action && !input[action]) {
    input[action] = true;
    socket.emit('input', input);
  }
});

window.addEventListener('keyup', (e) => {
  const action = keyMap[e.code];
  if (action && input[action]) {
    input[action] = false;
    socket.emit('input', input);
  }
});

// UI handlers
joinBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Player';
  const room = roomIdInput.value.trim() || 'default';
  socket.emit('join', { roomId: room, playerName: name });
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

roomIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

practiceBtn.addEventListener('click', () => {
  socket.emit('practice');
});

restartBtn.addEventListener('click', () => {
  socket.emit('restart');
  gameOverScreen.classList.add('hidden');
});

// Socket events
socket.on('joined', (data) => {
  playerId = data.playerId;
  roomDisplay.textContent = data.roomId;
  loginScreen.classList.add('hidden');
  waitingScreen.classList.remove('hidden');
});

socket.on('waiting', (data) => {
  // Still waiting for opponent
});

socket.on('gameStart', () => {
  gameStarted = true;
  waitingScreen.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  gameOverScreen.classList.add('hidden');
});

socket.on('state', (state) => {
  currentState = state;

  if (state.state === 'ended' && gameStarted) {
    const winner = state.rockets.find(r => r.id === state.winner);
    if (state.winner === null) {
      winnerText.textContent = 'DRAW!';
    } else if (state.winner === playerId) {
      winnerText.textContent = 'YOU WIN!';
      winnerText.style.color = '#00ff88';
    } else {
      winnerText.textContent = winner ? `${winner.name} WINS!` : 'YOU LOSE!';
      winnerText.style.color = '#ff3366';
    }
    gameOverScreen.classList.remove('hidden');
  }

  updateHUD(state);
});

socket.on('playerLeft', () => {
  // Opponent left
});

socket.on('error', (data) => {
  alert(data.message);
});

// HUD update
function updateHUD(state) {
  const huds = [
    document.getElementById('player1-hud'),
    document.getElementById('player2-hud')
  ];

  state.rockets.forEach((rocket, i) => {
    if (huds[i]) {
      const nameEl = huds[i].querySelector('.player-name');
      const healthFill = huds[i].querySelector('.health-fill');
      nameEl.textContent = rocket.id === playerId ? `${rocket.name} (YOU)` : rocket.name;
      healthFill.style.width = `${rocket.health}%`;
    }
  });
}

// Rendering
function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!currentState) {
    requestAnimationFrame(render);
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const scale = Math.min(canvas.width, canvas.height) / (currentState.arenaRadius * 2.05);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);

  // Draw arena
  drawArena(currentState.arenaRadius);

  // Draw bullets
  currentState.bullets.forEach(bullet => {
    drawBullet(bullet);
  });

  // Draw rockets
  currentState.rockets.forEach(rocket => {
    drawRocket(rocket, rocket.id === playerId);
  });

  ctx.restore();

  requestAnimationFrame(render);
}

function drawArena(radius) {
  // Arena glow
  const gradient = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(1, 'rgba(255, 50, 100, 0.1)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Arena border
  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = -radius; i <= radius; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, -radius);
    ctx.lineTo(i, radius);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius, i);
    ctx.lineTo(radius, i);
    ctx.stroke();
  }
}

function drawRocket(rocket, isPlayer) {
  ctx.save();
  ctx.translate(rocket.x, rocket.y);
  ctx.rotate(rocket.angle);

  const colors = isPlayer ? {
    body: '#00d4ff',
    accent: '#0088aa',
    dark: '#004466',
    flame: '#00ffff'
  } : {
    body: '#ff6644',
    accent: '#aa4422',
    dark: '#662211',
    flame: '#ffaa00'
  };

  // Main thruster flame (when thrusting)
  if (rocket.thrusting) {
    drawMainThruster(colors.flame);
  }

  // Side thruster flames (when turning)
  if (rocket.turningLeft) {
    drawSideThruster(8, -12, Math.PI / 2, colors.flame);  // Right side, pushing left
    drawSideThruster(-10, 10, -Math.PI / 2, colors.flame); // Left rear, pushing right
  }
  if (rocket.turningRight) {
    drawSideThruster(8, 12, -Math.PI / 2, colors.flame);  // Left side, pushing right
    drawSideThruster(-10, -10, Math.PI / 2, colors.flame); // Right rear, pushing left
  }

  // Rocket body shadow
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();

  // Main body
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(20, 0);       // Nose
  ctx.lineTo(8, -7);       // Upper front
  ctx.lineTo(-8, -8);      // Upper back
  ctx.lineTo(-12, -6);     // Upper tail
  ctx.lineTo(-12, 6);      // Lower tail
  ctx.lineTo(-8, 8);       // Lower back
  ctx.lineTo(8, 7);        // Lower front
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#aaeeff';
  ctx.beginPath();
  ctx.ellipse(8, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(9, -1, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body stripe
  ctx.fillStyle = colors.accent;
  ctx.fillRect(-6, -3, 10, 6);

  // Top fin
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-14, -16);
  ctx.lineTo(-14, -8);
  ctx.closePath();
  ctx.fill();

  // Bottom fin
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.lineTo(-14, 16);
  ctx.lineTo(-14, 8);
  ctx.closePath();
  ctx.fill();

  // Engine nozzles
  ctx.fillStyle = '#333';
  ctx.fillRect(-14, -5, 4, 3);
  ctx.fillRect(-14, 2, 4, 3);

  // Side thruster housings
  ctx.fillStyle = '#444';
  ctx.fillRect(5, -10, 6, 3);
  ctx.fillRect(5, 7, 6, 3);
  ctx.fillRect(-12, -13, 4, 3);
  ctx.fillRect(-12, 10, 4, 3);

  // Nose highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, -2);
  ctx.lineTo(10, -5);
  ctx.stroke();

  ctx.restore();

  // Health bar above rocket
  if (rocket.health < 100) {
    drawHealthBar(rocket.x, rocket.y - 30, rocket.health);
  }

  // Name tag
  ctx.save();
  ctx.fillStyle = isPlayer ? '#00d4ff' : '#ff6644';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(rocket.name, rocket.x, rocket.y + 35);
  ctx.restore();
}

function drawMainThruster(color) {
  const flicker = 0.8 + Math.random() * 0.4;
  const length = 15 + Math.random() * 10;

  // Outer flame
  const gradient = ctx.createLinearGradient(-12, 0, -12 - length, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.8)');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-12, -4 * flicker);
  ctx.lineTo(-12 - length * flicker, 0);
  ctx.lineTo(-12, 4 * flicker);
  ctx.closePath();
  ctx.fill();

  // Inner flame
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-12, 2);
  ctx.closePath();
  ctx.fill();
}

function drawSideThruster(x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const flicker = 0.7 + Math.random() * 0.6;
  const length = 6 + Math.random() * 4;

  // Small flame
  const gradient = ctx.createLinearGradient(0, 0, 0, length);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.6, 'rgba(255, 200, 50, 0.6)');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-2 * flicker, 0);
  ctx.lineTo(0, length * flicker);
  ctx.lineTo(2 * flicker, 0);
  ctx.closePath();
  ctx.fill();

  // Bright core
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(0, 2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHealthBar(x, y, health) {
  const width = 40;
  const height = 4;

  ctx.fillStyle = '#333';
  ctx.fillRect(x - width / 2, y, width, height);

  const healthColor = health > 60 ? '#00ff88' : health > 30 ? '#ffaa00' : '#ff3366';
  ctx.fillStyle = healthColor;
  ctx.fillRect(x - width / 2, y, width * (health / 100), height);
}

function drawBullet(bullet) {
  // Bullet trail
  const trailLength = 8;
  const vx = bullet.vx || 0;
  const vy = bullet.vy || 0;
  const mag = Math.sqrt(vx * vx + vy * vy);

  if (mag > 0) {
    const nx = -vx / mag;
    const ny = -vy / mag;

    const gradient = ctx.createLinearGradient(
      bullet.x, bullet.y,
      bullet.x + nx * trailLength, bullet.y + ny * trailLength
    );
    gradient.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
    gradient.addColorStop(1, 'transparent');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x + nx * trailLength, bullet.y + ny * trailLength);
    ctx.stroke();
  }

  // Bullet glow
  ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Bullet core
  ctx.fillStyle = '#ffffaa';
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

// Start render loop
render();
