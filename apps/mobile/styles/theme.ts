import { mobileDesignTokens as designTokens } from "../designTokens";

const color = designTokens.color;
const type = designTokens.typography;

export const colors = {
  appBg: color.surface.app,
  cardBg: color.surface.card,
  cardBgMuted: color.surface.muted,
  headerTint: color.brand[700],
  overlayLight: color.surface.overlayLight,
  text: color.text.primary,
  textDisabled: color.text.disabled,
  textInverse: color.text.inverse,
  textMuted: color.text.secondary,
  textSoft: color.text.soft,
  border: color.border.default,
  borderStrong: color.border.strong,
  // Hairline dividers/card borders that should read as barely-there — not the
  // stronger `border`/`borderStrong` pair used for control outlines.
  divider: color.border.subtle,
  accent: color.brand[500],
  accentSoft: color.brand[50],
  // Soft-green tile ground (amenity/category tiles, chip fills) — a notch
  // more visible than `accentSoft`, distinct token per designTokens'
  // `surface.accent`.
  tileBg: color.surface.accent,
  // The green actually used for primary CTAs/live-status across the app
  // (brand[600], #0a8050) — distinct from `accent` (brand[500]), which is a
  // lighter tone used for secondary-button outlines/spinners.
  primary: color.brand[600],
  // Tinted page background (screens sat on ad hoc near-white hex like
  // #F8FAFC); `appBg` stays pure white for cards/sheets.
  pageBg: color.surface.page,
  brandDark: color.brand[900],
  mint: color.mint[500],
  mintSoft: color.mint[100],
  danger: color.status.dangerStrong,
  warning: color.status.warning,
  status: {
    active: { background: color.brand[50], border: color.brand[700], text: color.brand[700] },
    canceled: { background: "#FEE2E2", border: "#EF4444", text: "#991B1B" },
    completed: { background: color.neutral[100], border: color.neutral[500], text: color.neutral[600] },
    confirmed: { background: color.brand[50], border: color.brand[700], text: color.brand[700] },
    pending: { background: "#FFF8BF", border: color.status.warning, text: "#5A3800" },
    refunded: { background: "#DBEAFE", border: color.status.info, text: "#1E40AF" },
  },
  star: {
    active: color.text.strong,
    inactive: color.rating.inactive,
    // Amber fill for interactive review stars (rate-your-stay moments); the
    // ink `active` is for static rating displays.
    review: color.rating.active,
  },
};

export const spacing = {
  xxs: 4,
  xs: designTokens.spacing.xs,
  sm: designTokens.spacing.sm,
  md: designTokens.spacing.md,
  lg: designTokens.spacing.lg,
  xl: designTokens.spacing.xl,
  xxl: designTokens.spacing.xxl,
  xxxl: designTokens.spacing.xxxl,
  screenX: designTokens.layout.screenX,
  screenY: designTokens.spacing.md,
  card: designTokens.layout.cardPadding,
  gap: designTokens.spacing.sm,
  readingInset: designTokens.layout.readingInset,
  section: designTokens.spacing.section,
  hero: designTokens.spacing.hero,
};

export const radius = {
  sm: designTokens.radius.sm,
  md: designTokens.radius.md,
  // Small/medium cards (list rows, map card, review tiles) — see
  // docs/PARKING_DESIGN_BIBLE.md Part E2. `card` (24) is for hero surfaces.
  cardSmall: designTokens.radius.cardSmall,
  card: designTokens.radius.xl,
  lg: designTokens.radius.xxl,
  pill: designTokens.radius.pill,
  sheet: designTokens.radius.xxl,
};

export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

export const floatingShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 6,
};

export const primaryButtonShadow = {
  shadowColor: "#0a7a50",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.28,
  shadowRadius: 14,
  elevation: 5,
};

export const textStyles = {
  displayHero: {
    color: colors.brandDark,
    fontSize: 46,
    lineHeight: 52,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -1.2,
    textTransform: "uppercase" as const,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.6,
  },
  kicker: {
    color: colors.accent,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.4,
  },
  titleSmall: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.4,
  },
  sectionIntro: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  bodyLarge: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  body: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  bodyStrong: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  bodyMedium: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans-Medium",
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "700" as const,
    letterSpacing: 0.7,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  button: {
    color: color.text.inverse,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  priceLarge: {
    color: colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -1.5,
  },
  // Card/list price — deliberately louder than a card title (see
  // docs/PARKING_DESIGN_BIBLE.md A6): price is the decision, not a peer fact.
  priceCard: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -0.8,
  },
};

export const surfaces = {
  screen: {
    backgroundColor: colors.appBg,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    ...cardShadow,
  },
  cardMuted: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderColor: colors.border,
    borderWidth: 1,
    ...cardShadow,
  },
};

export const fields = {
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  inputNeutral: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputFocused: {
    borderBottomColor: colors.accent,
  },
  inputError: {
    borderBottomColor: colors.danger,
  },
  inputText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  inputNeutralText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  placeholderTextColor: colors.textMuted,
  helpText: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
};

export const buttons = {
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: spacing.xl,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondary: {
    backgroundColor: color.neutral[100],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: 11,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ghost: {
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
