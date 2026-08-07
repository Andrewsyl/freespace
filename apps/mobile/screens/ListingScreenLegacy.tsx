import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  InteractionManager,
  Linking,
  Modal,
  PanResponder,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useMarkerTracksUntilPainted } from "../components/useMarkerTracksUntilPainted";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { trackEvent } from "../analytics";
import { addMinutes, roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import { MapTimePickerSheet } from "../components/MapTimePickerSheet";
import { colors, displayScale, radius, scaleDisplay } from "../styles/theme";
import { getListing, listListingReviews, type ListingReview } from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { useGlobalToast } from "../components/GlobalToast";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import type { ListingDetail, RootStackParamList } from "../types";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { AppleSignInButton } from "../components/AppleSignInButton";
import { formatDateLabel, formatDateTimeLabel, formatReviewDate, formatTimeLabel } from "../utils/dateFormat";
import { humanizeAmenity } from "../utils/amenities";
import {
  calculateListingTotal,
  formatPriceValue,
  getMonthlyGrossEuro,
} from "../utils/pricing";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  ArrowDownUp,
  BatteryCharging,
  Bike,
  CarFront,
  Cctv,
  ChevronDown,
  ChevronRight,
  Clock,
  Fence,
  Footprints,
  Heart,
  IdCard,
  Images,
  Info,
  KeyRound,
  Lightbulb,
  Mail,
  MapPin,
  type LucideIcon,
  Maximize2,
  ReceiptText,
  Ruler,
  RefreshCw,
  Share2,
  BadgeCheck,
  Star,
  UserRound,
  Warehouse,
  X,
} from "lucide-react-native";
import { Section, SkeletonBlock, Tile, usePulse } from "../components/ui";
import { BookButton } from "../components/BookButton";
import { PulseDots } from "../components/PulseDots";
import { motion } from "../styles/motion";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

// Bundled vector icons keyed by feature type. Previously these loaded from
// icons8.com at runtime, which blanked offline, depended on a third-party CDN,
// and leaked every listing view to it.
const FEATURE_ICONS: Record<string, LucideIcon> = {
  cctv:      Cctv,
  ev:        BatteryCharging,
  sheltered: Warehouse,
  lit:       Lightbulb,
  gated:     Fence,
  low:       ArrowDownUp,
  permit:    IdCard,
  code:      KeyRound,
  disabled:  Accessibility,
  allday:    Clock,
  motorbike: Bike,
  wide:      Maximize2,
  Ruler,
};

// Approximate-area halo (Airbnb-style) rather than a pointed pin — the exact
// address is intentionally hidden until booking, so the marker should read as
// "around here", not "exactly here".
function ListingLocationPin() {
  return (
    <View collapsable={false} style={styles.listingMapMarker}>
      <View collapsable={false} style={styles.listingMapMarkerHalo} />
      <View collapsable={false} style={styles.listingMapMarkerBubble}>
        <MapPin size={18} color="#FFFFFF" strokeWidth={2.6} />
      </View>
    </View>
  );
}

// Tracks until the pin view has painted, then freezes — prevents the default red
// pin from flashing while the custom marker composites.
function ListingLocationMarker({ latitude, longitude }: { latitude: number; longitude: number }) {
  const tracks = useMarkerTracksUntilPainted(`${latitude},${longitude}`);
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
    >
      <ListingLocationPin />
    </Marker>
  );
}

const getFeatureIconType = (label: string) => {
  const n = label.toLowerCase();
  if (n.includes("low") || n.includes("clearance") || n.includes("height")) return "low";
  if (n.includes("permit")) return "permit";
  if (n.includes("ev") || n.includes("charger") || n.includes("charging")) return "ev";
  if (n.includes("cctv") || n.includes("camera")) return "cctv";
  if (n.includes("light") || n.includes("lit")) return "lit";
  if (n.includes("shelter") || n.includes("covered") || n.includes("roof")) return "sheltered";
  if (n.includes("gate") || n.includes("gated") || n.includes("barrier")) return "gated";
  if (n.includes("code") || n.includes("keypad") || n.includes("entry")) return "code";
  if (n.includes("disabled") || n.includes("access") && n.includes("wheel")) return "disabled";
  if (n.includes("24") || n.includes("always") || n.includes("round")) return "allday";
  if (n.includes("motorbike") || n.includes("motorcycle") || n.includes("scooter") || n.includes("bike")) return "motorbike";
  if (n.includes("wide")) return "wide";
  return "sheltered";
};

const getAddressWithoutHouseNumber = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return address;
  const firstPart = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [firstPart || parts[0], ...parts.slice(1)].join(", ");
};

const FeatureIcon = ({ type, size = 22, color = FG }: { type: string; size?: number; color?: string }) => {
  const Icon = FEATURE_ICONS[type] ?? FEATURE_ICONS.sheltered;
  return <Icon size={size} color={color} strokeWidth={1.9} />;
};

// Plain-language grade for a rating, derived from the real average — never a
// label the listing hasn't earned.
const ratingWord = (rating: number) => {
  if (rating >= 4.8) return "Exceptional";
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4) return "Very good";
  if (rating >= 3.5) return "Good";
  return "Rated";
};

// Product decision: the scarcity pill isn't part of the current listing design.
// The signal itself (`showScarcityPill` below) is still computed and honest, so
// the flag is the only thing standing between it and the hero — flip to re-enable.
const SCARCITY_PILL_ENABLED = false;

const AVATAR_BG = colors.avatarFills;
const avatarBg = (name: string) => AVATAR_BG[(name.charCodeAt(0) || 0) % AVATAR_BG.length];

// Header control that lives in two worlds: dark glass while it floats on the
// photo, white with ink iconography once the content sheet scrolls beneath
// it. Both layers stay mounted; scroll position crossfades them.
function HeaderFadeButton({
  solidOpacity,
  onPress,
  icon,
  scale,
}: {
  solidOpacity: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
  icon: (color: string) => React.ReactNode;
  scale?: Animated.Value;
}) {
  return (
    <Pressable style={styles.glassBtn} onPress={onPress}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.glassBtnSolid, { opacity: solidOpacity }]} />
      <Animated.View style={scale ? { transform: [{ scale }] } : undefined}>
        <View>{icon("#FFFFFF")}</View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.glassIconTop, { opacity: solidOpacity }]}>
          {icon(FG)}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to, booking, mode: routeMode } = route.params;
  const { user, loginWithOAuth } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const toast = useGlobalToast();
  const heartScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const skeletonPulse = usePulse();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showMapViewer, setShowMapViewer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [authOverlayVisible, setAuthOverlayVisible] = useState(false);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [navigatingToBooking, setNavigatingToBooking] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  // True from confirming a new time until the re-fetched listing lands.
  const [updatingTimes, setUpdatingTimes] = useState(false);
  const [heroTapEnabled, setHeroTapEnabled] = useState(true);
  const heroTapEnabledRef = useRef(true);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const heroListRef = useRef<FlatList<string>>(null);
  const heroSwipeRef = useRef<ScrollView>(null);
  const authBackdropOpacity = useRef(new Animated.Value(0)).current;
  const authSheetTranslateY = useRef(new Animated.Value(320)).current;
  const [pickerField, setPickerField] = useState<"start" | "end">("start");

  // A monthly-only listing carries a monthly price but no hourly rate (the host
  // price screen leaves price_per_hour null for pricingMode "monthly"). Those
  // spaces are enquiry-based, not hourly-bookable, so the detail page swaps the
  // "When do you need it?" hourly booking flow for a monthly start-date + plan
  // picker and shows the raw monthly rate (no service fee — see FavoritesScreen).
  // Show the monthly view when the space has a monthly price AND either the
  // user arrived from the monthly search lane (routeMode) or the listing is
  // monthly-only (no hourly rate). This way a "both" listing opened from
  // monthly search still shows monthly, while the same listing opened normally
  // stays hourly-bookable.
  const isMonthly =
    !!listing &&
    Number(listing.price_per_month) > 0 &&
    (routeMode === "monthly" || !(Number(listing.price_per_hour) > 0));
  // Fee-inclusive monthly price — what the buyer actually pays at checkout, so
  // the listing bar and the booking summary quote the same number (parity with
  // the hourly path, which is always fee-inclusive buyer-side).
  const monthlyPrice = getMonthlyGrossEuro(Number(listing?.price_per_month ?? 0));
  // The monthly term is always a single month: end = start + 1 calendar month.
  const monthlyEnd = useMemo(() => {
    const d = new Date(startAt);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [startAt]);

  const streetViewLocation =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : "53.3498,-6.2603";
  const areaLabel = (() => {
    if (!listing?.address) return "";
    const parts = listing.address.split(",").map((p) => p.trim()).filter(Boolean);
    const isEircode = (s: string) => /^[A-Z]\d{2}\s*[A-Z0-9]{4}$/i.test(s);
    const isCountry = (s: string) => /^ireland$/i.test(s);
    // Strip Eircodes and country from the end
    const trimmed = [...parts];
    while (trimmed.length > 1 && (isEircode(trimmed[trimmed.length - 1]) || isCountry(trimmed[trimmed.length - 1]))) {
      trimmed.pop();
    }
    // Strip house number from the first segment, keep the street name
    trimmed[0] = trimmed[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    // Shorten "Dublin N" → "D4" / "D18"; strip "Co." prefix from counties
    return trimmed
      .map((p) => p.replace(/^Dublin\s*(\d+)$/i, (_, n) => `D${n}`)
                   .replace(/^Co\.?\s+/i, ""))
      .join(", ");
  })();

  const isBookingTimes =
    booking &&
    startAt.getTime() === new Date(booking.startTime).getTime() &&
    endAt.getTime() === new Date(booking.endTime).getTime();
  const showBookingMode = booking && isBookingTimes;

  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    const isIdChange = prevIdRef.current !== id;
    prevIdRef.current = id;
    let active = true;
    const load = async () => {
      if (isIdChange) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getListing(id, { from: startAt.toISOString(), to: endAt.toISOString() });
        if (!active) return;
        setListing(data);
        setError(null);
        if (isIdChange) {
          void trackEvent("mobile_listing_viewed", { listingId: id, title: data.title });
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        if (active) {
          setLoading(false);
          setUpdatingTimes(false);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [id, reloadNonce, startAt, endAt]);

  const handleRetryListing = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    // Only update when the times actually change. Assigning fresh Date objects
    // unconditionally would change their reference identity and retrigger the
    // load effect above, fetching the listing twice on every open.
    const nextStart = new Date(from).getTime();
    const nextEnd = new Date(to).getTime();
    setStartAt((prev) => (prev.getTime() === nextStart ? prev : new Date(nextStart)));
    setEndAt((prev) => (prev.getTime() === nextEnd ? prev : new Date(nextEnd)));
  }, [from, to]);

  useEffect(() => {
    if (showAuthModal) {
      setAuthOverlayVisible(true);
      authBackdropOpacity.setValue(0);
      authSheetTranslateY.setValue(320);
      Animated.parallel([
        Animated.timing(authBackdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(authSheetTranslateY, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!authOverlayVisible) return;
    Animated.parallel([
      Animated.timing(authBackdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(authSheetTranslateY, {
        toValue: 320,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setAuthOverlayVisible(false);
    });
  }, [authBackdropOpacity, authOverlayVisible, authSheetTranslateY, showAuthModal]);

  useEffect(() => {
    let active = true;
    const loadReviews = async () => {
      if (!id) return;
      setReviewsLoading(true);
      try {
        const data = await listListingReviews(id);
        if (active) setReviews(data);
      } catch {
        if (active) setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    void loadReviews();
    return () => { active = false; };
  }, [id]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    return calculateListingTotal(listing, startAt, endAt);
  }, [listing, startAt, endAt]);

  const showBottomBar = !!priceSummary;
  // Pad the scroll content by the bar's real height (measured — it varies
  // with hints/badges and the home-indicator inset) so the last section can
  // never end up underneath it.
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  // Clear the bar's full height plus a gap. This used to subtract 24 on the
  // assumption that the last section already padded ~40px below its final
  // line — but that isn't true of every ending (the reviews empty state has
  // none), and when it wasn't, the last card sat under the bar.
  const bottomBarSpacer = showBottomBar
    ? (bottomBarHeight || 96 + insets.bottom) + 16
    : 24;

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      setStartAt(next);
      // Keep the chosen "until" time unless the new "from" passes it
      // (same behaviour as the search screen).
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
        return bumped;
      }
      return endAt;
    }
    // For the "until" picker: enforce at least 1 h after "from".
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
    return safeEnd;
  };

  const pickerMinimumDate = useMemo(
    () =>
      pickerField === "start"
        ? roundUpToMinuteInterval(new Date(), 5)
        : addMinutes(startAt, 60),
    [pickerField, startAt]
  );

  const imageUrls = useMemo(() => {
    if (listing?.image_urls?.length) return listing.image_urls;
    if (mapsKey)
      return [`https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${streetViewLocation}&fov=65&source=outdoor&key=${mapsKey}`];
    return [];
  }, [listing?.image_urls, mapsKey, streetViewLocation]);

  // Closing the fullscreen viewer leaves the hero on the photo the user swiped
  // to in fullscreen, so the two never feel out of sync.
  const closeImageViewer = () => {
    setShowImageViewer(false);
    setHeroPhotoIndex(viewerIndex);
    heroListRef.current?.scrollToOffset({ offset: viewerIndex * width, animated: false });
    heroSwipeRef.current?.scrollTo({ x: viewerIndex * heroGestureZoneWidth, animated: false });
  };

  // ── Swipe-down-to-dismiss for the fullscreen viewer ──────────────────────────
  // The horizontal FlatList owns left/right paging, so the pan responder only
  // claims a gesture once it's clearly vertical+downward — otherwise page swipes
  // would be hijacked. `closeImageViewer` reads `viewerIndex`, which changes as
  // the user pages, so a ref keeps the release handler pointed at the latest one.
  const viewerDragY = useRef(new Animated.Value(0)).current;
  const closeImageViewerRef = useRef(closeImageViewer);
  closeImageViewerRef.current = closeImageViewer;
  const viewerBackdropOpacity = viewerDragY.interpolate({
    inputRange: [0, height * 0.6],
    outputRange: [1, 0.1],
    extrapolate: "clamp",
  });
  const settleViewerDrag = (g: { dy: number; vy: number }) => {
    if (g.dy > 120 || g.vy > 0.6) {
      Animated.timing(viewerDragY, {
        toValue: height,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        viewerDragY.setValue(0);
        closeImageViewerRef.current();
      });
    } else {
      Animated.spring(viewerDragY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 2,
      }).start();
    }
  };
  const viewerPan = useRef(
    PanResponder.create({
      // Taps (open image, close button) must pass straight through.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // The horizontal FlatList is a ScrollView and claims the touch first, so we
      // intercept in the top-down *capture* phase — but only once a drag is clearly
      // vertical, so horizontal page swipes still reach the list. Grab early (small
      // dy) or the ScrollView wins the gesture and never lets go.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        viewerDragY.setValue(Math.max(0, g.dy));
      },
      // Once we own the drag, don't hand it back to the scroll view, and block the
      // native responder so the list can't reclaim mid-swipe.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderRelease: (_e, g) => settleViewerDrag(g),
      onPanResponderTerminate: (_e, g) => settleViewerDrag(g),
    }),
  ).current;

  const amenities = listing?.amenities ?? [];
  const featureLabels = useMemo(
    // Dedupe after humanizing: distinct raw values ("ev_charging", "EV charging")
    // can map to the same label, and the chips use the label as their React key.
    () => Array.from(new Set(amenities.filter(Boolean).map(humanizeAmenity))),
    [amenities]
  );

  const availabilityFallbackText = useMemo(() => {
    const raw = (listing?.availability_text ?? "").trim();
    if (!raw) return null;
    if (/24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(raw))
      return "24/7";
    if (/closed|by appointment|weekdays|weekends|mon|tue|wed|thu|fri|sat|sun|\d{1,2}:\d{2}/i.test(raw) && raw.length <= 60)
      return raw;
    return null;
  }, [listing?.availability_text]);

  const availabilityEntries = (listing as { availabilitySchedule?: { startsAt: string; endsAt: string; repeatWeekdays: number[] }[] })?.availabilitySchedule ?? [];
  const hasWeeklyAvailability = availabilityEntries.some(
    (entry) => Array.isArray(entry.repeatWeekdays) && entry.repeatWeekdays.length > 0
  );
  const formatHourCompact = (value: string) =>
    new Date(value).toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Dublin",
    });
  const shortDay: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();

  // Collapse the seven weekdays into ranges of consecutive days that share the
  // same hours — "Mon – Fri / 07:00 – 19:00" instead of five identical rows.
  // Handles every-day, weekday/weekend splits, per-day hours and closures, and
  // the free-text fallback ("24/7") in one shape.
  const availabilityGroups: { rangeLabel: string; hours: string; open: boolean; isToday: boolean; everyDay: boolean }[] =
    (() => {
      if (!hasWeeklyAvailability) {
        if (!availabilityFallbackText) return [];
        const is247 = availabilityFallbackText === "24/7";
        return [{
          rangeLabel: "Every day",
          hours: is247 ? "Open 24 hours" : availabilityFallbackText,
          open: true,
          isToday: true,
          everyDay: true,
        }];
      }
      const perDay = weekOrder.map((dow) => {
        const entry = availabilityEntries.find(
          (item) => Array.isArray(item.repeatWeekdays) && item.repeatWeekdays.includes(dow)
        );
        if (!entry) return { dow, key: "closed", open: false, hours: "Closed" };
        const s = formatHourCompact(entry.startsAt);
        const e = formatHourCompact(entry.endsAt);
        const is24 = s === e || (s === "00:00" && (e === "23:59" || e === "00:00"));
        return { dow, key: is24 ? "24h" : `${s}-${e}`, open: true, hours: is24 ? "Open 24 hours" : `${s} – ${e}` };
      });
      const groups: { key: string; dows: number[]; open: boolean; hours: string }[] = [];
      for (const d of perDay) {
        const last = groups[groups.length - 1];
        if (last && last.key === d.key) last.dows.push(d.dow);
        else groups.push({ key: d.key, dows: [d.dow], open: d.open, hours: d.hours });
      }
      return groups.map((g) => {
        const allWeek = g.dows.length === 7;
        return {
          rangeLabel: allWeek
            ? "Every day"
            : g.dows.length === 1
              ? shortDay[g.dows[0]]
              : `${shortDay[g.dows[0]]} – ${shortDay[g.dows[g.dows.length - 1]]}`,
          hours: g.hours,
          open: g.open,
          isToday: g.dows.includes(todayDow),
          everyDay: allWeek,
        };
      });
    })();
  const shouldShowAvailability = hasWeeklyAvailability || Boolean(availabilityFallbackText);


  const hasReviews = (listing?.rating_count ?? 0) > 0 && typeof listing?.rating === "number";
  const isAvailable = listing?.is_available !== false;

  // Honest scarcity signal (E7) — only for multi-space listings where partial
  // booking is possible; a capacity-1 listing's availability state already
  // says everything the pill would. Silence at 5+ free spaces is deliberate
  // (B1): plenty of supply is itself a (non-)signal, never invented urgency.
  const spacesRemaining = listing?.spacesRemaining ?? null;
  const showScarcityPill =
    (listing?.capacity ?? 1) > 1 &&
    spacesRemaining != null &&
    spacesRemaining >= 1 &&
    spacesRemaining < 5;

  const spaceTypeLabel = useMemo(() => {
    const rawType =
      (listing as { space_type?: string; spaceType?: string })?.space_type ??
      (listing as { space_type?: string; spaceType?: string })?.spaceType ??
      null;
    if (rawType) return rawType;
    const title = (listing?.title ?? "").trim();
    if (/ parking$/i.test(title)) return title.replace(/ parking$/i, "");
    const lower = title.toLowerCase();
    if (lower.includes("driveway")) return "Private driveway";
    if (lower.includes("garage")) return "Garage";
    if (lower.includes("car park") || lower.includes("carpark")) return "Car park";
    if (lower.includes("private road")) return "Private road";
    if (lower.includes("street")) return "Street parking";
    return "Parking space";
  }, [listing]);

  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : null;

  // The host's own name for the space leads, matching how the booking summary
  // titles it — "Merrion Square Secure Bay", not the bare street it sits on.
  // Falls back to the street (house number stripped) when a listing has no
  // title of its own, so the header is never empty.
  const streetLabel = useMemo(() => {
    const title = listing?.title?.trim();
    if (title) return title;
    const parts = (listing?.address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const stripped = (parts[0] ?? "").replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    if (stripped.length > 2 && !/^\d+$/.test(stripped)) return stripped;
    return spaceTypeLabel;
  }, [listing, spaceTypeLabel]);

  // Just the locality — `areaLabel` still leads with the street, which would
  // repeat the title.
  const areaOnlyLabel = useMemo(() => {
    const parts = areaLabel.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }, [areaLabel]);

  // Type and area only. Distance used to ride along here too, but 2a gives it
  // its own row in the fact stack — repeating it in both places made the
  // subtitle wrap on longer street names for no added information.
  const subtitleLabel = useMemo(
    () => [spaceTypeLabel, areaOnlyLabel].filter(Boolean).join(" · "),
    [spaceTypeLabel, areaOnlyLabel]
  );

  // What actually fits, straight from the host's own declaration. Silent when
  // they haven't declared one — a guessed size is worse than no size.
  const vehicleFitLabel = useMemo(() => {
    const raw = (
      (listing as { vehicle_size_suitability?: string; vehicleSizeSuitability?: string } | null)
        ?.vehicle_size_suitability ??
      (listing as { vehicle_size_suitability?: string; vehicleSizeSuitability?: string } | null)
        ?.vehicleSizeSuitability ??
      ""
    ).toLowerCase();
    if (raw.includes("motor") || raw.includes("bike")) return "Fits a motorbike";
    if (raw.includes("van") || raw.includes("large")) return "Fits a van or large SUV";
    if (raw.includes("car")) return "Fits a standard car";
    return null;
  }, [listing]);

  // Only show the host's real words. No fabricated filler — an empty About is
  // better than template marketing copy.
  const aboutText = useMemo(() => listing?.description?.trim() || null, [listing?.description]);

  const heroHeight = Math.round(width * 0.8);
  const heroTapHeight = Math.max(0, heroHeight - 40);
  // Left-inset so the swipe/tap layer never covers the header buttons or
  // iOS's left-edge swipe-back gesture.
  const heroGestureZoneWidth = width - 24;

  // ── Scroll choreography ────────────────────────────────────────────────
  // One scroll value drives the hero physics and the header crossfade.
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroTotal = heroHeight + insets.top;
  // Pull down: the photo stretches to fill the rubber-band gap (scale keeps
  // the bottom edge glued to the sheet). Scroll up: the hero recedes at a
  // third of content speed, so the sheet visibly rides over it.
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, heroTotal],
    outputRange: [0, -heroTotal * 0.35],
    extrapolate: "clamp",
  });
  const heroStretch = scrollY.interpolate({
    inputRange: [-heroTotal, 0],
    outputRange: [3, 1],
    extrapolate: "clamp",
  });
  // Glass header buttons become solid as the white sheet passes beneath them
  // — dark glass over white content is the one state they must never show.
  const headerSolidOpacity = scrollY.interpolate({
    inputRange: [heroHeight - 140, heroHeight - 90],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const latitude = typeof listing?.latitude === "number" ? listing.latitude : null;
  const longitude = typeof listing?.longitude === "number" ? listing.longitude : null;
  const hasCoordinates = latitude != null && longitude != null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    listing?.address ?? streetViewLocation
  )}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(
    streetViewLocation
  )}`;

  // The extend-to-end-of-day upsell lived here. It only ever appeared when the
  // daily cap applied, and its whole pitch was the day-rate saving, so it went
  // out with the rest of the day-rate messaging. Restore from git history if
  // the offer is wanted back.
  const handleToggleFavorite = async () => {
    if (!listing) return;
    if (!user) { navigation.navigate("Auth", { screen: "Welcome", params: { returnTo: { screen: "Listing" as const, params: { id, from: startAt.toISOString(), to: endAt.toISOString() } } } }); return; }
    const wasFavorite = isFavorite(id);
    if (!wasFavorite) {
      heartScale.stopAnimation();
      heartScale.setValue(0.6);
      Animated.spring(heartScale, {
        toValue: 1,
        ...motion.springPop,
        useNativeDriver: true,
      }).start();
    }
    try {
      await toggle(listing);
      if (wasFavorite) {
        toast.show("Removed from favourites");
      } else {
        toast.showSuccess("Saved to favourites");
      }
    } catch {
      // toggle already surfaces its own errors; don't show a success toast on failure
    }
  };

  const handleShare = async () => {
    if (!listing) return;
    const url = `https://www.freespace.ie/listings/${id}`;
    try {
      await Share.share({
        message: `${listing.title}${listing.address ? ` · ${listing.address}` : ""}\n${url}`,
        url,
      });
    } catch { /* ignore share cancellations */ }
  };

  const handleOpenMaps = () => {
    void Linking.openURL(mapsUrl);
  };

  const handleOpenStreetView = () => {
    void Linking.openURL(streetViewUrl);
  };

  const closeAuthOverlay = () => {
    setShowAuthModal(false);
  };

  const openAuthScreen = (screen: "Welcome" | "SignIn" | "Register") => {
    closeAuthOverlay();
    const returnTo = { screen: "BookingSummary" as const, params: { id, from: startAt.toISOString(), to: endAt.toISOString() } };
    setTimeout(() => navigation.navigate("Auth", { screen, params: { returnTo } }), 180);
  };

  const openLegal = () => {
    closeAuthOverlay();
    setTimeout(() => navigation.navigate("Legal"), 180);
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        Platform.OS === "android"
          ? process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || undefined
          : undefined,
      iosClientId:
        Platform.OS === "ios"
          ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined
          : undefined,
    });
  }, []);

  // Fire the native Google sign-in straight from the sheet, then continue to
  // booking — no detour through the Welcome screen.
  const handleGoogleSignIn = async () => {
    if (googleSubmitting) return;
    setGoogleSubmitting(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type !== "success") return;
      let idToken: string | null = signInResult.data.idToken ?? null;
      if (!idToken) {
        try {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken ?? null;
        } catch {
          idToken = null;
        }
      }
      if (!idToken) return;
      await loginWithOAuth("google", idToken);
      void trackEvent("mobile_login_succeeded", { method: "google" });
      closeAuthOverlay();
      setTimeout(() => {
        navigation.navigate("BookingSummary", {
          id,
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
      }, 180);
    } catch (err) {
      const errorCode =
        err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) return;
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      Alert.alert("Google sign-in failed", message);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* No bottom edge here — the sticky price bar handles the home-indicator
          inset itself; padding both would float the bar above the screen edge. */}
      <SafeAreaView style={styles.container} edges={[]}>
        {loading ? (
          <View style={styles.skeletonWrap}>
            {/* Hero image placeholder */}
            <SkeletonBlock height={heroHeight + insets.top} borderRadius={0} pulse={skeletonPulse} style={{ width }} />
            {/* Back button ghost */}
            <View style={[styles.skeletonBackRow, { top: insets.top + 12 }]}>
              <SkeletonBlock width={36} height={36} borderRadius={18} pulse={skeletonPulse} />
            </View>
            {/* Content area */}
            <View style={styles.skeletonContent}>
              <SkeletonBlock width="72%" height={22} borderRadius={8} pulse={skeletonPulse} />
              <SkeletonBlock width="50%" height={14} borderRadius={6} pulse={skeletonPulse} style={{ marginTop: 10 }} />
              {/* Stats strip */}
              <View style={styles.skeletonStatsRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonStatsCell}>
                    <SkeletonBlock width={28} height={28} borderRadius={14} pulse={skeletonPulse} />
                    <SkeletonBlock width={44} height={10} borderRadius={5} pulse={skeletonPulse} style={{ marginTop: 6 }} />
                  </View>
                ))}
              </View>
              {/* Time picker row */}
              <View style={styles.skeletonPickerRow}>
                <SkeletonBlock height={54} borderRadius={14} pulse={skeletonPulse} style={{ flex: 1 }} />
                <SkeletonBlock width={28} height={28} borderRadius={8} pulse={skeletonPulse} />
                <SkeletonBlock height={54} borderRadius={14} pulse={skeletonPulse} style={{ flex: 1 }} />
              </View>
              {/* Section lines */}
              <SkeletonBlock width={120} height={18} borderRadius={8} pulse={skeletonPulse} style={{ marginTop: 28 }} />
              <SkeletonBlock width="90%" height={13} borderRadius={6} pulse={skeletonPulse} style={{ marginTop: 12 }} />
              <SkeletonBlock width="75%" height={13} borderRadius={6} pulse={skeletonPulse} style={{ marginTop: 8 }} />
              <SkeletonBlock width="55%" height={13} borderRadius={6} pulse={skeletonPulse} style={{ marginTop: 8 }} />
            </View>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <View style={styles.errorIconWrap}>
              <AlertCircle size={26} color={colors.danger} strokeWidth={2.1} />
            </View>
            <Text style={styles.errorTitle}>Couldn't load this space</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.errorPrimaryBtn} onPress={handleRetryListing}>
              <RefreshCw size={16} color={colors.textInverse} strokeWidth={2.2} />
              <Text style={styles.errorPrimaryText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.errorSecondaryBtn} onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}>
              <Text style={styles.errorSecondaryText}>Back to search</Text>
            </Pressable>
          </View>
        ) : listing ? (
          <>
            {/* Full-bleed hero image */}
            <Animated.View
              style={[
                styles.heroFixed,
                {
                  height: heroHeight + insets.top,
                  transform: [{ translateY: heroTranslateY }, { scale: heroStretch }],
                },
              ]}
            >
              {imageUrls.length ? (
                <FlatList
                  ref={heroListRef}
                  data={imageUrls}
                  horizontal
                  scrollEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(url, index) => `${url}-${index}`}
                  getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={{ width, height: heroHeight + insets.top }}
                      resizeMode="cover"
                    />
                  )}
                />
              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight + insets.top }]}>
                  <CarFront size={52} color="rgba(255,255,255,0.45)" strokeWidth={1.7} />
                </View>
              )}
              {/* Top stop is slightly stronger than the photo needs so the header
                  controls hold contrast against light photos. */}
              <LinearGradient
                colors={["rgba(16,20,20,0.34)", "transparent", "rgba(16,20,20,0.62)"]}
                locations={[0, 0.38, 1]}
                style={styles.heroGradient}
                pointerEvents="none"
              />
              {/* No host chip: host identity is out of scope on this screen by
                  product decision. */}
              {/* A count rather than a dot row: dots stop being readable past
                  four photos, and "3 / 9" is the more useful fact anyway. */}
              {imageUrls.length > 1 ? (
                <View style={styles.heroPhotoCount} pointerEvents="none">
                  <Images size={13} color={colors.textInverse} strokeWidth={2.2} />
                  <Text style={styles.heroPhotoCountText}>
                    {`${heroPhotoIndex + 1} / ${imageUrls.length}`}
                  </Text>
                </View>
              ) : null}
              {SCARCITY_PILL_ENABLED && showScarcityPill ? (
                <View style={styles.scarcityPill} pointerEvents="none">
                  <Text style={styles.scarcityPillText}>
                    {spacesRemaining === 1 ? "1 space left" : `${spacesRemaining} spaces left`}
                  </Text>
                </View>
              ) : null}
            </Animated.View>

            {/* Floating controls — glass over the photo, solid over content */}
            <View style={[styles.headerOverlay, { top: insets.top + 12 }]}>
              <HeaderFadeButton
                solidOpacity={headerSolidOpacity}
                onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}
                icon={(color) => <ArrowLeft size={19} color={color} strokeWidth={2.2} />}
              />
              <View style={styles.headerRightColumn}>
                <View style={styles.headerRight}>
                  <HeaderFadeButton
                    solidOpacity={headerSolidOpacity}
                    onPress={handleShare}
                    icon={(color) => <Share2 size={18} color={color} strokeWidth={2.1} />}
                  />
                  <HeaderFadeButton
                    solidOpacity={headerSolidOpacity}
                    onPress={handleToggleFavorite}
                    scale={heartScale}
                    icon={(color) => (
                      <Heart
                        size={18}
                        color={isFavorite(id) ? GREEN : color}
                        fill={isFavorite(id) ? GREEN : "none"}
                        strokeWidth={2.1}
                      />
                    )}
                  />
                </View>
            </View>
            </View>

            {/* Transparent gesture layer over the hero (same pattern as the old tap zone):
                forwards horizontal swipes to the background photo list and taps to the
                fullscreen viewer. Unmounts once the content sheet scrolls over the hero,
                so the sheet underneath it stays fully interactive.
                Starts below the header row and inset from the left edge so it never
                competes with the back button or iOS's edge-swipe-to-go-back gesture. */}
            {heroTapEnabled && imageUrls.length ? (
              <ScrollView
                ref={heroSwipeRef}
                style={[
                  styles.heroTapZone,
                  { height: heroTapHeight - (insets.top + 56), top: insets.top + 56, left: 24 },
                ]}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: heroPhotoIndex * heroGestureZoneWidth, y: 0 }}
                scrollEventThrottle={16}
                onScroll={(event) => {
                  // This layer is narrower than the background photo list (it leaves
                  // room on the left for iOS's edge-swipe-back gesture), so its offset
                  // has to be rescaled to the background list's full-width pages.
                  heroListRef.current?.scrollToOffset({
                    offset: (event.nativeEvent.contentOffset.x / heroGestureZoneWidth) * width,
                    animated: false,
                  });
                }}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / heroGestureZoneWidth);
                  setHeroPhotoIndex(index);
                  heroListRef.current?.scrollToOffset({ offset: index * width, animated: false });
                }}
              >
                {imageUrls.map((url, index) => (
                  <Pressable
                    key={`${url}-${index}`}
                    style={{ width: heroGestureZoneWidth, height: heroTapHeight }}
                    onPress={() => { setViewerIndex(index); setShowImageViewer(true); }}
                  />
                ))}
              </ScrollView>
            ) : null}

            <Animated.ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                {
                  useNativeDriver: true,
                  listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const nextEnabled =
                      event.nativeEvent.contentOffset.y < Math.max(0, heroTapHeight - 24);
                    if (nextEnabled !== heroTapEnabledRef.current) {
                      heroTapEnabledRef.current = nextEnabled;
                      setHeroTapEnabled(nextEnabled);
                    }
                  },
                }
              )}
            >
              {/* Hero spacer — the sheet overlaps the hero by 32, matching its
                  own top radius so the corners bite into the photo. */}
              <View style={{ height: heroHeight + insets.top - 32 }} />

              {/* Content sheet */}
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle} numberOfLines={2}>{streetLabel}</Text>
                {subtitleLabel ? (
                  <Text style={styles.sheetSubtitle} numberOfLines={1}>{subtitleLabel}</Text>
                ) : null}

                {/* Fact stack — no hairlines between rows. A fixed icon gutter
                    aligns the text into one column, which reads sharper than
                    ruling every row off from the next. */}
                <Pressable
                  style={styles.factRow}
                  disabled={!hasReviews}
                  onPress={() =>
                    navigation.navigate("ListingReviews", {
                      id,
                      rating: listing.rating,
                      ratingCount: listing.rating_count,
                    })
                  }
                >
                  <View style={styles.factIcon}>
                    <Star size={18} color={FG} fill={FG} strokeWidth={0} />
                  </View>
                  <View style={styles.factBody}>
                    <Text style={styles.factRating}>
                      {hasReviews
                        ? `${listing.rating?.toFixed(1)} ${ratingWord(listing.rating ?? 0)} (${listing.rating_count ?? reviews.length})`
                        : "New space"}
                    </Text>
                  </View>
                  {/* Green, per 2a: the affordance colour is consistent across
                      the stack, so a chevron always means "this goes
                      somewhere". Only rendered when there are reviews to open —
                      a chevron on a dead row is a promise the screen can't
                      keep. */}
                  {hasReviews ? <ChevronRight size={18} color={GREEN} strokeWidth={1.9} /> : null}
                </Pressable>

                {/* Distance, when we know it. Straight-line from the search
                    origin — so it states the distance and not a walking time,
                    which crow-flies metres can't honestly support in a city of
                    one-ways and quays. */}
                {distanceLabel ? (
                  <View style={styles.factRow}>
                    <View style={styles.factIcon}>
                      <Footprints size={18} color={FG} strokeWidth={1.9} />
                    </View>
                    <View style={styles.factBody}>
                      <Text style={styles.factText}>{`${distanceLabel} away`}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Price, fees and opening hours as one stacked block, per 2a.
                    "Fees included" is a statement of fact here: the server
                    bakes the platform fee into the displayed price, so there is
                    no fee added later to break out. */}
                <View style={[styles.factRow, styles.factRowStacked]}>
                  <View style={styles.factIcon}>
                    <ReceiptText size={18} color={FG} strokeWidth={1.9} />
                  </View>
                  <View style={styles.factBody}>
                    <Text style={styles.factLine}>
                      {`€${formatPriceValue(Number(listing.price_per_hour))} per hour`}
                    </Text>
                    <Text style={styles.factLine}>Fees included</Text>
                    {availabilityFallbackText ? (
                      <Text style={[styles.factLine, styles.factLineStrong]}>
                        {availabilityFallbackText === "24/7"
                          ? "Open 24/7"
                          : availabilityFallbackText}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Replaces the old "open in Maps" row. A Maps handoff can only
                    ever point at the exact address, which is deliberately
                    withheld until booking — so the row states what actually
                    helps someone decide: what fits. No chevron; it leads
                    nowhere. The access-details line that used to sit under this
                    is already the first sentence of the policy block below, so
                    it isn't repeated here. */}
                <View style={styles.factRow}>
                  {/* 2a uses `info` here, not a car: the row covers what fits
                      *and* the access rules, and a car glyph narrows it to one
                      of those. 22 / 1.6 matches the rest of the stack. */}
                  <View style={styles.factIcon}>
                    <Info size={18} color={FG} strokeWidth={1.9} />
                  </View>
                  <View style={styles.factBody}>
                    {/* Always rendered, so the row never silently vanishes on a
                        listing whose host skipped the field — the undeclared
                        state says so rather than guessing a size. */}
                    <Text style={styles.factText}>
                      {vehicleFitLabel ?? "Vehicle size not specified by the host"}
                    </Text>
                  </View>
                </View>

                {/* Host row. Only rendered when the listing actually carries a
                    host name — an anonymous "Hosted by" line is worse than no
                    row, and the verified tick is shown only when the API says
                    so, never assumed. */}
                {listing.hostName?.trim() ? (
                  <View style={styles.factRow}>
                    <View style={styles.factIcon}>
                      <UserRound size={18} color={FG} strokeWidth={1.9} />
                    </View>
                    <View style={styles.hostRowBody}>
                      <View style={styles.hostAvatar}>
                        <Text style={styles.hostAvatarText}>
                          {listing.hostName.trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.factText} numberOfLines={1}>
                        {`Hosted by ${listing.hostName.trim()}`}
                      </Text>
                      {listing.hostVerified ? (
                        <BadgeCheck size={16} color={GREEN} strokeWidth={2.2} />
                      ) : null}
                    </View>
                  </View>
                ) : null}


              </View>

              {/* ── Ground — everything below the masthead sits on the tint ── */}
              <View style={[styles.ground, { paddingBottom: bottomBarSpacer }]}>
                {/* ── Time selection ──────────────────────────────────────
                    On the ground under its own heading, per 2a. Sitting flush
                    in the fact stack made the one control that changes the
                    price read as another fact about the space. */}
                <Section title="Your parking window" subtitle="Tap a time to change it" />
                <View style={styles.timePicker}>
                  <View style={styles.timePickerCols}>
                  <Pressable
                    style={styles.timePickerHalf}
                    onPress={() => openPicker("start")}
                    accessibilityRole="button"
                    accessibilityLabel={isMonthly ? "Change start date" : "Change arrival time"}
                  >
                    <View style={styles.timePickerLabelRow}>
                      <View style={styles.timePickerDotFilled} />
                      <Text style={styles.timePickerLabel}>{isMonthly ? "Start" : "Arriving"}</Text>
                    </View>
                    <View style={styles.timePickerValueRow}>
                      <Text style={styles.timePickerValue}>
                        {isMonthly ? formatDateLabel(startAt) : formatTimeLabel(startAt)}
                      </Text>
                      <ChevronDown size={15} color={FG_SUBTLE} strokeWidth={2.4} />
                    </View>
                    {!isMonthly ? (
                      <Text style={styles.timePickerDate}>{formatDateLabel(startAt)}</Text>
                    ) : null}
                  </Pressable>

                  <View style={styles.timePickerRule} />

                  {isMonthly ? (
                    /* Derived (start + 1 month), so it is shown, not editable. */
                    <View style={styles.timePickerHalf}>
                      <View style={styles.timePickerLabelRow}>
                        <View style={styles.timePickerDotHollow} />
                        <Text style={styles.timePickerLabel}>Until</Text>
                      </View>
                      <View style={styles.timePickerValueRow}>
                        <Text style={styles.timePickerValue}>{formatDateLabel(monthlyEnd)}</Text>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.timePickerHalf}
                      onPress={() => openPicker("end")}
                      accessibilityRole="button"
                      accessibilityLabel="Change departure time"
                    >
                      <View style={styles.timePickerLabelRow}>
                        <View style={styles.timePickerDotHollow} />
                        <Text style={styles.timePickerLabel}>Leaving</Text>
                      </View>
                      <View style={styles.timePickerValueRow}>
                        <Text style={styles.timePickerValue}>{formatTimeLabel(endAt)}</Text>
                        <ChevronDown size={15} color={FG_SUBTLE} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.timePickerDate}>{formatDateLabel(endAt)}</Text>
                    </Pressable>
                  )}
                  </View>
                  {/* Inside the card, on the tint — the duration describes the
                      two fields above it, so it sits within the same border
                      rather than floating underneath. */}
                  <View style={styles.timePickerFooter}>
                    <Clock size={15} color={FG_SUBTLE} strokeWidth={1.9} />
                    <Text style={[styles.timePickerFooterText, styles.timePickerDuration]}>
                      {isMonthly ? "1 month" : priceSummary?.durationLabel ?? ""}
                    </Text>
                    <Text style={styles.timePickerFooterText}>Reserved instantly</Text>
                  </View>
                </View>

                {/* ── What's included ── */}
                {featureLabels.length > 0 ? (
                  <>
                    <Section title="What's included" subtitle="Everything this space comes with" />
                    {/* Two-up grid: these are scannable facts, not a checklist,
                        so they read side by side with the icon leading rather
                        than as one long ticked column. */}
                    <View style={styles.amenityGrid}>
                      {featureLabels
                        .slice()
                        .sort((a, b) => {
                          const order = ["cctv", "gated", "lit", "code", "permit"];
                          const ra = order.indexOf(getFeatureIconType(a));
                          const rb = order.indexOf(getFeatureIconType(b));
                          return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
                        })
                        .map((feature) => (
                          <View key={feature} style={styles.amenityCell}>
                            <FeatureIcon type={getFeatureIconType(feature)} size={19} color={FG} />
                            <Text style={styles.amenityLabel} numberOfLines={1}>{feature}</Text>
                          </View>
                        ))}
                    </View>
                  </>
                ) : null}

                {/* ── About — kept because it is the host's own copy, and the
                    design has no other home for it. ── */}
                {aboutText ? (
                  <>
                    <Section title="About this space" />
                    <Tile>
                      <Text style={styles.aboutText} numberOfLines={showFullAbout ? undefined : 4}>
                        {aboutText}
                      </Text>
                      {aboutText.length > 160 ? (
                        <Pressable onPress={() => setShowFullAbout((p) => !p)}>
                          <Text style={styles.aboutMore}>
                            {showFullAbout ? "Show less" : "Show more"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </Tile>
                  </>
                ) : null}

                {/* ── Getting there ── */}
                {hasCoordinates ? (
                  <>
                    <Section title="Getting there" />
                    <Pressable style={styles.mapTile} onPress={() => setShowMapViewer(true)}>
                      <MapView
                        style={styles.mapTileMap}
                        provider={PROVIDER_GOOGLE}
                        cacheEnabled={Platform.OS !== "android"}
                        scrollEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        zoomEnabled={false}
                        toolbarEnabled={false}
                        zoomTapEnabled={false}
                        moveOnMarkerPress={false}
                        region={{
                          latitude,
                          longitude,
                          latitudeDelta: 0.0035,
                          longitudeDelta: 0.0035,
                        }}
                        mapType="standard"
                        customMapStyle={LIGHT_MAP_STYLE}
                        onMapReady={() => setMapReady(true)}
                      >
                        <ListingLocationMarker latitude={latitude} longitude={longitude} />
                      </MapView>
                      {!mapReady && (
                        <SkeletonBlock
                          height={140}
                          style={StyleSheet.absoluteFillObject}
                          borderRadius={0}
                          pulse={skeletonPulse}
                        />
                      )}
                      {/* The native map draws on its own surface and ignores the
                          screen-level updating overlay, so grey it out from inside
                          its own container (same trick as the loading skeleton). */}
                      {updatingTimes && (
                        <View style={styles.updatingMapCover} pointerEvents="none" />
                      )}
                    </Pressable>
                    <Text style={styles.mapCaption}>Approximate area until you book.</Text>
                  </>
                ) : null}

                {/* ── Availability ── */}
                {shouldShowAvailability ? (
                  <>
                    <Section title="Availability" />
                    <Tile rows>
                      {availabilityGroups.map((group, index) => (
                        <View key={`${group.rangeLabel}-${index}`}>
                          {index > 0 ? <View style={styles.tileHairline} /> : null}
                          <View style={styles.availRow}>
                            <Text style={[styles.availRange, !group.open && styles.availMuted]}>
                              {group.rangeLabel}
                            </Text>
                            {group.isToday && group.open && !group.everyDay ? (
                              <View style={styles.availTodayChip}>
                                <Text style={styles.availTodayChipText}>Today</Text>
                              </View>
                            ) : null}
                            <Text style={[styles.availHours, !group.open && styles.availMuted]}>
                              {group.hours}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </Tile>
                  </>
                ) : null}

                {/* ── What drivers say ── */}
                <Section
                  title="What drivers say"
                  actionLabel={
                    hasReviews ? `See all ${listing.rating_count ?? reviews.length}` : undefined
                  }
                  onAction={
                    hasReviews
                      ? () =>
                          navigation.navigate("ListingReviews", {
                            id,
                            rating: listing.rating,
                            ratingCount: listing.rating_count,
                          })
                      : undefined
                  }
                />
                {hasReviews ? (
                  <View style={styles.reviewSummary}>
                    <Star size={14} color={GREEN} fill={GREEN} strokeWidth={0} />
                    <Text style={styles.reviewSummaryScore}>{listing.rating?.toFixed(1)}</Text>
                    <Text style={styles.reviewSummaryMeta}>
                      {`Based on ${listing.rating_count ?? reviews.length} recent bookings`}
                    </Text>
                  </View>
                ) : null}
                {reviewsLoading ? (
                  <View style={styles.reviewsLoading}>
                    <PulseDots />
                  </View>
                ) : reviews.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reviewRailContent}
                    style={styles.reviewRail}
                  >
                    {reviews.map((review) => {
                      const authorName =
                        (review as { author_name?: string }).author_name ??
                        review.authorName ?? "Guest";
                      const reviewDate = formatReviewDate(
                        new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                      );
                      return (
                        <View key={review.id} style={styles.reviewCard}>
                          <View style={styles.reviewCardTop}>
                            <View style={[styles.reviewAvatar, { backgroundColor: avatarBg(authorName) }]}>
                              <Text style={styles.reviewAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.reviewMetaBlock}>
                              <Text style={styles.reviewAuthorName} numberOfLines={1}>{authorName}</Text>
                              <Text style={styles.reviewDateText}>{reviewDate}</Text>
                            </View>
                            <View style={styles.reviewScore}>
                              <Star size={12} color={GREEN} fill={GREEN} strokeWidth={0} />
                              <Text style={styles.reviewScoreText}>{review.rating.toFixed(1)}</Text>
                            </View>
                          </View>
                          {review.comment ? (
                            <Text style={styles.reviewComment} numberOfLines={4}>{review.comment}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  /* A listing can have a rating but no review bodies to show —
                     the score comes off the listing, the text off a separate
                     fetch. Claiming "no reviews yet" there contradicts the
                     "based on N bookings" line directly above it. */
                  <View style={styles.reviewEmptyWrap}>
                    <View style={styles.reviewEmptyIconWrap}>
                      <Star size={22} color={GREEN} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.reviewEmpty}>
                      {hasReviews ? "No written reviews yet" : "No reviews yet"}
                    </Text>
                    <Text style={styles.reviewEmptyHint}>
                      {hasReviews
                        ? "Drivers have rated this space but haven't left written feedback."
                        : "Be the first to park here and share your experience."}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.ScrollView>

            {/* ── Sticky bottom bar ──────────────────────── */}
            {priceSummary ? (
              <View
                style={[styles.bottomBar, { paddingBottom: 14 + insets.bottom }]}
                onLayout={(e) => {
                  const h = Math.round(e.nativeEvent.layout.height);
                  if (h > 0 && h !== bottomBarHeight) setBottomBarHeight(h);
                }}
              >
                <View style={styles.bottomLeft}>
                  {isMonthly ? (
                    <>
                      <Text style={styles.bottomPrice}>
                        €{formatPriceValue(monthlyPrice)}
                        <Text style={styles.bottomPriceSuffix}> / month</Text>
                      </Text>
                      <Text style={styles.bottomDuration}>Monthly space</Text>
                    </>
                  ) : updatingTimes ? (
                    <View style={styles.bottomPriceUpdating}>
                      <PulseDots />
                    </View>
                  ) : (
                    <>
                      {/* No " total" suffix — the number sits next to a Reserve
                          button, which is all the context it needs. */}
                      <Text style={styles.bottomPrice}>€{formatPriceValue(priceSummary.grossTotal)}</Text>
                      <Text style={styles.bottomDuration}>{priceSummary.durationLabel}</Text>
                      {listing.is_available === false ? (
                        <Text style={styles.bottomUnavailableHint}>Try another arrival time</Text>
                      ) : null}
                    </>
                  )}
                </View>
                {listing.hostId && user?.id === listing.hostId ? (
                  <View style={styles.ownListingBadge}>
                    <Text style={styles.ownListingText}>This is your listing</Text>
                  </View>
                ) : isMonthly ? (
                  <BookButton
                    label="Book monthly"
                    style={styles.dockButton}
                    loading={navigatingToBooking}
                    onPress={() => {
                      if (!user) { setShowAuthModal(true); return; }
                      if (navigatingToBooking) return;
                      setNavigatingToBooking(true);
                      // One-off single month: hold the space from the chosen
                      // start date to the same day next month (server derives
                      // months=1 from this span). No multi-month selection.
                      navigation.navigate("BookingSummary", {
                        id,
                        from: startAt.toISOString(),
                        to: monthlyEnd.toISOString(),
                        mode: "monthly",
                      });
                      setTimeout(() => setNavigatingToBooking(false), 800);
                    }}
                  />
                ) : showBookingMode ? (
                  <View style={[styles.ownListingBadge, { backgroundColor: GREEN_SOFT }]}>
                    <Text style={[styles.ownListingText, { color: GREEN }]}>Already booked</Text>
                  </View>
                ) : (
                  <BookButton
                    label={listing.is_available === false ? "Choose another time" : "Reserve"}
                    style={styles.dockButton}
                    loading={navigatingToBooking}
                    onPress={() => {
                      // Fresh quote still in flight — never book a stale price.
                      if (updatingTimes) return;
                      if (listing.is_available === false) {
                        openPicker("start");
                        return;
                      }
                      if (!user) { setShowAuthModal(true); return; }
                      if (navigatingToBooking) return;
                      setNavigatingToBooking(true);
                      navigation.navigate("BookingSummary", {
                        id,
                        from: startAt.toISOString(),
                        to: endAt.toISOString(),
                      });
                      setTimeout(() => setNavigatingToBooking(false), 800);
                    }}
                  />
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </SafeAreaView>

      <MapTimePickerSheet
        visible={pickerVisible}
        field={pickerField}
        value={pickerField === "start" ? startAt : endAt}
        startAt={startAt}
        minimumDate={pickerMinimumDate}
        minuteInterval={5}
        dateOnly={isMonthly}
        title={isMonthly ? "Start date" : undefined}
        onCancel={() => setPickerVisible(false)}
        onConfirm={(picked) => {
          setPickerVisible(false);
          // Never allow a past time — snap to the next 5-minute slot from now.
          const floor = roundUpToMinuteInterval(new Date(), 5);
          const next = picked.getTime() < floor.getTime() ? floor : picked;
          // If nothing actually changed, don't kick off a needless re-fetch.
          const currentValue = pickerField === "start" ? startAt : endAt;
          if (next.getTime() === currentValue.getTime()) return;
          // Show the updating spinner right away, then apply once the close
          // animation has had the frame — applyPickedDate re-renders the whole
          // screen and re-fetches, which would otherwise stall the sheet before
          // it starts sliding away.
          setUpdatingTimes(true);
          InteractionManager.runAfterInteractions(() => applyPickedDate(next));
        }}
      />

      <Modal transparent animationType="none" visible={authOverlayVisible} onRequestClose={closeAuthOverlay}>
        <View style={styles.authModalRoot} pointerEvents="box-none">
          <Animated.View style={[styles.authModalBackdrop, { opacity: authBackdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeAuthOverlay} />
          </Animated.View>
          <Animated.View
            style={[
              styles.authModalSheet,
              {
                paddingBottom: Math.max(24, insets.bottom + 12),
                transform: [{ translateY: authSheetTranslateY }],
              },
            ]}
          >
            <View style={styles.authModalHandle} />
            <Pressable
              style={styles.authModalClose}
              onPress={closeAuthOverlay}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
            >
              <X size={22} color={colors.textDisabled} strokeWidth={2.2} />
            </Pressable>
            <Text style={styles.authModalTitle}>
              <Text style={styles.authModalTitleAccent}>Log in </Text>
              or create an account.
            </Text>
            <Text style={styles.authModalBody}>
              You&apos;ll need an account to book this space and manage your reservations.
            </Text>
            <AppleSignInButton
              source="listing"
              onError={(message) => Alert.alert("Apple sign-in failed", message)}
              onSuccess={() => {
                closeAuthOverlay();
                setTimeout(() => {
                  navigation.navigate("BookingSummary", {
                    id,
                    from: startAt.toISOString(),
                    to: endAt.toISOString(),
                  });
                }, 180);
              }}
            />
            <Pressable
              style={styles.authModalOutlineBtn}
              disabled={googleSubmitting}
              onPress={handleGoogleSignIn}
            >
              {googleSubmitting ? (
                <ActivityIndicator size="small" color={GREEN} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={GREEN} style={styles.authModalBtnIcon} />
                  <Text style={styles.authModalOutlineText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={styles.authModalOutlineBtn}
              onPress={() => {
                openAuthScreen("SignIn");
              }}
            >
              <Mail size={19} color={GREEN} strokeWidth={2.1} style={styles.authModalBtnIcon} />
              <Text style={styles.authModalOutlineText}>Log in with email</Text>
            </Pressable>
            <View style={styles.authModalDivider}>
              <View style={styles.authModalDividerLine} />
              <Text style={styles.authModalDividerText}>or</Text>
              <View style={styles.authModalDividerLine} />
            </View>
            <Pressable
              style={styles.authModalCreateBtn}
              onPress={() => {
                openAuthScreen("Register");
              }}
            >
              <Text style={styles.authModalCreateText}>Create account</Text>
            </Pressable>
            <Text style={styles.authModalLegal}>
              By continuing, you agree to our{" "}
              <Text style={styles.authModalLegalLink} onPress={openLegal}>
                Terms &amp; Privacy
              </Text>
              .
            </Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Image viewer modal */}
      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.viewerRoot}>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.viewerBackdrop, { opacity: viewerBackdropOpacity }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.viewerDragLayer, { transform: [{ translateY: viewerDragY }] }]}
            {...viewerPan.panHandlers}
          >
            <FlatList
              data={imageUrls}
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(url, index) => `${url}-${index}`}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              onMomentumScrollEnd={(event) => {
                setViewerIndex(Math.round(event.nativeEvent.contentOffset.x / width));
              }}
              renderItem={({ item }) => (
                <View style={{ width, flex: 1 }}>
                  <Image source={{ uri: item }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                </View>
              )}
            />
          </Animated.View>
          <Pressable
            style={[styles.viewerGlassClose, { top: insets.top + 12 }]}
            onPress={closeImageViewer}
            hitSlop={8}
          >
            <X size={20} color={colors.textInverse} strokeWidth={2.2} />
          </Pressable>
          {imageUrls.length > 1 ? (
            <View style={[styles.viewerCounter, { top: insets.top + 20 }]} pointerEvents="none">
              <Text style={styles.viewerCounterText}>
                {viewerIndex + 1} / {imageUrls.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={showMapViewer}
        animationType="slide"
        onRequestClose={() => setShowMapViewer(false)}
      >
        <View style={styles.mapViewerScreen}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            cacheEnabled={Platform.OS !== "android"}
            loadingEnabled
            loadingBackgroundColor={colors.ground}
            initialRegion={{
              latitude: latitude ?? 53.3498,
              longitude: longitude ?? -6.2603,
              latitudeDelta: 0.0035,
              longitudeDelta: 0.0035,
            }}
            mapType="standard"
            customMapStyle={LIGHT_MAP_STYLE}
          >
            {hasCoordinates ? (
              <ListingLocationMarker latitude={latitude!} longitude={longitude!} />
            ) : null}
          </MapView>
          <Pressable
            style={[styles.viewerClose, styles.mapViewerClose, { top: insets.top + 12 }]}
            onPress={() => setShowMapViewer(false)}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — sourced from styles/theme.ts. This screen used to carry its
// own parallel hex set; it is converged onto the shared tokens.
const GREEN      = colors.primary;
const GREEN_SOFT = colors.tileBg;      // icon wells
const FG         = colors.text;        // primary ink
const FG_2       = colors.textMuted;   // body copy
const FG_SUBTLE  = colors.textSoft;    // meta / supporting
const DIVIDER    = colors.divider;     // tile edges + row hairlines
const GROUND     = colors.ground;      // the tint everything below the masthead sits on
// #DDE2E2 per the funnel design: light enough to describe a tile edge without
// drawing a line around it. `colors.border` (#C7CFCF) reads as an outline here.
const EDGE       = colors.borderHairline;
const HANDLE     = colors.border;      // grab handles (sheets, pickers)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  updatingMapCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cardBgMuted,
  },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 24,
  },
  errorIconWrap: {
    width: 56, height: 56, borderRadius: 4,
    backgroundColor: colors.status.canceled.background,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20, lineHeight: 25, letterSpacing: -0.6,
    color: FG, textAlign: "center", marginBottom: 8,
  },
  errorText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: FG_2, textAlign: "center", marginBottom: 18,
  },
  errorPrimaryBtn: {
    height: 50, borderRadius: 12, backgroundColor: GREEN,
    paddingHorizontal: 22,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, minWidth: 180,
  },
  errorPrimaryText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: colors.textInverse,
  },
  errorSecondaryBtn: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10 },
  errorSecondaryText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN,
  },

  // Skeleton
  skeletonWrap: { flex: 1, backgroundColor: colors.cardBg },
  skeletonBackRow: { position: "absolute", left: 16 },
  skeletonContent: { paddingHorizontal: 16, paddingTop: 18 },
  skeletonStatsRow: {
    flexDirection: "row",
    // Matches the tile it stands in for — at radius 4 the shape changed under
    // the user when content arrived.
    borderRadius: 8,
    borderWidth: 1,
    borderColor: EDGE,
    overflow: "hidden",
    marginTop: 18,
    marginBottom: 4,
  },
  skeletonStatsCell: {
    flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8,
  },
  skeletonPickerRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18,
  },

  // Hero — deliberately unchanged: the tall photo, its gradient and the curved
  // sheet riding over it are the part of this screen that already worked.
  heroFixed: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0, overflow: "hidden" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.heroDark },
  heroGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroPhotoCount: {
    position: "absolute", bottom: 52, right: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(16,20,20,0.42)",
    borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  heroPhotoCountText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: colors.textInverse,
    fontVariant: ["tabular-nums"],
  },
  scarcityPill: {
    position: "absolute", bottom: 52, left: 16,
    backgroundColor: colors.status.pending.background,
    borderColor: colors.status.pending.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  scarcityPillText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 11, color: colors.status.pending.text,
  },

  // Floating controls
  headerOverlay: {
    position: "absolute", left: 16, right: 16, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  headerRightColumn: { alignItems: "flex-end", gap: 10 },
  headerRight: { flexDirection: "row", gap: 10 },
  glassBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: "rgba(16,20,20,0.42)",
    alignItems: "center", justifyContent: "center", position: "relative",
    // No shadow/elevation: on Android, elevation over a translucent background
    // casts a boxy grey halo (not a clean circle). Contrast comes from the dark
    // glass over photos and from the solid overlay's border over white content.
  },
  glassBtnSolid: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  glassIconTop: { alignItems: "center", justifyContent: "center" },
  heroTapZone: { position: "absolute", left: 0, right: 0, zIndex: 1 },

  scroll: { flex: 1 },

  // ── Masthead sheet ─────────────────────────────────────────────────────────
  // White, full-bleed content, but it keeps the curved top corners and the
  // -32 overlap onto the hero.
  sheet: {
    backgroundColor: colors.cardBg,
    position: "relative",
    zIndex: 3,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    // 2a: 20 / 16 / 18.
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
  },
  // 2a: 30/33, 800, -1.2 tracking.
  sheetTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDisplay(30), lineHeight: scaleDisplay(33),
    letterSpacing: -1.2 * displayScale, color: FG,
  },
  // 2a: 15px #6E7676, 3 under the title, 18 before the fact stack.
  sheetSubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, color: FG_SUBTLE, marginTop: 3, paddingBottom: 18,
  },

  // ── Fact stack ─────────────────────────────────────────────────────────────
  // Hairlines bleed past the sheet's 16 padding so the rows scan as one list.
  // 2a: 18 gap, 34 min-height, 5 padding.
  factRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    minHeight: 32, paddingVertical: 5,
  },
  // The multi-line row keeps its glyph centred against the whole block, not
  // pinned to the first line — the icon labels the group, not its opening line.
  factRowStacked: { alignItems: "center" },
  // Fixed 24 gutter so every row's text starts on the same vertical line
  // whatever glyph sits beside it.
  factIcon: { width: 24, flexShrink: 0, alignItems: "center" },
  factBody: { flex: 1, minWidth: 0 },
  factRating: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: GREEN },
  hostRowBody: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  hostAvatar: {
    width: 26, height: 26, borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  hostAvatarText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 12, color: GREEN,
  },
  factText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: FG },
  // The price row stacks its lines at the booking page's 14/19 so the three
  // read as one block rather than three rows that happen to share a glyph.
  factLine: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, lineHeight: 19, color: FG },
  // Composed onto factLine rather than restating the size — the stack only
  // varies by weight, and a second declaration is a second thing to drift.
  factLineStrong: { fontFamily: "PlusJakartaSans-Bold" },

  // ── Time selection ─────────────────────────────────────────────────────────
  // One control, split in two, sitting on the white masthead. The numerals are
  // the loudest thing in it because changing them is the only action here that
  // moves the price.
  timePicker: {
    marginHorizontal: 16, marginBottom: 16,
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 8,
    backgroundColor: colors.appBg,
    overflow: "hidden",
  },
  timePickerCols: { flexDirection: "row", alignItems: "stretch" },
  timePickerHalf: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 15 },
  timePickerRule: { width: 1, backgroundColor: EDGE, marginVertical: 16 },
  // Filled dot for the arrival, hollow for the departure — the pair reads as a
  // journey from one point to another rather than two unrelated fields.
  timePickerLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timePickerDotFilled: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  timePickerDotHollow: {
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: GREEN,
  },
  timePickerLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: GREEN,
  },
  timePickerValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 },
  timePickerValue: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDisplay(27), lineHeight: scaleDisplay(29),
    letterSpacing: -1.1 * displayScale, color: FG,
  },
  timePickerDate: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, marginTop: 3,
  },
  // Top rule as well as the tint: on the ground the card's own border already
  // closes the shape, so without it the footer reads as a separate strip.
  timePickerFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: EDGE,
    backgroundColor: GROUND,
  },
  timePickerFooterText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE,
  },
  timePickerDuration: { flex: 1, fontFamily: "PlusJakartaSans-Bold", color: FG },

  // ── Ground ─────────────────────────────────────────────────────────────────
  // Hairline where the white sheet meets the tint. Without it the two surfaces
  // just fade into each other and the section boundary reads as a gap rather
  // than an edge.
  // 8 here plus the section header's own 8 makes the system's 16 above the
  // first heading. The policy paragraph used to supply that gap; with it gone
  // the heading sat straight on the seam where the white sheet ends.
  ground: {
    backgroundColor: GROUND,
    borderTopWidth: 1, borderTopColor: EDGE,
    paddingTop: 8,
  },

  // Section headers sit on the ground, never inside their tile.
  // Same header with its bottom padding handed to the subtitle beneath it.
  // 2a: 15px #6E7676, 2 under the header, block closes at 10.
  // flex/shrink rather than marginLeft:auto — the title is long enough to run
  // straight into the link on a narrow screen, which rendered as
  // "What drivers saySee all 31".

  // ── Tiles ──────────────────────────────────────────────────────────────────
  // Same tile, tighter padding — rows supply their own vertical rhythm.
  tileHairline: { height: 1, backgroundColor: GROUND },

  // ── What's included ────────────────────────────────────────────────────────
  amenityGrid: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 8,
    marginHorizontal: 16, marginBottom: 12,
    // 2a: 16 padding, 12 row gap / 10 column gap.
    padding: 16,
    flexDirection: "row", flexWrap: "wrap",
    rowGap: 12,
  },
  // 50% rather than flex:1 so a trailing odd item stays in the left column
  // instead of stretching across the card.
  amenityCell: {
    width: "50%",
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingRight: 10,
  },
  amenityLabel: { flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG },

  // ── About ──────────────────────────────────────────────────────────────────
  aboutText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19, color: FG_2 },
  aboutMore: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN, marginTop: 8,
  },

  // ── Getting there ──────────────────────────────────────────────────────────
  mapTile: {
    height: 140,
    marginHorizontal: 16, marginBottom: 8,
    borderWidth: 1, borderColor: EDGE, borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.appBg,
    position: "relative",
  },
  mapTileMap: { ...StyleSheet.absoluteFillObject },
  // Sits on the ground below the tile, so it never covers Google's attribution.
  mapCaption: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: FG_SUBTLE,
    paddingHorizontal: 16, paddingBottom: 20,
  },
  listingMapMarker: {
    alignItems: "center", height: 110, justifyContent: "center", width: 110,
  },
  listingMapMarkerHalo: {
    position: "absolute",
    width: 90, height: 90, borderRadius: radius.pill,
    backgroundColor: "rgba(10,128,80,0.13)",
  },
  listingMapMarkerBubble: {
    alignItems: "center",
    backgroundColor: GREEN,
    borderColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    height: 30, width: 30,
    justifyContent: "center",
  },

  // ── Availability ───────────────────────────────────────────────────────────
  // 6 matches the row rhythm used inside every other tile, so the tile's own
  // 10 plus this lands the first row on the system's 16 edge.
  availRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  availRange: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: FG },
  availHours: {
    marginLeft: "auto",
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_2,
  },
  availMuted: { color: FG_SUBTLE },
  availTodayChip: {
    backgroundColor: GREEN_SOFT, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  availTodayChipText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: colors.headerTint,
  },

  // ── Reviews ────────────────────────────────────────────────────────────────
  reviewSummary: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  reviewSummaryScore: { fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: FG },
  reviewSummaryMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: FG_SUBTLE },
  reviewsLoading: { paddingHorizontal: 16, paddingBottom: 20 },
  reviewRail: { marginBottom: 20 },
  reviewRailContent: { paddingHorizontal: 16, gap: 12 },
  reviewCard: {
    width: 240,
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 8,
    padding: 12,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewAvatar: {
    width: 28, height: 28, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 12, color: FG },
  reviewMetaBlock: { flex: 1, minWidth: 0 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: FG },
  reviewDateText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: FG_SUBTLE },
  reviewScore: { flexDirection: "row", alignItems: "center", gap: 3 },
  reviewScoreText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 12, color: GREEN },
  reviewComment: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: FG_2, marginTop: 8,
  },
  reviewEmptyWrap: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 8,
    marginHorizontal: 16, marginBottom: 20,
    paddingVertical: 24, paddingHorizontal: 16,
    alignItems: "center",
  },
  reviewEmptyIconWrap: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: GREEN_SOFT,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  reviewEmpty: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: FG, textAlign: "center",
  },
  reviewEmptyHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: FG_SUBTLE, textAlign: "center", marginTop: 4,
  },

  // ── Auth modal — bottom sheet ──────────────────────────────────────────────
  authModalRoot: { flex: 1, justifyContent: "flex-end" },
  authModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 17, 17, 0.45)",
  },
  authModalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
  },
  authModalHandle: {
    alignSelf: "center",
    width: 40, height: 5, borderRadius: radius.pill,
    backgroundColor: HANDLE,
    marginBottom: 16,
  },
  authModalClose: {
    position: "absolute", top: 14, right: 14,
    width: 32, height: 32, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  authModalTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20, lineHeight: 25, letterSpacing: -0.6,
    color: FG, marginBottom: 8,
  },
  authModalTitleAccent: { color: GREEN },
  authModalBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13, lineHeight: 19, color: FG_2, marginBottom: 20,
  },
  authModalOutlineBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1, borderColor: DIVIDER,
    height: 50, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 10, paddingHorizontal: 16,
  },
  authModalBtnIcon: { marginRight: 10 },
  authModalOutlineText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG,
  },
  authModalDivider: {
    flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 14,
  },
  authModalDividerLine: { flex: 1, height: 1, backgroundColor: DIVIDER },
  authModalDividerText: {
    marginHorizontal: 12,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG_SUBTLE,
  },
  authModalCreateBtn: {
    backgroundColor: GREEN,
    height: 50, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  authModalCreateText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: colors.textInverse,
  },
  authModalLegal: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11, lineHeight: 16,
    color: FG_SUBTLE, textAlign: "center",
    marginTop: 12, paddingHorizontal: 8,
  },
  authModalLegalLink: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // ── Dock — the one elevated surface on this screen ─────────────────────────
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1, borderTopColor: DIVIDER,
    paddingHorizontal: 16, paddingTop: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06, shadowRadius: 18, elevation: 8,
  },
  bottomLeft: { flex: 1, justifyContent: "center" },
  bottomPrice: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDisplay(24), lineHeight: scaleDisplay(28),
    letterSpacing: -0.8 * displayScale, color: FG,
  },
  bottomPriceSuffix: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE,
  },
  // Matches the resting height of price + duration so the bar never jumps
  // while a new quote is in flight.
  bottomPriceUpdating: { height: 47, justifyContent: "center" },
  bottomDuration: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, marginTop: 1,
  },
  bottomUnavailableHint: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.danger, marginTop: 2,
  },
  dockButton: { paddingVertical: 15, paddingHorizontal: 28 },
  ownListingBadge: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.pill,
    backgroundColor: GROUND,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  ownListingText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG_SUBTLE },

  // ── Image / map viewer ─────────────────────────────────────────────────────
  viewerRoot: { flex: 1 },
  viewerBackdrop: { backgroundColor: colors.text },
  viewerDragLayer: { flex: 1 },
  viewerGlassClose: {
    position: "absolute", left: 16, zIndex: 2,
    width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  viewerCounter: {
    position: "absolute", alignSelf: "center", zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  viewerCounterText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: colors.textInverse,
    letterSpacing: 0.6, fontVariant: ["tabular-nums"],
  },
  mapViewerScreen: { flex: 1, backgroundColor: colors.cardBg },
  mapViewerClose: { backgroundColor: "rgba(17,17,17,0.74)" },
  viewerClose: {
    position: "absolute", right: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.pill,
  },
  viewerCloseText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textInverse,
  },
});
