import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { colors, radius, spacing, textStyles } from "../styles/theme";
import { useToastOnMessage } from "../components/GlobalToast";
import { Button } from "../components/ui";
import {
  createPaymentMethodSetupIntent,
  deletePaymentMethod,
  listPaymentHistory,
  listPaymentMethods,
  retryPayment,
  setDefaultPaymentMethod,
  type PaymentHistoryItem,
  type PaymentMethod,
} from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

export function PaymentsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const { confirmSetupIntent } = useStripe();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [adding, setAdding] = useState(false);

  useToastOnMessage(error, { variant: "danger" });

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextMethods, nextHistory] = await Promise.all([
        listPaymentMethods(token),
        listPaymentHistory(token),
      ]);
      setMethods(nextMethods);
      setHistory(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddCard = () => {
    setShowAdd((prev) => !prev);
    setError(null);
  };

  const handleSaveCard = async () => {
    if (!token) return;
    if (!cardComplete) {
      Alert.alert("Card details", "Please complete the card details first.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const clientSecret = await createPaymentMethodSetupIntent(token);
      const { error: stripeError, setupIntent } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: "Card",
      });
      if (stripeError) {
        setError(stripeError.message ?? "Card setup failed");
        return;
      }
      if (setupIntent?.status?.toLowerCase() !== "succeeded") {
        setError("Card setup did not complete. Please try again.");
        return;
      }
      await loadData();
      setShowAdd(false);
      setCardComplete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add card");
    } finally {
      setAdding(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await setDefaultPaymentMethod(token, id);
      setMethods((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === id,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payment method");
    }
  };

  const handleDelete = (id: string) => {
    if (!token) return;
    Alert.alert("Remove card", "This card will be removed from your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await deletePaymentMethod(token, id);
            setMethods((prev) => prev.filter((item) => item.id !== id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to remove card");
          }
        },
      },
    ]);
  };

  const handleRetry = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await retryPayment(token, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry payment");
    }
  };

  const formattedHistory = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        amountLabel: `${(item.amount / 100).toFixed(2)} ${item.currency.toUpperCase()}`,
        dateLabel: new Date(item.created_at).toLocaleDateString(),
      })),
    [history]
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <Text style={styles.navTitle}>Payments</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Sign in to manage cards and view charges.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Payments</Text>
        <View style={styles.navSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Manage cards and review your booking charges.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#0a8050" />
              <Text style={styles.loadingText}>Loading payments…</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Payment methods</Text>
              <Button
                title={showAdd ? "Close" : "Add card"}
                onPress={handleAddCard}
                size="small"
                style={styles.addButton}
              />
            </View>
            {showAdd ? (
              <View style={styles.addCardPanel}>
                <Text style={styles.addCardLabel}>Card details</Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{
                    number: "4242 4242 4242 4242",
                  }}
                  cardStyle={styles.cardField}
                  style={styles.cardFieldContainer}
                  onCardChange={(details) => setCardComplete(!!details.complete)}
                />
                <Button
                  title={adding ? "Saving..." : "Save card"}
                  onPress={handleSaveCard}
                  disabled={!cardComplete || adding}
                  style={styles.saveButton}
                />
              </View>
            ) : null}
            {methods.length === 0 && !loading ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No cards saved yet.</Text>
              </View>
            ) : (
              methods.map((method) => (
                <View key={method.id} style={styles.row}>
                  <MaterialIcons name="credit-card" size={24} color="#111827" />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>
                      {method.brand?.toUpperCase() || "CARD"} •••• {method.last4}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      Expires {method.exp_month}/{String(method.exp_year).slice(-2)}
                      {method.is_default ? " • Default" : ""}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    {!method.is_default ? (
                      <Pressable
                        style={styles.rowActionButton}
                        onPress={() => handleSetDefault(method.id)}
                      >
                        <Text style={styles.rowActionText}>Default</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.rowStatus}>Default</Text>
                    )}
                    <Pressable
                      style={[styles.rowActionButton, styles.rowDelete]}
                      onPress={() => handleDelete(method.id)}
                    >
                      <Text style={styles.rowDeleteText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
        </View>

        <Text style={styles.poweredBy}>Powered by Stripe</Text>

        <Text style={styles.sectionHeader}>Payment history</Text>
        <View style={styles.section}>
          {formattedHistory.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No payments yet.</Text>
            </View>
          ) : (
            formattedHistory.map((item) => (
              <View key={item.id} style={styles.row}>
                <MaterialIcons name="receipt-long" size={24} color="#111827" />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.description}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.amountLabel} • {item.dateLabel}
                  </Text>
                  <Text style={styles.rowMeta}>{item.status.toUpperCase()}</Text>
                </View>
                {item.status !== "succeeded" ? (
                  <Pressable
                    style={[styles.rowActionButton, styles.rowRetry]}
                    onPress={() => handleRetry(item.id)}
                  >
                    <Text style={styles.rowActionText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
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
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 28,
    paddingTop: 8,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6E4",
    backgroundColor: "#ffffff",
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111827" },
  navSpacer: { width: 34 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  loadingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginTop: 6,
  },
  subtitle: {
    color: "#6B6B6B",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  section: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionHeader: {
    color: colors.text,
    fontSize: 17,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.3,
    marginBottom: 10,
    marginTop: 8,
  },
  poweredBy: {
    color: colors.textSoft,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeaderRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  addButton: {
    minHeight: 38,
  },
  addCardPanel: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  addCardLabel: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  cardFieldContainer: {
    height: 48,
  },
  cardField: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
  },
  saveButton: {
    minHeight: 44,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  rowMeta: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 4,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  rowActionButton: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rowActionText: {
    color: colors.text,
    fontSize: 11,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowStatus: {
    color: "#0a8050",
    fontSize: 11,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowDelete: {
    borderColor: "#fecaca",
  },
  rowDeleteText: {
    color: "#b42318",
    fontSize: 11,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowRetry: {
    borderColor: "#fcd34d",
  },
  emptyRow: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0a8050",
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
  },
});
