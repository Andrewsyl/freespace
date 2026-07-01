import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Slider } from "@miblanchard/react-native-slider";
import LottieView from "lottie-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type MapView from "react-native-maps";
import DatePicker from "../components/AdaptiveDatePicker";
import { DrumRollPicker, type DrumRollPickerHandle } from "../components/DrumRollPicker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { useGlobalToast } from "../components/GlobalToast";
import MapSection from "../components/MapSection";
import { MapBottomCard } from "../components/MapBottomCard";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import { calculateListingTotal, formatPriceValue } from "../utils/pricing";
import { useGlobalLoading } from "../components/GlobalLoading";
import { getListing, searchListings } from "../api";
import { trackEvent } from "../analytics";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Cctv,
  ChevronRight,
  CircleX,
  Clock,
  Heart,
  House,
  Info,
  LocateFixed,
  Lock,
  MapPin as MapPinIcon,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  SquareParking,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { logError, logInfo } from "../logger";
import type {
  ListingSummary,
  RootStackParamList,
  SearchParams,
  SecurityLevel,
  VehicleSize,
} from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

function formatAddressDisplay(address: string): string {
  return address
    .replace(/,?\s*[A-Z]\d{2}\s[A-Z0-9]{4}\b/g, "")  // strip Eircode e.g. D02 VX67
    .replace(/,?\s*Ireland\s*$/i, "")                    // strip trailing ", Ireland"
    .replace(/,\s*$/, "")                                // strip trailing comma
    .trim();
}

function getListingDisplayTitle(listing: { title: string; address?: string | null; spaceType?: string | null; space_type?: string | null }): string {
  const rawType = listing.space_type ?? listing.spaceType ?? null;
  let spaceType = rawType ?? (() => {
    const title = listing.title.trim();
    if (/ parking$/i.test(title)) return title.replace(/ parking$/i, "");
    const lower = title.toLowerCase();
    if (lower.includes("driveway")) return "Private driveway";
    if (lower.includes("garage")) return "Garage";
    if (lower.includes("car park") || lower.includes("carpark")) return "Car park";
    if (lower.includes("private road")) return "Private road";
    if (lower.includes("street")) return "Street parking";
    return "Parking space";
  })();
  const street = listing.address
    ? listing.address.split(",")[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim()
    : "";
  return street ? `${spaceType} on ${street}` : listing.title;
}

type PlaceSuggestion = {
  description: string;
  place_id: string;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

type SearchHistoryItem = {
  label: string;
  lat: string;
  lng: string;
  timestamp: number;
};

type SearchPinCoordinate = {
  latitude: number;
  longitude: number;
};

const DEFAULT_PRICE_MIN = 0;
const DEFAULT_PRICE_MAX = 60;
const DEFAULT_PRICE_STEP = 5;
const PRICE_BUCKET_COUNT = 18;
const EMPTY_PRICE_HISTOGRAM = [4, 6, 8, 12, 18, 26, 34, 42, 48, 44, 38, 31, 28, 24, 20, 16, 13, 10];

const VEHICLE_SIZE_OPTIONS: Array<{ label: string; value: VehicleSize | "" }> = [
  { label: "Any", value: "" },
  { label: "Motorcycle", value: "motorcycle" },
  { label: "Car", value: "car" },
  { label: "Van", value: "van" },
];

const SPACE_TYPE_OPTIONS: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: "Driveway", value: "Private Driveway", icon: House },
  { label: "Garage", value: "Garage", icon: Warehouse },
  { label: "Car park", value: "Car park", icon: SquareParking },
  { label: "Private road", value: "Private road", icon: Route },
];

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  small?: boolean;
};

function FilterChip({ label, selected = false, onPress, icon, small = false }: FilterChipProps) {
  const Icon = icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChipButton,
        small && styles.filterChipButtonSmall,
        selected && styles.filterChipButtonActive,
        pressed && styles.filterChipButtonPressed,
      ]}
    >
      {Icon ? (
        <Icon
          size={14}
          color={selected ? "#ffffff" : "#0f172a"}
          strokeWidth={2.1}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[styles.filterChipButtonText, selected && styles.filterChipButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.filterSection}>
      <View style={styles.filterSectionHeader}>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.filterSectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type PriceScale = {
  min: number;
  max: number;
  step: number;
  bars: number[];
  count: number;
  observedMin: number;
  observedMax: number;
};

function parsePriceRangeValue(value: string, fallback: number, scale: PriceScale) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? clamp(parsed, scale.min, scale.max) : fallback;
}

function priceValueToFilter(value: number, edge: "min" | "max", scale: PriceScale) {
  if (edge === "min" && value <= scale.min) return "";
  if (edge === "max" && value >= scale.max) return "";
  return formatPriceValueForFilter(value);
}

function formatPriceValueForFilter(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function buildPriceScale(values: number[]): PriceScale {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (cleanValues.length === 0) {
    return {
      min: DEFAULT_PRICE_MIN,
      max: DEFAULT_PRICE_MAX,
      step: DEFAULT_PRICE_STEP,
      bars: EMPTY_PRICE_HISTOGRAM,
      count: 0,
      observedMin: DEFAULT_PRICE_MIN,
      observedMax: DEFAULT_PRICE_MAX,
    };
  }

  const observedMin = Math.min(...cleanValues);
  const observedMax = Math.max(...cleanValues);
  const paddedMax = Math.max(observedMax + Math.max(2, observedMax * 0.25), 10);
  const step = getPriceStep(paddedMax);
  const max = Math.max(step, Math.ceil(paddedMax / step) * step);

  return {
    min: DEFAULT_PRICE_MIN,
    max,
    step,
    bars: buildPriceHistogram(cleanValues, DEFAULT_PRICE_MIN, max),
    count: cleanValues.length,
    observedMin,
    observedMax,
  };
}

function buildPriceHistogram(values: number[], min: number, max: number) {
  if (values.length === 0 || max <= min) return EMPTY_PRICE_HISTOGRAM;
  const counts = Array.from({ length: PRICE_BUCKET_COUNT }, () => 0);

  values.forEach((value) => {
    const ratio = (value - min) / (max - min);
    const bucket = Math.min(PRICE_BUCKET_COUNT - 1, Math.max(0, Math.floor(ratio * PRICE_BUCKET_COUNT)));
    counts[bucket] += 1;
  });

  const maxCount = Math.max(...counts, 1);
  return counts.map((count) => (count === 0 ? 8 : 16 + Math.round((count / maxCount) * 64)));
}

function getPriceStep(max: number) {
  if (max <= 20) return 1;
  if (max <= 80) return 5;
  if (max <= 250) return 10;
  if (max <= 600) return 25;
  return 50;
}

function getSearchPriceForParams(listing: ListingSummary, params: SearchParams) {
  const start = new Date(params.from);
  const end = new Date(params.to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Number(listing.price_per_day);
  }
  return calculateListingTotal(listing, start, end).total;
}

function listingSearchText(listing: ListingSummary) {
  return [
    listing.title,
    listing.address,
    listing.availability_text,
    listing.vehicle_size_suitability,
    listing.vehicleSizeSuitability,
    ...(listing.amenities ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSpaceType(listing: ListingSummary, spaceType?: string) {
  if (!spaceType) return true;
  const text = listingSearchText(listing);
  const value = spaceType.toLowerCase();
  if (value.includes("driveway")) return text.includes("driveway");
  if (value.includes("garage")) return text.includes("garage");
  if (value.includes("car park") || value.includes("carpark")) {
    return text.includes("car park") || text.includes("carpark") || text.includes("lot");
  }
  if (value.includes("road")) return text.includes("road") || text.includes("street");
  return text.includes(value);
}

function matchesSearchFilters(listing: ListingSummary, params: SearchParams) {
  const price = getSearchPriceForParams(listing, params);
  const min = params.priceMin ? Number(params.priceMin) : null;
  const max = params.priceMax ? Number(params.priceMax) : null;
  const text = listingSearchText(listing);
  const amenities = (listing.amenities ?? []).map((amenity) => amenity.toLowerCase());

  if (min !== null && Number.isFinite(min) && Number.isFinite(price) && price < min) return false;
  if (max !== null && Number.isFinite(max) && Number.isFinite(price) && price > max) return false;
  if (!matchesSpaceType(listing, params.spaceType)) return false;
  if (params.coveredParking && !amenities.some((amenity) => ["covered", "garage", "indoor"].includes(amenity)) && !text.includes("covered") && !text.includes("garage")) return false;
  if (params.evCharging && !amenities.some((amenity) => ["ev_charging", "ev charging", "ev"].includes(amenity)) && !text.includes("ev charging")) return false;
  if (params.securityLevel === "cctv" && !amenities.includes("cctv") && !text.includes("cctv")) return false;
  if (params.securityLevel === "gated" && !amenities.some((amenity) => ["gated", "security"].includes(amenity)) && !text.includes("gated") && !text.includes("secure")) return false;
  if (params.vehicleSize === "van") {
    const capacity = Number(listing.capacity ?? 1);
    if ((!Number.isFinite(capacity) || capacity < 2) && !text.includes("van")) return false;
  }
  if (params.vehicleSize === "motorcycle" && text.includes("van only")) return false;
  if (params.instantBook && listing.is_available === false) return false;

  return true;
}

function PriceRangeSlider({
  minValue,
  maxValue,
  priceValues,
  onMinChange,
  onMaxChange,
}: {
  minValue: string;
  maxValue: string;
  priceValues: number[];
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const scale = useMemo(
    () => buildPriceScale(priceValues),
    [priceValues]
  );

  const numericMin = parsePriceRangeValue(minValue, scale.min, scale);
  const numericMax = parsePriceRangeValue(maxValue, scale.max, scale);
  const safeMin = clamp(
    Math.min(numericMin, numericMax - scale.step),
    scale.min,
    scale.max - scale.step
  );
  const safeMax = clamp(
    Math.max(numericMax, safeMin + scale.step),
    safeMin + scale.step,
    scale.max
  );

  const minLabel = `€${formatPriceValueForFilter(safeMin)}`;
  const maxLabel = safeMax >= scale.max ? `€${formatPriceValueForFilter(scale.max)}+` : `€${formatPriceValueForFilter(safeMax)}`;
  const rangeHint =
    scale.count > 0
      ? `Current spaces range from €${formatPriceValueForFilter(scale.observedMin)} to €${formatPriceValueForFilter(scale.observedMax)}.`
      : "No current price data yet.";

  const handleRangeChange = useCallback(
    (values: number[]) => {
      const rawMin = values[0] ?? safeMin;
      const rawMax = values[1] ?? safeMax;
      const orderedMin = Math.min(rawMin, rawMax);
      const orderedMax = Math.max(rawMin, rawMax);
      const nextMin = clamp(orderedMin, scale.min, scale.max - scale.step);
      const nextMax = clamp(orderedMax, nextMin + scale.step, scale.max);

      onMinChange(priceValueToFilter(nextMin, "min", scale));
      onMaxChange(priceValueToFilter(nextMax, "max", scale));
    },
    [onMaxChange, onMinChange, safeMax, safeMin, scale]
  );

  return (
    <View style={styles.priceSlider}>
      <Text style={styles.priceRangeHint}>{rangeHint}</Text>
      <View style={styles.priceRangeGraph}>
        <View pointerEvents="none" style={styles.priceHistogram}>
          {scale.bars.map((height, index) => {
            const barValue =
              scale.min +
              (index / Math.max(1, scale.bars.length - 1)) *
                (scale.max - scale.min);
            const selected = barValue >= safeMin && barValue <= safeMax;
            return (
              <View
                key={`price-bar-${index}`}
                style={[
                  styles.priceHistogramBar,
                  { height },
                  selected && styles.priceHistogramBarSelected,
                ]}
              />
            );
          })}
        </View>
        <Slider
          animateTransitions={false}
          containerStyle={styles.priceRangeSlider}
          maximumTrackTintColor="#dfe3e8"
          maximumValue={scale.max}
          minimumTrackTintColor="#0f172a"
          minimumValue={scale.min}
          minimumTrackStyle={styles.priceRangeSliderSelectedTrack}
          onSlidingComplete={handleRangeChange}
          onValueChange={handleRangeChange}
          renderThumbComponent={() => (
            <View style={styles.priceRangeThumb}>
              <View style={styles.priceRangeThumbDot} />
            </View>
          )}
        step={scale.step}
        thumbTouchSize={{ width: 54, height: 54 }}
        trackClickable
        trackStyle={styles.priceRangeSliderTrack}
        value={[safeMin, safeMax]}
      />
      </View>
      <View style={styles.priceRangeValueRow}>
        <View>
          <Text style={styles.priceValueLabel}>Minimum</Text>
          <Text style={styles.priceRangeValue}>{minLabel}</Text>
        </View>
        <View style={styles.priceRangeDivider} />
        <View style={styles.priceRangeValueRight}>
          <Text style={styles.priceValueLabel}>Maximum</Text>
          <Text style={styles.priceRangeValue}>{maxLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const pad2 = (value: number) => value.toString().padStart(2, "0");
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MAX_SEARCH_RADIUS_KM = 50;
const MIN_SEARCH_RADIUS_KM = 0.5;
// Radius for searches centred on a picked destination (address, history item,
// current location). Must not derive from the live map region: the map is still
// animating to the destination when the search fires, so the region reflects
// the previous viewport. Generous enough to absorb off-centre geocoding.
const DESTINATION_SEARCH_RADIUS_KM = "3.00";

const ordinalSuffix = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

const formatDateLabel = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);

  if (dateToCheck.getTime() === today.getTime()) {
    return "Today";
  }

  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
};

const formatTimeLabel = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;
const formatMapCardMetaLine = (fromIso: string, toIso: string, distanceM?: number | null) => {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  const dayLabel = formatDateLabel(fromDate);
  const distanceLabel =
    typeof distanceM === "number" && Number.isFinite(distanceM)
      ? `${(distanceM < 1000 ? Math.round(distanceM) : distanceM / 1000).toFixed(distanceM < 1000 ? 0 : 1)} ${distanceM < 1000 ? "m" : "km"}`
      : null;
  return `${dayLabel}: ${formatTimeLabel(fromDate)} - ${formatTimeLabel(toDate)}${distanceLabel ? ` | ${distanceLabel}` : ""}`;
};

export function SearchScreen({ navigation }: Props) {
  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    return {
      from: now.toISOString(),
      to: end.toISOString(),
    };
  }, []);

  const [lat, setLat] = useState("53.3498");
  const [lng, setLng] = useState("-6.2603");
  const [radiusKm, setRadiusKm] = useState("5");
  const [from, setFrom] = useState(today.from);
  const [to, setTo] = useState(today.to);
  const [loading, setLoading] = useState(false);
  const [isStaggerPending, setIsStaggerPending] = useState(false);
  const [searchGeneration, setSearchGeneration] = useState(0);
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const { show: showGlobalLoading, hide: hideGlobalLoading } = useGlobalLoading();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ListingSummary[]>([]);
  const [pendingResults, setPendingResults] = useState<ListingSummary[] | null>(null);
  const [isRefreshingPins, setIsRefreshingPins] = useState(false);
  const resultsRef = useRef<ListingSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSelectedCard, setShowSelectedCard] = useState(false);
  const [dismissingCard, setDismissingCard] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedCardAmenities, setSelectedCardAmenities] = useState<string[] | null>(null);
  const [startAt, setStartAt] = useState(new Date(today.from));
  const [endAt, setEndAt] = useState(new Date(today.to));
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const pickerSheetAnim = useRef(new Animated.Value(400)).current;
  const mapOverlayOpacity = useRef(new Animated.Value(1)).current;
  const [mapOverlayVisible, setMapOverlayVisible] = useState(true);
  const mapFrozenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pickerVisible) {
      pickerSheetAnim.setValue(400);
      Animated.spring(pickerSheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    }
  }, [pickerVisible, pickerSheetAnim]);
  useEffect(() => {
    const visible = loading || isStaggerPending;
    Animated.timing(pillOpacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 150 : 350,
      useNativeDriver: true,
    }).start();
  }, [loading, isStaggerPending, pillOpacity]);

  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const emptyNoticeOpacity = useRef(new Animated.Value(0)).current;
  const emptyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideEmptyNotice = useCallback(() => {
    if (emptyNoticeTimerRef.current) {
      clearTimeout(emptyNoticeTimerRef.current);
      emptyNoticeTimerRef.current = null;
    }
    Animated.timing(emptyNoticeOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setEmptyNotice(null);
    });
  }, [emptyNoticeOpacity]);

  const showEmptyNotice = useCallback(
    (message: string) => {
      if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
      setEmptyNotice(message);
      Animated.timing(emptyNoticeOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      emptyNoticeTimerRef.current = setTimeout(() => {
        emptyNoticeTimerRef.current = null;
        hideEmptyNotice();
      }, 4000);
    },
    [emptyNoticeOpacity, hideEmptyNotice]
  );

  useEffect(() => {
    return () => {
      if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
    };
  }, []);

  const timeSearchPendingRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mapResumeNonce, setMapResumeNonce] = useState(0);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel | "">("");
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | "">("");
  const [spaceType, setSpaceType] = useState<string>("");
  const [overlappingPins, setOverlappingPins] = useState<ListingSummary[]>([]);
  const [coveredParking, setCoveredParking] = useState(false);
  const [evCharging, setEvCharging] = useState(false);
  const [instantBook, setInstantBook] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<"recents" | "favourites">("recents");
  const [pendingSearch, setPendingSearch] = useState<{
    lat: string;
    lng: string;
    radiusKm: string;
  } | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [renderSearchArea, setRenderSearchArea] = useState(false);
  const isProgrammaticMoveRef = useRef(false);
  useAuth();
  const { favorites, isFavorite, toggle } = useFavorites();
  const toast = useGlobalToast();
  const handleToggleFavorite = useCallback(
    (listing: ListingSummary) => {
      const wasFavorite = isFavorite(listing.id);
      void (async () => {
        try {
          await toggle(listing);
          if (wasFavorite) toast.show("Removed from favourites");
          else toast.showSuccess("Saved to favourites");
        } catch {
          // toggle surfaces its own errors; don't show a success toast on failure
        }
      })();
    },
    [isFavorite, toggle, toast]
  );
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchAreaOpacity = useRef(new Animated.Value(0)).current;
  const searchAreaTranslateY = useRef(new Animated.Value(8)).current;
  const showAreaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchOverlayOpacity = useMemo(
    () =>
      searchAnim.interpolate({
        inputRange: [0, 40],
        outputRange: [1, 0],
      }),
    [searchAnim]
  );
  const backdropOpacity = useMemo(
    () =>
      slideAnim.interpolate({
        inputRange: [0, windowHeight],
        outputRange: [1, 0],
      }),
    [slideAnim, windowHeight]
  );
  const searchRequestIdRef = useRef(0);
  const searchStartedAtRef = useRef(0);
  const mapReadyEventsRef = useRef({ ready: false, loaded: false });
  const mapReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapReadyFailSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSearchTriggeredRef = useRef(false);
  const currentRegionRef = useRef<typeof mapRegion | null>(null);
  const mapRegionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRegionHandledRef = useRef(false);
  const cardHeightRef = useRef(0);
  const [mapFrozenUri, setMapFrozenUri] = useState<string | null>(null);
  const mapFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRegionSearchRef = useRef(false);
  const suppressRegionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requireUserPanForRegionSearchRef = useRef(false);

  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  useEffect(() => {
    navigation.setParams({ hideTabBar: searchSheetOpen || filtersVisible });
  }, [navigation, searchSheetOpen, filtersVisible]);

  const parsedLat = Number.parseFloat(lat);
  const parsedLng = Number.parseFloat(lng);
  const mapRegion = {
    latitude: Number.isFinite(parsedLat) ? parsedLat : 53.3498,
    longitude: Number.isFinite(parsedLng) ? parsedLng : -6.2603,
    latitudeDelta: 0.025, // Wider area view
    longitudeDelta: 0.025,
  };
  const [mapInitialRegion, setMapInitialRegion] = useState<typeof mapRegion | null>(null);
  const [searchPinCoordinate, setSearchPinCoordinate] = useState<SearchPinCoordinate | null>({
    latitude: Number.isFinite(parsedLat) ? parsedLat : 53.3498,
    longitude: Number.isFinite(parsedLng) ? parsedLng : -6.2603,
  });
  const ignoreNextRegionChangeRef = useRef(false);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSearchRadiusRef = useRef<number | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const skipAutocompleteRef = useRef(0);
  // Monotonic id so a slow earlier autocomplete response can't overwrite the
  // suggestions for a newer query.
  const autocompleteSeqRef = useRef(0);
  const historyLoadedRef = useRef(false);
  const filtersLoadedRef = useRef(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const HISTORY_KEY = "searchHistory";
  const MAP_REGION_KEY = "search.mapRegion";
  const FILTERS_KEY = "search.filters";

  const searchAreaVisible = showSearchArea && !!pendingSearch;

  useEffect(() => {
    if (searchAreaVisible) {
      setRenderSearchArea(true);
      // Start below its resting position so it slides up into view
      searchAreaTranslateY.setValue(24);
      searchAreaOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(searchAreaOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(searchAreaTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 300,
          mass: 0.75,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(searchAreaOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(searchAreaTranslateY, {
        toValue: 20,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRenderSearchArea(false);
      }
    });
  }, [searchAreaVisible, searchAreaOpacity, searchAreaTranslateY]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(MAP_REGION_KEY);
        if (!active) return;
        if (stored) {
          const parsed = JSON.parse(stored) as typeof mapRegion;
          if (
            typeof parsed?.latitude === "number" &&
            typeof parsed?.longitude === "number" &&
            typeof parsed?.latitudeDelta === "number" &&
            typeof parsed?.longitudeDelta === "number"
          ) {
            setMapInitialRegion(parsed);
            setLat(parsed.latitude.toFixed(6));
            setLng(parsed.longitude.toFixed(6));
            setSearchPinCoordinate({
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            });
            return;
          }
        }

        const permissions = await Location.getForegroundPermissionsAsync();
        if (!active || permissions.status !== "granted") return;

        let position: Location.LocationObject | null = null;
        try {
          position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
        } catch {
          position = null;
        }

        if (!position) {
          position = await Location.getLastKnownPositionAsync({
            maxAge: 10 * 60 * 1000,
            requiredAccuracy: 500,
          });
        }

        if (!active || !position) return;

        const nextRegion = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        setMapInitialRegion(nextRegion);
        setLat(nextRegion.latitude.toFixed(6));
        setLng(nextRegion.longitude.toFixed(6));
        setSearchPinCoordinate({
          latitude: nextRegion.latitude,
          longitude: nextRegion.longitude,
        });
        setAddressQuery("Current location");
        currentRegionRef.current = nextRegion;
        await AsyncStorage.setItem(MAP_REGION_KEY, JSON.stringify(nextRegion));
        if (active) {
          lastSearchCenterRef.current = {
            lat: nextRegion.latitude,
            lng: nextRegion.longitude,
          };
        }
      } catch {
        // Ignore persisted region errors.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const isWithinRadius = useCallback(
    (listing: ListingSummary, center: { lat: number; lng: number }, radiusM: number) => {
      if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number") {
        return false;
      }
      const toRad = (value: number) => (value * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(listing.latitude - center.lat);
      const dLng = toRad(listing.longitude - center.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(center.lat)) *
          Math.cos(toRad(listing.latitude)) *
          Math.sin(dLng / 2) ** 2;
      const distanceM = 2 * R * Math.asin(Math.sqrt(a));
      return distanceM <= radiusM;
    },
    []
  );

  const radiusKmForRegion = useCallback((region: typeof mapRegion) => {
    const diagDelta = Math.sqrt(
      region.latitudeDelta ** 2 + region.longitudeDelta ** 2
    );
    const rawRadiusKm =
      Math.max(MIN_SEARCH_RADIUS_KM, (diagDelta * 111) / 2) * 1.2;
    return Math.min(MAX_SEARCH_RADIUS_KM, rawRadiusKm);
  }, []);

  const buildSearchParams = useCallback(
    (overrides?: Partial<SearchParams>): SearchParams => {
      const region = currentRegionRef.current;
      const nextLat = region ? region.latitude.toFixed(6) : lat;
      const nextLng = region ? region.longitude.toFixed(6) : lng;
      const nextRadiusKm = region
        ? radiusKmForRegion(region).toFixed(2)
        : radiusKm;
      const next: SearchParams = {
        lat: nextLat,
        lng: nextLng,
        radiusKm: nextRadiusKm,
        from,
        to,
        includeUnavailable: true,
      };
      if (priceMin.trim()) next.priceMin = priceMin.trim();
      if (priceMax.trim()) next.priceMax = priceMax.trim();
      if (securityLevel) next.securityLevel = securityLevel;
      if (vehicleSize) next.vehicleSize = vehicleSize;
      if (spaceType) next.spaceType = spaceType;
      if (coveredParking) next.coveredParking = true;
      if (evCharging) next.evCharging = true;
      if (instantBook) next.instantBook = true;
      return { ...next, ...overrides };
    },
    [
      lat,
      lng,
      radiusKm,
      from,
      to,
      radiusKmForRegion,
      priceMin,
      priceMax,
      securityLevel,
      vehicleSize,
      spaceType,
      coveredParking,
      evCharging,
      instantBook,
    ]
  );

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetchAutocomplete(addressQuery);
    }, 300);
    return () => clearTimeout(handle);
  }, [addressQuery, mapsKey]);


  const runSearch = useCallback(
    async (
      paramsOverride?: Partial<SearchParams>,
      options?: { showGlobal?: boolean; preserveSelection?: boolean }
    ) => {
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      setShowSearchArea(false);
      setPendingSearch(null);
      hideEmptyNotice();
      let nextResultsSnapshot: ListingSummary[] | null = null;
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      searchStartedAtRef.current = Date.now();
      const preserveSelection = options?.preserveSelection ?? false;
      setLoading(true);
      setIsStaggerPending(true);
      setSearchGeneration(prev => prev + 1);
      setIsRefreshingPins(true);
      setError(null);
      const params = buildSearchParams(paramsOverride);
      logInfo("Search started", params);
      const nextCenter = {
        lat: Number.parseFloat(params.lat),
        lng: Number.parseFloat(params.lng),
      };
      if (Number.isFinite(nextCenter.lat) && Number.isFinite(nextCenter.lng)) {
        lastSearchCenterRef.current = nextCenter;
      }
      const currentRegion = currentRegionRef.current;
      if (currentRegion) {
        lastSearchRadiusRef.current = radiusKmForRegion(currentRegion);
      }
      try {
        const spaces = await searchListings(params);
        void trackEvent("mobile_search_completed", {
          resultCount: spaces.length,
          radiusKm: params.radiusKm,
        });
        if (searchRequestIdRef.current !== requestId) return;
        const center = {
          lat: Number.parseFloat(params.lat),
          lng: Number.parseFloat(params.lng),
        };
        const radiusM = Math.max(0.5, Number(params.radiusKm)) * 1000;
        const nextIds = new Set(spaces.map((listing) => listing.id));
        const carryOver = resultsRef.current.filter(
          (listing) => !nextIds.has(listing.id) && isWithinRadius(listing, center, radiusM)
        );
        nextResultsSnapshot = [...spaces, ...carryOver].filter((listing) =>
          matchesSearchFilters(listing, params)
        );
        // If preserving selection, keep the selected listing in results so the card stays visible
        if (preserveSelection) {
          setSelectedId((prev) => {
            if (prev && !nextResultsSnapshot!.some((l) => l.id === prev)) {
              const kept = resultsRef.current.find((l) => l.id === prev);
              if (kept && matchesSearchFilters(kept, params)) nextResultsSnapshot!.push(kept);
            }
            return prev;
          });
        } else {
          setSelectedId((prev) => {
            if (prev && spaces.some((l) => l.id === prev && l.is_available !== false))
              return prev;
            return null;
          });
        }
        setPendingResults(nextResultsSnapshot);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        logError("Search error", { message });
        void trackEvent("mobile_search_failed", {
          radiusKm: params.radiusKm,
          message,
        });
        // Only surface the failure if this is still the latest search; a stale
        // request erroring shouldn't toast over a newer one's results.
        if (searchRequestIdRef.current === requestId) {
          setError(message);
          setPendingResults([]);
        }
      } finally {
        const elapsed = Date.now() - searchStartedAtRef.current;
        const remaining = Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          if (searchRequestIdRef.current !== requestId) return;
          setLoading(false);
          if (nextResultsSnapshot) {
            setResults(nextResultsSnapshot);
            setPendingResults(null);
            if (nextResultsSnapshot.length === 0) {
              showEmptyNotice("No spaces in this area — try zooming out");
            } else if (nextResultsSnapshot.every((l) => l.is_available === false)) {
              showEmptyNotice("All spaces are booked for these times");
            }
          }
          setIsRefreshingPins(false);
        }, remaining);
      }
    },
    [buildSearchParams, pendingResults, hideEmptyNotice, showEmptyNotice]
  );

  const scheduleMapReady = useCallback(() => {
    if (!mapReadyEventsRef.current.ready || !mapReadyEventsRef.current.loaded) return;
    if (mapReadyTimerRef.current) {
      clearTimeout(mapReadyTimerRef.current);
    }
    mapReadyTimerRef.current = setTimeout(() => {
      setMapReady(true);
    }, 620);
  }, []);

  const handleMapReady = (type: "ready" | "loaded") => {
    mapReadyEventsRef.current[type] = true;
    scheduleMapReady();
    initialRegionHandledRef.current = true;
    if (!currentRegionRef.current) {
      currentRegionRef.current = mapInitialRegion ?? mapRegion;
    }
    if (!results.length && !loading && type === "ready") {
      initialSearchTriggeredRef.current = true;
      isProgrammaticMoveRef.current = true;
      void runSearch();
    }
  };

  useEffect(() => {
    setFrom(startAt.toISOString());
    setTo(endAt.toISOString());
  }, [startAt, endAt]);

  useEffect(() => {
    if (!currentRegionRef.current && mapInitialRegion) {
      currentRegionRef.current = mapInitialRegion;
    }
  }, [mapInitialRegion]);

  useEffect(() => {
    if (!timeSearchPendingRef.current) return;
    timeSearchPendingRef.current = false;
    void runSearch({ lat, lng, radiusKm });
  }, [endAt, lat, lng, radiusKm, runSearch]);

  useEffect(() => {
    if (typeof navigation.addListener !== "function") {
      return;
    }
    const unsubscribeBlur = navigation.addListener("blur", async () => {
      if (!mapRef.current) return;
      try {
        const uri = await (mapRef.current as any).takeSnapshot({ format: "jpg", quality: 0.85, result: "file" });
        if (uri) {
          mapFrozenOpacity.setValue(1);
          setMapFrozenUri(uri);
        }
      } catch {
        // snapshot failed — map will redraw normally
      }
    });
    const unsubscribeFocus = navigation.addListener("focus", () => {
      setMapResumeNonce((prev) => prev + 1);
      if (mapFreezeTimerRef.current) clearTimeout(mapFreezeTimerRef.current);
      mapFreezeTimerRef.current = setTimeout(() => {
        mapFreezeTimerRef.current = null;
        Animated.timing(mapFrozenOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setMapFrozenUri(null);
            mapFrozenOpacity.setValue(1);
          }
        });
      }, 600);
      // Suppress region-change searches while the map settles after returning
      suppressRegionSearchRef.current = true;
      requireUserPanForRegionSearchRef.current = true;
      if (suppressRegionSearchTimerRef.current) clearTimeout(suppressRegionSearchTimerRef.current);
      suppressRegionSearchTimerRef.current = setTimeout(() => {
        suppressRegionSearchRef.current = false;
        suppressRegionSearchTimerRef.current = null;
      }, 1200);
    });
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
      if (mapFreezeTimerRef.current) clearTimeout(mapFreezeTimerRef.current);
      if (suppressRegionSearchTimerRef.current) clearTimeout(suppressRegionSearchTimerRef.current);
    };
  }, [navigation]);

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
      }
      setStartAt(next);
    } else {
      const minEnd = new Date(startAt);
      minEnd.setHours(minEnd.getHours() + 1);
      const safeEnd = next < minEnd ? minEnd : next;
      setEndAt(safeEnd);
    }
  };

  useEffect(() => {
    const show = !mapReady || (loading && results.length === 0);
    if (show) {
      mapOverlayOpacity.setValue(1);
      setMapOverlayVisible(true);
    } else {
      Animated.timing(mapOverlayOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMapOverlayVisible(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, loading, results.length]);

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const closePicker = useCallback(() => {
    Animated.timing(pickerSheetAnim, {
      toValue: 400,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPickerVisible(false);
        setDraftDate(null);
      }
    });
  }, [pickerSheetAnim]);

  const drumPickerRef = useRef<DrumRollPickerHandle>(null);

  const applyQuickDuration = (hours: number) => {
    const nextEnd = new Date(startAt);
    nextEnd.setHours(nextEnd.getHours() + hours);
    setDraftDate(nextEnd);
    drumPickerRef.current?.setTime(nextEnd);
  };


  const fetchAutocomplete = async (query: string) => {
    if (!mapsKey) return;
    const seq = ++autocompleteSeqRef.current;
    setAddressLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({
        input: query,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
        { signal: controller.signal }
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      // Drop the result if a newer query has been issued since this one started.
      if (seq !== autocompleteSeqRef.current) return;
      setAddressSuggestions(payload.predictions ?? []);
    } catch {
      if (seq === autocompleteSeqRef.current) setAddressSuggestions([]);
    } finally {
      clearTimeout(timeout);
      if (seq === autocompleteSeqRef.current) setAddressLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setAddressQuery(formatAddressDisplay(suggestion.description));
    setAddressSuggestions([]);
    skipAutocompleteRef.current = 2;
    if (!mapsKey) return;
    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsKey,
        fields: "geometry,formatted_address",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const payload = (await response.json()) as PlaceDetailsResponse;
      if (payload.result?.formatted_address) {
        setAddressQuery(formatAddressDisplay(payload.result.formatted_address));
      }
      const location = payload.result?.geometry?.location;
      if (location) {
        const nextLat = location.lat.toFixed(6);
        const nextLng = location.lng.toFixed(6);
        const label = formatAddressDisplay(payload.result?.formatted_address ?? suggestion.description);
        addToHistory({
          label,
          lat: nextLat,
          lng: nextLng,
          timestamp: Date.now(),
        });
        setLat(nextLat);
        setLng(nextLng);
        setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
        setSearchPinCoordinate({
          latitude: location.lat,
          longitude: location.lng,
        });
        lastSearchCenterRef.current = { lat: location.lat, lng: location.lng };
        setSelectedId(null);
        setShowSearchArea(false);
        setPendingSearch(null);
        isProgrammaticMoveRef.current = true;
        const destinationRegion = {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        // Set optimistically — the animation hasn't completed when the search
        // below builds its params from this ref.
        currentRegionRef.current = destinationRegion;
        mapRef.current?.animateToRegion(destinationRegion, 280);
        void runSearch({ lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM });
      }
    } catch {
      // Ignore lookup errors.
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocationError(null);
    setLocating(true);
    const loadingTimer = setTimeout(() => {
      showGlobalLoading("Locating...");
    }, 120);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location permission needed.");
        if (!permission.canAskAgain) {
          // The OS won't show the prompt again (user previously denied), so a
          // bare error leaves this button permanently dead. Route to Settings.
          Alert.alert(
            "Location is off",
            "Enable location access for FreeSpace in Settings to find parking near you.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ]
          );
        }
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError("Location services are off.");
        Alert.alert(
          "Location services are off",
          "Turn on Location Services in Settings so we can find parking near you.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]
        );
        return;
      }
      const withTimeout = async <T,>(promise: Promise<T>, ms: number) =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Location timeout")), ms)
          ),
        ]);
      let position: Location.LocationObject | null = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        8000
      );
      if (!position) {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 200,
        });
      }
      if (!position) {
        setLocationError("Unable to fetch location.");
        return;
      }
      const nextLat = position.coords.latitude.toFixed(6);
      const nextLng = position.coords.longitude.toFixed(6);
      setLat(nextLat);
      setLng(nextLng);
      setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
      setSearchPinCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setAddressQuery("Current location");
      setAddressSuggestions([]);
      skipAutocompleteRef.current = 2;
      lastSearchCenterRef.current = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setSelectedId(null);
      setShowSearchArea(false);
      setPendingSearch(null);
      isProgrammaticMoveRef.current = true;
      const destinationRegion = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      currentRegionRef.current = destinationRegion;
      mapRef.current?.animateToRegion(destinationRegion, 280);
      setSearchSheetOpen(false);
      clearTimeout(loadingTimer);
      hideGlobalLoading();
      void runSearch(
        { lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM },
        { showGlobal: true }
      );
    } catch {
      setLocationError("Unable to fetch location.");
    } finally {
      clearTimeout(loadingTimer);
      hideGlobalLoading();
      setLocating(false);
    }
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    const nextLat = item.lat;
    const nextLng = item.lng;
    setAddressQuery(item.label);
    setAddressSuggestions([]);
    skipAutocompleteRef.current = 2;
    setLat(nextLat);
    setLng(nextLng);
    setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
    setSearchPinCoordinate({
      latitude: Number.parseFloat(nextLat),
      longitude: Number.parseFloat(nextLng),
    });
    lastSearchCenterRef.current = {
      lat: Number.parseFloat(nextLat),
      lng: Number.parseFloat(nextLng),
    };
    setSelectedId(null);
    setShowSearchArea(false);
    setPendingSearch(null);
    isProgrammaticMoveRef.current = true;
    const destinationRegion = {
      latitude: Number.parseFloat(nextLat),
      longitude: Number.parseFloat(nextLng),
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    currentRegionRef.current = destinationRegion;
    mapRef.current?.animateToRegion(destinationRegion, 280);
    setSearchSheetOpen(false);
    void runSearch({ lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM });
  };

  const selectedListing = selectedId
    ? results.find((listing) => listing.id === selectedId) ?? null
    : null;
  const visibleSelectedListing = showSelectedCard ? selectedListing : null;

  const selectedListingImage =
    visibleSelectedListing?.image_urls?.[0] ??
    visibleSelectedListing?.imageUrls?.[0] ??
    (visibleSelectedListing?.latitude &&
    visibleSelectedListing?.longitude &&
    mapsKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${visibleSelectedListing.latitude},${visibleSelectedListing.longitude}&source=outdoor&key=${mapsKey}`
      : null);

  useEffect(() => {
    let cancelled = false;
    if (!visibleSelectedListing) {
      setSelectedCardAmenities(null);
      return;
    }
    const summaryAmenities = visibleSelectedListing.amenities ?? [];
    if (summaryAmenities.length > 0) {
      setSelectedCardAmenities(summaryAmenities);
      return;
    }
    void (async () => {
      try {
        const detail = await getListing(visibleSelectedListing.id, { from, to });
        if (!cancelled) {
          setSelectedCardAmenities(detail.amenities ?? []);
        }
      } catch {
        if (!cancelled) {
          setSelectedCardAmenities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleSelectedListing?.id, visibleSelectedListing?.amenities, from, to]);

  const handleSelectListing = useCallback((id: string | null) => {
    ignoreNextRegionChangeRef.current = true;
    if (cardDismissTimerRef.current) {
      clearTimeout(cardDismissTimerRef.current);
      cardDismissTimerRef.current = null;
    }
    if (id === null && selectedId !== null) {
      setDismissingCard(true);
      cardDismissTimerRef.current = setTimeout(() => {
        setShowSelectedCard(false);
        setSelectedId(null);
        setDismissingCard(false);
        cardDismissTimerRef.current = null;
      }, 250);
      return;
    }

    setSelectedId(id);
    setShowSelectedCard(Boolean(id));
    setDismissingCard(false);
    if (!id || !mapRef.current) return;

    const listing = results.find((r) => r.id === id);
    if (!listing?.latitude || !listing?.longitude) return;

    const region = currentRegionRef.current;
    const latDelta = region?.latitudeDelta ?? 0.012;
    const lngDelta = region?.longitudeDelta ?? 0.012;
    const centerLat = region?.latitude ?? listing.latitude;
    const centerLng = region?.longitude ?? listing.longitude;

    // mapPadding shifts the visual centre and shrinks the visible height — account for both.
    const mapPaddingTop = insets.top + 120;
    const mapPaddingBottom = 180 + insets.bottom + 16;
    const visibleHeight = windowHeight - mapPaddingTop - mapPaddingBottom;
    const mapVisualCenterY = mapPaddingTop + visibleHeight / 2;

    const latPerPixel = latDelta / visibleHeight;
    const lngPerPixel = lngDelta / windowWidth;
    const pinY = mapVisualCenterY + (centerLat - listing.latitude) / latPerPixel;
    const pinX = windowWidth / 2 + (listing.longitude - centerLng) / lngPerPixel;

    const offScreen = pinX < 0 || pinX > windowWidth || pinY < 0 || pinY > windowHeight;

    const bottomOffset = 82 + insets.bottom;
    const cardHeight = cardHeightRef.current || 220;
    const cardTop = windowHeight - bottomOffset - cardHeight;

    if (offScreen || pinY > cardTop) {
      const targetY = cardTop - 4;
      const newCenterLat = listing.latitude + (targetY - mapVisualCenterY) * latPerPixel;
      ignoreNextRegionChangeRef.current = true;
      isProgrammaticMoveRef.current = true;
      mapRef.current.animateToRegion(
        { latitude: newCenterLat, longitude: listing.longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta },
        480
      );
    }
    // Pin is already visible above the card zone — no pan needed
  }, [selectedId, results, windowHeight, windowWidth, insets.bottom]);

  useFocusEffect(
    useCallback(() => {
      // Keep the selected pin/card on return from a listing — clearing it here
      // remounts the marker mid-transition and the pin visibly flickers.
      setSearchSheetOpen(false);
      // Don't reset mapReady when switching tabs - keep map mounted
      // setMapReady(false);
      // mapReadyEventsRef.current = { ready: false, loaded: false };
      if (mapReadyTimerRef.current) {
        clearTimeout(mapReadyTimerRef.current);
        mapReadyTimerRef.current = null;
      }
      void (async () => {
        const deletedListingId = await AsyncStorage.getItem("deletedListingId");
        if (deletedListingId) {
          setResults((prev) => prev.filter((listing) => listing.id !== deletedListingId));
          await AsyncStorage.removeItem("deletedListingId");
        }
        const refreshToken = await AsyncStorage.getItem("searchRefreshToken");
        if (!refreshToken) return;
        await AsyncStorage.removeItem("searchRefreshToken");
        setShowSearchArea(false);
        setPendingSearch(null);
        setSelectedId(null);
        setShowSelectedCard(false);
        void runSearch(undefined, { showGlobal: false, preserveSelection: false });
      })();
      return () => {
        if (showAreaTimerRef.current) {
          clearTimeout(showAreaTimerRef.current);
          showAreaTimerRef.current = null;
        }
      };
    }, [runSearch])
  );

  useEffect(() => {
    if (!mapReady) {
      if (mapReadyFailSafeRef.current) clearTimeout(mapReadyFailSafeRef.current);
      mapReadyFailSafeRef.current = setTimeout(() => {
        setMapReady(true);
      }, 1200);
    } else {
      if (mapReadyFailSafeRef.current) {
        clearTimeout(mapReadyFailSafeRef.current);
        mapReadyFailSafeRef.current = null;
      }
    }
    return () => {
      if (mapReadyFailSafeRef.current) {
        clearTimeout(mapReadyFailSafeRef.current);
        mapReadyFailSafeRef.current = null;
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || loading || results.length > 0) return;
    if (initialSearchTriggeredRef.current) return;
    initialSearchTriggeredRef.current = true;
    void runSearch();
  }, [mapReady, loading, results.length, runSearch]);

  useEffect(() => {
    if (showFilters) {
      setFiltersVisible(true);
      slideAnim.setValue(windowHeight);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else if (filtersVisible) {
      Animated.timing(slideAnim, {
        toValue: windowHeight,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setFiltersVisible(false);
      });
    }
  }, [showFilters, filtersVisible, slideAnim, windowHeight]);

  useEffect(() => {
    if (searchSheetOpen) {
      setSearchSheetVisible(true);
      setAddressQuery("");
      setAddressSuggestions([]);
      setLocationError(null);
      searchAnim.setValue(40);
      Animated.parallel([
        Animated.timing(searchAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (searchSheetVisible) {
      Animated.timing(searchAnim, {
        toValue: 40,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSearchSheetVisible(false);
      });
    }
  }, [searchSheetOpen, searchSheetVisible, searchAnim]);

  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as SearchHistoryItem[];
        if (Array.isArray(parsed)) setSearchHistory(parsed);
      } catch {
        // Ignore history load errors.
      }
    })();
  }, []);

  useEffect(() => {
    if (filtersLoadedRef.current) return;
    filtersLoadedRef.current = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTERS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<{
            priceMin: string; priceMax: string;
            securityLevel: SecurityLevel | ""; vehicleSize: VehicleSize | "";
            spaceType: string; coveredParking: boolean; evCharging: boolean; instantBook: boolean;
          }>;
          if (saved.priceMin) setPriceMin(saved.priceMin);
          if (saved.priceMax) setPriceMax(saved.priceMax);
          if (saved.securityLevel) setSecurityLevel(saved.securityLevel);
          if (saved.vehicleSize) setVehicleSize(saved.vehicleSize);
          if (saved.spaceType) setSpaceType(saved.spaceType);
          if (typeof saved.coveredParking === "boolean") setCoveredParking(saved.coveredParking);
          if (typeof saved.evCharging === "boolean") setEvCharging(saved.evCharging);
          if (typeof saved.instantBook === "boolean") setInstantBook(saved.instantBook);
        }
      } catch {
        // Ignore filter load errors.
      } finally {
        setFiltersReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void AsyncStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ priceMin, priceMax, securityLevel, vehicleSize, spaceType, coveredParking, evCharging, instantBook })
    );
  }, [filtersReady, priceMin, priceMax, securityLevel, vehicleSize, spaceType, coveredParking, evCharging, instantBook]);

  const addToHistory = (item: SearchHistoryItem) => {
    setSearchHistory((prev) => {
      const next = [
        item,
        ...prev.filter(
          (entry) =>
            !(entry.label === item.label && entry.lat === item.lat && entry.lng === item.lng)
        ),
      ].slice(0, 6);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeFromHistory = (item: SearchHistoryItem) => {
    setSearchHistory((prev) => {
      const next = prev.filter(
        (entry) =>
          !(entry.label === item.label && entry.lat === item.lat && entry.lng === item.lng)
      );
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const closeFilters = () => setShowFilters(false);

  const handleRegionChanging = useCallback(() => {
    if (showAreaTimerRef.current) {
      clearTimeout(showAreaTimerRef.current);
      showAreaTimerRef.current = null;
    }
    if (selectedId && showSelectedCard && !isProgrammaticMoveRef.current) {
      if (cardDismissTimerRef.current) return;
      setDismissingCard(true);
      cardDismissTimerRef.current = setTimeout(() => {
        setShowSelectedCard(false);
        setDismissingCard(false);
        cardDismissTimerRef.current = null;
      }, 250);
    }
  }, [selectedId, showSelectedCard]);

  const handleMapPanDrag = useCallback(() => {
    requireUserPanForRegionSearchRef.current = false;
    hideEmptyNotice();
  }, [hideEmptyNotice]);

  const handleRegionChange = (nextRegion: typeof mapRegion) => {
    currentRegionRef.current = nextRegion;
    if (ignoreNextRegionChangeRef.current) {
      ignoreNextRegionChangeRef.current = false;
      return;
    }
    if (!initialRegionHandledRef.current) {
      initialRegionHandledRef.current = true;
      return;
    }
    if (mapRegionSaveTimerRef.current) {
      clearTimeout(mapRegionSaveTimerRef.current);
    }
    mapRegionSaveTimerRef.current = setTimeout(() => {
      void AsyncStorage.setItem(MAP_REGION_KEY, JSON.stringify(nextRegion));
    }, 350);

    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      return;
    }

    const last = lastSearchCenterRef.current ?? {
      lat: mapRegion.latitude,
      lng: mapRegion.longitude,
    };
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(nextRegion.latitude - last.lat);
    const dLng = toRad(nextRegion.longitude - last.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(last.lat)) *
        Math.cos(toRad(nextRegion.latitude)) *
        Math.sin(dLng / 2) ** 2;
    const distanceM = 2 * R * Math.asin(Math.sqrt(a));

    const visibleRadiusKm = radiusKmForRegion(nextRegion);
    const visibleRadiusM = visibleRadiusKm * 1000;
    const lastRadius = lastSearchRadiusRef.current;
    const radiusChangedSignificantly =
      lastRadius != null && Math.abs(visibleRadiusKm - lastRadius) / lastRadius > 0.3;

    if (distanceM < visibleRadiusM * 0.3 && !radiusChangedSignificantly) {
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      if (showSearchArea || pendingSearch) {
        setShowSearchArea(false);
        setPendingSearch(null);
      }
      return;
    }

    // Suppress region-change searches briefly after returning to the screen.
    if (suppressRegionSearchRef.current) return;
    if (requireUserPanForRegionSearchRef.current) return;

    // Show "Search this location" button — search only fires when the user taps it.
    if (showAreaTimerRef.current) {
      clearTimeout(showAreaTimerRef.current);
    }
    const nextLat = nextRegion.latitude.toFixed(6);
    const nextLng = nextRegion.longitude.toFixed(6);
    const nextRadius = radiusKmForRegion(nextRegion).toFixed(2);
    showAreaTimerRef.current = setTimeout(() => {
      showAreaTimerRef.current = null;
      setPendingSearch({ lat: nextLat, lng: nextLng, radiusKm: nextRadius });
      setShowSearchArea(true);
    }, 350);
  };

  const priceForListing = useCallback(
    (listing: ListingSummary) => {
      return calculateListingTotal(listing, startAt, endAt).total;
    },
    [endAt, startAt]
  );
  const filterPriceValues = useMemo(
    () =>
      results
        .map((listing) => priceForListing(listing))
        .filter((value) => Number.isFinite(value) && value > 0),
    [priceForListing, results]
  );
  const priceKey = useMemo(
    () => `${startAt.getTime()}-${endAt.getTime()}`,
    [startAt, endAt]
  );

  const clearFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setSecurityLevel("");
    setVehicleSize("");
    setSpaceType("");
    setCoveredParking(false);
    setEvCharging(false);
    setInstantBook(false);
    void AsyncStorage.removeItem(FILTERS_KEY);
  };

  const clearFiltersAndSearch = () => {
    clearFilters();
    void runSearch({
      priceMin: undefined,
      priceMax: undefined,
      securityLevel: undefined,
      vehicleSize: undefined,
      spaceType: undefined,
      coveredParking: undefined,
      evCharging: undefined,
      instantBook: undefined,
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priceMin.trim()) count += 1;
    if (priceMax.trim()) count += 1;
    if (securityLevel) count += 1;
    if (vehicleSize) count += 1;
    if (spaceType) count += 1;
    if (coveredParking) count += 1;
    if (evCharging) count += 1;
    if (instantBook) count += 1;
    return count;
  }, [
    priceMin,
    priceMax,
    securityLevel,
    vehicleSize,
    spaceType,
    coveredParking,
    evCharging,
    instantBook,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.mapShell}>
        <MapSection
            initialRegion={mapInitialRegion ?? mapRegion}
            results={results}
            style={styles.map}
            searchPinCoordinate={searchPinCoordinate}
            mapPadding={{
              top: insets.top + 120,
              bottom: 180 + insets.bottom + 16,
              left: 16,
              right: 16,
            }}
            provider="google"
            customMapStyle={LIGHT_MAP_STYLE}
            onSelect={handleSelectListing}
            onRegionChange={handleRegionChanging}
            onRegionChangeComplete={handleRegionChange}
            onPanDrag={handleMapPanDrag}
            selectedId={selectedId}
            mapRef={mapRef}
            freezeMarkers={loading || isRefreshingPins}
            onMapLoaded={() => handleMapReady("loaded")}
            onMapReady={() => handleMapReady("ready")}
            onOverlappingPins={setOverlappingPins}
            priceForListing={priceForListing}
            priceKey={priceKey}
            resumeNonce={mapResumeNonce}
            searchGeneration={searchGeneration}
            onAllPinsRevealed={() => setIsStaggerPending(false)}
          />
        {mapFrozenUri ? (
          <Animated.Image
            source={{ uri: mapFrozenUri }}
            style={[StyleSheet.absoluteFillObject, { opacity: mapFrozenOpacity }]}
            resizeMode="cover"
          />
        ) : null}
        {mapOverlayVisible ? (
          <Animated.View style={[styles.mapLoadingOverlay, { opacity: mapOverlayOpacity }]}>
            <LottieView
              source={require("../assets/Insider-loading.json")}
              autoPlay
              loop
              style={styles.mapLoadingLottie}
            />
            <Text style={styles.mapLoadingText}>
              {mapReady ? "Searching for spaces…" : "Loading map…"}
            </Text>
          </Animated.View>
        ) : null}
        <View style={[styles.overlay, { top: insets.top + 12 }]}>

          {/* ── Location card ───────────────────────── */}
          <View style={styles.searchCard}>
            <Pressable style={styles.searchCardLocation} onPress={() => setSearchSheetOpen(true)} testID="search-bar">
              <MapPinIcon size={17} color="#0a8050" strokeWidth={2.2} />
              <Text style={[styles.searchCardLocationText, !addressQuery && styles.searchCardPlaceholder]} numberOfLines={1}>
                {addressQuery || "Where to?"}
              </Text>
              {addressQuery ? (
                <Pressable onPress={() => { setAddressQuery(""); setAddressSuggestions([]); }} hitSlop={8}>
                  <CircleX size={16} color="#c0c8d2" strokeWidth={2.1} />
                </Pressable>
              ) : null}
            </Pressable>
          </View>

          {/* ── Time strip ──────────────────────────── */}
          <View style={styles.timeStrip}>
            <Pressable style={styles.timeStripBtn} onPress={() => openPicker("start")} android_ripple={null}>
              <Text style={styles.timeStripLabel}>Arrive</Text>
              <View style={styles.timeStripInner}>
                <Text style={styles.timeStripTime}>{formatTimeLabel(startAt)}</Text>
                <Text style={styles.timeStripSep}> · </Text>
                <Text style={styles.timeStripDate}>{formatDateLabel(startAt)}</Text>
              </View>
            </Pressable>
            <ArrowRight size={12} color="#0a8050" strokeWidth={2.4} style={{ marginHorizontal: 8 }} />
            <Pressable style={styles.timeStripBtn} onPress={() => openPicker("end")} android_ripple={null}>
              <Text style={styles.timeStripLabel}>Leave</Text>
              <View style={styles.timeStripInner}>
                <Text style={styles.timeStripTime}>{formatTimeLabel(endAt)}</Text>
                <Text style={styles.timeStripSep}> · </Text>
                <Text style={styles.timeStripDate}>{formatDateLabel(endAt)}</Text>
              </View>
            </Pressable>
          </View>

          {/* ── Filter + clear row ──────────────────── */}
          <View style={styles.searchCardRow}>
            <Pressable
              style={[styles.filterChip, activeFilterCount > 0 && styles.filterChipActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <SlidersHorizontal
                size={13}
                color={activeFilterCount > 0 ? "#ffffff" : "#374151"}
                strokeWidth={2.2}
              />
              <Text style={[activeFilterCount > 0 ? styles.filterChipTextActive : styles.filterChipText]}>
                Filters
              </Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterChipBadge}>
                  <Text style={styles.filterChipBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
            {activeFilterCount > 0 ? (
              <Pressable style={styles.clearChip} onPress={clearFiltersAndSearch}>
                <Text style={styles.clearChipText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void runSearch()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Finding spaces pill ─────────────────── */}
          <Animated.View
            pointerEvents="none"
            style={[styles.findingPill, { opacity: pillOpacity }]}
          >
            <ActivityIndicator size="small" color="#0a8050" style={styles.findingSpinner} />
            <Text style={styles.findingText}>Finding spaces</Text>
          </Animated.View>
        </View>

        {/* ── Search this area — floating bottom-center pill ─────────────── */}
        {renderSearchArea && !visibleSelectedListing && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.searchAreaFloat,
              { bottom: 96 + insets.bottom, opacity: searchAreaOpacity, transform: [{ translateY: searchAreaTranslateY }] },
            ]}
          >
            <Pressable
              style={styles.searchAreaPill}
              onPress={() => {
                // Cancel any pending debounce — coordinates come from the
                // current map position at tap time, not the stale debounce snapshot.
                if (showAreaTimerRef.current) {
                  clearTimeout(showAreaTimerRef.current);
                  showAreaTimerRef.current = null;
                }
                const region = currentRegionRef.current;
                if (!region) return;
                const nextLat = region.latitude.toFixed(6);
                const nextLng = region.longitude.toFixed(6);
                const nextRadius = radiusKmForRegion(region).toFixed(2);
                setLat(nextLat);
                setLng(nextLng);
                setRadiusKm(nextRadius);
                void runSearch(
                  { lat: nextLat, lng: nextLng, radiusKm: nextRadius },
                  { showGlobal: false, preserveSelection: true }
                );
              }}
            >
              <RefreshCw size={14} color="#0a8050" strokeWidth={2.2} />
              <Text style={styles.searchAreaPillText}>Search this area</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── No spaces notice — floating bottom-center pill ──────────── */}
        {emptyNotice ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.searchAreaFloat,
              { bottom: 96 + insets.bottom, opacity: emptyNoticeOpacity },
            ]}
          >
            <View style={styles.emptyNoticePill}>
              <Info size={15} color="#6b7280" strokeWidth={2.2} />
              <Text style={styles.emptyNoticeText}>{emptyNotice}</Text>
            </View>
          </Animated.View>
        ) : null}

        {visibleSelectedListing ? (
          <MapBottomCard
            title={getListingDisplayTitle(visibleSelectedListing)}
            imageUrl={selectedListingImage ?? undefined}
            rating={visibleSelectedListing.rating ?? 0}
            reviewCount={visibleSelectedListing.rating_count ?? 0}
            price={`€${formatPriceValue(priceForListing(visibleSelectedListing))} total`}
            amenities={selectedCardAmenities ?? visibleSelectedListing.amenities ?? null}
            isAvailable={visibleSelectedListing.is_available !== false}
            isFavorite={isFavorite(visibleSelectedListing.id)}
            onToggleFavorite={() => handleToggleFavorite(visibleSelectedListing)}
            onPress={() => {
              // Leave the pin selected — clearing it remounts the marker
              // mid-transition and it visibly flickers behind the push.
              navigation.navigate("Listing", { id: visibleSelectedListing.id, from, to });
            }}
            bottomOffset={82 + insets.bottom}
            horizontalInset={16}
            dismissing={dismissingCard}
            onHeightChange={(h) => { cardHeightRef.current = h; }}
          />
        ) : null}
        {filtersVisible ? (
          <View style={styles.filtersOverlay}>
            <Animated.View style={[styles.filtersBackdrop, { opacity: backdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={closeFilters} />
            </Animated.View>
            <KeyboardAvoidingView
              style={styles.filtersSheetHost}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <Animated.View
                style={[
                  styles.filtersPanel,
                  {
                    height: Math.min(windowHeight * 0.88, 760),
                    paddingBottom: Math.max(14, insets.bottom + 10),
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.filtersTopBar}>
                  <Pressable style={styles.filtersIconButton} onPress={closeFilters} hitSlop={8}>
                    <X size={22} color="#111827" strokeWidth={2.2} />
                  </Pressable>
                  <Text style={styles.filtersTitle}>Filters</Text>
                  <Pressable
                    style={[styles.filtersClearAction, activeFilterCount === 0 && styles.filtersClearActionDisabled]}
                    onPress={clearFiltersAndSearch}
                    disabled={activeFilterCount === 0}
                  >
                    <Text style={styles.filtersHeaderActionText}>
                      Clear
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.filtersScroll}
                  contentContainerStyle={styles.filtersContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <FilterSection title="Popular">
                    <View style={styles.filterChipGrid}>
                      <FilterChip
                        label="Instant"
                        icon={Zap}
                        selected={instantBook}
                        onPress={() => setInstantBook((prev) => !prev)}
                      />
                      <FilterChip
                        label="Covered"
                        icon={House}
                        selected={coveredParking}
                        onPress={() => setCoveredParking((prev) => !prev)}
                      />
                      <FilterChip
                        label="EV charging"
                        icon={BatteryCharging}
                        selected={evCharging}
                        onPress={() => setEvCharging((prev) => !prev)}
                      />
                      <FilterChip
                        label="Gated"
                        icon={Lock}
                        selected={securityLevel === "gated"}
                        onPress={() => setSecurityLevel(securityLevel === "gated" ? "" : "gated")}
                      />
                      <FilterChip
                        label="CCTV"
                        icon={Cctv}
                        selected={securityLevel === "cctv"}
                        onPress={() => setSecurityLevel(securityLevel === "cctv" ? "" : "cctv")}
                      />
                    </View>
                  </FilterSection>

                  <FilterSection title="Price shown">
                    <PriceRangeSlider
                      minValue={priceMin}
                      maxValue={priceMax}
                      priceValues={filterPriceValues}
                      onMinChange={setPriceMin}
                      onMaxChange={setPriceMax}
                    />
                  </FilterSection>

                  <FilterSection title="Parking type">
                    <View style={styles.filterTileGrid}>
                      {SPACE_TYPE_OPTIONS.map((type) => {
                        const TypeIcon = type.icon;
                        return (
                          <Pressable
                            key={type.value}
                            style={({ pressed }) => [
                              styles.filterTile,
                              spaceType === type.value && styles.filterTileActive,
                              pressed && styles.filterChipButtonPressed,
                            ]}
                            onPress={() => setSpaceType(spaceType === type.value ? "" : type.value)}
                          >
                            <TypeIcon
                              size={18}
                              color={spaceType === type.value ? "#0a8050" : "#64748b"}
                              strokeWidth={2}
                            />
                            <Text
                              style={[
                                styles.filterTileText,
                                spaceType === type.value && styles.filterTileTextActive,
                              ]}
                            >
                              {type.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </FilterSection>

                  <FilterSection title="Vehicle size">
                    <View style={styles.filterChipGrid}>
                      {VEHICLE_SIZE_OPTIONS.map((option) => (
                        <FilterChip
                          key={option.label}
                          label={option.label}
                          selected={vehicleSize === option.value}
                          onPress={() => setVehicleSize(vehicleSize === option.value ? "" : option.value)}
                        />
                      ))}
                    </View>
                  </FilterSection>
                </ScrollView>
                <View style={styles.filterFooter}>
                  <Pressable
                    style={styles.applyButton}
                    onPress={() => {
                      closeFilters();
                      void runSearch();
                    }}
                  >
                    <Text style={styles.applyButtonText}>Show spaces</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        ) : null}
        {searchSheetVisible ? (
          <KeyboardAvoidingView
            style={styles.searchOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Animated.View
              style={[
                styles.searchPanel,
                { transform: [{ translateY: searchAnim }], opacity: searchOverlayOpacity },
              ]}
            >
              {/* ── Search bar (back + input in one row) ── */}
              <View style={[styles.searchTopBar, { paddingTop: insets.top + 10 }]}>
                <Pressable onPress={() => setSearchSheetOpen(false)} hitSlop={10} style={styles.searchBackBtn}>
                  <ArrowLeft size={22} color="#111827" strokeWidth={2.2} />
                </Pressable>
                <View style={styles.searchInputShell}>
                  <Search size={16} color="#9aa1aa" strokeWidth={2.1} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInputField}
                    value={addressQuery}
                    onChangeText={(value) => {
                      setAddressQuery(value);
                      if (!value.trim()) setAddressSuggestions([]);
                    }}
                    placeholder="Area, address or landmark"
                    placeholderTextColor="#9aa1aa"
                    returnKeyType="search"
                    autoFocus
                  />
                  {addressQuery ? (
                    <Pressable
                      onPress={() => { setAddressQuery(""); setAddressSuggestions([]); }}
                      hitSlop={8}
                    >
                      <CircleX size={18} color="#c0c8d2" strokeWidth={2.1} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* ── Body ─────────────────────────────── */}
              <ScrollView
                style={styles.searchBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.searchList}>
                  {addressQuery.trim() ? (
                    /* ── Autocomplete results ── */
                    addressLoading ? (
                      <View style={styles.searchEmptyRow}>
                        <Text style={styles.searchEmptyText}>Searching…</Text>
                      </View>
                    ) : addressSuggestions.length > 0 ? (
                      addressSuggestions.slice(0, 6).map((suggestion, index) => {
                        const commaIdx = suggestion.description.indexOf(",");
                        const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
                        const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
                        return (
                          <Pressable
                            key={suggestion.place_id}
                            style={({ pressed }) => [styles.searchRow, pressed && styles.searchRowPressed]}
                            onPress={() => { setSearchSheetOpen(false); void handleSelectSuggestion(suggestion); }}
                          >
                            <View style={styles.searchRowIcon}>
                              <MapPinIcon size={16} color="#0a8050" strokeWidth={2.2} />
                            </View>
                            <View style={styles.searchRowCopy}>
                              <Text style={styles.searchRowTitle} numberOfLines={1}>{mainText}</Text>
                              {secondaryText ? <Text style={styles.searchRowSub} numberOfLines={1}>{secondaryText}</Text> : null}
                            </View>
                          </Pressable>
                        );
                      })
                    ) : (
                      <View style={styles.searchEmptyRow}>
                        <Text style={styles.searchEmptyText}>No results found.</Text>
                      </View>
                    )
                  ) : (
                    <>
                      {/* ── Use current location ── */}
                      <Pressable
                        style={({ pressed }) => [styles.searchRow, styles.searchRowLocation, pressed && styles.searchRowPressed]}
                        onPress={handleUseCurrentLocation}
                        disabled={locating}
                      >
                        <View style={[styles.searchRowIcon, styles.searchRowIconLocate]}>
                          <LocateFixed size={17} color="#0a8050" strokeWidth={2.2} />
                        </View>
                        <View style={styles.searchRowCopy}>
                          <Text style={styles.searchLocationTitle}>
                            {locating ? "Finding your location…" : "Use current location"}
                          </Text>
                          {locationError
                            ? <Text style={styles.searchRowSub}>{locationError}</Text>
                            : <Text style={styles.searchRowSub}>Use GPS to find spaces near you</Text>
                          }
                        </View>
                        {!locating && <ChevronRight size={16} color="#c0c8d2" strokeWidth={2.2} />}
                      </Pressable>

                      {/* ── Section header with inline tab toggle ── */}
                      <View style={styles.searchSectionHeader}>
                        <Text style={styles.searchSectionLabel}>
                          {activeSearchTab === "recents" ? "Recent searches" : "Favourites"}
                        </Text>
                        <View style={styles.searchToggle}>
                          {(["recents", "favourites"] as const).map((tab) => (
                            <Pressable
                              key={tab}
                              style={[styles.searchToggleBtn, activeSearchTab === tab && styles.searchToggleBtnActive]}
                              onPress={() => setActiveSearchTab(tab)}
                            >
                              <Text style={[styles.searchToggleText, activeSearchTab === tab && styles.searchToggleTextActive]}>
                                {tab === "recents" ? "Recent" : "Saved"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* ── List items ── */}
                      {activeSearchTab === "recents" ? (
                        searchHistory.length > 0 ? (
                          searchHistory.map((item) => (
                            <View key={`${item.label}-${item.lat}-${item.lng}`} style={styles.searchRow}>
                              <Pressable style={styles.searchRowPress} onPress={() => handleSelectHistoryItem(item)}>
                                <View style={styles.searchRowIcon}>
                                  <Clock size={16} color="#9ca3af" strokeWidth={2.1} />
                                </View>
                                <Text style={styles.searchRowTitle} numberOfLines={1}>{item.label}</Text>
                              </Pressable>
                              <Pressable style={styles.searchRemoveBtn} onPress={() => removeFromHistory(item)} hitSlop={6}>
                                <X size={13} color="#c0c8d2" strokeWidth={2.2} />
                              </Pressable>
                            </View>
                          ))
                        ) : (
                          <View style={styles.searchEmptyState}>
                            <Text style={styles.searchEmptyStateText}>No recent searches yet</Text>
                          </View>
                        )
                      ) : (
                        favorites.length > 0 ? (
                          favorites.map((item) => (
                            <Pressable
                              key={`fav-${item.id}`}
                              style={({ pressed }) => [styles.searchRow, pressed && styles.searchRowPressed]}
                              onPress={() => navigation.navigate("Listing", { id: item.id, from, to })}
                            >
                              <View style={[styles.searchRowIcon, styles.searchRowIconHeart]}>
                                <Heart size={14} color="#0a8050" fill="#0a8050" strokeWidth={2.1} />
                              </View>
                              <View style={styles.searchRowCopy}>
                                <Text style={styles.searchRowTitle} numberOfLines={1}>{getListingDisplayTitle(item)}</Text>
                                <Text style={styles.searchRowSub} numberOfLines={1}>{item.address}</Text>
                              </View>
                              <ChevronRight size={15} color="#d1d5db" strokeWidth={2.2} />
                            </Pressable>
                          ))
                        ) : (
                          <View style={styles.searchEmptyState}>
                            <Text style={styles.searchEmptyStateText}>No favourites saved yet</Text>
                          </View>
                        )
                      )}
                    </>
                  )}
                </View>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : null}
        {Platform.OS !== "web" ? (
          Platform.OS === "android" && pickerVisible ? (
            <Modal transparent animationType="fade" visible>
              <View style={styles.pickerBackdrop}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={closePicker} />
                <Animated.View style={[styles.pickerSheet, { paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: pickerSheetAnim }] }]}>

                  <View style={styles.pickerHandle} />

                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      {pickerField === "start" ? "Arrival time" : "Departure time"}
                    </Text>
                    {pickerField === "end" ? (
                      <Text style={styles.pickerSubtitle}>arriving {formatTimeLabel(startAt)}</Text>
                    ) : null}
                  </View>

                  {/* Quick duration pills — end picker only */}
                  {pickerField === "end" ? (() => {
                    const activeHours = draftDate
                      ? Math.round((draftDate.getTime() - startAt.getTime()) / 3_600_000)
                      : null;
                    return (
                      <View style={styles.pickerQuickRow}>
                        {([1, 2, 4, 8] as const).map((hours) => {
                          const active = activeHours === hours;
                          return (
                            <Pressable
                              key={hours}
                              style={[styles.pickerQuickPill, active && styles.pickerQuickPillActive]}
                              onPress={() => applyQuickDuration(hours)}
                            >
                              <Text style={[styles.pickerQuickText, active && styles.pickerQuickTextActive]}>{hours}h</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })() : null}

                  {/* Drum wheel */}
                  <DrumRollPicker
                    date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
                    minuteInterval={5}
                    onChange={(date) => setDraftDate(date)}
                    drumRef={drumPickerRef}
                  />

                  {/* Button row */}
                  <View style={styles.pickerFooter}>
                    <Pressable
                      style={styles.pickerBackBtn}
                      onPress={() => {
                        if (pickerField === "end") {
                          setPickerField("start");
                          setDraftDate(startAt);
                        } else {
                          closePicker();
                        }
                      }}
                    >
                      <Text style={styles.pickerBackBtnText}>
                        {pickerField === "end" ? "Back" : "Cancel"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.pickerFooterPrimary, pressed && { opacity: 0.88 }]}
                      onPress={() => {
                        const next = draftDate ?? (pickerField === "start" ? startAt : endAt);
                        if (pickerField === "start") {
                          applyPickedDate(next);
                          const suggestedEnd = new Date(next);
                          suggestedEnd.setHours(suggestedEnd.getHours() + 2);
                          setPickerField("end");
                          setDraftDate(suggestedEnd);
                          return;
                        }
                        timeSearchPendingRef.current = true;
                        applyPickedDate(next);
                        closePicker();
                      }}
                    >
                      <Text style={styles.pickerFooterPrimaryText}>
                        {pickerField === "start" ? "Next" : "Done"}
                      </Text>
                    </Pressable>
                  </View>

                </Animated.View>
              </View>
            </Modal>
          ) : (
            <DatePicker
              modal
              open={pickerVisible}
              date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
              mode="datetime"
              minuteInterval={5}
              onConfirm={(date) => {
                setDraftDate(date);
                if (pickerField === "start") {
                  applyPickedDate(date);
                  const suggestedEnd = new Date(date);
                  suggestedEnd.setHours(suggestedEnd.getHours() + 2);
                  setPickerField("end");
                  setDraftDate(suggestedEnd);
                  setTimeout(() => setPickerVisible(true), 0);
                  return;
                }
                timeSearchPendingRef.current = true;
                applyPickedDate(date);
                setPickerVisible(false);
                setDraftDate(null);
              }}
              onCancel={() => {
                setPickerVisible(false);
                setDraftDate(null);
              }}
            />
          )
        ) : null}
      </View>

      {overlappingPins.length > 1 && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOverlappingPins([])}>
          <Pressable style={styles.overlappingBackdrop} onPress={() => setOverlappingPins([])}>
            <View style={styles.overlappingSheet}>
              <View style={styles.overlappingHeader}>
                <Text style={styles.overlappingTitle}>Select parking spot</Text>
                <Text style={styles.overlappingSubtitle}>{overlappingPins.length} spots at this location</Text>
              </View>
              <View style={styles.overlappingList}>
                {overlappingPins.map((listing) => (
                  <Pressable
                    key={listing.id}
                    style={styles.overlappingItem}
                    onPress={() => {
                      setSelectedId(listing.id);
                      setOverlappingPins([]);
                    }}
                  >
                    <View style={styles.overlappingItemContent}>
                      <Text style={styles.overlappingItemTitle} numberOfLines={1}>
                        {getListingDisplayTitle(listing)}
                      </Text>
                      <Text style={styles.overlappingItemAddress} numberOfLines={1}>
                        {listing.address}
                      </Text>
                    </View>
                    <Text style={styles.overlappingItemPrice}>
                      €{formatPriceValue(priceForListing(listing))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapShell: {
    flex: 1,
    position: "relative",
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.appBg,
    zIndex: 10,
  },
  mapLoadingLottie: {
    width: 120,
    height: 120,
  },
  mapLoadingText: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    marginTop: 4,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
  },

  // ── Unified search card
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
  },
  searchCardLocation: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  searchCardLocationText: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#111827",
    letterSpacing: -0.1,
  },
  searchCardPlaceholder: {
    color: "#9ca3af",
    fontFamily: "PlusJakartaSans-Regular",
  },
  // ── Time strip
  timeStrip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  timeStripBtn: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 2,
  },
  timeStripLabel: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  timeStripInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  timeStripTime: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: "#111827",
    letterSpacing: -0.2,
  },
  timeStripSep: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#d1d5db",
  },
  timeStripDate: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#6b7280",
  },
  // ── Filter / clear / loading row below card
  searchCardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipActive: {
    backgroundColor: "#0a8050",
  },
  filterChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#374151",
  },
  filterChipTextActive: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#ffffff",
  },
  clearChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  clearChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#374151",
  },
  findingPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    elevation: 6,
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  findingSpinner: {
    marginRight: 8,
  },
  findingText: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.2,
  },

  filtersPanel: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  filtersSheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  filtersScroll: {
    flex: 1,
  },
  filtersContent: {
    paddingBottom: 8,
    paddingHorizontal: spacing.screenX,
  },
  filtersOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  filtersBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  filtersTopBar: {
    alignItems: "center",
    borderBottomColor: "#eef2f6",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 12,
  },
  filtersIconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  filtersClearAction: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    width: 58,
  },
  filtersClearActionDisabled: {
    opacity: 0.25,
  },
  filtersHeaderActionText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filtersTitle: {
    flex: 1,
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: 0,
    textAlign: "center",
  },
  filterSection: {
    borderBottomColor: "#eef2f6",
    borderBottomWidth: 1,
    paddingVertical: 20,
  },
  filterSectionHeader: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    letterSpacing: 0,
  },
  filterSectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  priceSlider: {
    paddingTop: 10,
  },
  priceRangeHint: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  priceRangeGraph: {
    height: 124,
    overflow: "visible",
    position: "relative",
  },
  priceHistogram: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: "100%",
    justifyContent: "space-between",
    marginHorizontal: 21,
    paddingBottom: 28,
    position: "relative",
  },
  priceHistogramBar: {
    backgroundColor: "#dfe3e8",
    borderRadius: 999,
    flex: 1,
    marginHorizontal: 2,
    maxWidth: 8,
  },
  priceHistogramBarSelected: {
    backgroundColor: "#0f172a",
  },
  priceRangeValueRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceRangeValueRight: {
    alignItems: "flex-end",
  },
  priceRangeDivider: {
    backgroundColor: "#dfe3e8",
    flex: 1,
    height: 1,
    marginHorizontal: 14,
  },
  priceRangeValue: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    letterSpacing: -0.6,
    marginTop: 3,
  },
  priceValueLabel: {
    color: "#6b7280",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  priceRangeSlider: {
    bottom: 0,
    height: 54,
    left: 0,
    position: "absolute",
    right: 0,
  },
  priceRangeSliderTrack: {
    borderRadius: 999,
    height: 4,
  },
  priceRangeSliderSelectedTrack: {
    borderRadius: 999,
    height: 4,
  },
  priceRangeThumb: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d7dde4",
    borderRadius: 999,
    borderWidth: 1,
    elevation: 5,
    height: 42,
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    width: 42,
  },
  priceRangeThumbDot: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    height: 11,
    width: 11,
  },
  filterChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChipButton: {
    alignItems: "center",
    backgroundColor: "#f7f8fa",
    borderColor: "#e6ebf0",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipButtonSmall: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipButtonActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  filterChipButtonPressed: {
    opacity: 0.92,
  },
  filterChipButtonText: {
    color: "#0f172a",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filterChipButtonTextActive: {
    color: "#ffffff",
  },
  filterTileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterTile: {
    alignItems: "center",
    backgroundColor: "#f7f8fa",
    borderColor: "#e6ebf0",
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterTileActive: {
    backgroundColor: "#eefbf4",
    borderColor: "#8fdcb3",
  },
  filterTileText: {
    color: "#0f172a",
    flexShrink: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filterTileTextActive: {
    color: "#0a8050",
  },
  filterFooter: {
    backgroundColor: "#ffffff",
    borderTopColor: "#eef2f6",
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    minHeight: 52,
    paddingVertical: 13,
  },
  applyButtonText: {
    ...textStyles.button,
    fontSize: 14,
    letterSpacing: 0,
  },
  filterChipBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    height: 18,
    justifyContent: "center",
    marginLeft: 8,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  filterChipBadgeText: {
    color: "#ffffff",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    lineHeight: 12,
  },
  // ── Search sheet ──────────────────────────────────────────────
  searchOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40,
  },
  searchPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  // Top bar — back arrow + input in one row
  searchTopBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#E9EEF3",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  searchBackBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 44,
    flexShrink: 0,
  },
  searchInputShell: {
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderColor: "#E8EDF2",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInputField: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: "#111827",
  },

  // Body — unified list, no separate cards
  searchBody: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  searchList: {
    backgroundColor: "#ffffff",
    borderTopWidth: 0,
  },

  // Location row
  searchRowLocation: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  searchRowIconLocate: {
    backgroundColor: "#edf7f2",
  },
  searchLocationTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#111827",
  },

  // Section header row with inline toggle
  searchSectionHeader: {
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchSectionLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#6b7280",
    letterSpacing: 0.2,
  },
  searchToggle: {
    backgroundColor: "#EAECF0",
    borderRadius: 10,
    flexDirection: "row",
    gap: 2,
    padding: 2,
  },
  searchToggleBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchToggleBtnActive: {
    backgroundColor: "#ffffff",
  },
  searchToggleText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#6b7280",
  },
  searchToggleTextActive: {
    color: "#111827",
  },

  // Rows
  searchRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#F0F2F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  searchRowPressed: {
    backgroundColor: "#F7F8FA",
  },
  searchRowPress: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  searchRowIcon: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    flexShrink: 0,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  searchRowIconHeart: {
    backgroundColor: "#edf7f2",
  },
  searchRowCopy: {
    flex: 1,
  },
  searchRowTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#111827",
  },
  searchRowSub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: "#374151",
    marginTop: 2,
  },
  searchRemoveBtn: {
    alignItems: "center",
    height: 26,
    justifyContent: "center",
    width: 26,
    flexShrink: 0,
  },

  // Empty
  searchEmptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  searchEmptyText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: "#6b7280",
  },
  searchEmptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  searchEmptyStateText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: "#6b7280",
    marginTop: 0,
  },

  sectionLabel: {
    ...textStyles.meta,
    color: colors.text,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  searchAreaFloat: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 15,
  },
  searchAreaPill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radius.pill,
    elevation: 8,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  searchAreaPillText: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    letterSpacing: 0.1,
  },
  emptyNoticePill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radius.pill,
    elevation: 8,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  emptyNoticeText: {
    color: "#374151",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0.1,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  pickerHandle: {
    alignSelf: "center",
    backgroundColor: "#D1D5DB",
    borderRadius: 99,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  pickerHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  pickerTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#111827",
    letterSpacing: -0.3,
  },
  pickerSubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  // Quick duration pills
  pickerQuickRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 12,
  },
  pickerQuickPill: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  pickerQuickPillActive: {
    backgroundColor: "#0a8050",
    borderColor: "#0a8050",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  pickerQuickText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#374151",
  },
  pickerQuickTextActive: {
    color: "#ffffff",
  },

  pickerFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  pickerBackBtn: {
    alignItems: "center",
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    height: 52,
    justifyContent: "center",
  },
  pickerBackBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#374151",
    letterSpacing: -0.2,
  },
  pickerFooterPrimary: {
    alignItems: "center",
    backgroundColor: "#0a8050",
    borderRadius: 14,
    flex: 2,
    height: 52,
    justifyContent: "center",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  pickerFooterPrimaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  errorRow: {
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  error: {
    color: "#b42318",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0a8050",
  },
  retryText: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
  },
  overlappingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overlappingSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  overlappingHeader: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  overlappingTitle: {
    ...textStyles.titleSmall,
    marginBottom: 4,
  },
  overlappingSubtitle: {
    ...textStyles.bodyMedium,
  },
  overlappingList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  overlappingItem: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
    marginHorizontal: 8,
    padding: 16,
    ...cardShadow,
  },
  overlappingItemContent: {
    flex: 1,
    marginRight: 12,
  },
  overlappingItemTitle: {
    ...textStyles.bodyStrong,
    fontSize: 15,
    marginBottom: 4,
  },
  overlappingItemAddress: {
    ...textStyles.meta,
  },
  overlappingItemPrice: {
    ...textStyles.titleSmall,
    color: colors.accent,
  },
});
