import type { Server as SocketIOServer, Socket } from 'socket.io';
import { createRoom, joinRoom } from './rooms';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function broadcastState(io: SocketIOServer, room: Room): void {
  io.to(roomChannel(room.code)).emit('room:state', room);
}

export function attachSocketHandlers(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        cb({ ok: true, sessionId, room });
        // No broadcast needed yet; the creator is the only one in the room.
      } catch (e) {
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

    // disconnect / leave / start / chat wired in later tasks.
  });
}
