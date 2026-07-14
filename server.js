const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const {
  createRoom,
  joinRoom,
  leaveRoom,
  assignRoles,
  getRoom,
  getPlayerRoom,
  cleanupOldRooms,
  ROOM_MAX_PLAYERS,
  ROLES
} = require('./rooms');

const {
  createGame,
  handleVisualSignal,
  handleSurgeonClick,
  getGameState,
  getBlindGameState,
  getAvailableSignals,
  generateZoneGrid
} = require('./gameLogic');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Cirugía Clandestina - Backend',
    version: '1.0.0',
    rooms: io.sockets.adapter.rooms.size,
    totalConnections: io.engine.clientsCount
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

const socketPlayerMap = new Map();

function getPlayerId(socketId) {
  return socketPlayerMap.get(socketId);
}

io.on('connection', (socket) => {
  const playerId = uuidv4().slice(0, 8);
  socketPlayerMap.set(socket.id, playerId);

  socket.emit('connected', { playerId });

  socket.on('create_room', (data, callback) => {
    const room = createRoom();
    const playerName = data?.name || `Jugador ${playerId.slice(0, 4)}`;
    const result = joinRoom(room.code, playerId, playerName);

    if (result.error) {
      if (callback) callback({ error: result.error });
      return;
    }

    socket.join(room.code);
    callback({ success: true, roomCode: room.code, playerId, players: sanitizePlayers(room.players) });
    socket.emit('room_joined', {
      roomCode: room.code,
      players: sanitizePlayers(room.players),
      hostId: room.hostId,
      isHost: room.hostId === playerId
    });
  });

  socket.on('join_room', (data, callback) => {
    const { code, name } = data || {};
    if (!code) {
      if (callback) callback({ error: 'Código de sala requerido.' });
      return;
    }

    const roomCode = code.toUpperCase().trim();
    const playerName = name || `Jugador ${playerId.slice(0, 4)}`;
    const result = joinRoom(roomCode, playerId, playerName);

    if (result.error) {
      if (callback) callback({ error: result.error });
      return;
    }

    socket.join(roomCode);

    const room = getRoom(roomCode);
    callback({
      success: true,
      roomCode,
      playerId,
      players: sanitizePlayers(room.players),
      hostId: room.hostId,
      isHost: room.hostId === playerId
    });

    io.to(roomCode).emit('player_joined', {
      players: sanitizePlayers(room.players),
      hostId: room.hostId
    });

    if (room.players.length === ROOM_MAX_PLAYERS) {
      io.to(roomCode).emit('roles_assigned', {
        players: sanitizePlayers(room.players)
      });
      io.to(roomCode).emit('game_ready', {
        message: '¡Sala completa! Todos listos para comenzar.'
      });
    }
  });

  socket.on('player_ready', (data) => {
    const room = getPlayerRoom(playerId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    player.ready = data?.ready ?? !player.ready;
    io.to(room.code).emit('player_ready', {
      playerId,
      ready: player.ready,
      players: sanitizePlayers(room.players)
    });
  });

  socket.on('start_game', (_, callback) => {
    const room = getPlayerRoom(playerId);
    if (!room) {
      if (callback) callback({ error: 'No estás en una sala.' });
      return;
    }

    if (room.hostId !== playerId) {
      if (callback) callback({ error: 'Solo el anfitrión puede iniciar la partida.' });
      return;
    }

    if (room.players.length < ROOM_MAX_PLAYERS) {
      if (callback) callback({ error: `Se necesitan ${ROOM_MAX_PLAYERS} jugadores.` });
      return;
    }

    if (room.gameState) {
      if (callback) callback({ error: 'La partida ya comenzó.' });
      return;
    }

    room.gameState = createGame(room.code);
    if (!room.gameState) {
      if (callback) callback({ error: 'Error al crear la partida.' });
      return;
    }

    room.players.forEach(player => {
      const playerSocket = [...io.sockets.sockets.values()]
        .find(s => getPlayerId(s.id) === player.id);
      if (!playerSocket) return;

      if (player.role === 'ciego') {
        playerSocket.emit('game_started', {
          role: player.role,
          gameState: getBlindGameState(room.gameState),
          zoneGrid: generateZoneGrid(),
          availableSignals: getAvailableSignals()
        });
      } else {
        playerSocket.emit('game_started', {
          role: player.role,
          gameState: getGameState(room.gameState),
          availableSignals: getAvailableSignals()
        });
      }
    });

    io.to(room.code).emit('game_broadcast', {
      message: '¡La partida ha comenzado!',
      players: sanitizePlayers(room.players)
    });

    if (callback) callback({ success: true });
  });

  socket.on('visual_signal', (data, callback) => {
    const room = getPlayerRoom(playerId);
    if (!room || !room.gameState) {
      if (callback) callback({ error: 'No hay partida activa.' });
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const result = handleVisualSignal(room.gameState, playerId, data, player.role);
    if (result.error) {
      if (callback) callback(result);
      return;
    }

    socket.to(room.code).emit('visual_signal', result.signal);
    if (callback) callback(result);
  });

  socket.on('surgeon_click', (data, callback) => {
    const room = getPlayerRoom(playerId);
    if (!room || !room.gameState) {
      if (callback) callback({ error: 'No hay partida activa.' });
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const result = handleSurgeonClick(room.gameState, playerId, data?.zone, player.role);

    broadcastGameState(room);

    if (callback) callback(result);
  });

  socket.on('request_state', () => {
    const room = getPlayerRoom(playerId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    if (room.gameState) {
      const state = player.role === 'ciego'
        ? getBlindGameState(room.gameState)
        : getGameState(room.gameState);
      socket.emit('state_update', state);
    }
  });

  socket.on('chat_message', (data, callback) => {
    const room = getPlayerRoom(playerId);
    if (!room) {
      if (callback) callback({ error: 'No estás en una sala.' });
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    if (player.role === 'mudo') {
      if (callback) callback({ error: 'El Mudo no puede enviar mensajes de chat.' });
      return;
    }

    const message = {
      playerId,
      playerName: player.name,
      role: player.role,
      text: data?.text?.substring(0, 200),
      timestamp: Date.now()
    };

    if (player.role === 'ciego') {
      io.to(room.code).emit('chat_message', message);
    } else {
      socket.to(room.code).emit('chat_message', message);
    }

    if (callback) callback({ success: true });
  });

  socket.on('leave_room', () => {
    handlePlayerDisconnect(socket);
  });

  socket.on('disconnect', () => {
    handlePlayerDisconnect(socket);
    socketPlayerMap.delete(socket.id);
  });
});

function handlePlayerDisconnect(socket) {
  const playerId = getPlayerId(socket.id);
  if (!playerId) return;

  const room = getPlayerRoom(playerId);
  if (!room) return;

  const wasHost = room.hostId === playerId;
  const updatedRoom = leaveRoom(room.code, playerId);

  if (!updatedRoom) {
    io.to(room.code).emit('room_closed', { message: 'La sala se ha cerrado.' });
    io.socketsLeave(room.code);
    return;
  }

  socket.leave(room.code);

  io.to(room.code).emit('player_left', {
    playerId,
    wasHost,
    players: sanitizePlayers(updatedRoom.players),
    hostId: updatedRoom.hostId,
    message: wasHost
      ? 'El anfitrión abandonó la sala. Nuevo anfitrión asignado.'
      : 'Un jugador abandonó la sala.'
  });

  if (room.gameState) {
    room.gameState = null;
    io.to(room.code).emit('game_cancelled', {
      message: 'La partida fue cancelada porque un jugador se desconectó.'
    });
  }
}

function broadcastGameState(room) {
  if (!room.gameState) return;

  room.players.forEach(player => {
    const playerSocket = [...io.sockets.sockets.values()]
      .find(s => getPlayerId(s.id) === player.id);
    if (!playerSocket) return;

    const state = player.role === 'ciego'
      ? getBlindGameState(room.gameState)
      : getGameState(room.gameState);

    playerSocket.emit('state_update', state);
  });

  if (room.gameState.gameOver) {
    io.to(room.code).emit('game_over', {
      won: room.gameState.won,
      score: room.gameState.score,
      errors: room.gameState.errors,
      elapsedTime: room.gameState.elapsedTime,
      message: room.gameState.won
        ? '¡Intervención exitosa! El paciente se ha salvado.'
        : 'El paciente no sobrevivió. ¡Inténtenlo de nuevo!'
    });
  }
}

function sanitizePlayers(players) {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    ready: p.ready
  }));
}

setInterval(() => cleanupOldRooms(), 600000);

server.listen(PORT, () => {
  console.log(`🏥 Cirugía Clandestina - Backend corriendo en puerto ${PORT}`);
  console.log(`   Servidor: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
});
