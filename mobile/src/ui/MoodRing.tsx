import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { colors, fonts } from '@/theme';
import type { MoodState } from '@/game/types';
import { Txt } from './primitives';

const STATE_COLOR: Record<MoodState, string> = {
  thriving: colors.pine,
  content: colors.pine,
  drifting: colors.amber,
  sad: colors.amber,
  wilting: colors.clay,
  dormant: colors.muted,
};

const STATE_WORD: Record<MoodState, string> = {
  thriving: 'Thriving',
  content: 'Content',
  drifting: 'Drifting',
  sad: 'Missing them',
  wilting: 'Wilting',
  dormant: 'Dormant',
};

export function MoodRing({
  mood,
  state,
  ceiling,
  secretAt = 80,
  size = 132,
}: {
  mood: number;
  state: MoodState;
  ceiling: number;
  secretAt?: number;
  size?: number;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, mood / 100));
  const color = STATE_COLOR[state];

  // angle helpers (start at top, clockwise)
  const angleFor = (v: number) => (v / 100) * 360 - 90;
  const markerPos = (v: number) => {
    const a = (angleFor(v) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const secret = markerPos(secretAt);
  const cap = markerPos(ceiling);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={0} origin={`${cx}, ${cy}`}>
          {/* track */}
          <Circle cx={cx} cy={cy} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
          {/* progress */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {/* solo ceiling tick */}
          {ceiling < 100 && (
            <Circle cx={cap.x} cy={cap.y} r={2.6} fill={colors.muted} opacity={0.7} />
          )}
          {/* reward (secret) marker — subtle, PRD §25-H */}
          <Circle cx={secret.x} cy={secret.y} r={3.2} fill={colors.clay} opacity={mood >= secretAt ? 1 : 0.5} />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Txt style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.ink }}>
          {Math.round(mood)}
          <Txt style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.muted }}>%</Txt>
        </Txt>
        <Txt variant="eyebrow" color={color}>
          {STATE_WORD[state]}
        </Txt>
      </View>
    </View>
  );
}
