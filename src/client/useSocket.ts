'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Card, RoomView, ResumeAck } from '@/shared/types';
import { useGameStore } from './store';
import { loadSession, saveSession, clearSession } from './session';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);
  const setHand = useGameStore((s) => s.setHand);
  const setSession = useGameStore((s) => s.setSession);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;

    function tryAutoResume() {
      const stored = loadSession();
      if (!stored) return;
      // Only resume if we're on /room/<CODE> matching the stored code.
      if (typeof window === 'undefined') return;
      const m = window.location.pathname.match(/\/room\/([A-Z]{4})/i);
      if (!m || m[1].toUpperCase() !== stored.code.toUpperCase()) return;

      socket.emit('session:resume', { sessionId: stored.sessionId, code: stored.code }, (res: ResumeAck) => {
        if (res.ok) {
          saveSession({ sessionId: res.sessionId, code: stored.code });
          setSession(res.sessionId);
          setRoom(res.room);
        } else {
          clearSession();
          if (res.error === 'REPLACED' && typeof window !== 'undefined') {
            window.location.replace('/bounced');
          }
        }
      });
    }

    const onConnect = () => { setConnected(true); tryAutoResume(); };
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: RoomView) => setRoom(room);
    const onHandUpdate = (payload: { hand: Card[] }) => setHand(payload.hand);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('hand:update', onHandUpdate);

    if (socket.connected) { setConnected(true); tryAutoResume(); }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('hand:update', onHandUpdate);
    };
  }, [setConnected, setRoom, setHand, setSession]);

  return ref.current!;
}
