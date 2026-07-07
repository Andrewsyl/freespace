import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
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
  Clock,
} from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBlock, usePulse } from "../components/ui";
import { colors, cardShadow, radius } from "../styles/theme";
import { SquircleBtn } from "../components/SquircleBtn";
import {
  createHostPayoutLink,
  deleteListing,
  getHostEarningsSummary,
  getHostPayoutStatus,
  listMyBookings,
  listHostListings,
  setListingPaused,
  type BookingSummary,
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

// Sourced from styles/theme.ts (see docs/PARKING_DESIGN_BIBLE.md §0) — kept as
// local aliases so the styles below don't need touching one by one.
const GREEN  = colors.primary;
const FG     = colors.text;
const MUTED  = colors.textMuted;
const SUBTLE = colors.textSoft;
const BG     = colors.pageBg;
const CARD   = colors.cardBg;
const LINE   = colors.divider;

const dublinDay = (d: Date) => d.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" });

function formatDublinDayTime(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  if (dublinDay(date) === dublinDay(now)) return time;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dublinDay(date) === dublinDay(tomorrow)) return `tomorrow ${time}`;
  const day = date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Dublin",
  });
  return `${day} ${time}`;
}

function formatDublinRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const endTime = end.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  return dublinDay(start) === dublinDay(end)
    ? `${formatDublinDayTime(start)} – ${endTime}`
    : `${formatDublinDayTime(start)} – ${formatDublinDayTime(end)}`;
}

function driverShortName(booking: BookingSummary): string | null {
  const name = booking.driverName?.trim();
  if (!name) return null;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function ListingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const platformFeePercent = 0;
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [savedDraft, setSavedDraft] = useState<SavedHostListingDraft | null>(null);
  const [hostBookings, setHostBookings] = useState<BookingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookings" | "spaces">("bookings");
  const [showPast, setShowPast] = useState(false);
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
      const [dataResult, summaryResult, payoutResult, bookingsResult] = await Promise.allSettled([
        listHostListings(token),
        getHostEarningsSummary(token),
        getHostPayoutStatus(token),
        listMyBookings(token),
      ]);
      if (dataResult.status === "rejected") throw dataResult.reason;
      const localDraft = await loadHostListingDraft();
      setListings(dataResult.value);
      setSavedDraft(localDraft);
      if (summaryResult.status === "fulfilled") setEarnings(summaryResult.value);
      if (payoutResult.status === "fulfilled") setPayoutStatus(payoutResult.value);
      if (bookingsResult.status === "fulfilled") setHostBookings(bookingsResult.value.hostBookings ?? []);
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

  const payoutStatusMessage = (() => {
    if (!payoutStatus) return null;
    if (payoutStatus.payoutsEnabled) return "Transfers arrive automatically";
    if (payoutIsMock) return "Connect Stripe to receive payouts";
    if (payoutStatus.requirementsDue.length > 0) return "Stripe needs a few more details";
    if (payoutStatus.detailsSubmitted) return "Stripe is reviewing your account";
    if (payoutStatus.accountId) return "Finish payout setup to receive earnings";
    return "Connect Stripe to receive payouts";
  })();

  const formatVehicleSummary = useCallback((booking: BookingSummary) => {
    const summary = [
      booking.driverVehicleColor?.trim(),
      booking.driverVehicleMake?.trim(),
      booking.driverVehicleType?.trim(),
    ]
      .filter(Boolean)
      .join(" ");
    if (summary && booking.vehiclePlate?.trim()) return `${summary} · ${booking.vehiclePlate.trim()}`;
    return summary || booking.vehiclePlate?.trim() || "Vehicle details unavailable";
  }, []);

  const spaceActivity = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, { current: BookingSummary | null; next: BookingSummary | null }>();
    for (const booking of hostBookings) {
      if (!booking.listingId || booking.status !== "confirmed" || booking.refundStatus === "refunded") continue;
      const start = new Date(booking.startTime).getTime();
      const end = new Date(booking.endTime).getTime();
      const entry = map.get(booking.listingId) ?? { current: null, next: null };
      if (start <= now && now < end) {
        if (!entry.current || end > new Date(entry.current.endTime).getTime()) entry.current = booking;
      } else if (start > now) {
        if (!entry.next || start < new Date(entry.next.startTime).getTime()) entry.next = booking;
      }
      map.set(booking.listingId, entry);
    }
    return map;
  }, [hostBookings]);

  const { liveToday, arrivingToday, upcomingBookings, nextFutureBooking } = useMemo(() => {
    const now = new Date();
    const todayKey = dublinDay(now);
    const live: BookingSummary[] = [];
    const arriving: BookingSummary[] = [];
    const upcoming: BookingSummary[] = [];
    let nextFuture: BookingSummary | null = null;
    for (const booking of hostBookings) {
      if (booking.status !== "confirmed" || booking.refundStatus === "refunded") continue;
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      if (start <= now && now < end) {
        live.push(booking);
      } else if (start > now) {
        if (dublinDay(start) === todayKey) arriving.push(booking);
        else upcoming.push(booking);
        if (!nextFuture || start < new Date(nextFuture.startTime)) nextFuture = booking;
      }
    }
    live.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
    arriving.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return {
      liveToday: live,
      arrivingToday: arriving,
      upcomingBookings: upcoming.slice(0, 10),
      nextFutureBooking: nextFuture,
    };
  }, [hostBookings]);

  const pastBookings = useMemo(() => {
    const now = Date.now();
    return hostBookings
      .filter(
        (booking) =>
          booking.status === "canceled" ||
          booking.refundStatus === "refunded" ||
          new Date(booking.endTime).getTime() <= now
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10);
  }, [hostBookings]);

  const potentialMonthlyEuros = useMemo(() => {
    let best = 0;
    for (const listing of listings) {
      const monthly = listing.price_per_month
        ? listing.price_per_month
        : listing.rate_type === "hourly" && listing.price_per_hour
          ? listing.price_per_hour * 8 * 26
          : listing.price_per_day * 26;
      if (monthly > best) best = monthly;
    }
    return best > 0 ? Math.round(best) : null;
  }, [listings]);

  const occupiedCount = useMemo(
    () => listings.filter((listing) => spaceActivity.get(listing.id)?.current).length,
    [listings, spaceActivity]
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

  const hasListings = listings.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={goBack} accessibilityLabel="Go back">
          <ArrowLeft size={22} color={FG} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>Manage spaces</Text>
          {listings.length > 0 ? (
            <Text style={styles.navSub}>{listings.length} listing{listings.length !== 1 ? "s" : ""}</Text>
          ) : null}
        </View>
        <Pressable style={styles.addBtn} onPress={() => navigation.navigate("CreateListingFlow")}>
          <Plus size={15} color={colors.textInverse} strokeWidth={2.5} />
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
              <SquircleBtn
                label="Sign in"
                onPress={() => navigation.navigate("Welcome")}
                fullWidth
                style={{ marginTop: 18 }}
              />
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
            {/* ── Alerts (only when action needed) ───────────────── */}
            {payoutStatus && !payoutStatus.payoutsEnabled ? (
              <View style={styles.cardWrap}>
                <Pressable
                  style={styles.alertRow}
                  onPress={handlePayoutSetup}
                  disabled={payoutBusy}
                >
                  <AlertCircle size={15} color={colors.status.pending.text} strokeWidth={2.2} />
                  <Text style={styles.alertText} numberOfLines={1}>
                    {payoutBusy ? "Opening payout setup…" : payoutStatusMessage}
                  </Text>
                  <ChevronRight size={15} color={colors.status.pending.text} />
                </Pressable>
              </View>
            ) : null}
            {savedDraft ? (
              <View style={styles.cardWrap}>
                <Pressable
                  style={[styles.alertRow, styles.alertRowNeutral]}
                  onPress={() => navigation.navigate("CreateListingFlow")}
                >
                  <Pencil size={14} color={GREEN} strokeWidth={2.2} />
                  <Text style={[styles.alertText, styles.alertTextNeutral]} numberOfLines={1}>
                    Finish your draft — {draftTitle}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={async () => {
                      await clearHostListingDraft();
                      setSavedDraft(null);
                    }}
                  >
                    <Trash2 size={14} color={SUBTLE} />
                  </Pressable>
                </Pressable>
              </View>
            ) : null}

            {/* ── Earnings hero ───────────────────────────────────── */}
            {earnings ? (
              <View style={styles.cardWrap}>
                <View style={styles.earningsCard}>
                  {earnings.totalCents === 0 && potentialMonthlyEuros ? (
                    <>
                      <View style={styles.earningsTop}>
                        <View style={styles.earningsIconWrap}>
                          <TrendingUp size={15} color={GREEN} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.earningsLabel}>Earning potential</Text>
                      </View>
                      <Text style={[styles.earningsHero, styles.earningsHeroPotential]}>
                        ~€{potentialMonthlyEuros}
                        <Text style={styles.earningsHeroUnit}>/month</Text>
                      </Text>
                      <Text style={styles.earningsPotentialBody}>
                        What your space could earn. 0% host fee — every cent is yours.
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.earningsTop}>
                        <View style={styles.earningsIconWrap}>
                          <TrendingUp size={15} color={GREEN} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.earningsLabel}>Your earnings</Text>
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
                          <Text style={styles.earningsStatLabel}>Host fee</Text>
                          <Text style={styles.earningsStatValueGreen}>
                            {platformFeePercent}% — keep it all
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ) : null}

            {/* ── Payouts (compact) ───────────────────────────────── */}
            <View style={styles.infoRowsWrap}>
              {payoutStatus ? (
                <View>
                  <Pressable
                    style={styles.infoRow}
                    onPress={!payoutStatus.payoutsEnabled ? handlePayoutSetup : undefined}
                    disabled={payoutBusy}
                  >
                    <View style={[
                      styles.infoIconWrap,
                      payoutStatus.payoutsEnabled ? styles.infoIconGreen : styles.infoIconAmber,
                    ]}>
                      <CreditCard
                        size={15}
                        color={payoutStatus.payoutsEnabled ? GREEN : colors.status.pending.text}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.infoRowText}>
                      <Text style={styles.infoRowTitle}>Payouts</Text>
                      <Text style={styles.infoRowBody} numberOfLines={1}>
                        {payoutStatusMessage}
                      </Text>
                    </View>
                    {payoutStatus.payoutsEnabled ? (
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    ) : (
                      <ChevronRight size={16} color={SUBTLE} />
                    )}
                  </Pressable>
                  {payoutStatus.requirementsDue.length > 0 ? (
                    <View style={styles.requirementsRow}>
                      <AlertCircle size={12} color={colors.status.pending.text} />
                      <Text style={styles.requirementsText}>
                        Missing: {payoutStatus.requirementsDue.slice(0, 3).join(", ")}
                        {payoutStatus.requirementsDue.length > 3 ? "…" : ""}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* ── Tabs ────────────────────────────────────────────── */}
            <View style={styles.segmentWrap}>
              <View style={styles.segment}>
                <Pressable
                  style={[styles.segmentBtn, activeTab === "bookings" && styles.segmentBtnActive]}
                  onPress={() => setActiveTab("bookings")}
                >
                  {liveToday.length > 0 ? <View style={styles.segmentLiveDot} /> : null}
                  <Text style={[styles.segmentText, activeTab === "bookings" && styles.segmentTextActive]}>
                    Bookings
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentBtn, activeTab === "spaces" && styles.segmentBtnActive]}
                  onPress={() => setActiveTab("spaces")}
                >
                  <Text style={[styles.segmentText, activeTab === "spaces" && styles.segmentTextActive]}>
                    Spaces{listings.length > 0 ? ` (${listings.length})` : ""}
                  </Text>
                </Pressable>
              </View>
            </View>

            {activeTab === "bookings" ? (
            <>
            {/* ── Today ───────────────────────────────────────────── */}
            <View style={styles.listingSection}>
              <Text style={[styles.sectionHeader, styles.sectionHeaderStandalone]}>Today</Text>

              {loading && hostBookings.length === 0 ? (
                <View style={styles.todayList}>
                  <View style={styles.todayCard}>
                    <SkeletonBlock width="55%" height={14} pulse={skeletonPulse} />
                    <SkeletonBlock width="72%" height={12} pulse={skeletonPulse} style={{ marginTop: 10 }} />
                  </View>
                </View>
              ) : liveToday.length === 0 && arrivingToday.length === 0 ? (
                <View style={styles.todayEmpty}>
                  <Text style={styles.todayEmptyText}>
                    {nextFutureBooking
                      ? `Nothing today — next booking ${formatDublinDayTime(new Date(nextFutureBooking.startTime))}`
                      : "Nothing today. When someone books your space, it shows up here."}
                  </Text>
                </View>
              ) : (
                <View style={styles.todayList}>
                  {[
                    ...liveToday.map((booking) => ({ booking, kind: "now" as const })),
                    ...arrivingToday.map((booking) => ({ booking, kind: "arriving" as const })),
                  ].map(({ booking, kind }) => (
                    <Pressable
                      key={booking.id}
                      style={({ pressed }) => [styles.todayCard, pressed && { opacity: 0.93 }]}
                      onPress={() => navigation.navigate("HostBookingDetail", { booking })}
                    >
                      <View style={styles.todayTopRow}>
                        {kind === "now" ? (
                          <View style={styles.todayNowDot} />
                        ) : (
                          <Clock size={13} color={SUBTLE} strokeWidth={2.4} />
                        )}
                        <Text style={kind === "now" ? styles.todayNowLabel : styles.todayArrivingLabel}>
                          {kind === "now"
                            ? `Now · until ${formatDublinDayTime(new Date(booking.endTime))}`
                            : `Arriving ${formatDublinDayTime(new Date(booking.startTime))}`}
                        </Text>
                        <Text style={styles.todayAmount}>{fmt(booking.amountCents)}</Text>
                      </View>
                      <Text style={styles.todayTitle} numberOfLines={1}>
                        {booking.title || booking.address}
                      </Text>
                      <Text style={styles.todaySub} numberOfLines={1}>
                        {[formatVehicleSummary(booking), booking.driverName?.trim() || null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                      {booking.driverPhone?.trim() ? (
                        <View style={styles.todayContactRow}>
                          <Pressable
                            style={styles.todayContactBtn}
                            onPress={() => Linking.openURL(`tel:${booking.driverPhone!.trim()}`)}
                            hitSlop={6}
                          >
                            <Text style={styles.todayContactBtnText}>Call driver</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.todayContactBtn, styles.todayContactBtnSecondary]}
                            onPress={() => Linking.openURL(`sms:${booking.driverPhone!.trim()}`)}
                            hitSlop={6}
                          >
                            <Text style={[styles.todayContactBtnText, styles.todayContactBtnTextSecondary]}>Text</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* ── Upcoming ────────────────────────────────────────── */}
            {upcomingBookings.length > 0 ? (
              <View style={styles.listingSection}>
                <Text style={[styles.sectionHeader, styles.sectionHeaderStandalone]}>Upcoming</Text>
                <View style={styles.todayList}>
                  {upcomingBookings.map((booking) => (
                    <Pressable
                      key={booking.id}
                      style={({ pressed }) => [styles.todayCard, pressed && { opacity: 0.93 }]}
                      onPress={() => navigation.navigate("HostBookingDetail", { booking })}
                    >
                      <View style={styles.todayTopRow}>
                        <Clock size={13} color={SUBTLE} strokeWidth={2.4} />
                        <Text style={styles.todayArrivingLabel} numberOfLines={1}>
                          {formatDublinRange(booking.startTime, booking.endTime)}
                        </Text>
                        <Text style={styles.todayAmount}>{fmt(booking.amountCents)}</Text>
                      </View>
                      <Text style={styles.todayTitle} numberOfLines={1}>
                        {booking.title || booking.address}
                      </Text>
                      <Text style={styles.todaySub} numberOfLines={1}>
                        {[formatVehicleSummary(booking), booking.driverName?.trim() || null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ── Past bookings ───────────────────────────────────── */}
            {pastBookings.length > 0 ? (
              <View style={styles.listingSection}>
                {showPast ? (
                  <>
                    <Text style={[styles.sectionHeader, styles.sectionHeaderStandalone]}>Past</Text>
                    <View style={styles.todayList}>
                      {pastBookings.map((booking) => {
                        const canceled =
                          booking.status === "canceled" || booking.refundStatus === "refunded";
                        return (
                          <Pressable
                            key={booking.id}
                            style={({ pressed }) => [
                              styles.todayCard,
                              styles.pastCard,
                              pressed && { opacity: 0.93 },
                            ]}
                            onPress={() => navigation.navigate("HostBookingDetail", { booking })}
                          >
                            <View style={styles.todayTopRow}>
                              <Text style={styles.todayArrivingLabel} numberOfLines={1}>
                                {formatDublinRange(booking.startTime, booking.endTime)}
                              </Text>
                              <Text style={canceled ? styles.pastCanceled : styles.todayAmount}>
                                {canceled ? "Canceled" : fmt(booking.amountCents)}
                              </Text>
                            </View>
                            <Text style={styles.todaySub} numberOfLines={1}>
                              {[booking.title || booking.address, booking.driverName?.trim() || null]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <Pressable style={styles.showPastBtn} onPress={() => setShowPast(true)}>
                    <Text style={styles.showPastText}>
                      Show past bookings ({pastBookings.length})
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            </>
            ) : (
            <>
            {/* ── Listings ───────────────────────────────────────── */}
            <View style={styles.listingSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Your spaces</Text>
                {listings.length > 0 ? (
                  <Text style={styles.sectionMeta}>
                    {occupiedCount} of {listings.length} occupied
                  </Text>
                ) : null}
              </View>

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
                  <SquircleBtn
                    label="List a space"
                    onPress={() => navigation.navigate("CreateListingFlow")}
                    fullWidth
                    style={{ marginTop: 18 }}
                  />
                </View>
              ) : (
                <View style={styles.listingGrid}>
                  {/* Live listings */}
                  {listings.map((listing) => {
                    const isActive = listing.is_active !== false;
                    const isToggling = togglingId === listing.id;
                    const activity = spaceActivity.get(listing.id);
                    const currentBooking = activity?.current ?? null;
                    const nextBooking = activity?.next ?? null;
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
                              <Ionicons name="car-outline" size={28} color={colors.textMuted} />
                            </View>
                          )}
                          {/* Status chip: Paused > Occupied > Free */}
                          <View style={[
                            styles.statusBadge,
                            isActive ? styles.statusBadgeActive : styles.statusBadgePaused,
                          ]}>
                            <View style={[
                              styles.statusDot,
                              !isActive
                                ? styles.statusDotPaused
                                : currentBooking
                                  ? styles.statusDotActive
                                  : styles.statusDotFree,
                            ]} />
                            <Text style={[
                              styles.statusBadgeText,
                              isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextPaused,
                            ]}>
                              {!isActive
                                ? "Paused"
                                : currentBooking
                                  ? `Occupied until ${formatDublinDayTime(new Date(currentBooking.endTime))}`
                                  : "Free"}
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

                          {nextBooking ? (
                            <Text style={styles.nextLine} numberOfLines={1}>
                              <Text style={styles.nextLineLabel}>Next: </Text>
                              {formatDublinDayTime(new Date(nextBooking.startTime))} – {formatDublinDayTime(new Date(nextBooking.endTime))}
                              {driverShortName(nextBooking) ? ` · ${driverShortName(nextBooking)}` : ""}
                            </Text>
                          ) : null}

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
                                  <ActivityIndicator size={12} color={colors.danger} />
                                ) : (
                                  <Trash2 size={13} color={colors.danger} />
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SHADOW = cardShadow;

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
    borderRadius: radius.pill,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { paddingTop: 8 },

  // ── Card wrap ────────────────────────────────────────────────
  cardWrap: { paddingHorizontal: 16, marginBottom: 12 },

  // ── Earnings hero ────────────────────────────────────────────
  earningsCard: {
    backgroundColor: CARD,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: radius.sm,
    backgroundColor: colors.tileBg,
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
  earningsStatValueGreen: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: GREEN,
    letterSpacing: -0.3,
  },
  earningsHeroPotential: {
    color: GREEN,
    marginBottom: 8,
  },
  earningsHeroUnit: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  earningsPotentialBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },

  // ── Alert rows ───────────────────────────────────────────────
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.status.pending.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.status.pending.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertRowNeutral: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  alertText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.status.pending.text,
    flex: 1,
    letterSpacing: -0.1,
  },
  alertTextNeutral: {
    color: colors.headerTint,
  },

  // ── Segmented tabs ───────────────────────────────────────────
  segmentWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.divider,
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: CARD,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13.5,
    color: SUBTLE,
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    color: FG,
  },
  segmentLiveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },

  // ── Compact info rows (earnings / payouts) ───────────────────
  infoRowsWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  infoRow: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIconGreen: { backgroundColor: colors.tileBg },
  infoIconAmber: { backgroundColor: colors.status.pending.background },
  infoRowText: { flex: 1 },
  infoRowTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
  },
  infoRowBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
    marginTop: 1,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.tileBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },
  activePillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: GREEN,
  },
  mockPill: {
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.pill,
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
    color: colors.status.pending.text,
    flex: 1,
  },

  // ── Listings section ─────────────────────────────────────────
  listingSection: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionHeader: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    letterSpacing: -0.5,
  },
  sectionHeaderStandalone: {
    marginBottom: 14,
  },
  sectionMeta: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: SUBTLE,
  },

  // ── Today feed ───────────────────────────────────────────────
  todayList: { gap: 12, marginBottom: 14 },
  todayCard: {
    backgroundColor: CARD,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    ...SHADOW,
  },
  todayTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  todayNowDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },
  todayNowLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: colors.headerTint,
    letterSpacing: -0.2,
    flex: 1,
  },
  todayArrivingLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: MUTED,
    letterSpacing: -0.2,
    flex: 1,
  },
  todayAmount: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: FG,
  },
  todayTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: FG,
    letterSpacing: -0.3,
  },
  todaySub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  todayContactRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  todayContactBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  todayContactBtnSecondary: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  todayContactBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.textInverse,
  },
  todayContactBtnTextSecondary: {
    color: GREEN,
  },
  todayEmpty: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  todayEmptyText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  pastCard: {
    shadowOpacity: 0.04,
    elevation: 1,
    opacity: 0.92,
  },
  pastCanceled: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: colors.danger,
  },
  showPastBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD,
  },
  showPastText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: MUTED,
  },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonList: { gap: 14 },
  skeletonCard: {
    backgroundColor: CARD,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.tileBg,
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
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: "center",
    ...SHADOW,
  },
  gatedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.tileBg,
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

  // ── Listing grid & cards ─────────────────────────────────────
  listingGrid: { gap: 14 },
  listingCard: {
    backgroundColor: CARD,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...SHADOW,
  },
  listingImageWrap: {
    width: "100%",
    height: 160,
    backgroundColor: colors.cardBgMuted,
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
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeActive: { backgroundColor: "rgba(255,255,255,0.92)" },
  statusBadgePaused: { backgroundColor: "rgba(255,255,255,0.92)" },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusDotActive: { backgroundColor: GREEN },
  statusDotPaused: { backgroundColor: colors.textDisabled },
  statusDotFree: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.textDisabled,
  },
  statusBadgeText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
  },
  statusBadgeTextActive: { color: FG },
  statusBadgeTextPaused: { color: SUBTLE },

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
    backgroundColor: colors.tileBg,
    borderRadius: radius.sm,
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
  nextLine: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12.5,
    color: MUTED,
    marginTop: 8,
  },
  nextLineLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: FG,
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
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
  },
  pauseBtnResume: {
    backgroundColor: colors.tileBg,
    borderColor: colors.accent,
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
    backgroundColor: colors.status.canceled.background,
    borderWidth: 1,
    borderColor: colors.status.canceled.border,
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
    borderColor: colors.accent,
    borderStyle: "dashed",
  },
  addAnotherText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: GREEN,
    letterSpacing: -0.2,
  },
});
