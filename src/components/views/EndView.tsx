'use client';
import type { RoomView, Player, Seat, Suit } from '@/shared/types';
import { computeResults } from '@/shared/results';
import { Verdict } from '@/components/end/Verdict';
import { TeamCard } from '@/components/end/TeamCard';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

interface Props {
  room: RoomView;
  me: Player;
  sessionId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
}

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export function EndView({ room, me, sessionId, onPlayAgain, onLeave, onSendChat }: Props) {
  const results = room.game ? computeResults(room.game) : null;
  if (!results) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
        <div className="text-gold-500 text-5xl font-serif">♛</div>
        <div className="text-lg text-neutral-300">Game complete — preparing results…</div>
      </main>
    );
  }

  const isHost = room.hostId === sessionId;
  const onBidderTeam = me.seat === results.bidderSeat || me.seat === results.partnerSeat;
  const youWon = onBidderTeam ? results.bidderTeamWon : !results.bidderTeamWon;

  const summary = results.bidderTeamWon
    ? `Bidder team needed ${results.bidAmount} · captured ${results.bidderTeamPoints} · bid made`
    : `Bidder team needed ${results.bidAmount} · captured only ${results.bidderTeamPoints} · bid failed`;

  const seatMember = (seat: Seat, role: 'bidder' | 'partner' | 'opponent') => ({
    seat,
    name: seatNameFor(room.players, seat),
    role,
    isYou: seat === me.seat,
  });

  const bidderTeam = [
    seatMember(results.bidderSeat, 'bidder'),
    seatMember(results.partnerSeat, 'partner'),
  ];
  const otherSeats = ([1, 2, 3, 4] as Seat[]).filter((s) => s !== results.bidderSeat && s !== results.partnerSeat);
  const otherTeam = otherSeats.map((s) => seatMember(s, 'opponent'));

  const bidderCaptured = [
    ...results.capturedBySeat[results.bidderSeat],
    ...results.capturedBySeat[results.partnerSeat],
  ];
  const otherCaptured = otherSeats.flatMap((s) => results.capturedBySeat[s]);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Verdict youWon={youWon} summary={summary} />

        <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-center text-xs text-neutral-300 mb-4">
          Trump was <span className="text-gold-500 font-bold">{SUIT_GLYPH[results.trump]}</span>
          {' · '}Bidder called{' '}
          <span className="text-pink-300 font-bold font-serif">{results.calledCard.rank}{SUIT_GLYPH[results.calledCard.suit]}</span>
          {' · '}Partner revealed: <b className="text-white">{seatNameFor(room.players, results.partnerSeat)}</b>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <TeamCard
            title="Bidder team"
            won={results.bidderTeamWon}
            points={results.bidderTeamPoints}
            totalNeeded={results.bidderTeamWon ? undefined : results.bidAmount}
            members={bidderTeam}
            capturedCards={bidderCaptured}
          />
          <TeamCard
            title="Other team"
            won={!results.bidderTeamWon}
            points={results.otherTeamPoints}
            members={otherTeam}
            capturedCards={otherCaptured}
          />
        </div>

        <div className="flex justify-center items-center gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={onPlayAgain}
              className="bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg px-6 py-2.5 text-sm"
            >
              Play again — same seats
            </button>
          ) : (
            <div className="text-xs italic text-neutral-400">Waiting for {seatNameFor(room.players, room.players.find(p => p.id === room.hostId)?.seat ?? null)} (host) to start the next hand…</div>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="border border-white/20 hover:border-red-400 hover:text-red-400 text-neutral-300 rounded-lg px-5 py-2.5 text-sm"
          >
            Leave room
          </button>
        </div>
      </div>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
