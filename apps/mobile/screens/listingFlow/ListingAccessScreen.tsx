import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleCheck,
  FileText,
  Hash,
  Lock,
  Unlock,
} from "lucide-react-native";
import { TextInput as AppTextInput } from "../../components/ui";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingAccess: { fromReview?: boolean } | undefined;
  ListingAvailability: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAccess">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const SOFT = hostFlowColors.textSoft;
const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const ACCESS_CHOICES = [
  {
    id: "pin_code" as const,
    label: "Pin code",
    description: "A code that unlocks the entrance or barrier — only shared with confirmed bookings",
    optionValue: "Pin code" as const,
    icon: (active: boolean) => <Hash size={20} color={active ? ACCENT : hostFlowColors.textMuted} strokeWidth={1.8} />,
  },
  {
    id: "special_instructions" as const,
    label: "Special instructions",
    description: "Custom arrival guidance drivers need to know",
    optionValue: "Special instructions" as const,
    icon: (active: boolean) => <FileText size={20} color={active ? ACCENT : hostFlowColors.textMuted} strokeWidth={1.8} />,
  },
] as const;

export function ListingAccessScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Progressive disclosure: the resolved access type collapses to a compact
  // summary row so only the step you're on is expanded (mirrors Step 3 Details).
  const [editingAccessType, setEditingAccessType] = useState(draft.requiresAccessCode === null);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Restricted spaces carry a Pin code (its own access-code field) and/or
  // Special instructions (its own field); the two are independent toggles.
  const hasPinCode = draft.accessOptions.includes("Pin code");
  const hasSpecialInstructions = draft.accessOptions.includes("Special instructions");
  const anyMethodSelected = hasPinCode || hasSpecialInstructions;
  const codeFilled = !hasPinCode || draft.accessCode.trim().length > 0;
  const specialFilled = !hasSpecialInstructions || draft.arrivalInstructions.trim().length > 0;
  const canContinue =
    draft.requiresAccessCode !== null &&
    (draft.requiresAccessCode === false ||
      (anyMethodSelected && codeFilled && specialFilled));

  const toggleMethod = (choice: typeof ACCESS_CHOICES[number]) => {
    setDraft((prev) => {
      const has = prev.accessOptions.includes(choice.optionValue);
      // Deselecting KEEPS whatever the host typed — the input is only shown for a
      // selected method, so hiding it is enough, and toggling off/on must never
      // lose text. (Publish reads the buffers through the selected options, so an
      // orphaned value can't leak — see doPublish.)
      const nextOptions = has
        ? prev.accessOptions.filter((o) => o !== choice.optionValue)
        : [...prev.accessOptions, choice.optionValue];
      return {
        ...prev,
        accessOptions: nextOptions,
        requiresArrivalInstructions: nextOptions.includes("Special instructions"),
      };
    });
  };

  const chooseAccessType = (restricted: boolean) => {
    setDraft((prev) =>
      restricted
        ? {
            ...prev,
            requiresAccessCode: true,
            requiresArrivalInstructions: prev.requiresArrivalInstructions ?? false,
          }
        : {
            ...prev,
            requiresAccessCode: false,
            // Keep any typed code/instructions in case the host flips back to
            // Restricted; publish only sends them when an access option is
            // actually selected, so "Open access" stays code-free.
            accessOptions: prev.accessOptions.filter(
              (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
            ),
            requiresArrivalInstructions: false,
          }
    );
    setEditingAccessType(false);
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={5} total={9} onClose={exitFlow} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header card */}
          <View style={styles.headerCard}>
            <View style={styles.headerCardTop}>
              <Text style={styles.headerKicker}>Step 5 · Access</Text>
              <Text style={styles.headerTitle}>How do drivers get in?</Text>
            </View>
          </View>

          {/* ── Access card ── */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Access</Text>
            <View style={styles.cardBody}>
              <Text style={styles.accessQuestion}>
                Does getting in require a key, code, or instructions?
              </Text>

              {/* Open / Restricted — full cards while choosing, a compact
                  summary row once chosen (tap "Change" to re-pick). */}
              {draft.requiresAccessCode === null || editingAccessType ? (
                <View style={styles.accessTypeStack}>
                  <Pressable
                    style={[styles.accessTypeCard, draft.requiresAccessCode === false && styles.accessTypeCardActive]}
                    onPress={() => chooseAccessType(false)}
                  >
                    <View style={[styles.accessTypeIconWrap, draft.requiresAccessCode === false && styles.accessTypeIconWrapActive]}>
                      <Unlock size={20} color={draft.requiresAccessCode === false ? ACCENT : hostFlowColors.textMuted} strokeWidth={1.8} />
                    </View>
                    <View style={styles.accessTypeText}>
                      <Text style={[styles.accessTypeLabel, draft.requiresAccessCode === false && styles.accessTypeLabelActive]}>Open access</Text>
                      <Text style={styles.accessTypeDesc}>No key, code or instructions needed</Text>
                    </View>
                    {draft.requiresAccessCode === false ? (
                      <CircleCheck size={20} color={ACCENT} strokeWidth={2.2} />
                    ) : null}
                  </Pressable>

                  <Pressable
                    style={[styles.accessTypeCard, draft.requiresAccessCode === true && styles.accessTypeCardActive]}
                    onPress={() => chooseAccessType(true)}
                  >
                    <View style={[styles.accessTypeIconWrap, draft.requiresAccessCode === true && styles.accessTypeIconWrapActive]}>
                      <Lock size={20} color={draft.requiresAccessCode === true ? ACCENT : hostFlowColors.textMuted} strokeWidth={1.8} />
                    </View>
                    <View style={styles.accessTypeText}>
                      <Text style={[styles.accessTypeLabel, draft.requiresAccessCode === true && styles.accessTypeLabelActive]}>Restricted access</Text>
                      <Text style={styles.accessTypeDesc}>Drivers need a key, code or instructions</Text>
                    </View>
                    {draft.requiresAccessCode === true ? (
                      <CircleCheck size={20} color={ACCENT} strokeWidth={2.2} />
                    ) : null}
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.summaryRow} onPress={() => setEditingAccessType(true)}>
                  <View style={[styles.accessTypeIconWrap, styles.accessTypeIconWrapActive]}>
                    {draft.requiresAccessCode
                      ? <Lock size={20} color={ACCENT} strokeWidth={1.8} />
                      : <Unlock size={20} color={ACCENT} strokeWidth={1.8} />}
                  </View>
                  <Text style={styles.summaryLabel}>
                    {draft.requiresAccessCode ? "Restricted access" : "Open access"}
                  </Text>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              )}

              {/* Access methods — Restricted only, once the type is locked in.
                  Multi-select: one code method (Key or Pin) and/or Special
                  instructions, each revealing its own inline input. */}
              {draft.requiresAccessCode && !editingAccessType ? (
                <View style={styles.methodBlock}>
                  <Text style={styles.chooseLabel}>Select all that apply</Text>
                  <View style={styles.accessChoiceStack}>
                    {ACCESS_CHOICES.map((choice) => {
                      const active = draft.accessOptions.includes(choice.optionValue);
                      const isSpec = choice.id === "special_instructions";
                      return (
                        <View key={choice.id}>
                          <Pressable
                            style={[styles.accessCard, active && styles.accessCardActive]}
                            onPress={() => toggleMethod(choice)}
                          >
                            <View style={[styles.accessCardIcon, active && styles.accessCardIconActive]}>
                              {choice.icon(active)}
                            </View>
                            <View style={styles.accessCardText}>
                              <Text style={[styles.accessCardLabel, active && styles.accessCardLabelActive]}>
                                {choice.label}
                              </Text>
                              <Text style={styles.accessCardDesc}>{choice.description}</Text>
                            </View>
                            {active ? (
                              <CircleCheck size={20} color={ACCENT} strokeWidth={2.2} />
                            ) : (
                              <View style={styles.checkboxEmpty} />
                            )}
                          </Pressable>

                          {active ? (
                            <View style={styles.inlineDetailBox}>
                              <Text style={styles.detailLabel}>
                                {isSpec
                                  ? "What should drivers do when they arrive?"
                                  : "Enter the code drivers will use"}
                              </Text>
                              <AppTextInput
                                containerStyle={{ marginBottom: 0 }}
                                style={styles.detailInput}
                                placeholder={
                                  isSpec
                                    ? "E.g. Ring unit 4, wait for the shutter, then use bay 2 on the right."
                                    : "E.g. 4471#"
                                }
                                value={isSpec ? draft.arrivalInstructions : draft.accessCode}
                                onChangeText={(value) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    ...(isSpec
                                      ? { arrivalInstructions: value }
                                      : { accessCode: value }),
                                  }))
                                }
                                multiline
                                numberOfLines={isSpec ? 4 : 2}
                                textAlignVertical="top"
                                maxLength={240}
                              />
                              <Text style={styles.detailPrivacy}>
                                Only shared with confirmed bookings.
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!keyboardVisible && (
        <FlowFooter
          onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
          primaryLabel={fromReview ? "Save changes" : "Continue"}
          onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingAvailability")}
          primaryDisabled={!canContinue}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card ──────────────────────────────────────────────
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

  // ── Card ─────────────────────────────────────────────────────
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
  cardBody: {
    padding: 16,
  },

  // ── Access ───────────────────────────────────────────────────
  accessQuestion: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    letterSpacing: -0.1,
  },
  accessTypeStack: {
    gap: 10,
    marginBottom: 16,
  },
  accessTypeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: hostFlowColors.bg,
  },
  accessTypeCardActive: {
    borderColor: ACCENT,
    backgroundColor: hostFlowColors.accentSoft,
  },
  accessTypeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    flexShrink: 0,
  },
  accessTypeIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  accessTypeText: {
    flex: 1,
  },
  accessTypeLabel: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  accessTypeLabelActive: {
    color: ACCENT,
  },
  accessTypeDesc: {
    color: SOFT,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // Compact confirmed-choice row (Open/Restricted or the picked method).
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: hostFlowColors.accentSoft,
  },
  summaryLabel: {
    flex: 1,
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  changeText: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
  },
  // Empty circle = unchecked multi-select affordance (Key/Pin/instructions).
  checkboxEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: hostFlowColors.borderStrong,
  },
  methodBlock: {
    marginTop: 14,
  },
  chooseLabel: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  accessChoiceStack: {
    gap: 10,
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
    backgroundColor: hostFlowColors.bg,
  },
  accessCardActive: {
    borderColor: ACCENT,
    backgroundColor: hostFlowColors.accentSoft,
  },
  accessCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    flexShrink: 0,
  },
  accessCardIconActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  accessCardText: {
    flex: 1,
  },
  accessCardLabel: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  accessCardLabelActive: {
    color: ACCENT,
  },
  accessCardDesc: {
    color: SOFT,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  inlineDetailBox: {
    backgroundColor: hostFlowColors.accentSoft,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  detailLabel: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  detailPrivacy: {
    color: SOFT,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  detailInput: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: FG,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 16,
  },
  tipsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  tipsTitle: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tipsBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
