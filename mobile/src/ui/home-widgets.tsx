import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, hardShadow, radius, space } from '@/theme';
import type { DailyInteractionDef, InteractionDef } from '@/game/types';
import { Eyebrow, Txt } from './primitives';

/** Bixi's speech bubble (Fraunces italic, field-note tail). */
export function SpeechBubble({ line }: { line: string | null }) {
  if (!line) return null;
  return (
    <View style={styles.bubble}>
      <View style={styles.bubbleTail} />
      <Txt style={styles.bubbleText}>{line}</Txt>
    </View>
  );
}

/** The hero "Today's interaction" card — the streak-keeper (Area 3/12). */
export function DailyCard({
  daily,
  done,
  streak,
  onPress,
}: {
  daily: DailyInteractionDef;
  done: boolean;
  streak: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      style={({ pressed }) => [
        styles.daily,
        done && styles.dailyDone,
        pressed && !done && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
      ]}
    >
      <View style={styles.dailyRow}>
        <View style={styles.dailyEmojiWrap}>
          <Txt style={{ fontSize: 26 }}>{daily.emoji}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow color={done ? colors.pine : colors.clayPress}>
            {done ? 'Today ✓ · streak kept' : "Today's interaction · keeps your streak"}
          </Eyebrow>
          <Txt style={styles.dailyTitle}>{daily.label}</Txt>
          <Txt variant="body" style={{ marginTop: 2 }}>{daily.description}</Txt>
        </View>
        <View style={styles.flame}>
          <Txt style={{ fontSize: 15 }}>🔥</Txt>
          <Txt style={styles.flameNum}>{streak}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

/** A permanent interaction button (Feed/Pet/Water + library). */
export function InteractionButton({
  def,
  done,
  onPress,
}: {
  def: InteractionDef;
  done: boolean;
  onPress: () => void;
}) {
  const locked = !def.available;
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.iBtn,
        pressed && !locked && { backgroundColor: colors.tint },
        locked && { opacity: 0.5 },
      ]}
    >
      <Txt style={{ fontSize: 24 }}>{def.emoji}</Txt>
      <Txt style={styles.iLabel}>{def.label}</Txt>
      <Txt style={styles.iSub} color={locked ? colors.muted : done ? colors.pine : colors.clayPress}>
        {locked ? 'soon' : done ? 'done ✓' : '+ mood'}
      </Txt>
    </Pressable>
  );
}

/** solo → invite chip · paired → presence strip */
export function PresenceLine({
  paired,
  partnerName,
  youDone,
  partnerPresent,
  onInvite,
}: {
  paired: boolean;
  partnerName?: string;
  youDone: boolean;
  partnerPresent: boolean;
  onInvite: () => void;
}) {
  if (!paired) {
    return (
      <Pressable onPress={onInvite} style={styles.invite}>
        <Txt style={styles.inviteText}>＋ Invite your co-parent</Txt>
        <Txt variant="meta" color={colors.clayPress}>bixi blooms brightest with two</Txt>
      </Pressable>
    );
  }
  return (
    <View style={styles.presence}>
      <Txt variant="bodyStrong">
        You {youDone ? '✓' : '·'} <Txt variant="body" color={colors.muted}>today</Txt>
      </Txt>
      <View style={styles.presenceDot} />
      <Txt variant="bodyStrong">
        {partnerName ?? 'Partner'}{' '}
        <Txt variant="body" color={partnerPresent ? colors.pine : colors.amber}>
          {partnerPresent ? 'here' : 'away'}
        </Txt>
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
    maxWidth: '92%',
    marginTop: 12,
  },
  bubbleTail: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -6,
    width: 11,
    height: 11,
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.line,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 16, color: colors.ink, textAlign: 'center' },

  daily: {
    backgroundColor: colors.sheet,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: space.lg,
    ...hardShadow,
  },
  dailyDone: { borderColor: colors.line, backgroundColor: colors.sage, shadowOpacity: 0 },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dailyEmojiWrap: {
    width: 48, height: 48, borderRadius: radius.sm,
    backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center',
  },
  dailyTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginTop: 3 },
  flame: { alignItems: 'center' },
  flameNum: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },

  iBtn: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 3,
  },
  iLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink },
  iSub: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },

  invite: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.clay,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    gap: 1,
  },
  inviteText: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.clayPress },

  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.tint,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  presenceDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted },
});
