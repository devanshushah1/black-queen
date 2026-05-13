import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { attachSocketHandlers } from '@/server/socket';
import { _resetRoomsForTest } from '@/server/rooms';
import type { ClientToServerEvents, ServerToClientEvents, Room } from '@/shared/types';

let httpServer: HttpServer;
let io: SocketIOServer;
let port: number;

function makeClient(): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  return ioClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
}

beforeAll(async () => {
  httpServer = createServer();
  io = new SocketIOServer(httpServer);
  attachSocketHandlers(io);
  await new Promise<void>((r) => httpServer.listen(0, () => r()));
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  port = addr.port;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((r) => httpServer.close(() => r()));
});

beforeEach(() => _resetRoomsForTest());

describe('socket: room:create', () => {
  it('creates a room and returns the room + sessionId', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));

    const res = await new Promise<any>((resolve) => {
      c.emit('room:create', { name: 'Dev' }, (r) => resolve(r));
    });

    expect(res.ok).toBe(true);
    expect(res.sessionId).toBeTruthy();
    expect(res.room.players[0].name).toBe('Dev');
    c.disconnect();
  });

  it('rejects empty name', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));

    const res = await new Promise<any>((resolve) => {
      c.emit('room:create', { name: '' }, (r) => resolve(r));
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('NAME_INVALID');
    c.disconnect();
  });
});

describe('socket: room:join', () => {
  it('lets a second client join a created room and both receive the updated state', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);

    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;

    // Both clients should receive a room:state when guest joins.
    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    const guestStatePromise = new Promise<Room>((resolve) => guest.once('room:state', resolve));

    const joined: any = await new Promise((resolve) => guest.emit('room:join', { code, name: 'Sam' }, resolve));
    expect(joined.ok).toBe(true);

    const [hostState, guestState] = await Promise.all([hostStatePromise, guestStatePromise]);
    expect(hostState.players.map((p: any) => p.name)).toEqual(['Dev', 'Sam']);
    expect(guestState.players.map((p: any) => p.name)).toEqual(['Dev', 'Sam']);

    host.disconnect();
    guest.disconnect();
  });

  it('rejects join when code is unknown', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));
    const res: any = await new Promise((resolve) => c.emit('room:join', { code: 'ZZZZ', name: 'Sam' }, resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NOT_FOUND');
    c.disconnect();
  });

  it('rejects duplicate name', async () => {
    const c1 = makeClient();
    const c2 = makeClient();
    await Promise.all([
      new Promise<void>((r) => c1.on('connect', () => r())),
      new Promise<void>((r) => c2.on('connect', () => r())),
    ]);

    const created: any = await new Promise((resolve) => c1.emit('room:create', { name: 'Dev' }, resolve));
    const res: any = await new Promise((resolve) => c2.emit('room:join', { code: created.room.code, name: 'dev' }, resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NAME_TAKEN');

    c1.disconnect();
    c2.disconnect();
  });
});
