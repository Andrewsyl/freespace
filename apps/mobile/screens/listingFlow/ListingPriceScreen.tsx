import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: { fromReview?: boolean } | undefined;
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
  suggested?: boolean;
  isLast?: boolean;
};

function FieldRow({ label, value, onChange, helper, warning, suggested, isLast }: FieldRowProps) {
  return (
    <View style={[fieldStyles.wrap, !isLast && fieldStyles.border]}>
      <View style={fieldStyles.inputGroup}>
        <View style={fieldStyles.labelWrap}>
          <Text style={fieldStyles.label}>{label}</Text>
          {suggested ? (
            <View style={fieldStyles.suggestedPill}>
              <Text style={fieldStyles.suggestedPillText}>Suggested</Text>
            </View>
          ) : null}
        </View>
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
            placeholderTextColor={colors.textDisabled}
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
    borderBottomColor: hostFlowColors.border,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
    flexShrink: 1,
  },
  suggestedPill: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  suggestedPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    color: hostFlowColors.accent,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  euro: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: hostFlowColors.textMuted,
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
    color: hostFlowColors.textSoft,
    marginTop: 4,
  },
  helperWarn: {
    // Dark amber for text (amber #f59e0b on white is only ~2.2:1 and fails AA at
    // this 12px size); the amber token stays for dots/borders elsewhere.
    color: colors.status.pending.text,
  },
});

export function ListingPriceScreen({ navigation, route }: Props) {
  const { draft, setDraft, listingId } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  const pricingMode = draft.pricingMode ?? "both";

  const [hourly,  setHourly]  = useState(fmt(parse(draft.pricePerHour)  ?? DEFAULT_HOURLY));
  const [daily,   setDaily]   = useState(fmt(parse(draft.pricePerDay)   ?? DEFAULT_DAILY));
  const [monthly, setMonthly] = useState(fmt(parse(draft.pricePerMonth) ?? DEFAULT_MONTHLY));

  // Mark a rate as only a starting suggestion until the host edits it — a nudge
  // that they can (and should) set their own price, without adding a hard gate.
  // New listings only; an existing listing's saved prices are real choices.
  const [touched, setTouched] = useState<{ hourly?: boolean; daily?: boolean; monthly?: boolean }>({});
  const isSuggested = (field: "hourly" | "daily" | "monthly", value: string, def: number) =>
    !listingId && !touched[field] && parse(value) === def;
  const withTouch =
    (field: "hourly" | "daily" | "monthly", setter: (v: string) => void) => (v: string) => {
      if (!touched[field]) setTouched((t) => ({ ...t, [field]: true }));
      setter(v);
    };

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
      <FlowHeader current={8} total={9} onClose={exitFlow} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                  onChange={withTouch("hourly", setHourly)}
                  suggested={isSuggested("hourly", hourly, DEFAULT_HOURLY)}
                  isLast={!showHourlyDaily || lastField === "hourly"}
                />
                <FieldRow
                  label="Daily"
                  value={daily}
                  onChange={withTouch("daily", setDaily)}
                  helper={dailyHelper}
                  warning={!!dailyRatio && dailyRatio > 24}
                  suggested={isSuggested("daily", daily, DEFAULT_DAILY)}
                  isLast={lastField === "daily"}
                />
              </>
            ) : null}
            {showMonthly ? (
              <FieldRow
                label="Monthly"
                value={monthly}
                onChange={withTouch("monthly", setMonthly)}
                helper="Monthly requests arrive as enquiries — you confirm the arrangement with the driver."
                suggested={isSuggested("monthly", monthly, DEFAULT_MONTHLY)}
                isLast
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FlowFooter
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        onPrimary={() => navigation.navigate("ListingReview")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────
  headerCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: hostFlowColors.border,
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
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
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
    borderBottomColor: hostFlowColors.border,
  },

  // ── Pricing type tabs ────────────────────────────────────────
  tabsWrap: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: hostFlowColors.cardBgMuted,
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
    backgroundColor: hostFlowColors.cardBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: hostFlowColors.textMuted,
    textAlign: "center",
  },
  tabTextActive: {
    color: FG,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
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
