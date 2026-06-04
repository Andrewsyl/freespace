import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { KeyboardAvoidingView, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Cctv, CircleCheck, FileText, Hash, Key, Zap, Warehouse, Sun, ShieldCheck, ArrowUpDown, Accessibility, Clock, Bike, AlignHorizontalDistributeCenter } from "lucide-react-native";
import { TextInput as AppTextInput } from "../../components/ui";
import { spacing } from "../../styles/theme";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingFeaturesAccess: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingFeaturesAccess">;

type Feature = { label: string; icon: React.ReactNode; activeIcon: React.ReactNode };

function featureIcon(name: string, active: boolean) {
  const color = active ? hostFlowColors.accent : "#6b7280";
  const props = { size: 20, color, strokeWidth: 1.8 };
  switch (name) {
    case "CCTV":             return <Cctv {...props} />;
    case "EV charging":      return <Zap {...props} />;
    case "Sheltered":        return <Warehouse {...props} />;
    case "Well lit":         return <Sun {...props} />;
    case "Gated access":     return <ShieldCheck {...props} />;
    case "Height-friendly":  return <ArrowUpDown {...props} />;
    case "Disabled access":  return <Accessibility {...props} />;
    case "24/7 access":      return <Clock {...props} />;
    case "Motorbike friendly": return <Bike {...props} />;
    case "Wide bay":         return <AlignHorizontalDistributeCenter {...props} />;
    default:                 return <ShieldCheck {...props} />;
  }
}

const PRIMARY_FEATURES = ["CCTV", "EV charging", "Sheltered", "Well lit", "Gated access"];
const EXTRA_FEATURES   = ["Height-friendly", "Disabled access", "24/7 access", "Motorbike friendly", "Wide bay"];

const ACCESS_CHOICES = [
  {
    id: "key_fob" as const,
    label: "Key or security fob",
    description: "You'll share key collection details with drivers",
    optionValue: "Key or security fob" as const,
    icon: <Key size={20} color={hostFlowColors.accent} strokeWidth={1.8} />,
  },
  {
    id: "pin_code" as const,
    label: "Pin code",
    description: "A code that unlocks the entrance or barrier",
    optionValue: "Pin code" as const,
    icon: <Hash size={20} color={hostFlowColors.accent} strokeWidth={1.8} />,
  },
  {
    id: "special_instructions" as const,
    label: "Special instructions",
    description: "Custom arrival guidance drivers need to know",
    optionValue: "Special instructions" as const,
    icon: <FileText size={20} color={hostFlowColors.accent} strokeWidth={1.8} />,
  },
] as const;

type AccessChoiceId = typeof ACCESS_CHOICES[number]["id"];
type AccessChoiceValue = typeof ACCESS_CHOICES[number]["optionValue"];

export function ListingFeaturesAccessScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const accessInputYRef = useRef(0);

  const selectedAccessChoice = ACCESS_CHOICES.find(
    (c) => draft.accessOptions.includes(c.optionValue)
  ) ?? null;
  const needsAccessDetail = selectedAccessChoice !== null;
  const isSpecialInstructions = selectedAccessChoice?.id === "special_instructions";
  const hasAccessDetails = !needsAccessDetail || (
    isSpecialInstructions
      ? draft.arrivalInstructions.trim().length > 0
      : draft.accessCode.trim().length > 0
  );
  const canContinue =
    draft.requiresAccessCode !== null &&
    (draft.requiresAccessCode === false || selectedAccessChoice !== null) &&
    hasAccessDetails;

  const visibleFeatures = showAllFeatures
    ? [...PRIMARY_FEATURES, ...EXTRA_FEATURES]
    : PRIMARY_FEATURES;

  const scrollInputIntoView = (targetY: number) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 140), animated: true });
      }, 180);
    });
  };

  const toggleFeature = (option: string) => {
    setDraft((prev) => {
      const exists = prev.accessOptions.includes(option);
      return {
        ...prev,
        accessOptions: exists
          ? prev.accessOptions.filter((item) => item !== option)
          : [...prev.accessOptions, option],
      };
    });
  };

  const selectAccessChoice = (optionValue: AccessChoiceValue) => {
    setDraft((prev) => {
      const current = ACCESS_CHOICES.find((c) => prev.accessOptions.includes(c.optionValue));
      // Deselect if tapping the already-selected choice
      if (current?.optionValue === optionValue) {
        return {
          ...prev,
          accessOptions: prev.accessOptions.filter(
            (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
          ),
          accessCode: "",
          requiresArrivalInstructions: false,
          arrivalInstructions: "",
        };
      }
      const withoutAccess = prev.accessOptions.filter(
        (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
      );
      const next = ACCESS_CHOICES.find((c) => c.optionValue === optionValue)!;
      const isSpec = next.id === "special_instructions";
      return {
        ...prev,
        accessOptions: [...withoutAccess, next.optionValue],
        accessCode: isSpec ? "" : prev.accessCode,
        arrivalInstructions: isSpec ? prev.arrivalInstructions : "",
        requiresArrivalInstructions: isSpec,
      };
    });
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={4} total={8} onClose={exitFlow} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>Features & access</Text>
          <Text style={styles.title}>What else should drivers know?</Text>
          <Text style={styles.subtitle}>
            Select everything that applies — drivers use this to decide if your space suits them.
          </Text>

          {/* ── Features ── */}
          <Text style={styles.sectionLabel}>FEATURES</Text>
          <View style={styles.chipGrid}>
            {visibleFeatures.map((option) => {
              const active = draft.accessOptions.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleFeature(option)}
                >
                  <View style={[styles.chipIconWrap, active && styles.chipIconWrapActive]}>
                    {featureIcon(option, active)}
                  </View>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
                    {option}
                  </Text>
                  {active ? (
                    <CircleCheck size={16} color={hostFlowColors.accent} strokeWidth={2.2} style={styles.chipCheck} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.showMoreBtn} onPress={() => setShowAllFeatures((v) => !v)}>
            <Text style={styles.showMoreText}>
              {showAllFeatures ? "Show fewer features" : `More features (${EXTRA_FEATURES.length})`}
            </Text>
            <Text style={styles.showMoreChevron}>{showAllFeatures ? "↑" : "↓"}</Text>
          </Pressable>

          {/* ── Access control ── */}
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>ACCESS</Text>
          <Text style={styles.sectionTitle}>Does getting in require a key, code, or instructions?</Text>

          <View style={styles.yesNoRow}>
            <Pressable
              style={[styles.yesNoBtn, draft.requiresAccessCode === false && styles.yesNoBtnActive]}
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  requiresAccessCode: false,
                  accessOptions: prev.accessOptions.filter(
                    (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
                  ),
                  accessCode: "",
                  requiresArrivalInstructions: false,
                  arrivalInstructions: "",
                }))
              }
            >
              <Text style={[styles.yesNoText, draft.requiresAccessCode === false && styles.yesNoTextActive]}>
                No — open access
              </Text>
            </Pressable>
            <Pressable
              style={[styles.yesNoBtn, draft.requiresAccessCode === true && styles.yesNoBtnActive]}
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  requiresAccessCode: true,
                  requiresArrivalInstructions: prev.requiresArrivalInstructions ?? false,
                }))
              }
            >
              <Text style={[styles.yesNoText, draft.requiresAccessCode === true && styles.yesNoTextActive]}>
                Yes — access needed
              </Text>
            </Pressable>
          </View>

          {/* Access type radio cards */}
          {draft.requiresAccessCode ? (
            <View style={styles.accessChoiceStack}>
              {ACCESS_CHOICES.map((choice) => {
                const active = selectedAccessChoice?.id === choice.id;
                return (
                  <Pressable
                    key={choice.id}
                    style={[styles.accessCard, active && styles.accessCardActive]}
                    onPress={() => selectAccessChoice(choice.optionValue)}
                  >
                    <View style={[styles.accessCardIcon, active && styles.accessCardIconActive]}>
                      {choice.icon}
                    </View>
                    <View style={styles.accessCardText}>
                      <Text style={[styles.accessCardLabel, active && styles.accessCardLabelActive]}>
                        {choice.label}
                      </Text>
                      <Text style={styles.accessCardDesc}>{choice.description}</Text>
                    </View>
                    {active ? (
                      <CircleCheck size={20} color={hostFlowColors.accent} strokeWidth={2.2} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Detail input */}
          {draft.requiresAccessCode && needsAccessDetail ? (
            <View
              onLayout={(e: LayoutChangeEvent) => { accessInputYRef.current = e.nativeEvent.layout.y; }}
              style={styles.detailBox}
            >
              <Text style={styles.detailLabel}>
                {isSpecialInstructions
                  ? "What should drivers do when they arrive?"
                  : selectedAccessChoice?.id === "pin_code"
                  ? "What is the pin code, or how will drivers receive it?"
                  : "How do drivers collect the key or fob?"}
              </Text>
              <AppTextInput
                containerStyle={{ marginBottom: 0 }}
                style={styles.detailInput}
                placeholder={
                  isSpecialInstructions
                    ? "E.g. Ring unit 4, wait for the shutter, then use bay 2 on the right."
                    : selectedAccessChoice?.id === "pin_code"
                    ? "E.g. The code will be sent after booking confirmation."
                    : "E.g. Collect from the property owner on arrival."
                }
                value={isSpecialInstructions ? draft.arrivalInstructions : draft.accessCode}
                onChangeText={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    ...(isSpecialInstructions
                      ? { arrivalInstructions: value }
                      : { accessCode: value }),
                  }))
                }
                multiline
                numberOfLines={isSpecialInstructions ? 4 : 2}
                textAlignVertical="top"
                maxLength={240}
                onFocus={() => scrollInputIntoView(accessInputYRef.current)}
              />
            </View>
          ) : null}
        </ScrollView>

        <FlowFooter
          onBack={() => navigation.goBack()}
          primaryLabel="Continue"
          onPrimary={() => navigation.navigate("ListingAvailability")}
          primaryDisabled={!canContinue}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.appBg },

  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },

  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 20,
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
    marginBottom: 20,
  },

  // ── Section labels ──────────────────────────────────────────
  sectionLabel: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: hostFlowColors.border,
    marginVertical: 24,
  },

  // ── 2-column feature chip grid ──────────────────────────────
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: hostFlowColors.cardBg,
  },
  chipActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.accentSoft,
  },
  chipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f4",
    flexShrink: 0,
  },
  chipIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  chipLabel: {
    flex: 1,
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  chipLabelActive: {
    color: hostFlowColors.accent,
  },
  chipCheck: {
    flexShrink: 0,
  },

  // ── Show more ───────────────────────────────────────────────
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
  },
  showMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: hostFlowColors.textMuted,
  },
  showMoreChevron: {
    fontSize: 12,
    color: hostFlowColors.textSoft,
  },

  // ── Yes / No toggle ─────────────────────────────────────────
  yesNoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  yesNoBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
  },
  yesNoBtnActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.accentSoft,
  },
  yesNoText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: hostFlowColors.textMuted,
    textAlign: "center",
  },
  yesNoTextActive: {
    color: hostFlowColors.accent,
  },

  // ── Access type radio cards ─────────────────────────────────
  accessChoiceStack: {
    gap: 10,
    marginBottom: 16,
  },
  accessCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: hostFlowColors.cardBg,
  },
  accessCardActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.accentSoft,
  },
  accessCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f4",
    flexShrink: 0,
  },
  accessCardIconActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  accessCardText: {
    flex: 1,
  },
  accessCardLabel: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  accessCardLabelActive: {
    color: hostFlowColors.accent,
  },
  accessCardDesc: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // ── Detail input ────────────────────────────────────────────
  detailBox: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    padding: 14,
    marginBottom: 8,
  },
  detailLabel: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  detailInput: {
    backgroundColor: "#f7f8f8",
    borderColor: hostFlowColors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
});
