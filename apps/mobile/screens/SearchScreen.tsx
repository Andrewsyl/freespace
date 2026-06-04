import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import type MapView from "react-native-maps";
import DatePicker from "../components/AdaptiveDatePicker";
import { DrumRollPicker, type DrumRollPickerHandle } from "../components/DrumRollPicker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth";
import { useAppLaunch } from "../appLaunch";
import { useFavorites } from "../favorites";
import MapSection from "../components/MapSection";
import { MapBottomCard } from "../components/MapBottomCard";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import { calculateListingTotal, formatPriceValue } from "../utils/pricing";
import { useGlobalLoading } from "../components/GlobalLoading";
import { getListing, searchListings } from "../api";
import { trackEvent } from "../analytics";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { MapPin as MapPinIcon } from "lucide-react-native";
import { logError, logInfo } from "../logger";
import type {
  ListingSummary,
  RootStackParamList,
  SearchParams,
  SecurityLevel,
  VehicleSize,
} from "../types";
import { Ionicons } from "@expo/vector-icons";

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

function rankResultsForSearch(results: ListingSummary[], start: Date, end: Date) {
  return results;
}

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

  useEffect(() => {
    if (pickerVisible) {
      Animated.spring(pickerSheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    } else {
      pickerSheetAnim.setValue(400);
    }
  }, [pickerVisible, pickerSheetAnim]);
  const timeSearchPendingRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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
  const { launchComplete } = useAppLaunch();
  const isFocused = useIsFocused();
  const { favorites, isFavorite, toggle } = useFavorites();
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
  const ignoreNextRegionChangeRef = useRef(false);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSearchRadiusRef = useRef<number | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const skipAutocompleteRef = useRef(0);
  const historyLoadedRef = useRef(false);
  const HISTORY_KEY = "searchHistory";
  const MAP_REGION_KEY = "search.mapRegion";

  useEffect(() => {
    if (showSearchArea && pendingSearch) {
      setRenderSearchArea(true);
      searchAreaTranslateY.setValue(10);
      Animated.parallel([
        Animated.timing(searchAreaOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(searchAreaTranslateY, {
          toValue: 0,
          damping: 20,
          stiffness: 260,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(searchAreaOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(searchAreaTranslateY, {
        toValue: 6,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRenderSearchArea(false);
      }
    });
  }, [pendingSearch, searchAreaOpacity, searchAreaTranslateY, showSearchArea]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(MAP_REGION_KEY);
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as typeof mapRegion;
        if (
          typeof parsed?.latitude === "number" &&
          typeof parsed?.longitude === "number" &&
          typeof parsed?.latitudeDelta === "number" &&
          typeof parsed?.longitudeDelta === "number"
        ) {
          setMapInitialRegion(parsed);
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
      let nextResultsSnapshot: ListingSummary[] | null = null;
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      searchStartedAtRef.current = Date.now();
      const preserveSelection = options?.preserveSelection ?? false;
      setLoading(true);
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
        nextResultsSnapshot = [...rankResultsForSearch(spaces, startAt, endAt), ...carryOver];
        // If preserving selection, keep the selected listing in results so the card stays visible
        if (preserveSelection) {
          setSelectedId((prev) => {
            if (prev && !nextResultsSnapshot!.some((l) => l.id === prev)) {
              const kept = resultsRef.current.find((l) => l.id === prev);
              if (kept) nextResultsSnapshot!.push(kept);
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
        setError(message);
        if (searchRequestIdRef.current === requestId) {
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
          }
          setIsRefreshingPins(false);
        }, remaining);
      }
    },
    [buildSearchParams, pendingResults]
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
        if (uri) setMapFrozenUri(uri);
      } catch {
        // snapshot failed — map will redraw normally
      }
    });
    const unsubscribeFocus = navigation.addListener("focus", () => {
      if (mapFreezeTimerRef.current) clearTimeout(mapFreezeTimerRef.current);
      mapFreezeTimerRef.current = setTimeout(() => {
        setMapFrozenUri(null);
        mapFreezeTimerRef.current = null;
      }, 600);
      // Suppress region-change searches while the map settles after returning
      suppressRegionSearchRef.current = true;
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

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const drumPickerRef = useRef<DrumRollPickerHandle>(null);

  const applyQuickDuration = (hours: number) => {
    const nextEnd = new Date(startAt);
    nextEnd.setHours(nextEnd.getHours() + hours);
    setDraftDate(nextEnd);
    drumPickerRef.current?.setTime(nextEnd);
  };


  const fetchAutocomplete = async (query: string) => {
    if (!mapsKey) return;
    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        input: query,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      setAddressSuggestions(payload.predictions ?? []);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
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
        lastSearchCenterRef.current = { lat: location.lat, lng: location.lng };
        setSelectedId(null);
        setShowSearchArea(false);
        setPendingSearch(null);
        isProgrammaticMoveRef.current = true;
        mapRef.current?.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          280
        );
        void runSearch({ lat: nextLat, lng: nextLng });
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission needed.");
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError("Location services are off.");
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
      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        280
      );
      setSearchSheetOpen(false);
      clearTimeout(loadingTimer);
      hideGlobalLoading();
      void runSearch({ lat: nextLat, lng: nextLng }, { showGlobal: true });
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
    lastSearchCenterRef.current = {
      lat: Number.parseFloat(nextLat),
      lng: Number.parseFloat(nextLng),
    };
    setSelectedId(null);
    setShowSearchArea(false);
    setPendingSearch(null);
    isProgrammaticMoveRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: Number.parseFloat(nextLat),
        longitude: Number.parseFloat(nextLng),
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      280
    );
    setSearchSheetOpen(false);
    void runSearch({ lat: nextLat, lng: nextLng });
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
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${visibleSelectedListing.latitude},${visibleSelectedListing.longitude}&key=${mapsKey}`
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
      setSelectedId(null);
      setShowSelectedCard(false);
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
    if (launchComplete && !mapReady) {
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
  }, [launchComplete, mapReady]);

  useEffect(() => {
    if (!launchComplete || !mapReady || loading || results.length > 0) return;
    if (initialSearchTriggeredRef.current) return;
    initialSearchTriggeredRef.current = true;
    void runSearch();
  }, [launchComplete, mapReady, loading, results.length, runSearch]);

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

    // Debounce: wait for the map to fully settle, then auto-search the new area.
    if (showAreaTimerRef.current) {
      clearTimeout(showAreaTimerRef.current);
    }
    const nextLat = nextRegion.latitude.toFixed(6);
    const nextLng = nextRegion.longitude.toFixed(6);
    const nextRadius = radiusKmForRegion(nextRegion).toFixed(2);
    showAreaTimerRef.current = setTimeout(() => {
      showAreaTimerRef.current = null;
      setLat(nextLat);
      setLng(nextLng);
      setRadiusKm(nextRadius);
      void runSearch(
        { lat: nextLat, lng: nextLng, radiusKm: nextRadius },
        { showGlobal: false, preserveSelection: true }
      );
    }, 700);
  };

  const priceForListing = useCallback(
    (listing: ListingSummary) => {
      return calculateListingTotal(listing, startAt, endAt).total;
    },
    [endAt, startAt]
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
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.mapShell}>
        {launchComplete ? (
          <MapSection
            initialRegion={mapInitialRegion ?? mapRegion}
            results={results}
            style={styles.map}
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
            selectedId={selectedId}
            mapRef={mapRef}
            freezeMarkers={loading || isRefreshingPins}
            onMapLoaded={() => handleMapReady("loaded")}
            onMapReady={() => handleMapReady("ready")}
            onOverlappingPins={setOverlappingPins}
            priceForListing={priceForListing}
            priceKey={priceKey}
          />
        ) : null}
        {mapFrozenUri ? (
          <Image
            source={{ uri: mapFrozenUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : null}
        <View style={[styles.overlay, { top: insets.top + 12 }]}>

          {/* ── Location card ───────────────────────── */}
          <View style={styles.searchCard}>
            <Pressable style={styles.searchCardLocation} onPress={() => setSearchSheetOpen(true)} testID="search-bar">
              <Ionicons name="location-outline" size={17} color="#0a8050" />
              <Text style={[styles.searchCardLocationText, !addressQuery && styles.searchCardPlaceholder]} numberOfLines={1}>
                {addressQuery || "Where to?"}
              </Text>
              {addressQuery ? (
                <Pressable onPress={() => { setAddressQuery(""); setAddressSuggestions([]); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#c0c8d2" />
                </Pressable>
              ) : null}
            </Pressable>
          </View>

          {/* ── Time strip ──────────────────────────── */}
          <View style={styles.timeStrip}>
            <Pressable style={styles.timeStripBtn} onPress={() => openPicker("start")} android_ripple={null}>
              <Text style={styles.timeStripTime}>{formatTimeLabel(startAt)}</Text>
              <Text style={styles.timeStripSep}> · </Text>
              <Text style={styles.timeStripDate}>{formatDateLabel(startAt)}</Text>
            </Pressable>
            <Ionicons name="arrow-forward" size={12} color="#c0c8d2" style={{ marginHorizontal: 8 }} />
            <Pressable style={styles.timeStripBtn} onPress={() => openPicker("end")} android_ripple={null}>
              <Text style={styles.timeStripTime}>{formatTimeLabel(endAt)}</Text>
              <Text style={styles.timeStripSep}> · </Text>
              <Text style={styles.timeStripDate}>{formatDateLabel(endAt)}</Text>
            </Pressable>
          </View>

          {/* ── Filter + clear row ──────────────────── */}
          <View style={styles.searchCardRow}>
            <Pressable
              style={[styles.filterChip, (priceMin || priceMax || securityLevel || vehicleSize || spaceType || coveredParking || evCharging || instantBook) && styles.filterChipActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Ionicons name="options-outline" size={13} color={(priceMin || priceMax || securityLevel || vehicleSize || spaceType || coveredParking || evCharging || instantBook) ? "#ffffff" : "#374151"} />
              <Text style={[(priceMin || priceMax || securityLevel || vehicleSize || spaceType || coveredParking || evCharging || instantBook) ? styles.filterChipTextActive : styles.filterChipText]}>Filters</Text>
            </Pressable>
            {(priceMin || priceMax || securityLevel || vehicleSize || spaceType || coveredParking || evCharging || instantBook) ? (
              <Pressable style={styles.clearChip} onPress={clearFilters}>
                <Text style={styles.clearChipText}>Clear</Text>
              </Pressable>
            ) : null}
            {loading ? (
              <View style={styles.searchLoadingChip}>
                <Text style={styles.searchLoadingText}>Searching…</Text>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        {visibleSelectedListing ? (
          <MapBottomCard
            title={getListingDisplayTitle(visibleSelectedListing)}
            imageUrl={selectedListingImage ?? undefined}
            rating={visibleSelectedListing.rating ?? 0}
            reviewCount={visibleSelectedListing.rating_count ?? 0}
            price={`€${formatPriceValue(priceForListing(visibleSelectedListing))} total`}
            subtitle={visibleSelectedListing.availability_text?.trim() || "Parking space"}
            badgeLabel={selectedCardAmenities?.[0] ?? visibleSelectedListing.amenities?.[0] ?? null}
            amenities={selectedCardAmenities ?? visibleSelectedListing.amenities ?? []}
            vehicleSizeLabel={
              visibleSelectedListing.vehicle_size_suitability ??
              visibleSelectedListing.vehicleSizeSuitability ??
              null
            }
            isAvailable={visibleSelectedListing.is_available !== false}
            isFavorite={isFavorite(visibleSelectedListing.id)}
            onToggleFavorite={() => toggle(visibleSelectedListing)}
            onPress={() => {
              setShowSelectedCard(false);
              setSelectedId(null);
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
            <Pressable style={styles.filtersBackdrop} onPress={closeFilters} />
            <Animated.View
              style={[styles.filtersPanel, { transform: [{ translateY: slideAnim }] }]}
            >
              <ScrollView
                contentContainerStyle={styles.filtersContent}
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.filtersHeaderRow}>
                <Text style={styles.filtersTitle}>Filters</Text>
                <Pressable style={styles.filtersClose} onPress={closeFilters}>
                  <Text style={styles.filtersCloseText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.filtersSubtitle}>Refine results</Text>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Price</Text>
                <View style={styles.row}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Min € / day</Text>
                    <TextInput
                      style={styles.input}
                      value={priceMin}
                      onChangeText={setPriceMin}
                      keyboardType="numeric"
                      placeholder="10"
                      placeholderTextColor="#98a2b3"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Max € / day</Text>
                    <TextInput
                      style={styles.input}
                      value={priceMax}
                      onChangeText={setPriceMax}
                      keyboardType="numeric"
                      placeholder="40"
                      placeholderTextColor="#98a2b3"
                    />
                  </View>
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Vehicle size</Text>
                <View style={styles.chipRow}>
                  {(["motorcycle", "car", "van"] as const).map((size) => (
                    <Pressable
                      key={size}
                      style={[styles.chip, vehicleSize === size && styles.chipActive]}
                      onPress={() => setVehicleSize(vehicleSize === size ? "" : size)}
                      android_ripple={null}
                    >
                      <Text style={[styles.chipText, vehicleSize === size && styles.chipTextActive]}>
                        {size}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Space type</Text>
                <View style={styles.chipRow}>
                  {["Private Driveway", "Garage", "Car park", "Private road"].map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.chip, spaceType === type && styles.chipActive]}
                      onPress={() => setSpaceType(spaceType === type ? "" : type)}
                      android_ripple={null}
                    >
                      <Text style={[styles.chipText, spaceType === type && styles.chipTextActive]}>
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Security level</Text>
                <View style={styles.chipRow}>
                  {(["basic", "gated", "cctv"] as const).map((level) => (
                    <Pressable
                      key={level}
                      style={[styles.chip, securityLevel === level && styles.chipActive]}
                      onPress={() => setSecurityLevel(securityLevel === level ? "" : level)}
                      android_ripple={null}
                    >
                      <Text
                        style={[styles.chipText, securityLevel === level && styles.chipTextActive]}
                      >
                        {level === "cctv" ? "CCTV" : level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Preferences</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Instant book only</Text>
                  <Switch value={instantBook} onValueChange={setInstantBook} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Covered parking</Text>
                  <Switch value={coveredParking} onValueChange={setCoveredParking} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>EV charging</Text>
                  <Switch value={evCharging} onValueChange={setEvCharging} />
                </View>
              </View>
              <Pressable
                style={styles.applyButton}
                onPress={() => {
                  closeFilters();
                  void runSearch();
                }}
              >
                <Text style={styles.applyButtonText}>Apply filters</Text>
              </Pressable>
              </ScrollView>
            </Animated.View>
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
                  <Ionicons name="arrow-back" size={22} color="#111827" />
                </Pressable>
                <View style={styles.searchInputShell}>
                  <Ionicons name="search-outline" size={16} color="#9aa1aa" style={{ marginRight: 8 }} />
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
                      <Ionicons name="close-circle" size={18} color="#c0c8d2" />
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
                          <Ionicons name="locate" size={17} color="#0a8050" />
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
                        {!locating && <Ionicons name="chevron-forward" size={16} color="#c0c8d2" />}
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
                                  <Ionicons name="time-outline" size={16} color="#9ca3af" />
                                </View>
                                <Text style={styles.searchRowTitle} numberOfLines={1}>{item.label}</Text>
                              </Pressable>
                              <Pressable style={styles.searchRemoveBtn} onPress={() => removeFromHistory(item)} hitSlop={6}>
                                <Ionicons name="close" size={13} color="#c0c8d2" />
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
                                <Ionicons name="heart" size={14} color="#0a8050" />
                              </View>
                              <View style={styles.searchRowCopy}>
                                <Text style={styles.searchRowTitle} numberOfLines={1}>{getListingDisplayTitle(item)}</Text>
                                <Text style={styles.searchRowSub} numberOfLines={1}>{item.address}</Text>
                              </View>
                              <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
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
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setPickerVisible(false); setDraftDate(null); }} />
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
                    minuteInterval={15}
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
                          setPickerVisible(false);
                          setDraftDate(null);
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
                        setPickerVisible(false);
                        setDraftDate(null);
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
              minuteInterval={15}
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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    left: spacing.screenX,
    position: "absolute",
    right: spacing.screenX,
    top: 10,
  },

  // ── Unified search card
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  searchCardLocation: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchCardLocationText: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
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
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
  timeStripBtn: {
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
    marginTop: 10,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    paddingVertical: 7,
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
  searchLoadingChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  // keep these for compat
  searchInput: {
    ...textStyles.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
    color: colors.text,
  },
  searchInputPlaceholder: {
    color: "#98a2b3",
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: radius.pill,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 18,
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  dateRowCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchOverlayTrigger: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  searchLoadingBubble: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    marginTop: 10,
    overflow: "visible",
    paddingLeft: 52,
    paddingRight: 12,
  },
  searchLoadingLottie: {
    left: -10,
    position: "absolute",
    top: -26,
    height: 86,
    width: 86,
  },
  searchLoadingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  filtersHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  filtersToggle: {
    backgroundColor: colors.appBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filtersToggleActive: {
    backgroundColor: "#e8fff8",
  },
  filtersToggleText: {
    ...textStyles.meta,
    color: colors.text,
  },
  filtersToggleTextActive: {
    color: colors.accent,
  },
  clearFilters: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: radius.pill,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...cardShadow,
  },
  clearFiltersText: {
    ...textStyles.meta,
  },
  filtersPanel: {
    backgroundColor: colors.cardBg,
    padding: spacing.screenX,
    paddingTop: 24,
    height: "100%",
  },
  filtersContent: {
    paddingBottom: 24,
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
  filtersHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  filtersClose: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  filtersCloseText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  filtersTitle: {
    ...textStyles.titleSmall,
  },
  filtersSubtitle: {
    ...textStyles.bodyMedium,
    fontSize: 13,
    marginBottom: 16,
  },
  filtersSection: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    ...textStyles.meta,
    marginBottom: 6,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: colors.appBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    ...textStyles.meta,
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  switchLabel: {
    ...textStyles.bodyStrong,
    fontSize: 13,
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 10,
  },
  applyButtonText: {
    ...textStyles.button,
    fontSize: 14,
  },
  suggestions: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  // ── Search sheet ──────────────────────────────────────────────
  searchOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40,
    backgroundColor: "#ffffff",
  },
  searchPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  // Top bar — back arrow + input in one row
  searchTopBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#F0F2F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  searchBackBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 44,
    flexShrink: 0,
  },
  searchInputShell: {
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderColor: "#E8EDF2",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInputField: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
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
    paddingVertical: 8,
  },
  searchSectionLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#6b7280",
    letterSpacing: 0.2,
  },
  searchToggle: {
    backgroundColor: "#EAECF0",
    borderRadius: 8,
    flexDirection: "row",
    gap: 2,
    padding: 2,
  },
  searchToggleBtn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    paddingVertical: 13,
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
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  searchRowIconHeart: {
    backgroundColor: "#edf7f2",
  },
  searchRowCopy: {
    flex: 1,
  },
  searchRowTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#111827",
  },
  searchRowSub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
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
    paddingVertical: 16,
  },
  searchEmptyText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: "#6b7280",
  },
  searchEmptyState: {
    alignItems: "center",
    paddingVertical: 28,
  },
  searchEmptyStateText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: "#6b7280",
    marginTop: 0,
  },

  emptyText: {
    color: "#374151",
    fontSize: 13,
  },
  sectionLabel: {
    ...textStyles.meta,
    color: colors.text,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateTimeColumn: {
    flex: 1,
    minWidth: 0,
  },
  dateTimeLabel: {
    ...textStyles.label,
    marginBottom: 4,
  },
  dateTimeValue: {
    ...textStyles.bodyStrong,
    fontSize: 14,
    lineHeight: 19,
  },
  dateArrowIcon: {
    marginHorizontal: 4,
  },
  dateArrow: {
    alignItems: "center",
    justifyContent: "center",
    width: 12,
  },
  dateArrowText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  searchAreaButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 8,
    height: 38,
    marginTop: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  searchAreaWrap: {
    alignItems: "center",
    marginTop: 10,
  },
  searchAreaText: {
    ...textStyles.button,
    fontSize: 14,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  durationPill: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationText: {
    ...textStyles.meta,
    color: colors.textMuted,
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
    paddingTop: 8,
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
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  pickerQuickPillActive: {
    backgroundColor: "#0a8050",
    borderColor: "#0a8050",
    shadowColor: "#0a8050",
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
    justifyContent: "center",
    paddingVertical: 14,
  },
  pickerBackBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#374151",
  },
  pickerFooterPrimary: {
    alignItems: "center",
    backgroundColor: "#0a8050",
    borderRadius: 14,
    flex: 2,
    justifyContent: "center",
    paddingVertical: 14,
    shadowColor: "#0a8050",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerFooterPrimaryText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  suggestionItem: {
    borderBottomColor: "#f2f4f7",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    ...textStyles.body,
  },
  suggestionMuted: {
    ...textStyles.meta,
    color: colors.textSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  error: {
    color: "#b42318",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#eaecf0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
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
