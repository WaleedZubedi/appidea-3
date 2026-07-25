/**
 * Type system — Fraunces (serif, headlines + Bixi's spoken lines + specimen labels),
 * Hanken Grotesk (UI/body), IBM Plex Mono (eyebrows / field-note meta / stats).
 * Family strings match the @expo-google-fonts exports loaded in app/_layout.tsx.
 */
export const fonts = {
  serifRegular: 'Fraunces_400Regular',
  serif: 'Fraunces_500Medium',
  serifSemibold: 'Fraunces_600SemiBold',

  sansRegular: 'HankenGrotesk_400Regular',
  sans: 'HankenGrotesk_500Medium',
  sansSemibold: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',

  monoRegular: 'IBMPlexMono_400Regular',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
} as const;

/** hard offset shadow like the landing's interactive cards (4px 4px 0 ink) */
export const hardShadow = {
  shadowColor: '#1e1913',
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;

export const softShadow = {
  shadowColor: '#1e1913',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const;
