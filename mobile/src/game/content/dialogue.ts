/**
 * Bixi's voice (Area 8) — multi-register, governed by mood STATE.
 * Playful when thriving → tender when sad → wistful when dormant. Uses the partner's
 * name when known ({partner}), generic fallback otherwise. Longing, never blame.
 */
import type { MoodState } from '../types';

const LINES: Record<MoodState, string[]> = {
  thriving: [
    'Best day. You\'re both here 🌟',
    'I did a little dance while you were gone. No proof.',
    'Is it possible to be too happy? Asking for me.',
  ],
  content: [
    'I like it when you\'re here.',
    'The light moved across the paper today. I watched all of it.',
    'Quiet day. Good quiet.',
  ],
  drifting: [
    'You were gone a while. I kept your spot warm.',
    'Come sit? Just for a minute.',
  ],
  sad: [
    'I miss {partner}. When do they come home?',
    'It\'s not the same with just one of you…',
    'Tell {partner} the leaf drooped a little today.',
  ],
  wilting: [
    'I\'m keeping a small warmth for you, in case you return.',
    'I\'m okay. Mostly. Come back soon?',
  ],
  dormant: [
    '…resting. I\'ll be here.',
    '(he\'s curled up, dim and quiet)',
  ],
};

const SOLO_SAD = [
  'It\'s quiet without you… come back soon?',
  'I saved a thought for when you\'d return.',
];

export interface LineCtx {
  partnerName?: string | null;
  paired: boolean;
}

/** deterministic pick by index so it rotates without Math.random at runtime. */
export function bixiLine(
  state: MoodState,
  index: number,
  ctx: LineCtx
): string {
  let pool = LINES[state];
  if (state === 'sad' && !ctx.paired) pool = SOLO_SAD;
  const raw = pool[((index % pool.length) + pool.length) % pool.length];
  return raw.replace(/\{partner\}/g, ctx.partnerName || 'your person');
}

export const REACTION_HATCH = 'Oh! …hello. You\'re my person.';
export const REACTION_BLOOM = 'There are two of you now. I can feel it 🌸';
export const REACTION_REVIVE = 'You came back. You came *back*.';
export const REACTION_BOTH_HERE = 'You\'re both here at once — my whole heart 💞';
export const SECRET_LINE = 'Okay… I\'ll tell you something. Come closer.';
