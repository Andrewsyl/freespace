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
import { CalendarDays, Clock3, Info } from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const DEFAULT_HOURLY = 2.5;
const DEFAULT_DAILY = 15;
const MONTHLY_DEFAULT_DAYS = 12;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeMoneyInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = normalized.split(".");
  const decimal = rest.join("").slice(0, 2);
  return decimal.length ? `${whole}.${decimal}` : whole;
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
                keyboardType="decimal-pad"
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
  const initialMonthly = parseMoney(draft.pricePerMonth) ?? roundMoney(initialDaily * MONTHLY_DEFAULT_DAYS);

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
          Drivers are always charged the lower of your applicable rates — your daily price automatically caps any hourly overflow.
        </Text>

        <View style={styles.card}>
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
          {pricingWarning ? (
            <View style={styles.inlineWarningWrap}>
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Pricing conflict</Text>
                <Text style={styles.warningBody}>{pricingWarning}</Text>
              </View>
            </View>
          ) : null}
          <PricingRow
            icon={<CalendarDays size={22} color="#15171A" strokeWidth={2.2} />}
            label="Monthly"
            value={monthlyPrice}
            onChangeText={handleMonthlyChange}
          />
        </View>

        <View style={styles.noteCard}>
          <View style={styles.noteTitleRow}>
            <Info size={16} color="#147A72" strokeWidth={2} />
            <Text style={styles.noteTitle}>How rates work</Text>
          </View>
          <View style={styles.noteList}>
            <Text style={styles.noteItem}>· Drivers pay the <Text style={styles.noteItemBold}>lower</Text> of your hourly or daily rate — a 5-hour booking at €3/hr would cost €12 if your daily rate is €12.</Text>
            <Text style={styles.noteItem}>· Set your <Text style={styles.noteItemBold}>daily rate lower</Text> than 24× your hourly rate so longer stays always get a fair deal.</Text>
            <Text style={styles.noteItem}>· The <Text style={styles.noteItemBold}>monthly rate</Text> defaults to roughly 40% off your daily rate — similar to what JustPark and YourParkingSpace spaces charge. Adjust it to match nearby commuter spaces.</Text>
          </View>
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
    fontFamily: "Inter-SemiBold",
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.6,
    lineHeight: 31,
    marginTop: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 8,
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
    fontFamily: "Inter-Regular",
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
  noteCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  noteTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  noteTitle: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    fontWeight: "700",
  },
  noteList: {
    gap: 10,
  },
  noteItem: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20,
  },
  noteItemBold: {
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    color: colors.text,
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
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  warningBody: {
    color: "#9A3412",
    fontFamily: "Inter-Regular",
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
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
