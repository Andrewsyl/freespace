import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
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
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { trackEvent } from "../analytics";
import { DrumRollPicker } from "../components/DrumRollPicker";
import { colors, radius, spacing } from "../styles/theme";
import { getListing, listListingReviews, type ListingReview } from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import type { ListingDetail, RootStackParamList } from "../types";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { formatDateLabel, formatDateTimeLabel, formatReviewDate, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal, formatPriceValue, getListingRateType } from "../utils/pricing";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowDownUp,
  BatteryCharging,
  Bike,
  CarFront,
  Cctv,
  ChevronDown,
  ChevronRight,
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
  Zap,
} from "lucide-react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { SquircleBtn } from "../components/SquircleBtn";
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
};

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
  return <Icon size={size} color="#6b7280" strokeWidth={1.75} />;
};

const AVATAR_BG = ["#CCE9E6", "#FFE4C8", "#D8E4FF", "#FFD6D6", "#D6F5E3"];
const avatarBg = (name: string) => AVATAR_BG[(name.charCodeAt(0) || 0) % AVATAR_BG.length];

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to, booking } = route.params;
  const { user, loginWithOAuth } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

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
  const [pickerOverlayVisible, setPickerOverlayVisible] = useState(false);
  const pickerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const pickerSheetTranslateY = useRef(new Animated.Value(320)).current;
  const pickerClosingRef = useRef(false);
  const [heroTapEnabled, setHeroTapEnabled] = useState(true);
  const heroTapEnabledRef = useRef(true);
  const authBackdropOpacity = useRef(new Animated.Value(0)).current;
  const authSheetTranslateY = useRef(new Animated.Value(320)).current;
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);

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
        if (active) setLoading(false);
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

  const closePicker = () => {
    if (!pickerOverlayVisible || pickerClosingRef.current) {
      setPickerVisible(false);
      setDraftDate(null);
      return;
    }
    pickerClosingRef.current = true;
    setPickerVisible(false);
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(pickerSheetTranslateY, {
        toValue: 320,
        duration: 105,
        useNativeDriver: true,
      }),
    ]).start(() => {
      pickerClosingRef.current = false;
      setPickerOverlayVisible(false);
      setDraftDate(null);
    });
  };

  useEffect(() => {
    if (!pickerVisible) return;
    pickerClosingRef.current = false;
    pickerBackdropOpacity.setValue(0);
    pickerSheetTranslateY.setValue(320);
    setPickerOverlayVisible(true);
  }, [pickerVisible, pickerBackdropOpacity, pickerSheetTranslateY]);

  useEffect(() => {
    if (!pickerOverlayVisible) return;
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(pickerSheetTranslateY, { toValue: 0, tension: 72, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [pickerOverlayVisible, pickerBackdropOpacity, pickerSheetTranslateY]);

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
  const bottomBarSpacer = showBottomBar ? 40 + insets.bottom : 24;

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    setDraftDate(field === "start" ? startAt : endAt);
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

  const imageUrls = useMemo(() => {
    if (listing?.image_urls?.length) return listing.image_urls;
    if (mapsKey)
      return [`https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${streetViewLocation}&fov=65&key=${mapsKey}`];
    return [];
  }, [listing?.image_urls, mapsKey, streetViewLocation]);

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
  const formatHour = (value: string) =>
    new Date(value).toLocaleTimeString("en-IE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/Dublin",
    });
  const weekdayOrder = [
    { label: "Mon", dow: 1 },
    { label: "Tue", dow: 2 },
    { label: "Wed", dow: 3 },
    { label: "Thu", dow: 4 },
    { label: "Fri", dow: 5 },
    { label: "Sat", dow: 6 },
    { label: "Sun", dow: 0 },
  ];
  const todayDow = new Date().getDay();
  const openingHours = weekdayOrder.map(({ label, dow }) => {
    if (hasWeeklyAvailability) {
      const entry = availabilityEntries.find((item) =>
        Array.isArray(item.repeatWeekdays) && item.repeatWeekdays.includes(dow)
      );
      if (entry) return { day: label, hours: `${formatHour(entry.startsAt)} – ${formatHour(entry.endsAt)}`, isToday: dow === todayDow };
      return { day: label, hours: "Unavailable", isToday: dow === todayDow };
    }
    return { day: label, hours: availabilityFallbackText, isToday: dow === todayDow };
  });
  const shouldShowAvailability = hasWeeklyAvailability || Boolean(availabilityFallbackText);

  const hasReviews = (listing?.rating_count ?? 0) > 0 && typeof listing?.rating === "number";
  const isAvailable = listing?.is_available !== false;

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

  const aboutText = useMemo(() => {
    const explicitDescription = listing?.description?.trim();
    if (explicitDescription) return explicitDescription;
    if (!listing) return null;

    const typePhrase = /parking$/i.test(spaceTypeLabel)
      ? spaceTypeLabel
      : `${spaceTypeLabel} parking`;
    const locationText = areaLabel ? ` in ${areaLabel}` : "";
    const availabilityText = availabilityFallbackText
      ? availabilityFallbackText === "24/7"
        ? " Available 24/7."
        : ` Available ${availabilityFallbackText}.`
      : "";
    const includedText = featureLabels.length
      ? ` Includes ${featureLabels.slice(0, 3).join(", ")}.`
      : "";

    return `${typePhrase}${locationText} with clear booking details and secure payment.${availabilityText}${includedText}`;
  }, [areaLabel, availabilityFallbackText, featureLabels, listing, spaceTypeLabel]);

  const heroHeight = Math.round(width * 0.8);
  const heroTapHeight = Math.max(0, heroHeight - 40);

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

  const extendOffer = useMemo(() => {
    if (!listing) return null;
    if (getListingRateType(listing) !== "hourly") return null;
    const hourlyPrice = listing.price_per_hour != null ? Number(listing.price_per_hour) : null;
    if (hourlyPrice == null || Number.isNaN(hourlyPrice)) return null;
    const endOfDay = new Date(endAt);
    endOfDay.setHours(23, 59, 0, 0);
    if (endAt >= endOfDay) return null;
    const ms = Math.max(0, endOfDay.getTime() - endAt.getTime());
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
    const extra = hourlyPrice * hours;
    const discounted = extra * 0.75;
    if (extra - discounted < 1) return null;
    return { hours, extra: Math.round(discounted).toString(), endOfDay };
  }, [listing, endAt]);

  const handleToggleFavorite = async () => {
    if (!listing) return;
    if (!user) { navigation.navigate("Welcome", { returnTo: { screen: "Listing" as const, params: { id, from: startAt.toISOString(), to: endAt.toISOString() } } }); return; }
    const wasFavorite = isFavorite(id);
    await toggle(listing);
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
    setTimeout(() => navigation.navigate(screen, { returnTo }), 180);
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
      <SafeAreaView style={styles.container} edges={["bottom"]}>
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
              <RefreshCw size={16} color="#ffffff" strokeWidth={2.2} />
              <Text style={styles.errorPrimaryText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.errorSecondaryBtn} onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}>
              <Text style={styles.errorSecondaryText}>Back to search</Text>
            </Pressable>
          </View>
        ) : listing ? (
          <>
            {/* Full-bleed hero image */}
            <View style={[styles.heroFixed, { height: heroHeight + insets.top }]}>
              {imageUrls.length ? (
                <Image
                  source={{ uri: imageUrls[0] }}
                  style={{ width, height: heroHeight + insets.top }}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight + insets.top }]}>
                  <CarFront size={52} color="rgba(255,255,255,0.45)" strokeWidth={1.7} />
                </View>
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.28)", "transparent", "rgba(0,0,0,0.72)"]}
                locations={[0, 0.38, 1]}
                style={styles.heroGradient}
              />
              {imageUrls.length > 1 ? (
                <View style={[styles.photoCounter, { position: "absolute", bottom: 72, right: 16, zIndex: 2 }]}>
                  <Text style={styles.photoCounterText}>{imageUrls.length} photos</Text>
                </View>
              ) : null}
              {/* Title overlay */}
              <View style={styles.heroTitleOverlay}>
                <Text style={styles.heroSpaceTypeLabel}>{spaceTypeLabel}</Text>
                <Text style={styles.heroTitleText} numberOfLines={2}>{displayTitle}</Text>
              </View>
            </View>

            {/* Floating glass controls */}
            <View style={[styles.headerOverlay, { top: insets.top + 12 }]}>
              <Pressable style={styles.glassBtn} onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}>
                <ArrowLeft size={19} color="#fff" strokeWidth={2.2} />
              </Pressable>
              <View style={styles.headerRightColumn}>
                <View style={styles.headerRight}>
                  <Pressable style={styles.glassBtn} onPress={handleShare}>
                    <Share2 size={18} color="#fff" strokeWidth={2.1} />
                  </Pressable>
                  <Pressable style={styles.glassBtn} onPress={handleToggleFavorite}>
                    <Heart
                      size={18}
                      color={isFavorite(id) ? "#FF6B6B" : "#fff"}
                      fill={isFavorite(id) ? "#FF6B6B" : "none"}
                      strokeWidth={2.1}
                    />
                  </Pressable>
                </View>
            </View>
            </View>

            {heroTapEnabled ? (
              <Pressable
                style={[styles.heroTapZone, { height: heroTapHeight, top: 0 }]}
                onPress={() => { setViewerIndex(0); setShowImageViewer(true); }}
              />
            ) : null}

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomBarSpacer }}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const nextEnabled = event.nativeEvent.contentOffset.y < Math.max(0, heroTapHeight - 24);
                if (nextEnabled !== heroTapEnabledRef.current) {
                  heroTapEnabledRef.current = nextEnabled;
                  setHeroTapEnabled(nextEnabled);
                }
              }}
            >
              {/* Hero spacer */}
              <View style={{ height: heroHeight + insets.top - 28 }} />

              {/* Content sheet */}
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />


                {/* ── Price + meta ─────────────────────────── */}
                <View style={styles.priceBlock}>
                  <View style={styles.factRows}>
                    <View style={styles.factRow}>
                      <Star size={17} color={FG} fill={FG} strokeWidth={2} style={styles.factIcon} />
                      <Text style={styles.factText} numberOfLines={1}>
                        {hasReviews ? (
                          <>
                            <Text style={styles.factVal}>{listing.rating?.toFixed(1)}</Text>
                            <Text style={styles.factMuted}>{`  ·  ${listing.rating_count ?? reviews.length} ${(listing.rating_count ?? reviews.length) === 1 ? "review" : "reviews"}`}</Text>
                          </>
                        ) : (
                          <Text style={styles.factMuted}>No reviews yet</Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.factRow}>
                      <MapPin size={17} color={GREEN} strokeWidth={2.2} style={styles.factIcon} />
                      <Text style={styles.factLine} numberOfLines={1}>
                        {areaLabel ? <Text style={styles.factVal}>{areaLabel}</Text> : null}
                        {distanceLabel ? <Text style={styles.factMuted}>{`  ·  ${distanceLabel}`}</Text> : null}
                      </Text>
                    </View>
                    <View style={styles.factRowSecondary}>
                      <Clock size={17} color={GREEN} strokeWidth={2.2} style={styles.factIcon} />
                      {availabilityFallbackText ? (
                        <Text style={styles.factVal} numberOfLines={1}>{availabilityFallbackText}</Text>
                      ) : (
                        <Text style={[styles.factVal, { color: isAvailable ? GREEN : colors.danger }]} numberOfLines={1}>
                          {isAvailable ? "Available now" : "Fully booked"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* ── Booking ──────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingHeaderTitle}>Choose your parking time</Text>
                    <Text style={styles.bookingHeaderBody}>
                      Check availability before you book.
                    </Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Pressable style={styles.timeField} onPress={() => openPicker("start")}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>Arriving</Text>
                        <ChevronDown size={14} color="#9ca3af" strokeWidth={2.2} />
                      </View>
                      <Text style={styles.timeFieldTime}>{formatTimeLabel(startAt)}</Text>
                      <Text style={styles.timeFieldDate}>{formatDateLabel(startAt)}</Text>
                    </Pressable>
                    <View style={styles.timeArrow}>
                      <ArrowRight size={14} color="#9ca3af" strokeWidth={2.3} />
                    </View>
                    <Pressable style={styles.timeField} onPress={() => openPicker("end")}>
                      <View style={styles.timeFieldHeader}>
                        <Text style={styles.timeFieldLabel}>Leaving</Text>
                        <ChevronDown size={14} color="#9ca3af" strokeWidth={2.2} />
                      </View>
                      <Text style={styles.timeFieldTime}>{formatTimeLabel(endAt)}</Text>
                      <Text style={styles.timeFieldDate}>{formatDateLabel(endAt)}</Text>
                    </Pressable>
                  </View>
                  {extendOffer ? (
                    <Pressable
                      style={styles.offerRow}
                      onPress={() => setEndAt(new Date(extendOffer.endOfDay))}
                    >
                      <View style={styles.offerIconWrap}>
                        <Zap size={14} color={GREEN} strokeWidth={2.3} />
                      </View>
                      <Text style={styles.offerText}>
                        Extend to end of day for only{" "}
                        <Text style={styles.offerTextBold}>€{extendOffer.extra}</Text>
                      </Text>
                      <ChevronRight size={13} color={GREEN} strokeWidth={2.3} />
                    </Pressable>
                  ) : null}
                  <View style={styles.trustNotes}>
                    {[
                      "Exact location confirmed after booking",
                      "Arrival instructions included with your confirmation",
                    ].map((note) => (
                      <View key={note} style={styles.trustNoteRow}>
                        <CircleCheck size={17} color={GREEN} strokeWidth={2.2} />
                        <Text style={styles.trustNoteText}>{note}</Text>
                      </View>
                    ))}
                  </View>
                </View>

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
                      <Text style={styles.sectionTitle}>What's included</Text>
                      <View style={styles.chipsGrid}>
                        {featureLabels.map((feature) => (
                          <View key={feature} style={styles.featureChip}>
                            <View style={styles.featureChipIconWrap}>
                              <FeatureIcon type={getFeatureIconType(feature)} size={18} />
                            </View>
                            <Text style={styles.featureChipLabel}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ── Location ─────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  {hasCoordinates ? (
                    <View style={styles.localAreaMapWrap}>
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
                        <Marker coordinate={{ latitude, longitude }} tracksViewChanges={false} />
                      </MapView>
                      {!mapReady && (
                        <SkeletonBlock
                          height={168}
                          style={StyleSheet.absoluteFillObject}
                          borderRadius={0}
                          pulse={skeletonPulse}
                        />
                      )}
                      <Pressable style={styles.mapExpandButton} onPress={() => setShowMapViewer(true)}>
                        <Maximize2 size={17} color="#151b1b" strokeWidth={2} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {/* ── Availability ─────────────────────────── */}
                {shouldShowAvailability ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Availability</Text>
                      <View style={styles.availabilityList}>
                        {openingHours.map((entry, index) => {
                          const isClosed = entry.hours === "Unavailable";
                          const isLast = index === openingHours.length - 1;
                          return (
                            <View
                              key={entry.day}
                              style={[
                                styles.availabilityRow,
                                !isLast && !entry.isToday && styles.availabilityRowDivider,
                                entry.isToday && styles.availabilityRowToday,
                              ]}
                            >
                              <View style={styles.availabilityDayCol}>
                                {entry.isToday
                                  ? <View style={styles.availabilityDot} />
                                  : <View style={styles.availabilityDotPlaceholder} />}
                                <Text style={[
                                  styles.availabilityDay,
                                  entry.isToday && styles.availabilityDayToday,
                                  isClosed && styles.availabilityDayClosed,
                                ]}>
                                  {entry.day}
                                </Text>
                              </View>
                              <Text style={[
                                styles.availabilityHours,
                                entry.isToday && styles.availabilityHoursToday,
                                isClosed && styles.availabilityHoursClosed,
                              ]}>
                                {entry.hours}
                              </Text>
                            </View>
                          );
                        })}
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
                    <ActivityIndicator color={GREEN} style={{ marginTop: 12, alignSelf: "flex-start" }} />
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
                              <View style={styles.reviewAvatar}>
                                <Text style={styles.reviewAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
                              </View>
                              <View style={styles.reviewMetaBlock}>
                                <Text style={styles.reviewAuthorName} numberOfLines={1}>{authorName}</Text>
                                <Text style={styles.reviewDateText}>{reviewDate}</Text>
                              </View>
                              <View style={styles.reviewStarPill}>
                                <Star size={11} color="#F4B942" fill="#F4B942" strokeWidth={2} />
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
                      <Text style={styles.reviewEmpty}>No reviews yet.</Text>
                      <Text style={styles.reviewEmptyHint}>Be the first to park here and share your experience.</Text>
                    </View>
                  )}
                </View>

              </View>
            </ScrollView>

            {/* ── Sticky bottom bar ──────────────────────── */}
            {priceSummary ? (
              <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
                <View style={styles.bottomLeft}>
                  <Text style={styles.bottomLabel}>TOTAL</Text>
                  <Text style={styles.bottomPrice}>€{priceSummary.total}</Text>
                  <Text style={styles.bottomDuration}>{priceSummary.durationLabel}</Text>
                  {listing.is_available === false ? (
                    <Text style={styles.bottomUnavailableHint}>Try another arrival time</Text>
                  ) : null}
                  {priceSummary.dailyCapApplied ? (
                    <Text style={styles.dailyCapBadge}>Day rate — saves €{formatPriceValue(priceSummary.dailyCapSaving)}</Text>
                  ) : null}
                </View>
                {listing.hostId && user?.id === listing.hostId ? (
                  <View style={styles.ownListingBadge}>
                    <Text style={styles.ownListingText}>This is your listing</Text>
                  </View>
                ) : showBookingMode ? (
                  <View style={[styles.ownListingBadge, { backgroundColor: "#edf7f2" }]}>
                    <Text style={[styles.ownListingText, { color: "#0a8050" }]}>Already booked</Text>
                  </View>
                ) : (
                  <SquircleBtn
                    label={listing.is_available === false ? "Choose another time" : "Book Now"}
                    loading={navigatingToBooking}
                    onPress={() => {
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

      {/* Date picker modal */}
      <Modal transparent animationType="none" visible={pickerOverlayVisible} onRequestClose={closePicker}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pickerBackdropLayer, { opacity: pickerBackdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          </Animated.View>
          <Animated.View style={[styles.pickerSheet, { paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: pickerSheetTranslateY }] }]}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>
              {pickerField === "start" ? "Select arrival time" : "Select departure time"}
            </Text>
            <DrumRollPicker
              key={pickerField}
              date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
              minuteInterval={5}
              onChange={(d) => setDraftDate(d)}
            />
            <Pressable
              style={styles.pickerDoneBtn}
              hitSlop={6}
              pressRetentionOffset={10}
              onPress={() => {
                const picked = draftDate ?? (pickerField === "start" ? startAt : endAt);
                applyPickedDate(picked);
                closePicker();
              }}
            >
              <Text style={styles.pickerDoneBtnText}>Done</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

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
              <X size={22} color="#9ca3af" strokeWidth={2.2} />
            </Pressable>
            <Text style={styles.authModalTitle}>
              <Text style={styles.authModalTitleAccent}>Log in </Text>
              or create an account.
            </Text>
            <Text style={styles.authModalBody}>
              You&apos;ll need an account to book this space and manage your reservations.
            </Text>
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
        onRequestClose={() => setShowImageViewer(false)}
      >
        <View style={styles.viewerBackdrop}>
          <ImageViewer
            imageUrls={imageUrls.map((url) => ({ url }))}
            index={viewerIndex}
            enableSwipeDown
            onSwipeDown={() => setShowImageViewer(false)}
            onCancel={() => setShowImageViewer(false)}
            onClick={() => setShowImageViewer(false)}
            onChange={(i) => setViewerIndex(i ?? 0)}
            renderIndicator={() => <View />}
            renderHeader={() => (
              <Pressable
                style={[styles.viewerClose, { top: insets.top + 12 }]}
                onPress={() => setShowImageViewer(false)}
              >
                <Text style={styles.viewerCloseText}>Close</Text>
              </Pressable>
            )}
          />
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
              <Marker coordinate={{ latitude: latitude!, longitude: longitude! }} tracksViewChanges={false} />
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
const GREEN      = "#0a8050";
const GREEN_SOFT = "#edf7f2";
const FG         = "#111827";
const FG_2       = "#374151";
const FG_MUTED   = FG_2;        // alias — was a duplicate of FG_2 (#374151)
const FG_SUBTLE  = "#4b5563";
const LINE       = "#C4CCD5";   // card / control borders
const LINE_2     = LINE;        // alias — was a duplicate of LINE
const DIVIDER    = "#EBEBEB";   // section + row separators
const BG_2       = "#F7F7F6";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
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
    borderRadius: 14,
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
    color: "#ffffff",
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
  skeletonWrap: { flex: 1, backgroundColor: "#ffffff" },
  skeletonBackRow: { position: "absolute", left: 16 },
  skeletonContent: { paddingHorizontal: spacing.screenX, paddingTop: 20 },
  skeletonStatsRow: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF2",
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
  photoCounter: {
    backgroundColor: "rgba(0,0,0,0.44)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-end",
  },
  photoCounterText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: "#fff", letterSpacing: 0.5 },

  // Hero title overlay
  heroTitleOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  heroSpaceTypeLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.88)",
    marginBottom: 4,
  },
  heroTitleText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: "#ffffff",
    marginBottom: 6,
  },

  // Floating controls
  headerOverlay: {
    position: "absolute", left: 16, right: 16, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  headerRightColumn: { alignItems: "flex-end", gap: 10 },
  headerRight: { flexDirection: "row", gap: 10 },
  glassBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  heroTapZone: { position: "absolute", left: 0, right: 0, zIndex: 1 },

  scroll: { flex: 1 },

  // Sheet — floating surface, gets the sheet shadow
  sheet: {
    backgroundColor: "#ffffff",
    position: "relative",
    zIndex: 3,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12, paddingBottom: 20,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: "#D9DCE0",
    alignSelf: "center", marginBottom: 12,
  },

  // Title block


  // ── Price + meta block ─────────────────────────────────────────────────────
  priceBlock: {
    paddingTop: 6,
    paddingBottom: 16,
    gap: 4,
  },

  // kept for any remaining references
  factRows: { gap: 8, paddingBottom: 2 },
  factRow:   { flexDirection: "row", alignItems: "center", gap: 7 },
  factRowSecondary: { flexDirection: "row", alignItems: "center", gap: 7 },
  factLine: { flex: 1, minWidth: 0 },
  factIcon: { width: 17, textAlign: "center" },
  factText: { flex: 1, fontSize: 13 },
  factVal:  { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  factMuted:{ fontFamily: "PlusJakartaSans-Regular",  fontSize: 13, color: FG_SUBTLE },

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
    backgroundColor: "#eef2f5",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  timeFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeFieldLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    // Darker than GREEN so the 10px uppercase label clears WCAG AA (4.5:1) on the
    // light grey field background.
    fontSize: 10, color: "#0a6a40",
    textTransform: "uppercase", letterSpacing: 1,
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
    textDecorationLine: "underline",
  },

  // ── Reviews: empty state ───────────────────────────────────────────────────
  reviewEmptyWrap: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: BG_2,
    borderRadius: 14,
    marginTop: 8,
    alignItems: "center",
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

  // Extend offer — standalone card below pickers
  offerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: GREEN_SOFT,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14,
  },
  offerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  offerText: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG, lineHeight: 19 },
  offerTextBold: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // Sections
  sectionDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginHorizontal: 0,
  },
  availabilityList: { marginTop: 0 },
  availabilityRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6,
  },
  availabilityRowDivider: {
    borderBottomWidth: 1, borderBottomColor: DIVIDER,
  },
  availabilityRowToday: {
    backgroundColor: GREEN_SOFT, borderRadius: 8,
    paddingHorizontal: 8, marginHorizontal: -8,
  },
  availabilityHoursToday: { color: GREEN, fontFamily: "PlusJakartaSans-SemiBold" },
  availabilityDayCol: {
    flexDirection: "row", alignItems: "center",
    width: 52, gap: 6,
  },
  availabilityDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: GREEN,
  },
  availabilityDotPlaceholder: { width: 5 },
  availabilityDay: {
    fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: FG_MUTED,
  },
  availabilityDayToday: { color: GREEN, fontFamily: "PlusJakartaSans-Bold" },
  availabilityDayClosed: { color: FG_SUBTLE },
  availabilityHours: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13,
    color: FG_2, flex: 1, textAlign: "right",
  },
  availabilityHoursClosed: { color: FG_SUBTLE },
  section: { paddingVertical: 20 },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17, lineHeight: 21, color: FG, letterSpacing: -0.3, marginBottom: 8,
  },
  sectionBody: { fontFamily: "PlusJakartaSans-Medium", fontSize: 14, lineHeight: 22, color: "#334155" },

  // Local area map
  localAreaMap: {
    width: "100%",
    height: 130,
    backgroundColor: BG_2,
  },
  localAreaMapWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: BG_2,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#dde3e7",
  },
  mapExpandButton: {
    position: "absolute", top: 10, right: 10,
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1, borderColor: "#dde3e7",
    alignItems: "center", justifyContent: "center",
  },

  // Feature chips — pill shape, bg-2 fill, no border (spec .chip pattern)
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featureChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BG_2,
    borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  featureChipIconWrap: {
    alignItems: "center", justifyContent: "center",
  },
  featureChipLabel: {
    fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: "#1e293b",
  },

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
  reviewTile: {
    width: 260,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE_2,
    padding: 16,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EDF7F2",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#0a8050" },
  reviewMetaBlock: { flex: 1, minWidth: 0 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: FG_SUBTLE },
  reviewDateText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: FG_SUBTLE },
  reviewStarPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: BG_2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  reviewStarPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG },
  reviewComment: { fontFamily: "PlusJakartaSans-Medium", fontSize: 14, lineHeight: 21, color: "#334155" },

  // Auth modal — bottom sheet
  authModalRoot: { flex: 1, justifyContent: "flex-end" },
  authModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 17, 17, 0.45)",
  },
  authModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 16,
  },
  authModalHandle: {
    alignSelf: "center",
    width: 40, height: 5, borderRadius: 999,
    backgroundColor: "#E5E7EB",
    marginBottom: 16,
  },
  authModalClose: {
    position: "absolute", top: 14, right: 14,
    width: 32, height: 32, borderRadius: 16,
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
    backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: LINE,
    height: 50, borderRadius: 12,
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
    height: 50, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0a7a50", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 3,
  },
  authModalCreateText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: "#ffffff", letterSpacing: -0.2,
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
    backgroundColor: "#ffffff",
    borderTopWidth: 1, borderTopColor: LINE,
    paddingHorizontal: 16, paddingTop: 12,
    minHeight: 80,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 16,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 8,
  },
  bottomLeft: { flex: 1, justifyContent: "center" },
  bottomLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11, color: FG_SUBTLE,
    letterSpacing: 0.7, marginBottom: 2,
    textTransform: "uppercase",
  },
  bottomPrice: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24, color: FG, letterSpacing: -0.5, lineHeight: 29,
  },
  bottomDuration: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED, marginTop: 1 },
  bottomUnavailableHint: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: colors.danger, marginTop: 2 },
  dailyCapBadge: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: GREEN, marginTop: 2 },
  ownListingBadge: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: "#f0f0f0", alignItems: "center" as const, justifyContent: "center" as const },
  ownListingText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: "#666", letterSpacing: -0.2 },

  // Picker modal — bottom sheet
  pickerBackdropLayer: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
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
    backgroundColor: "#0a8050",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  pickerDoneBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },

  // Image / map viewer
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.97)" },
  mapViewerScreen: { flex: 1, backgroundColor: "#fff" },
  mapViewerClose: { backgroundColor: "rgba(17,17,17,0.74)" },
  viewerClose: {
    position: "absolute", right: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999,
  },
  viewerCloseText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: "#fff" },

  // Trust notes (below time picker)
  trustNotes: { gap: 7, marginTop: 10 },
  trustNoteRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  trustNoteText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_SUBTLE, flex: 1, lineHeight: 19 },

  // Feature list (replaces pill chips)

  // Review list (divider style)

  // Unused legacy styles (kept for compatibility with any unused JSX branches)
});
