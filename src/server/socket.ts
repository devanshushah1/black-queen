import type { Server as SocketIOServer, Socket } from 'socket.io';
import { createRoom, joinRoom, getRoom, setConnected, postChat, leaveRoom } from './rooms';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type Srv = SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function broadcastState(io: Srv, room: Room): void {
  io.to(roomChannel(room.code)).emit('room:state', room);
}

export function attachSocketHandlers(io: Srv): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        cb({ ok: true, sessionId, room });
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
      cb(res);
      broadcastState(io, res.room);
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

    socket.on('disconnect', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      setConnected({ code: roomCode, sessionId, connected: false });
      const room = getRoom(roomCode);
      if (room) broadcastState(io, room);
    });
  });
}
