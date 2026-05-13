import type { RoomServerState, RoomView, PublicGameState } from '@/shared/types';

/**
 * Project a server-internal room into the wire format.
 *
 * Strips:
 * - `hands` (top-level server-only field)
 * - `game.partnerSeat` (server-only — public counterpart is `revealedPartnerSeat`)
 */
export function toRoomView(state: RoomServerState): RoomView {
  const { hands: _hands, game, ...rest } = state;
  if (game === null) {
    return { ...rest, game: null };
  }
  const { partnerSeat: _partnerSeat, ...publicGame } = game;
  return { ...rest, game: publicGame as PublicGameState };
}
