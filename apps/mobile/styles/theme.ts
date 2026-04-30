import { mobileDesignTokens as designTokens } from "../designTokens";

const color = designTokens.color;
const type = designTokens.typography;

export const colors = {
  appBg: color.surface.app,
  cardBg: color.surface.card,
  cardBgMuted: color.surface.subtle,
  headerTint: color.accent.primary,
  overlayLight: color.surface.overlayLight,
  text: color.text.primary,
  textDisabled: color.text.disabled,
  textMuted: color.text.secondary,
  textSoft: color.text.soft,
  border: color.border.default,
  borderStrong: color.border.strong,
  accent: color.accent.primary,
  accentSoft: color.accent.soft,
  danger: color.status.dangerStrong,
  status: {
    active: { background: "#ede9fe", border: "#a855f7", text: "#6b21a8" },
    canceled: { background: "#fee2e2", border: "#ef4444", text: "#991b1b" },
    completed: { background: "#f3f4f6", border: "#6b7280", text: "#6b7280" },
    confirmed: { background: "#ecfdf5", border: color.accent.primary, text: color.accent.primary },
    pending: { background: "#fef3c7", border: color.status.warning, text: "#b45309" },
    refunded: { background: "#dbeafe", border: color.status.info, text: "#1e40af" },
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
  screenX: designTokens.layout.screenX,
  screenY: designTokens.spacing.md,
  card: designTokens.layout.cardPadding,
  gap: designTokens.spacing.sm,
  readingInset: designTokens.layout.readingInset,
};

export const radius = {
  sm: designTokens.radius.sm,
  md: designTokens.radius.md,
  card: 14,
  lg: 22,
  pill: designTokens.radius.pill,
};

export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

export const textStyles = {
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  kicker: {
    color: colors.accent,
    fontSize: type.size.caption,
    fontFamily: "Poppins-Medium",
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  titleSmall: {
    color: colors.text,
    fontSize: type.size.h2,
    lineHeight: type.lineHeight.h2,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  sectionIntro: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins-Regular",
    fontWeight: "400" as const,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: type.size.bodySm,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  body: {
    color: colors.text,
    fontSize: type.size.bodySm,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  bodyStrong: {
    color: colors.text,
    fontSize: type.size.bodySm,
    lineHeight: type.lineHeight.bodySm,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  bodyMedium: {
    color: colors.textMuted,
    fontSize: type.size.bodySm,
    lineHeight: type.lineHeight.bodySm,
    fontFamily: "Inter-Medium",
    fontWeight: "500" as const,
  },
  meta: {
    color: colors.textMuted,
    fontSize: type.size.caption,
    lineHeight: type.lineHeight.caption,
    fontFamily: "Inter-Medium",
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  label: {
    color: colors.textSoft,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  button: {
    color: color.text.inverse,
    fontSize: type.size.body,
    lineHeight: type.lineHeight.bodySm,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: 0,
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
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter-Medium",
    fontWeight: "500" as const,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  inputNeutral: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputFocused: {
    borderBottomColor: colors.accent,
  },
  inputError: {
    borderBottomColor: colors.danger,
  },
  inputText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  inputNeutralText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-Regular",
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
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondary: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ghost: {
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
