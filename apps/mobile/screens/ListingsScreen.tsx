import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createHostPayoutLink,
  deleteListing,
  getHostEarningsSummary,
  getHostPayoutStatus,
  listHostListings,
  type HostPayoutStatus,
} from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import type { ListingSummary, RootStackParamList } from "../types";
import { colors, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";
import { useGlobalLoading } from "../components/GlobalLoading";
import { formatListingPriceLine } from "../utils/pricing";

type Props = NativeStackScreenProps<RootStackParamList, "Listings">;

export function ListingsScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const platformFeePercent = 10;
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ totalCents: number; feeCents: number; netCents: number } | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<HostPayoutStatus | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const { show: showGlobalLoading, hide: hideGlobalLoading } = useGlobalLoading();
  const payoutIsMock = Boolean(payoutStatus?.accountId?.startsWith("acct_mock_"));

  useToastOnMessage(error, { variant: "danger" });

  const loadListings = useCallback(async () => {
    if (!token) return;
    showGlobalLoading("Loading listings...");
    setLoading(true);
    setError(null);
    try {
      const [data, summary, payout] = await Promise.all([
        listHostListings(token),
        getHostEarningsSummary(token),
        getHostPayoutStatus(token),
      ]);
      setListings(data);
      setEarnings(summary);
      setPayoutStatus(payout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
      hideGlobalLoading();
    }
  }, [hideGlobalLoading, showGlobalLoading, token]);

  const formatAmount = (cents?: number) => {
    const value = typeof cents === "number" ? cents : 0;
    return `€${(value / 100).toFixed(2)}`;
  };

  const emptyListingsState = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>No listings yet</Text>
      <Text style={styles.cardBody}>
        Create a listing to start earning from your parking space.
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate("CreateListingFlow")}
      >
        <Text style={styles.primaryButtonText}>List a space</Text>
      </Pressable>
    </View>
  );

  const handlePayoutSetup = useCallback(async () => {
    if (!token) return;
    setPayoutBusy(true);
    setError(null);
    try {
      const link = await createHostPayoutLink({
        token,
        accountId:
          payoutStatus?.accountId && !payoutStatus.accountId.startsWith("acct_mock_")
            ? payoutStatus.accountId
            : undefined,
      });
      if (link.onboardingUrl) {
        await Linking.openURL(link.onboardingUrl);
      } else if (link.mock || link.accountId.startsWith("acct_mock_")) {
        Alert.alert(
          "Payout setup unavailable",
          "Stripe Connect is not fully enabled in this environment yet, so host payout onboarding can't open here."
        );
      } else {
        Alert.alert(
          "Payout setup unavailable",
          "We couldn't open the payout onboarding link right now. Please try again in a moment."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup");
    } finally {
      setPayoutBusy(false);
    }
  }, [payoutStatus?.accountId, token]);

  const payoutStatusMessage = (() => {
    if (!payoutStatus) return null;
    if (payoutStatus.payoutsEnabled) {
      return "Payouts are active. Transfers will arrive automatically.";
    }
    if (payoutIsMock) {
      return "Payout onboarding is not available in this environment yet.";
    }
    if (payoutStatus.requirementsDue.length > 0) {
      return "Stripe still needs a few details before payouts can be enabled.";
    }
    if (payoutStatus.detailsSubmitted) {
      return "Your details were submitted. Stripe is still reviewing the payout account.";
    }
    if (payoutStatus.accountId) {
      return "Finish payout setup to receive earnings.";
    }
    return "Connect Stripe to receive host payouts.";
  })();

  const handleDelete = useCallback(
    (listingId: string) => {
      if (!token) {
        setError("Sign in to delete listings.");
        return;
      }
      Alert.alert("Delete listing", "This will permanently remove the listing.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(listingId);
            try {
              await deleteListing({ token, listingId });
              setListings((prev) => prev.filter((item) => item.id !== listingId));
              await AsyncStorage.setItem("deletedListingId", listingId);
              await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete listing");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadListings();
    }, [loadListings])
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("Tabs", { screen: "Search" });
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Your listings</Text>
        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate("CreateListingFlow")}
        >
          <Ionicons name="add" size={16} color={colors.text} />
          <Text style={styles.actionText}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={styles.content}>
          {!user ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign in to host</Text>
              <Text style={styles.cardBody}>
                Log in to manage listings and start earning from your space.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
            {loading && listings.length === 0 ? (
              <Text style={styles.muted}>Loading listings…</Text>
            ) : null}
            {earnings ? (
              <View style={styles.earningsCard}>
                <View style={styles.earningsTitleRow}>
                <Ionicons name="wallet-outline" size={16} color={colors.accent} />
                <Text style={styles.earningsTitle}>Earnings summary</Text>
              </View>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>Total earned</Text>
                  <Text style={styles.earningsValue}>{formatAmount(earnings.totalCents)}</Text>
                </View>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>Platform fee</Text>
                  <Text style={styles.earningsValue}>{formatAmount(earnings.feeCents)}</Text>
                </View>
                <Text style={styles.earningsHint}>
                  {platformFeePercent}% platform fee applied per booking.
                </Text>
                <View style={[styles.earningsRow, styles.earningsRowStrong]}>
                  <Text style={styles.earningsLabelStrong}>Net payout</Text>
                  <Text style={styles.earningsValueStrong}>{formatAmount(earnings.netCents)}</Text>
                </View>
              </View>
            ) : null}
            {payoutStatus ? (
              <View style={styles.payoutCard}>
                <View style={styles.payoutTitleRow}>
                  <Ionicons name="card-outline" size={16} color={colors.accent} />
                  <Text style={styles.payoutTitle}>Payouts</Text>
                </View>
                <Text style={styles.payoutBody}>{payoutStatusMessage}</Text>
                {payoutStatus.requirementsDue.length > 0 ? (
                  <Text style={styles.payoutHint}>
                    Missing: {payoutStatus.requirementsDue.slice(0, 3).join(", ")}
                    {payoutStatus.requirementsDue.length > 3 ? "..." : ""}
                  </Text>
                ) : null}
                {!payoutStatus.payoutsEnabled && !payoutIsMock ? (
                  <Pressable
                    style={[styles.primaryButton, payoutBusy && styles.primaryButtonDisabled]}
                    onPress={handlePayoutSetup}
                    disabled={payoutBusy}
                  >
                    <Text style={styles.primaryButtonText}>
                      {payoutBusy ? "Opening..." : "Complete payout setup"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {listings.length === 0 && !loading ? (
              emptyListingsState
            ) : (
              <View style={styles.list}>
                {listings.map((listing) => (
                  <Pressable
                    key={listing.id}
                    style={styles.listCard}
                  onPress={() =>
                    navigation.navigate("CreateListingFlow", { listingId: listing.id })
                  }
                >
                    {listing.image_urls?.[0] ? (
                      <Image source={{ uri: listing.image_urls[0] }} style={styles.listImage} />
                    ) : (
                      <View style={styles.listPlaceholder}>
                        <Text style={styles.listPlaceholderText}>No image</Text>
                      </View>
                    )}
                    <View style={styles.listBody}>
                      <View style={styles.listTitleRow}>
                        <Text style={styles.listTitle} numberOfLines={1}>
                          {listing.title}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSoft} />
                      </View>
                      <Text style={styles.listMeta} numberOfLines={1}>
                        {listing.address}
                      </Text>
                      <View style={styles.listFooter}>
                        <Text style={styles.listPrice}>{formatListingPriceLine(listing)}</Text>
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => handleDelete(listing.id)}
                          disabled={deletingId === listing.id}
                        >
                          <Text style={styles.deleteButtonText}>
                            {deletingId === listing.id ? "Deleting..." : "Delete"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    width: 40,
    height: 40,
  },
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: "center",
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
  },
  emptyIllustration: {
    width: 220,
    height: 150,
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 10,
  },
  earningsCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  earningsTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  earningsTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  earningsRowStrong: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  earningsHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  earningsLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  earningsValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  earningsLabelStrong: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  earningsValueStrong: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: "700",
  },
  payoutCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  payoutTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  payoutTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  payoutBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  payoutHint: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  list: {
    gap: 12,
  },
  listCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  listImage: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: 82,
    width: 100,
  },
  listPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 82,
    justifyContent: "center",
    width: 100,
  },
  listPlaceholderText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  listBody: {
    flex: 1,
    gap: 3,
    justifyContent: "space-between",
  },
  listTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
  },
  listFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  listTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  listMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  listPrice: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 14,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  primaryButtonDisabled: {
    backgroundColor: "#a7f3d0",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  actionText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
});
