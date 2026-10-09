/**
 * "Moria Regality" design tokens, transcribed from
 * ../moria-enterprise-backend/prototypes/shared/theme.js. That file is the
 * authority — when it changes, change this one to match.
 */
export const colors = {
  error: '#ba1a1a',
  onSurfaceVariant: '#4d444c',
  secondaryFixed: '#ffe088',
  surfaceContainerLowest: '#ffffff',
  monarchGold: '#d4af37',
  monarchGoldLight: '#f2d472',
  surfaceTint: '#79507a',
  onError: '#ffffff',
  lavenderMist: '#f3e8f5',
  surfaceVariant: '#e9e0e4',
  surfaceBright: '#fff7fa',
  inversePrimary: '#e9b6e7',
  surfaceContainer: '#f4ebf0',
  successEmerald: '#1b5e20',
  errorContainer: '#ffdad6',
  surfaceDim: '#e0d8dc',
  surfaceContainerHigh: '#efe6ea',
  surface: '#fff7fa',
  onBackground: '#1e1a1d',
  regalPlum: '#2d0a31',
  regalPlumLight: '#3a1040',
  primaryFixed: '#ffd6fc',
  inverseSurface: '#332f32',
  primaryContainer: '#2f0c33',
  secondaryContainer: '#fed65b',
  surfaceContainerHighest: '#e9e0e4',
  onPrimaryContainer: '#a275a2',
  outlineVariant: '#d0c3cc',
  inverseOnSurface: '#f7eef2',
  onSecondaryContainer: '#745c00',
  primary: '#000000',
  onPrimary: '#ffffff',
  onSurface: '#1e1a1d',
  background: '#fff7fa',
  outline: '#7f747c',
  errorCrimson: '#b71c1c',
  surfaceContainerLow: '#faf1f5',
  onErrorContainer: '#93000a',
  warningAmber: '#ff8f00',
  silkWhite: '#fcf8ff',
  secondary: '#735c00',
  white: '#ffffff',
} as const;

export const radius = { sm: 4, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999 } as const;

export const spacing = { base: 8, marginMobile: 16, gutterMobile: 16 } as const;

/** Font family names as registered by `useFonts` in the root layout. */
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemi: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
} as const;

/** The prototype's named type scale (`fontSize` in theme.js). */
export const type = {
  displayLg: { fontFamily: fonts.display, fontSize: 48, lineHeight: 56, letterSpacing: -0.96 },
  headlineLg: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  headlineLgMobile: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  headlineMd: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 32 },
  titleLg: { fontFamily: fonts.sansSemi, fontSize: 20, lineHeight: 28 },
  currencyDisplay: { fontFamily: fonts.sansBold, fontSize: 24, lineHeight: 32, letterSpacing: 0.48 },
  bodyLg: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  labelMd: { fontFamily: fonts.sansSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  /** The small uppercase eyebrow above screen titles ("EXECUTIVE DASHBOARD"). */
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
} as const;
