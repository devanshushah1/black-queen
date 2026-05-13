interface Props {
  youWon: boolean;
  /** "Bidder team needed X · captured Y · bid {made|failed}" */
  summary: string;
}

export function Verdict({ youWon, summary }: Props) {
  return (
    <div className="text-center mb-4">
      <div
        className={youWon
          ? 'text-4xl font-extrabold text-gold-500 tracking-wider'
          : 'text-4xl font-extrabold text-neutral-400 tracking-wider'}
        style={youWon ? { textShadow: '0 0 24px rgba(244,200,66,0.4)' } : undefined}
      >
        {youWon ? 'YOU WON' : 'YOU LOST'}
      </div>
      <div className="text-xs text-neutral-300 mt-2">{summary}</div>
    </div>
  );
}
