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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="w-52 bg-black/50 border border-white/15 rounded-lg p-2.5 text-xs">
      <div ref={scrollRef} className="flex flex-col gap-0.5 max-h-32 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id}>
            {m.authorName ? (
              <span>
                <b className="text-gold-500">{m.authorName}:</b> {m.text}
              </span>
            ) : (
              <span className="text-neutral-500 italic">{m.text}</span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="mt-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Type a message…"
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs outline-none focus:border-gold-500"
        />
      </form>
    </div>
  );
}
