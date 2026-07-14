const { v4: uuidv4 } = require('uuid');

const ROOM_MAX_PLAYERS = 3;
const ROLES = ['mudo', 'sordo', 'ciego'];
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = generateRoomCode();
  const room = {
    code,
    players: [],
    hostId: null,
    gameState: null,
    createdAt: Date.now()
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: 'Sala no encontrada. Verifica el código.' };
  if (room.players.length >= ROOM_MAX_PLAYERS) return { error: 'La sala está llena (3/3).' };
  if (room.players.some(p => p.id === playerId)) return { error: 'Ya estás en esta sala.' };
  if (room.gameState) return { error: 'La partida ya comenzó.' };

  const player = { id: playerId, name: playerName, role: null, ready: false };
  room.players.push(player);

  if (!room.hostId) room.hostId = playerId;

  if (room.players.length === ROOM_MAX_PLAYERS) {
    assignRoles(room);
  }

  return { success: true, room };
}

function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== playerId);

  if (room.hostId === playerId) {
    room.hostId = room.players[0]?.id || null;
  }

  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }

  if (room.players.length < ROOM_MAX_PLAYERS) {
    room.players.forEach(p => { p.role = null; });
  }

  return room;
}

function assignRoles(room) {
  const shuffled = [...ROLES].sort(() => Math.random() - 0.5);
  room.players.forEach((player, i) => {
    player.role = shuffled[i];
  });
}

function getRoom(code) {
  return rooms.get(code);
}

function getPlayerRoom(playerId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === playerId)) {
      return room;
    }
  }
  return null;
}

function cleanupOldRooms(maxAgeMs = 3600000) {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > maxAgeMs) {
      rooms.delete(code);
    }
  }
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  assignRoles,
  getRoom,
  getPlayerRoom,
  cleanupOldRooms,
  ROOM_MAX_PLAYERS,
  ROLES
};
