'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Card, RoomView } from '@/shared/types';
import { useGameStore } from './store';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);
  const setHand = useGameStore((s) => s.setHand);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: RoomView) => setRoom(room);
    const onHandUpdate = (payload: { hand: Card[] }) => setHand(payload.hand);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('hand:update', onHandUpdate);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('hand:update', onHandUpdate);
    };
  }, [setConnected, setRoom, setHand]);

  return ref.current!;
}
