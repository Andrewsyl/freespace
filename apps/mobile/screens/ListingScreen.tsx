import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { formatDateLabel, formatDateTimeLabel, formatReviewDate, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal, getListingRateType } from "../utils/pricing";
import { ArrowDownUp, Cctv, EvCharger, Home, Fence, IdCard, KeyRound } from "lucide-react-native";
import { SkeletonBlock, usePulse } from "../components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const FEATURE_ICON_URL: Record<string, string> = {
  cctv:     "https://img.icons8.com/ios/96/security-camera.png",
  ev:       "https://img.icons8.com/ios/96/lightning-bolt.png",
  sheltered:"https://img.icons8.com/ios/96/garage.png",
  lit:      "https://img.icons8.com/ios/96/light-on.png",
  gated:    "https://img.icons8.com/ios/96/road-closure.png",
  low:      "https://img.icons8.com/ios/96/height.png",
  permit:   "https://img.icons8.com/ios/96/key.png",
  code:     "https://img.icons8.com/ios/96/lock.png",
  disabled: "https://img.icons8.com/ios/96/wheelchair.png",
  allday:   "https://img.icons8.com/ios/96/time.png",
  motorbike:"https://img.icons8.com/ios/96/scooter.png",
  wide:     "https://img.icons8.com/ios/96/expand.png",
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

const getAddressWithoutHouseNumber = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return address;
  const firstPart = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [firstPart || parts[0], ...parts.slice(1)].join(", ");
};

const FeatureIcon = ({ type, size = 22 }: { type: string; size?: number }) => {
  if (type === "cctv") return <Cctv size={size} color="#6b7280" strokeWidth={1.75} />;
  const url = FEATURE_ICON_URL[type] ?? FEATURE_ICON_URL.sheltered;
  return <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="contain" />;
};

const AVATAR_BG = ["#CCE9E6", "#FFE4C8", "#D8E4FF", "#FFD6D6", "#D6F5E3"];
const avatarBg = (name: string) => AVATAR_BG[(name.charCodeAt(0) || 0) % AVATAR_BG.length];

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to, booking } = route.params;
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skeletonPulse = usePulse();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showMapViewer, setShowMapViewer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    const isPostcode = (s: string) => /^(Dublin\s*\d+|[A-Z]\d{2}\s*[A-Z0-9]{4})$/i.test(s);
    // Strip postcode from the end
    const trimmed = [...parts];
    while (trimmed.length > 1 && isPostcode(trimmed[trimmed.length - 1])) trimmed.pop();
    // Strip house number from the first segment
    const first = trimmed[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    return [first || trimmed[0], ...trimmed.slice(1)].join(", ");
  })();

  const isBookingTimes =
    booking &&
    startAt.toISOString() === booking.startTime &&
    endAt.toISOString() === booking.endTime;
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
        if (isIdChange) {
          void trackEvent("mobile_listing_viewed", { listingId: id, title: data.title });
        }
      } catch (err) {
        if (!active) return;
        if (isIdChange) setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id, startAt, endAt]);

  useEffect(() => {
    setStartAt(new Date(from));
    setEndAt(new Date(to));
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
    if (pickerVisible) {
      pickerBackdropOpacity.setValue(0);
      pickerSheetTranslateY.setValue(320);
      setPickerOverlayVisible(true);
    } else {
      Animated.parallel([
        Animated.timing(pickerBackdropOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(pickerSheetTranslateY, { toValue: 320, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setPickerOverlayVisible(false); });
    }
  }, [pickerVisible, pickerBackdropOpacity, pickerSheetTranslateY]);

  useEffect(() => {
    if (!pickerOverlayVisible) return;
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(pickerSheetTranslateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
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
      // Always push "until" to 2 h after the new "from" time.
      const bumped = new Date(next);
      bumped.setHours(bumped.getHours() + 2);
      setEndAt(bumped);
      return bumped;
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
    () => amenities.map((v) => {
      if (!v) return v;
      if (v.toLowerCase() === "cctv") return "CCTV";
      return v.charAt(0).toUpperCase() + v.slice(1);
    }),
    [amenities]
  );

  const aboutText = listing?.description?.trim() || null;

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
    new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
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
      return { day: label, hours: "Closed", isToday: dow === todayDow };
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

  const heroHeight = Math.round(width * 0.8);
  const heroTapHeight = Math.max(0, heroHeight - 40);

  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : "0.8 km";
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
    try {
      await Share.share({ message: `${listing.title}${listing.address ? ` · ${listing.address}` : ""}` });
    } catch { /* ignore share cancellations */ }
  };

  const handleOpenMaps = () => {
    Alert.alert("Open Google Maps", "Open directions to this space?", [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => Linking.openURL(mapsUrl) },
    ]);
  };

  const handleOpenStreetView = () => {
    void Linking.openURL(streetViewUrl);
  };

  const closeAuthOverlay = () => {
    setShowAuthModal(false);
  };

  const openAuthScreen = (screen: "Welcome" | "SignIn" | "Register") => {
    closeAuthOverlay();
    const returnTo = { screen: "Listing" as const, params: { id, from: startAt.toISOString(), to: endAt.toISOString() } };
    setTimeout(() => navigation.navigate(screen, { returnTo }), 180);
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
            <Text style={styles.errorText}>{error}</Text>
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
                  <Ionicons name="car-outline" size={52} color="rgba(255,255,255,0.45)" />
                </View>
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.28)", "transparent", "rgba(0,0,0,0.72)"]}
                locations={[0, 0.38, 1]}
                style={styles.heroGradient}
              />
              {/* Title overlay */}
              <View style={styles.heroTitleOverlay}>
                <Text style={styles.heroSpaceTypeLabel}>{spaceTypeLabel}</Text>
                <Text style={styles.heroTitleText} numberOfLines={2}>{displayTitle}</Text>
                {areaLabel ? (
                  <View style={styles.heroAreaRow}>
                    <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroAreaText} numberOfLines={1}>{areaLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Floating glass controls */}
            <View style={[styles.headerOverlay, { top: insets.top + 12 }]}>
              <Pressable style={styles.glassBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={19} color="#fff" />
              </Pressable>
              <View style={styles.headerRightColumn}>
                <View style={styles.headerRight}>
                  <Pressable style={styles.glassBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={18} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.glassBtn} onPress={handleToggleFavorite}>
                    <Ionicons
                      name={isFavorite(id) ? "heart" : "heart-outline"}
                      size={18}
                      color={isFavorite(id) ? "#FF6B6B" : "#fff"}
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

                <View style={styles.statsStrip}>
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>PRICE</Text>
                    <Text style={styles.statsCellValue}>
                      €{priceSummary?.total ?? "—"}
                      {priceSummary ? <Text style={styles.statsCellSub}> · {priceSummary.durationLabel}</Text> : null}
                    </Text>
                  </View>
                  <View style={styles.statsVDivider} />
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>RATING</Text>
                    {hasReviews ? (
                      <Text style={styles.statsCellValue}>★ {listing.rating?.toFixed(1)}</Text>
                    ) : (
                      <>
                        <Text style={styles.statsCellValue}>★ 0.0</Text>
                        <Text style={styles.statsCellSub}>New</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.statsVDivider} />
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>DISTANCE</Text>
                    <Text style={styles.statsCellValue}>{distanceLabel}</Text>
                  </View>
                </View>

                {/* ── Booking time boxes ───────────────────── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Choose your time</Text>
                  <View style={styles.timePickerRow}>
                    <Pressable style={styles.timePickerBtn} onPress={() => openPicker("start")}>
                      <View>
                        <Text style={styles.timePickerBtnLabel}>From</Text>
                        <Text style={styles.timePickerBtnValue}>{formatDateTimeLabel(startAt)}</Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                    </Pressable>
                    <Pressable style={styles.timePickerBtn} onPress={() => openPicker("end")}>
                      <View>
                        <Text style={styles.timePickerBtnLabel}>Until</Text>
                        <Text style={styles.timePickerBtnValue}>{formatDateTimeLabel(endAt)}</Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                    </Pressable>
                  </View>

                  {extendOffer ? (
                    <Pressable
                      style={styles.offerRow}
                      onPress={() => setEndAt(new Date(extendOffer.endOfDay))}
                    >
                      <View style={styles.offerIconWrap}>
                        <Ionicons name="flash" size={15} color="#0a8050" />
                      </View>
                      <Text style={styles.offerText}>
                        Extend to end of day for only{" "}
                        <Text style={styles.offerTextBold}>€{extendOffer.extra}</Text>
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color="#0a8050" />
                    </Pressable>
                  ) : null}
                  <View style={styles.trustNotes}>
                    {[
                      "Exact location confirmed after booking",
                      "Arrival instructions included with your confirmation",
                    ].map((note) => (
                      <View key={note} style={styles.trustNoteRow}>
                        <View style={styles.trustNoteCheck}>
                          <Ionicons name="checkmark" size={10} color={GREEN} />
                        </View>
                        <Text style={styles.trustNoteText}>{note}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── About ────────────────────────────────── */}
                {aboutText ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <Pressable
                      style={styles.section}
                      onPress={() => { if (aboutText.length > 140) setShowFullAbout((p) => !p); }}
                    >
                      <Text style={styles.sectionTitle}>About this space</Text>
                      <Text style={styles.sectionBody} numberOfLines={showFullAbout ? undefined : 3}>
                        {aboutText}
                      </Text>
                      {aboutText.length > 140 && (
                        <Text style={styles.readMore}>{showFullAbout ? "View less" : "View full description"}</Text>
                      )}
                    </Pressable>
                  </>
                ) : null}

                {/* ── Features (horizontal scroll chips) ───── */}
                {featureLabels.length > 0 && (
                <View style={styles.sectionDivider} />
                )}
                {featureLabels.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Features</Text>
                  <View style={styles.chipsGrid}>
                    {featureLabels.map((feature) => (
                      <View key={feature} style={styles.featureChip}>
                        <View style={styles.featureChipIconWrap}>
                          <FeatureIcon type={getFeatureIconType(feature)} size={22} />
                        </View>
                        <View>
                          <Text style={styles.featureChipLabel}>{feature}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                )}

                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <View style={styles.localAreaCard}>
                    {hasCoordinates ? (
                      <View style={styles.localAreaMapWrap}>
                        <MapView
                          style={styles.localAreaMap}
                          provider={PROVIDER_GOOGLE}
                          cacheEnabled={Platform.OS !== "android"}
                          loadingEnabled
                          loadingBackgroundColor="#F9FAFB"
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
                        >
                          <Marker
                            coordinate={{ latitude, longitude }}
                            tracksViewChanges={false}
                          />
                        </MapView>
                        <Pressable style={styles.mapExpandButton} onPress={() => setShowMapViewer(true)}>
                          <Ionicons name="expand-outline" size={18} color="#151b1b" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* ── Availability ─────────────────────────── */}
                {shouldShowAvailability ? (
                  <>
                    <View style={styles.sectionDivider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Availability</Text>
                      <View style={styles.availabilityList}>
                        {openingHours.map((entry, index) => {
                          const isClosed = entry.hours === "Closed";
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
                          All ({listing.rating_count ?? reviews.length})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {reviewsLoading ? (
                    <ActivityIndicator color="#0a8050" style={{ marginTop: 12, alignSelf: "flex-start" }} />
                  ) : reviews.length ? (
                    <View style={{ marginTop: 4 }}>
                      {reviews.slice(0, 4).map((review, index) => {
                        const authorName =
                          (review as { author_name?: string }).author_name ??
                          review.authorName ?? "Guest";
                        const reviewDate = formatReviewDate(
                          new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                        );
                        return (
                          <View
                            key={review.id}
                            style={[
                              styles.reviewListItem,
                              index === Math.min(reviews.length, 4) - 1 && styles.reviewListItemLast,
                            ]}
                          >
                            <View style={styles.reviewListTop}>
                              <View style={styles.reviewStarRow}>
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Ionicons
                                    key={i}
                                    name={i < Math.round(review.rating) ? "star" : "star-outline"}
                                    size={12}
                                    color={i < Math.round(review.rating) ? "#F4B942" : "#e2e8f0"}
                                  />
                                ))}
                              </View>
                              <Text style={styles.reviewDateText}>{reviewDate}</Text>
                            </View>
                            {review.comment ? (
                              <Text style={styles.reviewComment}>{review.comment}</Text>
                            ) : null}
                            <Text style={styles.reviewAuthorName}>{authorName}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptyReviewCard}>
                      <View style={styles.emptyReviewIconWrap}>
                        <Ionicons name="information-circle-outline" size={18} color={GREEN} />
                      </View>
                      <View style={styles.emptyReviewCopy}>
                        <Text style={styles.emptyReviewTitle}>No reviews yet</Text>
                        <Text style={styles.emptyReviewBody}>Be the first driver to book this space and share how it went.</Text>
                      </View>
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
                </View>
                {listing.is_available === false || showBookingMode ? (
                  <View style={[styles.reserveBtn, styles.reserveBtnDisabled]}>
                    <Text style={styles.reserveBtnDisabledText}>Unavailable</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.reserveBtn}
                    onPress={() => {
                      if (!user) {
                        setShowAuthModal(true);
                        return;
                      }
                      if (navigatingToBooking) return;
                      setNavigatingToBooking(true);
                      navigation.navigate("BookingSummary", {
                        id,
                        from: startAt.toISOString(),
                        to: endAt.toISOString(),
                      });
                      setTimeout(() => setNavigatingToBooking(false), 800);
                    }}
                  >
                    <Text style={styles.reserveBtnText}>
                      {navigatingToBooking ? "Opening…" : "Book Now"}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </SafeAreaView>

      {/* Date picker modal */}
      <Modal transparent animationType="none" visible={pickerOverlayVisible} onRequestClose={() => { setPickerVisible(false); setDraftDate(null); }}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pickerBackdropLayer, { opacity: pickerBackdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setPickerVisible(false); setDraftDate(null); }} />
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
              onPress={() => {
                const picked = draftDate ?? (pickerField === "start" ? startAt : endAt);
                applyPickedDate(picked);
                setPickerVisible(false);
                setDraftDate(null);
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
            <Text style={styles.authModalTitle}>Sign in to book</Text>
            <Text style={styles.authModalBody}>Choose how you want to continue.</Text>
            <Pressable
              style={styles.authModalPrimary}
              onPress={() => {
                openAuthScreen("Welcome");
              }}
            >
              <Text style={styles.authModalPrimaryText}>Continue with Google</Text>
            </Pressable>
            <Pressable
              style={styles.authModalSecondary}
              onPress={() => {
                openAuthScreen("SignIn");
              }}
            >
              <Text style={styles.authModalSecondaryText}>Log in with email or phone number</Text>
            </Pressable>
            <Pressable
              style={styles.authModalLink}
              onPress={() => {
                openAuthScreen("Register");
              }}
            >
              <Text style={styles.authModalLinkText}>Create account</Text>
            </Pressable>
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
const FG_MUTED   = "#374151";
const FG_SUBTLE  = "#6b7280";
const LINE       = "#C4CCD5";
const LINE_2     = "#C4CCD5";
const BG_2       = "#F7F7F6";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  errorText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: colors.danger,
    textAlign: "center", paddingHorizontal: 24,
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
    color: "rgba(255,255,255,0.7)",
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
  heroAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroAreaText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    flex: 1,
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
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: spacing.screenX,
    paddingTop: 8, paddingBottom: 16,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: LINE,
    alignSelf: "center", marginBottom: 12,
  },

  // Title block
  titleBlock: { paddingBottom: 14 },
  titleText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 25, lineHeight: 30, letterSpacing: -0.5,
    color: FG, marginBottom: 8,
  },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  starPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  starPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  starPillCount: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: LINE_2 },
  availPulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN, marginRight: 4 },
  availPulseDotOff: { backgroundColor: colors.danger },
  availText: { fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: GREEN },
  availTextOff: { color: colors.danger },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addressText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED, flex: 1, flexShrink: 1 },
  addressSep: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: LINE_2, flexShrink: 0 },
  distanceText: { fontFamily: "PlusJakartaSans-Medium", fontSize: 13, color: FG_MUTED, flexShrink: 0 },

  // Stats strip — inline card, border only, no shadow
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    overflow: "hidden",
    marginBottom: 4,
    marginTop: 4,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  statsCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", gap: 2 },
  statsCellLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 9,
    color: FG_SUBTLE, letterSpacing: 1.4, textTransform: "uppercase",
  },
  statsCellValue: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14,
    color: FG, letterSpacing: -0.3,
  },
  statsVDivider: { width: 1, backgroundColor: LINE, marginVertical: 8 },

  // Booking time-picker buttons (two separate cards, side by side)
  timePickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  timePickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  timePickerBtnLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: GREEN,
    marginBottom: 3,
  },
  timePickerBtnValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: "#0f172a",
  },

  // Extend offer — standalone card below pickers
  offerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: GREEN_SOFT,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 12,
  },
  offerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  offerText: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG, lineHeight: 19 },
  offerTextBold: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // Sections
  sectionDivider: { height: 1, backgroundColor: LINE, marginHorizontal: -spacing.screenX, opacity: 1 },
  availabilityList: { marginTop: 0 },
  availabilityRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6,
  },
  availabilityRowDivider: {
    borderBottomWidth: 1, borderBottomColor: LINE,
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
  section: { paddingTop: 20, paddingBottom: 18 },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18, lineHeight: 22, color: FG, letterSpacing: -0.5, marginBottom: 10,
  },
  statsCellSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 9,
    color: FG_SUBTLE, marginTop: 0,
  },
  sectionBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 26, color: "#475569" },
  readMore: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG, marginTop: 10 },

  // Local area map
  localAreaCard: { backgroundColor: "transparent", padding: 0, gap: 14 },
  localAreaHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  localAreaHeaderTextWrap: { flex: 1 },
  localAreaAddress: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, lineHeight: 21,
    color: FG, letterSpacing: -0.1,
  },
  localAreaSub: {
    marginTop: 4, fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13, lineHeight: 18, color: FG_MUTED,
  },
  localAreaMap: {
    width: "100%",
    height: 168,
    backgroundColor: BG_2,
  },
  localAreaMapWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: BG_2,
    marginTop: 2,
    marginHorizontal: 2,
  },
  mapExpandButton: {
    position: "absolute", top: 10, right: 10,
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1, borderColor: LINE,
    alignItems: "center", justifyContent: "center",
  },
  localAreaButtons: { flexDirection: "row", gap: 10 },
  localAreaButtonSecondary: {
    flex: 1, minHeight: 40, borderRadius: 8,
    backgroundColor: BG_2,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
  },
  localAreaButtonSecondaryText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG,
  },

  // Feature chips — pill shape, bg-2 fill, no border (spec .chip pattern)
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featureChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BG_2,
    borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  featureChipIconWrap: {
    alignItems: "center", justifyContent: "center",
  },
  featureChipLabel: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: "#1e293b",
  },

  // Guarantee strip
  guaranteeStrip: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ffffff",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4,
    borderWidth: 1, borderColor: LINE,
  },
  guaranteeIconTile: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: BG_2,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  guaranteeCopy: { flex: 1 },
  guaranteeTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG, letterSpacing: -0.1 },
  guaranteeSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED, marginTop: 2 },

  // Reviews
  reviewsHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 0 },
  reviewsLink: { marginLeft: "auto" },
  reviewsLinkText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13,
    color: GREEN,
  },
  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: BG_2, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5,
  },
  ratingPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG },
  ratingPillCount: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: FG_MUTED },
  reviewList: { gap: 12, marginTop: 12 },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12, borderWidth: 1, borderColor: LINE_2, padding: 16,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG },
  reviewMetaBlock: { flex: 1 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-Medium", fontSize: 12, color: FG_SUBTLE },
  reviewDateText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: FG_SUBTLE },
  reviewStarPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: BG_2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  reviewStarPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG },
  reviewComment: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 21, color: "#475569", marginBottom: 6 },
  emptyReviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 10,
    backgroundColor: BG_2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyReviewIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyReviewCopy: { flex: 1 },
  emptyReviewTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    marginBottom: 3,
  },
  emptyReviewBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: FG_MUTED,
  },

  // Auth modal — bottom sheet
  authModalRoot: { flex: 1, justifyContent: "flex-end" },
  authModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 17, 17, 0.45)",
  },
  authModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28,
    borderWidth: 1, borderColor: LINE_2, borderBottomWidth: 0,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 16,
  },
  authModalTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20, lineHeight: 25, letterSpacing: -0.2,
    color: FG, marginBottom: 6,
  },
  authModalBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, lineHeight: 22,
    color: FG_MUTED, marginBottom: 20,
  },
  authModalPrimary: {
    backgroundColor: GREEN,
    minHeight: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  authModalPrimaryText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: "#ffffff",
  },
  authModalSecondary: {
    backgroundColor: BG_2,
    borderWidth: 1, borderColor: LINE,
    minHeight: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginBottom: 10, paddingHorizontal: 16,
  },
  authModalSecondaryText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15,
    color: FG, textAlign: "center",
  },
  authModalLink: { alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  authModalLinkText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN },

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
  reserveBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 13, paddingHorizontal: 24, minWidth: 140,
    alignItems: "center", justifyContent: "center",
  },
  reserveBtnDisabled: { backgroundColor: LINE },
  reserveBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: "#ffffff", letterSpacing: -0.1 },
  reserveBtnDisabledText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: FG_MUTED },

  // Picker modal — bottom sheet
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
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
    backgroundColor: GREEN,
    borderRadius: 14,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerDoneBtnText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
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
  trustNotes: { gap: 6, marginTop: 10 },
  trustNoteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  trustNoteCheck: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: GREEN_SOFT,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  trustNoteText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED, flex: 1, lineHeight: 18 },

  // Feature list (replaces pill chips)
  featureListItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  featureListItemLast: { borderBottomWidth: 0 },
  featureListIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: GREEN_SOFT,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  featureListLabel: { fontFamily: "PlusJakartaSans-Medium", fontSize: 15, color: "#1e293b" },

  // Review list (divider style)
  reviewListItem: {
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  reviewListItemLast: { borderBottomWidth: 0 },
  reviewListTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  reviewStarRow: { flexDirection: "row", alignItems: "center", gap: 2 },

  // Unused legacy styles (kept for compatibility with any unused JSX branches)
  airSummaryHeaderRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 4, marginBottom: 14 },
  airSummaryThumb: { width: 84, height: 84, borderRadius: 42, backgroundColor: BG_2 },
  taxiSummaryAvatarPlaceholder: { justifyContent: "center", alignItems: "center" },
  airSummaryHeaderContent: { flex: 1, minWidth: 0 },
  airSummaryTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 24, lineHeight: 29, color: FG, marginBottom: 4 },
  airSummarySub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19, color: FG_MUTED },
  airSummaryStars: { flexDirection: "row", alignItems: "center", gap: 2 },
  airReviewSummaryLine: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  airReviewSummarySecondary: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: FG_MUTED },
  airStatsPills: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  airStatPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: LINE, backgroundColor: BG_2,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  airStatPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG_2 },
  typePill: { alignSelf: "flex-start", backgroundColor: GREEN_SOFT, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10 },
  typePillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: GREEN, letterSpacing: 0.5 },
});
