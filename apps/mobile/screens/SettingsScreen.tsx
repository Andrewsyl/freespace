import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import type { RootStackParamList } from "../types";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={styles.navSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>App preferences and information</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <Text style={styles.cardBody}>
            Push notification preferences are managed in your device's system settings. Booking confirmations and updates are always sent by email.
          </Text>
          <Pressable style={styles.cardLink} onPress={() => {
            const { Linking } = require("react-native");
            Linking.openSettings();
          }}>
            <Text style={styles.cardLinkText}>Open system settings →</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardBody}>For booking issues, refunds, or account questions, contact our team.</Text>
          <Pressable style={styles.cardLink} onPress={() => navigation.navigate("Support")}>
            <Text style={styles.cardLinkText}>Contact support →</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Text style={styles.cardBody}>View our Terms of Service and Privacy Policy.</Text>
          <Pressable style={styles.cardLink} onPress={() => navigation.navigate("Legal")}>
            <Text style={styles.cardLinkText}>Terms &amp; Privacy →</Text>
          </Pressable>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6E4",
    backgroundColor: "#ffffff",
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: "#6B6B6B",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  content: {
    paddingBottom: spacing.screenX,
    paddingTop: 0,
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111827" },
  navSpacer: { width: 34 },
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
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  cardLink: { marginTop: 10 },
  cardLinkText: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  cardBody: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
});
