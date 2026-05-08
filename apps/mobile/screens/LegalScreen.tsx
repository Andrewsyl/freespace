import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { BackButton } from "../components/ui";

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
  const openEmail = (subject: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    void Linking.openURL(url);
  };
  const openPolicy = (slug: string) => {
    void Linking.openURL(`${WEBSITE_BASE}/legal/${slug}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.header}>
          <Text style={styles.title}>Terms & privacy</Text>
          <Text style={styles.subtitle}>Policies, support, and company details</Text>
        </View>

        <Text style={styles.sectionKicker}>Legal</Text>
        <Text style={styles.sectionTitle}>FreeSpace policies</Text>
        <Text style={styles.body}>
          Review the live legal documents that govern bookings, hosting, privacy, refunds, community conduct, parking rules, and enforcement.
        </Text>

        {POLICY_LINKS.map((policy) => (
          <View style={styles.card} key={policy.slug}>
            <Text style={styles.cardTitle}>{policy.title}</Text>
            <Text style={styles.cardBody}>{policy.description}</Text>
            <Pressable style={styles.cardAction} onPress={() => openPolicy(policy.slug)}>
              <Text style={styles.cardActionText}>Open policy</Text>
              <Text style={styles.cardActionChevron}>›</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.sectionKicker}>GDPR requests</Text>
        <Text style={styles.sectionTitle}>Your rights</Text>
        <Text style={styles.body}>
          You can request a copy of your data or ask us to delete your account at any time. We
          handle requests within 30 days.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export my data</Text>
          <Text style={styles.cardBody}>We’ll email you a downloadable copy of your data.</Text>
          <Pressable
            style={styles.cardAction}
            onPress={() => openEmail("GDPR data export request")}
          >
            <Text style={styles.cardActionText}>Request export</Text>
            <Text style={styles.cardActionChevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delete my account</Text>
          <Text style={styles.cardBody}>
            We’ll confirm before removing your account and anonymising your bookings.
          </Text>
          <Pressable
            style={[styles.cardAction, styles.cardActionDanger]}
            onPress={() => openEmail("GDPR delete account request")}
          >
            <Text style={[styles.cardActionText, styles.cardActionTextDanger]}>
              Request deletion
            </Text>
            <Text style={[styles.cardActionChevron, styles.cardActionTextDanger]}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionKicker}>Company</Text>
        <Text style={styles.sectionTitle}>Support and registered business details</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{COMPANY_NAME}</Text>
          <Text style={styles.cardBody}>Support email: {SUPPORT_EMAIL}</Text>
          <Text style={styles.cardBody}>Registered business: {REGISTERED_NAME}</Text>
          <Text style={styles.cardBody}>Registered address: {REGISTERED_ADDRESS}</Text>
          <Text style={styles.footnote}>
            Replace the registered business name and address above with the exact launch entity and registered office before public launch.
          </Text>
          <Pressable style={styles.cardAction} onPress={() => openEmail("Support request")}>
            <Text style={styles.cardActionText}>Email support</Text>
            <Text style={styles.cardActionChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    paddingBottom: spacing.md,
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
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: 16,
  },
  sectionKicker: {
    ...textStyles.kicker,
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: spacing.card,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  cardAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  cardActionDanger: {
  },
  cardActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  cardActionTextDanger: {
    color: "#b42318",
  },
  cardActionChevron: {
    color: colors.textSoft,
    fontSize: 18,
    lineHeight: 18,
    marginTop: -1,
  },
  footnote: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});
