import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, CreditCard, Home, ShieldCheck } from "lucide-react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
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
import { useGlobalLoading } from "../components/GlobalLoading";
import { formatListingPriceLine } from "../utils/pricing";
import { clearHostListingDraft, loadHostListingDraft, type SavedHostListingDraft } from "./listingFlow/draftStorage";

type Props = NativeStackScreenProps<RootStackParamList, "Listings">;

const GREEN  = "#0a8050";
const LINE   = "#d1d5db";
const FG     = "#111827";
const MUTED  = "#374151";
const SUBTLE = "#6b7280";

export function ListingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const platformFeePercent = 0;
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [savedDraft, setSavedDraft] = useState<SavedHostListingDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const skeletonPulse = usePulse();
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
      const localDraft = await loadHostListingDraft();
      setListings(data);
      setSavedDraft(localDraft);
      setEarnings(summary);
      setPayoutStatus(payout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
      hideGlobalLoading();
    }
  }, [hideGlobalLoading, showGlobalLoading, token]);

  const fmt = (cents?: number) => `€${((cents ?? 0) / 100).toFixed(2)}`;
  const draftTitle = savedDraft?.draft.spaceType
    ? `${savedDraft.draft.spaceType} parking`
    : "Unfinished listing";
  const draftAddress = savedDraft?.draft.location.address?.trim() || "Finish setting up your location";

  const payoutStatusMessage = (() => {
    if (!payoutStatus) return null;
    if (payoutStatus.payoutsEnabled) return "Payouts active — transfers arrive automatically.";
    if (payoutIsMock) return "Mock payout account. Start setup to create a real Stripe account.";
    if (payoutStatus.requirementsDue.length > 0) return "Stripe needs a few more details before payouts can go live.";
    if (payoutStatus.detailsSubmitted) return "Details submitted — Stripe is reviewing your payout account.";
    if (payoutStatus.accountId) return "Finish payout setup to receive earnings.";
    return "Connect Stripe to start receiving host payouts.";
  })();

  const handlePayoutSetup = useCallback(async () => {
    if (!token) return;
    setPayoutBusy(true);
    setError(null);
    try {
      const link = await createHostPayoutLink({
        token,
        accountId: payoutStatus?.accountId && !payoutStatus.accountId.startsWith("acct_mock_")
          ? payoutStatus.accountId : undefined,
      });
      if (link.onboardingUrl) {
        await Linking.openURL(link.onboardingUrl);
      } else {
        Alert.alert("Payout setup unavailable", "We couldn't open the payout onboarding link right now. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup");
    } finally {
      setPayoutBusy(false);
    }
  }, [payoutStatus?.accountId, token]);

  const handleDelete = useCallback((listingId: string) => {
    if (!token) return;
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
  }, [token]);

  useFocusEffect(useCallback(() => { void loadListings(); }, [loadListings]));

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Tabs", { screen: "Search" });
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <ArrowLeft size={22} color={FG} />
        </Pressable>
        <Text style={styles.navTitle}>Manage spaces</Text>
        <Pressable style={styles.addBtn} onPress={() => navigation.navigate("CreateListingFlow")}>
          <Plus size={16} color={GREEN} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageLabel}>Hosting</Text>
          <Text style={styles.pageTitle}>Manage spaces</Text>
          {listings.length > 0 ? (
            <Text style={styles.pageSubtitle}>{listings.length} listing{listings.length !== 1 ? "s" : ""}</Text>
          ) : (
            <Text style={styles.pageSubtitle}>Your parking spaces, all in one place</Text>
          )}
        </View>

        {!user ? (
          <View style={styles.gatedCard}>
            <View style={styles.gatedIconWrap}>
              <Home size={24} color={GREEN} strokeWidth={2.1} />
            </View>
            <Text style={styles.emptyTitle}>Sign in to host</Text>
            <Text style={styles.emptyBody}>Manage your spaces, availability, and payouts from one place.</Text>
            <Pressable style={styles.ctaBtn} onPress={() => navigation.navigate("Welcome")}>
              <Text style={styles.ctaBtnText}>Sign in</Text>
            </Pressable>
            <View style={styles.gatedHintRow}>
              <ShieldCheck size={14} color={SUBTLE} strokeWidth={2.1} />
              <Text style={styles.gatedHintText}>Your host dashboard and earnings stay linked to your account.</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Earnings strip */}
            {earnings ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <TrendingUp size={16} color={GREEN} />
                  <Text style={styles.sectionTitle}>Earnings</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Total earned</Text>
                    <Text style={styles.statValue}>{fmt(earnings.totalCents)}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Host fee ({platformFeePercent}%)</Text>
                    <Text style={styles.statValue}>{fmt(earnings.feeCents)}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Net payout</Text>
                    <Text style={[styles.statValue, styles.statValueGreen]}>{fmt(earnings.netCents)}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Payout status */}
            {payoutStatus ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <CreditCard size={16} color={payoutStatus.payoutsEnabled ? GREEN : MUTED} />
                  <Text style={styles.sectionTitle}>Payouts</Text>
                  {payoutStatus.payoutsEnabled ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.payoutBody}>{payoutStatusMessage}</Text>
                {payoutStatus.requirementsDue.length > 0 ? (
                  <Text style={styles.payoutHint}>
                    Missing: {payoutStatus.requirementsDue.slice(0, 3).join(", ")}{payoutStatus.requirementsDue.length > 3 ? "…" : ""}
                  </Text>
                ) : null}
                {!payoutStatus.payoutsEnabled && !payoutIsMock ? (
                  <Pressable
                    style={[styles.ctaBtn, styles.ctaBtnSm, payoutBusy && styles.ctaBtnDisabled]}
                    onPress={handlePayoutSetup}
                    disabled={payoutBusy}
                  >
                    <Text style={styles.ctaBtnText}>
                      {payoutBusy ? "Opening…" : "Complete payout setup"}
                    </Text>
                  </Pressable>
                ) : payoutIsMock && !payoutStatus.payoutsEnabled ? (
                  <Text style={styles.payoutHint}>
                    Running in test mode. Connect a real Stripe account to enable live payouts.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Listings */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Your listings</Text>
              </View>

              {loading && listings.length === 0 ? (
                <View style={styles.skeletonList}>
                  {[0, 1].map((i) => (
                    <View key={i} style={styles.skeletonCard}>
                      <View style={styles.skeletonCardTop}>
                        <SkeletonBlock width="68%" height={16} pulse={skeletonPulse} />
                        <SkeletonBlock width={52} height={22} borderRadius={999} pulse={skeletonPulse} />
                      </View>
                      <SkeletonBlock width="50%" height={12} pulse={skeletonPulse} style={{ marginTop: 10 }} />
                      <View style={styles.skeletonCardBottom}>
                        <SkeletonBlock width={80} height={12} pulse={skeletonPulse} />
                        <SkeletonBlock width={64} height={28} borderRadius={8} pulse={skeletonPulse} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : listings.length === 0 && !savedDraft ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No listings yet</Text>
                  <Text style={styles.emptyBody}>Create a listing to start earning from your parking space.</Text>
                  <Pressable style={styles.ctaBtn} onPress={() => navigation.navigate("CreateListingFlow")}>
                    <Text style={styles.ctaBtnText}>List a space</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.listingGrid}>
                  {savedDraft ? (
                    <Pressable
                      style={({ pressed }) => [styles.listingCard, pressed && { opacity: 0.92 }]}
                      onPress={() => navigation.navigate("CreateListingFlow")}
                    >
                      <View style={styles.listingImagePlaceholder}>
                        <Text style={styles.listingImagePlaceholderText}>Draft</Text>
                      </View>
                      <View style={styles.listingBody}>
                        <View style={styles.listingTitleRow}>
                          <Text style={styles.listingTitle} numberOfLines={1}>{draftTitle}</Text>
                          <View style={styles.draftPill}>
                            <Text style={styles.draftPillText}>Saved</Text>
                          </View>
                        </View>
                        <Text style={styles.listingAddress} numberOfLines={1}>{draftAddress}</Text>
                        <View style={styles.listingFooter}>
                          <Text style={styles.listingPrice}>Continue setup</Text>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={async () => {
                              await clearHostListingDraft();
                              setSavedDraft(null);
                            }}
                          >
                            <Trash2 size={14} color="#b42318" />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ) : null}
                  {listings.map((listing) => (
                    <Pressable
                      key={listing.id}
                      style={({ pressed }) => [styles.listingCard, pressed && { opacity: 0.92 }]}
                      onPress={() => navigation.navigate("CreateListingFlow", { listingId: listing.id })}
                    >
                      {listing.image_urls?.[0] ? (
                        <Image source={{ uri: listing.image_urls[0] }} style={styles.listingImage} />
                      ) : (
                        <View style={styles.listingImagePlaceholder}>
                          <Text style={styles.listingImagePlaceholderText}>No photo</Text>
                        </View>
                      )}
                      <View style={styles.listingBody}>
                        <View style={styles.listingTitleRow}>
                          <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                          <Pencil size={13} color={SUBTLE} />
                        </View>
                        <Text style={styles.listingAddress} numberOfLines={1}>{listing.address}</Text>
                        <View style={styles.listingFooter}>
                          <Text style={styles.listingPrice}>{formatListingPriceLine(listing)}</Text>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={() => handleDelete(listing.id)}
                            disabled={deletingId === listing.id}
                          >
                            {deletingId === listing.id
                              ? <ActivityIndicator size={12} color="#b42318" />
                              : <Trash2 size={14} color="#b42318" />
                            }
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },

  // ── Nav bar ──────────────────────────────────────────────────
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: "#ffffff",
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6, marginRight: -6 },
  addBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: GREEN },

  // ── Page header ──────────────────────────────────────────────
  pageHeader: {
    borderBottomWidth: 1, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  pageLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: GREEN, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
  },
  pageTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 27,
    color: FG, letterSpacing: -0.8, lineHeight: 32, marginBottom: 2,
  },
  pageSubtitle: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: {},

  // ── Sections ─────────────────────────────────────────────────
  section: {
    borderBottomWidth: 1, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingVertical: 20,
  },
  sectionTitleRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 17,
    color: FG, letterSpacing: -0.3, flex: 1,
  },

  // ── Earnings stats ───────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden",
  },
  statCell: {
    flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8,
  },
  statDivider: { width: 1, backgroundColor: LINE },
  statLabel: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: MUTED,
    textAlign: "center", marginBottom: 4,
  },
  statValue: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: FG, letterSpacing: -0.3,
  },
  statValueGreen: { color: GREEN },

  // ── Payout ───────────────────────────────────────────────────
  activePill: {
    backgroundColor: "#EDF7F2", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  activePillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: GREEN },
  payoutBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, lineHeight: 21 },
  payoutHint: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE, marginTop: 6 },

  // ── CTA button ───────────────────────────────────────────────
  ctaBtn: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: GREEN, borderRadius: 14,
    height: 50, marginTop: 16,
  },
  ctaBtnSm: { height: 44, marginTop: 14 },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#ffffff", letterSpacing: -0.2 },

  // ── Empty / loading ──────────────────────────────────────────
  emptyBox: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE,
    padding: 24, alignItems: "center",
  },
  gatedCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  gatedIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf7f2",
    marginBottom: 14,
  },
  emptyTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3 },
  emptyBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, textAlign: "center", marginTop: 6, lineHeight: 21 },
  gatedHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  gatedHintText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 16,
    color: SUBTLE,
    textAlign: "center",
  },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED },
  skeletonList: { gap: 12 },
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  skeletonCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },

  // ── Listing cards ────────────────────────────────────────────
  listingGrid: { gap: 12 },
  listingCard: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE,
    overflow: "hidden", backgroundColor: "#ffffff",
  },
  listingImage: { width: "100%", height: 160 },
  listingImagePlaceholder: {
    width: "100%", height: 160,
    backgroundColor: "#F7F7F6", alignItems: "center", justifyContent: "center",
  },
  listingImagePlaceholderText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: SUBTLE },
  listingBody: { padding: 14 },
  listingTitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  listingTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: FG,
    letterSpacing: -0.3, flex: 1,
  },
  draftPill: {
    backgroundColor: "#ecfdf3",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b7ebcd",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  draftPillText: {
    color: GREEN,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
  },
  listingAddress: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 3,
  },
  listingFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: LINE,
  },
  listingPrice: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG },
  deleteBtn: {
    padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#fcd5d5",
    backgroundColor: "#fff5f5",
  },
});
