'use client';
import { useState } from 'react';
import type { Card, Suit, Rank } from '@/shared/types';
import { SUITS, RANKS, cardKey } from '@/shared/types';

interface Props {
  yourHand: Card[];
  busy?: boolean;
  onConfirm: (trump: Suit, calledCard: Card) => void;
}

const SUIT_SVGS: Record<Suit, React.ReactNode> = {
  hearts: (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ),
  diamonds: (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M12 2L2 12l10 10 10-10L12 2z"/>
    </svg>
  ),
  clubs: (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 2a3 3 0 00-3 3c0 .58.16 1.12.45 1.58A4 4 0 006.5 10.5 4 4 0 0010.5 14.5c.29 0 .57-.03.85-.09l-.42 2.51a1.29 1.29 0 002.57 0l-.42-2.51c.28.06.56.09.85.09a4 4 0 004-4 4 4 0 00-2.95-3.92c.29-.46.45-1 .45-1.58a3 3 0 00-3-3z"/>
    </svg>
  ),
  spades: (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 2C9 6 6 8 6 11c0 2.5 2 4 4 4c.3 0 .6-.04.9-.1l-.44 2.6a1.3 1.3 0 002.6 0l-.44-2.6c.3.06.6.1.9.1a4 4 0 004-4c0-3-3-5-6-9z"/>
    </svg>
  ),
};

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export function TrumpPartnerModal({ yourHand, busy, onConfirm }: Props) {
  const [trump, setTrump] = useState<Suit | null>(null);
  const [called, setCalled] = useState<Card | null>(null);

  const ownedKeys = new Set(yourHand.map(cardKey));
  const canConfirm = trump !== null && called !== null;

  return (
    <div className="w-[580px] max-w-[98%] bg-black/65 backdrop-blur-md border border-gold-500/30 rounded-2xl p-6 shadow-glass-gold relative overflow-hidden font-sans">
      {/* Decorative fine double border inside */}
      <div className="absolute inset-1.5 border border-white/[0.02] rounded-xl pointer-events-none" />

      {/* Header Info */}
      <div className="text-center mb-5 relative z-10">
        <div className="text-[10px] uppercase tracking-widest text-gold-400 font-extrabold flex items-center justify-center gap-1.5 animate-pulse-slow">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          You Won The Bid
        </div>
        <div className="text-xs text-neutral-300 mt-2 font-medium">
          Select the trump suit and declare a partner card not present in your hand.
        </div>
      </div>

      {/* Section 1: Trump Suit Selection */}
      <div className="relative z-10 mb-5">
        <div className="text-[9px] uppercase tracking-widest text-gold-400/80 font-bold mb-2">
          1 · Trump Suit Selection
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {SUITS.map((s) => {
            const isRed = s === 'hearts' || s === 'diamonds';
            const selected = trump === s;
            const textClr = isRed ? 'text-cardred' : 'text-white';
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => setTrump(s)}
                className={selected
                  ? 'bg-gradient-to-b from-gold-400 to-gold-600 text-black border border-white/10 py-3 rounded-xl font-extrabold shadow-lg shadow-gold-500/10 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50'
                  : `bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-gold-500/40 py-3 rounded-xl ${textClr} transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50`}
              >
                <div className="h-5 flex items-center justify-center">{SUIT_SVGS[s]}</div>
                <div className="text-[8px] uppercase tracking-widest font-extrabold mt-0.5">{s}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Declare Partner Card */}
      <div className="relative z-10 mb-5">
        <div className="text-[9px] uppercase tracking-widest text-gold-400/80 font-bold mb-2">
          2 · Declare Partner Card (Not in your hand)
        </div>
        <div className="space-y-2 bg-white/[0.01] border border-white/5 rounded-xl p-3">
          {SUITS.map((suit) => {
            const isRed = suit === 'hearts' || suit === 'diamonds';
            const suitColor = isRed ? 'text-cardred' : 'text-white/95';
            return (
              <div key={suit} className="flex items-center gap-2">
                {/* Suit Icon Indicator */}
                <div className={`w-6 h-6 flex items-center justify-center ${suitColor} opacity-85`}>
                  {SUIT_SVGS[suit]}
                </div>
                {/* Rank grid */}
                <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                  {RANKS.map((rank: Rank) => {
                    const card: Card = { suit, rank };
                    const k = cardKey(card);
                    const owned = ownedKeys.has(k);
                    const selected = called && cardKey(called) === k;
                    
                    let btnClass = '';
                    if (selected) {
                      btnClass = 'bg-gradient-to-b from-gold-400 to-gold-600 text-black font-extrabold border border-white/10 shadow shadow-gold-500/20 scale-105';
                    } else if (owned) {
                      btnClass = 'bg-white/[0.01] text-neutral-600 border border-dashed border-white/5 cursor-not-allowed';
                    } else {
                      const textRankColor = isRed ? 'text-cardred hover:text-red-300' : 'text-white/90 hover:text-gold-300';
                      btnClass = `bg-white bg-white/[0.04] hover:bg-white/[0.08] ${textRankColor} border border-white/5 hover:border-gold-500/20 active:scale-95`;
                    }

                    return (
                      <button
                        key={rank}
                        type="button"
                        disabled={owned || busy}
                        onClick={() => setCalled(card)}
                        className={`h-7 rounded-md text-[10px] font-extrabold flex items-center justify-center transition-all ${btnClass}`}
                      >
                        {rank}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Summary and Action Block */}
      <div className="mt-5 flex justify-between items-center bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 relative z-10">
        <div className="text-xs text-neutral-300 flex items-center gap-2">
          <span>Trump:</span>
          <span className="text-gold-400 font-extrabold flex items-center gap-1">
            {trump ? (
              <>
                <span className="scale-75 inline-flex align-middle">{SUIT_SVGS[trump]}</span>
                <span className="uppercase text-[10px] tracking-wider">{trump}</span>
              </>
            ) : (
              '—'
            )}
          </span>
          <span className="text-white/30 font-light mx-1">|</span>
          <span>Partner Card:</span>
          <span className="text-pink-300 font-extrabold font-serif tracking-wide bg-pink-950/20 px-2 py-0.5 rounded border border-pink-500/10">
            {called ? `${called.rank}${SUIT_GLYPH[called.suit]}` : '—'}
          </span>
        </div>
        <button
          type="button"
          disabled={!canConfirm || busy}
          onClick={() => canConfirm && onConfirm(trump!, called!)}
          className="bg-gradient-to-r from-gold-600 via-gold-500 to-gold-600 hover:from-gold-500 hover:to-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold rounded-xl px-5 py-2.5 text-xs shadow-lg tracking-wider transition-all duration-300"
        >
          Lock it in
        </button>
      </div>
    </div>
  );
}
