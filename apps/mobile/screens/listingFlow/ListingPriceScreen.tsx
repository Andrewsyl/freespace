import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BadgeCheck } from "lucide-react-native";
import { useListingFlow } from "./context";
import { applyServiceFee } from "../../utils/pricing";
import { suggestPrices } from "../../utils/priceSuggestions";
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

// Daily rate ≈ 6 hours of parking — used to auto-derive an hourly rate from
// the host's daily rate until they edit hourly themselves.
const HOURS_PER_DAY_RATIO = 6;

const PRICING_MODES = [
  {
    key: "hourly_daily",
    label: "Hourly & daily",
    sub: "Short stays — drivers book your space by the hour or day.",
  },
  {
    key: "monthly",
    label: "Monthly",
    sub: "Long-term parking — drivers enquire to arrange a monthly space.",
  },
  {
    key: "both",
    label: "Both",
    sub: "Offer short stays and monthly parking from the one listing.",
  },
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
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
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
        {/* Boxed chip so the rate reads as an editable field, not static text;
            the whole chip focuses the input. */}
        <Pressable
          style={[fieldStyles.inputChip, focused && fieldStyles.inputChipFocused]}
          onPress={() => inputRef.current?.focus()}
        >
          <Text style={fieldStyles.euro}>€</Text>
          <TextInput
            ref={inputRef}
            style={fieldStyles.input}
            value={value}
            onChangeText={(v) => onChange(sanitize(v))}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              const v = parse(value);
              if (v) onChange(fmt(v));
            }}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            placeholder="0.00"
            placeholderTextColor={colors.textDisabled}
            selectTextOnFocus
          />
        </Pressable>
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
  inputChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: hostFlowColors.cardBgMuted,
    borderWidth: 1.5,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputChipFocused: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.cardBg,
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
    minWidth: 64,
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
  // May be undefined for a new listing until the host picks — that's what makes
  // the screen ask rather than default them into a mode.
  const pricingMode = draft.pricingMode;

  // Location-aware starting rates from the zone table (fetched at boot via
  // remoteConfig, baked-in fallback offline). Location and features are set on
  // earlier steps, so they can't change while this screen is mounted — compute
  // once. A saved draft's / existing listing's own prices always win below.
  const suggestion = useMemo(
    () =>
      suggestPrices({
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        features: draft.accessOptions,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [hourly,  setHourly]  = useState(fmt(parse(draft.pricePerHour)  ?? suggestion.hourly));
  const [daily,   setDaily]   = useState(fmt(parse(draft.pricePerDay)   ?? suggestion.daily));
  const [monthly, setMonthly] = useState(fmt(parse(draft.pricePerMonth) ?? suggestion.monthly));

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

  // Most hosts think in a daily price, not an hourly one — so until they edit
  // the hourly field themselves, derive it from the daily rate (6h of parking
  // per day) and say so. Editing hourly stops the derive.
  const onDailyChange = (v: string) => {
    withTouch("daily", setDaily)(v);
    if (!touched.hourly && !listingId) {
      const d = parse(v);
      if (d) setHourly(fmt(round2(d / HOURS_PER_DAY_RATIO)));
    }
  };
  const hourlyAutoDerived = !listingId && !touched.hourly && !!touched.daily;

  const hourlyVal = parse(hourly) ?? 0;
  const dailyVal  = parse(daily)  ?? 0;

  const dailyRatio = useMemo(() => {
    if (hourlyVal <= 0 || dailyVal <= 0) return null;
    return round2(dailyVal / hourlyVal);
  }, [dailyVal, hourlyVal]);

  const dailyHelper = useMemo(() => {
    if (!dailyRatio) return null;
    if (dailyRatio > 24) return `Your daily rate is ${dailyRatio}× this — drivers would pay less booking by the hour`;
    return `Your daily rate ≈ ${dailyRatio}× this hourly rate`;
  }, [dailyRatio]);

  const showHourlyDaily = pricingMode === "hourly_daily" || pricingMode === "both";
  const showMonthly     = pricingMode === "monthly"      || pricingMode === "both";

  // Driver-facing preview uses the same cent-level fee rounding as the API
  // (utils/pricing mirrors calculateListingChargeCents), so the numbers shown
  // here are exactly what drivers will see. Monthly is enquiry-based, so no
  // driver price is claimed for it.
  const driverPreview = useMemo(() => {
    if (!showHourlyDaily) return null;
    const parts: string[] = [];
    if (hourlyVal > 0) parts.push(`€${fmt(applyServiceFee(hourlyVal))}/hr`);
    if (dailyVal > 0) parts.push(`€${fmt(applyServiceFee(dailyVal))}/day`);
    return parts.length ? parts.join(" · ") : null;
  }, [dailyVal, hourlyVal, showHourlyDaily]);

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
              <Text style={styles.headerKicker}>Step 8 · Pricing</Text>
              <Text style={styles.headerTitle}>
                {pricingMode ? "Set your rates" : "How do you want to rent your space?"}
              </Text>
            </View>
          </View>

          {/* Pricing type card — the host explicitly chooses before any rate
              fields appear, rather than being dropped into a default mode. */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Rental type</Text>
            <View style={styles.optionsWrap}>
              {PRICING_MODES.map((mode, i) => {
                const active = pricingMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    style={[
                      styles.option,
                      i > 0 && styles.optionBorder,
                      active && styles.optionActive,
                    ]}
                    onPress={() => setDraft((p) => ({ ...p, pricingMode: mode.key }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                        {mode.label}
                      </Text>
                      <Text style={styles.optionSub}>{mode.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Rates card — only once a rental type is chosen */}
          {pricingMode ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderWrap}>
              <Text style={styles.cardHeaderTitle}>Rates</Text>
              {!listingId ? (
                <Text style={styles.suggestNote}>
                  Prefilled with typical rates for your area — change them anytime.
                </Text>
              ) : null}
            </View>
            {showHourlyDaily ? (
              <>
                <FieldRow
                  label="Daily"
                  value={daily}
                  onChange={onDailyChange}
                  suggested={isSuggested("daily", daily, suggestion.daily)}
                  isLast={false}
                />
                <FieldRow
                  label="Hourly"
                  value={hourly}
                  onChange={withTouch("hourly", setHourly)}
                  helper={
                    hourlyAutoDerived
                      ? "Auto-set from your daily rate — edit to override"
                      : dailyHelper
                  }
                  warning={!hourlyAutoDerived && !!dailyRatio && dailyRatio > 24}
                  suggested={isSuggested("hourly", hourly, suggestion.hourly)}
                  isLast={lastField === "daily" || lastField === "hourly"}
                />
              </>
            ) : null}
            {showMonthly ? (
              <FieldRow
                label="Monthly"
                value={monthly}
                onChange={withTouch("monthly", setMonthly)}
                suggested={isSuggested("monthly", monthly, suggestion.monthly)}
                isLast
              />
            ) : null}
          </View>
          ) : null}

          {showHourlyDaily ? (
            <View style={styles.keepCard}>
              <View style={styles.keepRow}>
                <BadgeCheck size={17} color={ACCENT} strokeWidth={2.2} />
                <Text style={styles.keepTitle}>You keep everything you set</Text>
              </View>
              <Text style={styles.keepBody}>
                The 8% service fee is added on top for the driver — it never comes
                out of your rate.
                {driverPreview ? (
                  <Text style={styles.keepBody}> Drivers will see {driverPreview}.</Text>
                ) : null}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <FlowFooter
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        primaryDisabled={!pricingMode}
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
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
  // Rates header variant: title + suggestion note share the bordered block.
  cardHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  cardHeaderTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
  suggestNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Rental-type option rows ──────────────────────────────────
  optionsWrap: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optionBorder: {
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
  },
  optionActive: {
    backgroundColor: hostFlowColors.accentSoft,
    // The soft-fill highlight replaces the divider so selected rows read as a
    // single contiguous block.
    borderTopColor: "transparent",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: hostFlowColors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioActive: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
  },
  optionTitleActive: {
    color: ACCENT,
  },
  optionSub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12.5,
    lineHeight: 17,
    color: hostFlowColors.textSoft,
  },

  // ── "You keep everything you set" advantage card ─────────────
  keepCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 16,
  },
  keepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  keepTitle: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  keepBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
