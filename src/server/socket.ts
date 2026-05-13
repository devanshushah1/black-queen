import type { Server as SocketIOServer, Socket } from 'socket.io';
import {
  createRoom,
  joinRoom,
  getRoom,
  setConnected,
  postChat,
  leaveRoom,
  startGame,
  placeBidInRoom,
  passBidInRoom,
  chooseTrumpPartnerInRoom,
  playCardInRoom,
  playAgainInRoom,
} from './rooms';
import { toRoomView } from './game/view';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomServerState,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type Srv = SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function broadcastState(io: Srv, room: RoomServerState): void {
  io.to(roomChannel(room.code)).emit('room:state', toRoomView(room));
}

function broadcastHands(io: Srv, room: RoomServerState): void {
  if (!room.hands) return;
  for (const player of room.players) {
    const hand = room.hands[player.seat];
    for (const [, socket] of io.sockets.sockets) {
      if (socket.data.sessionId === player.id) {
        socket.emit('hand:update', { hand });
      }
    }
  }
}

export function attachSocketHandlers(io: Srv): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        cb({ ok: true, sessionId, room: toRoomView(room) });
      } catch {
        cb({ ok: false, error: 'NAME_INVALID' });
      }
    });

    socket.on('room:join', ({ code, name }, cb) => {
      const res = joinRoom({ code, name });
      if (!res.ok) {
        cb(res);
        return;
      }
      socket.data.sessionId = res.sessionId;
      socket.data.roomCode = code;
      socket.join(roomChannel(code));
      const stored = getRoom(code);
      if (stored) broadcastState(io, stored);
      cb({ ok: true, sessionId: res.sessionId, room: stored ? toRoomView(stored) : res.room });
    });

    socket.on('chat:send', ({ text }) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = postChat({ code: roomCode, sessionId, text });
      if (res.ok) broadcastState(io, res.room);
    });

    socket.on('room:leave', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = leaveRoom({ code: roomCode, sessionId });
      socket.leave(roomChannel(roomCode));
      socket.data.sessionId = undefined;
      socket.data.roomCode = undefined;
      if (res.ok && !res.wasLastPlayer && res.room) broadcastState(io, res.room);
    });

    socket.on('room:start', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) {
        cb({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const res = startGame({ code: roomCode, sessionId });
      if (!res.ok) {
        cb({ ok: false, error: res.error });
        return;
      }
      cb({ ok: true });
      broadcastHands(io, res.room);
      broadcastState(io, res.room);
    });

    socket.on('bid:place', ({ amount }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }

      const res = placeBidInRoom({ code: roomCode, seat: player.seat, amount });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('bid:pass', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }

      const res = passBidInRoom({ code: roomCode, seat: player.seat });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('trump:choose', ({ trump, calledCard }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = chooseTrumpPartnerInRoom({ code: roomCode, seat: player.seat, trump, calledCard });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('card:play', ({ card }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = playCardInRoom({ code: roomCode, seat: player.seat, card });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      // Re-broadcast hands too — the player's hand just lost a card.
      broadcastHands(io, res.room);
      broadcastState(io, res.room);
    });

    socket.on('room:play-again', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = playAgainInRoom({ code: roomCode, sessionId });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('disconnect', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      setConnected({ code: roomCode, sessionId, connected: false });
      const room = getRoom(roomCode);
      if (room) broadcastState(io, room);
    });
  });
}
