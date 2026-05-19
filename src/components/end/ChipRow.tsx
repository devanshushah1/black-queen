'use client';
import { motion } from 'framer-motion';
import type { Card, Suit } from '@/shared/types';
import { pointValue } from '@/shared/types';

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface Props {
  cards: Card[];
}

export function ChipRow({ cards }: Props) {
  const points = cards.filter((c) => pointValue(c) > 0);
  
  if (points.length === 0) {
    return <div className="text-[11px] text-neutral-500 italic pl-1">No captured point cards</div>;
  }

  // Define container variant for staggered children
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.6, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 12, stiffness: 100 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-wrap gap-1.5 p-1"
    >
      {points.map((card, i) => {
        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
        const isQoS = card.suit === 'spades' && card.rank === 'Q';
        const pts = pointValue(card);
        
        let colorClass = isRed ? 'text-cardred' : 'text-cardblack';
        let bgClass = 'bg-[#fafaf5] border border-black/10 shadow-sm';
        
        if (isQoS) {
          colorClass = 'text-gold-600';
          bgClass = 'bg-[#fafaf5] bg-gradient-to-br from-[#fafaf5] via-[#fffbf0] to-[#fce38a]/40 border-2 border-gold-500 shadow shadow-gold-500/10 animate-pulse-slow';
        }

        return (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.1, zIndex: 10 }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-serif text-[11px] font-bold select-none cursor-default transition-shadow hover:shadow-md ${bgClass} ${colorClass}`}
          >
            {/* Ornate border decor for Q of Spades */}
            {isQoS && <span className="text-[10px] text-gold-500">👑</span>}
            
            <span>{card.rank}{SUIT_GLYPH[card.suit]}</span>
            
            {/* Captured Point Value Badge */}
            <span className={`text-[9px] px-1 rounded-md font-sans font-extrabold ${
              isQoS 
                ? 'bg-gold-500/20 text-gold-700' 
                : 'bg-black/[0.05] text-black/60'
            }`}>
              +{pts}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
