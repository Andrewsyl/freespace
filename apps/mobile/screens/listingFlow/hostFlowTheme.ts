import { colors } from "../../styles/theme";

export const hostFlowColors = {
  bg: colors.pageBg,
  appBg: colors.appBg,
  appBgDeep: colors.accentSoft,
  cardBg: colors.cardBg,
  cardBgMuted: colors.cardBgMuted,
  border: colors.border,
  borderStrong: colors.borderStrong,
  divider: colors.divider,
  text: colors.text,
  textMuted: colors.textMuted,
  textSoft: colors.textSoft,
  accent: colors.primary,
  accentSoft: colors.accentSoft,
  accentSoftBorder: colors.accent,
  mint: colors.mint,
};

export const hostFlowShadow = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;
