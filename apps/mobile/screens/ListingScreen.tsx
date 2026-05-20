import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import DatePicker from "react-native-date-picker";
import { colors, radius, spacing } from "../styles/theme";
import { getListing, listListingReviews, type ListingReview } from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import type { ListingDetail, RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeLabel, formatReviewDate } from "../utils/dateFormat";
import { calculateListingTotal, getListingRateType } from "../utils/pricing";
import { ArrowDownUp, Cctv, EvCharger, Home, Fence, IdCard, KeyRound } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const getFeatureIconType = (label: string) => {
  const n = label.toLowerCase();
  if (n.includes("low") || n.includes("clearance")) return "low";
  if (n.includes("permit")) return "permit";
  if (n.includes("ev") || n.includes("charger") || n.includes("charging")) return "ev";
  if (n.includes("cctv") || n.includes("camera")) return "cctv";
  if (n.includes("light")) return "cctv";
  if (n.includes("shelter") || n.includes("covered") || n.includes("roof")) return "sheltered";
  if (n.includes("gate") || n.includes("gated") || n.includes("barrier")) return "gated";
  if (n.includes("code") || n.includes("keypad") || n.includes("entry")) return "code";
  return "sheltered";
};

const getAddressWithoutHouseNumber = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return address;
  const firstPart = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  return [firstPart || parts[0], ...parts.slice(1)].join(", ");
};

const FeatureIcon = ({ type, size = 18 }: { type: string; size?: number }) => {
  const col = colors.text;
  const sw = 1.7;
  switch (type) {
    case "low": return <ArrowDownUp size={size} color={col} strokeWidth={sw} />;
    case "cctv": return <Cctv size={size} color={col} strokeWidth={sw} />;
    case "permit": return <IdCard size={size} color={col} strokeWidth={sw} />;
    case "ev": return <EvCharger size={size} color={col} strokeWidth={sw} />;
    case "gated": return <Fence size={size} color={col} strokeWidth={sw} />;
    case "code": return <KeyRound size={size} color={col} strokeWidth={sw} />;
    default: return <Home size={size} color={col} strokeWidth={sw} />;
  }
};

const AVATAR_BG = ["#CCE9E6", "#FFE4C8", "#D8E4FF", "#FFD6D6", "#D6F5E3"];
const avatarBg = (name: string) => AVATAR_BG[(name.charCodeAt(0) || 0) % AVATAR_BG.length];

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to, booking } = route.params;
  const { login, register, loading: authLoading, user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showMapViewer, setShowMapViewer] = useState(false);
  const [showFavAnim, setShowFavAnim] = useState(false);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [navigatingToBooking, setNavigatingToBooking] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);

  const streetViewLocation =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : "53.3498,-6.2603";
  const areaLabel = listing?.address ? getAddressWithoutHouseNumber(listing.address) : "";

  const isBookingTimes =
    booking &&
    startAt.toISOString() === booking.startTime &&
    endAt.toISOString() === booking.endTime;
  const showBookingMode = booking && isBookingTimes;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getListing(id, { from: startAt.toISOString(), to: endAt.toISOString() });
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, startAt, endAt]);

  useEffect(() => {
    setStartAt(new Date(from));
    setEndAt(new Date(to));
  }, [from, to]);

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

  const showBottomBar = !!(priceSummary && user);
  const bottomBarSpacer = showBottomBar ? 48 + insets.bottom : 24;

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    setDraftDate(field === "start" ? startAt : endAt);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      let nextEnd = endAt;
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        nextEnd = bumped;
        setEndAt(bumped);
      }
      setStartAt(next);
      return nextEnd;
    }
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
  const featureRows = amenities.length ? amenities : ["CCTV", "EV charging", "Gated", "Permit required"];
  const featureLabels = useMemo(
    () => featureRows.map((v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v)),
    [featureRows]
  );

  const aboutText =
    listing?.description ??
    listing?.availability_text ??
    "Secure off-street parking space in a quiet residential area. The space is well-lit and monitored, with easy access from the main road. Ideal for commuters or longer stays, with clear signage and hassle-free entry.";

  const isOpen24 =
    /24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(
      aboutText + " " + (listing?.availability_text ?? "")
    );

  const availabilityFallbackText = useMemo(() => {
    const raw = (listing?.availability_text ?? "").trim();
    if (!raw) {
      if (isOpen24) return "Open 24/7";
      if (listing?.is_available === true) return "Available";
      return "Check availability";
    }
    if (/24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(raw))
      return "Open 24/7";
    if (/closed|by appointment|weekdays|weekends|mon|tue|wed|thu|fri|sat|sun|\d{1,2}:\d{2}/i.test(raw) && raw.length <= 60)
      return raw;
    if (listing?.is_available === true) return "Available";
    return "Check availability";
  }, [isOpen24, listing?.availability_text, listing?.is_available]);

  const availabilityEntries = (listing as { availabilitySchedule?: { startsAt: string; endsAt: string; repeatWeekdays: number[] }[] })?.availabilitySchedule ?? [];
  const hasWeeklyAvailability = availabilityEntries.some(
    (entry) => Array.isArray(entry.repeatWeekdays) && entry.repeatWeekdays.length > 0
  );
  const formatHour = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  const weekdayOrder = [
    { label: "Monday", dow: 1 },
    { label: "Tuesday", dow: 2 },
    { label: "Wednesday", dow: 3 },
    { label: "Thursday", dow: 4 },
    { label: "Friday", dow: 5 },
    { label: "Saturday", dow: 6 },
    { label: "Sunday", dow: 0 },
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
    const street = listing?.address
      ? listing.address.split(",")[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim()
      : "";
    return street ? `${spaceTypeLabel} on ${street}` : (listing?.title ?? "");
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

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    try {
      await register(email.trim(), password, { termsVersion: "2026-01-10", privacyVersion: "2026-01-10" });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  const handleToggleFavorite = async () => {
    if (!listing) return;
    if (!user) { navigation.navigate("Welcome"); return; }
    const wasFavorite = isFavorite(id);
    await toggle(listing);
    if (!wasFavorite) setShowFavAnim(true);
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

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
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
                colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.16)"]}
                locations={[0, 0.42, 1]}
                style={styles.heroGradient}
              />
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
                    {showFavAnim && (
                      <LottieView
                        source={require("../assets/Heart fav.json")}
                        autoPlay
                        loop={false}
                        onAnimationFinish={() => setShowFavAnim(false)}
                        style={styles.favAnim}
                      />
                    )}
                  </Pressable>
                </View>
            </View>
            </View>

            <Pressable
              style={[styles.heroTapZone, { height: heroTapHeight, top: 0 }]}
              onPress={() => { setViewerIndex(0); setShowImageViewer(true); }}
            />

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomBarSpacer }}
            >
              {/* Hero spacer */}
              <View style={{ height: heroHeight + insets.top - 28 }} />

              {/* Content sheet */}
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />

                <View style={styles.titleBlock}>
                  <Text style={styles.titleText}>{displayTitle}</Text>

                  <View style={styles.metaRow}>
                    {hasReviews && (
                      <>
                        <View style={styles.starPill}>
                          <Ionicons name="star" size={12} color="#F4B942" />
                          <Text style={styles.starPillText}>{listing.rating?.toFixed(1)}</Text>
                          {listing.rating_count ? (
                            <Text style={styles.starPillCount}>{listing.rating_count}</Text>
                          ) : null}
                        </View>
                        <View style={styles.metaDot} />
                      </>
                    )}
                    <View style={[styles.availPulseDot, !isAvailable && styles.availPulseDotOff]} />
                    <Text style={[styles.availText, !isAvailable && styles.availTextOff]}>
                      {availabilityFallbackText}
                    </Text>
                  </View>

                </View>

                <View style={styles.statsStrip}>
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>DURATION</Text>
                    <Text style={styles.statsCellValue}>{priceSummary?.durationLabel ?? "—"}</Text>
                  </View>
                  <View style={styles.statsVDivider} />
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>FEE</Text>
                    <Text style={styles.statsCellValue}>€{priceSummary?.total ?? "—"}</Text>
                  </View>
                  <View style={styles.statsVDivider} />
                  <View style={styles.statsCell}>
                    <Text style={styles.statsCellLabel}>DISTANCE</Text>
                    <Text style={styles.statsCellValue}>{distanceLabel}</Text>
                  </View>
                </View>

                {/* ── Booking info card ─────────────────────── */}
                <View style={styles.airRouteCard}>
                  <View style={styles.taxiRouteTrack}>
                    <View style={styles.taxiRouteDotStart} />
                    <View style={styles.taxiRouteLine} />
                    <View style={styles.taxiRouteDotEnd} />
                  </View>
                  <View style={styles.taxiRouteContent}>
                    <View style={styles.taxiRouteRow}>
                      <Text style={styles.taxiRouteValue}>{formatDateTimeLabel(startAt)}</Text>
                    </View>
                    <View style={styles.taxiRouteSpacer} />
                    <View style={styles.taxiRouteRow}>
                      <Text style={styles.taxiRouteValue}>{formatDateTimeLabel(endAt)}</Text>
                    </View>
                  </View>
                  <Pressable style={styles.airTimeEditButton} onPress={() => openPicker("start")}>
                    <Ionicons name="create-outline" size={16} color="#0F172A" />
                    <Text style={styles.airTimeEditButtonText}>Edit</Text>
                  </Pressable>
                </View>

                {/* ── Extend offer ─────────────────────────── */}
                {extendOffer ? (
                  <Pressable
                    style={styles.offerCard}
                    onPress={() => setEndAt(new Date(extendOffer.endOfDay))}
                  >
                    <View style={styles.offerIconWrap}>
                      <Ionicons name="flash" size={15} color={colors.accent} />
                    </View>
                    <Text style={styles.offerText}>
                      Extend to end of day for only{" "}
                      <Text style={styles.offerTextBold}>€{extendOffer.extra}</Text>
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.accent} />
                  </Pressable>
                ) : null}

                {/* ── About ────────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <Pressable
                  style={styles.section}
                  onPress={() => { if (aboutText.length > 140) setShowFullAbout((p) => !p); }}
                >
                  <Text style={styles.sectionTitle}>About this property</Text>
                  <Text style={styles.sectionBody} numberOfLines={showFullAbout ? undefined : 3}>
                    {aboutText}
                  </Text>
                  {aboutText.length > 140 && (
                    <Text style={styles.readMore}>{showFullAbout ? "View less" : "View full description"}</Text>
                  )}
                </Pressable>

                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>The local area</Text>
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
                    <View style={styles.localAreaButtons}>
                      <Pressable style={styles.localAreaButtonSecondary} onPress={handleOpenMaps}>
                        <Text style={styles.localAreaButtonSecondaryText}>Get directions</Text>
                      </Pressable>
                      <Pressable style={styles.localAreaButtonSecondary} onPress={handleOpenStreetView}>
                        <Text style={styles.localAreaButtonSecondaryText}>Street view</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* ── Availability ─────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Available times</Text>
                  <View style={styles.availabilityList}>
                    {openingHours.map((entry) => (
                      <View
                        key={entry.day}
                        style={[styles.availabilityRow, entry.isToday && styles.availabilityRowToday]}
                      >
                        <Text style={[styles.availabilityDay, entry.isToday && styles.availabilityDayToday]}>
                          {entry.day}
                        </Text>
                        <Text style={[styles.availabilityHours, entry.isToday && styles.availabilityHoursToday]}>
                          {entry.hours}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── Features (horizontal scroll chips) ───── */}
                <View style={styles.sectionDivider} />
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Included features</Text>
                  <View style={styles.chipsGrid}>
                    {featureLabels.map((feature) => (
                      <View key={feature} style={styles.featureChip}>
                        <View style={styles.featureChipIconWrap}>
                          <FeatureIcon type={getFeatureIconType(feature)} size={16} />
                        </View>
                        <View>
                          <Text style={styles.featureChipLabel}>{feature}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── Guarantee strip ───────────────────────── */}
                <View style={styles.guaranteeStrip}>
                  <View style={styles.guaranteeIconTile}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.guaranteeCopy}>
                    <Text style={styles.guaranteeTitle}>Pay at confirmation</Text>
                    <Text style={styles.guaranteeSub}>Book now · charged at reservation</Text>
                  </View>
                </View>

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
                    <ActivityIndicator color={colors.accent} style={{ marginTop: 12, alignSelf: "flex-start" }} />
                  ) : reviews.length ? (
                    <View style={styles.reviewList}>
                      {reviews.slice(0, 3).map((review) => {
                        const authorName =
                          (review as { author_name?: string }).author_name ??
                          review.authorName ?? "Guest";
                        return (
                          <View key={review.id} style={styles.reviewCard}>
                            <View style={styles.reviewCardTop}>
                              <View style={[styles.reviewAvatar, { backgroundColor: avatarBg(authorName) }]}>
                                <Text style={styles.reviewAvatarText}>
                                  {authorName.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.reviewMetaBlock}>
                                <Text style={styles.reviewAuthorName}>{authorName}</Text>
                                <Text style={styles.reviewDateText}>
                                  {formatReviewDate(
                                    new Date(
                                      (review as { created_at?: string }).created_at ?? review.createdAt
                                    )
                                  )}
                                </Text>
                              </View>
                              <View style={styles.reviewStarPill}>
                                <Ionicons name="star" size={11} color="#F4B942" />
                                <Text style={styles.reviewStarPillText}>{review.rating.toFixed(1)}</Text>
                              </View>
                            </View>
                            <Text style={styles.reviewComment}>{review.comment}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.sectionBody, { marginTop: 8 }]}>No reviews yet.</Text>
                  )}
                </View>

                {/* ── Auth card ────────────────────────────── */}
                {!user && (
                  <View style={styles.authCard}>
                    <Text style={styles.authTitle}>Sign in to book</Text>
                    <Text style={styles.authSub}>Join thousands of commuters saving on parking.</Text>
                    <TextInput
                      style={styles.authInput}
                      placeholder="Email address"
                      placeholderTextColor={colors.textSoft}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                    />
                    <TextInput
                      style={styles.authInput}
                      placeholder="Password"
                      placeholderTextColor={colors.textSoft}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                    {authError ? <Text style={styles.authError}>{authError}</Text> : null}
                    <View style={styles.authBtns}>
                      <Pressable style={styles.authBtnSecondary} onPress={handleLogin} disabled={authLoading}>
                        <Text style={styles.authBtnSecondaryText}>Log in</Text>
                      </Pressable>
                      <Pressable style={styles.authBtnPrimary} onPress={handleRegister} disabled={authLoading}>
                        <Text style={styles.authBtnPrimaryText}>Create account</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* ── Sticky bottom bar ──────────────────────── */}
            {priceSummary && user ? (
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
                      if (navigatingToBooking) return;
                      setNavigatingToBooking(true);
                      navigation.navigate("BookingSummary", {
                        id,
                        from: startAt.toISOString(),
                        to: endAt.toISOString(),
                      });
                      setTimeout(() => setNavigatingToBooking(false), 800);
                    }}
                    disabled={authLoading}
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
      {pickerVisible ? (
        <Modal transparent animationType="fade" visible>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => { setPickerVisible(false); setDraftDate(null); }}
          >
            <Pressable style={styles.pickerSheet} onPress={() => undefined}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerField === "start" ? "Arrival time" : "Departure time"}
                </Text>
                <Pressable
                  style={styles.pickerDone}
                  onPress={() => {
                    const currentField = pickerField;
                    const picked = draftDate ?? (pickerField === "start" ? startAt : endAt);
                    const resolved = applyPickedDate(picked);
                    if (currentField === "start") {
                      setPickerField("end");
                      setDraftDate(resolved);
                      return;
                    }
                    setPickerVisible(false);
                    setDraftDate(null);
                  }}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DatePicker
                date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
                mode="datetime"
                minuteInterval={30}
                onDateChange={(d) => setDraftDate(d)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

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

const WARM_SHADOW = {
  shadowColor: "#0F4D40",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 16,
  elevation: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.appBg,
  },
  errorText: {
    fontFamily: "Inter-Regular", fontSize: 14, color: colors.danger,
    textAlign: "center", paddingHorizontal: 24,
  },

  // Hero
  heroFixed: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0, overflow: "hidden" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#3A5A50" },
  heroGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  photoCounter: {
    backgroundColor: "rgba(0,0,0,0.44)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-end",
  },
  photoCounterText: { fontFamily: "Inter-SemiBold", fontSize: 11, color: "#fff", letterSpacing: 0.5 },

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
  favAnim: { position: "absolute", width: 62, height: 62 },
  heroTapZone: { position: "absolute", left: 0, right: 0, zIndex: 1 },

  scroll: { flex: 1 },

  // Sheet
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: spacing.screenX,
    paddingTop: 8, paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 6,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 999,
    backgroundColor: "#d8dcdf",
    alignSelf: "center", marginBottom: 18,
  },
  airSummaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  airSummaryThumb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E8EEF5",
  },
  taxiSummaryAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  airSummaryHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  airSummaryTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    textAlign: "left",
    color: "#134d49",
    marginBottom: 4,
  },
  airSummarySub: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#5d7773",
    textAlign: "left",
    marginBottom: 12,
  },
  airSummaryStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  airReviewSummaryLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 0,
    flexWrap: "wrap",
  },
  airReviewSummarySecondary: {
    fontFamily: "Inter-Medium",
    fontSize: 14,
    lineHeight: 20,
    color: "#5d7773",
  },
  airStatsPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  airStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d8e5df",
    backgroundColor: "#fffef9",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  airStatPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: "#145852",
  },

  // Title block
  titleBlock: { paddingBottom: 14 },
  typePill: {
    alignSelf: "flex-start",
    backgroundColor: "#dceee8", borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10,
  },
  typePillText: { fontFamily: "Inter-SemiBold", fontSize: 11, color: "#0f5b55", letterSpacing: 0.5 },
  titleText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24, lineHeight: 31, letterSpacing: -0.55,
    color: "#151b1b", marginBottom: 8,
  },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 4 },
  starPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "transparent", borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0,
  },
  starPillText: { fontFamily: "Inter-Bold", fontSize: 14, color: "#151b1b" },
  starPillCount: { fontFamily: "Inter-Regular", fontSize: 14, color: "#6b7280" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  availPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 5 },
  availPulseDotOff: { backgroundColor: colors.danger },
  availText: { fontFamily: "Inter-SemiBold", fontSize: 14, color: "#0f7f68" },
  availTextOff: { color: colors.danger },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addressText: { fontFamily: "Inter-Regular", fontSize: 13, color: colors.textMuted, flex: 1, flexShrink: 1 },
  addressSep: { fontFamily: "Inter-Regular", fontSize: 13, color: colors.borderStrong, flexShrink: 0 },
  distanceText: { fontFamily: "Inter-Medium", fontSize: 13, color: colors.textMuted, flexShrink: 0 },

  // Stats strip
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 14, borderWidth: 1, borderColor: "#e6e8ea",
    overflow: "hidden", marginBottom: 12,
  },
  statsCell: { flex: 1, paddingVertical: 16, paddingHorizontal: 10, alignItems: "center", gap: 4 },
  statsCellLabel: {
    fontFamily: "Inter-SemiBold", fontSize: 10,
    color: "#8b949b", letterSpacing: 0.9, textTransform: "uppercase",
  },
  statsCellValue: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 18,
    color: "#151b1b", letterSpacing: -0.3,
  },
  statsVDivider: { width: 1, backgroundColor: "#eceff1", marginVertical: 10 },

  // Booking time card
  airRouteCard: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e8eaeb",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
  },
  taxiRouteTrack: {
    alignItems: "center",
    width: 18,
    paddingTop: 6,
  },
  taxiRouteDotStart: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#31b36b",
    borderWidth: 4,
    borderColor: "#ecfaf1",
  },
  taxiRouteLine: {
    width: 2,
    flex: 1,
    minHeight: 36,
    backgroundColor: "#31b36b",
    marginVertical: 4,
  },
  taxiRouteDotEnd: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#31b36b",
  },
  taxiRouteContent: {
    flex: 1,
    gap: 0,
  },
  taxiRouteRow: {
    minHeight: 34,
    justifyContent: "center",
  },
  taxiRouteSpacer: { height: 12 },
  taxiRouteValue: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    lineHeight: 21,
    color: "#1f2a2a",
  },
  airTimeEditButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e4e5",
    marginLeft: 8,
  },
  airTimeEditButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13.5,
    lineHeight: 18,
    color: "#4f5b5a",
  },

  // Extend offer
  offerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e8eaeb",
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 2,
  },
  offerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f4f7f7",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  offerText: { flex: 1, fontFamily: "Inter-Regular", fontSize: 13, color: "#151b1b", lineHeight: 19 },
  offerTextBold: { fontFamily: "Inter-Bold" },

  // Sections
  sectionDivider: { height: 1, backgroundColor: "#f0f1f2", marginHorizontal: -spacing.screenX },
  availabilityList: { gap: 6, marginTop: 10 },
  availabilityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 },
  availabilityRowToday: { backgroundColor: "#f5faf7", borderRadius: 8, paddingHorizontal: 10, marginHorizontal: -8 },
  availabilityDay: { fontFamily: "Inter-Medium", fontSize: 14, color: "#1F2937", flex: 1 },
  availabilityDayToday: { color: "#15714a", fontFamily: "Inter-SemiBold" },
  availabilityHours: { fontFamily: "Inter-Regular", fontSize: 13, color: "#64748B", textAlign: "right" },
  availabilityHoursToday: { color: "#15714a" },
  section: { paddingVertical: 18 },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20, color: "#151b1b", letterSpacing: -0.35, marginBottom: 14,
  },
  sectionBody: { fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 27, color: "#343c3c" },
  readMore: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: "#151b1b", marginTop: 10 },
  localAreaCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    padding: 0,
    gap: 12,
  },
  localAreaHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  localAreaHeaderTextWrap: { flex: 1 },
  localAreaAddress: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    lineHeight: 21,
    color: "#151b1b",
    letterSpacing: -0.15,
  },
  localAreaSub: {
    marginTop: 4,
    fontFamily: "Inter-Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#6a7474",
  },
  localAreaMap: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e3e7e7",
    backgroundColor: "#e7ecef",
  },
  localAreaMapWrap: {
    position: "relative",
  },
  mapExpandButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "#e3e7e7",
    alignItems: "center",
    justifyContent: "center",
  },
  localAreaButtons: {
    flexDirection: "row",
    gap: 10,
  },
  localAreaButtonSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e4e5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  localAreaButtonSecondaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#151b1b",
    letterSpacing: -0.1,
  },

  // Feature chips
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8, borderWidth: 1, borderColor: "#e0e4e5",
    paddingHorizontal: 14, paddingVertical: 14,
    minWidth: "46%",
  },
  featureChipIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#fafbfb",
    alignItems: "center", justifyContent: "center",
  },
  featureChipLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13.5, color: "#151b1b", letterSpacing: -0.15,
  },

  // Guarantee strip
  guaranteeStrip: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4,
    borderWidth: 1, borderColor: "#e8eaeb",
  },
  guaranteeIconTile: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#f4f7f7",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  guaranteeCopy: { flex: 1 },
  guaranteeTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#151b1b", letterSpacing: -0.2 },
  guaranteeSub: { fontFamily: "Inter-Medium", fontSize: 12.5, color: "#6b747b", marginTop: 2 },

  // Reviews
  reviewsHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 0 },
  reviewsLink: {
    marginLeft: "auto",
  },
  reviewsLinkText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#2caea3",
  },
  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FCEFD6", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5,
  },
  ratingPillText: { fontFamily: "Inter-Bold", fontSize: 12, color: "#7A5A2E" },
  ratingPillCount: { fontFamily: "Inter-Regular", fontSize: 11, color: "#A07840" },
  reviewList: { gap: 12, marginTop: 12 },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8, borderWidth: 1, borderColor: "#e8eaeb", padding: 15,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "Inter-Bold", fontSize: 15, color: colors.text },
  reviewMetaBlock: { flex: 1 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#151b1b", letterSpacing: -0.18 },
  reviewDateText: { fontFamily: "Inter-Regular", fontSize: 11.5, color: "#798289", marginTop: 1 },
  reviewStarPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#f5f7f7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  reviewStarPillText: { fontFamily: "Inter-Bold", fontSize: 12, color: "#151b1b" },
  reviewComment: { fontFamily: "Inter-Regular", fontSize: 13.5, lineHeight: 22, color: "#3f4948" },

  // Auth card
  authCard: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 22, padding: 20, marginTop: 24,
    ...WARM_SHADOW,
  },
  authTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: colors.text, marginBottom: 4, letterSpacing: -0.3 },
  authSub: { fontFamily: "Inter-Regular", fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  authInput: {
    fontFamily: "Inter-Regular", backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 14, color: colors.text, marginBottom: 10,
  },
  authError: { fontFamily: "Inter-Regular", fontSize: 13, color: colors.danger, marginBottom: 8 },
  authBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  authBtnSecondary: {
    flex: 1, backgroundColor: colors.cardBg,
    borderWidth: 1.5, borderColor: colors.accent,
    borderRadius: radius.pill, paddingVertical: 13, alignItems: "center",
  },
  authBtnSecondaryText: { fontFamily: "Inter-SemiBold", fontSize: 14, color: colors.accent },
  authBtnPrimary: {
    flex: 1, backgroundColor: colors.accent,
    borderRadius: radius.pill, paddingVertical: 13, alignItems: "center",
  },
  authBtnPrimaryText: { fontFamily: "Inter-SemiBold", fontSize: 14, color: "#fff" },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 10,
    minHeight: 86,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 16,
    shadowColor: "#15232b",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 8,
  },
  bottomLeft: { flex: 1, justifyContent: "center", paddingLeft: 2 },
  bottomLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: "#7a8288",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  bottomPrice: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 27, color: "#111827", letterSpacing: -0.8, lineHeight: 31,
  },
  bottomDuration: { fontFamily: "Inter-Regular", fontSize: 12, color: "#98a4ab", marginTop: 2 },
  reserveBtn: {
    backgroundColor: "#148b84",
    borderRadius: 8,
    minHeight: 56,
    paddingVertical: 16, paddingHorizontal: 24, minWidth: 148, alignItems: "center", justifyContent: "center",
    shadowColor: "#158a83",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  reserveBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  reserveBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#fff", letterSpacing: -0.2 },
  reserveBtnDisabledText: { fontFamily: "Inter-SemiBold", fontSize: 16, color: colors.textSoft },

  // Picker modal
  pickerBackdrop: {
    flex: 1, backgroundColor: "rgba(15,40,35,0.35)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 20,
  },
  pickerSheet: { backgroundColor: colors.cardBg, borderRadius: 22, overflow: "hidden", width: "100%" },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: colors.text },
  pickerDone: { paddingVertical: 6, paddingHorizontal: 8 },
  pickerDoneText: { fontFamily: "Inter-SemiBold", fontSize: 15, color: colors.accent },

  // Image viewer modal
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(10,25,20,0.97)" },
  mapViewerScreen: { flex: 1, backgroundColor: "#fff" },
  mapViewerClose: {
    backgroundColor: "rgba(20,27,27,0.74)",
  },
  viewerClose: {
    position: "absolute", right: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999,
  },
  viewerCloseText: { fontFamily: "Inter-SemiBold", fontSize: 13, color: "#fff" },
});
