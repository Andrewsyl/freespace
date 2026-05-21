import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../types";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Preferences and defaults</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          <Text style={styles.cardBody}>
            Configure notifications, privacy, and payment preferences here.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardBody}>Need help? Contact support@freespace.ie.</Text>
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
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 29,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  content: {
    paddingBottom: spacing.screenX,
    paddingTop: 0,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    marginLeft: spacing.screenX,
    marginTop: spacing.screenY,
  },
  backText: {
    ...textStyles.body,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginBottom: 14,
    padding: spacing.card,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  cardBody: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
});
