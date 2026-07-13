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
import { colors, primaryButtonShadow, radius, spacing } from "../styles/theme";
import { getListing, listListingReviews, type ListingReview } from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { useGlobalToast } from "../components/GlobalToast";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import type { ListingDetail, RootStackParamList } from "../types";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { AppleSignInButton } from "../components/AppleSignInButton";
import { formatDateLabel, formatDateTimeLabel, formatReviewDate, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal, formatPriceValue, getListingRateType, getMonthlyGrossEuro } from "../utils/pricing";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowDownUp,
  BadgeCheck,
  BatteryCharging,
  Bike,
  CarFront,
  Cctv,
  ChevronDown,
  CircleCheck,
  Clock,
  Fence,
  Heart,
  IdCard,
  KeyRound,
  Lightbulb,
  Mail,
  MapPin,
  type LucideIcon,
  Maximize2,
  RefreshCw,
  Share2,
  Star,
  Warehouse,
  X,
} from "lucide-react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { BookButton } from "../components/BookButton";
import { PulseDots } from "../components/PulseDots";
import { motion } from "../styles/motion";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

// The extend-to-end-of-day offer only shows when the top-up costs at most this
// fraction of the current booking — so it reads as "you're nearly at the day
// rate, want the rest?" and never as "book hours you didn't ask for". Tune to
// taste once it's been seen against real listings.
const EXTEND_MAX_MARGINAL_RATIO = 1 / 3;

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

// Turn raw amenity keys (e.g. "ev_charging", "cctv") into display labels
// ("EV Charging", "CCTV"): split on _/-, title-case words, keep known acronyms.
const AMENITY_ACRONYMS: Record<string, string> = { ev: "EV", cctv: "CCTV" };
const humanizeAmenity = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return AMENITY_ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

const getAddressWithoutHouseNumber = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return address;
  const firstPart = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [firstPart || parts[0], ...parts.slice(1)].join(", ");
};

const FeatureIcon = ({ type, size = 22 }: { type: string; size?: number }) => {
  const Icon = FEATURE_ICONS[type] ?? FEATURE_ICONS.sheltered;
  return <Icon size={size} color={GREEN_DARK} strokeWidth={1.75} />;
};

const AVATAR_BG = ["#CCE9E6", "#FFE4C8", "#D8E4FF", "#FFD6D6", "#D6F5E3"];
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
  // The sheet (20) and last section (20) already pad ~40px below the final
  // line, so the scroll spacer only needs to cover the rest of the absolutely-
  // positioned bar's height, plus a small deliberate gap above it.
  const bottomBarSpacer = showBottomBar
    ? Math.max(0, (bottomBarHeight || 96 + insets.bottom) - 24)
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

  // Host trust block (docs/PARKING_DESIGN_BIBLE.md E10.1) — name + real tenure
  // only. No response-time shown: there's no messaging/inquiry feature in
  // this app to compute one from, and the bible's own rule is "if it isn't
  // computed from real data, it doesn't ship."
  const hostName = listing?.hostName?.trim() || null;
  const hostSinceYear = listing?.hostSince ? new Date(listing.hostSince).getFullYear() : null;
  const hostVerified = Boolean(listing?.hostVerified);

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

  const displayTitle = useMemo(() => {
    const parts = (listing?.address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const stripped = (parts[0] ?? "").replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    const isRealStreet = stripped.length > 2 && !/^\d+$/.test(stripped);
    if (isRealStreet) return `${spaceTypeLabel} on ${stripped}`;
    // Fall back to first non-postcode segment
    const area = parts.slice(1).find((p) => !/^(Dublin\s*\d+|D\d{2})/i.test(p));
    if (area) {
      const prep = /\b(street|road|avenue|drive|lane|close|way|place|terrace|crescent|grove|court|walk|quay|square|gardens|st|rd|ave|dr)\b/i.test(area) ? "on" : "in";
      return `${spaceTypeLabel} ${prep} ${area}`;
    }
    return listing?.title ?? spaceTypeLabel;
  }, [listing, spaceTypeLabel]);

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

  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : null;
  const latitude = typeof listing?.latitude === "number" ? listing.latitude : null;
  const longitude = typeof listing?.longitude === "number" ? listing.longitude : null;
  const hasCoordinates = latitude != null && longitude != null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    listing?.address ?? streetViewLocation
  )}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(
    streetViewLocation
  )}`;

  // "Extend to end of day for only €X" — the YourParkingSpace upsell. The price
  // is the REAL total for the extended session (14:00→23:59), computed by the
  // same engine that charges at checkout — never a fabricated discount. It only
  // appears when the daily-rate cap makes the extra hours a genuine bargain
  // (otherwise "for only" would be a lie), so it never nags with odd offers
  // like "+10h for €16".
  const extendOffer = useMemo(() => {
    if (!listing) return null;
    if (getListingRateType(listing) !== "hourly") return null;
    const endOfDay = new Date(endAt);
    endOfDay.setHours(23, 59, 0, 0);
    if (endAt >= endOfDay) return null;
    const baseline = calculateListingTotal(listing, startAt, endAt);
    const extended = calculateListingTotal(listing, startAt, endOfDay);
    // Only a real deal when the day cap kicks in — i.e. the extra hours would
    // cost more at the hourly rate than the whole day does.
    if (!extended.dailyCapApplied) return null;
    const marginal = extended.grossTotal - baseline.grossTotal;
    if (marginal <= 0.5) return null;
    // ...and only when it's a genuine top-up, not a spend-doubler. If the
    // extension costs more than a third of what they're already paying, it
    // reads as "book hours you didn't ask for" rather than "you're nearly at
    // the day rate — want the rest of the day?". Gate on the small marginal.
    if (marginal > baseline.grossTotal * EXTEND_MAX_MARGINAL_RATIO) return null;
    // Honest saving: this listing's own hourly rate for the extended hours
    // (fee-inclusive) minus the day-capped price the user actually pays. Both
    // are real prices for this space — no invented reference. Same figure the
    // bottom price bar shows once extended, so they never disagree.
    const saving = extended.dailyCapSavingGross;
    return {
      endOfDay,
      timeLabel: formatTimeLabel(endOfDay),
      total: formatPriceValue(extended.grossTotal),
      saving: saving >= 1 ? formatPriceValue(saving) : null,
    };
  }, [listing, startAt, endAt]);

  // Take-rate visibility for the extend upsell — tracked once per distinct
  // offer (not on every render) so we can see how often it's shown vs tapped.
  const trackedExtendOfferKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!extendOffer) return;
    const offerKey = `${extendOffer.endOfDay.getTime()}|${extendOffer.total}`;
    if (trackedExtendOfferKeyRef.current === offerKey) return;
    trackedExtendOfferKeyRef.current = offerKey;
    void trackEvent("mobile_extend_offer_shown", {
      listingId: id,
      total: extendOffer.total,
      saving: extendOffer.saving,
    });
  }, [extendOffer, id]);

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
              <LinearGradient
                colors={["rgba(0,0,0,0.22)", "transparent", "rgba(0,0,0,0.60)"]}
                locations={[0, 0.42, 1]}
                style={styles.heroGradient}
                pointerEvents="none"
              />
              {imageUrls.length > 1 ? (
                <View style={styles.photoDots} pointerEvents="none">
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[styles.photoDot, index === heroPhotoIndex && styles.photoDotActive]}
                    />
                  ))}
                </View>
              ) : null}
              {showScarcityPill ? (
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
              contentContainerStyle={{ paddingBottom: bottomBarSpacer }}
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
              {/* Hero spacer */}
              <View style={{ height: heroHeight + insets.top - 28 }} />

              {/* Content sheet */}
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />


                {/* ── Overview — title + meta line ── */}
                <View style={styles.overview}>
                  <Text style={styles.sheetTitle}>{displayTitle}</Text>
                  <View style={styles.metaRow}>
                    <Star
                      size={14}
                      color={hasReviews ? FG : FG_SUBTLE}
                      fill={hasReviews ? FG : "none"}
                      strokeWidth={2}
                    />
                    <Text style={styles.metaStrong}>{hasReviews ? listing.rating?.toFixed(1) : "New"}</Text>
                    {hasReviews ? (
                      <Text style={styles.metaMuted}>{`(${listing.rating_count ?? reviews.length})`}</Text>
                    ) : null}
                    <Text style={styles.metaDot}>·</Text>
                    <MapPin size={15} color={GREEN} strokeWidth={2.2} />
                    <Text style={styles.metaMuted} numberOfLines={1}>
                      {`${areaLabel || "Location shared on booking"}${distanceLabel ? ` · ${distanceLabel}` : ""}`}
                    </Text>
                  </View>
                </View>

                {/* ── Booking ──────────────────────────────── */}
                <View style={styles.sectionDivider} />
                {isMonthly ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Monthly parking</Text>
                  <View style={styles.timeRow}>
                    <Pressable style={styles.timeField} onPress={() => openPicker("start")}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>Start date</Text>
                        <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.timeFieldTime}>{formatDateLabel(startAt)}</Text>
                    </Pressable>
                    <View style={styles.timeArrow}>
                      <ArrowRight size={14} color={colors.textMuted} strokeWidth={2.3} />
                    </View>
                    {/* End date is derived (start + 1 month), so it's shown, not
                        editable — the term is always a single month. */}
                    <View style={styles.timeField}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>End date</Text>
                      </View>
                      <Text style={styles.timeFieldTime}>{formatDateLabel(monthlyEnd)}</Text>
                    </View>
                  </View>
                  <View style={styles.reserveNote}>
                    <CircleCheck size={16} color={GREEN} strokeWidth={2.3} />
                    <Text style={styles.reserveNoteText}>Reserve one month up front — renew each month to keep the space.</Text>
                  </View>
                </View>
                ) : (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>When do you need it?</Text>
                  <View style={styles.timeRow}>
                    <Pressable style={styles.timeField} onPress={() => openPicker("start")}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>Arriving</Text>
                        <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.timeFieldTime}>{formatTimeLabel(startAt)}</Text>
                      <Text style={styles.timeFieldDate}>{formatDateLabel(startAt)}</Text>
                    </Pressable>
                    <View style={styles.timeArrow}>
                      <ArrowRight size={14} color={colors.textMuted} strokeWidth={2.3} />
                    </View>
                    <Pressable style={styles.timeField} onPress={() => openPicker("end")}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>Leaving</Text>
                        <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.timeFieldTime}>{formatTimeLabel(endAt)}</Text>
                      <Text style={styles.timeFieldDate}>{formatDateLabel(endAt)}</Text>
                    </Pressable>
                  </View>
                  {extendOffer ? (
                    <Pressable
                      style={({ pressed }) => [styles.extendBar, pressed && styles.extendBarPressed]}
                      onPress={() => {
                        void trackEvent("mobile_extend_offer_accepted", {
                          listingId: id,
                          total: extendOffer.total,
                          saving: extendOffer.saving,
                        });
                        setUpdatingTimes(true);
                        InteractionManager.runAfterInteractions(() =>
                          setEndAt(extendOffer.endOfDay)
                        );
                      }}
                    >
                      <Text style={styles.extendBarText}>
                        Extend to {extendOffer.timeLabel} for only{" "}
                        <Text style={styles.extendBarPrice}>€{extendOffer.total}</Text>
                        {extendOffer.saving ? (
                          <Text style={styles.extendBarSaving}>  ·  save €{extendOffer.saving}</Text>
                        ) : null}
                      </Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.reserveNote}>
                    <CircleCheck size={16} color={GREEN} strokeWidth={2.3} />
                    <Text style={styles.reserveNoteText}>Reserved instantly — free cancellation up to 2 hours before.</Text>
                  </View>
                </View>
                )}

                {/* ── Host ─────────────────────────────────── */}
                {hostName ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <View style={styles.hostRow}>
                        <View style={[styles.hostAvatar, { backgroundColor: avatarBg(hostName) }]}>
                          <Text style={styles.hostAvatarText}>{hostName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.hostInfo}>
                          <View style={styles.hostNameRow}>
                            <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
                            {hostVerified ? (
                              <BadgeCheck size={15} color={GREEN} strokeWidth={2.2} />
                            ) : null}
                          </View>
                          {hostSinceYear ? (
                            <Text style={styles.hostMeta}>Hosting since {hostSinceYear}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── About ────────────────────────────────── */}
                {aboutText ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>About this space</Text>
                      <Text style={styles.sectionBody} numberOfLines={showFullAbout ? undefined : 3}>
                        {aboutText}
                      </Text>
                      {aboutText.length > 140 ? (
                        <Pressable onPress={() => setShowFullAbout((p) => !p)}>
                          <Text style={styles.showMoreLink}>
                            {showFullAbout ? "Show less" : "Show more"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                ) : null}

                {/* ── What's included ──────────────────────── */}
                {featureLabels.length > 0 ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>What&apos;s included</Text>
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
                            <View key={feature} style={styles.amenityItem}>
                              <View style={styles.amenityIconWrap}>
                                <FeatureIcon type={getFeatureIconType(feature)} size={18} />
                              </View>
                              <Text style={styles.amenityLabel} numberOfLines={2}>{feature}</Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── Location ─────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Getting there</Text>
                  <Text style={styles.gettingThereLine}>
                    {`${distanceLabel ? `${distanceLabel} away. ` : ""}Exact address & directions sent the moment you book.`}
                  </Text>
                  {hasCoordinates ? (
                    <View style={[styles.localAreaMapWrap, { marginTop: 14 }]}>
                      <MapView
                        style={styles.localAreaMap}
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
                          height={180}
                          style={StyleSheet.absoluteFillObject}
                          borderRadius={0}
                          pulse={skeletonPulse}
                        />
                      )}
                      <Pressable style={styles.mapExpandButton} onPress={() => setShowMapViewer(true)}>
                        <Maximize2 size={17} color={colors.text} strokeWidth={2} />
                      </Pressable>
                      {/* The native map draws on its own surface and ignores the
                          screen-level updating overlay, so grey it out from inside
                          its own container (same trick as the loading skeleton). */}
                      {updatingTimes && (
                        <View style={styles.updatingMapCover} pointerEvents="none" />
                      )}
                    </View>
                  ) : null}
                </View>

                {/* ── Availability ─────────────────────────── */}
                {shouldShowAvailability ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Availability</Text>
                      <View style={styles.availCard}>
                        {availabilityGroups.map((group, index) => (
                          <View
                            key={`${group.rangeLabel}-${index}`}
                            style={[styles.availGroup, index > 0 && styles.availGroupSpacing]}
                          >
                            <View style={styles.availGroupTop}>
                              <Text style={[styles.availRange, !group.open && styles.availRangeMuted]}>
                                {group.rangeLabel}
                              </Text>
                              {group.isToday && group.open && !group.everyDay ? (
                                <View style={styles.availTodayChip}>
                                  <Text style={styles.availTodayChipText}>Today</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={[styles.availHours, !group.open && styles.availHoursClosed]}>
                              {group.hours}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── Reviews ──────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <View style={styles.reviewsHeader}>
                    <Text style={styles.sectionTitle}>Reviews</Text>
                    {hasReviews ? (
                      <Pressable
                        style={styles.reviewsLink}
                        onPress={() =>
                          navigation.navigate("ListingReviews", {
                            id,
                            rating: listing.rating,
                            ratingCount: listing.rating_count,
                          })
                        }
                      >
                        <Text style={styles.reviewsLinkText}>
                          See all ({listing.rating_count ?? reviews.length})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {reviewsLoading ? (
                    <View style={{ marginTop: 16, alignSelf: "flex-start" }}>
                      <PulseDots />
                    </View>
                  ) : reviews.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.reviewTilesContent}
                      style={styles.reviewTiles}
                    >
                      {reviews.map((review) => {
                        const authorName =
                          (review as { author_name?: string }).author_name ??
                          review.authorName ?? "Guest";
                        const reviewDate = formatReviewDate(
                          new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                        );
                        return (
                          <View key={review.id} style={styles.reviewTile}>
                            <View style={styles.reviewCardTop}>
                              <View style={[styles.reviewAvatar, { backgroundColor: avatarBg(authorName) }]}>
                                <Text style={styles.reviewAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
                              </View>
                              <View style={styles.reviewMetaBlock}>
                                <Text style={styles.reviewAuthorName} numberOfLines={1}>{authorName}</Text>
                                <Text style={styles.reviewDateText}>{reviewDate}</Text>
                              </View>
                              <View style={styles.reviewStarPill}>
                                <Star size={11} color={FG} fill={FG} strokeWidth={2} />
                                <Text style={styles.reviewStarPillText}>{review.rating.toFixed(1)}</Text>
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
                    <View style={styles.reviewEmptyWrap}>
                      <View style={styles.reviewEmptyIconWrap}>
                        <Star size={22} color={GREEN} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.reviewEmpty}>No reviews yet</Text>
                      <Text style={styles.reviewEmptyHint}>Be the first to park here and share your experience.</Text>
                    </View>
                  )}
                </View>

              </View>
            </Animated.ScrollView>

            {/* ── Sticky bottom bar ──────────────────────── */}
            {priceSummary ? (
              <View
                style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}
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
                      <Text style={styles.bottomPrice}>
                        €{formatPriceValue(priceSummary.grossTotal)}
                        <Text style={styles.bottomPriceSuffix}> total</Text>
                      </Text>
                      <Text style={styles.bottomDuration}>{priceSummary.durationLabel}</Text>
                      {listing.is_available === false ? (
                        <Text style={styles.bottomUnavailableHint}>Try another arrival time</Text>
                      ) : null}
                      {priceSummary.dailyCapApplied ? (
                        <Text style={styles.dailyCapBadge}>Day rate — saves €{formatPriceValue(priceSummary.dailyCapSavingGross)}</Text>
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
                    label={listing.is_available === false ? "Choose another time" : "Book Now"}
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
            loadingBackgroundColor="#F9FAFB"
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
// Design tokens (spec)
// Sourced from styles/theme.ts (see docs/PARKING_DESIGN_BIBLE.md §0) — this
// screen already imported `colors` (line 32) but had drifted onto its own
// parallel hex set instead of using it. Converged onto the shared tokens.
const GREEN      = colors.primary;
const GREEN_SOFT = colors.tileBg;
const FG         = colors.text;       // primary ink
const FG_2       = colors.textMuted;  // secondary text
const FG_MUTED   = FG_2;              // alias of FG_2 (secondary text)
const FG_SUBTLE  = colors.textSoft;   // labels / meta
const LINE       = colors.divider;    // control borders (outline buttons)
const LINE_2     = LINE;              // alias — was a duplicate of LINE
const DIVIDER    = colors.divider;   // section + row separators — hairline territory
const BG_2       = colors.cardBgMuted; // single neutral fill (chips, fields, soft cards)
const FG_BODY    = FG_2;        // single body-copy colour
const GREEN_DARK = colors.headerTint; // green text on light fills (AA contrast)
const HANDLE     = colors.border;   // grab handles (sheets, pickers)

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
    width: 56,
    height: 56,
    borderRadius: radius.cardSmall,
    backgroundColor: colors.status.canceled.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    lineHeight: 25,
    color: FG,
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: FG_MUTED,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  errorPrimaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: GREEN,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 180,
  },
  errorPrimaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: colors.textInverse,
  },
  errorSecondaryBtn: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  errorSecondaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: GREEN,
  },

  // Skeleton
  skeletonWrap: { flex: 1, backgroundColor: colors.cardBg },
  skeletonBackRow: { position: "absolute", left: 16 },
  skeletonContent: { paddingHorizontal: spacing.screenX, paddingTop: 20 },
  skeletonStatsRow: {
    flexDirection: "row",
    borderRadius: radius.cardSmall,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DIVIDER,
    overflow: "hidden",
    marginTop: 18,
    marginBottom: 4,
  },
  skeletonStatsCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skeletonPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },

  // Hero
  heroFixed: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0, overflow: "hidden" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#1B3A32" },
  heroGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  photoDots: {
    position: "absolute", bottom: 44, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
  },
  photoDot: {
    width: 6, height: 6, borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  photoDotActive: {
    width: 16,
    backgroundColor: colors.cardBg,
  },
  // Honest scarcity signal (docs/PARKING_DESIGN_BIBLE.md E7) — the one warm
  // accent, reusing the same amber family as `colors.status.pending` so it
  // doesn't invent a second "warning" language. Fully opaque, not a light
  // overlay — floating chrome over a photo must hold contrast on its own (A5).
  scarcityPill: {
    position: "absolute",
    bottom: 44,
    left: 16,
    backgroundColor: colors.status.pending.background,
    borderColor: colors.status.pending.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scarcityPillText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    color: colors.status.pending.text,
    letterSpacing: 0.1,
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
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center", justifyContent: "center", position: "relative",
    // No shadow/elevation: on Android, elevation over a translucent background
    // casts a boxy grey halo (not a clean circle). Contrast comes from the dark
    // glass over photos and from the solid overlay's border over white content.
  },
  // Solid state needs its own definition — a white disc over white content
  // would otherwise dissolve into the page.
  glassBtnSolid: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  glassIconTop: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroTapZone: { position: "absolute", left: 0, right: 0, zIndex: 1 },

  scroll: { flex: 1 },

  // Sheet — floating surface, gets the sheet shadow
  sheet: {
    backgroundColor: colors.cardBg,
    position: "relative",
    zIndex: 3,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12, paddingBottom: 20,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: radius.pill,
    backgroundColor: HANDLE,
    alignSelf: "center", marginBottom: 12,
  },

  // Title block


  // ── Price + meta block ─────────────────────────────────────────────────────
  priceBlock: {
    paddingTop: 6,
    paddingBottom: 16,
    gap: 4,
  },

  // ── Overview — title + meta line (rebuild) ───────────────────────────────────
  overview: { paddingTop: 4, paddingBottom: 20, gap: 10 },
  sheetTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 23, lineHeight: 29, letterSpacing: -0.4, color: FG },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  metaStrong: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  metaMuted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, flexShrink: 1 },
  metaDot: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, marginHorizontal: 2 },

  // ── Airbnb-style time pickers ──────────────────────────────────────────────
  bookingHeader: {
    marginBottom: 12,
  },
  bookingHeaderTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    lineHeight: 21,
    color: FG,
    letterSpacing: -0.3,
  },
  bookingHeaderBody: {
    marginTop: 3,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: FG_SUBTLE,
  },
  timeRow: { flexDirection: "row", alignItems: "stretch", gap: 10, marginBottom: 12 },
  timeField: {
    flex: 1,
    backgroundColor: BG_2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  timeFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  // Same voice as the search card's Arrive/Leave strip — no uppercase
  // micro-labels, the time is the loudest thing in the field.
  timeFieldLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12, color: colors.textMuted,
    letterSpacing: -0.1,
  },
  timeFieldTime: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 19, color: FG, letterSpacing: -0.5, lineHeight: 23,
  },
  timeFieldDate: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12, color: FG_MUTED, marginTop: 2,
  },
  timeArrow: { alignItems: "center", justifyContent: "center" },

  // ── About: show more link ──────────────────────────────────────────────────
  showMoreLink: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14, color: GREEN, marginTop: 10,
  },

  // ── Reviews: empty state (icon+title+hint, matches HistoryScreen's pattern
  // rather than two bare centred lines) ───────────────────────────────────
  reviewEmptyWrap: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: BG_2,
    borderRadius: radius.cardSmall,
    marginTop: 8,
    alignItems: "center",
  },
  reviewEmptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  reviewEmpty: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14, color: FG, textAlign: "center",
  },
  reviewEmptyHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13, color: FG_SUBTLE, textAlign: "center",
    marginTop: 4, lineHeight: 19,
  },

  // Stats strip — inline card, border only, no shadow

  // Booking time-picker buttons (two separate cards, side by side)

  // Extend offer — prominent full-width bar (YourParkingSpace pattern). Ink,
  // not green, so it reads as a distinct upsell and never competes with the
  // green "Book now" primary CTA.
  extendBar: {
    backgroundColor: colors.text,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  extendBarPressed: { opacity: 0.85 },
  extendBarText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14, color: colors.textInverse, letterSpacing: -0.2,
  },
  extendBarPrice: { fontFamily: "PlusJakartaSans-ExtraBold" },
  // Quiet, factual — a helpful fact, not a flashing badge.
  extendBarSaving: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.mint,
  },

  // Sections
  sectionDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: 0,
  },
  // ── Availability — grouped ranges, whitespace not dividers ──
  availCard: {
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.cardSmall,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  availGroup: {},
  availGroupSpacing: { marginTop: 16 },
  availGroupTop: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2,
  },
  availRange: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG, letterSpacing: -0.3,
  },
  availRangeMuted: { color: FG_SUBTLE },
  availHours: {
    fontFamily: "PlusJakartaSans-Medium", fontSize: 14, color: FG_2, letterSpacing: -0.1,
  },
  availHoursClosed: { color: colors.textMuted },
  availTodayChip: {
    backgroundColor: GREEN_SOFT, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  availTodayChipText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 11, color: GREEN_DARK, letterSpacing: 0.2,
  },
  section: { paddingVertical: 20 },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17, lineHeight: 21, color: FG, letterSpacing: -0.3, marginBottom: 8,
  },
  sectionBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, lineHeight: 22, color: FG_BODY },
  gettingThereLine: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, lineHeight: 21, color: FG_2, marginBottom: 2 },

  // Local area map
  localAreaMap: {
    width: "100%",
    height: 180,
    backgroundColor: BG_2,
  },
  localAreaMapWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius.cardSmall,
    backgroundColor: BG_2,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: LINE,
  },
  listingMapMarker: {
    alignItems: "center",
    height: 110,
    justifyContent: "center",
    width: 110,
  },
  listingMapMarkerHalo: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: radius.pill,
    backgroundColor: "rgba(10,128,80,0.14)",
    borderWidth: 1,
    borderColor: "rgba(10,128,80,0.22)",
  },
  listingMapMarkerBubble: {
    alignItems: "center",
    backgroundColor: GREEN,
    borderColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 3,
    height: 38,
    justifyContent: "center",
    shadowColor: "#0B3B29",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 38,
    elevation: 5,
  },
  mapExpandButton: {
    position: "absolute", top: 10, right: 10,
    width: 34, height: 34, borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },

  // Feature chips — pill shape, bg-2 fill, no border (spec .chip pattern)
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featureChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BG_2,
    borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  featureChipIconWrap: {
    alignItems: "center", justifyContent: "center",
  },
  featureChipLabel: {
    fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: FG_BODY,
  },

  // Amenities — 2-column icon list (rebuild)
  amenityGrid: { flexDirection: "row", flexWrap: "wrap" },
  amenityItem: { width: "50%", flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingRight: 8 },
  // Categorised content tile treatment (docs/PARKING_DESIGN_BIBLE.md E4) — a
  // tinted icon wrap + bold label, not a bare icon next to regular text.
  amenityIconWrap: {
    alignItems: "center",
    backgroundColor: GREEN_SOFT,
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  amenityLabel: { flex: 1, fontFamily: "PlusJakartaSans-Bold", fontSize: 14, lineHeight: 18, color: FG_2 },

  // Guarantee strip

  // Reviews
  reviewsHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 0 },
  reviewsLink: { marginLeft: "auto" },
  reviewsLinkText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13,
    color: GREEN,
  },
  reviewTiles: { marginTop: 12, marginHorizontal: -24 },
  reviewTilesContent: { paddingHorizontal: 24, gap: 12 },
  // Soft-fill card, no drawn border — the outline card is the one pattern the
  // rest of the app never uses.
  reviewTile: {
    width: 260,
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.cardSmall,
    padding: 16,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 16,
    backgroundColor: colors.tileBg,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG },
  reviewMetaBlock: { flex: 1, minWidth: 0 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: FG_SUBTLE },
  reviewDateText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: FG_SUBTLE },
  reviewStarPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.cardBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6,
  },
  reviewStarPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG },
  reviewComment: { fontFamily: "PlusJakartaSans-Medium", fontSize: 14, lineHeight: 21, color: FG_BODY },

  // Auth modal — bottom sheet
  authModalRoot: { flex: 1, justifyContent: "flex-end" },
  authModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 17, 17, 0.45)",
  },
  authModalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28,
    shadowColor: "#111111",
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
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 21, lineHeight: 27, letterSpacing: -0.4,
    color: FG, marginBottom: 8,
  },
  authModalTitleAccent: { color: GREEN },
  authModalBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14, lineHeight: 20,
    color: FG_MUTED, marginBottom: 20,
  },
  authModalOutlineBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1, borderColor: LINE,
    height: 50, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 10, paddingHorizontal: 16,
  },
  authModalBtnIcon: { marginRight: 10 },
  authModalOutlineText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15,
    color: FG, letterSpacing: -0.2,
  },
  authModalDivider: {
    flexDirection: "row", alignItems: "center",
    marginTop: 4, marginBottom: 14,
  },
  authModalDividerLine: { flex: 1, height: 1, backgroundColor: LINE },
  authModalDividerText: {
    marginHorizontal: 12,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG_SUBTLE,
  },
  authModalCreateBtn: {
    backgroundColor: GREEN,
    height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0a7a50", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 3,
  },
  authModalCreateText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.textInverse, letterSpacing: -0.2,
  },
  authModalLegal: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12, lineHeight: 17,
    color: FG_SUBTLE, textAlign: "center",
    marginTop: 12, paddingHorizontal: 8,
  },
  authModalLegalLink: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // Bottom dock — fixed, border-top separator, sheet shadow
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.cardBg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
    paddingHorizontal: 16, paddingTop: 12,
    minHeight: 80,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 16,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 8,
  },
  bottomLeft: { flex: 1, justifyContent: "center" },
  // The number is the decision; the word is just context.
  bottomPrice: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 23, color: FG, letterSpacing: -0.5, lineHeight: 28,
  },
  bottomPriceSuffix: {
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13, color: colors.textMuted, letterSpacing: -0.1,
  },
  // Matches the resting height of price + duration so the bar never jumps
  // while a new quote is in flight.
  bottomPriceUpdating: {
    height: 47,
    justifyContent: "center",
  },
  bottomDuration: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED, marginTop: 1 },
  bottomUnavailableHint: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: colors.danger, marginTop: 2 },
  dailyCapBadge: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: GREEN, marginTop: 2 },
  ownListingBadge: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, backgroundColor: BG_2, alignItems: "center" as const, justifyContent: "center" as const },
  ownListingText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG_SUBTLE, letterSpacing: -0.2 },

  // Picker modal — bottom sheet
  pickerBackdropLayer: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pickerSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: "center",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: HANDLE,
    marginBottom: 18,
  },
  pickerTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    fontWeight: "700",
    color: FG,
    textAlign: "center",
    marginBottom: 4,
  },
  pickerDoneBtn: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 16,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    ...primaryButtonShadow,
  },
  pickerDoneBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: colors.textInverse,
    letterSpacing: -0.3,
  },

  // Image / map viewer
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
  viewerCloseText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textInverse },

  // Trust notes (below time picker)
  trustNotes: { gap: 7, marginTop: 10 },
  trustNoteRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  trustNoteText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, flex: 1, lineHeight: 19 },

  // Reserve note — single certainty line (rebuild)
  reserveNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  reserveNoteText: { flex: 1, fontFamily: "PlusJakartaSans-Medium", fontSize: 13, lineHeight: 18, color: FG_2 },

  // ── Host trust block (E10.1) — name + real tenure, no fabricated stats ──
  hostRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hostAvatar: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  hostAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG },
  hostInfo: { flex: 1, minWidth: 0 },
  hostNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  hostName: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG, letterSpacing: -0.2, flexShrink: 1 },
  hostMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, marginTop: 2 },

  // Feature list (replaces pill chips)

  // Review list (divider style)

  // Unused legacy styles (kept for compatibility with any unused JSX branches)
});
