import { describe, it, expect } from 'vitest';
import { startTrick, playCardInTrick, resolveTrick, isLegalPlay } from '@/server/game/trick';
import type { Card, CurrentTrick, Suit } from '@/shared/types';

const c = (suit: Suit, rank: any): Card => ({ suit, rank });

describe('startTrick', () => {
  it('returns a fresh trick led by the given seat with empty plays', () => {
    const t = startTrick(2);
    expect(t.ledBy).toBe(2);
    expect(t.ledSuit).toBeNull();
    expect(t.plays).toEqual([]);
  });
});

describe('isLegalPlay', () => {
  it('any card is legal as the first play (no led suit yet)', () => {
    const t = startTrick(1);
    expect(isLegalPlay(t, [c('hearts', '5'), c('spades', 'A')], c('spades', 'A'))).toBe(true);
  });

  it('must follow led suit if the player has it', () => {
    const t = { ledBy: 1 as const, ledSuit: 'hearts' as Suit, plays: [{ seat: 1 as const, card: c('hearts', 'K') }] };
    const hand = [c('hearts', '2'), c('spades', 'A')];
    expect(isLegalPlay(t, hand, c('spades', 'A'))).toBe(false);
    expect(isLegalPlay(t, hand, c('hearts', '2'))).toBe(true);
  });

  it('can play any card when void in led suit', () => {
    const t = { ledBy: 1 as const, ledSuit: 'hearts' as Suit, plays: [{ seat: 1 as const, card: c('hearts', 'K') }] };
    const hand = [c('spades', 'A'), c('clubs', '2')];
    expect(isLegalPlay(t, hand, c('spades', 'A'))).toBe(true);
    expect(isLegalPlay(t, hand, c('clubs', '2'))).toBe(true);
  });
});

describe('playCardInTrick', () => {
  it('sets ledSuit on first play', () => {
    const t = startTrick(2);
    const r = playCardInTrick(t, 2, c('hearts', '7'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trick.ledSuit).toBe('hearts');
    expect(r.trick.plays).toHaveLength(1);
    expect(r.complete).toBe(false);
  });

  it('marks complete after 4 plays', () => {
    let t: CurrentTrick = startTrick(1);
    const cards: Card[] = [c('hearts', '7'), c('hearts', 'K'), c('hearts', '2'), c('hearts', 'A')];
    for (let i = 0; i < 4; i++) {
      const r = playCardInTrick(t, ((i % 4) + 1) as any, cards[i]);
      if (!r.ok) throw new Error('expected ok');
      t = r.trick;
      if (i < 3) expect(r.complete).toBe(false);
      else expect(r.complete).toBe(true);
    }
  });
});

describe('resolveTrick', () => {
  it('all same led suit, no trump: highest of led suit wins', () => {
    const trick: CurrentTrick = {
      ledBy: 1, ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', '7') },
        { seat: 2, card: c('hearts', 'K') },
        { seat: 3, card: c('hearts', '2') },
        { seat: 4, card: c('hearts', 'A') },
      ],
    };
    expect(resolveTrick(trick, 'spades')).toBe(4);
  });

  it('trump played wins over led suit', () => {
    const trick: CurrentTrick = {
      ledBy: 1, ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', 'A') },
        { seat: 2, card: c('spades', '2') },
        { seat: 3, card: c('hearts', 'K') },
        { seat: 4, card: c('clubs', 'J') },
      ],
    };
    expect(resolveTrick(trick, 'spades')).toBe(2);
  });

  it('multiple trumps: highest trump wins', () => {
    const trick: CurrentTrick = {
      ledBy: 1, ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', 'A') },
        { seat: 2, card: c('spades', '2') },
        { seat: 3, card: c('spades', 'K') },
        { seat: 4, card: c('spades', 'Q') },
      ],
    };
    expect(resolveTrick(trick, 'spades')).toBe(3);
  });

  it('fuse cards (non-led non-trump) cannot win', () => {
    const trick: CurrentTrick = {
      ledBy: 1, ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', '2') },
        { seat: 2, card: c('clubs', 'A') },
        { seat: 3, card: c('diamonds', 'A') },
        { seat: 4, card: c('hearts', '3') },
      ],
    };
    expect(resolveTrick(trick, 'spades')).toBe(4);
  });
});
