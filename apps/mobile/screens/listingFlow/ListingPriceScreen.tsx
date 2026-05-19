import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
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
import { cardShadow, colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const DEFAULT_HOURLY = 2.5;
const DEFAULT_DAILY = 15;
const WEEKLY_DAY_MULTIPLIER = 5;
const MONTHLY_DAY_MULTIPLIER = 20;

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
  value,
  editable = true,
  onChangeText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editable?: boolean;
  onChangeText?: (next: string) => void;
}) {
  return (
    <View style={styles.priceRow}>
      <View style={styles.priceRowLabelWrap}>
        {icon}
        <Text style={styles.priceRowLabel}>{label}</Text>
      </View>
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
  );
}

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();

  const initialHourly = parseMoney(draft.pricePerHour) ?? DEFAULT_HOURLY;
  const initialDaily = parseMoney(draft.pricePerDay) ?? DEFAULT_DAILY;

  const [hourlyPrice, setHourlyPrice] = useState(formatMoney(initialHourly));
  const [dailyPrice, setDailyPrice] = useState(formatMoney(initialDaily));

  const hourlyValue = parseMoney(hourlyPrice) ?? 0;
  const dailyValue = parseMoney(dailyPrice) ?? 0;
  const weeklyValue = useMemo(
    () => formatMoney(dailyValue * WEEKLY_DAY_MULTIPLIER),
    [dailyValue]
  );
  const monthlyValue = useMemo(
    () => formatMoney(dailyValue * MONTHLY_DAY_MULTIPLIER),
    [dailyValue]
  );
  const dailyCapFromHourly = useMemo(
    () => (hourlyValue > 0 ? roundMoney(hourlyValue * 24) : 0),
    [hourlyValue]
  );
  const pricingWarning = useMemo(() => {
    if (hourlyValue <= 0 || dailyValue <= 0) return null;
    if (dailyValue > dailyCapFromHourly) {
      return `Your daily price is higher than 24 hours at your hourly rate (€${formatMoney(
        dailyCapFromHourly
      )}). Longer stays should usually be cheaper or equal.`;
    }
    return null;
  }, [dailyCapFromHourly, dailyValue, hourlyValue]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      rateType: prev.rateType ?? "hourly",
      pricePerHour: hourlyPrice,
      pricePerDay: dailyPrice,
    }));
  }, [dailyPrice, hourlyPrice, setDraft]);

  const handleHourlyChange = (next: string) => {
    setHourlyPrice(sanitizeMoneyInput(next));
  };

  const handleDailyChange = (next: string) => {
    setDailyPrice(sanitizeMoneyInput(next));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Space pricing</Text>
        <StepProgress current={5} total={7} />

        <Text style={styles.title}>Set the space pricing</Text>
        <Text style={styles.subtitle}>
          Set realistic parking prices for short and long stays. Hourly and daily are your real bookable rates. Weekly and monthly are guidance values based on the daily price.
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
                <Text style={styles.warningTitle}>Check your pricing</Text>
                <Text style={styles.warningBody}>{pricingWarning}</Text>
              </View>
            </View>
          ) : null}
          <PricingRow
            icon={<CalendarDays size={22} color="#15171A" strokeWidth={2.2} />}
            label="Weekly"
            value={weeklyValue}
            editable={false}
          />
          <PricingRow
            icon={<CalendarDays size={22} color="#15171A" strokeWidth={2.2} />}
            label="Monthly"
            value={monthlyValue}
            editable={false}
          />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>How this works</Text>
          <Text style={styles.noteBody}>
            Drivers booking short stays will see your hourly price. Longer stays can use your daily price instead of an unrealistic hourly rollover.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.continueBtn} onPress={() => navigation.navigate("ListingPhotos")}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </View>
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
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
    overflow: "hidden",
    ...cardShadow,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 84,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceRowLabelWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 14,
  },
  priceRowLabel: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    fontWeight: "700",
  },
  currency: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24,
    fontWeight: "700",
    marginRight: 2,
  },
  inputShell: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 124,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputShellReadonly: {
    backgroundColor: colors.cardBgMuted,
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
    borderRadius: 24,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  noteTitle: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  noteBody: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F6AD55",
    borderRadius: 16,
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
    borderRadius: 16,
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
