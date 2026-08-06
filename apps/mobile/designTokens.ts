export const mobileDesignTokens = {
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
    mint: {
      100: "#d0fce8",
      300: "#63e8a7",
      500: "#0fa968",
    },
    neutral: {
      950: "#101414",
      900: "#161B1B",
      800: "#2B3030",
      700: "#444C4C",
      600: "#5F6868",
      500: "#8C9494",
      300: "#D9DEDE",
      200: "#E9EEEE",
      100: "#F5F7F7",
      50: "#FAFBFB",
      white: "#FFFFFF",
    },
    surface: {
      page: "#FAFBFB",
      app: "#FFFFFF",
      card: "#FFFFFF",
      muted: "#EDEFEF",
      subtle: "#FAFBFB",
      accent: "#E9F4EC",
      // Behind a listing hero that has no photo yet.
      heroDark: "#1B3A32",
      // Skeleton fill — a shade the eye reads as "not content".
      skeleton: "#E9EEEE",
      overlayLight: "rgba(255, 255, 255, 0.95)",
      overlayDark: "rgba(16, 20, 20, 0.58)",
      splash: "#0fa968",
    },
    text: {
      primary: "#101414",
      strong: "#101414",
      // Body copy that isn't the primary line.
      secondary: "#3F4747",
      muted: "#535B5B",
      soft: "#6F7878",
      // Sub-lines under a section header, and meta beneath a fact.
      tertiary: "#6E7676",
      inverse: "#FFFFFF",
      disabled: "#B7BDBD",
    },
    border: {
      // The faintest rule in the system — inside a tile, between rows that
      // still need separating. Lighter than `subtle`, which is the tile edge.
      hairline: "#EDF0F0",
      // Tile edges, and the masthead's closing rule. Light enough to describe
      // an edge without drawing one. This is the system's default border.
      subtle: "#DDE2E2",
      default: "#C7CFCF",
      strong: "#BEC8C8",
      field: "#C2CCCC",
    },
    accent: {
      primary: "#0fa968",
      subtle: "#d0fce8",
      soft: "#edf7f2",
    },
    status: {
      success: "#00A878",
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
    section: 48,
    hero: 64,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    // Small/medium card band (list rows, map card, review tiles) per
    // docs/PARKING_DESIGN_BIBLE.md Part E2 — MapBottomCard's existing 18 is
    // the calibration reference. `xl` (24) is reserved for hero surfaces.
    cardSmall: 18,
    xl: 24,
    xxl: 32,
    pill: 999,
    full: 9999,
  },
  layout: {
    screenX: 24,
    heroX: 32,
    cardPadding: 24,
    readingInset: 8,
  },
  shadow: {
    color: "#000000",
    cardNative: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
      elevation: 4,
    },
    focusNative: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  typography: {
    size: {
      caption: 14,
      label: 15,
      bodySm: 16,
      body: 17,
      bodyLg: 20,
      h4: 22,
      h3: 25,
      h2: 34,
      h1: 46,
      display: 52,
    },
    lineHeight: {
      caption: 19,
      label: 20,
      bodySm: 22,
      body: 24,
      bodyLg: 28,
      h4: 27,
      h3: 31,
      h2: 40,
      h1: 52,
      display: 58,
    },
  },
} as const;
