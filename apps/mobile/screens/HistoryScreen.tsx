import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, FlatList, Image, InteractionManager, PanResponder, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { useGlobalLoading } from "../components/GlobalLoading";
import { BookingCard } from "../components/BookingCard";
import { Spinner } from "../components/Spinner";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

const ACCENT  = "#0fa968";
const FG      = "#101414";
const MUTED   = "#465050";
const SUBTLE  = "#6B7575";
const LINE    = "#DDE5EC";
const BG      = "#F8FAFC";

const CARD_SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const { reset: resetGlobalLoading } = useGlobalLoading();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
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
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = (screenWidth - 40) / 3;
  const newBookingSlideAnim = useRef(new Animated.Value(50)).current;
  const newBookingOpacityAnim = useRef(new Animated.Value(0)).current;
  const lastTabIndexRef = useRef(0);
  const skipNextFocusReload = useRef(false);
  const hideSuccessCallback = useRef<(() => void) | null>(null);
  const [revealBookings, setRevealBookings] = useState(true);
  const [bookingTransitioning, setBookingTransitioning] = useState(false);

  const TABS = ["upcoming", "active", "past"] as const;
  const dragOffsetAnim = useRef(new Animated.Value(0)).current;
  const currentTabIndexRef = useRef(0);
  const swipeHandledRef = useRef(false);

  const snapToTab = (idx: number) => {
    Animated.spring(segmentAnim, {
      toValue: idx,
      tension: 260,
      friction: 28,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => {
        segmentAnim.stopAnimation();
        dragOffsetAnim.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        dragOffsetAnim.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const idx = currentTabIndexRef.current;
        const sw = screenWidthRef.current;
        const posThreshold = sw * 0.25;
        const velThreshold = 0.4;

        let next = idx;
        if ((gesture.dx < -posThreshold || gesture.vx < -velThreshold) && idx < TABS.length - 1) next = idx + 1;
        else if ((gesture.dx > posThreshold || gesture.vx > velThreshold) && idx > 0) next = idx - 1;

        // Move segmentAnim to the apparent visual position so the snap starts from here
        segmentAnim.setValue(idx - gesture.dx / sw);
        dragOffsetAnim.setValue(0);

        if (next !== idx) {
          swipeHandledRef.current = true;
          currentTabIndexRef.current = next;
          snapToTab(next);
          setTab(TABS[next]);
        } else {
          snapToTab(idx);
        }
      },
      onPanResponderTerminate: () => {
        const idx = currentTabIndexRef.current;
        dragOffsetAnim.setValue(0);
        snapToTab(idx);
      },
    })
  ).current;

  useToastOnMessage(error, { variant: "danger" });

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");
      StatusBar.setBackgroundColor(BG);
      return () => {
        StatusBar.setBarStyle("dark-content");
        StatusBar.setBackgroundColor(BG);
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
        hideSuccessCallback.current = () => {
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
        };
        setShowSuccess(true);
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
    currentTabIndexRef.current = currentIndex;
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

    if (swipeHandledRef.current) {
      swipeHandledRef.current = false;
      setDisplayTab(tab);
      setIsSwitchingTab(false);
      return;
    }

    Animated.timing(segmentAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

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
        <Text style={styles.title}>My Bookings</Text>
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

      <View style={styles.tabBar}>
        {(["upcoming", "active", "past"] as const).map((t) => (
          <Pressable
            key={t}
            style={styles.tab}
            onPress={() => setTab(t)}
            android_ripple={null}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "upcoming" ? "Upcoming" : t === "active" ? "Active" : "Past"}
            </Text>
          </Pressable>
        ))}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabWidth },
            {
              transform: [
                {
                  translateX: segmentAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [20, 20 + tabWidth, 20 + tabWidth * 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <View style={styles.contentWrapper} {...panResponder.panHandlers}>
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
                translateX: Animated.add(
                  segmentAnim.interpolate({
                    inputRange: [-1, 0, 1, 2, 3],
                    outputRange: [screenWidth, 0, -screenWidth, -screenWidth * 2, -screenWidth * 3],
                  }),
                  dragOffsetAnim
                ) as unknown as Animated.AnimatedInterpolation<number>,
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
              !loading && !showPaneSkeleton && paneData.length === 0;

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
                  ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
                  ListFooterComponent={
                    paneTab === "past" && hasMorePast ? (
                      <Pressable
                        style={styles.loadMoreButton}
                        onPress={() => setPastVisibleCount((prev) => prev + 20)}
                      >
                        <Text style={styles.loadMoreText}>Load more</Text>
                        <Ionicons name="chevron-down" size={14} color={ACCENT} />
                      </Pressable>
                    ) : null
                  }
                  ListHeaderComponent={
                    <>
                      {!user ? (
                        <View style={styles.signInCard}>
                          <View style={styles.signInIconWrap}>
                            <Ionicons name="calendar-outline" size={28} color={ACCENT} />
                          </View>
                          <Text style={styles.signInTitle}>Sign in to view bookings</Text>
                          <Text style={styles.signInBody}>
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
                              {[0, 1, 2].map((i) => (
                                <View key={i} style={styles.skeletonCard}>
                                  <View style={styles.skeletonTop}>
                                    <View style={styles.skeletonImage} />
                                    <View style={styles.skeletonInfo}>
                                      <View style={styles.skeletonTitleRow}>
                                        <View style={styles.skeletonTitle} />
                                        <View style={styles.skeletonPrice} />
                                      </View>
                                      <View style={styles.skeletonAddress} />
                                      <View style={styles.skeletonMeta} />
                                    </View>
                                  </View>
                                  <View style={styles.skeletonStrip} />
                                </View>
                              ))}
                            </View>
                          ) : showPaneEmpty ? (
                            <View style={styles.emptyState}>
                              <Image
                                source={
                                  paneTab === "active"
                                    ? require("../assets/illustrations/calendar-bro.png")
                                    : paneTab === "upcoming"
                                    ? require("../assets/illustrations/calendar-amico.png")
                                    : require("../assets/illustrations/calendar-pana.png")
                                }
                                style={styles.emptyImage}
                                resizeMode="contain"
                              />
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
              onAnimationFinish={() => {
                setTimeout(() => {
                  hideSuccessCallback.current?.();
                  hideSuccessCallback.current = null;
                }, 400);
              }}
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
    backgroundColor: BG,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    lineHeight: 32,
    color: ACCENT,
    letterSpacing: -0.6,
  },

  // ── Map CTA banner ───────────────────────────────────────────
  mapCtaBanner: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    ...CARD_SHADOW,
  },
  mapCtaContent: { flex: 1 },
  mapCtaTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: FG,
    marginBottom: 2,
  },
  mapCtaBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  mapCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT,
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

  // ── Tab bar ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  tabText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: SUBTLE,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: ACCENT,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "33.33%",
    height: 2,
    backgroundColor: ACCENT,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // ── Loading ──────────────────────────────────────────────────
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
    color: MUTED,
    fontSize: 13,
  },

  // ── Content ──────────────────────────────────────────────────
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  monthLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: SUBTLE,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 10,
  },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonList: { gap: 14 },
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  skeletonTop: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  skeletonImage: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: LINE,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  skeletonTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  skeletonTitle: {
    flex: 1,
    height: 14,
    borderRadius: 6,
    backgroundColor: LINE,
  },
  skeletonPrice: {
    width: 40,
    height: 14,
    borderRadius: 6,
    backgroundColor: LINE,
  },
  skeletonAddress: {
    height: 11,
    borderRadius: 6,
    backgroundColor: LINE,
    width: "65%",
  },
  skeletonMeta: {
    height: 11,
    borderRadius: 6,
    backgroundColor: LINE,
    width: "45%",
  },
  skeletonStrip: {
    height: 52,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  // ── Sign-in card ─────────────────────────────────────────────
  signInCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    padding: 24,
    alignItems: "center",
    ...CARD_SHADOW,
  },
  signInIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  signInTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    lineHeight: 23,
    color: FG,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  signInBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    textAlign: "center",
    marginBottom: 20,
  },

  // ── Load more ────────────────────────────────────────────────
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    marginTop: 14,
    paddingVertical: 13,
    ...CARD_SHADOW,
  },
  loadMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: ACCENT,
  },

  // ── Empty state ──────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0FDF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    lineHeight: 26,
    color: FG,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
  },

  // ── Primary button ───────────────────────────────────────────
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0a8050",
    borderRadius: 14,
    marginTop: 4,
    height: 52,
    paddingHorizontal: 32,
    alignSelf: "stretch",
    justifyContent: "center",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },

  // ── Success overlay ──────────────────────────────────────────
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
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 28,
    width: 280,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    lineHeight: 26,
    color: FG,
    marginTop: 8,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    marginTop: 6,
    textAlign: "center",
  },
});
