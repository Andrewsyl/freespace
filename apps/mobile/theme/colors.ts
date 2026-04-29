import { mobileDesignTokens as designTokens } from "../designTokens";

const color = designTokens.color;

export const colors = {
  background: {
    primary: color.surface.page,
    secondary: color.surface.card,
    tertiary: color.surface.muted,
    accent: color.surface.accent,
    splash: color.surface.splash,
  },
  surface: color.surface.card,
  primary: {
    main: color.accent.primary,
    light: color.brand[400],
    dark: color.brand[600],
    subtle: color.accent.subtle,
  },
  brand: {
    teal: color.accent.primary,
    tealSoft: color.accent.soft,
  },
  secondary: {
    main: color.status.info,
    light: "#60a5fa",
    dark: "#2563eb",
  },
  text: {
    primary: color.text.strong,
    dark: color.text.primary,
    secondary: color.text.secondary,
    muted: color.text.muted,
    slate: "#475569",
    tertiary: color.text.tertiary,
    inverse: color.text.inverse,
    disabled: color.text.disabled,
  },
  overlay: {
    strong: color.surface.overlayDark,
  },
  error: {
    main: color.status.danger,
    strong: color.status.dangerStrong,
  },
  success: color.status.success,
  warning: color.status.warning,
  info: color.status.info,
  border: color.border.default,
  divider: color.border.subtle,
  overlayDark: "rgba(0, 0, 0, 0.5)",
  rating: {
    active: color.rating.active,
    inactive: color.rating.inactive,
  },
};
