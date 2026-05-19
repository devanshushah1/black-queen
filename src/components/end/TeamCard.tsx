'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card, Seat } from '@/shared/types';
import { ChipRow } from './ChipRow';

interface Props {
  title: string;
  won: boolean;
  points: number;
  totalNeeded?: number; // for bidder team: show "/ needed N"
  members: Array<{ seat: Seat; name: string; role: 'bidder' | 'partner' | 'opponent'; isYou: boolean }>;
  capturedCards: Card[];
}

const ROLE_LABEL: Record<Props['members'][number]['role'], string> = {
  bidder: '★ bidder',
  partner: '✦ partner',
  opponent: 'opponent',
};

const ROLE_COLOR: Record<Props['members'][number]['role'], string> = {
  bidder: 'text-gold-400 font-extrabold',
  partner: 'text-pink-300 font-extrabold',
  opponent: 'text-neutral-400 font-medium',
};

// Custom Rolling Score Odometer Component
function RollingCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; // 1.2s total duration
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(easeProgress * target);
      setValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target]);

  return <span>{value}</span>;
}

export function TeamCard({ title, won, points, totalNeeded, members, capturedCards }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 80, delay: title.includes('Bidder') ? 0.35 : 0.45 }}
      className={`rounded-2xl p-5 shadow-glass relative overflow-hidden select-none ${
        won
          ? 'bg-gold-500/[0.04] border-2 border-gold-500 shadow-glass-gold animate-glowing-gold'
          : 'bg-black/45 border-2 border-white/10 opacity-90'
      }`}
    >
      {/* Decorative fine gold/white border inside */}
      <div className={`absolute inset-1.5 border rounded-xl pointer-events-none ${
        won ? 'border-gold-500/10' : 'border-white/[0.02]'
      }`} />

      {/* Header Info */}
      <div className="flex justify-between items-baseline mb-3.5 pb-2.5 border-b border-white/10 relative z-10">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
            {title}
          </div>
          <div className={`text-xs uppercase tracking-widest font-extrabold ${
            won ? 'text-gold-400' : 'text-neutral-400/80'
          }`}>
            {won ? '✓ VICTORY' : '✗ DEFEAT'}
          </div>
        </div>

        {/* Score & Odometer Display */}
        <div className="text-right">
          <span className={`text-3xl font-extrabold font-serif tracking-tight ${
            won 
              ? 'text-gold-400 drop-shadow-[0_0_8px_rgba(212,164,55,0.35)]' 
              : 'text-white/80'
          }`}>
            <RollingCounter target={points} />
          </span>
          {totalNeeded !== undefined && (
            <span className="text-[11px] text-neutral-400 font-bold ml-1.5">
              / needed {totalNeeded}
            </span>
          )}
        </div>
      </div>

      {/* Team Members Grid */}
      <div className="flex gap-2.5 mb-4 relative z-10">
        {members.map((m) => (
          <div
            key={m.seat}
            className={`flex-1 rounded-xl p-2.5 text-center transition-all duration-300 ${
              m.isYou
                ? 'bg-gold-500/[0.08] border border-gold-500 shadow-glass-gold scale-[1.02]'
                : 'bg-black/35 border border-white/5 hover:border-white/10'
            }`}
          >
            <div className={`text-sm font-extrabold ${m.isYou ? 'text-white' : 'text-neutral-200'}`}>
              {m.name} {m.isYou && <span className="text-[10px] font-medium text-gold-400">(you)</span>}
            </div>
            <div className={`text-[9px] uppercase tracking-widest mt-1 ${ROLE_COLOR[m.role]}`}>
              {ROLE_LABEL[m.role]}
            </div>
          </div>
        ))}
      </div>

      {/* Captured Point Cards Row */}
      <div className="relative z-10">
        <div className="text-[9px] uppercase tracking-widest text-neutral-400/80 font-extrabold mb-2 pl-0.5">
          Captured point cards
        </div>
        <ChipRow cards={capturedCards} />
      </div>
    </motion.div>
  );
}
