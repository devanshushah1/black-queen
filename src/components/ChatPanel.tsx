'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/shared/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="w-56 bg-black/45 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs shadow-glass select-none transition-all duration-300">
      <div className="text-[10px] uppercase tracking-widest text-gold-400 font-extrabold mb-1.5 opacity-85">
        Lounge Chat
      </div>
      
      <div 
        ref={scrollRef} 
        className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1 mb-2 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="text-neutral-500 italic text-[11px] py-1 text-center">No messages yet...</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug break-words py-0.5">
              {m.authorName ? (
                <span>
                  <b className="text-gold-400 font-bold mr-1">{m.authorName}:</b>
                  <span className="text-white/80">{m.text}</span>
                </span>
              ) : (
                <span className="text-neutral-500 italic text-[11px]">{m.text}</span>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative mt-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Send a whisper…"
          className="w-full bg-white/[0.05] border border-white/10 focus:border-gold-500/80 focus:bg-white/[0.08] text-white rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all duration-300 placeholder-white/30"
        />
        <button 
          type="submit" 
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gold-400 hover:text-gold-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
