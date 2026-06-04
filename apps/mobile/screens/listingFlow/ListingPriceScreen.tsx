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
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const SERVICE_FEE = 0.08;

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
    <View style={[row.wrap, !isLast && row.border]}>
      <View style={row.inputGroup}>
        <Text style={row.label}>{label}</Text>
        <View style={row.inputRow}>
          <Text style={row.euro}>€</Text>
          <TextInput
            style={row.input}
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
        <Text style={[row.helper, warning && row.helperWarn]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0ee",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: hostFlowColors.text,
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
    color: hostFlowColors.text,
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

  // Determine which field is last for border logic
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
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Pricing</Text>
          <Text style={styles.title}>Set your rates</Text>

          {/* Market anchor */}
          <View style={styles.anchor}>
            <Text style={styles.anchorText}>
              Nearby spaces charge{" "}
              <Text style={styles.anchorBold}>€1–3/hr</Text>
              {" "}·{" "}
              <Text style={styles.anchorBold}>€8–15/day</Text>
            </Text>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabs}>
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

          {/* Fields */}
          <View style={styles.fieldCard}>
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

          <Text style={styles.footnote}>
            Drivers pay an 8% service fee on top. You keep 100%.
          </Text>
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
  container: { flex: 1, backgroundColor: "#f7f7f6" },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
    paddingBottom: 40,
  },

  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 28,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 8,
    marginBottom: 14,
  },

  anchor: {
    backgroundColor: hostFlowColors.accentSoft,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  anchorText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: hostFlowColors.textMuted,
  },
  anchorBold: {
    fontFamily: "PlusJakartaSans-Bold",
    color: hostFlowColors.accent,
  },

  tabs: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#e8e8e6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
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
    color: hostFlowColors.text,
  },

  fieldCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },

  footnote: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 18,
    marginTop: 12,
    textAlign: "center",
  },
});
