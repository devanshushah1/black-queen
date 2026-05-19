'use client';
import type { RoomView, Player, Seat, Suit } from '@/shared/types';
import { computeResults } from '@/shared/results';
import { Verdict } from '@/components/end/Verdict';
import { TeamCard } from '@/components/end/TeamCard';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { MuteToggle } from '@/components/MuteToggle';

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
      <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col items-center justify-center gap-4 select-none font-sans text-white">
        {/* Background ambient lighting */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

        <MuteToggle />
        <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gold-600 via-gold-500 to-gold-600 shadow-glass-gold animate-pulse-slow z-20">
          <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
          <svg className="w-8 h-8 text-black filter drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16L3 5l5 5 4-7 4 7 5-5-2 11H5zm14 2H5v2h14v-2z"/>
          </svg>
        </div>
        <div className="text-lg font-bold text-neutral-300 z-20 tracking-wide">Game complete — preparing results…</div>
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
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between font-sans text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />
      <div className="max-w-4xl mx-auto w-full z-20 mt-4 flex-1">
        <Verdict youWon={youWon} summary={summary} />

        <div className="bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-center text-xs text-neutral-300 mb-6 shadow-glass relative">
          <div className="absolute inset-1.5 border border-white/[0.02] rounded-xl pointer-events-none" />
          <span className="relative z-10">
            Trump was <span className="text-gold-400 font-extrabold flex inline-flex items-center gap-1 mx-1">{SUIT_GLYPH[results.trump]} <span className="uppercase text-[10px]">{results.trump}</span></span>
            {' · '}Bidder called{' '}
            <span className="text-pink-300 font-extrabold font-serif bg-pink-950/20 px-2 py-0.5 rounded border border-pink-500/10 mx-1">{results.calledCard.rank}{SUIT_GLYPH[results.calledCard.suit]}</span>
            {' · '}Partner revealed: <strong className="text-white font-extrabold mx-1">{seatNameFor(room.players, results.partnerSeat)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

        <div className="flex justify-center items-center gap-4 mt-2">
          {isHost ? (
            <button
              type="button"
              onClick={onPlayAgain}
              className="bg-gradient-to-r from-gold-600 via-gold-500 to-gold-600 hover:from-gold-500 hover:to-gold-400 active:scale-[0.98] text-black font-extrabold rounded-xl px-8 py-3 text-sm shadow-lg tracking-wider transition-all duration-300"
            >
              Play again — same seats
            </button>
          ) : (
            <div className="text-xs italic text-neutral-400 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
              Waiting for {seatNameFor(room.players, room.players.find(p => p.id === room.hostId)?.seat ?? null)} (host) to start the next hand…
            </div>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="bg-transparent hover:bg-red-500/[0.05] border border-white/20 hover:border-red-500 text-neutral-300 hover:text-red-400 font-bold rounded-xl px-6 py-3 text-sm tracking-wider transition-all duration-300"
          >
            Leave room
          </button>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-40 select-none">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
