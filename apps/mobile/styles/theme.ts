export const colors = {
  appBg: "#FCFCFB",
  cardBg: "#ffffff",
  cardBgMuted: "#F8FAFC",
  headerTint: "#2ECC8F",
  overlayLight: "rgba(255, 255, 255, 0.95)",
  text: "#0f172a",
  textDisabled: "#D1D5DB",
  textMuted: "#6b7280",
  textSoft: "#94a3b8",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  accent: "#2ECC8F",
  accentSoft: "#E7F7F0",
  danger: "#dc2626",
  status: {
    active: { background: "#ede9fe", border: "#a855f7", text: "#6b21a8" },
    canceled: { background: "#fee2e2", border: "#ef4444", text: "#991b1b" },
    completed: { background: "#f3f4f6", border: "#6b7280", text: "#6b7280" },
    confirmed: { background: "#ecfdf5", border: "#2ECC8F", text: "#2ECC8F" },
    pending: { background: "#fef3c7", border: "#f59e0b", text: "#b45309" },
    refunded: { background: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  },
  star: {
    active: "#111827",
    inactive: "#D1D5DB",
  },
};

export const spacing = {
  screenX: 20,
  screenY: 16,
  card: 18,
  gap: 12,
};

export const radius = {
  card: 18,
  pill: 999,
};

export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
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
    fontSize: 12,
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
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Poppins-Regular",
    fontWeight: "400" as const,
  },
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
  },
  bodyStrong: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600" as const,
  },
  bodyMedium: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter-Medium",
    fontWeight: "500" as const,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
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
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: 0,
  },
};
