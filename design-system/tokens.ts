export const designTokens = {
  color: {
    brand: {
      50: "#f0fdf8",
      100: "#d0fce8",
      200: "#a2f5cc",
      300: "#63e8a7",
      400: "#2cc17e",
      500: "#0fa968",
      600: "#0a8050",
      700: "#0a6642",
      800: "#0b5237",
      900: "#0a4230",
    },
    surface: {
      page: "#F7F7F6",
      app: "#F7F7F6",
      card: "#ffffff",
      muted: "#f0f0ee",
      subtle: "#f7f7f6",
      accent: "#edf7f2",
      overlayLight: "rgba(255, 255, 255, 0.95)",
      overlayDark: "rgba(15, 23, 42, 0.6)",
      splash: "#0fa968",
    },
    text: {
      primary: "#0f172a",
      strong: "#0f172a",
      secondary: "#374151",
      muted: "#4b5563",
      soft: "#6b7280",
      tertiary: "#9ca3af",
      inverse: "#ffffff",
      disabled: "#d1d5db",
    },
    border: {
      subtle: "#f3f4f6",
      default: "#e5e7eb",
      strong: "#d1d5db",
      field: "#d7dee7",
    },
    accent: {
      primary: "#2ecc8f",
      subtle: "#d1fae5",
      soft: "#e7f7f0",
    },
    status: {
      success: "#2ecc8f",
      warning: "#f59e0b",
      info: "#3b82f6",
      danger: "#ef4444",
      dangerStrong: "#dc2626",
    },
    rating: {
      active: "#fbbf24",
      inactive: "#d1d5db",
    },
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
    full: 9999,
  },
  shadow: {
    color: "#0f172a",
    card: "0 16px 40px rgba(15, 23, 42, 0.08)",
    cardNative: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    focusNative: {
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
  },
  typography: {
    fontFamily: {
      sans: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      body: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    tracking: {
      tightest: "-0.04em",
      tight:    "-0.03em",
      snug:     "-0.015em",
      normal:   "0em",
      wide:     "0.02em",
      wider:    "0.08em",
      widest:   "0.16em",
      // legacy aliases
      heading: "-0.03em",
    },
    /**
     * Canonical type scale — single source of truth for FreeSpace typography.
     * Each step pairs size (px) with its correct line-height ratio and letter-spacing.
     * Tracking tightens as size grows; loosens slightly below 12px. Never positive on body.
     * NOTE: not wired into Tailwind's global `fontSize` on purpose (avoids shifting the
     * whole web app). Apply via arbitrary values, e.g. text-[15px] leading-[1.6].
     * px here is the cross-platform source of truth (React Native needs numbers);
     * the web mirrors these as rem CSS custom properties (--text-*) in
     * apps/web/app/globals.css for zoom / user-font-scaling accessibility.
     */
    scale: {
      xs:      { size: 11, lineHeight: 1.45, letterSpacing: "0.01em",   use: "micro labels, legal" },
      sm:      { size: 12, lineHeight: 1.5,  letterSpacing: "0.005em",  use: "captions, helper text" },
      label:   { size: 13, lineHeight: 1.4,  letterSpacing: "0em",      use: "form labels, nav links" },
      base:    { size: 15, lineHeight: 1.6,  letterSpacing: "0em",      use: "body default" },
      md:      { size: 16, lineHeight: 1.6,  letterSpacing: "0em",      use: "lead paragraphs, inputs (mobile)" },
      lg:      { size: 18, lineHeight: 1.4,  letterSpacing: "-0.01em",  use: "H4 / card titles" },
      xl:      { size: 20, lineHeight: 1.3,  letterSpacing: "-0.015em", use: "H3 / section titles" },
      "2xl":   { size: 24, lineHeight: 1.25, letterSpacing: "-0.02em",  use: "H2" },
      "3xl":   { size: 28, lineHeight: 1.2,  letterSpacing: "-0.02em",  use: "H1 (mobile)" },
      "4xl":   { size: 36, lineHeight: 1.1,  letterSpacing: "-0.03em",  use: "H1 (desktop) / hero" },
      display: { size: 48, lineHeight: 1.05, letterSpacing: "-0.04em",  use: "marketing hero" },
    },
    /** Uppercase eyebrow / section label — the unified letterspaced overline.
     *  Mirrored on web as --tracking-eyebrow in apps/web/app/globals.css. */
    eyebrow: { size: 11, weight: 700, letterSpacing: "0.18em" },
    size: {
      xs:      11,
      sm:      12,
      caption: 12,
      label:   13,
      bodySm:  14,
      base:    15,
      body:    15,
      md:      16,
      bodyLg:  16,
      h4:      16,
      h3:      18,
      lg:      18,
      xl:      20,
      h2:      20,
      "2xl":   24,
      "3xl":   28,
      h1:      28,
      "4xl":   36,
      display: 48,
    },
    lineHeight: {
      none:    1,
      tight:   1.15,
      snug:    1.3,
      normal:  1.5,
      relaxed: 1.65,
      loose:   1.8,
      // px values for React Native (legacy — prefer ratio tokens above)
      caption: 16,
      label:   18,
      bodySm:  20,
      body:    22,
      bodyLg:  24,
      h4:      22,
      h3:      24,
      h2:      26,
      h1:      34,
    },
  },
} as const;

export type DesignTokens = typeof designTokens;
