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
  textMuted: color.text.secondary,
  textSoft: color.text.soft,
  border: color.border.default,
  borderStrong: color.border.strong,
  accent: color.brand[700],
  accentSoft: color.brand[50],
  brandDark: color.brand[900],
  mint: color.mint[500],
  mintSoft: color.mint[100],
  danger: color.status.dangerStrong,
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
  card: designTokens.radius.xl,
  lg: designTokens.radius.xxl,
  pill: designTokens.radius.pill,
  sheet: designTokens.radius.xxl,
};

export const cardShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

export const floatingShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 6,
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
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.7,
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
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  bodyLarge: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  body: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  bodyStrong: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  bodyMedium: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter-Medium",
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter-SemiBold",
    fontWeight: "700" as const,
    letterSpacing: 0.7,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  button: {
    color: color.text.inverse,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  priceLarge: {
    color: colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -1.5,
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
    fontFamily: "Inter-SemiBold",
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
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  inputNeutralText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter-Regular",
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
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minHeight: 64,
    paddingHorizontal: spacing.xl,
    paddingVertical: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondary: {
    backgroundColor: color.neutral[100],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    minHeight: 58,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ghost: {
    borderRadius: radius.pill,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
