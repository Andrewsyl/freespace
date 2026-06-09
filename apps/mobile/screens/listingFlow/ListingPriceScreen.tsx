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
import { Info } from "lucide-react-native";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const DEFAULT_HOURLY  = 2;
const DEFAULT_DAILY   = 12;
const DEFAULT_MONTHLY = 100;

const PRICING_MODES = [
  { key: "hourly_daily", label: "Hourly / Daily" },
  { key: "monthly",      label: "Monthly" },
  { key: "both",         label: "All rates" },
] as const;

function round2(v: number) { return Math.round(v * 100) / 100; }
function fmt(v: number) { return round2(v).toFixed(2); }
function parse(v: string) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}
function sanitize(v: string) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [w, ...rest] = s.split(".");
  return rest.length > 0 ? `${w}.${rest.join("").slice(0, 2)}` : w;
}

type FieldRowProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string | null;
  warning?: boolean;
  isLast?: boolean;
};

function FieldRow({ label, value, onChange, helper, warning, isLast }: FieldRowProps) {
  return (
    <View style={[fieldStyles.wrap, !isLast && fieldStyles.border]}>
      <View style={fieldStyles.inputGroup}>
        <Text style={fieldStyles.label}>{label}</Text>
        <View style={fieldStyles.inputRow}>
          <Text style={fieldStyles.euro}>€</Text>
          <TextInput
            style={fieldStyles.input}
            value={value}
            onChangeText={(v) => onChange(sanitize(v))}
            onBlur={() => {
              const v = parse(value);
              if (v) onChange(fmt(v));
            }}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            placeholder="0.00"
            placeholderTextColor="#c8cdd6"
            selectTextOnFocus
          />
        </View>
      </View>
      {helper ? (
        <Text style={[fieldStyles.helper, warning && fieldStyles.helperWarn]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD2",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  euro: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#6b7280",
  },
  input: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    textAlign: "right",
    minWidth: 72,
    padding: 0,
    includeFontPadding: false,
  },
  helper: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  helperWarn: {
    color: "#d97706",
  },
});

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const pricingMode = draft.pricingMode ?? "both";

  const [hourly,  setHourly]  = useState(fmt(parse(draft.pricePerHour)  ?? DEFAULT_HOURLY));
  const [daily,   setDaily]   = useState(fmt(parse(draft.pricePerDay)   ?? DEFAULT_DAILY));
  const [monthly, setMonthly] = useState(fmt(parse(draft.pricePerMonth) ?? DEFAULT_MONTHLY));

  const hourlyVal = parse(hourly) ?? 0;
  const dailyVal  = parse(daily)  ?? 0;

  const dailyRatio = useMemo(() => {
    if (hourlyVal <= 0 || dailyVal <= 0) return null;
    return round2(dailyVal / hourlyVal);
  }, [dailyVal, hourlyVal]);

  const dailyHelper = useMemo(() => {
    if (!dailyRatio) return null;
    if (dailyRatio > 24) return `${dailyRatio}× hourly — drivers would pay less booking by the hour`;
    return `≈ ${dailyRatio}× your hourly rate`;
  }, [dailyRatio]);

  const showHourlyDaily = pricingMode === "hourly_daily" || pricingMode === "both";
  const showMonthly     = pricingMode === "monthly"      || pricingMode === "both";

  useEffect(() => {
    setDraft((p) => ({ ...p, pricePerHour: hourly, pricePerDay: daily, pricePerMonth: monthly }));
  }, [daily, hourly, monthly, setDraft]);

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  const lastField = showMonthly ? "monthly" : showHourlyDaily ? "daily" : "hourly";

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader current={7} total={8} onClose={exitFlow} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header card */}
          <View style={styles.headerCard}>
            <View style={styles.headerCardTop}>
              <Text style={styles.headerKicker}>Step 7 · Pricing</Text>
              <Text style={styles.headerTitle}>Set your rates</Text>
            </View>
            <View style={styles.headerCardBottom}>
              <Text style={styles.headerSubtitle}>You can update these at any time from your host dashboard.</Text>
            </View>
          </View>

          {/* Pricing type card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Pricing type</Text>
            <View style={styles.tabsWrap}>
              {PRICING_MODES.map((mode) => {
                const active = pricingMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setDraft((p) => ({ ...p, pricingMode: mode.key }))}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Rates card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Rates</Text>
            {showHourlyDaily ? (
              <>
                <FieldRow
                  label="Hourly"
                  value={hourly}
                  onChange={setHourly}
                  isLast={!showHourlyDaily || lastField === "hourly"}
                />
                <FieldRow
                  label="Daily"
                  value={daily}
                  onChange={setDaily}
                  helper={dailyHelper}
                  warning={!!dailyRatio && dailyRatio > 24}
                  isLast={lastField === "daily"}
                />
              </>
            ) : null}
            {showMonthly ? (
              <FieldRow
                label="Monthly"
                value={monthly}
                onChange={setMonthly}
                isLast
              />
            ) : null}
          </View>

          {/* Tips card */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsRow}>
              <Info size={15} color={ACCENT} strokeWidth={2.2} />
              <Text style={styles.tipsTitle}>Pricing tip</Text>
            </View>
            <Text style={styles.tipsBody}>
              Nearby spaces charge{" "}
              <Text style={styles.tipsBold}>€1–3/hr</Text> and{" "}
              <Text style={styles.tipsBold}>€8–15/day</Text>. Competitive pricing helps fill short-stay gaps between monthly bookings. Drivers pay an 8% service fee on top — you keep 100%.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel="Continue"
        onPrimary={() => navigation.navigate("ListingReview")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: "#E2DAD2",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerKicker: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  headerCardBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Cards ────────────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardHeader: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD2",
  },

  // ── Pricing type tabs ────────────────────────────────────────
  tabsWrap: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#EEF0F2",
    margin: 14,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 9,
  },
  tabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
  tabTextActive: {
    color: FG,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: "#F0FDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C6F0DC",
    padding: 16,
  },
  tipsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  tipsTitle: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tipsBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  tipsBold: {
    fontFamily: "PlusJakartaSans-Bold",
    color: ACCENT,
  },
});
