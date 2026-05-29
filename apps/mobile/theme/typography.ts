import { colors } from "./colors";
import { mobileDesignTokens as designTokens } from "../designTokens";

const type = designTokens.typography;

const fontFamily = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semiBold: "PlusJakartaSans-SemiBold",
};

export const typography = {
  // Page headers / Screen titles - bold and prominent
  display: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.display,
    fontWeight: "800" as const,
    lineHeight: type.lineHeight.display,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.h1,
    fontWeight: "800" as const,
    lineHeight: type.lineHeight.h1,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.h2,
    fontWeight: "700" as const,
    lineHeight: type.lineHeight.h2,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.h3,
    fontWeight: "700" as const,
    lineHeight: type.lineHeight.h3,
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.h4,
    fontWeight: "700" as const,
    lineHeight: type.lineHeight.h4,
    color: colors.text.primary,
  },
  // Body text - larger and more readable
  body: {
    fontFamily: fontFamily.regular,
    fontSize: type.size.body,
    fontWeight: "400" as const,
    lineHeight: type.lineHeight.body,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: type.size.body,
    fontWeight: "500" as const,
    lineHeight: type.lineHeight.body,
    color: colors.text.primary,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: type.size.bodySm,
    fontWeight: "400" as const,
    lineHeight: type.lineHeight.bodySm,
    color: colors.text.secondary,
  },
  // CTAs and primary actions - bolder
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.bodyLg,
    fontWeight: "600" as const,
    lineHeight: type.lineHeight.bodyLg,
    letterSpacing: 0,
  },
  buttonSmall: {
    fontFamily: fontFamily.semiBold,
    fontSize: type.size.bodySm,
    fontWeight: "600" as const,
    lineHeight: type.lineHeight.bodySm,
    letterSpacing: 0,
  },
  // Tab labels - slightly bolder
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0,
  },
  // Supporting text
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: type.size.caption,
    fontWeight: "400" as const,
    lineHeight: type.lineHeight.caption,
    color: colors.text.tertiary,
  },
  // Labels - bolder for better visibility
  label: {
    fontFamily: fontFamily.medium,
    fontSize: type.size.label,
    fontWeight: "600" as const,
    lineHeight: type.lineHeight.label,
    letterSpacing: 0.5,
    color: colors.text.secondary,
  },
};
