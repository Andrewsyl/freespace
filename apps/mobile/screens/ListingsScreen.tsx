import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  CreditCard,
  Home,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
} from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBlock, usePulse } from "../components/ui";
import {
  createHostPayoutLink,
  deleteListing,
  getHostEarningsSummary,
  getHostPayoutStatus,
  listHostListings,
  setListingPaused,
  type HostPayoutStatus,
} from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { BanknoteSvg } from "../components/BanknoteSvg";
import type { ListingSummary, RootStackParamList } from "../types";
import { useGlobalLoading } from "../components/GlobalLoading";
import { formatListingPriceLine } from "../utils/pricing";
import {
  clearHostListingDraft,
  loadHostListingDraft,
  type SavedHostListingDraft,
} from "./listingFlow/draftStorage";

type Props = NativeStackScreenProps<RootStackParamList, "Listings">;

const GREEN  = "#0fa968";
const FG     = "#111827";
const MUTED  = "#465050";
const SUBTLE = "#6B7575";
const BG     = "#F8FAFC";
const CARD   = "#ffffff";
const LINE   = "#DDE5EC";

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
  const [togglingId, setTogglingId] = useState<string | null>(null);
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
  const draftAddress =
    savedDraft?.draft.location.address?.trim() || "Finish setting up your location";

  const payoutStatusMessage = (() => {
    if (!payoutStatus) return null;
    if (payoutStatus.payoutsEnabled) return "Transfers arrive automatically";
    if (payoutIsMock) return "Connect Stripe to receive payouts";
    if (payoutStatus.requirementsDue.length > 0) return "Stripe needs a few more details";
    if (payoutStatus.detailsSubmitted) return "Stripe is reviewing your account";
    if (payoutStatus.accountId) return "Finish payout setup to receive earnings";
    return "Connect Stripe to receive payouts";
  })();

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
      } else {
        Alert.alert(
          "Payout setup unavailable",
          "We couldn't open the payout onboarding link right now. Please try again."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup");
    } finally {
      setPayoutBusy(false);
    }
  }, [payoutStatus?.accountId, token]);

  const handleDelete = useCallback(
    (listingId: string) => {
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
    },
    [token]
  );

  const handleTogglePause = useCallback(
    async (listing: ListingSummary) => {
      if (!token) return;
      const nowPaused = listing.is_active !== false;
      setTogglingId(listing.id);
      try {
        await setListingPaused({ token, listingId: listing.id, paused: nowPaused });
        setListings((prev) =>
          prev.map((l) => (l.id === listing.id ? { ...l, is_active: !nowPaused } : l))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update listing");
      } finally {
        setTogglingId(null);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { void loadListings(); }, [loadListings]));

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Tabs", { screen: "Search" });
  };

  const hasListings = listings.length > 0 || savedDraft;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <ArrowLeft size={22} color={FG} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>Manage spaces</Text>
          {listings.length > 0 ? (
            <Text style={styles.navSub}>{listings.length} listing{listings.length !== 1 ? "s" : ""}</Text>
          ) : null}
        </View>
        <Pressable style={styles.addBtn} onPress={() => navigation.navigate("CreateListingFlow")}>
          <Plus size={15} color="#ffffff" strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!user ? (
          /* ── Not signed in ────────────────────────────────────── */
          <View style={styles.gatedWrap}>
            <View style={styles.gatedCard}>
              <View style={styles.gatedIconWrap}>
                <Home size={26} color={GREEN} strokeWidth={2} />
              </View>
              <Text style={styles.gatedTitle}>Sign in to host</Text>
              <Text style={styles.gatedBody}>
                Manage your spaces, availability, and payouts from one place.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Welcome")}>
                <Text style={styles.primaryBtnText}>Sign in</Text>
              </Pressable>
              <View style={styles.gatedHintRow}>
                <ShieldCheck size={13} color={SUBTLE} strokeWidth={2} />
                <Text style={styles.gatedHintText}>
                  Your host dashboard and earnings stay linked to your account.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* ── Earnings hero card ─────────────────────────────── */}
            {earnings ? (
              <View style={styles.cardWrap}>
                <View style={styles.earningsCard}>
                  <View style={styles.earningsTop}>
                    <View style={styles.earningsIconWrap}>
                      <TrendingUp size={15} color={GREEN} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.earningsLabel}>Net payout</Text>
                  </View>
                  <Text style={styles.earningsHero}>{fmt(earnings.netCents)}</Text>
                  <View style={styles.earningsDivider} />
                  <View style={styles.earningsStats}>
                    <View style={styles.earningsStat}>
                      <Text style={styles.earningsStatLabel}>Total earned</Text>
                      <Text style={styles.earningsStatValue}>{fmt(earnings.totalCents)}</Text>
                    </View>
                    <View style={styles.earningsStatSep} />
                    <View style={styles.earningsStat}>
                      <Text style={styles.earningsStatLabel}>
                        Platform fee ({platformFeePercent}%)
                      </Text>
                      <Text style={styles.earningsStatValue}>{fmt(earnings.feeCents)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Payout strip ───────────────────────────────────── */}
            {payoutStatus ? (
              <View style={styles.cardWrap}>
                <Pressable
                  style={styles.payoutStrip}
                  onPress={!payoutStatus.payoutsEnabled && !payoutIsMock ? handlePayoutSetup : undefined}
                  disabled={payoutBusy}
                >
                  <View style={[
                    styles.payoutIconWrap,
                    payoutStatus.payoutsEnabled ? styles.payoutIconActive : styles.payoutIconPending,
                  ]}>
                    <CreditCard
                      size={15}
                      color={payoutStatus.payoutsEnabled ? GREEN : "#92400e"}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View style={styles.payoutText}>
                    <Text style={styles.payoutTitle}>Payouts</Text>
                    <Text style={styles.payoutBody} numberOfLines={1}>
                      {payoutStatusMessage}
                    </Text>
                  </View>
                  {payoutStatus.payoutsEnabled ? (
                    <View style={styles.activePill}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  ) : payoutIsMock ? (
                    <View style={styles.mockPill}>
                      <Text style={styles.mockPillText}>Test</Text>
                    </View>
                  ) : (
                    <ChevronRight size={16} color={SUBTLE} />
                  )}
                </Pressable>
                {payoutStatus.requirementsDue.length > 0 ? (
                  <View style={styles.requirementsRow}>
                    <AlertCircle size={12} color="#92400e" />
                    <Text style={styles.requirementsText}>
                      Missing: {payoutStatus.requirementsDue.slice(0, 3).join(", ")}
                      {payoutStatus.requirementsDue.length > 3 ? "…" : ""}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── Listings ───────────────────────────────────────── */}
            <View style={styles.listingSection}>
              <Text style={styles.sectionHeader}>Your spaces</Text>

              {loading && !hasListings ? (
                <View style={styles.skeletonList}>
                  {[0, 1].map((i) => (
                    <View key={i} style={styles.skeletonCard}>
                      <SkeletonBlock width="100%" height={148} borderRadius={0} pulse={skeletonPulse} />
                      <View style={styles.skeletonBody}>
                        <SkeletonBlock width="70%" height={16} pulse={skeletonPulse} />
                        <SkeletonBlock width="50%" height={12} pulse={skeletonPulse} style={{ marginTop: 8 }} />
                        <View style={styles.skeletonFooter}>
                          <SkeletonBlock width={80} height={14} pulse={skeletonPulse} />
                          <SkeletonBlock width={60} height={28} borderRadius={8} pulse={skeletonPulse} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : !hasListings ? (
                /* ── Empty state ──────────────────────────────── */
                <View style={styles.emptyCard}>
                  <BanknoteSvg width={180} height={180} />
                  <Text style={styles.emptyTitle}>No listings yet</Text>
                  <Text style={styles.emptyBody}>
                    Create a listing to start earning from your parking space.
                  </Text>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => navigation.navigate("CreateListingFlow")}
                  >
                    <Text style={styles.primaryBtnText}>List a space</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.listingGrid}>
                  {/* Draft card */}
                  {savedDraft ? (
                    <Pressable
                      style={({ pressed }) => [styles.listingCard, pressed && { opacity: 0.93 }]}
                      onPress={() => navigation.navigate("CreateListingFlow")}
                    >
                      <View style={[styles.listingImageWrap, styles.draftImageWrap]}>
                        <Ionicons name="create-outline" size={22} color={SUBTLE} />
                        <Text style={styles.draftLabel}>Draft</Text>
                      </View>
                      <View style={styles.draftBadge}>
                        <Text style={styles.draftBadgeText}>Saved draft</Text>
                      </View>
                      <View style={styles.listingBody}>
                        <Text style={styles.listingTitle} numberOfLines={1}>{draftTitle}</Text>
                        <Text style={styles.listingAddress} numberOfLines={1}>{draftAddress}</Text>
                        <View style={styles.listingFooter}>
                          <Text style={styles.continueText}>Continue setup →</Text>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={async () => {
                              await clearHostListingDraft();
                              setSavedDraft(null);
                            }}
                          >
                            <Trash2 size={13} color="#b42318" />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ) : null}

                  {/* Live listings */}
                  {listings.map((listing) => {
                    const isActive = listing.is_active !== false;
                    const isToggling = togglingId === listing.id;
                    return (
                      <Pressable
                        key={listing.id}
                        style={({ pressed }) => [styles.listingCard, pressed && { opacity: 0.93 }]}
                        onPress={() =>
                          navigation.navigate("CreateListingFlow", { listingId: listing.id })
                        }
                      >
                        {/* Image */}
                        <View style={styles.listingImageWrap}>
                          {listing.image_urls?.[0] ? (
                            <Image
                              source={{ uri: listing.image_urls[0] }}
                              style={styles.listingImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.imagePlaceholder}>
                              <Ionicons name="car-outline" size={28} color="#b0bac4" />
                            </View>
                          )}
                          {/* Status badge */}
                          <View style={[
                            styles.statusBadge,
                            isActive ? styles.statusBadgeActive : styles.statusBadgePaused,
                          ]}>
                            <View style={[
                              styles.statusDot,
                              isActive ? styles.statusDotActive : styles.statusDotPaused,
                            ]} />
                            <Text style={[
                              styles.statusBadgeText,
                              isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextPaused,
                            ]}>
                              {isActive ? "Active" : "Paused"}
                            </Text>
                          </View>
                        </View>

                        {/* Body */}
                        <View style={styles.listingBody}>
                          <View style={styles.listingTitleRow}>
                            <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                            <View style={styles.editChip}>
                              <Pencil size={10} color={GREEN} />
                              <Text style={styles.editChipText}>Edit</Text>
                            </View>
                          </View>
                          <Text style={styles.listingAddress} numberOfLines={1}>{listing.address}</Text>
                          <View style={styles.listingFooter}>
                            <Text style={styles.listingPrice}>{formatListingPriceLine(listing)}</Text>
                            <View style={styles.cardActions}>
                              {/* Pause / Resume toggle */}
                              <Pressable
                                style={[
                                  styles.pauseBtn,
                                  isActive ? styles.pauseBtnActive : styles.pauseBtnResume,
                                ]}
                                onPress={() => handleTogglePause(listing)}
                                disabled={isToggling}
                              >
                                {isToggling ? (
                                  <ActivityIndicator size={11} color={isActive ? SUBTLE : GREEN} />
                                ) : (
                                  <Text style={[
                                    styles.pauseBtnText,
                                    isActive ? styles.pauseBtnTextActive : styles.pauseBtnTextResume,
                                  ]}>
                                    {isActive ? "Pause" : "Resume"}
                                  </Text>
                                )}
                              </Pressable>
                              {/* Delete */}
                              <Pressable
                                style={styles.deleteBtn}
                                onPress={() => handleDelete(listing.id)}
                                disabled={deletingId === listing.id}
                              >
                                {deletingId === listing.id ? (
                                  <ActivityIndicator size={12} color="#b42318" />
                                ) : (
                                  <Trash2 size={13} color="#b42318" />
                                )}
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Add another space */}
                  <Pressable
                    style={styles.addAnotherBtn}
                    onPress={() => navigation.navigate("CreateListingFlow")}
                  >
                    <Plus size={16} color={GREEN} strokeWidth={2.2} />
                    <Text style={styles.addAnotherText}>Add another space</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Nav bar ──────────────────────────────────────────────────
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BG,
    gap: 10,
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 2 },
  navCenter: { flex: 1 },
  navTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  navSub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
    marginTop: 1,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { paddingTop: 8 },

  // ── Card wrap ────────────────────────────────────────────────
  cardWrap: { paddingHorizontal: 16, marginBottom: 12 },

  // ── Earnings card ────────────────────────────────────────────
  earningsCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    padding: 20,
    ...SHADOW,
  },
  earningsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  earningsIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  earningsLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: MUTED,
    letterSpacing: -0.1,
  },
  earningsHero: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 38,
    color: FG,
    letterSpacing: -1.5,
    lineHeight: 44,
    marginBottom: 16,
  },
  earningsDivider: {
    height: 1,
    backgroundColor: LINE,
    marginBottom: 14,
  },
  earningsStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  earningsStat: { flex: 1 },
  earningsStatSep: { width: 1, height: 28, backgroundColor: LINE, marginHorizontal: 16 },
  earningsStatLabel: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11,
    color: SUBTLE,
    marginBottom: 3,
  },
  earningsStatValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: FG,
    letterSpacing: -0.3,
  },

  // ── Payout strip ─────────────────────────────────────────────
  payoutStrip: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...SHADOW,
  },
  payoutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutIconActive: { backgroundColor: "#EDF7F2" },
  payoutIconPending: { backgroundColor: "#FEF3C7" },
  payoutText: { flex: 1 },
  payoutTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
  },
  payoutBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
    marginTop: 2,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EDF7F2",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  activePillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: GREEN,
  },
  mockPill: {
    backgroundColor: "#f3f4f6",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mockPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: SUBTLE,
  },
  requirementsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  requirementsText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#92400e",
    flex: 1,
  },

  // ── Listings section ─────────────────────────────────────────
  listingSection: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    letterSpacing: -0.5,
    marginBottom: 14,
  },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonList: { gap: 14 },
  skeletonCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    overflow: "hidden",
    ...SHADOW,
  },
  skeletonBody: { padding: 16, gap: 0 },
  skeletonFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },

  // ── Empty state ──────────────────────────────────────────────
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    padding: 28,
    alignItems: "center",
    ...SHADOW,
  },
  emptyImage: {
    width: 180,
    height: 180,
    marginBottom: 4,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 4,
  },

  // ── Gated (not signed in) ────────────────────────────────────
  gatedWrap: { paddingHorizontal: 16, paddingTop: 8 },
  gatedCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    padding: 28,
    alignItems: "center",
    ...SHADOW,
  },
  gatedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  gatedTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    color: FG,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  gatedBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 4,
  },
  gatedHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  gatedHintText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
    lineHeight: 17,
    flex: 1,
  },

  // ── Primary button ───────────────────────────────────────────
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    marginTop: 18,
    width: "100%",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },

  // ── Listing grid & cards ─────────────────────────────────────
  listingGrid: { gap: 14 },
  listingCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    overflow: "hidden",
    ...SHADOW,
  },
  listingImageWrap: {
    width: "100%",
    height: 160,
    backgroundColor: "#edf1f4",
    position: "relative",
  },
  listingImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Status badge (on image)
  statusBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeActive: { backgroundColor: "rgba(255,255,255,0.92)" },
  statusBadgePaused: { backgroundColor: "rgba(255,255,255,0.92)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: GREEN },
  statusDotPaused: { backgroundColor: "#94a3b8" },
  statusBadgeText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
  },
  statusBadgeTextActive: { color: FG },
  statusBadgeTextPaused: { color: SUBTLE },

  // Draft card
  draftImageWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
  },
  draftLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: SUBTLE,
  },
  draftBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#ecfdf3",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 2,
  },
  draftBadgeText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: GREEN,
  },

  // Card body
  listingBody: { padding: 14 },
  listingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  listingTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: FG,
    letterSpacing: -0.3,
    flex: 1,
    lineHeight: 21,
  },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EDF7F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  editChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: GREEN,
  },
  listingAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: SUBTLE,
    lineHeight: 18,
  },
  listingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  listingPrice: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
  },
  continueText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: GREEN,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pauseBtn: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minWidth: 68,
  },
  pauseBtnActive: {
    backgroundColor: "#f8fafc",
    borderColor: "#d1d5db",
  },
  pauseBtnResume: {
    backgroundColor: "#EDF7F2",
    borderColor: "#a7f3d0",
  },
  pauseBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: -0.1,
  },
  pauseBtnTextActive: { color: MUTED },
  pauseBtnTextResume: { color: GREEN },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fcd5d5",
    alignItems: "center",
    justifyContent: "center",
  },

  // Add another
  addAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 14,
    height: 50,
    borderWidth: 1.5,
    borderColor: "#d1fae5",
    borderStyle: "dashed",
  },
  addAnotherText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: GREEN,
    letterSpacing: -0.2,
  },
});
