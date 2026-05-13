import type { RoomServerState, RoomView } from '@/shared/types';

/** Strip server-only fields from a Room. Safe to broadcast over a socket. */
export function toRoomView(state: RoomServerState): RoomView {
  const { hands: _hands, ...view } = state;
  return view;
}
