/**
 * Permanent interaction library (Area 3). Data-driven so new ones drop in as content.
 * `available:false` = the button shows but is "soon" — waiting on Saud's videos.
 * Core three (Feed/Pet/Water) render on Home; the rest live in the "More" drawer.
 */
import type { InteractionDef } from '../types';

export const INTERACTIONS: InteractionDef[] = [
  {
    key: 'feed',
    label: 'Feed',
    emoji: '🍽️',
    video: 'feed',
    line: 'Mmm. Thank you 💚',
    available: true,
    isCore: true,
  },
  {
    key: 'pet',
    label: 'Pet',
    emoji: '🫶',
    video: 'tap',
    line: 'Again? …okay, again.',
    available: true,
    isCore: true,
  },
  {
    key: 'water',
    label: 'Water',
    emoji: '💧',
    video: 'water',
    line: 'My leaf feels brand new.',
    available: true,
    isCore: true,
  },
  {
    key: 'shower',
    label: 'Shower',
    emoji: '🚿',
    video: 'water',
    line: 'Squeaky clean — I sparkle now ✨',
    available: true,
    isCore: false,
  },
  {
    key: 'books',
    label: 'Read',
    emoji: '📖',
    video: 'tap',
    line: 'Read me one more chapter… okay, two.',
    available: true,
    isCore: false,
  },
  {
    key: 'stretch',
    label: 'Stretch',
    emoji: '🧘',
    video: 'tap',
    line: 'Ahh — my leaves feel loose now.',
    available: true,
    isCore: false,
  },
  {
    key: 'scroll',
    label: 'Scroll',
    emoji: '📱',
    video: 'tap',
    line: 'Doomscrolling together still counts as together.',
    available: true,
    isCore: false,
  },
  // --- library that grows as videos arrive (buttons present, marked "soon") ---
  { key: 'tickle', label: 'Tickle', emoji: '🪶', line: 'Hehe— stop! …don\'t stop.', available: false, isCore: false },
  { key: 'tease', label: 'Tease', emoji: '😜', line: 'Rude. I love it.', available: false, isCore: false },
  { key: 'pinch', label: 'Pinch', emoji: '🤏', line: 'Ow! (worth it)', available: false, isCore: false },
  { key: 'sing', label: 'Sing', emoji: '🎵', line: 'Sing it again, slower.', available: false, isCore: false },
  { key: 'sun', label: 'Sun', emoji: '☀️', video: 'tap', line: 'The warmth… I could stay here forever.', available: true, isCore: false },
  { key: 'groom', label: 'Groom', emoji: '🧼', line: 'Do I look distinguished now?', available: false, isCore: false },
];

export const CORE_INTERACTIONS = INTERACTIONS.filter((i) => i.isCore);
// Only surface interactions that actually work. `available:false` ones are
// hidden until their videos land (no "coming soon" dead buttons for reviewers).
export const MORE_INTERACTIONS = INTERACTIONS.filter((i) => !i.isCore && i.available);

export function interactionByKey(key: string): InteractionDef | undefined {
  return INTERACTIONS.find((i) => i.key === key);
}
