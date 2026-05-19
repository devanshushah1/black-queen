'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomView, Player, Seat, Suit, Card } from '@/shared/types';
import { computeResults } from '@/shared/results';
import { Verdict } from '@/components/end/Verdict';
import { TeamCard } from '@/components/end/TeamCard';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { MuteToggle } from '@/components/MuteToggle';
import { pointValue } from '@/shared/types';

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
  const [showLedger, setShowLedger] = useState(false);
  
  const results = room.game ? computeResults(room.game) : null;

  if (!results) {
    return (
      <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col items-center justify-center gap-4 select-none font-sans text-white">
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

  // Find who played and captured the Black Queen (Queen of Spades)
  let qosPlayedBy: string | null = null;
  let qosCapturedBy: string | null = null;
  if (room.game) {
    for (const trick of room.game.completedTricks) {
      const qosPlay = trick.plays.find((p) => p.card.suit === 'spades' && p.card.rank === 'Q');
      if (qosPlay) {
        qosPlayedBy = seatNameFor(room.players, qosPlay.seat);
        qosCapturedBy = seatNameFor(room.players, trick.winnerSeat);
        break;
      }
    }
  }

  return (
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between font-sans text-white select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />

      <div className="max-w-4xl mx-auto w-full z-20 mt-4 flex-1">
        {/* Cinematic Header Verdict */}
        <Verdict youWon={youWon} summary={summary} />

        {/* Speakeasy Game Specs Plaque */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3.5 text-center text-xs text-neutral-300 mb-6 shadow-glass relative"
        >
          <div className="absolute inset-1.5 border border-white/[0.02] rounded-xl pointer-events-none" />
          <span className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 font-medium">
            Trump was 
            <span className="text-gold-400 font-extrabold flex inline-flex items-center gap-1 bg-gold-500/[0.08] border border-gold-500/25 px-2 py-0.5 rounded shadow-sm">
              {SUIT_GLYPH[results.trump]} <span className="uppercase text-[9px] tracking-wider">{results.trump}</span>
            </span>
            {' · '}
            Bidder called 
            <span className="text-pink-300 font-extrabold font-serif bg-pink-950/30 px-2 py-0.5 rounded border border-pink-500/20 shadow-sm">
              {results.calledCard.rank}{SUIT_GLYPH[results.calledCard.suit]}
            </span>
            {' · '}
            Partner revealed: 
            <strong className="text-white font-extrabold bg-white/5 px-2.5 py-0.5 rounded border border-white/10 shadow-sm">
              {seatNameFor(room.players, results.partnerSeat)}
            </strong>
          </span>
        </motion.div>

        {/* Gilded Black Queen Spotlight Banner */}
        {qosPlayedBy && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 15, delay: 0.55 }}
            className="bg-gradient-to-r from-gold-500/[0.03] via-gold-500/[0.08] to-gold-500/[0.03] border border-gold-500/20 rounded-xl p-3 text-center text-xs text-gold-200 mb-6 shadow-glass-gold relative overflow-hidden"
          >
            <div className="absolute inset-0.5 border border-gold-500/10 rounded-lg pointer-events-none" />
            <div className="relative z-10 flex items-center justify-center gap-2">
              <span className="text-base animate-pulse-slow">♛</span>
              <span>
                <strong>{qosPlayedBy}</strong> played the gilded <span className="text-gold-400 font-serif font-extrabold">Q♠ (Black Queen)</span> and <strong>{qosCapturedBy}</strong> captured her for a high-stakes <span className="text-gold-400 font-extrabold">+30 points</span>!
              </span>
            </div>
          </motion.div>
        )}

        {/* Team Scorecards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <TeamCard
            title="Bidder team"
            won={results.bidderTeamWon}
            points={results.bidderTeamPoints}
            totalNeeded={results.bidAmount}
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

        {/* Toggleable Match Ledger (Match History Details) */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowLedger(!showLedger)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-neutral-400 hover:text-white tracking-widest uppercase transition-all duration-300"
          >
            <span>📜 {showLedger ? 'Hide' : 'Reveal'} Speakeasy Match Ledger</span>
            <span className={`text-[10px] transition-transform duration-300 ${showLedger ? 'rotate-180' : ''}`}>▼</span>
          </button>

          <AnimatePresence>
            {showLedger && room.game && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="overflow-hidden mt-3"
              >
                <div className="bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-glass max-h-[300px] overflow-y-auto scrollbar-thin">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-extrabold mb-3 pb-1 border-b border-white/5">
                    Trick-by-Trick Narrative
                  </div>
                  <div className="space-y-2">
                    {room.game.completedTricks.map((trick, index) => {
                      const trickPoints = trick.plays.reduce((sum, p) => sum + pointValue(p.card), 0);
                      const winnerName = seatNameFor(room.players, trick.winnerSeat);
                      const leaderName = seatNameFor(room.players, trick.ledBy);

                      return (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.02] text-xs transition-all duration-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gold-400 font-bold bg-gold-500/[0.08] px-1.5 py-0.5 rounded border border-gold-500/20">
                              #{index + 1}
                            </span>
                            <span className="text-neutral-400">
                              Led by <strong>{leaderName}</strong>
                            </span>
                          </div>

                          {/* 4 Plays in Sequence */}
                          <div className="flex items-center gap-1.5 my-1 sm:my-0">
                            {trick.plays.map((p, pIndex) => {
                              const isWinner = p.seat === trick.winnerSeat;
                              const isRed = p.card.suit === 'hearts' || p.card.suit === 'diamonds';
                              const isQoS = p.card.suit === 'spades' && p.card.rank === 'Q';
                              const suitColor = isRed ? 'text-cardred animate-pulse-slow' : 'text-cardblack';

                              return (
                                <div
                                  key={pIndex}
                                  className={`px-2 py-0.5 rounded font-serif text-[10px] font-bold shadow-sm relative ${
                                    isWinner
                                      ? 'bg-gold-500 text-black border border-gold-400 scale-[1.04]'
                                      : 'bg-white text-black border border-neutral-300 opacity-70'
                                  }`}
                                >
                                  {isQoS && '👑 '}
                                  {p.card.rank}
                                  <span className={isWinner ? 'text-black' : suitColor}>
                                    {SUIT_GLYPH[p.card.suit]}
                                  </span>
                                  {p.seat === trick.winnerSeat && (
                                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-black" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-neutral-300">
                            Captured by <strong className="text-white font-bold">{winnerName}</strong>
                            {trickPoints > 0 ? (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded-full font-extrabold border border-amber-500/20">
                                +{trickPoints} pts
                              </span>
                            ) : (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-white/5 text-neutral-500 rounded-full font-medium">
                                0 pts
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Buttons Controls */}
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
            <div className="text-xs italic text-neutral-400 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 shadow-sm">
              Waiting for {seatNameFor(room.players, room.players.find((p) => p.id === room.hostId)?.seat ?? null)} (host) to start the next hand…
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

      {/* Chat Panel */}
      <div className="fixed bottom-4 right-4 z-40 select-none">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
