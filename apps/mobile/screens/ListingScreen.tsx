/**
 * The listing page.
 *
 * Rules the layout holds to, so a change can be checked against them:
 *   - centred masthead, three stats: rating, price, distance
 *   - plain lists on white, separated by inset rules — no cards, no borders
 *   - one list shape: 20px outline icon, 16 gap, 15px label
 *   - one button shape: full-width grey pill under each list
 *   - 26 title / 19 section / 15 body
 *
 * Where the API has no value for something the design shows, the element is
 * omitted rather than faked — see the notes at each site. Nothing here invents
 * a statistic.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  InteractionManager,
  ScrollView,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFavorites } from "../favorites";
import { useAuth } from "../auth";
import { SkeletonBlock, usePulse } from "../components/ui";
import { addMinutes, roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import { MapTimePickerSheet } from "../components/MapTimePickerSheet";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Car,
  Cctv,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Fence,
  KeyRound,
  Lightbulb,
  Heart,
  Images,
  Star,
  MapPin,
  Share2,
  ShieldCheck,
  X,
  Tag,
  Warehouse,
  type LucideIcon,
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";
import { getListing, listListingReviews, type ListingReview } from "../api";
import {
  calculateListingTotal,
  formatPriceValue,
  getListingPriceUnitLabel,
  getListingUnitPrice,
  getMonthlyGrossEuro,
} from "../utils/pricing";
import { humanizeAmenity } from "../utils/amenities";
import { CANCELLATION_FREE_CUTOFF_MS } from "../utils/cancellationPolicy";
import { formatDateLabel, formatTimeLabel, formatReviewDate } from "../utils/dateFormat";

import {
  ACCENT_SOFT,
  GREEN,
  GREEN_DARK,
  INK,
  MAP_GROUND,
  MUTED,
  PILL,
  RULE,
  WHITE,
} from "../styles/pageTokens";
import { colors } from "../styles/theme";
import {
  FactRow,
  ListRow,
  PillButton,
  Rule,
  ScrollHeader,
  SectionTitle,
  useScrollHeader,
} from "../components/ui/page";
// The theme's avatar palette, picked by first letter so a given name always
// gets the same colour — same behaviour as every other avatar in the app.
const avatarFill = (name: string) =>
  colors.avatarFills[(name.charCodeAt(0) || 0) % colors.avatarFills.length];

// Lines of description shown before "Read more" takes over.
const DESCRIPTION_LINES = 3;

// Read from the policy module rather than written out: the design says "2
// hours", the code says 4, and the code is what actually refunds people.
const FREE_CANCELLATION_HOURS = CANCELLATION_FREE_CUTOFF_MS / (60 * 60 * 1000);
const FREE_CANCELLATION_TEXT = `Free cancellation up to ${FREE_CANCELLATION_HOURS} hours before.`;

/**
 * Glass over the photo, solid over content. Dark glass on white is the one
 * state these must never show, so both icon colours are stacked and cross-
 * faded rather than swapped.
 */
function HeaderFadeButton({
  solidOpacity,
  onPress,
  icon,
  label,
}: {
  solidOpacity: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
  icon: (color: string) => React.ReactNode;
  label: string;
}) {
  return (
    <Pressable
      style={styles.glassBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* The dark disc is only there to hold contrast against a photo. Once
          the white bar is behind the icon it has nothing to do, so it leaves
          rather than becoming a white circle on white. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.glassBtnDisc,
          {
            opacity: solidOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
      />
      <View>
        {icon(WHITE)}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: solidOpacity }]}>
          {icon(INK)}
        </Animated.View>
      </View>
    </Pressable>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const FEATURE_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /gate|fence/i, icon: Fence },
  { match: /cctv|camera/i, icon: Cctv },
  { match: /lit|light/i, icon: Lightbulb },
  { match: /cover|garage|indoor/i, icon: Warehouse },
  { match: /ev|charg/i, icon: BatteryCharging },
];

function featureIcon(label: string): LucideIcon {
  return FEATURE_ICONS.find((entry) => entry.match.test(label))?.icon ?? Check;
}

export function ListingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { id, mode: routeMode } = route.params;
  const { isFavorite, toggle } = useFavorites();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { user } = useAuth();
  const skeletonPulse = usePulse();
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  // Same proportion the old listing screen used, so the crop reads the same.
  const heroHeight = Math.round(screenWidth * 0.8);

  const [listing, setListing] = useState<Awaited<ReturnType<typeof getListing>> | null>(null);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  // How many lines the full copy runs to, from a real layout pass. Null until
  // measured.
  const [descriptionLineCount, setDescriptionLineCount] = useState<number | null>(null);

  const [startAt, setStartAt] = useState(() => new Date(route.params.from ?? Date.now()));
  const [endAt, setEndAt] = useState(
    () => new Date(route.params.to ?? Date.now() + 60 * 60 * 1000)
  );
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  // The tap layer sits over the photo, so it has to stand down once the sheet
  // has covered it — otherwise it eats scrolls aimed at the content.
  const [heroTapEnabled, setHeroTapEnabled] = useState(true);
  const heroTapEnabledRef = useRef(true);
  const heroTotalForHeader = heroHeight + insets.top;
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const heroListRef = useRef<FlatList<string>>(null);
  const heroSwipeRef = useRef<ScrollView>(null);
  const viewerDragY = useRef(new Animated.Value(0)).current;
  const header = useScrollHeader({
    barRange: [heroHeight - 140, heroHeight - 90],
    titleRange: [heroTotalForHeader - 20, heroTotalForHeader + 40],
    // The tap layer over the photo has to stand down once the sheet covers it,
    // or it eats scrolls meant for the content.
    listener: (event) => {
      const next = event.nativeEvent.contentOffset.y < heroHeight - 60;
      if (next !== heroTapEnabledRef.current) {
        heroTapEnabledRef.current = next;
        setHeroTapEnabled(next);
      }
    },
  });
  const scrollY = header.scrollY;
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");

  const openPicker = useCallback((field: "start" | "end") => {
    setPickerField(field);
    setPickerVisible(true);
  }, []);

  // Lifted verbatim from ListingScreen so the two screens agree on what a
  // valid window is: moving "from" past "to" drags "to" two hours out, and
  // "to" can never land less than an hour after "from".
  const applyPickedDate = useCallback(
    (next: Date) => {
      if (pickerField === "start") {
        setStartAt(next);
        if (next > endAt) {
          const bumped = new Date(next);
          bumped.setHours(bumped.getHours() + 2);
          setEndAt(bumped);
        }
        return;
      }
      const minEnd = new Date(startAt);
      minEnd.setHours(minEnd.getHours() + 1);
      setEndAt(next < minEnd ? minEnd : next);
    },
    [pickerField, startAt, endAt]
  );

  const pickerMinimumDate = useMemo(
    () =>
      pickerField === "start"
        ? roundUpToMinuteInterval(new Date(), 5)
        : addMinutes(startAt, 60),
    [pickerField, startAt]
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getListing(id, {
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
        if (mountedRef.current) setListing(data);
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load listing");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    void load();
  }, [id, startAt, endAt]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listListingReviews(id);
        if (mountedRef.current) setReviews(data);
      } catch {
        if (mountedRef.current) setReviews([]);
      }
    };
    void load();
  }, [id]);

  /**
   * A monthly space: the host set a monthly rate and either the caller asked
   * for the monthly lane or there is no hourly rate to fall back on. The term
   * is always a single calendar month, so the window is derived, not picked.
   */
  const isMonthly =
    !!listing &&
    Number(listing.price_per_month) > 0 &&
    (routeMode === "monthly" || !(Number(listing.price_per_hour) > 0));
  // Fee-inclusive, so this page and checkout quote the same number.
  const monthlyPrice = getMonthlyGrossEuro(Number(listing?.price_per_month ?? 0));
  const monthlyEnd = useMemo(() => {
    const end = new Date(startAt);
    end.setMonth(end.getMonth() + 1);
    return end;
  }, [startAt]);

  const priceSummary = useMemo(
    () => (listing ? calculateListingTotal(listing, startAt, endAt) : null),
    [listing, startAt, endAt]
  );

  const featureLabels = useMemo(
    () => Array.from(new Set((listing?.amenities ?? []).filter(Boolean).map(humanizeAmenity))),
    [listing?.amenities]
  );

  // The host's own declaration, never a guess — silent when they skipped it.
  const vehicleFitLabel = useMemo(() => {
    // Both spellings: `getListing` does not normalise this one, so the wire's
    // camelCase is the only key that actually arrives. Reading only the
    // snake_case form meant the host's declaration never showed at all.
    const source = listing as
      | { vehicle_size_suitability?: string; vehicleSizeSuitability?: string }
      | null;
    const raw = (
      source?.vehicle_size_suitability ?? source?.vehicleSizeSuitability ?? ""
    ).toLowerCase();
    if (raw.includes("motor") || raw.includes("bike")) return "Fits a motorbike";
    if (raw.includes("van") || raw.includes("large")) return "Fits a van or large SUV";
    if (raw.includes("car")) return "Fits a standard car";
    return null;
  }, [listing]);

  const allFeatures = useMemo(
    () => [...featureLabels, ...(vehicleFitLabel ? [vehicleFitLabel] : [])],
    [featureLabels, vehicleFitLabel]
  );
  const visibleFeatures = showAllFeatures ? allFeatures : allFeatures.slice(0, 6);

  // Everything past the street — "Portobello, Dublin 8". The street itself is
  // dropped: it's already carried by the title, and the house number on it is
  // part of the exact address, which is withheld until booking.
  // "Ranelagh, Dublin". The country is dropped — every listing is in Ireland,
  // so naming it spends a line on nothing. The old version also sliced off the
  // FIRST part assuming it was a street, which threw away the locality on an
  // address like "Ranelagh, Dublin, Ireland" and left the useless "Dublin,
  // Ireland".
  const areaLabel = useMemo(() => {
    const parts = (listing?.address ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^(ireland|éire|eire)$/i.test(part));
    // Drop a leading house number + street only when something is left after
    // it, so a one-line address still says where it is.
    const hasStreetNumber = /^\d/.test(parts[0] ?? "");
    const useful = hasStreetNumber && parts.length > 1 ? parts.slice(1) : parts;
    return useful.join(", ");
  }, [listing?.address]);

  const titleLabel = listing?.title?.trim() || "Parking space";

  // The host's declared type, or nothing. This used to be inferred from words
  // in their title, which invented a fact — a space called "Ranelagh parking"
  // is not necessarily a driveway. Listings that carry the field will show it.
  const spaceTypeLabel = useMemo(() => {
    const raw =
      (listing as { space_type?: string; spaceType?: string } | null)?.space_type ??
      (listing as { space_type?: string; spaceType?: string } | null)?.spaceType ??
      null;
    return raw?.trim() || null;
  }, [listing]);

  /**
   * "Private driveway in Portobello, Dublin 8" when the host declared a type,
   * otherwise just the place. Never repeats a type the title already states.
   */
  const locationLabel = useMemo(() => {
    if (!spaceTypeLabel) return areaLabel;
    const title = (listing?.title ?? "").toLowerCase();
    const echoesTitle = spaceTypeLabel
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .some((word) => title.includes(word));
    if (echoesTitle) return areaLabel;
    return areaLabel ? `${spaceTypeLabel} in ${areaLabel}` : spaceTypeLabel;
  }, [listing?.title, spaceTypeLabel, areaLabel]);

  // The design shows "6 min walk". `distance_m` is straight-line from the search
  // origin, which cannot honestly be converted to a walking time in a city of
  // one-ways and quays — so the stat states the distance itself.
  const distanceKm =
    typeof listing?.distance_m === "number" ? listing.distance_m / 1000 : null;

  const ratingValue = listing?.rating ?? null;
  const reviewCount = listing?.rating_count ?? reviews.length;
  const hasReviews = reviewCount > 0 && ratingValue !== null;
  const topReview = reviews.find((review) => review.comment?.trim());

  /**
   * The masthead always shows three columns — a row of one or two looks
   * broken, and "0 Reviews" is worse than not raising the subject.
   *
   * So the row is filled from an ordered list of facts that are actually true
   * of this listing, and the first three win. A space with no reviews says it
   * is new and falls through to its price, rather than reporting a zero.
   */
  const stats = useMemo(() => {
    const candidates: { key: string; value: string; label: string }[] = [];

    if (hasReviews) {
      candidates.push({
        key: "rating",
        value: (ratingValue as number).toFixed(1),
        label: "Rating",
      });
    } else {
      // Stated, not scored. "New" is a fact about the listing; a 0 or a dash
      // in a rating column reads as a bad score rather than an absent one.
      candidates.push({ key: "new", value: "New", label: "Space" });
    }

    // Unit and label both come from the pricing module, so a day-rate space
    // is never labelled "Per hour".
    const unitPrice = listing ? getListingUnitPrice(listing) : 0;
    if (unitPrice > 0 && listing) {
      candidates.push({
        key: "rate",
        value: `€${formatPriceValue(unitPrice)}`,
        label: getListingPriceUnitLabel(listing) === "hr" ? "Per hour" : "Per day",
      });
    }

    if (distanceKm !== null) {
      candidates.push({
        key: "away",
        value: `${distanceKm.toFixed(1)} km`,
        label: "Away",
      });
    }

    // Below the design's three, so it only surfaces when one of them is
    // missing — a review count is still worth more than a platform truism.
    if (hasReviews) {
      candidates.push({
        key: "reviews",
        value: String(reviewCount),
        label: reviewCount === 1 ? "Review" : "Reviews",
      });
    }

    // Round-the-clock access is a real differentiator and the seeded stock
    // mostly has it — better than a generic platform fact.
    const availability = (
      (listing as { availability_text?: string } | null)?.availability_text ?? ""
    ).trim();
    if (/24\s*\/?\s*7|24\s*hours|every day|monday\s*[-–]\s*sunday/i.test(availability)) {
      candidates.push({ key: "always", value: "24/7", label: "Access" });
    }

    // What actually fits, when the host said. Concrete where "Instant Booking"
    // is not.
    if (listing?.capacity && Number(listing.capacity) > 0) {
      const spaces = Number(listing.capacity);
      candidates.push({
        key: "capacity",
        value: String(spaces),
        label: spaces === 1 ? "Space" : "Spaces",
      });
    }

    // Last resort so the row still fills when a listing arrives with none of
    // the above. True of every listing on the platform.
    candidates.push({ key: "instant", value: "Instant", label: "Booking" });

    return candidates.slice(0, 3);
  }, [hasReviews, ratingValue, reviewCount, distanceKm, listing]);

  const descriptionText = listing?.description?.trim() ?? "";
  const descriptionIsLong = (descriptionLineCount ?? 0) > DESCRIPTION_LINES;
  const isDescriptionClamped = descriptionIsLong && !showFullDescription;

  /**
   * Cut proportionally: three lines out of N is roughly three-Nths of the
   * characters, since every line but the last is full. Backed off by a margin
   * for "… Read more" and then trimmed to a word boundary, so the copy never
   * breaks mid-word.
   */
  const collapsedDescription = useMemo(() => {
    if (!descriptionIsLong) return descriptionText;
    const ratio = DESCRIPTION_LINES / (descriptionLineCount as number);
    const target = Math.floor(descriptionText.length * ratio) - 14;
    if (target <= 0) return descriptionText;
    const cut = descriptionText.slice(0, target);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
  }, [descriptionIsLong, descriptionText, descriptionLineCount]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  /**
   * Closing leaves the hero on whatever photo the viewer ended on, so the two
   * never fall out of sync.
   */
  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setHeroPhotoIndex(viewerIndex);
    heroListRef.current?.scrollToOffset({
      offset: viewerIndex * screenWidth,
      animated: false,
    });
    heroSwipeRef.current?.scrollTo({
      x: viewerIndex * (screenWidth - 24),
      animated: false,
    });
  }, [viewerIndex, screenWidth]);

  // `closeViewer` reads `viewerIndex`, which changes as the user pages, so a
  // ref keeps the release handler pointed at the latest one.
  const closeViewerRef = useRef(closeViewer);
  closeViewerRef.current = closeViewer;

  const viewerBackdropOpacity = viewerDragY.interpolate({
    inputRange: [0, screenHeight * 0.6],
    outputRange: [1, 0.1],
    extrapolate: "clamp",
  });

  const settleViewerDrag = (g: { dy: number; vy: number }) => {
    if (g.dy > 120 || g.vy > 0.6) {
      Animated.timing(viewerDragY, {
        toValue: screenHeight,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        viewerDragY.setValue(0);
        closeViewerRef.current();
      });
    } else {
      Animated.spring(viewerDragY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
    }
  };

  const viewerPan = useRef(
    PanResponder.create({
      // Taps (the close button) must pass straight through.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // The horizontal list is a ScrollView and claims the touch first, so this
      // intercepts in the capture phase — but only once a drag is clearly
      // vertical, so page swipes still reach the list. Grab early (small dy) or
      // the ScrollView wins the gesture and never lets go.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => viewerDragY.setValue(Math.max(0, g.dy)),
      // Once we own the drag, don't hand it back, and block the native
      // responder so the list can't reclaim mid-swipe.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderRelease: (_e, g) => settleViewerDrag(g),
      onPanResponderTerminate: (_e, g) => settleViewerDrag(g),
    })
  ).current;

  if (loading) {
    // Mirrors the real layout rather than spinning: hero, then the masthead's
    // title / location / stat row, then the first section. A spinner tells you
    // nothing about what is arriving.
    return (
      <View style={styles.screen}>
        <SkeletonBlock height={heroHeight + insets.top} borderRadius={0} pulse={skeletonPulse} />
        <View style={styles.skeletonSheet}>
          <SkeletonBlock height={31} width="72%" borderRadius={8} pulse={skeletonPulse} />
          <SkeletonBlock height={22} width="52%" borderRadius={8} pulse={skeletonPulse} style={styles.skeletonGap} />
          <View style={styles.skeletonStats}>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} height={48} borderRadius={8} pulse={skeletonPulse} style={styles.skeletonStat} />
            ))}
          </View>
          <SkeletonBlock height={22} width="40%" borderRadius={8} pulse={skeletonPulse} style={styles.skeletonSection} />
          <SkeletonBlock height={92} borderRadius={10} pulse={skeletonPulse} style={styles.skeletonGap} />
        </View>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.knowLine}>{error ?? "Listing unavailable"}</Text>
      </View>
    );
  }

  /**
   * Falls back to Street View when a host hasn't uploaded photos. A real
   * picture of the kerb is more use than a grey box, and it is the same
   * imagery the map screens already show.
   */
  const heroImages: string[] = listing.image_urls?.length
    ? listing.image_urls
    : mapsKey && listing.latitude && listing.longitude
      ? [
          `https://maps.googleapis.com/maps/api/streetview?size=1280x720` +
            `&location=${listing.latitude},${listing.longitude}` +
            `&fov=65&source=outdoor&key=${mapsKey}`,
        ]
      : [];
  const heroTotal = heroHeight + insets.top;

  // Pull down: the photo stretches to fill the rubber-band gap, scaled so its
  // bottom edge stays glued to the sheet. Scroll up: it recedes at a third of
  // content speed, so the sheet visibly rides over it.
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
  const headerSolidOpacity = header.barOpacity;


  const handleShare = async () => {
    try {
      await Share.share({
        message: `${listing.title ?? "Parking space"} on FreeSpace`,
      });
    } catch {
      // A dismissed share sheet is not an error worth surfacing.
    }
  };

  return (
    <View style={styles.screen}>
      {/* ── Hero, fixed behind the scroll ── */}
      <Animated.View
        style={[
          styles.heroFixed,
          {
            height: heroTotal,
            transform: [{ translateY: heroTranslateY }, { scale: heroStretch }],
          },
        ]}
      >
        {heroImages.length ? (
          <FlatList
            ref={heroListRef}
            data={heroImages}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={{ width: screenWidth, height: heroTotal }}
                resizeMode="cover"
              />
            )}
          />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]} />
        )}
        {/* A count, not dots: dots stop being readable past four photos and
            "3 / 9" is the more useful fact anyway. */}
        {heroImages.length > 1 ? (
          <View style={styles.heroPhotoCount} pointerEvents="none">
            <Images size={13} color={WHITE} strokeWidth={2.2} />
            <Text style={styles.heroPhotoCountText}>
              {`${heroPhotoIndex + 1} / ${heroImages.length}`}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        scrollEventThrottle={16}
        onScroll={header.onScroll}
      >
        {/* Spacer, not the photo: the hero is fixed behind this scroll view,
            so the sheet below slides up over a photo that stays put. */}
        <View style={{ height: heroTotal - 20 }} pointerEvents="none" />

        <View style={styles.sheet}>
        {/* ── Centred masthead ── */}
        <View style={styles.masthead}>
          <Text style={styles.title}>{titleLabel}</Text>
          {locationLabel ? (
            <View style={styles.subtitleRow}>
              <MapPin size={15} color={MUTED} strokeWidth={2} />
              <Text style={styles.subtitle}>{locationLabel}</Text>
            </View>
          ) : null}

          {/* Three equal thirds. Rendered from `stats`, so the dividers
              always land on the thirds and the row can never come out short. */}
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <Fragment key={stat.key}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  {/* The rating column carries a star where the others carry a
                      word — the glyph says "rating" faster than the word does,
                      and it sits in the label's slot so the row still aligns. */}
                  {stat.key === "rating" ? (
                    <View style={styles.statLabelIcon}>
                      <Star size={15} color={GREEN} fill={GREEN} strokeWidth={0} />
                    </View>
                  ) : (
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  )}
                </View>
              </Fragment>
            ))}
          </View>

          {/* Two chips at most, and only when each is genuinely true of this
              booking: the day rate has to actually apply, and cancellation is
              free on every listing on the platform. No invented offers. */}
          <View style={styles.chips}>
            {priceSummary?.dailyCapApplied ? (
              <View style={[styles.chip, styles.chipAccent]}>
                <Tag size={14} color={GREEN_DARK} strokeWidth={2} />
                <Text style={styles.chipAccentText}>
                  {`Save €${formatPriceValue(priceSummary.dailyCapSavingGross)} on the day rate`}
                </Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <ShieldCheck size={16} color={INK} strokeWidth={1.8} />
              <Text style={styles.chipText}>Free cancellation</Text>
            </View>
          </View>

          {descriptionText ? (
            <>
              {/* Measure pass: unclamped and invisible, purely to count how
                  many lines the copy runs to. Deliberately does NOT read
                  `lines[].text` — the New Architecture leaves that empty, and
                  relying on it silently disabled this control. Line COUNT is
                  populated on both architectures. */}
              {descriptionLineCount === null ? (
                <Text
                  style={[styles.description, styles.descriptionMeasure]}
                  onTextLayout={(event) =>
                    setDescriptionLineCount(event.nativeEvent.lines.length)
                  }
                >
                  {descriptionText}
                </Text>
              ) : null}

              {/* No numberOfLines when collapsed: the string has already been
                  cut, so clamping could only hide the link that follows it. */}
              <Text style={styles.description}>
                {isDescriptionClamped ? collapsedDescription : descriptionText}
                {descriptionIsLong ? (
                  <Text
                    style={styles.descriptionToggleLabel}
                    onPress={() => setShowFullDescription((prev) => !prev)}
                    suppressHighlighting
                  >
                    {showFullDescription ? "  Show less" : "… Read more"}
                  </Text>
                ) : null}
              </Text>
            </>
          ) : null}
        </View>

        <Rule />

        {/* ── Parking window ── */}
        <SectionTitle>Your parking window</SectionTitle>
        <View style={styles.windowBody}>
          {/* Each end of the window is its own bordered, tinted field with a
              chevron — the update makes them read as two controls you press,
              not two facts printed side by side. */}
          <View style={styles.window}>
            <Pressable
              style={styles.windowCol}
              onPress={() => openPicker("start")}
              accessibilityRole="button"
              accessibilityLabel="Change arrival time"
            >
              <Text style={styles.windowLabel}>{isMonthly ? "Start" : "Arriving"}</Text>
              <View style={styles.windowValueRow}>
                <Text style={styles.windowTime}>
                  {isMonthly ? formatDateLabel(startAt) : formatTimeLabel(startAt)}
                </Text>
                <ChevronDown size={16} color={INK} strokeWidth={2} />
              </View>
              {isMonthly ? null : (
                <Text style={styles.windowDate}>{formatDateLabel(startAt)}</Text>
              )}
            </Pressable>
            <View style={styles.windowArrow}>
              <ArrowRight size={16} color={GREEN} strokeWidth={2.2} />
            </View>
            <Pressable
              style={styles.windowCol}
              onPress={() => openPicker("end")}
              accessibilityRole="button"
              accessibilityLabel="Change departure time"
            >
              <Text style={styles.windowLabel}>{isMonthly ? "Until" : "Leaving"}</Text>
              <View style={styles.windowValueRow}>
                <Text style={styles.windowTime}>
                  {isMonthly ? formatDateLabel(monthlyEnd) : formatTimeLabel(endAt)}
                </Text>
                {/* Derived (start + 1 month), so it is shown, not editable. */}
                {isMonthly ? null : <ChevronDown size={16} color={INK} strokeWidth={2} />}
              </View>
              {isMonthly ? null : (
                <Text style={styles.windowDate}>{formatDateLabel(endAt)}</Text>
              )}
            </Pressable>
          </View>
          {/* Duration and total in one tinted strip. The struck price only
              appears when the day rate actually beat the hourly total — it is
              a real saving on this window, not a permanent decoration. */}
          <View style={styles.windowSummary}>
            <Clock size={16} color={MUTED} strokeWidth={1.9} />
            <Text style={styles.windowSummaryDuration}>
              {isMonthly ? "1 month" : priceSummary?.durationLabel ?? ""}
            </Text>
            {priceSummary?.dailyCapApplied ? (
              <Text style={styles.windowSummaryWas}>
                {`€${formatPriceValue(
                  priceSummary.grossTotal + priceSummary.dailyCapSavingGross
                )}`}
              </Text>
            ) : null}
            <Text style={styles.windowSummaryTotal}>
              {`€${formatPriceValue(isMonthly ? monthlyPrice : priceSummary?.grossTotal ?? 0)}`}
            </Text>
          </View>
        </View>

        {allFeatures.length > 0 ? (
          <>
            <Rule />
            <SectionTitle>What this space offers</SectionTitle>
            <View style={styles.listBody}>
              {visibleFeatures.map((label) => (
                <ListRow key={label} icon={featureIcon(label)} label={label} />
              ))}
            </View>
            {allFeatures.length > 6 && !showAllFeatures ? (
              <>
                <View style={styles.pillSpacer} />
                <PillButton
                  label={`Show all ${allFeatures.length} features`}
                  onPress={() => setShowAllFeatures(true)}
                />
              </>
            ) : null}
          </>
        ) : null}

        {/* ── Where you'll park ── */}
        <Rule />
        <SectionTitle>Where you&apos;ll park</SectionTitle>
        <View style={styles.sectionBody}>
          <Text style={styles.muted}>
            Approximate area — the exact spot is shared on booking
          </Text>
          <View style={styles.map}>
            {listing.latitude && listing.longitude ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                initialRegion={{
                  latitude: Number(listing.latitude),
                  longitude: Number(listing.longitude),
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                }}
              >
                {/* Halo, not a pin — the exact address is withheld until
                    booking, so the marker must read "around here". */}
                <Marker
                  coordinate={{
                    latitude: Number(listing.latitude),
                    longitude: Number(listing.longitude),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.mapMarker}>
                    <View style={styles.mapHalo} />
                    <View style={styles.mapBubble}>
                      <MapPin size={14} color={WHITE} strokeWidth={2.2} />
                    </View>
                  </View>
                </Marker>
              </MapView>
            ) : null}
          </View>
        </View>

        {/* ── Things to know ── */}
        <Rule />
        <SectionTitle>Things to know</SectionTitle>
        <View style={styles.listBody}>
          <FactRow
            icon={CircleCheck}
            title="Booking"
            lines={["Reserved instantly, no host approval.", FREE_CANCELLATION_TEXT]}
          />
          <FactRow
            icon={KeyRound}
            title="Access"
            lines={["Access code and exact address sent on booking."]}
          />
          {/* The design's third row is "The bay — 5.2 m × 2.6 m". FreeSpace stores no
              bay dimensions, so the row carries the host's size declaration
              instead, and is dropped entirely when they didn't make one. */}
          {vehicleFitLabel ? (
            <FactRow icon={Car} title="The bay" lines={[vehicleFitLabel]} />
          ) : null}
        </View>

        {/* ── Reviews ── */}
        <Rule />
        <View style={styles.reviewHead}>
          <Text style={[styles.sectionTitle, styles.reviewHeadTitle]}>What drivers say</Text>
          {hasReviews ? (
            <Pressable
              onPress={() =>
                navigation.navigate("ListingReviews", {
                  id,
                  rating: listing.rating,
                  ratingCount: listing.rating_count,
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.reviewSeeAll}>{`See all ${reviewCount}`}</Text>
            </Pressable>
          ) : null}
        </View>

        {hasReviews ? (
          <View style={styles.reviewSummary}>
            <Star size={14} color={GREEN} fill={GREEN} strokeWidth={0} />
            <Text style={styles.reviewSummaryScore}>{ratingValue?.toFixed(1)}</Text>
            <Text style={styles.reviewSummaryMeta}>
              {`Based on ${reviewCount} recent ${reviewCount === 1 ? "booking" : "bookings"}`}
            </Text>
          </View>
        ) : null}

        {reviews.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.reviewRail}
            contentContainerStyle={styles.reviewRailContent}
          >
            {reviews.map((review) => {
              const authorName = review.authorName ?? "Driver";
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewCardTop}>
                    <View
                      style={[styles.reviewAvatar, { backgroundColor: avatarFill(authorName) }]}
                    >
                      <Text style={styles.reviewAvatarText}>
                        {authorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.reviewMetaBlock}>
                      <Text style={styles.reviewAuthorName} numberOfLines={1}>
                        {authorName}
                      </Text>
                      <Text style={styles.reviewDateText}>
                        {formatReviewDate(new Date(review.createdAt))}
                      </Text>
                    </View>
                    <View style={styles.reviewScore}>
                      <Star size={12} color={GREEN} fill={GREEN} strokeWidth={0} />
                      <Text style={styles.reviewScoreText}>{review.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment} numberOfLines={4}>
                      {review.comment}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          /* A listing can carry a rating with no review bodies to show — the
             score comes off the listing, the text off a separate fetch.
             Claiming "no reviews yet" there would contradict the "based on N
             bookings" line directly above it. */
          <View style={styles.reviewEmpty}>
            <View style={styles.reviewEmptyIcon}>
              <Star size={22} color={GREEN} strokeWidth={1.8} />
            </View>
            <Text style={styles.reviewEmptyTitle}>
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

      {/* The bar arrives first, then the title — so the surface is already
          white by the time the words land on it. */}
      <ScrollHeader
        title={titleLabel}
        topInset={insets.top}
        barOpacity={header.barOpacity}
        titleOpacity={header.titleOpacity}
        insetLeft={68}
        insetRight={118}
      />

      {/* Floating controls — glass over the photo, ink over the white bar. */}
      <View style={[styles.headerOverlay, { top: insets.top + 12 }]}>
        <HeaderFadeButton
          solidOpacity={headerSolidOpacity}
          onPress={handleBack}
          label="Go back"
          icon={(color) => <ArrowLeft size={19} color={color} strokeWidth={2.2} />}
        />
        <View style={styles.headerRight}>
          <HeaderFadeButton
            solidOpacity={headerSolidOpacity}
            onPress={handleShare}
            label="Share this space"
            icon={(color) => <Share2 size={18} color={color} strokeWidth={2.1} />}
          />
          <HeaderFadeButton
            solidOpacity={headerSolidOpacity}
            onPress={() => void toggle(listing)}
            label={isFavorite(id) ? "Remove from favourites" : "Save to favourites"}
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

      {/* Tap layer over the photo. Inset below the header so it never covers
          the back button, and withdrawn once the sheet has risen over it. */}
      {heroTapEnabled && heroImages.length ? (
        <ScrollView
          ref={heroSwipeRef}
          style={[
            styles.heroTapZone,
            { top: insets.top + 56, height: heroTotal - insets.top - 76, left: 24 },
          ]}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            // Narrower than the photo list beneath it — it leaves room for
            // iOS's edge-swipe-back — so the offset is rescaled to full pages.
            const zone = screenWidth - 24;
            heroListRef.current?.scrollToOffset({
              offset: (event.nativeEvent.contentOffset.x / zone) * screenWidth,
              animated: false,
            });
          }}
          onMomentumScrollEnd={(event) =>
            setHeroPhotoIndex(
              Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 24))
            )
          }
        >
          {heroImages.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              style={{ width: screenWidth - 24, height: "100%" }}
              onPress={() => {
                setViewerIndex(heroPhotoIndex);
                setViewerVisible(true);
              }}
              accessibilityRole="imagebutton"
              accessibilityLabel="View photos full screen"
            />
          ))}
        </ScrollView>
      ) : null}

      {/* ── Dock ── */}
      <View style={[styles.dock, { paddingBottom: 18 + insets.bottom }]}>
        <View style={styles.dockCopy}>
          <Text style={styles.dockPrice}>
            {`€${formatPriceValue(isMonthly ? monthlyPrice : priceSummary?.grossTotal ?? 0)} total`}
          </Text>
          <Text style={styles.dockMeta}>
            {`${formatDateLabel(startAt)} · ${isMonthly ? "1 month" : priceSummary?.durationLabel ?? ""}`}
          </Text>
        </View>
        <Pressable
          style={styles.reserve}
          accessibilityRole="button"
          onPress={() => {
            // Signed-out drivers go through auth first and come back to this
            // listing with the same window, rather than hitting a checkout
            // that can't charge them.
            if (!user) {
              navigation.navigate("Auth", {
                screen: "Welcome",
                params: {
                  returnTo: {
                    screen: "Listing" as const,
                    params: { id, from: startAt.toISOString(), to: endAt.toISOString() },
                  },
                },
              });
              return;
            }
            // Straight to the review screen — it owns Pay, so the Stripe sheet
            // opens from there with nothing in between.
            navigation.navigate("BookingSummary", {
              id,
              from: startAt.toISOString(),
              to: (isMonthly ? monthlyEnd : endAt).toISOString(),
              mode: isMonthly ? "monthly" : undefined,
              review: true,
            });
          }}
        >
          <Text style={styles.reserveLabel}>Reserve</Text>
        </Pressable>
      </View>

      <Modal
        visible={viewerVisible}
        animationType="fade"
        onRequestClose={closeViewer}
        statusBarTranslucent
      >
        <View style={styles.viewerRoot}>
          {/* Backdrop fades as the sheet is dragged clear, so the page behind
              shows through rather than the black staying flat to the end. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.viewerBackdrop,
              { opacity: viewerBackdropOpacity },
            ]}
          />
          <Animated.View
            style={[styles.viewerStage, { transform: [{ translateY: viewerDragY }] }]}
            {...viewerPan.panHandlers}
          >
            <FlatList
              data={heroImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              keyExtractor={(uri, index) => `${uri}-${index}`}
              onMomentumScrollEnd={(event) =>
                setViewerIndex(
                  Math.round(event.nativeEvent.contentOffset.x / screenWidth)
                )
              }
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: screenWidth, height: "100%" }}
                  resizeMode="contain"
                />
              )}
            />
          </Animated.View>
          <Pressable
            style={[styles.viewerClose, { top: insets.top + 10 }]}
            onPress={closeViewer}
            accessibilityRole="button"
            accessibilityLabel="Close photos"
          >
            <X size={20} color={INK} strokeWidth={2.2} />
          </Pressable>
          {heroImages.length > 1 ? (
            <View style={[styles.viewerCount, { bottom: insets.bottom + 24 }]}>
              <Text style={styles.viewerCountText}>
                {`${viewerIndex + 1} / ${heroImages.length}`}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

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
          // Never a past time — snap to the next 5-minute slot from now.
          const floor = roundUpToMinuteInterval(new Date(), 5);
          const next = picked.getTime() < floor.getTime() ? floor : picked;
          const currentValue = pickerField === "start" ? startAt : endAt;
          if (next.getTime() === currentValue.getTime()) return;
          // Applied after the close animation has had its frame — this
          // re-renders the screen and re-fetches, which would otherwise stall
          // the sheet before it starts sliding away.
          InteractionManager.runAfterInteractions(() => applyPickedDate(next));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WHITE },
  skeletonSheet: { paddingHorizontal: 24, paddingTop: 28, alignItems: "center" },
  skeletonGap: { marginTop: 12 },
  skeletonStats: { flexDirection: "row", gap: 16, alignSelf: "stretch", marginTop: 24 },
  skeletonStat: { flex: 1 },
  skeletonSection: { alignSelf: "flex-start", marginTop: 36 },
  centered: { alignItems: "center", justifyContent: "center" },

  // Behind the scroll view, not in it — the sheet rides up over a photo that
  // stays where it is.
  heroFixed: { position: "absolute", top: 0, left: 0, right: 0 },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { backgroundColor: MAP_GROUND },
  heroTapZone: { position: "absolute", left: 0, right: 0 },
  heroPhotoCount: {
    position: "absolute", right: 16, bottom: 32,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(17,17,17,0.55)", borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  heroPhotoCountText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 12, color: WHITE },
  headerOverlay: {
    position: "absolute", left: 16, right: 16, zIndex: 3,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerRight: { flexDirection: "row", gap: 10 },
  glassBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  glassBtnDisc: { backgroundColor: "rgba(17,17,17,0.32)", borderRadius: 20 },
  // Cleared past the controls, and they are NOT symmetrical: one button on the
  // left (16 + 40 + 12), two on the right (16 + 40 + 10 + 40 + 12). A shared
  // inset put a long title straight under the share icon.
  // Carries the white and the corner radius now that the masthead no longer
  // has to overlap on its own.
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  viewerRoot: { flex: 1 },
  viewerBackdrop: { backgroundColor: colors.viewerBackdrop },
  viewerStage: { flex: 1 },
  viewerClose: {
    position: "absolute", left: 16, zIndex: 2,
    width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  viewerCount: {
    position: "absolute", alignSelf: "center",
    backgroundColor: "rgba(17,17,17,0.7)", borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  viewerCountText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: WHITE },

  // The sheet lifts over the photo by 28, matching its own corner radius.
  masthead: { paddingHorizontal: 24, paddingTop: 20 },
  title: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: INK, textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16, lineHeight: 22, color: MUTED, textAlign: "center",
  },
  // The pin rides with the text rather than above it, so the line still reads
  // as one centred phrase.
  subtitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 6,
  },

  stats: { flexDirection: "row", alignItems: "stretch", marginTop: 16 },
  stat: { flex: 1, alignItems: "center" },
  statValue: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: INK, textAlign: "center",
  },
  statLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: GREEN, marginTop: 2 },
  // 4 rather than the label's 2: the star's optical centre sits higher than a
  // cap-height glyph, so it needs the extra to line up with its neighbours.
  statLabelIcon: { marginTop: 4 },
  // Stars occupy the label's slot, so a column showing them still lines up
  // with the columns showing a word.
  chips: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    gap: 8, marginTop: 16,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: PILL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
  },
  chipAccent: { backgroundColor: ACCENT_SOFT },
  chipText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  chipAccentText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN_DARK },
  statDivider: { width: 1, backgroundColor: RULE, marginVertical: 2 },


  description: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, lineHeight: 22, color: MUTED, marginTop: 16, textAlign: "center",
  },

  // Runs inside the paragraph's own <Text>, so it sits on the last line
  // instead of starting a new one.
  descriptionToggleLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN,
  },
  descriptionMeasure: { position: "absolute", opacity: 0, left: 0, right: 0 },


  sectionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: INK,
  },
  sectionBody: { paddingHorizontal: 24, paddingTop: 4 },
  // The window sits 8 below its heading rather than 4 — the tall numerals
  // need the extra clearance the shorter list rows don't.
  windowBody: { paddingHorizontal: 24, paddingTop: 8 },
  listBody: { paddingHorizontal: 24, paddingTop: 4 },
  muted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },

  window: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  windowCol: {
    flex: 1,
    borderWidth: 1.5, borderColor: GREEN, backgroundColor: ACCENT_SOFT,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  windowArrow: { justifyContent: "center", flexShrink: 0 },
  windowLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  windowValueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  windowTime: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: INK,
  },
  windowDate: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 1,
  },
  windowSummary: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14,
    backgroundColor: PILL, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  windowSummaryDuration: {
    flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK,
  },
  windowSummaryWas: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED,
    textDecorationLine: "line-through",
  },
  windowSummaryTotal: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK,
  },

  pillSpacer: { height: 16 },
  pill: {
    marginHorizontal: 24, backgroundColor: PILL, borderRadius: 8,
    height: 46, alignItems: "center", justifyContent: "center",
  },


  knowLine: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, lineHeight: 21, color: MUTED, marginTop: 1,
  },

  map: { height: 150, borderRadius: 12, overflow: "hidden", backgroundColor: MAP_GROUND, marginTop: 10 },
  mapMarker: { alignItems: "center", justifyContent: "center", width: 104, height: 104 },
  mapHalo: {
    position: "absolute", width: 104, height: 104, borderRadius: 52,
    backgroundColor: "rgba(17,17,17,0.07)",
  },
  mapBubble: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: INK,
    borderWidth: 4, borderColor: WHITE,
    alignItems: "center", justifyContent: "center",
  },


  // ── Reviews ───────────────────────────────────────────────────────────────
  reviewHead: {
    flexDirection: "row", alignItems: "baseline", gap: 12,
    paddingHorizontal: 24, paddingBottom: 12,
  },
  // flex/shrink rather than marginLeft:auto on the action — with auto, a long
  // title runs straight into "See all N" and the two touch on a narrow screen.
  reviewHeadTitle: { flex: 1, minWidth: 0 },
  reviewSeeAll: {
    flexShrink: 0,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN,
  },
  reviewSummary: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 24, paddingBottom: 12,
  },
  reviewSummaryScore: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: INK },
  reviewSummaryMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },
  reviewRail: { marginBottom: 4 },
  reviewRailContent: { paddingHorizontal: 24, gap: 12 },
  reviewCard: {
    width: 250,
    borderWidth: 1, borderColor: RULE, borderRadius: 12,
    padding: 14,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: INK },
  reviewMetaBlock: { flex: 1, minWidth: 0 },
  reviewAuthorName: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  reviewDateText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  reviewScore: { flexDirection: "row", alignItems: "center", gap: 3 },
  reviewScoreText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: GREEN },
  reviewComment: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 22,
    color: MUTED, marginTop: 10,
  },
  reviewEmpty: {
    borderWidth: 1, borderColor: RULE, borderRadius: 12,
    marginHorizontal: 24,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: "center",
  },
  reviewEmptyIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT_SOFT,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  reviewEmptyTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: INK, textAlign: "center",
  },
  reviewEmptyHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, textAlign: "center", marginTop: 4,
  },

  dock: {
    borderTopWidth: 1, borderTopColor: RULE, backgroundColor: WHITE,
    paddingHorizontal: 24, paddingTop: 14,
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  dockCopy: { flex: 1, minWidth: 0 },
  dockPrice: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 20, letterSpacing: -0.2, color: INK,
  },
  dockMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 1 },
  reserve: {
    backgroundColor: GREEN, borderRadius: 999, height: 48,
    paddingHorizontal: 26, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reserveLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: WHITE },
});
