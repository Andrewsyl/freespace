import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../types";
import { DetailNavBar, FieldRow, SectionTitle } from "../components/profileUi";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

const SUPPORT_EMAIL = "support@freespace.ie";
const WEBSITE_BASE = "https://freespace.ie";

const POLICY_LINKS = [
  { title: "Terms of Service", slug: "terms-of-service" },
  { title: "Privacy Policy", slug: "privacy-policy" },
  { title: "Cookie Policy", slug: "cookie-policy" },
  { title: "Refund and cancellation policy", slug: "refund-cancellation-policy" },
  { title: "Host terms", slug: "host-terms" },
  { title: "Acceptable use policy", slug: "acceptable-use-policy" },
  { title: "Community and review guidelines", slug: "community-guidelines" },
  { title: "Parking terms and liability", slug: "parking-terms-liability" },
  { title: "Clamping and enforcement policy", slug: "clamping-enforcement" },
  { title: "Data processing terms", slug: "data-processing-terms" },
] as const;

export function LegalScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const openEmail = (subject: string) =>
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  const openPolicy = (slug: string) => void Linking.openURL(`${WEBSITE_BASE}/legal/${slug}`);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <DetailNavBar title="Terms & privacy" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle style={styles.firstSection}>Policies</SectionTitle>
        {POLICY_LINKS.map((p) => (
          <FieldRow key={p.slug} label={p.title} onPress={() => openPolicy(p.slug)} />
        ))}

        <SectionTitle>Your rights</SectionTitle>
        <FieldRow label="Export my data" onPress={() => openEmail("GDPR data export request")} />
        <FieldRow label="Delete my account" danger onPress={() => openEmail("GDPR delete account request")} />

        <SectionTitle>Company</SectionTitle>
        <View style={styles.company}>
          <Text style={styles.companyName}>FreeSpace</Text>
          <Text style={styles.companyLine}>Dublin, Ireland</Text>
        </View>
        <FieldRow label="Email support" value={SUPPORT_EMAIL} onPress={() => openEmail("Support request")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  firstSection: { marginTop: 8 },
  company: { paddingVertical: 14 },
  companyName: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111820" },
  companyLine: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14.5, color: "#69727D", marginTop: 3 },
});
