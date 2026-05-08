import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import DatePicker from "react-native-date-picker";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import {
  getListing,
  listListingReviews,
  type ListingReview,
} from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import type { ListingDetail, RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import {
  formatDateTimeLabel,
  formatReviewDate,
} from "../utils/dateFormat";
import { calculateListingTotal, getListingRateType } from "../utils/pricing";
import {
  ArrowDownUp,
  Cctv,
  EvCharger,
  Home,
  Fence,
  IdCard,
  KeyRound,
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

const getFeatureSubLabel = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("cctv") || normalized.includes("camera")) return "Monitored 24/7";
  if (normalized.includes("ev") || normalized.includes("charger") || normalized.includes("charging")) return "Available on-site";
  if (normalized.includes("shelter") || normalized.includes("covered") || normalized.includes("roof")) return "Sheltered space";
  if (normalized.includes("gate") || normalized.includes("gated") || normalized.includes("barrier")) return "Secured access";
  if (normalized.includes("code") || normalized.includes("keypad") || normalized.includes("entry")) return "Code access";
  if (normalized.includes("permit")) return "Required";
  if (normalized.includes("low") || normalized.includes("clearance")) return "Under 2.1m";
  return "Included";
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

const FeatureIcon = ({ type, size = 26 }: { type: string; size?: number }) => {
  const stroke = "#0f172a";
  const sw = 1.8;
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
  const { login, register, loading: authLoading, user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
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
    return calculateListingTotal(listing, startAt, endAt);
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
  const heroHeight = Math.round(width * 0.8);
  const heroTapHeight = Math.max(0, heroHeight - 40);
  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : "0.8 km";
  const extendOffer = useMemo(() => {
    if (!listing) return null;
    if (getListingRateType(listing) !== "hourly") return null;
    const hourlyPrice =
      listing.price_per_hour != null ? Number(listing.price_per_hour) : null;
    if (hourlyPrice == null || Number.isNaN(hourlyPrice)) return null;
    const endOfDay = new Date(endAt);
    endOfDay.setHours(23, 59, 0, 0);
    if (endAt >= endOfDay) return null;
    const ms = Math.max(0, endOfDay.getTime() - endAt.getTime());
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
    const extra = hourlyPrice * hours;
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
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
            <View style={[styles.statusBarFill, { height: insets.top }]} />
            {/* Content Card */}
            <View style={[styles.heroFixed, { height: heroHeight + insets.top, top: 0 }]}>
              {imageUrls.length ? (
                <Image
                  source={{ uri: imageUrls[0] }}
                  style={{ width, height: heroHeight + insets.top }}
                />
              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight + insets.top }]}>
                  <Text style={styles.heroPlaceholderText}>No image</Text>
                </View>
              )}
              {imageUrls.length > 0 ? (
                <View style={styles.photoCounterChip}>
                  <Text style={styles.photoCounterText}>
                    {String(activeImageIndex + 1).padStart(2, '0')} / {String(imageUrls.length).padStart(2, '0')}
                  </Text>
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
                paddingTop: insets.top + 12,
                paddingBottom: bottomBarSpacer,
              }}
            >
              <View style={[styles.taxiPage, { paddingTop: heroHeight - 84 }]}>
                <View style={styles.taxiSheet}>
                  <View style={styles.taxiHandle} />

                  <Pressable
                    style={styles.airSummaryHeaderRow}
                    onPress={() => {
                      if (!imageUrls.length) return;
                      setViewerIndex(0);
                      setShowImageViewer(true);
                    }}
                  >
                    {imageUrls.length ? (
                      <Image source={{ uri: imageUrls[0] }} style={styles.airSummaryThumb} />
                    ) : (
                      <View style={[styles.airSummaryThumb, styles.taxiSummaryAvatarPlaceholder]}>
                        <Ionicons name="image-outline" size={24} color="#9AA4B5" />
                      </View>
                    )}
                    <View style={styles.airSummaryHeaderContent}>
                      <Text style={styles.airSummaryTitle} numberOfLines={2}>
                        {listing.title}
                      </Text>
                      <Text style={styles.airSummarySub}>{areaLabel}</Text>
                      <View style={styles.airReviewSummaryLine}>
                        <View style={styles.airSummaryStars}>
                          {[0, 1, 2, 3, 4].map((idx) => (
                            <Ionicons
                              key={`summary-star-${idx}`}
                              name="star"
                              size={15}
                              color="#F7BE38"
                            />
                          ))}
                        </View>
                        <Text style={styles.airReviewSummarySecondary}>
                          {hasReviews ? listing.rating?.toFixed(1) : "0.0"} rating
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.airStatsPills}>
                    <View style={styles.airStatPill}>
                      <Ionicons name="time-outline" size={14} color="#0F172A" />
                      <Text style={styles.airStatPillText}>{priceSummary?.durationLabel ?? "2 hours"}</Text>
                    </View>
                    <View style={styles.airStatPill}>
                      <Ionicons name="cash-outline" size={14} color="#0F172A" />
                      <Text style={styles.airStatPillText}>€{priceSummary?.total ?? 0}</Text>
                    </View>
                    <View style={styles.airStatPill}>
                      <Ionicons name="location-outline" size={14} color="#0F172A" />
                      <Text style={styles.airStatPillText}>{distanceLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.taxiDivider} />

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

                  {extendOffer ? (
                    <Pressable
                      style={styles.taxiPromoCard}
                      onPress={() => setEndAt(new Date(extendOffer.endOfDay))}
                    >
                      <Ionicons name="flash" size={18} color="#45C36F" />
                      <Text style={styles.taxiPromoText}>
                        Extend to 23:59 for only €{extendOffer.extra}
                      </Text>
                    </Pressable>
                  ) : null}

                  <View style={styles.taxiDivider} />

                  <View style={styles.taxiPaymentRows}>
                    <View style={styles.taxiPaymentRow}>
                      <Text style={styles.taxiPaymentLabel}>Payment option</Text>
                      <Text style={styles.taxiPaymentValue}>Pay at confirmation</Text>
                    </View>
                    <View style={styles.taxiPaymentRow}>
                      <Text style={styles.taxiPaymentLabel}>Total price</Text>
                      <Text style={styles.taxiPaymentTotal}>€{priceSummary?.total ?? 0}</Text>
                    </View>
                  </View>

                  <View style={styles.taxiSectionStack}>
                    <Pressable
                      style={styles.taxiDetailCard}
                      onPress={() => {
                        if (aboutText.length > 140) setShowFullAbout((prev) => !prev);
                      }}
                    >
                      <Text style={styles.taxiSectionTitle}>About this space</Text>
                      <Text style={styles.taxiBodyText} numberOfLines={showFullAbout ? undefined : 3}>
                        {aboutText}
                      </Text>
                    </Pressable>

                    <View style={styles.taxiDetailCard}>
                      <Text style={styles.taxiSectionTitle}>Availability</Text>
                      <Text style={styles.taxiBodyText}>{availabilityFallbackText}</Text>
                    </View>

                    <View style={styles.taxiDetailCard}>
                      <Text style={styles.taxiSectionTitle}>Included features</Text>
                      <View style={styles.taxiFeatureStack}>
                        {featureLabels.slice(0, 4).map((feature) => (
                          <View key={feature} style={styles.taxiFeatureRow}>
                            <FeatureIcon type={getFeatureIconType(feature)} size={18} />
                            <View style={styles.taxiFeatureCopy}>
                              <Text style={styles.taxiFeatureTitle}>{feature}</Text>
                              <Text style={styles.taxiFeatureSub}>{getFeatureSubLabel(feature)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.taxiDetailCard}>
                      <Text style={styles.taxiSectionTitle}>Reviews</Text>
                      {reviewsLoading ? (
                        <View style={styles.centered}>
                          <ActivityIndicator />
                        </View>
                      ) : reviews.length ? (
                        <View style={styles.taxiReviewStack}>
                          {reviews.slice(0, 3).map((review) => (
                            <View key={review.id} style={styles.taxiReviewCard}>
                              <View style={styles.reviewStarsRow}>
                                {[0, 1, 2, 3, 4].map((idx) => (
                                  <Ionicons
                                    key={`${review.id}-star-${idx}`}
                                    name="star"
                                    size={14}
                                    color={idx < Math.round(review.rating) ? "#F7BE38" : "#E5E7EB"}
                                  />
                                ))}
                                <Text style={styles.reviewAge}>
                                  {formatReviewDate(
                                    new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                                  )}
                                </Text>
                              </View>
                              <Text style={styles.reviewAuthor}>
                                {(review as { author_name?: string }).author_name ?? review.authorName ?? "Guest"}
                              </Text>
                              <Text style={styles.reviewComment}>{review.comment}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.taxiBodyText}>No reviews yet.</Text>
                      )}
                    </View>
                  </View>

                  {!user && (
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
                  )}
                </View>

                <View style={styles.contentCardSpacer} />
              </View>
            </ScrollView>

              {/* Fixed Bottom Button */}
              {priceSummary && user ? (
              <View style={[styles.airBottomBar, { paddingBottom: 18 + insets.bottom }]}>
                <View style={styles.priceInfo}>
                  <Text style={styles.airPriceLabel}>From €{priceSummary.total}</Text>
                  <Text style={styles.priceAmount}>€{priceSummary.total}</Text>
                  <Text style={styles.priceDuration}>{priceSummary.durationLabel}</Text>
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
                    <View style={styles.airBookButton}>
                      <Text style={styles.bookButtonText}>
                        {navigatingToBooking ? "Opening..." : "Book Now"}
                      </Text>
                    </View>
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
                    const currentField = pickerField;
                    const picked =
                      draftDate ?? (pickerField === "start" ? startAt : endAt);
                    const resolvedDate = applyPickedDate(picked);
                    if (currentField === "start") {
                      setPickerField("end");
                      setDraftDate(resolvedDate);
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
    backgroundColor: 'transparent',
    flex: 1,
  },
  scrollContainer: {
    backgroundColor: "transparent",
    flex: 1,
  },
  statusBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,23,42,0.48)",
    zIndex: 1,
  },
  taxiPage: {
    paddingHorizontal: 10,
    gap: 0,
  },
  taxiSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -34,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 10,
  },
  taxiHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D8DEE8",
    alignSelf: "center",
    marginBottom: 18,
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
  airSummaryHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  airSummaryTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.45,
    textAlign: "left",
    color: "#111827",
    marginBottom: 4,
  },
  airSummarySub: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
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
    color: "#6B7280",
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
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  airStatPillText: {
    fontFamily: "Inter-Medium",
    fontSize: 13,
    lineHeight: 18,
    color: "#111827",
  },
  taxiHeaderBlock: {
    gap: 8,
    marginBottom: 18,
  },
  taxiTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: -0.45,
    color: "#0F172A",
  },
  taxiHeaderCopy: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
    maxWidth: "88%",
  },
  taxiSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  taxiSummaryAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8EEF5",
  },
  taxiSummaryAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  taxiSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  taxiSummaryTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: "#111827",
    marginBottom: 2,
  },
  taxiSummarySub: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#94A3B8",
    marginBottom: 6,
  },
  taxiSummaryRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taxiSummaryRatingText: {
    fontFamily: "Inter-Medium",
    fontSize: 12,
    color: "#94A3B8",
    marginLeft: 3,
  },
  taxiStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  taxiStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  taxiStatText: {
    fontFamily: "Inter-Medium",
    fontSize: 14,
    color: "#334155",
  },
  taxiDivider: {
    height: 1,
    backgroundColor: "#EDF2F7",
    marginBottom: 18,
  },
  airRouteCard: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
  },
  taxiRouteCard: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
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
    backgroundColor: "#45C36F",
    borderWidth: 4,
    borderColor: "#DDF7E7",
  },
  taxiRouteLine: {
    width: 2,
    flex: 1,
    minHeight: 36,
    backgroundColor: "#45C36F",
    marginVertical: 4,
  },
  taxiRouteDotEnd: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#45C36F",
  },
  taxiRouteContent: {
    flex: 1,
    gap: 0,
  },
  taxiTimeEditButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ECFBF2",
    marginLeft: 8,
  },
  taxiTimeEditButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: "600",
    color: "#2F855A",
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
    backgroundColor: "#F3F4F6",
    marginLeft: 8,
  },
  airTimeEditButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
  },
  taxiRouteRow: {
    minHeight: 34,
    justifyContent: "center",
  },
  taxiRouteSpacer: {
    height: 18,
  },
  taxiRouteValue: {
    fontFamily: "Inter-Medium",
    fontSize: 15,
    lineHeight: 21,
    color: "#334155",
  },
  taxiSecondaryButton: {
    backgroundColor: "#ECFBF2",
    borderRadius: 999,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  taxiSecondaryButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: "#2F855A",
  },
  taxiPromoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  taxiPromoText: {
    flex: 1,
    fontFamily: "Inter-Medium",
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  taxiPaymentRows: {
    gap: 14,
  },
  taxiPaymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  taxiPaymentLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#64748B",
  },
  taxiPaymentValue: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  taxiPaymentTotal: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  taxiSectionStack: {
    gap: 0,
    marginTop: 18,
  },
  taxiDetailCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
  },
  taxiSectionTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  taxiBodyText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  taxiFeatureStack: {
    gap: 10,
  },
  taxiFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  taxiFeatureCopy: {
    flex: 1,
  },
  taxiFeatureTitle: {
    fontFamily: "Inter-Medium",
    fontSize: 14,
    color: "#1F2937",
  },
  taxiFeatureSub: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  taxiReviewStack: {
    gap: 10,
  },
  taxiReviewCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    position: "relative",
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
  sectionStackLegacy1: {
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
  reviewBody: {
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
  airBottomBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 16,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },
  airPriceLabel: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: "#111827",
    textDecorationLine: "underline",
  },
  airBookButton: {
    minHeight: 58,
    minWidth: 178,
    borderRadius: 999,
    backgroundColor: "#0E8E62",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  favoriteButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  favoriteIcon: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },
  favoriteIconActive: {
    color: '#111827',
  },
  favAnimOverlay: {
    position: 'absolute',
    width: 62,
    height: 62,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#F6F5F2',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 0,
    paddingBottom: 18,
    paddingHorizontal: 0,
  },
  contentCardSpacer: {
    height: 120,
  },
  contentWrap: {
    marginTop: -28,
    zIndex: 2,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#F0D57A",
    marginBottom: 14,
  },
  heroTitleBlock: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    gap: 10,
  },
  heroTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  heroTag: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8D8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroTagText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    fontWeight: "600",
    color: "#8B6500",
    letterSpacing: 0.2,
  },
  heroTagAlt: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8D8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroTagAltText: {
    fontFamily: "Inter-Medium",
    fontSize: 11,
    fontWeight: "500",
    color: "#635B4A",
    letterSpacing: 0.15,
  },
  cardTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 27,
    fontWeight: '600',
    color: '#171717',
    lineHeight: 32,
    letterSpacing: -0.45,
  },
  cardSubtitle: {
    fontFamily: "Inter-Regular",
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },
  heroSubAddress: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#70695D",
    lineHeight: 20,
    marginTop: 2,
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  ratingBlockCell: {
    alignItems: 'center',
    gap: 4,
  },
  ratingBlockNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  ratingBlockStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingBlockLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#6B7280',
  },
  ratingBlockDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  infoRows: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowText: {
    fontFamily: "Inter-Regular",
    fontSize: 15,
    color: '#15171A',
    fontWeight: '400',
    flex: 1,
  },
  infoRowRating: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: '600',
    color: '#15171A',
  },
  infoRowMuted: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoRowDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  infoRowAvail: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: '600',
    color: '#12916C',
  },
  infoRowAvailOff: {
    color: '#B91C1C',
  },
  availDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#12916C',
  },
  availDotOff: {
    backgroundColor: '#EF4444',
  },
  availabilityPill: {
    borderRadius: 999,
    backgroundColor: "#E7F7F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availabilityPillOff: {
    backgroundColor: "#FEECEC",
  },
  availabilityPillText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    fontWeight: "600",
    color: "#0E8E62",
    letterSpacing: 0.35,
  },
  availabilityPillTextOff: {
    color: "#A12D2F",
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8D8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    fontFamily: "Inter-Medium",
    fontSize: 12,
    fontWeight: "500",
    color: "#594F39",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF8E8",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryStripWrap: {
    marginHorizontal: 24,
    marginBottom: 10,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EFE8D8',
    paddingVertical: 14,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 1,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 3,
  },
  summaryLabel: {
    fontFamily: "Inter-SemiBold",
    color: '#9B7B1D',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#EEDB94',
  },
  summaryValue: {
    fontFamily: "Inter-SemiBold",
    color: '#1C1C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  rating: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    fontWeight: '600',
    color: '#15171A',
  },
  reviewCount: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: '#6B7280',
  },
  quickInfoCard: {
    marginHorizontal: 24,
    marginBottom: 10,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0D57A",
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 1,
  },
  quickInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickInfoPrimary: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  quickInfoSecondary: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#776F60",
  },
  todayPill: {
    borderRadius: 999,
    backgroundColor: "#136F63",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  todayPillText: {
    fontFamily: "Inter-Bold",
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.15,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E9EDF2",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDF2",
    marginTop: 2,
    marginBottom: 0,
  },
  locationIconWrap: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
  },
  locationTitle: {
    fontFamily: "Inter-Medium",
    fontSize: 15,
    fontWeight: "500",
    color: "#B88400",
    marginBottom: 3,
  },
  locationSubtitle: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#726E63",
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
    fontFamily: "Poppins-Medium",
    fontSize: 12,
    fontWeight: '600',
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
  },
  timePickerWrapper: {
    overflow: "visible",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8D8",
    padding: 10,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 1,
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  timePickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEE7D6',
    backgroundColor: "#FAFAF8",
    overflow: "hidden",
  },
  timePickerChevron: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerArrow: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeLabel: {
    fontFamily: "Inter-Medium",
    fontSize: 10,
    color: '#8F7A36',
    textTransform: 'uppercase',
    letterSpacing: 0.65,
    fontWeight: '600',
    marginBottom: 3,
  },
  dateTimeValue: {
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1C',
  },
  offerBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0D57A',
    marginTop: 8,
  },
  offerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingRight: 14,
  },
  offerBoltCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  offerChevron: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  offerText: {
    color: "#2C2B25",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Inter-Regular",
    lineHeight: 18,
  },
  offerTextBold: {
    color: "#111111",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#15171A',
  },
  tabContent: {
    flex: 1,
  },
  tabSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentSections: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  sectionStack: {
    gap: 14,
  },
  sectionBlock: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  sectionSurface: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#EFE8D8",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 1,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EFE8D7',
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  hoursHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  hoursToggleText: {
    fontFamily: "Inter-SemiBold",
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  hoursSectionTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  hoursRowToday: {
    backgroundColor: "#FFF7DB",
    borderRadius: 0,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  hoursDay: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#111827",
    fontWeight: "400",
  },
  hoursDayToday: {
    color: "#A47A00",
  },
  hoursValue: {
    fontFamily: "Inter-Medium",
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  hoursValueToday: {
    color: "#A47A00",
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sectionTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    letterSpacing: -0.2,
    marginBottom: 0,
  },
  sectionBody: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: '#5F5A4F',
    fontWeight: '400',
    marginTop: 6,
  },
  readMore: {
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: '600',
    color: '#B88400',
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 16,
  },
  featureIconCard: {
    width: '47.5%',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  featureIconLabel: {
    fontSize: 12,
    color: "#15171A",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    textAlign: "center",
    marginTop: 4,
  },
  featureIconSub: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "400",
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  featuresList2: {
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FAFAF8",
  },
  featureRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  featureRow2Border: {
    borderTopWidth: 1,
    borderTopColor: "#EEE7D6",
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF6D8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel2: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  featuresList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,23,26,0.08)',
    overflow: 'hidden',
    marginTop: 12,
  },
  featureListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  featureListRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,23,26,0.08)',
  },
  featureListIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDEBE4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureListLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#15171A',
    fontFamily: "Inter-Medium",
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCheckText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E8E62',
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FAFAF8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE7D6',
    padding: 14,
    marginTop: 6,
  },
  availabilityCardLeft: {
    gap: 2,
  },
  availabilityOpenLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0E8E62',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: "Inter-SemiBold",
  },
  availabilityOpenValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15171A',
    fontFamily: "Inter-Bold",
    letterSpacing: -0.35,
  },
  availabilityDayStrip: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  availabilityDayCell: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityDayCellToday: {
    backgroundColor: '#15B27D',
  },
  availabilityDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    fontFamily: "Poppins-Medium",
  },
  availabilityDayLabelToday: {
    color: '#FFFFFF',
  },
  photoCounterChip: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoCounterText: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.8,
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
    marginTop: 14,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewSummaryText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  reviewSummaryCount: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  reviewCarouselWrap: {
    marginTop: 10,
  },
  reviewCarousel: {
    paddingRight: 12,
    gap: 12,
  },
  reviewCardWide: {
    width: 250,
    backgroundColor: "#FAFAF8",
    borderWidth: 1,
    borderColor: '#EEE7D6',
    padding: 14,
    borderRadius: 18,
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
    fontFamily: "Inter-Regular",
    marginLeft: 6,
    fontSize: 11,
    color: "#6B7280",
  },
  reviewAuthor: {
    fontFamily: "Inter-Medium",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
  },
  reviewCta: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F0D57A',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  reviewCtaText: {
    color: '#8B6500',
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.15,
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
    backgroundColor: '#FFFFFF',
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 0,
    elevation: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  priceInfo: {
    flex: 1,
  },
  priceAmount: {
    fontFamily: "Inter-Bold",
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  priceDuration: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '400',
  },
  bookButton: {
    overflow: 'hidden',
    borderRadius: 999,
    flex: 1,
    maxWidth: 180,
    backgroundColor: '#0F172A',
  },
  bookButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bookButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  bookButtonDisabledText: {
    fontFamily: "Poppins-Medium",
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  titleBlockInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlockLeft: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  spaceTypePill: {
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1FBA4C',
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  spaceTypePillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: '#1FBA4C',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1FBA4C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listingTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  listingTabItem: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  listingTabItemActive: {
    borderBottomColor: '#1FBA4C',
  },
  listingTabLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  listingTabLabelActive: {
    color: '#101418',
  },
  metaInfoSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaInfoText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1C',
  },
  metaInfoDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A8AEB5',
  },
  metaOpenText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#B88400',
  },
  metaAddressText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    fontWeight: '400',
    color: '#7C766A',
    flex: 1,
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  galleryTab: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryThumb: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  galleryEmpty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  galleryEmptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },
});
