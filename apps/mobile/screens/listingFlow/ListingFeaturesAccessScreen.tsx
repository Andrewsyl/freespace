import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, KeyboardAvoidingView, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck } from "lucide-react-native";
import { TextInput as AppTextInput } from "../../components/ui";
import { spacing, textStyles } from "../../styles/theme";
import { StepProgress } from "./StepProgress";
import { useListingFlow } from "./context";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingFeaturesAccess: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingFeaturesAccess">;

const commonAccessOptions = [
  "CCTV",
  "EV charging",
  "Sheltered",
  "Well lit",
  "Gated access",
];
const extraAccessOptions = [
  "Height-friendly",
  "Disabled access",
  "24/7 access",
  "Motorbike friendly",
  "Wide bay",
];
const gatedAccessChoices = [
  {
    id: "key_fob",
    label: "Requires a key or security fob",
    optionValue: "Key or security fob",
    requiresDetails: true,
  },
  {
    id: "pin_code",
    label: "Requires a pin code",
    optionValue: "Pin code",
    requiresDetails: true,
  },
  {
    id: "special_instructions",
    label: "Requires special instructions",
    optionValue: "Special instructions",
    requiresDetails: true,
  },
] as const;
const transparentColor = "transparent";

const FEATURE_ICON_URL: Record<string, string> = {
  "CCTV":              "https://img.icons8.com/ios/96/camera-identification.png",
  "EV charging":       "https://img.icons8.com/ios/96/lightning-bolt.png",
  "Sheltered":         "https://img.icons8.com/ios/96/garage.png",
  "Covered":           "https://img.icons8.com/ios/96/garage.png",
  "Well lit":          "https://img.icons8.com/ios/96/light-on.png",
  "Gated access":      "https://img.icons8.com/ios/96/road-closure.png",
  "Gated":             "https://img.icons8.com/ios/96/road-closure.png",
  "Height-friendly":   "https://img.icons8.com/ios/96/height.png",
  "Permit required":   "https://img.icons8.com/ios/96/key.png",
  "Disabled access":   "https://img.icons8.com/ios/96/wheelchair.png",
  "24/7 access":       "https://img.icons8.com/ios/96/time.png",
  "Motorbike friendly":"https://img.icons8.com/ios/96/scooter.png",
  "Wide bay":          "https://img.icons8.com/ios/96/expand.png",
};

function FeatureIcon({ option }: { option: string; active: boolean }) {
  const url = FEATURE_ICON_URL[option] ?? "https://img.icons8.com/ios/96/garage.png";
  return <Image source={{ uri: url }} style={{ width: 18, height: 18 }} resizeMode="contain" />;
}

function SectionHeader({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {body ? <Text style={styles.sectionBody}>{body}</Text> : null}
    </View>
  );
}

export function ListingFeaturesAccessScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const accessInputYRef = useRef(0);
  const arrivalInputYRef = useRef(0);
  const selectedAccessChoice =
    gatedAccessChoices.find((choice) => draft.accessOptions.includes(choice.optionValue)) ?? null;
  const needsAccessDetail = selectedAccessChoice?.requiresDetails ?? false;
  const hasAnsweredAccessControl = draft.requiresAccessCode !== null;
  const isSpecialInstructionsChoice = selectedAccessChoice?.id === "special_instructions";
  const hasAccessDetails = !needsAccessDetail || (
    isSpecialInstructionsChoice
      ? draft.arrivalInstructions.trim().length > 0
      : draft.accessCode.trim().length > 0
  );
  const canContinue =
    hasAnsweredAccessControl &&
    (draft.requiresAccessCode === false || selectedAccessChoice !== null) &&
    hasAccessDetails;

  const scrollInputIntoView = (targetY: number) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const offset = Math.max(0, targetY - 140);
        scrollRef.current?.scrollTo({ y: offset, animated: true });
      }, 180);
    });
  };

  const captureSectionY =
    (ref: React.MutableRefObject<number>) =>
    (event: LayoutChangeEvent) => {
      ref.current = event.nativeEvent.layout.y;
    };

  const toggleAccess = (option: string) => {
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

  const setAccessChoice = (optionValue: (typeof gatedAccessChoices)[number]["optionValue"]) => {
    setDraft((prev) => {
      const currentChoice = gatedAccessChoices.find((choice) =>
        prev.accessOptions.includes(choice.optionValue),
      );
      if (currentChoice?.optionValue === optionValue) {
        return {
          ...prev,
          accessOptions: prev.accessOptions.filter(
            (item) => !gatedAccessChoices.some((choice) => choice.optionValue === item),
          ),
          accessCode: "",
          requiresArrivalInstructions: false,
          arrivalInstructions: "",
        };
      }
      const withoutRestrictedAccess = prev.accessOptions.filter(
        (item) => !gatedAccessChoices.some((choice) => choice.optionValue === item),
      );
      const nextChoice = gatedAccessChoices.find((choice) => choice.optionValue === optionValue) ?? null;
      const isSpecialInstructions = nextChoice?.id === "special_instructions";
      return {
        ...prev,
        accessOptions: nextChoice ? [...withoutRestrictedAccess, nextChoice.optionValue] : withoutRestrictedAccess,
        accessCode: nextChoice?.requiresDetails && !isSpecialInstructions ? prev.accessCode : "",
        arrivalInstructions: nextChoice?.requiresDetails && isSpecialInstructions ? prev.arrivalInstructions : "",
        requiresArrivalInstructions: nextChoice?.requiresDetails && isSpecialInstructions ? true : false,
      };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 104 + Math.max(insets.bottom, 0) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Features & access</Text>
        <StepProgress current={4} total={8} />
        <Text style={styles.title}>What else should drivers know?</Text>
        <Text style={styles.subtitle}>
          Add the practical details that help drivers trust the space and use it without confusion.
        </Text>

        <View style={styles.surfaceCard}>
          <SectionHeader label="FEATURES" title="What else does your space offer?" />
          <View style={styles.chipWrap}>
            {(showAllFeatures ? [...commonAccessOptions, ...extraAccessOptions] : commonAccessOptions).map((option) => {
              const active = draft.accessOptions.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.featureChip, active && styles.featureChipActive]}
                  onPress={() => toggleAccess(option)}
                >
                  <View style={[styles.featureIconWrap, active && styles.featureIconWrapActive]}>
                    <FeatureIcon option={option} active={active} />
                  </View>
                  <Text style={[styles.featureChipText, active && styles.featureChipTextActive]}>
                    {option}
                  </Text>
                  {active ? (
                    <CircleCheck size={16} color={hostFlowColors.accent} strokeWidth={2.2} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.showMoreBtn} onPress={() => setShowAllFeatures((v) => !v)}>
            <Text style={styles.showMoreText}>
              {showAllFeatures ? "Show less" : `More features +${extraAccessOptions.length}`}
            </Text>
            <Text style={styles.showMoreChevron}>{showAllFeatures ? "↑" : "↓"}</Text>
          </Pressable>
        </View>

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="ACCESS"
            title="Access instructions"
          />

          <View style={styles.questionStack}>
            <View style={styles.questionBlock}>
              <Text style={styles.questionTitle}>Does your space have gated entry or require a key or extra info?</Text>
              <View style={styles.toggleGroup}>
                <Pressable
                  style={[
                    styles.toggleOption,
                    draft.requiresAccessCode === false && styles.toggleOptionActive,
                  ]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresAccessCode: false,
                      accessOptions: prev.accessOptions.filter(
                        (item) => !gatedAccessChoices.some((choice) => choice.optionValue === item),
                      ),
                      accessCode: "",
                      requiresArrivalInstructions: false,
                      arrivalInstructions: "",
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      draft.requiresAccessCode === false && styles.toggleTextActive,
                    ]}
                  >
                    No
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleOption,
                    draft.requiresAccessCode === true && styles.toggleOptionActive,
                  ]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresAccessCode: true,
                      accessOptions: prev.accessOptions,
                      requiresArrivalInstructions: prev.requiresArrivalInstructions ?? false,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      draft.requiresAccessCode === true && styles.toggleTextActive,
                    ]}
                  >
                    Yes
                  </Text>
                </Pressable>
              </View>
            </View>

            {draft.requiresAccessCode ? (
              <View style={styles.questionBlock}>
                <Text style={styles.questionTitle}>What access feature applies to your space?</Text>
                <View style={styles.accessChoiceStack}>
                  {(selectedAccessChoice ? [selectedAccessChoice] : gatedAccessChoices).map((choice) => {
                    const active = selectedAccessChoice?.id === choice.id;
                    return (
                      <Pressable
                        key={choice.id}
                        style={[styles.accessChoiceCard, active && styles.accessChoiceCardActive]}
                        onPress={() => setAccessChoice(choice.optionValue)}
                      >
                        <Text style={[styles.accessChoiceText, active && styles.accessChoiceTextActive]}>
                          {choice.label}
                        </Text>
                        {active ? (
                          <View style={styles.accessChoiceSelectedMeta}>
                            <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.2} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {draft.requiresAccessCode && needsAccessDetail ? (
              <View onLayout={captureSectionY(accessInputYRef)} style={styles.subCard}>
                <Text style={styles.questionBody}>
                  {selectedAccessChoice?.id === "special_instructions"
                    ? "Please add any special arrival instructions drivers need."
                    : selectedAccessChoice?.id === "pin_code"
                    ? "Please add the pin code or explain how drivers will receive it."
                    : "Please add some information about how to collect the key or fob."}
                </Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  style={styles.input}
                  placeholder={
                    selectedAccessChoice?.id === "special_instructions"
                      ? "E.g. ring unit 4, wait for the shutter to open, then use the second bay on the right."
                      : selectedAccessChoice?.id === "pin_code"
                      ? "E.g. the code will be sent after booking confirmation."
                      : "E.g. please collect from the property owner who will be at the property on arrival."
                  }
                  value={isSpecialInstructionsChoice ? draft.arrivalInstructions : draft.accessCode}
                  onChangeText={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      ...(isSpecialInstructionsChoice
                        ? { arrivalInstructions: value }
                        : { accessCode: value }),
                    }))
                  }
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={240}
                  onFocus={() => scrollInputIntoView(accessInputYRef.current)}
                />
              </View>
            ) : null}
          </View>
        </View>
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
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  accessChoiceCard: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accessChoiceCardActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.cardBg,
  },
  accessChoiceStack: {
    gap: 10,
    marginTop: 10,
  },
  accessChoiceSelectedMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  accessChoiceText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 16,
    lineHeight: 22,
  },
  accessChoiceTextActive: {
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  container: {
    backgroundColor: hostFlowColors.appBg,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },
  featureChip: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  featureChipActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.cardBg,
  },
  featureChipText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  featureChipTextActive: {
    color: hostFlowColors.text,
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
  },
  showMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: hostFlowColors.text,
  },
  showMoreChevron: {
    fontSize: 13,
    color: hostFlowColors.textMuted,
  },
  featureIconWrap: {
    alignItems: "center",
    backgroundColor: "#f7f8f8",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  featureIconWrapActive: {
    backgroundColor: "#f1f6f4",
  },
  footer: {
    backgroundColor: hostFlowColors.cardBg,
    borderTopColor: hostFlowColors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  headerBlock: {
    paddingTop: 6,
  },
  heroCard: {
    marginTop: 10,
    paddingHorizontal: 0,
  },
  input: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    minHeight: 72,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  inputContainer: {
    marginBottom: 0,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: hostFlowColors.accent,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: hostFlowColors.cardBg,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  privacyNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  progressShell: {
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  questionBlock: {
    gap: 6,
  },
  questionBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  questionStack: {
    gap: 14,
    marginTop: 10,
  },
  questionTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 25,
  },
  sectionBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 6,
  },
  sectionHeader: {
    marginTop: 0,
  },
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionLabel: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    letterSpacing: -0.5,
    lineHeight: 22,
    marginTop: 4,
  },
  subCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    marginTop: 4,
    padding: 12,
  },
  subtitle: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  surfaceCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    marginTop: 12,
    padding: 16,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 10,
  },
  toggleGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  toggleOption: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  toggleOptionActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.cardBg,
  },
  toggleText: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
  },
  toggleTextActive: {
    color: hostFlowColors.text,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: hostFlowColors.textMuted,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
});
