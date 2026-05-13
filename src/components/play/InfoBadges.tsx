import type { PublicGameState, Suit } from '@/shared/types';

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface Props {
  game: PublicGameState;
  bidderName: string;
  partnerName: string | null;
}

export function InfoBadges({ game, bidderName, partnerName }: Props) {
  const tp = game.trumpPartner;
  if (!tp) return null;
  return (
    <div className="flex flex-col gap-1.5 absolute top-3 left-3">
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white font-mono">
        Trump <span className="text-gold-500 font-bold">{SUIT_GLYPH[tp.trump]}</span>
      </div>
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white">
        Bid <b className="text-gold-500">{game.bid.currentBid}</b> · {bidderName}
      </div>
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white">
        Called <span className="text-pink-300 font-bold font-serif">{tp.calledCard.rank}{SUIT_GLYPH[tp.calledCard.suit]}</span>
        {partnerName && <span className="text-neutral-400"> · {partnerName}</span>}
      </div>
    </div>
  );
}
