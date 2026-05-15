import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { CircleCheck, Cctv, Fence, IdCard, Zap } from "lucide-react-native";
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

const accessOptions = ["Gated", "EV charging", "CCTV", "Covered"];
const transparentColor = "transparent";

function FeatureIcon({ option, active }: { option: string; active: boolean }) {
  const color = active ? hostFlowColors.accent : hostFlowColors.textMuted;
  const size = 16;
  const strokeWidth = 2.1;
  switch (option) {
    case "Gated":
      return <Fence size={size} color={color} strokeWidth={strokeWidth} />;
    case "Permit required":
      return <IdCard size={size} color={color} strokeWidth={strokeWidth} />;
    case "EV charging":
      return <Zap size={size} color={color} strokeWidth={strokeWidth} />;
    case "CCTV":
      return <Cctv size={size} color={color} strokeWidth={strokeWidth} />;
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
  const accessInputRef = useRef<View>(null);
  const arrivalInputRef = useRef<View>(null);
  const hasPermit = draft.accessOptions.includes("Permit required");
  const hasAnsweredAccessControl = draft.requiresAccessCode !== null;
  const hasAnsweredArrivalInstructions = draft.requiresArrivalInstructions !== null;
  const hasAccessDetails =
    draft.requiresAccessCode !== true ||
    draft.accessCode.trim().length > 0;
  const hasArrivalInstructionDetails =
    draft.requiresArrivalInstructions !== true ||
    draft.arrivalInstructions.trim().length > 0;
  const canContinue =
    hasAnsweredAccessControl &&
    hasAccessDetails &&
    hasAnsweredArrivalInstructions &&
    hasArrivalInstructionDetails;

  const scrollInputIntoView = (target: React.RefObject<View | null>) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const scrollNode = scrollRef.current?.getInnerViewNode?.() ?? scrollRef.current;
        if (!target.current || !scrollNode) return;
        target.current.measureLayout(
          scrollNode as never,
          (_x, y, _w, h) => {
            const offset = Math.max(0, y - 120 + h / 2);
            scrollRef.current?.scrollTo({ y: offset, animated: true });
          },
          () => {}
        );
      }, 180);
    });
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

  const setPermitRequired = (value: boolean) => {
    setDraft((prev) => {
      const withoutPermit = prev.accessOptions.filter((item) => item !== "Permit required");
      return {
        ...prev,
        accessOptions: value ? [...withoutPermit, "Permit required"] : withoutPermit,
      };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 132 + Math.max(insets.bottom, 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <View style={styles.progressShell}>
            <StepProgress current={4} total={8} />
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.stepEyebrow}>Step 4 of 8</Text>
            <Text style={styles.title}>What else should drivers know?</Text>
            <Text style={styles.subtitle}>
              Add the practical details that help drivers trust the space and use it without confusion.
            </Text>
          </View>
        </View>

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="FEATURES"
            title="What does your space have?"
            body="Highlight the details that make the space easier to understand and easier to trust."
          />
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

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="ACCESS"
            title="How is your parking space accessed?"
            body="Only reveal the extra details when the answer is yes."
          />

          <View style={styles.questionStack}>
            <View style={styles.questionBlock}>
              <Text style={styles.questionTitle}>Does your space need access control?</Text>
              <Text style={styles.questionBody}>For example: a gate code, key fob, or keypad entry.</Text>
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
                      accessCode: "",
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
              <View ref={accessInputRef} style={styles.subCard}>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  style={styles.input}
                  placeholder="Enter access code or instructions"
                  value={draft.accessCode}
                  onChangeText={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      accessCode: value,
                    }))
                  }
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={150}
                  onFocus={() => scrollInputIntoView(accessInputRef)}
                />
                <Text style={styles.privacyNote}>
                  This stays hidden until the booking is confirmed and disappears again when the stay ends.
                </Text>
              </View>
            ) : null}

            <View style={styles.questionBlock}>
              <Text style={styles.questionTitle}>Does your space require a permit?</Text>
              <View style={styles.toggleGroup}>
                <Pressable
                  style={[styles.toggleOption, !hasPermit && styles.toggleOptionActive]}
                  onPress={() => setPermitRequired(false)}
                >
                  <Text style={[styles.toggleText, !hasPermit && styles.toggleTextActive]}>No</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleOption, hasPermit && styles.toggleOptionActive]}
                  onPress={() => setPermitRequired(true)}
                >
                  <Text style={[styles.toggleText, hasPermit && styles.toggleTextActive]}>Yes</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.questionBlock}>
              <Text style={styles.questionTitle}>Do drivers need arrival instructions?</Text>
              <Text style={styles.questionBody}>
                Only show this if there is something specific drivers need after booking.
              </Text>
              <View style={styles.toggleGroup}>
                <Pressable
                  style={[
                    styles.toggleOption,
                    draft.requiresArrivalInstructions === false && styles.toggleOptionActive,
                  ]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresArrivalInstructions: false,
                      arrivalInstructions: "",
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      draft.requiresArrivalInstructions === false && styles.toggleTextActive,
                    ]}
                  >
                    No
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleOption,
                    draft.requiresArrivalInstructions === true && styles.toggleOptionActive,
                  ]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresArrivalInstructions: true,
                      arrivalInstructions:
                        prev.arrivalInstructions.trim().length > 0
                          ? prev.arrivalInstructions
                          : "Enter through the left gate and use the marked bay.",
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      draft.requiresArrivalInstructions === true && styles.toggleTextActive,
                    ]}
                  >
                    Yes
                  </Text>
                </Pressable>
              </View>
            </View>

            {draft.requiresArrivalInstructions ? (
              <View ref={arrivalInputRef} style={styles.subCard}>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  style={styles.input}
                  placeholder="Example: Enter through the left gate and use the marked bay beside the hedge."
                  value={draft.arrivalInstructions}
                  onChangeText={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      arrivalInstructions: value,
                    }))
                  }
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={240}
                  onFocus={() => scrollInputIntoView(arrivalInputRef)}
                />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingAvailability")}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
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
    backgroundColor: hostFlowColors.cardBgMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featureChipActive: {
    backgroundColor: hostFlowColors.accentSoft,
  },
  featureChipText: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  featureChipTextActive: {
    color: hostFlowColors.text,
  },
  featureIconWrap: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  featureIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  footer: {
    backgroundColor: hostFlowColors.cardBg,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  headerBlock: {
    paddingTop: 6,
  },
  heroCard: {
    marginTop: 16,
    paddingHorizontal: 2,
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
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: hostFlowColors.cardBg,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    fontWeight: "600",
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
    gap: 8,
  },
  questionBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  questionStack: {
    gap: 18,
    marginTop: 12,
  },
  questionTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 23,
  },
  sectionBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 6,
  },
  sectionHeader: {
    marginTop: 0,
  },
  sectionLabel: {
    color: hostFlowColors.textSoft,
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  sectionTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 26,
    marginTop: 4,
  },
  stepEyebrow: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    marginBottom: 8,
  },
  subCard: {
    backgroundColor: hostFlowColors.cardBgMuted,
    borderRadius: 18,
    marginTop: 12,
    padding: 12,
  },
  subtitle: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 8,
  },
  surfaceCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 24,
    marginTop: 16,
    padding: 20,
    ...hostFlowShadow,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 35,
  },
  toggleGroup: {
    backgroundColor: hostFlowColors.cardBgMuted,
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    padding: 5,
  },
  toggleOption: {
    alignItems: "center",
    backgroundColor: transparentColor,
    borderRadius: 11,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  toggleOptionActive: {
    backgroundColor: hostFlowColors.cardBg,
  },
  toggleText: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  toggleTextActive: {
    color: hostFlowColors.text,
  },
});
