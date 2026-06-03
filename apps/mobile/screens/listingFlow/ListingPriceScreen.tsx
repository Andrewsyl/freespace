import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Clock3, CalendarRange } from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { hostFlowColors } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const GREEN  = hostFlowColors.accent;
const LINE   = "#E6E6E4";
const FG     = "#111827";
const MUTED  = "#6b7280";
const SUBTLE = "#9ca3af";

const DEFAULT_HOURLY  = 1;
const DEFAULT_DAILY   = 12;
const DEFAULT_MONTHLY = 100;

const PRICING_MODES = [
  { key: "hourly_daily", label: "Hourly / Daily" },
  { key: "monthly",      label: "Monthly" },
  { key: "both",         label: "Both" },
] as const;

function roundMoney(v: number) { return Math.round(v * 100) / 100; }
function formatMoney(v: number) { return roundMoney(v).toFixed(2); }
function parseMoney(v: string) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? roundMoney(n) : null;
}
function sanitize(v: string) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = s.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function PriceField({
  icon,
  label,
  hint,
  value,
  editable = true,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        {icon}
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      <View style={[fieldStyles.inputRow, !editable && fieldStyles.inputRowReadonly]}>
        <Text style={fieldStyles.euro}>€</Text>
        {editable ? (
          <TextInput
            style={fieldStyles.input}
            value={value}
            onChangeText={onChange}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            placeholder="0.00"
            placeholderTextColor={SUBTLE}
            selectTextOnFocus
          />
        ) : (
          <Text style={fieldStyles.inputReadonly}>{value}</Text>
        )}
      </View>
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    color: "#888888",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  inputRowReadonly: {
    backgroundColor: "#F0F0EF",
  },
  euro: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: MUTED,
  },
  input: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    padding: 0,
    includeFontPadding: false,
  },
  inputReadonly: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: MUTED,
  },
  hint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
    marginTop: 6,
  },
});

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();

  const initialHourly  = parseMoney(draft.pricePerHour)  ?? DEFAULT_HOURLY;
  const initialDaily   = parseMoney(draft.pricePerDay)   ?? DEFAULT_DAILY;
  const initialMonthly = parseMoney(draft.pricePerMonth) ?? DEFAULT_MONTHLY;
  const pricingMode    = draft.pricingMode ?? "both";

  const [hourly,  setHourly]  = useState(formatMoney(initialHourly));
  const [daily,   setDaily]   = useState(formatMoney(initialDaily));
  const [monthly, setMonthly] = useState(formatMoney(initialMonthly));

  const hourlyVal  = parseMoney(hourly)  ?? 0;
  const dailyVal   = parseMoney(daily)   ?? 0;
  const dailyCap   = useMemo(() => hourlyVal > 0 ? roundMoney(hourlyVal * 24) : 0, [hourlyVal]);
  const warning    = useMemo(() => {
    if (hourlyVal <= 0 || dailyVal <= 0) return null;
    if (dailyVal > dailyCap) {
      return `Daily rate €${formatMoney(dailyVal)} exceeds 24× your hourly (€${formatMoney(dailyCap)}). Drivers would be better off booking hourly — lower your daily rate.`;
    }
    return null;
  }, [dailyCap, dailyVal, hourlyVal]);

  useEffect(() => {
    setDraft((p) => ({ ...p, pricePerHour: hourly, pricePerDay: daily, pricePerMonth: monthly }));
  }, [daily, hourly, monthly, setDraft]);

  const showHourlyDaily = pricingMode === "hourly_daily" || pricingMode === "both";
  const showMonthly     = pricingMode === "monthly"      || pricingMode === "both";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Space pricing</Text>
          <StepProgress current={6} total={8} />
          <Text style={styles.title}>Set your rates</Text>
          <Text style={styles.subtitle}>
            Choose whether this space is for short stays, monthly parking, or both.
          </Text>

          {/* Mode tabs */}
          <View style={styles.modeTabs}>
            {PRICING_MODES.map((mode) => {
              const active = pricingMode === mode.key;
              return (
                <Pressable
                  key={mode.key}
                  style={[styles.modeTab, active && styles.modeTabActive]}
                  onPress={() => setDraft((p) => ({ ...p, pricingMode: mode.key }))}
                >
                  <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Pricing fields */}
          <View style={styles.card}>
            {showHourlyDaily ? (
              <>
                <PriceField
                  icon={<Clock3 size={16} color="#888888" strokeWidth={2.2} />}
                  label="Hourly"
                  value={hourly}
                  onChange={(v) => setHourly(sanitize(v))}
                />
                <PriceField
                  icon={<CalendarDays size={16} color="#888888" strokeWidth={2.2} />}
                  label="Daily"
                  value={daily}
                  onChange={(v) => setDaily(sanitize(v))}
                />
              </>
            ) : null}

            {warning && showHourlyDaily ? (
              <View style={styles.warningWrap}>
                <View style={styles.warningCard}>
                  <Text style={styles.warningTitle}>Pricing conflict</Text>
                  <Text style={styles.warningBody}>{warning}</Text>
                </View>
              </View>
            ) : null}

            {showMonthly ? (
              <PriceField
                icon={<CalendarRange size={16} color="#888888" strokeWidth={2.2} />}
                label="Monthly"
                value={monthly}
                onChange={(v) => setMonthly(sanitize(v))}
              />
            ) : null}
          </View>

          <Text style={styles.footnote}>
            Rates are shown to drivers. FreeSpace applies a {10}% platform fee per booking.
          </Text>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.footerRow}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
            <Pressable style={styles.continueBtn} onPress={() => navigation.navigate("ListingPhotos")}>
              <Text style={styles.continueBtnText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  // ── Header ───────────────────────────────────────────────────
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 10,
  },
  subtitle: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },

  scroll: { paddingHorizontal: spacing.screenX, paddingTop: 0 },

  // ── Mode tabs ────────────────────────────────────────────────
  modeTabs: {
    flexDirection: "row", gap: 6,
    backgroundColor: "#EEEEEC", borderRadius: 14,
    padding: 5, marginTop: 14,
  },
  modeTab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderRadius: 10, minHeight: 40, paddingHorizontal: 8,
  },
  modeTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  modeTabText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13,
    color: MUTED, textAlign: "center",
  },
  modeTabTextActive: { color: FG },

  // ── Card ─────────────────────────────────────────────────────
  card: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE,
    overflow: "hidden", marginTop: 14,
  },

  // ── Warning ──────────────────────────────────────────────────
  warningWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  warningCard: {
    backgroundColor: "#FFF7ED", borderRadius: 12,
    borderWidth: 1, borderColor: "#F6AD55",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  warningTitle: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: "#9A3412", marginBottom: 3,
  },
  warningBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: "#9A3412", lineHeight: 19,
  },

  // ── Footnote ─────────────────────────────────────────────────
  footnote: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE,
    lineHeight: 18, marginTop: 14, textAlign: "center",
  },

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    backgroundColor: "#ffffff", borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE, paddingHorizontal: 20, paddingTop: 12,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    alignItems: "center", justifyContent: "center",
    borderRadius: 14, borderWidth: 1, borderColor: LINE,
    height: 52, paddingHorizontal: 20,
  },
  backBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: MUTED },
  continueBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: GREEN, borderRadius: 14, height: 52,
  },
  continueBtnText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#ffffff", letterSpacing: -0.2,
  },
});
