import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CreditCard, Lock, Plus, ShieldCheck, X } from "lucide-react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { useToastOnMessage } from "../components/GlobalToast";
import { Button } from "../components/ui";
import { SignInWall } from "../components/SignInWall";
import { DetailNavBar, SectionTitle } from "../components/profileUi";
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
import { colors } from "../styles/theme";
import { formatReviewDate } from "../utils/dateFormat";
import type { RootStackParamList } from "../types";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

export function PaymentsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
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
      const { error: stripeError, setupIntent } = await confirmSetupIntent(clientSecret, { paymentMethodType: "Card" });
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
      setMethods((prev) => prev.map((item) => ({ ...item, is_default: item.id === id })));
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
        <StatusBar barStyle="dark-content" />
        <DetailNavBar title="Payments" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
        <SignInWall
          icon={<CreditCard size={26} color={colors.primary} strokeWidth={2.2} />}
          title="Manage your payments"
          body="Sign in to add payment methods and see your booking charges."
          onSignIn={() => navigation.navigate("Welcome")}
          onBrowse={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
          reassurance="Your payment details are encrypted and secure."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <DetailNavBar title="Payments" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading payments…</Text>
          </View>
        ) : null}

        <SectionTitle style={styles.firstSection}>Payment methods</SectionTitle>

        {methods.map((method) => (
          <View key={method.id} style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <CreditCard size={19} color={colors.text} strokeWidth={1.9} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"} ···· {method.last4}
              </Text>
              <Text style={styles.cardSub}>
                Expires {method.exp_month}/{String(method.exp_year).slice(-2)}
              </Text>
            </View>
            <View style={styles.cardActions}>
              {method.is_default ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              ) : (
                <Pressable style={styles.actionBtn} onPress={() => handleSetDefault(method.id)}>
                  <Text style={styles.actionText}>Set default</Text>
                </Pressable>
              )}
              <Pressable style={styles.actionBtn} onPress={() => handleDelete(method.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {methods.length === 0 && !showAdd && !loading ? (
          <Text style={styles.emptyText}>No cards saved yet.</Text>
        ) : null}

        {showAdd ? (
          <View style={styles.addPanel}>
            <View style={styles.addHeader}>
              <Lock size={14} color={colors.primary} strokeWidth={2} />
              <Text style={styles.addTitle}>New card</Text>
              <Pressable onPress={() => setShowAdd(false)} hitSlop={8}>
                <X size={16} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            </View>
            <CardField
              postalCodeEnabled={false}
              cardStyle={{ ...styles.cardField, placeholderColor: colors.textDisabled, textColor: colors.text }}
              style={styles.cardFieldContainer}
              onCardChange={(details) => setCardComplete(!!details.complete)}
            />
            <View style={styles.secureNote}>
              <ShieldCheck size={12} color={colors.textDisabled} strokeWidth={2} />
              <Text style={styles.secureText}>Encrypted by Stripe · Your card number is never stored on our servers</Text>
            </View>
            <Button title={adding ? "Saving…" : "Save card"} onPress={handleSaveCard} disabled={!cardComplete || adding} loading={adding} />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addRow, pressed && styles.rowPressed]}
            onPress={() => {
              setShowAdd(true);
              setError(null);
            }}
          >
            <View style={styles.addIcon}>
              <Plus size={16} color={colors.primary} strokeWidth={2.6} />
            </View>
            <Text style={styles.addRowText}>Add a card</Text>
          </Pressable>
        )}

        <Text style={styles.poweredBy}>Powered by Stripe</Text>

        <SectionTitle>Payment history</SectionTitle>
        {formattedHistory.length === 0 ? (
          <Text style={styles.emptyText}>No payments yet.</Text>
        ) : (
          formattedHistory.map((item) => (
            <View key={item.id} style={styles.histRow}>
              <View style={styles.cardText}>
                <Text style={styles.histTitle}>{item.description}</Text>
                <Text style={styles.histSub}>
                  {item.amountLabel} · {item.dateLabel}
                </Text>
                <Text style={styles.histStatus}>{item.status.toUpperCase()}</Text>
              </View>
              {item.status !== "succeeded" ? (
                <Pressable style={styles.actionBtn} onPress={() => handleRetry(item.id)}>
                  <Text style={styles.actionText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cardBg },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  firstSection: { marginTop: 8 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12 },
  loadingText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textSoft },

  cardRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  cardIcon: {
    width: 40, height: 40, borderRadius: 11, backgroundColor: colors.cardBgMuted,
    alignItems: "center", justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15.5, color: colors.text },
  cardSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.textSoft, marginTop: 2 },
  cardActions: { alignItems: "flex-end", gap: 6 },
  actionBtn: { borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  actionText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12.5, color: colors.text },
  removeText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12.5, color: colors.danger },
  defaultBadge: {
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  defaultBadgeText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11.5, color: colors.primary },

  addRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.divider },
  rowPressed: { opacity: 0.6 },
  addIcon: {
    width: 40, height: 40, borderRadius: 11, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center",
  },
  addRowText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15.5, color: colors.primary },

  addPanel: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16, gap: 14 },
  addHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  addTitle: { flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.text },
  cardFieldContainer: { height: 52 },
  cardField: { backgroundColor: colors.cardBgMuted, borderColor: colors.divider, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  secureNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: -4 },
  secureText: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.textDisabled, lineHeight: 18 },

  poweredBy: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 18 },

  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  histTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.text },
  histSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.textSoft, marginTop: 2 },
  histStatus: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: colors.textMuted, marginTop: 4, letterSpacing: 0.4 },

  emptyText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: colors.textSoft, paddingVertical: 16 },
});
