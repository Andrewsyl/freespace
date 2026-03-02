import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Preferences and defaults</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          <Text style={styles.cardBody}>
            Configure notifications, privacy, and payment preferences here.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardBody}>Need help? Contact support@freespace.app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
    paddingBottom: spacing.screenX,
    gap: spacing.gap,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.card,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
});
