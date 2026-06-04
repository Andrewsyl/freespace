import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleCheck,
  CircleParking,
  House,
  Minus,
  Plus,
  Signpost,
  Warehouse,
} from "lucide-react-native";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { hostFlowColors } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingFeaturesAccess: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Private Driveway", "Garage", "Car park", "Private road"];
const vehicleSizeOptions = [
  { value: "small",  label: "Hatchback",   example: "Small & city cars",           image: "https://img.icons8.com/color/96/hatchback.png" },
  { value: "medium", label: "Saloon",      example: "Saloons & family cars",       image: "https://img.icons8.com/color/96/sedan.png" },
  { value: "large",  label: "SUV / Jeep",  example: "SUVs, jeeps & 4x4s",         image: "https://img.icons8.com/color/96/suv.png" },
  { value: "van",    label: "Van",         example: "Vans, minibuses & campervans", image: "https://img.icons8.com/color/96/van.png" },
];

type DetailStep = "type" | "count" | "vehicle";

const MIN_SPACE_COUNT = 0;
const MAX_SPACE_COUNT = 99;

function parseSpaceCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_SPACE_COUNT) return null;
  return Math.min(parsed, MAX_SPACE_COUNT);
}

function SpaceTypeIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? hostFlowColors.accent : hostFlowColors.text;
  const size = 20;
  const strokeWidth = 1.8;
  switch (type) {
    case "Private Driveway": return <House size={size} color={color} strokeWidth={strokeWidth} />;
    case "Garage":           return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    case "Car park":         return <CircleParking size={size} color={color} strokeWidth={strokeWidth} />;
    default:                 return <Signpost size={size} color={color} strokeWidth={strokeWidth} />;
  }
}


export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const [openStep, setOpenStep] = useState<DetailStep>("type");
  const [spaceCountInput, setSpaceCountInput] = useState<number>(
    () => parseSpaceCount(draft.spaceCount) ?? MIN_SPACE_COUNT
  );
const canContinue = Boolean(draft.spaceType) && Boolean(draft.spaceCount) && Boolean(draft.vehicleSize);
  const confirmedSpaceCount = parseSpaceCount(draft.spaceCount);
  const hasConfirmedCount = confirmedSpaceCount !== null && confirmedSpaceCount > 0;

  useEffect(() => {
    if (!draft.spaceType) { setOpenStep("type"); return; }
    if (!draft.spaceCount) { setOpenStep("count"); return; }
    if (!draft.vehicleSize) { setOpenStep("vehicle"); return; }
  }, [draft.spaceCount, draft.spaceType, draft.vehicleSize]);

  useEffect(() => {
    if (confirmedSpaceCount !== null && confirmedSpaceCount > 0) {
      setSpaceCountInput(confirmedSpaceCount);
    } else if (!draft.spaceType) {
      setSpaceCountInput(MIN_SPACE_COUNT);
    }
  }, [confirmedSpaceCount, draft.spaceType]);

  const adjustSpaceCount = (delta: number) => {
    const next = Math.min(MAX_SPACE_COUNT, Math.max(MIN_SPACE_COUNT, spaceCountInput + delta));
    setSpaceCountInput(next);
    setDraft((current) => ({ ...current, spaceCount: next > 0 ? String(next) : "", capacity: next > 0 ? next : 1 }));
    setOpenStep(next > 0 ? "vehicle" : "count");
  };

  const showTypeSection  = !draft.spaceType || openStep === "type";
  const showTypeRow      = draft.spaceType && openStep !== "type";
  const showCountSection = Boolean(draft.spaceType);
  const showVehicleSection = draft.spaceType && hasConfirmedCount;

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={3} total={8} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>Space details</Text>
          <Text style={styles.title}>What type of space is it?</Text>
        </View>

        {/* ── Space type ── */}
        <View style={styles.section}>
          {showTypeSection && (
            <>
              <Text style={styles.sectionPrompt}>Pick the option that best matches your space</Text>
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
                        {active && (
                          <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.5} />
                        )}
                      </View>
                      <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {showTypeRow && (
            <Pressable
              style={styles.selectedTypeRow}
              onPress={() => setOpenStep("type")}
            >
              <View style={[styles.typeIconWrap, styles.typeIconWrapActive]}>
                <SpaceTypeIcon type={draft.spaceType} active />
              </View>
              <Text style={styles.selectedTypeLabel}>{draft.spaceType}</Text>
              <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>

        {/* ── Space count ── */}
        {showCountSection && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>How many spaces?</Text>
              <Text style={styles.sectionPrompt}>
                The number of individual spaces you're making available to rent.
              </Text>
              <View style={styles.counterRow}>
                <Pressable
                  style={[styles.counterButton, spaceCountInput <= MIN_SPACE_COUNT && styles.counterButtonDisabled]}
                  onPress={() => adjustSpaceCount(-1)}
                  disabled={spaceCountInput <= MIN_SPACE_COUNT}
                >
                  <Minus size={20} color={hostFlowColors.text} strokeWidth={2.5} />
                </Pressable>
                <View style={styles.counterValueBox}>
                  <Text style={styles.counterValueText}>{spaceCountInput}</Text>
                </View>
                <Pressable
                  style={[styles.counterButton, spaceCountInput >= MAX_SPACE_COUNT && styles.counterButtonDisabled]}
                  onPress={() => adjustSpaceCount(1)}
                  disabled={spaceCountInput >= MAX_SPACE_COUNT}
                >
                  <Plus size={20} color={hostFlowColors.text} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ── Vehicle fit ── */}
        {showVehicleSection && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Vehicle fit</Text>
              <Text style={styles.sectionHeading}>What size vehicles fit best?</Text>
              <View style={styles.vehicleList}>
                {vehicleSizeOptions.map((option) => {
                  const active = draft.vehicleSize === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                      onPress={() => {
                        setDraft((prev) => ({ ...prev, vehicleSize: option.value }));
                      }}
                    >
                      <View style={styles.vehicleTextWrap}>
                        <Text style={[styles.vehicleTitle, active && styles.vehicleTitleActive]}>
                          {option.label}
                        </Text>
                        <Text style={styles.vehicleExample}>{option.example}</Text>
                      </View>
                      <View style={styles.vehicleArtWrap}>
                        <Image
                          source={{ uri: option.image }}
                          style={styles.vehicleArtImage}
                          resizeMode="contain"
                        />
                      </View>
                      {active && (
                        <View style={styles.vehicleCheckBadge}>
                          <CircleCheck size={18} color={hostFlowColors.accent} strokeWidth={2.4} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

      </ScrollView>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel="Continue"
        onPrimary={() => navigation.navigate("ListingFeaturesAccess")}
        primaryDisabled={!canContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: hostFlowColors.appBg,
    flex: 1,
  },
  content: {
    paddingTop: 0,
  },

  // Header — matches other flow screens
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 28,
    paddingBottom: 8,
  },
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 10,
  },

  // Sections — web-style border + generous padding
  divider: {
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
  },
  section: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: 24,
  },
  sectionLabel: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionHeading: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 23,
    marginBottom: 8,
  },
  sectionPrompt: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },

  // Space type grid
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: "48%",
  },
  typeCardActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.accentSoft,
  },
  typeCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  typeIconWrap: {
    alignItems: "center",
    backgroundColor: "#f1f5f4",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  typeIconWrapActive: {
    backgroundColor: hostFlowColors.accentSoftBorder,
  },
  typeLabel: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  typeLabelActive: {
    color: hostFlowColors.accent,
  },

  // Selected type row (collapsed)
  selectedTypeRow: {
    alignItems: "center",
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: hostFlowColors.accent,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedTypeLabel: {
    color: hostFlowColors.text,
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },

  // Counter
  counterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  counterButton: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  counterButtonDisabled: {
    opacity: 0.35,
  },
  counterValueBox: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 72,
  },
  counterValueText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },

  // Vehicle size cards
  vehicleList: {
    gap: 10,
    marginTop: 4,
  },
  vehicleCard: {
    alignItems: "center",
    backgroundColor: hostFlowColors.cardBg,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "relative",
  },
  vehicleCardActive: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.accentSoft,
  },
  vehicleTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },
  vehicleTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  vehicleTitleActive: {
    color: hostFlowColors.accent,
  },
  vehicleExample: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  vehicleArtWrap: {
    alignItems: "flex-end",
    flexShrink: 0,
    justifyContent: "center",
    width: 80,
  },
  vehicleArtImage: {
    height: 44,
    width: 80,
  },
  vehicleCheckBadge: {
    position: "absolute",
    right: 14,
    top: 12,
  },
});
