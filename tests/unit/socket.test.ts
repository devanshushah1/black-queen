import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { attachSocketHandlers } from '@/server/socket';
import { _resetRoomsForTest } from '@/server/rooms';
import type { Card, ClientToServerEvents, ServerToClientEvents, Room } from '@/shared/types';

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

describe('socket: hand:update', () => {
  it('each client receives their own 13-card hand on game start', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;

    const handPromises = clients.map(
      (c) => new Promise<{ hand: Card[] }>((resolve) => c.once('hand:update', resolve))
    );

    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }

    await new Promise((resolve) => host.emit('room:start', resolve));

    const hands = await Promise.all(handPromises);
    for (const h of hands) {
      expect(h.hand).toHaveLength(13);
    }
    const allKeys = new Set(hands.flatMap((h) => h.hand.map((c) => `${c.rank}-${c.suit}`)));
    expect(allKeys.size).toBe(52);

    clients.forEach((c) => c.disconnect());
  });
});

describe('socket: bid:place + bid:pass', () => {
  it('a valid bid is accepted, broadcast in room:state, and ack returned', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }

    // Register listeners BEFORE emitting so we don't race the broadcast.
    const biddingPhasePromises = clients.map((c) => new Promise<void>((resolve) => {
      const handler = (state: any) => {
        if (state.phase === 'bidding') { c.off('room:state', handler); resolve(); }
      };
      c.on('room:state', handler);
    }));
    await new Promise((resolve) => host.emit('room:start', resolve));
    await Promise.all(biddingPhasePromises);

    const broadcastPromise = new Promise<any>((resolve) => host.once('room:state', resolve));
    const ack: any = await new Promise((resolve) => c2.emit('bid:place', { amount: 90 }, resolve));
    expect(ack.ok).toBe(true);

    const state = await broadcastPromise;
    expect(state.game.bid.currentBid).toBe(90);
    expect(state.game.bid.currentBidderSeat).toBe(2);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects an invalid bid amount with INVALID_AMOUNT', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }
    await new Promise((resolve) => host.emit('room:start', resolve));

    const ack: any = await new Promise((resolve) => c2.emit('bid:place', { amount: 73 }, resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('INVALID_AMOUNT');

    clients.forEach((c) => c.disconnect());
  });

  it('completes bidding when 3 non-bidders pass and broadcasts trump_partner phase', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }

    // Register the final-state listener BEFORE emitting any bid action so the
    // trump_partner broadcast can't slip past us.
    const finalState = new Promise<any>((resolve) => {
      const h = (s: any) => {
        if (s.phase === 'trump_partner') { host.off('room:state', h); resolve(s); }
      };
      host.on('room:state', h);
    });

    await new Promise((resolve) => host.emit('room:start', resolve));
    await new Promise((resolve) => host.emit('bid:place', { amount: 90 }, resolve));

    for (const c of [c2, c3, c4]) {
      await new Promise((resolve) => c.emit('bid:pass', resolve));
    }

    const state = await finalState;
    expect(state.phase).toBe('trump_partner');
    expect(state.game.bid.complete).toBe(true);
    expect(state.game.bid.currentBid).toBe(90);
    expect(state.game.bid.currentBidderSeat).toBe(1);

    clients.forEach((c) => c.disconnect());
  });
});

async function setupAndStart(makeClient: () => any, host: any, c2: any, c3: any, c4: any) {
  const handPromises = [host, c2, c3, c4].map((c) => new Promise<{ hand: any[] }>((resolve) => {
    c.once('hand:update', (p: any) => resolve(p));
  }));

  const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
  const code = created.room.code;
  for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
    await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
  }

  // Register the trump_partner-phase listener BEFORE any action that could
  // trigger that broadcast, otherwise we'll race the emit.
  const trumpPartnerPromises = [host, c2, c3, c4].map((c) => new Promise<void>((resolve) => {
    const h = (s: any) => { if (s.phase === 'trump_partner') { c.off('room:state', h); resolve(); } };
    c.on('room:state', h);
  }));

  await new Promise((resolve) => host.emit('room:start', resolve));
  const handPayloads = await Promise.all(handPromises);
  const hands: Record<number, any[]> = {};
  handPayloads.forEach((p, i) => { hands[i + 1] = p.hand; });

  // host (seat 1) bids 90; everyone passes -> bidding complete -> phase trump_partner
  await new Promise((resolve) => host.emit('bid:place', { amount: 90 }, resolve));
  for (const c of [c2, c3, c4]) {
    await new Promise((resolve) => c.emit('bid:pass', resolve));
  }
  await Promise.all(trumpPartnerPromises);

  return { code, hands };
}

describe('socket: trump:choose', () => {
  it('bidder picks trump + an opponent card; phase advances to play', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // Register state listeners on all clients BEFORE emitting
    const statePromises = clients.map((c) => new Promise<any>((resolve) => {
      const h = (s: any) => {
        if (s.phase === 'play' && s.game?.trumpPartner) { c.off('room:state', h); resolve(s); }
      };
      c.on('room:state', h);
    }));

    const target = hands[2][0]; // Seat 2's first card; not in host's hand
    const ack: any = await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: target }, resolve)
    );
    expect(ack.ok).toBe(true);

    const states = await Promise.all(statePromises);
    for (const state of states) {
      expect(state.phase).toBe('play');
      expect(state.game.trumpPartner.trump).toBe('spades');
      // partnerSeat must NOT leak
      expect('partnerSeat' in state.game).toBe(false);
    }

    clients.forEach((c) => c.disconnect());
  });

  it('rejects non-bidder with NOT_BIDDER', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // c2 (not the bidder) tries to choose
    const ack: any = await new Promise((resolve) =>
      c2.emit('trump:choose', { trump: 'spades', calledCard: hands[1][0] }, resolve)
    );
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('NOT_BIDDER');

    clients.forEach((c) => c.disconnect());
  });
});

describe('socket: card:play', () => {
  it('bidder plays first card; ledSuit set; trick has 1 play', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // Register phase=play listeners BEFORE trump:choose so we don't race the broadcast.
    const playPhasePromises = clients.map((c) => new Promise<void>((resolve) => {
      const h = (s: any) => { if (s.phase === 'play') { c.off('room:state', h); resolve(); } };
      c.on('room:state', h);
    }));

    // Trump choose first (bidder = seat 1)
    await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: hands[2][0] }, resolve)
    );
    await Promise.all(playPhasePromises);

    // Register listener BEFORE play
    const playState = new Promise<any>((resolve) => {
      const h = (s: any) => {
        if (s.game?.currentTrick && s.game.currentTrick.plays.length === 1) {
          c2.off('room:state', h);
          resolve(s);
        }
      };
      c2.on('room:state', h);
    });

    const firstCard = hands[1][0];
    const ack: any = await new Promise((resolve) => host.emit('card:play', { card: firstCard }, resolve));
    expect(ack.ok).toBe(true);

    const state = await playState;
    expect(state.game.currentTrick.plays).toHaveLength(1);
    expect(state.game.currentTrick.ledSuit).toBe(firstCard.suit);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects NOT_YOUR_TURN when non-leader tries to play first', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // Register phase=play listeners BEFORE trump:choose so we don't race the broadcast.
    const playPhasePromises = clients.map((c) => new Promise<void>((resolve) => {
      const h = (s: any) => { if (s.phase === 'play') { c.off('room:state', h); resolve(); } };
      c.on('room:state', h);
    }));

    await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: hands[2][0] }, resolve)
    );
    await Promise.all(playPhasePromises);

    const ack: any = await new Promise((resolve) => c2.emit('card:play', { card: hands[2][0] }, resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('NOT_YOUR_TURN');

    clients.forEach((c) => c.disconnect());
  });
});

describe('socket: room:play-again', () => {
  it('rejects non-host with NOT_HOST', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    await new Promise<void>((resolve) => c2.emit('room:join', { code, name: 'Sam' }, () => resolve()));

    const ack: any = await new Promise((resolve) => c2.emit('room:play-again', resolve));
    expect(ack.ok).toBe(false);
    expect(['NOT_HOST', 'NOT_IN_END']).toContain(ack.error);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects when not in end phase', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));
    await new Promise((resolve) => c.emit('room:create', { name: 'Dev' }, resolve));
    const ack: any = await new Promise((resolve) => c.emit('room:play-again', resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('NOT_IN_END');
    c.disconnect();
  });
});
