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
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarDays, Clock3 } from "lucide-react-native";
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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

      <View style={styles.footer}>
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
    paddingBottom: 140,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 31,
    fontWeight: "600",
    letterSpacing: -0.7,
    lineHeight: 36,
    marginTop: 12,
  },
  subtitle: {
    color: "#475467",
    fontFamily: "Inter-Regular",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 27,
    marginTop: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(17,24,39,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 34,
    overflow: "hidden",
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 90,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,24,39,0.06)",
  },
  priceRowLabelWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 14,
  },
  priceRowLabel: {
    color: "#15171A",
    fontFamily: "Inter-Medium",
    fontSize: 17,
    fontWeight: "500",
  },
  currency: {
    color: "#15171A",
    fontFamily: "Inter-SemiBold",
    fontSize: 24,
    fontWeight: "600",
    marginRight: 2,
  },
  inputShell: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(17,24,39,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 124,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputShellReadonly: {
    backgroundColor: "#F8FAFC",
  },
  priceInput: {
    color: "#15171A",
    fontFamily: "Inter-Medium",
    fontSize: 19,
    fontWeight: "500",
    padding: 0,
  },
  readonlyValue: {
    color: "#15171A",
    fontFamily: "Inter-Medium",
    fontSize: 19,
    fontWeight: "500",
  },
  noteCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  noteTitle: {
    color: "#15171A",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  noteBody: {
    color: "#667085",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20,
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
    backgroundColor: colors.appBg,
    borderTopColor: "rgba(17,24,39,0.06)",
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
    paddingBottom: 20,
  },
  continueBtn: {
    alignItems: "center",
    backgroundColor: "#14A44D",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 56,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
