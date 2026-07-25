/**
 * "Interaction of the Day" rotating queue (Area 3) — the streak-keeper.
 * Available now (not locked), rotates each cycle, bigger reaction. This is a seed
 * queue; it repeats. Rotation is deterministic on day-index (no Math.random at runtime).
 */
import type { DailyInteractionDef } from '../types';

export const DAILY_QUEUE: DailyInteractionDef[] = [
  { key: 'd_tickle', label: 'Tickle Bixi', emoji: '🎪', description: 'A giggle fit — his best mood of the day.', line: "Hehehe— okay okay, I'm cheered up!" },
  { key: 'd_stargaze', label: 'Stargaze', emoji: '🌟', description: 'Sit with Bixi and watch the sky.', line: 'I counted three. One was probably a plane.' },
  { key: 'd_dance', label: 'Little dance', emoji: '💃', description: 'Bixi wants to show you a move.', line: 'Did you see that? Do NOT tell anyone.' },
  { key: 'd_secret', label: 'Whisper', emoji: '🤫', description: 'Lean in — he has something to say.', line: '…I saved that one just for you.' },
  { key: 'd_snack', label: 'Share a snack', emoji: '🍡', description: 'Split something sweet together.', line: 'You take the bigger half? …fine, I insist.' },
  { key: 'd_sun', label: 'Chase the sun', emoji: '🌞', description: 'Find the warmest spot in the room.', line: 'Right here. This is the spot. Perfect.' },
  { key: 'd_rain', label: 'Watch the rain', emoji: '🌧️', description: 'Quiet company while it pours.', line: "I like the sound. I like it more with you." },
  { key: 'd_bloomwatch', label: 'Tend the bud', emoji: '🌿', description: 'Check on his little sprout.', line: 'A bit greener today, I think. Because of you.' },
];

/** deterministic pick — pass a day index (e.g. floor(now/DAY)). */
export function dailyForIndex(dayIndex: number): DailyInteractionDef {
  const i = ((dayIndex % DAILY_QUEUE.length) + DAILY_QUEUE.length) % DAILY_QUEUE.length;
  return DAILY_QUEUE[i];
}
