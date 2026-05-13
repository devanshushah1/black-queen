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

describe('socket: disconnect', () => {
  it('marks the player as disconnected and broadcasts updated state', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise<void>((resolve) => {
      host.once('room:state', () => resolve());
      guest.emit('room:join', { code: created.room.code, name: 'Sam' }, () => {});
    });

    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    guest.disconnect();
    const updated = await hostStatePromise;
    const sam = updated.players.find((p) => p.name === 'Sam');
    expect(sam?.connected).toBe(false);
    host.disconnect();
  });
});

describe('socket: chat:send', () => {
  it('broadcasts chat to everyone in the room', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise<void>((resolve) => {
      host.once('room:state', () => resolve());
      guest.emit('room:join', { code: created.room.code, name: 'Sam' }, () => {});
    });

    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    guest.emit('chat:send', { text: 'hello' });
    const updated = await hostStatePromise;
    const last = updated.chat[updated.chat.length - 1];
    expect(last.text).toBe('hello');
    expect(last.authorName).toBe('Sam');

    host.disconnect();
    guest.disconnect();
  });
});

describe('socket: room:start', () => {
  it('lets the host start with 4 players; phase becomes bidding for everyone', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));

    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) =>
        client.emit('room:join', { code, name }, () => resolve())
      );
    }

    // Listen for the state update on all clients
    const statePromises = clients.map((c) => new Promise<Room>((resolve) => c.once('room:state', resolve)));

    const res: any = await new Promise((resolve) => host.emit('room:start', resolve));
    expect(res.ok).toBe(true);

    const states = await Promise.all(statePromises);
    for (const state of states) {
      expect(state.phase).toBe('bidding');
    }
    clients.forEach((c) => c.disconnect());
  });

  it('rejects a non-host with NOT_HOST', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise((resolve) => guest.emit('room:join', { code: created.room.code, name: 'Sam' }, resolve));
    const res: any = await new Promise((resolve) => guest.emit('room:start', resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NOT_HOST');
    host.disconnect();
    guest.disconnect();
  });

  it('rejects with NEED_FOUR when fewer than 4 players', async () => {
    const host = makeClient();
    await new Promise<void>((r) => host.on('connect', () => r()));
    await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const res: any = await new Promise((resolve) => host.emit('room:start', resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NEED_FOUR');
    host.disconnect();
  });
});
