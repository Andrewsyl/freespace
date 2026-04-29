import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CarFront,
  CircleCheck,
  Cctv,
  Fence,
  Home,
  Route,
  SquareParking,
  Zap,
  IdCard,
} from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { TextInput as AppTextInput } from "../../components/ui";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Private Driveway", "Garage", "Car park", "Private road"];
const accessOptions = ["Gated", "Permit required", "EV charging", "CCTV", "Covered"];

const SpaceTypeIcon = ({ type, active }: { type: string; active: boolean }) => {
  const stroke = active ? colors.accent : colors.textSoft;
  const size = 22;
  const strokeWidth = 2.2;
  switch (type) {
    case "Private Driveway":
      return <Home size={size} color={stroke} strokeWidth={strokeWidth} />;
    case "Garage":
      return <CarFront size={size} color={stroke} strokeWidth={strokeWidth} />;
    case "Car park":
      return <SquareParking size={size} color={stroke} strokeWidth={strokeWidth} />;
    case "Private road":
    default:
      return <Route size={size} color={stroke} strokeWidth={strokeWidth} />;
  }
};

const FeatureIcon = ({ option, active }: { option: string; active: boolean }) => {
  const color = active ? colors.accent : colors.textSoft;
  const size = 15;
  const strokeWidth = 2.2;
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
};

export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const canContinue = Boolean(draft.spaceType) && draft.requiresAccessCode !== null;

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Tell us about your space</Text>
        <StepProgress current={3} total={7} />
        <Text style={styles.title}>What type of space is it?</Text>
        <Text style={styles.subtitle}>Pick the closest match</Text>

        <View style={styles.grid}>
          {spaceTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.card,
                draft.spaceType === type && styles.cardActive,
              ]}
              onPress={() => setDraft((prev) => ({ ...prev, spaceType: type }))}
            >
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, draft.spaceType === type && styles.cardIconActive]}>
                  <SpaceTypeIcon type={type} active={draft.spaceType === type} />
                </View>
                <Text style={styles.cardTitle}>{type}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Features</Text>
        <Text style={styles.subtitle}>What does your space have?</Text>
        <View style={styles.chipGrid}>
          {accessOptions.map((option) => {
            const isSelected = draft.accessOptions.includes(option);
            return (
              <Pressable
                key={option}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => toggleAccess(option)}
              >
                <FeatureIcon option={option} active={isSelected} />
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {option}
                </Text>
                {isSelected && (
                  <CircleCheck size={16} color={colors.accent} strokeWidth={2.2} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Access notes (optional)</Text>
        <Text style={styles.subtitle}>Does this space require a code to access?</Text>
        <View style={styles.binaryRow}>
          <Pressable
            style={[
              styles.binaryOption,
              draft.requiresAccessCode === true && styles.binaryOptionActive,
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
                styles.binaryOptionText,
                draft.requiresAccessCode === true && styles.binaryOptionTextActive,
              ]}
            >
              Yes
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.binaryOption,
              draft.requiresAccessCode === false && styles.binaryOptionActive,
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
                styles.binaryOptionText,
                draft.requiresAccessCode === false && styles.binaryOptionTextActive,
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
              This code is hidden until a booking is confirmed. It is only shown to the booked
              driver and is removed after the booking ends.
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Arrival instructions (optional)</Text>
        <Text style={styles.subtitle}>
          Add short directions the driver should only need after booking, for example which gate to use or where to park.
        </Text>
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
      </ScrollView>
      <View style={styles.footer}>
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
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 140,
    paddingTop: 0,
  },
  heroIllustration: {
    width: "100%",
    height: 150,
    marginBottom: 10,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 6,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 2,
    flexBasis: "48%",
    padding: 14,
  },
  cardActive: {
    borderColor: colors.accent,
    backgroundColor: "#ffffff",
  },
  cardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  cardIconActive: {
    backgroundColor: "#e9fbf6",
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 24,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: "#e9fbf6",
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.text,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 0,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1.5,
    color: colors.text,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
    marginTop: 12,
    minHeight: 80,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  privacyNote: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    lineHeight: 18,
    marginTop: 8,
  },
  binaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  binaryOption: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    paddingVertical: 12,
  },
  binaryOptionActive: {
    backgroundColor: "#e9fbf6",
    borderColor: colors.accent,
  },
  binaryOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  binaryOptionTextActive: {
    color: colors.text,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
});
