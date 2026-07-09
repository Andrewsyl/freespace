import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleCheck,
  FileText,
  Hash,
  KeyRound,
  Lock,
  Unlock,
} from "lucide-react-native";
import { TextInput as AppTextInput } from "../../components/ui";
import { FlowHeader } from "./FlowHeader";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";
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
    id: "key_fob" as const,
    label: "Key or security fob",
    description: "You'll share key collection details with drivers",
    optionValue: "Key or security fob" as const,
    icon: (active: boolean) => <KeyRound size={20} color={active ? ACCENT : hostFlowColors.textMuted} strokeWidth={1.8} />,
  },
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

type AccessChoiceValue = typeof ACCESS_CHOICES[number]["optionValue"];

export function ListingAccessScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

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

  // Physical key handover can't realistically serve instant hourly/daily
  // bookings (drive over, collect a key, return it — for a 1-hour stay). Warn
  // the host at selection time rather than letting their first booking fail.
  const hasShortStayPricing =
    draft.pricingMode === "hourly_daily" || draft.pricingMode === "both";
  const showFobWarning = hasShortStayPricing && selectedAccessChoice?.id === "key_fob";

  const selectAccessChoice = (optionValue: AccessChoiceValue) => {
    setDraft((prev) => {
      const current = ACCESS_CHOICES.find((c) => prev.accessOptions.includes(c.optionValue));
      // Deselect: drop the access option but KEEP whatever the host typed. The
      // code/instructions inputs are only shown for the active choice, so hiding
      // them is enough — toggling a choice off and back on must never lose text.
      // (Publish reads the buffers through the selected option, so an orphaned
      // value can't leak into the live listing — see doPublish in the review screen.)
      if (current?.optionValue === optionValue) {
        return {
          ...prev,
          accessOptions: prev.accessOptions.filter(
            (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
          ),
          requiresArrivalInstructions: false,
        };
      }
      const withoutAccess = prev.accessOptions.filter(
        (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
      );
      const next = ACCESS_CHOICES.find((c) => c.optionValue === optionValue)!;
      const isSpec = next.id === "special_instructions";
      // Switching choices only changes which buffer is shown/published — both the
      // code and the instructions text are preserved so comparing options is safe.
      return {
        ...prev,
        accessOptions: [...withoutAccess, next.optionValue],
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
            <View style={styles.headerCardBottom}>
              <Text style={styles.headerSubtitle}>
                Tell drivers how to get in once they've booked.
              </Text>
            </View>
          </View>

          {/* ── Access card ── */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Access</Text>
            <View style={styles.cardBody}>
              <Text style={styles.accessQuestion}>
                Does getting in require a key, code, or instructions?
              </Text>

              {/* Open / Restricted toggle */}
              <View style={styles.accessTypeStack}>
                <Pressable
                  style={[styles.accessTypeCard, draft.requiresAccessCode === false && styles.accessTypeCardActive]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresAccessCode: false,
                      // Keep any typed code/instructions in case the host flips back
                      // to Restricted; publish only sends them when an access option
                      // is actually selected, so "Open access" stays code-free.
                      accessOptions: prev.accessOptions.filter(
                        (item) => !ACCESS_CHOICES.some((c) => c.optionValue === item)
                      ),
                      requiresArrivalInstructions: false,
                    }))
                  }
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
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresAccessCode: true,
                      requiresArrivalInstructions: prev.requiresArrivalInstructions ?? false,
                    }))
                  }
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

              {/* Access choice cards */}
              {draft.requiresAccessCode ? (
                <View style={styles.accessChoiceStack}>
                  {ACCESS_CHOICES.map((choice) => {
                    const active = selectedAccessChoice?.id === choice.id;
                    const isSpec = choice.id === "special_instructions";
                    return (
                      <View key={choice.id}>
                        <Pressable
                          style={[styles.accessCard, active && styles.accessCardActive]}
                          onPress={() => selectAccessChoice(choice.optionValue)}
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
                          ) : null}
                        </Pressable>

                        {active && choice.id === "key_fob" && showFobWarning ? (
                          <Text style={styles.fobWarning}>
                            Key collection is hard to make work for short hourly stays — most hosts use a pin code or instructions instead.
                          </Text>
                        ) : null}

                        {active ? (
                          <View style={styles.inlineDetailBox}>
                            <Text style={styles.detailLabel}>
                              {isSpec
                                ? "What should drivers do when they arrive?"
                                : choice.id === "pin_code"
                                ? "Enter the code drivers will use"
                                : "How do drivers collect the key or fob?"}
                            </Text>
                            <AppTextInput
                              containerStyle={{ marginBottom: 0 }}
                              style={styles.detailInput}
                              placeholder={
                                isSpec
                                  ? "E.g. Ring unit 4, wait for the shutter, then use bay 2 on the right."
                                  : choice.id === "pin_code"
                                  ? "E.g. 4471#"
                                  : "E.g. Collect from the property owner on arrival."
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
    borderBottomColor: hostFlowColors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
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
  headerCardBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
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
  fobWarning: {
    color: colors.status.pending.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 2,
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
