import type { PublicGameState, Card, Seat, Suit } from './types';
import { pointValue } from './types';

export interface ResultsData {
  bidderSeat: Seat;
  partnerSeat: Seat;
  bidAmount: number;
  trump: Suit;
  calledCard: Card;
  pointsBySeat: Record<Seat, number>;
  capturedBySeat: Record<Seat, Card[]>;
  bidderTeamPoints: number;
  otherTeamPoints: number;
  bidderTeamWon: boolean;
}

/**
 * Compute end-of-game results from a public game state.
 * Returns null if the game is not yet in a complete state.
 */
export function computeResults(game: PublicGameState): ResultsData | null {
  if (!game.trumpPartner) return null;
  if (game.bid.currentBidderSeat === null || game.bid.currentBid === null) return null;
  if (game.revealedPartnerSeat === null) return null;

  const bidderSeat = game.bid.currentBidderSeat;
  const partnerSeat = game.revealedPartnerSeat;
  const bidAmount = game.bid.currentBid;
  const trump = game.trumpPartner.trump;
  const calledCard = game.trumpPartner.calledCard;

  const pointsBySeat: Record<Seat, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const capturedBySeat: Record<Seat, Card[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const trick of game.completedTricks) {
    for (const { card } of trick.plays) {
      capturedBySeat[trick.winnerSeat].push(card);
      pointsBySeat[trick.winnerSeat] += pointValue(card);
    }
  }

  const bidderTeamPoints = pointsBySeat[bidderSeat] + pointsBySeat[partnerSeat];
  const otherSeats = ([1, 2, 3, 4] as Seat[]).filter((s) => s !== bidderSeat && s !== partnerSeat);
  const otherTeamPoints = otherSeats.reduce((sum, s) => sum + pointsBySeat[s], 0);
  const bidderTeamWon = bidderTeamPoints >= bidAmount;

  return {
    bidderSeat,
    partnerSeat,
    bidAmount,
    trump,
    calledCard,
    pointsBySeat,
    capturedBySeat,
    bidderTeamPoints,
    otherTeamPoints,
    bidderTeamWon,
  };
}
