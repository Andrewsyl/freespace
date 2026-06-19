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
import { SquircleBtn } from "../components/SquircleBtn";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CreditCard, Lock, Plus, ReceiptText, ShieldCheck, X } from "lucide-react-native";
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
import { formatReviewDate } from "../utils/dateFormat";
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
        dateLabel: formatReviewDate(new Date(item.created_at)),
      })),
    [history]
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <Text style={styles.navTitle}>Payments</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.gatedIconWrap}>
            <CreditCard size={24} color="#0a8050" strokeWidth={2.2} />
          </View>
          <Text style={styles.emptyTitle}>Payments</Text>
          <Text style={styles.emptySubtitle}>Sign in to manage your payment methods and view booking charges.</Text>
          <SquircleBtn
            label="Sign in"
            onPress={() => navigation.navigate("SignIn")}
            style={{ marginTop: 20 }}
          />
          <View style={styles.gatedHintRow}>
            <ShieldCheck size={14} color="#9ca3af" strokeWidth={2.1} />
            <Text style={styles.gatedHintText}>Your payment details are encrypted and secure.</Text>
          </View>
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
          </View>

          {/* Saved cards */}
          {methods.map((method) => (
            <View key={method.id} style={styles.row}>
              <View style={styles.cardIconWrap}>
                <CreditCard size={18} color="#374151" strokeWidth={1.8} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"} ···· {method.last4}
                </Text>
                <Text style={styles.rowSubtitle}>
                  Expires {method.exp_month}/{String(method.exp_year).slice(-2)}
                </Text>
              </View>
              <View style={styles.rowActions}>
                {method.is_default ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                ) : (
                  <Pressable style={styles.rowActionButton} onPress={() => handleSetDefault(method.id)}>
                    <Text style={styles.rowActionText}>Set default</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.rowActionButton, styles.rowDelete]} onPress={() => handleDelete(method.id)}>
                  <Text style={styles.rowDeleteText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* Add card trigger row */}
          {!showAdd && (
            <Pressable style={styles.addCardRow} onPress={handleAddCard}>
              <View style={styles.addCardRowIcon}>
                <Plus size={16} color="#0a8050" strokeWidth={2.5} />
              </View>
              <Text style={styles.addCardRowText}>Add a card</Text>
            </Pressable>
          )}

          {/* Add card form */}
          {showAdd && (
            <View style={styles.addCardPanel}>
              <View style={styles.addCardPanelHeader}>
                <Lock size={14} color="#0a8050" strokeWidth={2} />
                <Text style={styles.addCardPanelTitle}>New card</Text>
                <Pressable onPress={handleAddCard} hitSlop={8} style={styles.addCardClose}>
                  <X size={16} color="#6b7280" strokeWidth={2} />
                </Pressable>
              </View>

              <CardField
                postalCodeEnabled={false}
                cardStyle={{ ...styles.cardField, placeholderColor: "#9ca3af", textColor: "#111827" }}
                style={styles.cardFieldContainer}
                onCardChange={(details) => setCardComplete(!!details.complete)}
              />

              <View style={styles.securityNote}>
                <ShieldCheck size={12} color="#9ca3af" strokeWidth={2} />
                <Text style={styles.securityNoteText}>Encrypted by Stripe · Your card number is never stored on our servers</Text>
              </View>

              <Button
                title={adding ? "Saving…" : "Save card"}
                onPress={handleSaveCard}
                disabled={!cardComplete || adding}
                loading={adding}
                style={styles.saveCardBtn}
              />
            </View>
          )}

          {methods.length === 0 && !showAdd && !loading && (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No cards saved yet.</Text>
            </View>
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
                <ReceiptText size={24} color="#111827" strokeWidth={2} />
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
    backgroundColor: "#F4F6F8",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 14,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },
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
    backgroundColor: "#ffffff",
    borderColor: "#E3E8EE",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
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
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  defaultBadge: {
    backgroundColor: "#f0faf5",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultBadgeText: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
  },
  addCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addCardRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0faf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  addCardRowText: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
  },
  addCardPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 14,
  },
  addCardPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addCardPanelTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
  },
  addCardClose: {
    padding: 4,
  },
  cardFieldContainer: {
    height: 56,
  },
  cardField: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: -4,
  },
  securityNoteText: {
    flex: 1,
    color: "#9ca3af",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  saveCardBtn: {
    minHeight: 50,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 17,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowActionText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowStatus: {
    color: "#0a8050",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowDelete: {
    borderColor: "#fecaca",
  },
  rowDeleteText: {
    color: "#b42318",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowRetry: {
    borderColor: "#fcd34d",
  },
  emptyRow: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 21,
    color: "#111827",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  gatedIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f0faf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  gatedHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  gatedHintText: {
    color: "#9ca3af",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    flexShrink: 1,
  },
});
