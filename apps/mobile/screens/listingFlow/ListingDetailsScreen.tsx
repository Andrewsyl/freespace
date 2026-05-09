import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CarFront,
  CircleCheck,
  Cctv,
  Fence,
  Home,
  IdCard,
  Route,
  SquareParking,
  Zap,
} from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { TextInput as AppTextInput } from "../../components/ui";
import { cardShadow, colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Private Driveway", "Garage", "Car park", "Private road"];
const accessOptions = ["Gated", "Permit required", "EV charging", "CCTV", "Covered"];

const typeDescriptions: Record<string, string> = {
  "Private Driveway": "A residential driveway or front-of-home space that’s easy to find and access.",
  Garage: "An enclosed or sheltered space that offers more protection and privacy.",
  "Car park": "A bay in a shared lot, apartment block, office, or other managed parking area.",
  "Private road": "A private lane or roadside space where parking is clearly permitted.",
};

function SpaceTypeIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#FFFFFF" : "#344054";
  const size = 22;
  const strokeWidth = 2.1;
  switch (type) {
    case "Private Driveway":
      return <Home size={size} color={color} strokeWidth={strokeWidth} />;
    case "Garage":
      return <CarFront size={size} color={color} strokeWidth={strokeWidth} />;
    case "Car park":
      return <SquareParking size={size} color={color} strokeWidth={strokeWidth} />;
    case "Private road":
    default:
      return <Route size={size} color={color} strokeWidth={strokeWidth} />;
  }
}

function FeatureIcon({ option, active }: { option: string; active: boolean }) {
  const color = active ? colors.accent : "#667085";
  const size = 15;
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
      return <Home size={size} color={color} strokeWidth={strokeWidth} />;
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

export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const hasAccessDetails = draft.requiresAccessCode === false
    || (draft.requiresAccessCode === true && draft.accessCode.trim().length > 0);
  const canContinue = Boolean(draft.spaceType) && hasAccessDetails;

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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 180 + Math.max(insets.bottom, 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <View style={styles.progressShell}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step 3 of 7</Text>
            </View>
            <StepProgress current={3} total={7} />
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.title}>What type of space is it?</Text>
            <Text style={styles.subtitle}>
              Set clear expectations so drivers know exactly what they’re booking before they arrive.
            </Text>
          </View>
        </View>

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="SPACE TYPE"
            title="Choose the closest match"
            body="Pick the option that best represents the space drivers will use."
          />
          {spaceTypes.map((type) => {
            const active = draft.spaceType === type;
            return (
              <Pressable
                key={type}
                style={[styles.typeRow, active && styles.typeRowActive]}
                onPress={() => setDraft((prev) => ({ ...prev, spaceType: type }))}
              >
                <View style={[styles.typeIconWrap, active && styles.typeIconWrapActive]}>
                  <SpaceTypeIcon type={type} active={active} />
                </View>
                <View style={styles.typeCopy}>
                  <Text style={styles.typeTitle}>{type}</Text>
                  <Text style={styles.typeDescription}>{typeDescriptions[type]}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}
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
                  {active ? <CircleCheck size={16} color={colors.accent} strokeWidth={2.2} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="ACCESS"
            title="Does the space need an access code?"
            body="Tell drivers if they’ll need a code, permit, or special entry details."
          />

          <View style={styles.toggleGroup}>
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
          </View>

          {draft.requiresAccessCode ? (
            <>
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
              />
              <Text style={styles.privacyNote}>
                This stays hidden until the booking is confirmed and disappears again when the stay ends.
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.surfaceCard}>
          <SectionHeader
            label="ARRIVAL"
            title="Add arrival instructions"
            body="Share anything drivers should only need after booking, like which gate to use or exactly where to park."
          />
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
          />
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
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },
  headerBlock: {
    paddingTop: 6,
  },
  progressShell: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(16,24,40,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F4F7",
    borderRadius: 999,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepBadgeText: {
    color: "#344054",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  heroCard: {
    marginTop: 18,
    paddingHorizontal: 2,
  },
  title: {
    color: "#101828",
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "#475467",
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Inter-Regular",
    marginTop: 10,
  },
  sectionHeader: {
    marginTop: 0,
  },
  sectionLabel: {
    color: "#98A2B3",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: "#101828",
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  sectionBody: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter-Regular",
    marginTop: 6,
  },
  typeRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(16,24,40,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
    minHeight: 94,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  typeRowActive: {
    backgroundColor: "#F9FFFB",
    borderColor: "rgba(18,183,106,0.34)",
    shadowColor: "#12B76A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  typeIconWrap: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  typeIconWrapActive: {
    backgroundColor: "#12B76A",
  },
  typeCopy: {
    flex: 1,
    gap: 4,
  },
  typeTitle: {
    color: "#101828",
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  typeDescription: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter-Regular",
    paddingRight: 10,
  },
  radio: {
    alignItems: "center",
    borderColor: "rgba(16,24,40,0.16)",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioActive: {
    borderColor: colors.accent,
  },
  radioInner: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  surfaceCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(16,24,40,0.06)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
    padding: 20,
    ...cardShadow,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  featureChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(16,24,40,0.08)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  featureChipActive: {
    backgroundColor: "#F6FEF9",
    borderColor: "rgba(18,183,106,0.28)",
  },
  featureIconWrap: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  featureIconWrapActive: {
    backgroundColor: "#E8FFF2",
  },
  featureChipText: {
    color: "#475467",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  featureChipTextActive: {
    color: "#101828",
  },
  toggleGroup: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    padding: 6,
  },
  toggleOption: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  toggleOptionActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  toggleText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#101828",
  },
  inputContainer: {
    marginBottom: 0,
  },
  input: {
    backgroundColor: "#FCFCFD",
    borderColor: "rgba(16,24,40,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#101828",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    marginTop: 14,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  privacyNote: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
    marginTop: 8,
  },
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "rgba(16,24,40,0.08)",
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#101828",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 56,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 3,
  },
  primaryButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
