import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleCheck,
  CircleParking,
  House,
  Signpost,
  Warehouse,
} from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingFeaturesAccess: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Private Driveway", "Garage", "Car park", "Private road"];
const vehicleSizeOptions = [
  {
    value: "small",
    label: "Small",
    example: "i.e. VW Polo, Ford Fiesta",
    image: "https://img.icons8.com/color/96/hatchback.png",
  },
  {
    value: "medium",
    label: "Medium",
    example: "i.e. Audi A3",
    image: "https://img.icons8.com/color/96/sedan.png",
  },
  {
    value: "large",
    label: "Large",
    example: "i.e. Volvo XC90",
    image: "https://img.icons8.com/color/96/suv.png",
  },
  {
    value: "van",
    label: "Van",
    example: "i.e. Transit Custom",
    image: "https://img.icons8.com/color/96/van.png",
  },
];


type DetailStep = "type" | "count" | "vehicle" | "access";

const MIN_SPACE_COUNT = 0;
const MAX_SPACE_COUNT = 99;
const activeIconColor = hostFlowColors.cardBg;
const transparentColor = "transparent";

function parseSpaceCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_SPACE_COUNT) {
    return null;
  }
  return Math.min(parsed, MAX_SPACE_COUNT);
}

function SpaceTypeIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? activeIconColor : hostFlowColors.text;
  const size = 20;
  const strokeWidth = 1.8;
  switch (type) {
    case "Private Driveway":
      return <House size={size} color={color} strokeWidth={strokeWidth} />;
    case "Garage":
      return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    case "Car park":
      return <CircleParking size={size} color={color} strokeWidth={strokeWidth} />;
    case "Private road":
    default:
      return <Signpost size={size} color={color} strokeWidth={strokeWidth} />;
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

export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const [openStep, setOpenStep] = useState<DetailStep>("type");
  const [spaceCountInput, setSpaceCountInput] = useState<number>(() => parseSpaceCount(draft.spaceCount) ?? MIN_SPACE_COUNT);
  const canContinue = Boolean(draft.spaceType) && Boolean(draft.spaceCount) && Boolean(draft.vehicleSize);
  const confirmedSpaceCount = parseSpaceCount(draft.spaceCount);
  const hasConfirmedCount = confirmedSpaceCount !== null && confirmedSpaceCount > 0;
  useEffect(() => {
    if (!draft.spaceType) {
      setOpenStep("type");
      return;
    }
    if (!draft.spaceCount) {
      setOpenStep("count");
      return;
    }
    if (!draft.vehicleSize) {
      setOpenStep("vehicle");
      return;
    }
    setOpenStep("access");
  }, [draft.spaceCount, draft.spaceType, draft.vehicleSize]);

  useEffect(() => {
    if (confirmedSpaceCount !== null && confirmedSpaceCount > 0) {
      setSpaceCountInput(confirmedSpaceCount);
    } else if (!draft.spaceType) {
      setSpaceCountInput(MIN_SPACE_COUNT);
    }
  }, [confirmedSpaceCount, draft.spaceType]);

  const adjustSpaceCount = (delta: number) => {
    setSpaceCountInput((prev) => {
      const next = Math.min(MAX_SPACE_COUNT, Math.max(MIN_SPACE_COUNT, prev + delta));
      setDraft((current) => ({
        ...current,
        spaceCount: next > 0 ? String(next) : "",
      }));
      if (next > 0) {
        setOpenStep("vehicle");
      } else {
        setOpenStep("count");
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 104 + Math.max(insets.bottom, 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <View style={styles.progressShell}>
            <StepProgress current={3} total={8} />
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.stepEyebrow}>Step 3 of 8</Text>
            <Text style={styles.title}>What type of space is it?</Text>
          </View>
        </View>

        <View style={!draft.spaceType ? styles.primaryQuestionCardOpen : styles.primaryQuestionFlow}>
          {!draft.spaceType || openStep === "type" ? (
            <>
              <Text style={styles.typePromptTitle}>Pick the shape that best matches your space</Text>
              <View style={styles.typeGrid}>
                {spaceTypes.map((type) => {
                  const active = draft.spaceType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.typeCard, active && styles.typeCardActive]}
                      onPress={() => {
                        setDraft((prev) => ({ ...prev, spaceType: type }));
                        setOpenStep("count");
                      }}
                    >
                      <View style={styles.typeCardTop}>
                        <View style={[styles.typeIconWrap, active && styles.typeIconWrapActive]}>
                          <SpaceTypeIcon type={type} active={active} />
                        </View>
                        <View style={[styles.typeCheckBadge, active && styles.typeCheckBadgeActive]}>
                          {active ? <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.5} /> : null}
                        </View>
                      </View>
                      <Text style={styles.typeTitle}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {draft.spaceType && openStep !== "type" ? (
            <View style={styles.progressiveSection}>
              <Pressable style={[styles.typeCard, styles.typeCardActive, styles.typeCardSelectedRow]} onPress={() => setOpenStep("type")}>
                <View style={[styles.typeIconWrap, styles.typeIconWrapActive]}>
                  <SpaceTypeIcon type={draft.spaceType} active />
                </View>
                <Text style={styles.typeTitleSelected}>{draft.spaceType}</Text>
                <View style={[styles.typeCheckBadge, styles.typeCheckBadgeActive]}>
                  <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.5} />
                </View>
              </Pressable>

              <Text style={styles.inlinePromptTitle}>How many spaces are available to rent out?</Text>
              <View style={styles.counterRow}>
                <Pressable
                  style={[
                    styles.counterButton,
                    spaceCountInput <= MIN_SPACE_COUNT && styles.counterButtonDisabled,
                  ]}
                  onPress={() => adjustSpaceCount(-1)}
                  disabled={spaceCountInput <= MIN_SPACE_COUNT}
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </Pressable>
                <View style={styles.counterValueBox}>
                  <Text style={styles.counterValueText}>{spaceCountInput}</Text>
                </View>
                <Pressable
                  style={[
                    styles.counterButton,
                    spaceCountInput >= MAX_SPACE_COUNT && styles.counterButtonDisabled,
                  ]}
                  onPress={() => adjustSpaceCount(1)}
                  disabled={spaceCountInput >= MAX_SPACE_COUNT}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {draft.spaceType && hasConfirmedCount && openStep !== "type" ? (
            <View style={styles.progressiveSection}>
              <SectionHeader
                label="VEHICLE FIT"
                title="What size vehicles fit best?"
              />
              <View style={styles.vehicleList}>
                {vehicleSizeOptions.map((option) => {
                  const active = draft.vehicleSize === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                      onPress={() => {
                        setDraft((prev) => ({ ...prev, vehicleSize: option.value }));
                        setOpenStep("access");
                      }}
                    >
                      <View style={styles.vehicleTextWrap}>
                        <Text style={styles.vehicleTitle}>{option.label}</Text>
                        <Text style={styles.vehicleExample}>{option.example}</Text>
                      </View>
                      <View style={styles.vehicleArtWrap}>
                        <Image
                          source={{ uri: option.image }}
                          style={styles.vehicleArtImage}
                          resizeMode="contain"
                        />
                      </View>
                      {active ? (
                        <View style={styles.vehicleCheckBadge}>
                          <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.4} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

        </View>
      </ScrollView>

      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingFeaturesAccess")}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: hostFlowColors.appBg,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },
  counterButton: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  counterButtonDisabled: {
    opacity: 0.45,
  },
  counterButtonText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    textAlignVertical: "center",
    marginTop: -3,
  },
  counterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 14,
  },
  counterValueBox: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    height: 56,
    width: 72,
  },
  counterValueText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
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
    paddingTop: 2,
  },
  heroCard: {
    marginTop: 12,
    paddingHorizontal: 0,
  },
  inlinePromptTitle: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 10,
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
    color: activeIconColor,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  primaryQuestionCardOpen: {
    backgroundColor: transparentColor,
    elevation: 0,
    minHeight: 0,
    padding: 0,
    shadowOpacity: 0,
  },
  primaryQuestionFlow: {
    marginTop: 10,
  },
  progressShell: {
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  progressiveSection: {
    marginTop: 6,
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
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
    lineHeight: 27,
    marginTop: 2,
  },
  stepEyebrow: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 6,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  typeCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 134,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: "48%",
    ...hostFlowShadow,
  },
  typeCardActive: {
    borderColor: hostFlowColors.accent,
    borderWidth: 2,
    backgroundColor: hostFlowColors.accentSoft,
  },
  typeCardSelectedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
    paddingVertical: 14,
    width: "100%",
  },
  typeCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeCheckBadge: {
    alignItems: "center",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  typeCheckBadgeActive: {
    alignItems: "center",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  typeDescription: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: 3,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  typeIconWrap: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 16,
    flexShrink: 0,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  typeIconWrapActive: {
    backgroundColor: hostFlowColors.accent,
  },
  typePromptTitle: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 22,
  },
  typeTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.3,
    marginTop: 24,
    width: "82%",
  },
  typeTitleSelected: {
    color: hostFlowColors.text,
    flex: 1,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  vehicleArtWrap: {
    alignItems: "flex-end",
    flexShrink: 0,
    justifyContent: "center",
    marginLeft: 8,
    width: 84,
  },
  vehicleArtImage: {
    height: 48,
    width: 84,
  },
  vehicleCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 84,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "relative",
    ...hostFlowShadow,
  },
  vehicleCardActive: {
    borderColor: hostFlowColors.accent,
    borderWidth: 2,
  },
  vehicleCheckBadge: {
    position: "absolute",
    right: 14,
    top: 12,
  },
  vehicleExample: {
    color: hostFlowColors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 19,
    marginTop: 3,
  },
  vehicleList: {
    gap: 10,
    marginTop: 14,
  },
  vehicleTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 6,
  },
  vehicleTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
  },
});
