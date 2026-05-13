'use client';
import { useState } from 'react';

interface InviteCardProps {
  code: string;
  url: string;
  disabled?: boolean;
}

export function InviteCard({ code, url, disabled }: InviteCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={
        disabled
          ? 'w-56 bg-black/40 border border-gold-500/20 rounded-xl p-4 opacity-50'
          : 'w-56 bg-black/40 border border-gold-500/40 rounded-xl p-4 shadow-xl'
      }
    >
      <div className="text-[9px] uppercase tracking-widest text-neutral-400 text-center mb-1.5">
        {disabled ? 'Room full' : 'Invite friends · room code'}
      </div>
      <div className="font-mono text-2xl font-bold text-gold-500 text-center tracking-widest">
        {code}
      </div>
      <div className="text-[10px] font-mono text-neutral-500 text-center mt-1 break-all">
        {url}
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        className={
          disabled
            ? 'w-full mt-2.5 bg-white/5 border border-white/10 text-neutral-500 text-xs font-semibold rounded-lg py-1.5'
            : copied
            ? 'w-full mt-2.5 bg-green-500/15 border border-green-400/40 text-green-400 text-xs font-semibold rounded-lg py-1.5'
            : 'w-full mt-2.5 bg-gold-500/20 border border-gold-500/40 text-gold-500 hover:bg-gold-500/30 text-xs font-semibold rounded-lg py-1.5'
        }
      >
        {disabled ? 'Link locked' : copied ? '✓ Copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
