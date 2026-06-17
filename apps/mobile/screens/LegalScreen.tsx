import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

const SUPPORT_EMAIL = "support@freespace.ie";
const WEBSITE_BASE = "https://freespace.ie";
const COMPANY_NAME = "FreeSpace";
const REGISTERED_NAME = "FreeSpace";
const REGISTERED_ADDRESS = "Dublin, Ireland";

const POLICY_LINKS = [
  { title: "Terms of Service", description: "Marketplace booking and account terms.", slug: "terms-of-service" },
  { title: "Privacy Policy", description: "How FreeSpace collects and uses personal data.", slug: "privacy-policy" },
  { title: "Cookie Policy", description: "Website cookie and analytics usage.", slug: "cookie-policy" },
  { title: "Refund and cancellation policy", description: "Cancellation windows, refunds, and disputes.", slug: "refund-cancellation-policy" },
  { title: "Host terms", description: "Rules for hosts and operators listing spaces.", slug: "host-terms" },
  { title: "Acceptable use policy", description: "Prohibited conduct and enforcement actions.", slug: "acceptable-use-policy" },
  { title: "Community and review guidelines", description: "Rules for reviews and respectful conduct.", slug: "community-guidelines" },
  { title: "Parking terms and liability", description: "Driver responsibilities, site rules, and liability wording.", slug: "parking-terms-liability" },
  { title: "Clamping and enforcement policy", description: "How site enforcement and disputes are handled.", slug: "clamping-enforcement" },
  { title: "Data processing terms", description: "Business-facing data handling and processor terms.", slug: "data-processing-terms" },
] as const;

export function LegalScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const openEmail = (subject: string) => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  };
  const openPolicy = (slug: string) => {
    void Linking.openURL(`${WEBSITE_BASE}/legal/${slug}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Terms & privacy</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── FreeSpace policies ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FreeSpace policies</Text>
          <Text style={styles.sectionBody}>
            Review the live legal documents that govern bookings, hosting, privacy, refunds, community conduct, parking rules, and enforcement.
          </Text>
          <View style={styles.listBox}>
            {POLICY_LINKS.map((policy, i) => (
              <Pressable
                key={policy.slug}
                style={[styles.listRow, i > 0 && styles.listRowBorder]}
                onPress={() => openPolicy(policy.slug)}
              >
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle}>{policy.title}</Text>
                  <Text style={styles.listRowSub}>{policy.description}</Text>
                </View>
                <ChevronRight size={16} color="#9ca3af" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── GDPR ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your rights</Text>
          <Text style={styles.sectionBody}>
            You can request a copy of your data or ask us to delete your account at any time. We handle requests within 30 days.
          </Text>
          <View style={styles.listBox}>
            <Pressable style={styles.listRow} onPress={() => openEmail("GDPR data export request")}>
              <View style={styles.listRowContent}>
                <Text style={styles.listRowTitle}>Export my data</Text>
                <Text style={styles.listRowSub}>We'll email you a downloadable copy of your data.</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
            <Pressable style={[styles.listRow, styles.listRowBorder]} onPress={() => openEmail("GDPR delete account request")}>
              <View style={styles.listRowContent}>
                <Text style={[styles.listRowTitle, styles.listRowTitleDanger]}>Delete my account</Text>
                <Text style={styles.listRowSub}>We'll confirm before removing your account and anonymising your bookings.</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
          </View>
        </View>

        {/* ── Company ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Company</Text>
          <View style={styles.listBox}>
            <View style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={styles.listRowTitle}>{COMPANY_NAME}</Text>
                <Text style={styles.listRowSub}>Support: {SUPPORT_EMAIL}</Text>
                <Text style={styles.listRowSub}>Registered: {REGISTERED_NAME}</Text>
                <Text style={styles.listRowSub}>{REGISTERED_ADDRESS}</Text>
              </View>
            </View>
            <Pressable style={[styles.listRow, styles.listRowBorder]} onPress={() => openEmail("Support request")}>
              <View style={styles.listRowContent}>
                <Text style={styles.listRowTitle}>Email support</Text>
                <Text style={styles.listRowSub}>{SUPPORT_EMAIL}</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const LINE = "#E5E7EB";
const FG   = "#111827";
const MUTED = "#374151";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },

  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3 },
  navSpacer: { width: 38 },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15,
    color: FG, letterSpacing: -0.2, marginBottom: 8,
  },
  sectionBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14,
    color: MUTED, lineHeight: 22, marginBottom: 14,
  },

  listBox: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden", marginBottom: 12,
  },
  listRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#ffffff",
  },
  listRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  listRowContent: { flex: 1 },
  listRowTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG },
  listRowTitleDanger: { color: "#b42318" },
  listRowSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 2 },
});
