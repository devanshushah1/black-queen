'use client';
import { motion } from 'framer-motion';

interface Props {
  youWon: boolean;
  /** "Bidder team needed X · captured Y · bid {made|failed}" */
  summary: string;
}

export function Verdict({ youWon, summary }: Props) {
  return (
    <div className="text-center mb-6 relative z-10 select-none">
      {/* Crown Icon Header with premium glows */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 80, delay: 0.1 }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#1a1c1a] via-[#101210] to-[#0a0c0a] border border-white/10 shadow-lg relative mb-3"
      >
        <div className="absolute inset-1 rounded-full border border-white/[0.03] pointer-events-none" />
        
        {youWon ? (
          <>
            {/* Pulsing glow ring behind the crown */}
            <div className="absolute inset-0 rounded-full bg-gold-500/20 blur-md animate-pulse" />
            <svg className="w-8 h-8 text-gold-400 filter drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16L3 5l5 5 4-7 4 7 5-5-2 11H5zm14 2H5v2h14v-2z"/>
            </svg>
          </>
        ) : (
          <>
            <svg className="w-8 h-8 text-neutral-500 filter drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </>
        )}
      </motion.div>

      {/* Main Verdict text with rich drop shadow */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], delay: 0.25 }}
        className={`text-4xl md:text-5xl font-extrabold tracking-wider font-serif ${
          youWon 
            ? 'text-transparent bg-clip-text bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 drop-shadow-[0_2px_12px_rgba(212,164,55,0.45)]' 
            : 'text-transparent bg-clip-text bg-gradient-to-b from-neutral-200 to-neutral-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]'
        }`}
      >
        {youWon ? 'YOU WON' : 'YOU LOST'}
      </motion.h1>

      {/* Summary subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-xs md:text-sm text-neutral-300 mt-2 font-medium tracking-wide max-w-lg mx-auto"
      >
        {summary}
      </motion.p>
    </div>
  );
}
