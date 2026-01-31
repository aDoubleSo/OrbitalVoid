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
    body: '#e8e8e8',
    wing: '#00d4ff',
    dark: '#888888',
    cockpit: '#1a1a2e',
    flame: '#00ffff',
    accent: '#0088aa'
  } : {
    body: '#e8e8e8',
    wing: '#ff6644',
    dark: '#888888',
    cockpit: '#1a1a2e',
    flame: '#ffaa00',
    accent: '#aa4422'
  };

  // Main thruster flames (when thrusting)
  if (rocket.thrusting) {
    drawShuttleThruster(-18, -4, colors.flame);
    drawShuttleThruster(-18, 0, colors.flame);
    drawShuttleThruster(-18, 4, colors.flame);
  }

  // Side thruster flames (RCS - when turning)
  if (rocket.turningLeft) {
    drawSideThruster(12, -6, Math.PI / 2, colors.flame);
    drawSideThruster(-14, 8, -Math.PI / 2, colors.flame);
  }
  if (rocket.turningRight) {
    drawSideThruster(12, 6, -Math.PI / 2, colors.flame);
    drawSideThruster(-14, -8, Math.PI / 2, colors.flame);
  }

  // Delta wings (underneath)
  ctx.fillStyle = colors.wing;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-20, -22);
  ctx.lineTo(-16, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-20, 22);
  ctx.lineTo(-16, 6);
  ctx.closePath();
  ctx.fill();

  // Wing stripes
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(-2, -7);
  ctx.lineTo(-16, -18);
  ctx.lineTo(-14, -7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 7);
  ctx.lineTo(-16, 18);
  ctx.lineTo(-14, 7);
  ctx.closePath();
  ctx.fill();

  // Main fuselage shadow
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.quadraticCurveTo(20, -5, 14, -6);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-16, 6);
  ctx.lineTo(14, 6);
  ctx.quadraticCurveTo(20, 5, 22, 0);
  ctx.closePath();
  ctx.fill();

  // Main fuselage (white body like real shuttle)
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.quadraticCurveTo(18, -4, 12, -5);
  ctx.lineTo(-14, -5);
  ctx.lineTo(-16, 0);
  ctx.lineTo(-14, 5);
  ctx.lineTo(12, 5);
  ctx.quadraticCurveTo(18, 4, 20, 0);
  ctx.closePath();
  ctx.fill();

  // Cargo bay doors (lines on top)
  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(-10, -4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 4);
  ctx.lineTo(-10, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-2, 4);
  ctx.stroke();

  // Cockpit windows
  ctx.fillStyle = colors.cockpit;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.quadraticCurveTo(16, -3, 10, -4);
  ctx.lineTo(10, 4);
  ctx.quadraticCurveTo(16, 3, 18, 0);
  ctx.closePath();
  ctx.fill();

  // Window shine
  ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(16, -1);
  ctx.quadraticCurveTo(14, -2, 12, -2.5);
  ctx.lineTo(12, -1);
  ctx.quadraticCurveTo(14, -0.5, 16, -1);
  ctx.closePath();
  ctx.fill();

  // Vertical tail fin (top-down shows as rectangle)
  ctx.fillStyle = colors.wing;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-18, -2);
  ctx.lineTo(-12, -2);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();

  // OMS pods (orbital maneuvering system - bumps at rear)
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(-14, -6, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-14, 6, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine bells
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-17, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-17, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-17, 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // RCS thruster pods
  ctx.fillStyle = '#444';
  ctx.fillRect(10, -8, 4, 3);
  ctx.fillRect(10, 5, 4, 3);
  ctx.fillRect(-16, -10, 3, 3);
  ctx.fillRect(-16, 7, 3, 3);

  // Nose highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, -1);
  ctx.quadraticCurveTo(15, -3, 10, -4);
  ctx.stroke();

  ctx.restore();

  // Health bar above shuttle
  if (rocket.health < 100) {
    drawHealthBar(rocket.x, rocket.y - 35, rocket.health);
  }

  // Name tag
  ctx.save();
  ctx.fillStyle = isPlayer ? '#00d4ff' : '#ff6644';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(rocket.name, rocket.x, rocket.y + 40);
  ctx.restore();
}

function drawShuttleThruster(x, y, color) {
  const flicker = 0.8 + Math.random() * 0.4;
  const length = 12 + Math.random() * 8;

  // Outer flame
  const gradient = ctx.createLinearGradient(x, y, x - length, y);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, 'rgba(255, 200, 50, 0.9)');
  gradient.addColorStop(0.7, 'rgba(255, 100, 50, 0.6)');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y - 2 * flicker);
  ctx.lineTo(x - length * flicker, y);
  ctx.lineTo(x, y + 2 * flicker);
  ctx.closePath();
  ctx.fill();

  // Inner bright core
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(x - 2, y, 1.5, 0, Math.PI * 2);
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
