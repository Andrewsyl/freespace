import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, FlatList, InteractionManager, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { useGlobalLoading } from "../components/GlobalLoading";
import { colors, spacing } from "../styles/theme";
import { BookingCard } from "../components/BookingCard";
import { Spinner } from "../components/Spinner";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const { reset: resetGlobalLoading } = useGlobalLoading();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [tab, setTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [displayTab, setDisplayTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  const [tabSwitchingTo, setTabSwitchingTo] = useState<"upcoming" | "active" | "past">("upcoming");
  const [pastVisibleCount, setPastVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTab, setSuccessTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const pendingNewBookingId = useRef<string | null>(null);
  const [mapCtaVisible, setMapCtaVisible] = useState(false);
  const [ratingByBookingId, setRatingByBookingId] = useState<Record<string, number>>({});
  const tabAnim = useRef(new Animated.Value(1)).current;
  const segmentWidth = useRef(0);
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const newBookingSlideAnim = useRef(new Animated.Value(50)).current;
  const newBookingOpacityAnim = useRef(new Animated.Value(0)).current;
  const lastTabIndexRef = useRef(0);
  const skipNextFocusReload = useRef(false);
  const [revealBookings, setRevealBookings] = useState(true);
  const [bookingTransitioning, setBookingTransitioning] = useState(false);

  useToastOnMessage(error, { variant: "danger" });

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");
      StatusBar.setBackgroundColor("#FFFFFF");
      return () => {
        StatusBar.setBarStyle("dark-content");
        StatusBar.setBackgroundColor("#FFFFFF");
      };
    }, [])
  );

  const loadBookings = useCallback(async (options?: { silent?: boolean }): Promise<BookingSummary[]> => {
    if (!token || !user) {
      setBookings([]);
      setError(null);
      if (!options?.silent) {
        setLoading(false);
      }
      return [];
    }
    let active = true;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await listMyBookings(token);
      if (!active) return [];
      setBookings(data.driverBookings ?? []);
      return data.driverBookings ?? [];
    } catch (err) {
      if (!active) return [];
      setError(err instanceof Error ? err.message : "Could not load bookings");
      return [];
    } finally {
      if (active && !options?.silent) {
        setLoading(false);
      }
    }
  }, [token, user]);

  useEffect(() => {
    if (!bookings.length) {
      setRatingByBookingId({});
      return;
    }
    const keys = bookings.map((booking) => `bookingRating:${booking.id}`);
    void (async () => {
      try {
        const entries = await AsyncStorage.multiGet(keys);
        const nextRatings: Record<string, number> = {};
        entries.forEach(([key, value]) => {
          if (!value) return;
          try {
            const parsed = JSON.parse(value) as { rating?: number };
            if (typeof parsed.rating === "number") {
              const bookingId = key.replace("bookingRating:", "");
              nextRatings[bookingId] = parsed.rating;
            }
          } catch {
            // Ignore malformed ratings.
          }
        });
        setRatingByBookingId(nextRatings);
      } catch {
        setRatingByBookingId({});
      }
    })();
  }, [bookings]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (user) return;
    setBookings([]);
    setLoading(false);
    setError(null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusReload.current) {
        skipNextFocusReload.current = false;
        return;
      }
      void loadBookings();
    }, [loadBookings])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Tabs", params: { screen: "Search" } }],
          })
        );
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  useEffect(() => {
    if (!route.params?.showSuccess) return;
    resetGlobalLoading();
    let cancelled = false;
    const targetTab = (route.params?.initialTab ?? "upcoming") as
      | "upcoming"
      | "active"
      | "past";
    setSuccessTab(targetTab);
    setTab(targetTab);
    setDisplayTab(targetTab);
    setIsSwitchingTab(false);
    setTabSwitchingTo(targetTab);
    segmentAnim.setValue(targetTab === "upcoming" ? 0 : targetTab === "active" ? 1 : 2);
    lastTabIndexRef.current = targetTab === "upcoming" ? 0 : targetTab === "active" ? 1 : 2;
    setRevealBookings(false);
    setBookingTransitioning(true);
    setLoading(false);
    setError(null);

    newBookingSlideAnim.setValue(50);
    newBookingOpacityAnim.setValue(0);
    const previousBookingIds = new Set(bookings.map((b) => b.id));
    skipNextFocusReload.current = true;
    const startTime = Date.now();
    void loadBookings({ silent: true }).then((newBookings) => {
      if (cancelled) return;
      resetGlobalLoading();
      const list = newBookings ?? [];
      let nextBooking = list.find((b) => !previousBookingIds.has(b.id));
      if (!nextBooking && list.length > 0) {
        nextBooking = [...list].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
      }
      pendingNewBookingId.current = nextBooking?.id ?? null;

      const elapsed = Date.now() - startTime;
      const minOverlayMs = 400;
      const delay = Math.max(0, minOverlayMs - elapsed);

      setTimeout(() => {
        if (cancelled) return;
        setShowSuccess(true);
        setTimeout(() => {
          if (cancelled) return;
          setShowSuccess(false);
          setRevealBookings(true);
          setBookingTransitioning(false);
          const idToAnimate = pendingNewBookingId.current;
          if (idToAnimate) {
            setNewBookingId(idToAnimate);
            requestAnimationFrame(() => {
              Animated.parallel([
                Animated.spring(newBookingSlideAnim, {
                  toValue: 0,
                  useNativeDriver: true,
                  tension: 50,
                  friction: 8,
                }),
                Animated.timing(newBookingOpacityAnim, {
                  toValue: 1,
                  duration: 350,
                  useNativeDriver: true,
                }),
              ]).start(() => setNewBookingId(null));
            });
          }
        }, 500);
      }, delay);
    });

    navigation.setParams({ showSuccess: undefined, refreshToken: undefined, initialTab: undefined });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!route.params?.showMapCTA) return;
    setMapCtaVisible(true);
    navigation.setParams({ showMapCTA: undefined });
  }, [navigation, route.params?.showMapCTA]);

  useEffect(() => {
    if (!route.params?.initialTab) return;
    setTab(route.params.initialTab);
    navigation.setParams({ initialTab: undefined });
  }, [navigation, route.params?.initialTab]);

  useEffect(() => {
    const currentIndex = tab === "upcoming" ? 0 : tab === "active" ? 1 : 2;
    lastTabIndexRef.current = currentIndex;
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    const target = tab === "upcoming" ? 0 : tab === "active" ? 1 : 2;
    setIsSwitchingTab(true);
    setTabSwitchingTo(tab);
    Animated.timing(segmentAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Ease-in-out cubic
      useNativeDriver: true,
    }).start();

    // Defer heavy list update until after animation
    const handle = InteractionManager.runAfterInteractions(() => {
      setDisplayTab(tab);
      setIsSwitchingTab(false);
    });

    return () => handle.cancel();
  }, [segmentAnim, tab]);

  useEffect(() => {
    if (!route.params?.refreshToken) return;
    void loadBookings();
    navigation.setParams({ refreshToken: undefined });
  }, [loadBookings, navigation, route.params?.refreshToken]);

  const now = new Date();
  const upcoming = bookings.filter(
    (booking) => new Date(booking.startTime) > now && booking.status !== "canceled"
  );
  const active = bookings.filter(
    (booking) => new Date(booking.startTime) <= now && new Date(booking.endTime) >= now && booking.status !== "canceled"
  );
  const past = bookings.filter(
    (booking) => booking.status === "canceled" || new Date(booking.endTime) < now
  );
  const visiblePast = past.slice(0, pastVisibleCount);
  const hasMorePast = past.length > pastVisibleCount;

  useEffect(() => {
    if (displayTab !== "past") return;
    if (pastVisibleCount < 20) {
      setPastVisibleCount(20);
    }
  }, [displayTab, pastVisibleCount]);
  // items are built per-pane for the sliding layout

  const renderBookingCard = useCallback((
    { item: booking, paneTab }: { item: BookingSummary; paneTab: "upcoming" | "active" | "past" }
  ) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const isRefunded = booking.refundStatus === "succeeded";
    const isCompleted = paneTab === "past" && booking.status === "confirmed";
    const isActive = paneTab === "active" && booking.status === "confirmed";
    const statusLabel = isRefunded
      ? "Refunded"
      : isActive
      ? "In Progress"
      : isCompleted
      ? "Completed"
      : booking.status === "confirmed"
      ? "Confirmed"
      : booking.status === "pending"
      ? "Pending"
      : "Cancelled";
    const statusTone = isRefunded
      ? "refunded"
      : isActive
      ? "active"
      : isCompleted
      ? "completed"
      : booking.status === "confirmed"
      ? "confirmed"
      : booking.status === "pending"
      ? "pending"
      : "canceled";
    const dateLabel = formatDateLabel(start);
    const timeLabel = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;

    const isNewBooking = booking.id === newBookingId;

    const cardContent = (
      <BookingCard
        booking={booking}
        statusLabel={statusLabel}
        statusTone={statusTone}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        rating={ratingByBookingId[booking.id]}
        onPress={() => navigation.navigate("BookingDetail", { booking })}
      />
    );

    if (isNewBooking) {
      return (
        <Animated.View
          style={{
            opacity: newBookingOpacityAnim,
            transform: [{ translateX: newBookingSlideAnim }],
          }}
        >
          {cardContent}
        </Animated.View>
      );
    }

    return cardContent;
  }, [navigation, newBookingId, newBookingOpacityAnim, newBookingSlideAnim]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My bookings</Text>
      </View>
      {mapCtaVisible ? (
        <View style={styles.mapCtaBanner}>
          <View style={styles.mapCtaContent}>
            <Text style={styles.mapCtaTitle}>Booking canceled</Text>
            <Text style={styles.mapCtaBody}>Space is available again</Text>
          </View>
          <Pressable
            style={styles.mapCtaButton}
            onPress={() => {
              setMapCtaVisible(false);
              navigation.navigate("Tabs", { screen: "Search" });
            }}
          >
            <Text style={styles.mapCtaButtonText}>View on map</Text>
            <Ionicons name="map-outline" size={14} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}
      {/* Tab bar with underline indicator for active tab */}
      <View
        style={styles.tabBar}
        onLayout={(event) => {
          segmentWidth.current = event.nativeEvent.layout.width;
        }}
      >
        <Pressable
          style={styles.tab}
          onPress={() => setTab("upcoming")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "upcoming" && styles.tabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={styles.tab}
          onPress={() => setTab("active")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "active" && styles.tabTextActive,
            ]}
          >
            Active
          </Text>
        </Pressable>
        <Pressable
          style={styles.tab}
          onPress={() => setTab("past")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "past" && styles.tabTextActive,
            ]}
          >
            Past
          </Text>
        </Pressable>
        {/* Animated indicator that slides between tabs */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [
                {
                  translateX: segmentAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, segmentWidth.current / 3, (segmentWidth.current / 3) * 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <View style={styles.contentWrapper}>
        {loading ? (
          <View style={styles.inlineLoading}>
            <Spinner size="large" />
            <Text style={styles.inlineLoadingText}>Loading bookings…</Text>
          </View>
        ) : null}
        <Animated.View
          style={{
            flex: 1,
            flexDirection: "row",
            width: screenWidth * 3,
            transform: [
              {
                translateX: segmentAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, -screenWidth, -screenWidth * 2],
                }),
              },
            ],
          }}
        >
          {["upcoming", "active", "past"].map((pane) => {
          const paneTab = pane as "upcoming" | "active" | "past";
          const paneData =
            paneTab === "upcoming" ? upcoming : paneTab === "active" ? active : visiblePast;
          const paneItems = (() => {
            const result: Array<
              | { type: "header"; id: string; label: string }
              | { type: "booking"; id: string; booking: BookingSummary }
            > = [];
            let lastLabel = "";
            const formatMonth = (value: string) =>
              new Date(value).toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
            paneData.forEach((booking) => {
              const label = formatMonth(booking.startTime);
              if (label !== lastLabel) {
                result.push({ type: "header", id: `header-${label}`, label });
                lastLabel = label;
              }
              result.push({ type: "booking", id: booking.id, booking });
            });
            return result;
          })();
          const showPaneSkeleton =
            (loading || (isSwitchingTab && paneTab === tabSwitchingTo)) &&
            !bookingTransitioning;
          const showPaneEmpty =
            !loading && !isSwitchingTab && paneTab === displayTab && paneData.length === 0;

            return (
              <View key={pane} style={{ width: screenWidth }}>
                <FlatList
                data={!user || !revealBookings ? [] : paneItems}
                renderItem={({ item }) => {
                  if (item.type === "header") {
                    return <Text style={styles.monthLabel}>{item.label}</Text>;
                  }
                  return renderBookingCard({ item: item.booking, paneTab });
                }}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: Math.max(insets.bottom + 96, 120) },
                ]}
                ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                ListFooterComponent={
                  paneTab === "past" && hasMorePast ? (
                    <Pressable
                      style={styles.loadMoreButton}
                      onPress={() => setPastVisibleCount((prev) => prev + 20)}
                    >
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </Pressable>
                  ) : null
                }
                ListHeaderComponent={
                  <>
                    {!user ? (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>Sign in to view bookings</Text>
                        <Text style={styles.cardBody}>
                          Log in to see your upcoming reservations and past stays.
                        </Text>
                        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")}>
                          <Text style={styles.primaryButtonText}>Sign in</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        {showPaneSkeleton ? (
                          <View style={styles.skeletonList}>
                            {[0, 1, 2].map((item) => (
                              <View key={item} style={styles.skeletonCard}>
                                <View style={styles.skeletonRow}>
                                  <View style={styles.skeletonTitle} />
                                  <View style={styles.skeletonBadge} />
                                </View>
                                <View style={styles.skeletonLine} />
                                <View style={styles.skeletonMetaRow}>
                                  <View style={styles.skeletonMeta} />
                                  <View style={styles.skeletonMeta} />
                                </View>
                                <View style={styles.skeletonPrice} />
                              </View>
                            ))}
                          </View>
                        ) : showPaneEmpty ? (
                          <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>
                              {paneTab === "upcoming" ? "No upcoming bookings" : paneTab === "active" ? "No active bookings" : "No past bookings"}
                            </Text>
                            <Text style={styles.emptyBody}>
                              {paneTab === "upcoming"
                                ? "Find a parking space and your next trip will show up here."
                                : paneTab === "active"
                                ? "Bookings in progress will appear here."
                                : "Completed reservations will appear here after your stay."}
                            </Text>
                            {paneTab === "upcoming" ? (
                              <Pressable
                                style={styles.primaryButton}
                                onPress={() => navigation.navigate("Tabs", { screen: "Search" })}
                                android_ripple={null}
                              >
                                <Text style={styles.primaryButtonText}>Find parking</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </>
                    )}
                  </>
                }
                removeClippedSubviews={false}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={15}
                windowSize={10}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
      {showSuccess ? (
        <Pressable style={styles.successOverlay} onPress={() => setShowSuccess(false)}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>Booking confirmed!</Text>
            <Text style={styles.successBody}>
              Your reservation is saved in {successTab === "active" ? "Active" : successTab === "past" ? "Past" : "Upcoming"}
            </Text>
          </View>
        </Pressable>
      ) : null}
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
  gradientWrapper: {
    flex: 0,
  },
  header: {
    backgroundColor: colors.appBg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 24,
    lineHeight: 30,
    color: colors.accent,
    letterSpacing: -0.4,
  },
  mapCtaBanner: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
  },
  mapCtaContent: {
    flex: 1,
  },
  mapCtaTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.accent,
    marginBottom: 2,
  },
  mapCtaBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  mapCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  mapCtaButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },
  inlineLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  inlineLoadingText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textMuted,
    fontSize: 13,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.appBg,
    paddingHorizontal: 20,
    paddingTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    position: "relative",
  },
  tabText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "33.33%",
    height: 2,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabContent: {
    flexGrow: 1,
  },
  tabLoadingContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  monthLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textSoft,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 4,
  },
  skeletonList: {
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 8,
  },
  cardBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  loadMoreButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
  },
  loadMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.accent,
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonTitle: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 16,
    width: "55%",
  },
  skeletonBadge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    height: 20,
    width: 64,
  },
  skeletonLine: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 12,
    marginTop: 12,
    width: "70%",
  },
  skeletonMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  skeletonMeta: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 12,
    width: 90,
  },
  skeletonPrice: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 18,
    marginTop: 16,
    width: 80,
  },
  list: {
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 156,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIllustration: {
    width: "100%",
    height: "100%",
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.accent,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 32,
    paddingVertical: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: 268,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 18,
    lineHeight: 24,
    color: colors.accent,
    marginTop: 6,
    textAlign: "center",
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
});
