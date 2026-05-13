'use client';
import { useState } from 'react';
import type { Card, Suit, Rank } from '@/shared/types';
import { SUITS, RANKS, cardKey } from '@/shared/types';

interface Props {
  yourHand: Card[];
  busy?: boolean;
  onConfirm: (trump: Suit, calledCard: Card) => void;
}

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export function TrumpPartnerModal({ yourHand, busy, onConfirm }: Props) {
  const [trump, setTrump] = useState<Suit | null>(null);
  const [called, setCalled] = useState<Card | null>(null);

  const ownedKeys = new Set(yourHand.map(cardKey));
  const canConfirm = trump !== null && called !== null;

  return (
    <div className="w-[560px] max-w-[95%] bg-black/90 border border-gold-500/40 rounded-2xl p-5 shadow-2xl">
      <div className="text-center mb-3">
        <div className="text-[9px] uppercase tracking-widest text-gold-500 font-bold">You won the bid</div>
        <div className="text-sm text-neutral-300 mt-1">Pick the trump suit and a partner card you don&apos;t have.</div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">1 · Trump suit</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {SUITS.map((s) => {
          const isRed = s === 'hearts' || s === 'diamonds';
          const selected = trump === s;
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => setTrump(s)}
              className={selected
                ? 'bg-gold-500 text-black border border-white py-2 rounded-lg font-bold disabled:opacity-50'
                : `bg-felt-800 hover:bg-felt-700 border border-white/20 hover:border-gold-500 py-2 rounded-lg disabled:opacity-50 ${isRed ? 'text-red-400' : 'text-white'}`}
            >
              <div className="text-xl leading-none">{SUIT_GLYPH[s]}</div>
              <div className="text-[9px] mt-1">{s}</div>
            </button>
          );
        })}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">2 · Partner card (not in your hand)</div>
      <div className="space-y-1">
        {SUITS.map((suit) => {
          const isRed = suit === 'hearts' || suit === 'diamonds';
          return (
            <div key={suit} className="flex items-center gap-1">
              <div className={`w-4 text-center ${isRed ? 'text-red-400' : 'text-white'}`}>{SUIT_GLYPH[suit]}</div>
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                {RANKS.map((rank: Rank) => {
                  const card: Card = { suit, rank };
                  const k = cardKey(card);
                  const owned = ownedKeys.has(k);
                  const selected = called && cardKey(called) === k;
                  const baseColor = isRed ? 'text-red-400' : 'text-black';
                  return (
                    <button
                      key={rank}
                      type="button"
                      disabled={owned || busy}
                      onClick={() => setCalled(card)}
                      className={selected
                        ? 'bg-gold-500 text-black font-bold rounded h-6 text-[11px] border border-white shadow disabled:opacity-50'
                        : owned
                        ? 'bg-white/5 text-neutral-600 rounded h-6 text-[11px] border border-dashed border-white/15 cursor-not-allowed'
                        : `bg-white hover:-translate-y-px ${baseColor} rounded h-6 text-[11px] font-bold disabled:opacity-50 shadow-sm transition-transform`}
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

      <div className="mt-4 flex justify-between items-center bg-black/40 border border-white/15 rounded-lg px-3 py-2">
        <div className="text-xs text-neutral-300">
          Trump <span className="text-gold-500 font-bold">{trump ? SUIT_GLYPH[trump] : '—'}</span>
          {' · '}
          Partner <span className="text-pink-300 font-bold font-serif">{called ? `${called.rank}${SUIT_GLYPH[called.suit]}` : '—'}</span>
        </div>
        <button
          type="button"
          disabled={!canConfirm || busy}
          onClick={() => canConfirm && onConfirm(trump!, called!)}
          className="bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg px-4 py-1.5 text-xs"
        >
          Lock it in
        </button>
      </div>
    </div>
  );
}
