'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/types';
import { useGameStore } from './store';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

/** Returns a stable singleton client socket. Connects on first call. */
export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: any) => setRoom(room);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
    };
  }, [setConnected, setRoom]);

  return ref.current!;
}
