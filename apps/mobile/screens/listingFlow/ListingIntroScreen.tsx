import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, MapPin, Camera, CircleDollarSign } from "lucide-react-native";
import { hostFlowColors } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";

type FlowStackParamList = {
  ListingIntro: undefined;
  ListingLocation: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingIntro">;

const PHASES = [
  {
    icon: MapPin,
    label: "Your space",
    body: "Location, space type, number of bays, and vehicle size",
  },
  {
    icon: Camera,
    label: "Photos & features",
    body: "Upload photos and highlight what makes your space great",
  },
  {
    icon: CircleDollarSign,
    label: "Availability & pricing",
    body: "Set when the space is available and how much you charge",
  },
] as const;

export function ListingIntroScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <X size={17} color={hostFlowColors.text} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.eyebrow}>Host on FreeSpace</Text>
          <Text style={styles.headline}>List your space</Text>
          <Text style={styles.subline}>
            Takes about 5 minutes. Here's what we'll cover:
          </Text>
        </View>

        <View style={styles.phases}>
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <View key={phase.label} style={styles.phaseRow}>
                <View style={styles.phaseLeft}>
                  <View style={styles.phaseIconWrap}>
                    <Icon size={18} color={hostFlowColors.accent} strokeWidth={2} />
                  </View>
                  {i < PHASES.length - 1 ? <View style={styles.phaseLine} /> : null}
                </View>
                <View style={styles.phaseText}>
                  <Text style={styles.phaseLabel}>{phase.label}</Text>
                  <Text style={styles.phaseBody}>{phase.body}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.permissionNote}>
          By listing, you confirm you have the right to rent this space to others.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.startBtn}
          onPress={() => navigation.navigate("ListingLocation")}
        >
          <Text style={styles.startBtnText}>Get started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: hostFlowColors.cardBg,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 28,
    paddingBottom: 24,
  },
  heroBlock: {
    marginBottom: 36,
  },
  eyebrow: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  headline: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 34,
    letterSpacing: -1,
    lineHeight: 46,
    marginBottom: 10,
  },
  subline: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  phases: {
    gap: 0,
    marginBottom: 28,
  },
  phaseRow: {
    flexDirection: "row",
    gap: 16,
  },
  phaseLeft: {
    alignItems: "center",
    width: 40,
  },
  phaseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: hostFlowColors.accentSoft,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  phaseLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: hostFlowColors.accentSoftBorder,
    marginVertical: 6,
    minHeight: 20,
  },
  phaseText: {
    flex: 1,
    paddingBottom: 24,
    justifyContent: "center",
    paddingTop: 9,
  },
  phaseLabel: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  phaseBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 3,
  },
  permissionNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
  },
  startBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: hostFlowColors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    color: "#ffffff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
