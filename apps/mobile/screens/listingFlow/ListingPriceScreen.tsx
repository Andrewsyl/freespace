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
import { CalendarDays, Clock3 } from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const DEFAULT_HOURLY = 1;
const DEFAULT_DAILY = 12;
const DEFAULT_MONTHLY = 100;
const PRICING_MODES = [
  { key: "hourly_daily", label: "Hourly / Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "both", label: "Both" },
] as const;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeMoneyInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = normalized.split(".");
  const decimal = rest.join("").slice(0, 2);
  if (rest.length > 0) {
    return `${whole}.${decimal}`;
  }
  return whole;
}

function formatMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

function parseMoney(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : null;
}

function PricingRow({
  icon,
  label,
  hint,
  value,
  editable = true,
  onChangeText,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: string;
  editable?: boolean;
  onChangeText?: (next: string) => void;
}) {
  const decimalKeyboardType = Platform.OS === "ios" ? "decimal-pad" : "numeric";

  return (
    <View style={styles.priceRow}>
      <View style={styles.priceRowTop}>
        <View style={styles.priceRowLeft}>
          {icon}
          <Text style={styles.priceRowLabel}>{label}</Text>
        </View>
        <View style={styles.priceRowRight}>
          <Text style={styles.currency}>€</Text>
          <View style={[styles.inputShell, !editable && styles.inputShellReadonly]}>
            {editable ? (
              <TextInput
                style={styles.priceInput}
                value={value}
                onChangeText={onChangeText}
                keyboardType={decimalKeyboardType}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.readonlyValue}>{value}</Text>
            )}
          </View>
        </View>
      </View>
      {hint ? <Text style={styles.priceRowHint}>{hint}</Text> : null}
    </View>
  );
}

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();

  const initialHourly = parseMoney(draft.pricePerHour) ?? DEFAULT_HOURLY;
  const initialDaily = parseMoney(draft.pricePerDay) ?? DEFAULT_DAILY;
  const initialMonthly = parseMoney(draft.pricePerMonth) ?? DEFAULT_MONTHLY;
  const pricingMode = draft.pricingMode ?? "both";

  const [hourlyPrice, setHourlyPrice] = useState(formatMoney(initialHourly));
  const [dailyPrice, setDailyPrice] = useState(formatMoney(initialDaily));
  const [monthlyPrice, setMonthlyPrice] = useState(formatMoney(initialMonthly));

  const hourlyValue = parseMoney(hourlyPrice) ?? 0;
  const dailyValue = parseMoney(dailyPrice) ?? 0;
  const monthlyValue = parseMoney(monthlyPrice) ?? 0;
  const dailyCapFromHourly = useMemo(
    () => (hourlyValue > 0 ? roundMoney(hourlyValue * 24) : 0),
    [hourlyValue]
  );
  const pricingWarning = useMemo(() => {
    if (hourlyValue <= 0 || dailyValue <= 0) return null;
    if (dailyValue > dailyCapFromHourly) {
      return `Your daily price (€${formatMoney(dailyValue)}) is higher than 24× your hourly rate (€${formatMoney(dailyCapFromHourly)}). Drivers would pay less booking 24 individual hours — lower your daily rate or raise your hourly rate.`;
    }
    return null;
  }, [dailyCapFromHourly, dailyValue, hourlyValue]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      rateType: prev.rateType ?? "hourly",
      pricePerHour: hourlyPrice,
      pricePerDay: dailyPrice,
      pricePerMonth: monthlyPrice,
    }));
  }, [dailyPrice, hourlyPrice, monthlyPrice, setDraft]);

  const handleHourlyChange = (next: string) => {
    setHourlyPrice(sanitizeMoneyInput(next));
  };

  const handleDailyChange = (next: string) => {
    setDailyPrice(sanitizeMoneyInput(next));
  };

  const handleMonthlyChange = (next: string) => {
    setMonthlyPrice(sanitizeMoneyInput(next));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Space pricing</Text>
        <StepProgress current={5} total={7} />

        <Text style={styles.title}>Set your rates</Text>
        <Text style={styles.subtitle}>
          Choose whether this space is for short stays, monthly commuter parking, or both.
        </Text>

        <View style={styles.modeTabs}>
          {PRICING_MODES.map((mode) => {
            const active = pricingMode === mode.key;
            return (
              <Pressable
                key={mode.key}
                style={[styles.modeTab, active && styles.modeTabActive]}
                onPress={() =>
                  setDraft((prev) => ({
                    ...prev,
                    pricingMode: mode.key,
                  }))
                }
              >
                <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{mode.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          {(pricingMode === "hourly_daily" || pricingMode === "both") ? (
            <>
              <PricingRow
                icon={<Clock3 size={22} color="#15171A" strokeWidth={2.2} />}
                label="Hourly"
                value={hourlyPrice}
                onChangeText={handleHourlyChange}
              />
              <PricingRow
                icon={<CalendarDays size={22} color="#15171A" strokeWidth={2.2} />}
                label="Daily"
                value={dailyPrice}
                onChangeText={handleDailyChange}
              />
            </>
          ) : null}
          {pricingWarning && (pricingMode === "hourly_daily" || pricingMode === "both") ? (
            <View style={styles.inlineWarningWrap}>
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Pricing conflict</Text>
                <Text style={styles.warningBody}>{pricingWarning}</Text>
              </View>
            </View>
          ) : null}
          {(pricingMode === "monthly" || pricingMode === "both") ? (
            <PricingRow
              icon={<CalendarDays size={22} color="#15171A" strokeWidth={2.2} />}
              label="Monthly"
              value={monthlyPrice}
              onChangeText={handleMonthlyChange}
            />
          ) : null}
        </View>

      </ScrollView>

      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.continueBtn} onPress={() => navigation.navigate("ListingPhotos")}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
    paddingBottom: 116,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.6,
    lineHeight: 31,
    marginTop: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 8,
  },
  modeTabs: {
    backgroundColor: "#EEF2F1",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    padding: 6,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
  },
  modeTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  modeTabText: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  modeTabTextActive: {
    color: colors.text,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    overflow: "hidden",
  },
  priceRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  priceRowTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  priceRowRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  priceRowLabel: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    fontWeight: "700",
  },
  priceRowHint: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    fontWeight: "400",
    marginTop: 5,
    paddingLeft: 34,
  },
  currency: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    fontWeight: "700",
  },
  inputShell: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 124,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputShellReadonly: {
    backgroundColor: colors.appBg,
  },
  priceInput: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    fontWeight: "700",
    padding: 0,
  },
  readonlyValue: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    fontWeight: "700",
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F6AD55",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inlineWarningWrap: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 16,
  },
  warningTitle: {
    color: "#9A3412",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  warningBody: {
    color: "#9A3412",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  continueBtn: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
