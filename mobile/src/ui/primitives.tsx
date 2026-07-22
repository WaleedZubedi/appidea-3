import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, hardShadow, radius, space } from '@/theme';

type TxtVariant =
  | 'display' // Fraunces headline
  | 'title'
  | 'serif' // Fraunces body / Bixi lines
  | 'body'
  | 'bodyStrong'
  | 'meta' // mono captions
  | 'eyebrow'; // mono uppercase label

export function Txt({
  variant = 'body',
  color,
  center,
  style,
  ...rest
}: TextProps & { variant?: TxtVariant; color?: string; center?: boolean }) {
  return (
    <Text
      style={[
        styles[variant],
        color ? { color } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Text style={[styles.eyebrow, color ? { color } : null]}>{children}</Text>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

export function Screen({
  children,
  scroll = true,
  bg = colors.paper,
}: {
  children: ReactNode;
  scroll?: boolean;
  bg?: string;
}) {
  const inner = (
    <View style={styles.screenInner}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: PressableProps['style'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.primaryPressed,
        (disabled || loading) && styles.disabled,
        style as object,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.paper} />
      ) : (
        <Text style={styles.primaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        pressed && { backgroundColor: colors.tint },
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  color = colors.clayPress,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenInner: { flex: 1, paddingHorizontal: space.xl },
  scrollContent: { paddingHorizontal: space.xl, paddingBottom: 120, paddingTop: space.sm },

  display: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: colors.ink, letterSpacing: -0.3 },
  title: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, color: colors.ink, letterSpacing: -0.2 },
  serif: { fontFamily: fonts.serifRegular, fontSize: 17, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 15, lineHeight: 22, color: colors.body },
  bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  meta: { fontFamily: fonts.monoRegular, fontSize: 12, lineHeight: 17, color: colors.muted },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },

  primary: {
    backgroundColor: colors.clay,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow,
  },
  primaryPressed: { backgroundColor: colors.clayPress, transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  primaryLabel: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', letterSpacing: 0.2 },

  secondary: {
    backgroundColor: colors.sheet,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  secondaryLabel: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink },

  link: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  disabled: { opacity: 0.45 },
});
