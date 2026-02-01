const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GameRoom } = require('./lib/GameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TICK_RATE = 60;

// Serve static files
app.use(express.static('public'));

// Game rooms
const rooms = new Map();
const playerRooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new GameRoom(roomId));
    console.log(`Room created: ${roomId}`);
  }
  return rooms.get(roomId);
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join', ({ roomId, playerName }) => {
    const room = getOrCreateRoom(roomId);

    if (room.rockets.size >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    if (room.addPlayer(socket.id, playerName || 'Player')) {
      socket.join(roomId);
      playerRooms.set(socket.id, roomId);

      socket.emit('joined', {
        playerId: socket.id,
        roomId: roomId
      });

      console.log(`${playerName} joined room: ${roomId}`);

      if (room.state === 'playing') {
        io.to(roomId).emit('gameStart');
      }
    }
  });

  socket.on('input', (input) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.setInput(socket.id, input);
    }
  });

  socket.on('practice', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.state === 'waiting' && room.rockets.size === 1) {
      room.addBot();
      socket.emit('gameStart');
      console.log(`Practice mode started in room: ${roomId}`);
    }
  });

  socket.on('spectate', () => {
    const roomId = 'spectate_' + socket.id;
    const room = getOrCreateRoom(roomId);

    socket.join(roomId);
    playerRooms.set(socket.id, roomId);

    room.addTwoBots();

    socket.emit('spectateStart', { playerId: socket.id, roomId });
    console.log(`Spectate mode started in room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.removePlayer(socket.id);
        io.to(roomId).emit('playerLeft', { playerId: socket.id });

        // Clean up empty rooms
        if (room.rockets.size === 0) {
          rooms.delete(roomId);
          console.log(`Room deleted: ${roomId}`);
        }
      }
      playerRooms.delete(socket.id);
    }
    console.log(`Player disconnected: ${socket.id}`);
  });

  socket.on('restart', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const oldRoom = rooms.get(roomId);
    if (oldRoom && oldRoom.state === 'ended') {
      // Create fresh room
      const newRoom = new GameRoom(roomId);
      rooms.set(roomId, newRoom);

      // Check if this is a spectate room (bot vs bot)
      if (roomId.startsWith('spectate_')) {
        newRoom.addTwoBots();
        socket.emit('spectateStart', { playerId: socket.id, roomId });
      } else {
        // Regular room - add human players back
        const players = [...oldRoom.rockets.values()].filter(p => !p.isBot);

        for (const player of players) {
          newRoom.addPlayer(player.id, player.name);
        }

        // If there was a bot, add it back
        if (oldRoom.bots.length > 0) {
          newRoom.addBot();
        }

        if (newRoom.state === 'playing') {
          io.to(roomId).emit('gameStart');
        }
      }
    }
  });
});

// Game loop
setInterval(() => {
  for (const [roomId, room] of rooms) {
    if (room.state === 'playing' || room.state === 'ended') {
      room.update();
      io.to(roomId).emit('state', room.serialize());
    } else if (room.state === 'waiting') {
      io.to(roomId).emit('waiting', {
        players: room.rockets.size,
        needed: 2
      });
    }
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Orbital Void server running on http://localhost:${PORT}`);
});
