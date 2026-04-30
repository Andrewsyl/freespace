import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import LottieView from "lottie-react-native";
import DatePicker from "react-native-date-picker";
import MapView, { Marker } from "react-native-maps";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
  listListingReviews,
  type ListingReview,
} from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { logError, logInfo } from "../logger";
import type { ListingDetail, RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import {
  formatDateLabel,
  formatTimeLabel,
  formatDateTimeLabel,
  formatReviewDate,
} from "../utils/dateFormat";
import {
  ArrowDownUp,
  Cctv,
  EvCharger,
  Home,
  Fence,
  IdCard,
  KeyRound,
  Star,
  User,
  Image as ImageIcon,
} from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const getFeatureIconType = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("low") || normalized.includes("clearance")) return "low";
  if (normalized.includes("permit")) return "permit";
  if (normalized.includes("ev") || normalized.includes("charger") || normalized.includes("charging")) return "ev";
  if (normalized.includes("cctv") || normalized.includes("camera")) return "cctv";
  if (normalized.includes("shelter") || normalized.includes("covered") || normalized.includes("roof")) return "sheltered";
  if (normalized.includes("gate") || normalized.includes("gated") || normalized.includes("barrier")) return "gated";
  if (normalized.includes("code") || normalized.includes("keypad") || normalized.includes("entry")) return "code";
  return "sheltered";
};

const getAddressWithoutHouseNumber = (address: string) => {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return address;
  const firstPart = parts[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
  const normalizedParts = [firstPart || parts[0], ...parts.slice(1)];
  return normalizedParts.join(", ");
};

const FeatureIcon = ({ type }: { type: string }) => {
  const stroke = "#15171A";
  const size = 22;
  const sw = 1.75;
  switch (type) {
    case "low":
      return <ArrowDownUp size={size} color={stroke} strokeWidth={sw} />;
    case "cctv":
      return <Cctv size={size} color={stroke} strokeWidth={sw} />;
    case "permit":
      return <IdCard size={size} color={stroke} strokeWidth={sw} />;
    case "ev":
      return <EvCharger size={size} color={stroke} strokeWidth={sw} />;
    case "sheltered":
      return <Home size={size} color={stroke} strokeWidth={sw} />;
    case "gated":
      return <Fence size={size} color={stroke} strokeWidth={sw} />;
    case "code":
      return <KeyRound size={size} color={stroke} strokeWidth={sw} />;
    default:
      return <Home size={size} color={stroke} strokeWidth={sw} />;
  }
};

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to, booking } = route.params;
  const { token, login, register, loading: authLoading, user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [heroTapEnabled, setHeroTapEnabled] = useState(true);
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

  // Check if current times match the booking times
  const isBookingTimes = booking &&
    startAt.toISOString() === booking.startTime &&
    endAt.toISOString() === booking.endTime;
  const showBookingMode = booking && isBookingTimes;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getListing(id, {
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
        setListing(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Listing failed";
        setError(message);
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
        if (!active) return;
        setReviews(data);
      } catch {
        if (!active) return;
        setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    void loadReviews();
    return () => {
      active = false;
    };
  }, [id]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    const ms = Math.max(0, endAt.getTime() - startAt.getTime());
    const hours = ms / (1000 * 60 * 60);
    const roundedHours = Math.max(1, Math.ceil(hours));
    const hourlyRate = listing.price_per_day / 24;
    const total = Math.round(hourlyRate * roundedHours);

    // Format duration label
    let durationLabel: string;
    if (hours < 24) {
      durationLabel = `${roundedHours} ${roundedHours === 1 ? 'hour' : 'hours'}`;
    } else {
      const days = Math.max(1, Math.ceil(hours / 24));
      durationLabel = `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    return { total, totalCents: total * 100, durationLabel };
  }, [listing, startAt, endAt]);

  const showBottomBar = !!(priceSummary && user);
  const bottomBarSpacer = showBottomBar ? 140 + insets.bottom : 24;

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
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
      return;
    }
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
  };

  const imageUrls = useMemo(() => {
    if (listing?.image_urls?.length) return listing.image_urls;
    if (mapsKey) {
      return [
        `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${streetViewLocation}&fov=65&key=${mapsKey}`,
      ];
    }
    return [];
  }, [listing?.image_urls, mapsKey, streetViewLocation]);

  const amenities = listing?.amenities ?? [];
  const featureRows = amenities.length
    ? amenities
    : ["CCTV", "EV charging", "Gated", "Permit required"];
  const featureLabels = useMemo(
    () =>
      featureRows.map((value) => {
        if (!value) return value;
        return value.charAt(0).toUpperCase() + value.slice(1);
      }),
    [featureRows]
  );
  const aboutText =
    listing?.description ??
    listing?.availability_text ??
    "Secure off-street parking space in a quiet residential area. The space is well-lit and monitored, with easy access from the main road. Ideal for commuters or longer stays, with clear signage and hassle-free entry.";
  const isOpen24 =
    /24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(
      aboutText
    ) ||
    /24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(
      listing?.availability_text ?? ""
    );
  const availabilityFallbackText = useMemo(() => {
    const raw = (listing?.availability_text ?? "").trim();
    if (!raw) {
      if (isOpen24) return "Open 24 hours";
      if (listing?.is_available === true) return "Available for selected times";
      return "Check availability";
    }
    if (/24\s*\/\s*7|24\s*hours|open\s*24|always available|available every day|every day|monday\s*-\s*sunday/i.test(raw)) {
      return "Open 24 hours";
    }
    if (/closed|by appointment|weekdays|weekends|mon|tue|wed|thu|fri|sat|sun|\d{1,2}:\d{2}/i.test(raw) && raw.length <= 80) {
      return raw;
    }
    if (listing?.is_available === true) return "Available for selected times";
    return "Check availability";
  }, [isOpen24, listing?.availability_text]);
  const availabilityEntries = listing?.availabilitySchedule ?? [];
  const hasWeeklyAvailability = availabilityEntries.some(
    (entry) => Array.isArray(entry.repeatWeekdays) && entry.repeatWeekdays.length > 0
  );
  const formatHour = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const weekdayOrder = [
    { label: "Monday", dow: 1 },
    { label: "Tuesday", dow: 2 },
    { label: "Wednesday", dow: 3 },
    { label: "Thursday", dow: 4 },
    { label: "Friday", dow: 5 },
    { label: "Saturday", dow: 6 },
    { label: "Sunday", dow: 0 },
  ];
  const openingHours = weekdayOrder.map(({ label, dow }) => {
    if (hasWeeklyAvailability) {
      const entry = availabilityEntries.find((item) =>
        Array.isArray(item.repeatWeekdays) && item.repeatWeekdays.includes(dow)
      );
      if (entry) {
        return {
          day: label,
          hours: `${formatHour(entry.startsAt)} - ${formatHour(entry.endsAt)}`,
        };
      }
      return { day: label, hours: "Closed" };
    }
    return {
      day: label,
      hours: availabilityFallbackText,
    };
  });
  const aboutPreview =
    aboutText.length > 140 ? `${aboutText.slice(0, 140).trim()}...` : aboutText;

  // Add dummy data for new fields (remove this once backend is ready)
  const description = listing?.description ?? "Secure off-street parking space in a quiet residential area. The space is well-lit and monitored 24/7 with CCTV cameras. Perfect for daily commuters or long-term parking needs. Easy access from main road with clear signage.";
  const vehicleSizeSuitability = (listing?.vehicle_size_suitability || listing?.vehicleSizeSuitability) ?? "Suitable for: Compact cars, Sedans, Small SUVs (up to 4.8m length)";
  const accessDirections = (listing?.access_directions || listing?.accessDirections) ?? "1. Enter through the main gate on Oak Street\n2. Turn left at the first intersection\n3. The parking space is number 24, located on the right side\n4. Access code will be provided after booking\n5. Gate opens automatically with the code";

  const hostName = "Andrew";
  const hostInitials = hostName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hasReviews = (listing?.rating_count ?? 0) > 0 && typeof listing?.rating === "number";
  const spaceTypeLabel = useMemo(() => {
    const rawType =
      (listing as { space_type?: string; spaceType?: string })?.space_type ??
      (listing as { space_type?: string; spaceType?: string })?.spaceType ??
      null;
    if (rawType) return rawType;
    const title = (listing?.title ?? "").trim();
    if (/ parking$/i.test(title)) {
      return title.replace(/ parking$/i, "");
    }
    const lower = title.toLowerCase();
    if (lower.includes("driveway")) return "Private Driveway";
    if (lower.includes("garage")) return "Garage";
    if (lower.includes("car park") || lower.includes("carpark")) return "Car park";
    if (lower.includes("private road")) return "Private road";
    if (lower.includes("street")) return "Street";
    return "Parking space";
  }, [listing]);
  const hostRating = hasReviews && listing?.rating ? listing.rating.toFixed(1) : null;
  const hostReviews = hasReviews ? listing?.rating_count ?? 0 : 0;
  const heroHeight = Math.round(width * 0.6);
  const heroTapHeight = Math.max(0, heroHeight - 40);
  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : "0.8 km";
  const quickChips = useMemo(() => {
    const base = featureRows.slice(0, 3);
    if (!base.some((chip) => chip.toLowerCase().includes("24/7"))) {
      base.unshift("24/7");
    }
    return base.slice(0, 4);
  }, [featureRows]);
  const extendOffer = useMemo(() => {
    const dayPrice = listing?.price_per_day != null ? Number(listing.price_per_day) : null;
    if (dayPrice == null || Number.isNaN(dayPrice)) return null;
    const endOfDay = new Date(endAt);
    endOfDay.setHours(23, 59, 0, 0);
    if (endAt >= endOfDay) return null;
    const ms = Math.max(0, endOfDay.getTime() - endAt.getTime());
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
    const hourly = dayPrice / 24;
    const extra = hourly * hours;
    const discountRate = 0.25;
    const discountedExtra = extra * (1 - discountRate);
    const savings = extra - discountedExtra;
    if (savings < 1) return null;
    const roundedExtra = Math.round(discountedExtra);
    return {
      hours,
      extra: roundedExtra.toString(),
      endOfDay,
    };
  }, [listing?.price_per_day, endAt]);

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
      await register(email.trim(), password, {
        termsVersion: "2026-01-10",
        privacyVersion: "2026-01-10",
      });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  // Booking now happens on the summary screen.

  const handleToggleFavorite = async () => {
    if (!listing) return;
    if (!user) {
      navigation.navigate("Welcome");
      return;
    }
    const wasFavorite = isFavorite(id);
    await toggle(listing);
    if (!wasFavorite) {
      setShowFavAnim(true);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : listing ? (
          <>
            {/* Content Card */}
            <View style={[styles.heroFixed, { height: heroHeight + insets.top, top: 0 }]}>
              {imageUrls.length ? (
                <Image
                  source={{ uri: imageUrls[0] }}
                  style={[styles.heroImage, { width, height: heroHeight }]}
                />
              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight }]}>
                  <Text style={styles.heroPlaceholderText}>No image</Text>
                </View>
              )}

              {imageUrls.length > 1 ? (
                <View style={styles.dotsRow}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={`dot-${index}`}
                      style={[styles.dot, index === 0 && styles.dotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            {/* Header Overlay */}
            <View style={[styles.headerOverlay, { top: insets.top + 8 }]}>
              <Pressable style={styles.backButtonRound} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </Pressable>
              <Pressable style={styles.favoriteButtonRound} onPress={handleToggleFavorite}>
                <Text style={[styles.favoriteIcon, isFavorite(id) && styles.favoriteIconActive]}>
                  {isFavorite(id) ? "♥︎" : "♡"}
                </Text>
                {showFavAnim ? (
                  <LottieView
                    source={require("../assets/Heart fav.json")}
                    autoPlay
                    loop={false}
                    onAnimationFinish={() => setShowFavAnim(false)}
                    style={styles.favAnimOverlay}
                  />
                ) : null}
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.heroTapOverlay,
                { height: heroTapHeight, top: 0 },
              ]}
              pointerEvents={heroTapEnabled ? "auto" : "none"}
              onPress={() => {
                if (!heroTapEnabled) return;
                setViewerIndex(0);
                setShowImageViewer(true);
              }}
            />

            <ScrollView
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: heroHeight - 40,
                paddingBottom: 24,
              }}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const y = event.nativeEvent.contentOffset.y;
                const shouldEnable = y < 12;
                if (shouldEnable !== heroTapEnabled) {
                  setHeroTapEnabled(shouldEnable);
                }
              }}
            >
              <View style={styles.contentWrap}>
                <View style={styles.contentCard}>
              {/* Title Section */}
              <View style={styles.titleSection}>
                <Text style={styles.cardTitle}>{listing.title}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.typeChip}>
                    <Text style={styles.typeChipText}>{spaceTypeLabel}</Text>
                  </View>
                  <View style={styles.metaInline}>
                    <Ionicons name="location-outline" size={15} color="#6B7280" />
                    <Text style={styles.metaInlineText} numberOfLines={1}>
                      {areaLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.ratingRow}>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#F2A73B" />
                    <Text style={styles.rating}>
                      {hasReviews ? listing.rating?.toFixed(1) : "0.0"}
                    </Text>
                  </View>
                  <Text style={styles.reviewCount}>
                    {listing.rating_count ?? 0} reviews
                  </Text>
                  <View style={styles.ratingDotSeparator} />
                  <View style={styles.availabilityInline}>
                    <View
                      style={[
                        styles.availabilityDot,
                        listing.is_available === false && styles.availabilityDotOff,
                      ]}
                    />
                    <Text
                      style={[
                        styles.availabilityText,
                        listing.is_available === false && styles.availabilityTextOff,
                      ]}
                    >
                      {listing.is_available === false ? "Unavailable" : "Available now"}
                    </Text>
                  </View>
                </View>
                {priceSummary ? (
                  <View style={styles.summaryStrip}>
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>Total duration</Text>
                      <Text style={styles.summaryValue}>{priceSummary.durationLabel}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>Parking fee</Text>
                      <Text style={styles.summaryValue}>€{priceSummary.total}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>To destination</Text>
                      <Text style={styles.summaryValue}>{distanceLabel}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Date/Time Picker Row */}
              <View style={styles.timePickerSection}>
                <View style={styles.timePickerWrapper}>
                  <View style={styles.timePickerCard}>
                    <Pressable style={styles.timePickerColumn} onPress={() => openPicker("start")}>
                      <View style={styles.timePickerField}>
                        <View>
                          <Text style={styles.dateTimeLabel}>From</Text>
                          <Text style={styles.dateTimeValue}>{formatDateTimeLabel(startAt)}</Text>
                        </View>
                        <View style={styles.timePickerChevron}>
                          <Ionicons name="chevron-down" size={14} color="#15B27D" />
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.timePickerArrow}>
                      <Ionicons name="arrow-forward" size={16} color="#15B27D" />
                    </View>
                    <Pressable style={styles.timePickerColumn} onPress={() => openPicker("end")}>
                      <View style={styles.timePickerField}>
                        <View>
                          <Text style={styles.dateTimeLabel}>Until</Text>
                          <Text style={styles.dateTimeValue}>{formatDateTimeLabel(endAt)}</Text>
                        </View>
                        <View style={styles.timePickerChevron}>
                          <Ionicons name="chevron-down" size={14} color="#15B27D" />
                        </View>
                      </View>
                    </Pressable>
                  </View>
                  {extendOffer ? (
                    <Pressable
                      style={styles.offerBar}
                      onPress={() => {
                        setEndAt(new Date(extendOffer.endOfDay));
                      }}
                    >
                      <View style={styles.offerLeft}>
                        <View style={styles.offerIcon}>
                          <Ionicons name="flash" size={12} color="#fff" />
                        </View>
                        <Text style={styles.offerText}>
                          Extend to <Text style={styles.offerTextBold}>23:59</Text> for only <Text style={styles.offerTextBold}>€{extendOffer.extra}</Text>
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Description */}
              <View style={[styles.sectionBlock, styles.sectionReadingBlock]}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.sectionBody}>
                  {showFullAbout ? aboutText : aboutPreview}
                </Text>
                {aboutText.length > 140 ? (
                  <Pressable onPress={() => setShowFullAbout((prev) => !prev)}>
                    <Text style={styles.readMore}>
                      {showFullAbout ? "Read less →" : "Read more →"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.sectionDivider} />

              {/* Opening Hours */}
              <View style={[styles.sectionBlock, styles.sectionReadingBlock]}>
                <View style={styles.hoursHeaderRow}>
                  <Text style={[styles.sectionTitle, styles.hoursSectionTitle]}>
                    Space Availability
                  </Text>
                </View>
                <Text style={styles.sectionIntro}>Weekly opening hours for this space.</Text>
                {(() => {
                  const todayLabel = new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                  });
                  const rows = hasWeeklyAvailability
                    ? openingHours
                    : [{ day: "Availability", hours: availabilityFallbackText }];
                  return rows.map((row) => {
                    const isToday = row.day === todayLabel;
                    const label = row.day;
                    const highlightToday = hasWeeklyAvailability && isToday;
                    return (
                      <View
                        key={row.day}
                        style={[styles.hoursRow, highlightToday && styles.hoursRowToday]}
                      >
                        <View style={styles.hoursRowLeft}>
                          {highlightToday && <View style={styles.hoursDot} />}
                          <Text style={[styles.hoursDay, highlightToday && styles.hoursDayToday]}>
                            {label}
                          </Text>
                        </View>
                        <Text style={[styles.hoursValue, highlightToday && styles.hoursValueToday]}>
                          {row.hours}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </View>
              <View style={styles.sectionDivider} />
              {/* Features */}
              <View style={[styles.sectionBlock, styles.sectionReadingBlock]}>
                <Text style={styles.sectionTitle}>Features</Text>
                <Text style={styles.sectionIntro}>What this space includes.</Text>
                <View style={styles.featuresGrid}>
                  {featureLabels.slice(0, 4).map((feature) => {
                    const type = getFeatureIconType(feature);
                    const subLabels: Record<string, string> = {
                      cctv: "Monitored 24/7",
                      sheltered: "Sheltered space",
                      ev: "Type 2, 7-22 kW",
                      gated: "Gate w/ keypad",
                      code: "Secure entry",
                      permit: "Required",
                      low: "Height limit",
                    };
                    return (
                      <View key={feature} style={styles.featureIconCard}>
                        <View style={styles.featureIconTile}>
                          <FeatureIcon type={type} />
                        </View>
                        <View>
                          <Text style={styles.featureIconLabel}>{feature}</Text>
                          <Text style={styles.featureIconSub}>{subLabels[type] || ""}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.sectionDivider} />

              {/* Content Sections */}
              <View style={styles.contentSections}>
                <View style={[styles.sectionBlock, styles.sectionReadingBlock]}>
                  <View style={styles.reviewHeaderRow}>
                    <Text style={styles.sectionTitle}>Reviews</Text>
                    {reviews.length > 2 && (
                      <Pressable onPress={() => navigation.navigate("ListingReviews", { id, rating: listing.rating ?? 0, ratingCount: listing.rating_count ?? reviews.length })}>
                        <Text style={styles.reviewSeeAll}>See all</Text>
                      </Pressable>
                    )}
                  </View>
                  {/* Rating summary block */}
                  <View style={styles.reviewSummaryBlock}>
                    <View style={styles.reviewRatingLarge}>
                      <Text style={styles.reviewRatingNumber}>{hasReviews ? listing.rating?.toFixed(2) : "0.00"}</Text>
                      <Text style={styles.reviewRatingMax}>/ 5</Text>
                    </View>
                    <View style={styles.reviewStarsBlock}>
                      <View style={styles.reviewStarsRowLarge}>
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <Ionicons
                            key={`summary-star-${idx}`}
                            name="star"
                            size={13}
                            color={idx < Math.round(listing.rating ?? 0) ? "#F2A73B" : "#D7D3CB"}
                          />
                        ))}
                      </View>
                      <Text style={styles.reviewBasedOn}>Based on {listing.rating_count ?? 0} reviews</Text>
                    </View>
                  </View>
                  {reviewsLoading ? (
                    <View style={styles.centered}>
                      <ActivityIndicator />
                    </View>
                  ) : reviews.length ? (
                    <View style={styles.reviewCardsContainer}>
                      {reviews.slice(0, 2).map((review) => {
                        const authorName = (review as { author_name?: string }).author_name ?? review.authorName ?? "Guest";
                        const initial = authorName.charAt(0).toUpperCase();
                        return (
                          <View key={review.id} style={styles.reviewCardNew}>
                            <View style={styles.reviewCardHeader}>
                              <View style={styles.reviewCardLeft}>
                                <View style={styles.reviewAvatar}>
                                  <Text style={styles.reviewAvatarText}>{initial}</Text>
                                </View>
                                <View style={styles.reviewAuthorBlock}>
                                  <Text style={styles.reviewAuthorName}>{authorName}</Text>
                                  <Text style={styles.reviewTime}>
                                    {formatReviewDate(
                                      new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                                    )}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.reviewStarsSmall}>
                                {[0, 1, 2, 3, 4].map((idx) => (
                                  <Ionicons
                                    key={`${review.id}-star-${idx}`}
                                    name="star"
                                    size={11}
                                    color={idx < Math.round(review.rating) ? "#F2A73B" : "#D7D3CB"}
                                  />
                                ))}
                              </View>
                            </View>
                            <Text style={styles.reviewBody}>{review.comment}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.reviewComment}>No reviews yet.</Text>
                  )}
                </View>

                {!user && (
                  <>
                    <View style={styles.dividerLine} />

                    <View style={styles.authCard}>
                      <Text style={styles.authTitle}>Sign in to book</Text>
                      <TextInput
                        style={styles.authInput}
                        placeholder="Email"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                      />
                      <TextInput
                        style={styles.authInput}
                        placeholder="Password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                      />
                      {authError ? <Text style={styles.error}>{authError}</Text> : null}
                      <View style={styles.authButtons}>
                        <Pressable
                          style={styles.authButtonSecondary}
                          onPress={handleLogin}
                          disabled={authLoading}
                        >
                          <Text style={styles.authButtonSecondaryText}>Log in</Text>
                        </Pressable>
                        <Pressable
                          style={styles.authButtonPrimary}
                          onPress={handleRegister}
                          disabled={authLoading}
                        >
                          <Text style={styles.authButtonPrimaryText}>Create account</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.contentCardSpacer} />
              </View>
                </View>
              </View>
            </ScrollView>

            {/* Fixed Bottom Button */}
            {priceSummary && user ? (
              <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
                <View style={styles.priceInfo}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>€{priceSummary.total}</Text>
                    <Text style={styles.priceTotal}>total</Text>
                  </View>
                  <Text style={styles.priceDuration}>{priceSummary.durationLabel} · incl. fees</Text>
                </View>
                {listing?.is_available === false || showBookingMode ? (
                  <Pressable style={[styles.bookButton, styles.bookButtonDisabled]} disabled>
                    <Text style={styles.bookButtonDisabledText}>Sold out</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.bookButton}
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
                    <Text style={styles.bookButtonText}>
                      {navigatingToBooking ? "Opening..." : "Book Now"}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </SafeAreaView>

      {/* Date Picker Modal */}
      {pickerVisible ? (
        <Modal transparent animationType="fade" visible>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => {
              setPickerVisible(false);
              setDraftDate(null);
            }}
          >
            <Pressable style={styles.pickerSheet} onPress={() => undefined}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerField === "start" ? "Start" : "End"}
                </Text>
                <Pressable
                  style={styles.pickerDone}
                  onPress={() => {
                    const picked =
                      draftDate ?? (pickerField === "start" ? startAt : endAt);
                    applyPickedDate(picked);
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
                onDateChange={(date) => {
                  setDraftDate(date);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Image Viewer Modal */}
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
            onChange={(index) => setViewerIndex(index ?? 0)}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    flex: 1,
  },
  scrollContainer: {
    backgroundColor: "transparent",
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 6,
    width: 56,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  topTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingBottom: 140,
    backgroundColor: colors.appBg,
  },
  hero: {
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    height: 240,
    width: "100%",
  },
  heroPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.border,
    height: 240,
    justifyContent: "center",
  },
  heroPlaceholderText: {
    color: colors.textMuted,
  },
  heroOverlay: {
    flexDirection: "row",
    gap: 8,
    left: 12,
    position: "absolute",
    top: 12,
    right: 12,
    justifyContent: "space-between",
  },
  heroFav: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 999,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    position: "relative",
  },
  heroFavText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 18,
  },
  heroFavTextActive: {
    color: colors.accent,
  },
  heroFavLottie: {
    position: "absolute",
    width: 62,
    height: 62,
  },
  dotsRow: {
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    left: 0,
    position: "absolute",
    right: 0,
    justifyContent: "center",
  },
  dot: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: colors.cardBg,
    width: 16,
  },
  heroPillDark: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillLight: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  heroPillTextDark: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: "#bfe2d8",
    marginTop: -28,
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  titleCard: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addressDot: {
    backgroundColor: colors.textSoft,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  address: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  headerBlock: {
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  metricPill: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  metricIcon: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  metricStar: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
  },
  metricIconBadge: {
    backgroundColor: "#22c55e",
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  timeRow: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  timeLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  dateRowLegacy1: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#374151",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  dateArrowLegacy1: {
    color: "#94a3b8",
    fontSize: 16,
    marginHorizontal: 8,
  },
  dateArrow: {
    paddingHorizontal: 8,
  },
  chipRowLegacy1: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaStrip: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: "#374151",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaStripText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  metaDivider: {
    backgroundColor: colors.border,
    height: 12,
    width: 1,
  },
  chipLegacy1: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...cardShadow,
  },
  chipStrong: {
    backgroundColor: colors.text,
  },
  chipTextLegacy1: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextStrong: {
    color: "#ffffff",
  },
  sectionCard: {
    paddingVertical: 20,
  },
  section: {
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  sectionStack: {
    marginTop: 6,
  },
  featuresGridLegacy1: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  featureItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  featureText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionTitleLegacy1: {
    color: '#111827',
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  readMoreLegacy1: {
    marginTop: 6,
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '600',
  },
  hostRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
  },
  hostAvatar: {
    alignItems: "center",
    backgroundColor: "#e9fbf6",
    borderColor: "#b8efe3",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  hostInitials: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  hostMeta: {
    flex: 1,
    gap: 5,
  },
  hostName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  hostSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  hostDetailsLegacy1: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  hostDetailPill: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hostDetailText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  reviewListLegacy1: {
    gap: 16,
    marginTop: 14,
  },
  reviewItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  reviewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  reviewRatingLegacy1: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  reviewDateLegacy1: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewBodyLegacy1: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  photoScroll: {
    marginTop: 12,
  },
  sectionBodyLegacy1: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValueLegacy1: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  ctaCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginTop: 18,
    padding: 18,
    ...cardShadow,
  },
  ctaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.appBg,
  },
  authButtonsLegacy1: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  error: {
    color: "#b42318",
    marginBottom: 8,
  },
  readMoreLegacy2: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  photoThumb: {
    borderRadius: 12,
    height: 96,
    marginRight: 10,
    width: 140,
  },
  bottomBarLegacy1: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomPrice: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
  },
  bottomSoldOut: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  bottomExisting: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  bottomMeta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  bottomButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  bottomButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  bottomButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomButtonDisabledText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "600",
  },
  viewerBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    flex: 1,
    justifyContent: "center",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 999,
  },
  viewerCloseText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },

  // New Tab-Based Design Styles
  header: {
    position: 'relative',
    overflow: 'visible',
  },
  heroFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  heroTapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  backButtonRound: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  favoriteButtonRound: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  favoriteIcon: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },
  favoriteIconActive: {
    color: '#2ECC8F',
  },
  favAnimOverlay: {
    position: 'absolute',
    width: 62,
    height: 62,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#F4F3EF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  contentCardSpacer: {
    height: 120,
  },
  contentWrap: {
    marginTop: -12,
    zIndex: 2,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    marginBottom: 12,
  },
  titleSection: {
    paddingBottom: 0,
  },
  cardTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    fontWeight: '700',
    color: '#15171A',
    lineHeight: 30,
    letterSpacing: -0.6,
    marginBottom: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  typeChip: {
    borderRadius: 999,
    backgroundColor: "#F1E9DD",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeChipText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    color: "#7A5A2E",
    fontWeight: "600",
    letterSpacing: 0,
  },
  metaInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  metaInlineText: {
    fontFamily: "Poppins-Medium",
    fontSize: 13.5,
    color: '#6B7280',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 0,
    flexWrap: "wrap",
  },
  ratingDotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(20,23,26,0.08)",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FCEFD6",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(20,23,26,0.06)",
    marginTop: 14,
    overflow: "hidden",
  },
  summaryCell: {
    flex: 1,
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: "Poppins-Medium",
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(20,23,26,0.06)",
    marginVertical: 14,
  },
  summaryValue: {
    fontFamily: "Poppins-SemiBold",
    color: "#15171A",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  rating: {
    fontFamily: "Poppins-Bold",
    fontSize: 13,
    fontWeight: '700',
    color: '#15171A',
  },
  reviewCount: {
    fontFamily: "Poppins-Medium",
    fontSize: 13,
    fontWeight: "500",
    color: '#6B7280',
  },
  availabilityInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#15B27D",
  },
  availabilityDotOff: {
    backgroundColor: "#930D13",
  },
  availabilityText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    color: "#0E8E62",
  },
  availabilityTextOff: {
    color: "#930D13",
  },
  chipRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#E7F7F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#ccece2",
  },
  chipText: {
    color: "#157a6e",
    fontSize: 11,
    fontWeight: "600",
  },
  timePickerSection: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  timePickerWrapper: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(20,23,26,0.06)",
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  timePickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(21,178,125,0.25)",
    backgroundColor: "#F7FFFC",
    flex: 1,
  },
  timePickerChevron: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,178,125,0.1)",
    borderRadius: 10,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerArrow: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeLabel: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    color: '#6B7280',
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  dateTimeValue: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    fontWeight: '600',
    color: '#15171A',
    letterSpacing: -0.2,
  },
  offerBar: {
    backgroundColor: "#15202B",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  offerIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#15B27D",
    alignItems: "center",
    justifyContent: "center",
  },
  offerText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "500",
    letterSpacing: 0,
  },
  offerTextBold: {
    fontWeight: "700",
  },
  offerChevron: {
    opacity: 0.7,
  },
  tabContent: {
    flex: 1,
  },
  tabSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentSections: {
    paddingTop: 0,
  },
  sectionBlock: {
    paddingTop: 24,
    paddingBottom: 24,
  },
  sectionReadingBlock: {
    paddingHorizontal: 0,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(20,23,26,0.08)",
    marginHorizontal: 0,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  hoursRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  hoursHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  hoursToggleText: {
    fontFamily: "Poppins-Medium",
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  hoursSectionTitle: {
    // Inherits from sectionTitle
  },
  hoursRowToday: {
    backgroundColor: "#E8F6EF",
    borderRadius: 10,
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  hoursDay: {
    fontFamily: "Poppins-Medium",
    fontSize: 14.5,
    color: "#15171A",
    fontWeight: "500",
  },
  hoursDayToday: {
    color: "#0E8E62",
    fontWeight: "600",
  },
  hoursDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#15B27D",
    marginRight: 10,
  },
  hoursValue: {
    fontFamily: "Poppins-Medium",
    fontSize: 13.5,
    color: "#3A3D43",
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  hoursValueToday: {
    color: "#0E8E62",
    fontWeight: "600",
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16.5,
    fontWeight: '600',
    color: '#15171A',
    letterSpacing: -0.35,
    marginBottom: 0,
  },
  sectionBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 14.5,
    lineHeight: 23,
    color: '#3A3D43',
    fontWeight: '400',
    marginTop: 10,
  },
  sectionIntro: {
    fontFamily: "Poppins-Regular",
    fontSize: 13.5,
    lineHeight: 20,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 16,
  },
  readMore: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    fontWeight: '600',
    color: '#0E8E62',
    marginTop: 12,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureIconCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(20,23,26,0.06)",
    borderRadius: 14,
    padding: 14,
    flexDirection: "column",
    gap: 12,
  },
  featureIconTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F4F3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconLabel: {
    fontSize: 14.5,
    color: "#15171A",
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  featureIconSub: {
    fontSize: 12.5,
    color: "#6B7280",
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
    marginTop: 3,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    marginTop: 10,
  },
  hostInfo: {
    flex: 1,
  },
  hostDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  unavailable: {
    color: '#EF4444',
  },
  reviewList: {
    gap: 18,
    marginTop: 12,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewSummaryInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  reviewSummaryText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  reviewSummaryCount: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  reviewSeeAll: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0E8E62",
  },
  reviewSummaryBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  reviewRatingLarge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  reviewRatingNumber: {
    fontFamily: "Poppins-Bold",
    fontSize: 28,
    fontWeight: "700",
    color: "#15171A",
    letterSpacing: -0.5,
  },
  reviewRatingMax: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  reviewStarsBlock: {
    flexDirection: "column",
    gap: 4,
  },
  reviewStarsRowLarge: {
    flexDirection: "row",
    gap: 2,
  },
  reviewBasedOn: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  reviewCardsContainer: {
    flexDirection: "column",
    gap: 10,
  },
  reviewCardNew: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(20,23,26,0.06)",
    borderRadius: 14,
    padding: 14,
    flexDirection: "column",
    gap: 8,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1E9DD",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    fontFamily: "Poppins-Bold",
    fontSize: 13,
    fontWeight: "700",
    color: "#7A5A2E",
  },
  reviewAuthorBlock: {
    flexDirection: "column",
    gap: 1,
  },
  reviewAuthorName: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13.5,
    fontWeight: "600",
    color: "#15171A",
  },
  reviewTime: {
    fontFamily: "Poppins-Regular",
    fontSize: 11.5,
    color: "#6B7280",
    fontWeight: "500",
  },
  reviewStarsSmall: {
    flexDirection: "row",
    gap: 1.5,
  },
  reviewBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 13.5,
    lineHeight: 20,
    color: "#3A3D43",
  },
  reviewCarouselWrap: {
    marginTop: 8,
  },
  reviewCarousel: {
    gap: 12,
  },
  reviewCardWide: {
    width: 228,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 12,
  },
  reviewCardTop: {
    marginBottom: 8,
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewAge: {
    fontFamily: "Poppins-Regular",
    marginLeft: 6,
    fontSize: 11,
    color: "#6B7280",
  },
  reviewAuthor: {
    fontFamily: "Poppins-SemiBold",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  reviewCta: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F0FDF4",
  },
  reviewCtaText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewRating: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  reviewDate: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: '#6B7280',
  },
  reviewComment: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  mapContainer: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationAddress: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  locationDistance: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  authTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  authInput: {
    fontFamily: "Poppins-Regular",
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#111827',
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  authButtonSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2ECC8F',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  authButtonSecondaryText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#2ECC8F',
  },
  authButtonPrimary: {
    flex: 1,
    backgroundColor: '#2ECC8F',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  authButtonPrimaryText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vehicleSizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vehicleSizeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  accessDirectionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accessDirectionsText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#0F172A',
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FBFAF7',
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,23,26,0.06)',
  },
  priceInfo: {
    flexDirection: "column",
    gap: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  priceFrom: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  priceAmount: {
    fontFamily: "Poppins-Bold",
    fontSize: 24,
    fontWeight: '700',
    color: '#15171A',
    letterSpacing: -0.2,
  },
  priceTotal: {
    fontFamily: "Poppins-Medium",
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  priceDuration: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  bookButton: {
    flex: 1,
    maxWidth: 200,
    height: 52,
    backgroundColor: '#15B27D',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(21,178,125,0.35)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  bookButtonText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bookButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  bookButtonDisabledText: {
    fontFamily: "Poppins-Medium",
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
