import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { KeyboardAvoidingView, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { ArrowDownUp, CircleCheck, Cctv, Fence, IdCard, Lightbulb, Warehouse, Zap } from "lucide-react-native";
import { TextInput as AppTextInput } from "../../components/ui";
import { spacing } from "../../styles/theme";
import { StepProgress } from "./StepProgress";
import { useListingFlow } from "./context";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";

type FlowStackParamList = {
  ListingFeaturesAccess: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingFeaturesAccess">;

const accessOptions = [
  "CCTV",
  "EV charging",
  "Sheltered",
  "Well lit",
  "Gated access",
  "Height-friendly",
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

function FeatureIcon({ option, active }: { option: string; active: boolean }) {
  const color = active ? hostFlowColors.accent : hostFlowColors.textMuted;
  const size = 16;
  const strokeWidth = 2.1;
  switch (option) {
    case "Gated":
    case "Gated access":
      return <Fence size={size} color={color} strokeWidth={strokeWidth} />;
    case "Permit required":
      return <IdCard size={size} color={color} strokeWidth={strokeWidth} />;
    case "EV charging":
      return <Zap size={size} color={color} strokeWidth={strokeWidth} />;
    case "CCTV":
      return <Cctv size={size} color={color} strokeWidth={strokeWidth} />;
    case "Sheltered":
      return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    case "Well lit":
      return <Lightbulb size={size} color={color} strokeWidth={strokeWidth} />;
    case "Height-friendly":
      return <ArrowDownUp size={size} color={color} strokeWidth={strokeWidth} />;
    case "Covered":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <Path
            d="M9 14h6v7H9z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return <Cctv size={size} color={color} strokeWidth={strokeWidth} />;
  }
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
        <View style={styles.headerBlock}>
          <View style={styles.progressShell}>
            <StepProgress current={4} total={8} />
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.title}>What else should drivers know?</Text>
            <Text style={styles.subtitle}>
              Add the practical details that help drivers trust the space and use it without confusion.
            </Text>
          </View>
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

        <View style={styles.surfaceCard}>
          <SectionHeader label="FEATURES" title="What else does your space offer?" />
          <View style={styles.chipWrap}>
            {accessOptions.map((option) => {
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
        </View>
      </ScrollView>

      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingAvailability")}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
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
    gap: 14,
    marginTop: 12,
  },
  accessChoiceSelectedMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  accessChoiceText: {
    color: hostFlowColors.text,
    fontFamily: "Inter-Medium",
    fontSize: 16,
    lineHeight: 22,
  },
  accessChoiceTextActive: {
    fontFamily: "Inter-SemiBold",
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
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  featureChipTextActive: {
    color: hostFlowColors.text,
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
    marginTop: 14,
    paddingHorizontal: 0,
  },
  input: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: hostFlowColors.text,
    fontFamily: "Inter-Regular",
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
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  privacyNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "Inter-Regular",
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
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  questionStack: {
    gap: 18,
    marginTop: 14,
  },
  questionTitle: {
    color: hostFlowColors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 25,
  },
  sectionBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 6,
  },
  sectionHeader: {
    marginTop: 0,
  },
  sectionLabel: {
    color: hostFlowColors.textSoft,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  sectionTitle: {
    color: hostFlowColors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 25,
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
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 8,
  },
  surfaceCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    marginTop: 16,
    padding: 20,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.6,
    lineHeight: 31,
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
    fontFamily: "Inter-SemiBold",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
  },
  toggleTextActive: {
    color: hostFlowColors.text,
  },
});
