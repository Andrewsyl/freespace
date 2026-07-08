import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Accessibility,
  ArrowDownUp,
  Bike,
  BatteryCharging,
  Cctv,
  Clock,
  Fence,
  Heart,
  IdCard,
  KeyRound,
  Lightbulb,
  Maximize2,
  Star,
  Warehouse,
  CarFront,
} from "lucide-react-native";
import { colors } from "../styles/theme";
import { motion } from "../styles/motion";

type MapBottomCardProps = {
  title: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  price: string;
  amenities?: string[] | null;
  isAvailable?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
  dismissing?: boolean;
  onHeightChange?: (height: number) => void;
};

const AMENITY_ACRONYMS: Record<string, string> = { ev: "EV", cctv: "CCTV" };

function humanizeAmenity(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return AMENITY_ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function getFeatureIconType(label: string) {
  const n = label.toLowerCase();
  if (n.includes("low") || n.includes("clearance") || n.includes("height")) return "low";
  if (n.includes("permit")) return "permit";
  if (n.includes("ev") || n.includes("charger") || n.includes("charging")) return "ev";
  if (n.includes("cctv") || n.includes("camera")) return "cctv";
  if (n.includes("light") || n.includes("lit")) return "lit";
  if (n.includes("shelter") || n.includes("covered") || n.includes("roof")) return "sheltered";
  if (n.includes("gate") || n.includes("gated") || n.includes("barrier")) return "gated";
  if (n.includes("code") || n.includes("keypad") || n.includes("entry")) return "code";
  if (n.includes("disabled") || (n.includes("access") && n.includes("wheel"))) return "disabled";
  if (n.includes("24") || n.includes("always") || n.includes("round")) return "allday";
  if (n.includes("motorbike") || n.includes("motorcycle") || n.includes("scooter") || n.includes("bike")) return "motorbike";
  if (n.includes("wide")) return "wide";
  return "sheltered";
}

const FEATURE_ICONS = {
  cctv: Cctv,
  ev: BatteryCharging,
  sheltered: Warehouse,
  lit: Lightbulb,
  gated: Fence,
  low: ArrowDownUp,
  permit: IdCard,
  code: KeyRound,
  disabled: Accessibility,
  allday: Clock,
  motorbike: Bike,
  wide: Maximize2,
} as const;

export function FeatureChip({ label }: { label: string }) {
  const iconType = getFeatureIconType(label);
  const Icon = FEATURE_ICONS[iconType];
  return (
    <View style={styles.featureChip} accessibilityLabel={label}>
      <View style={styles.featureChipIconWrap}>
        <Icon size={15} color="#55606B" strokeWidth={1.9} />
      </View>
    </View>
  );
}


export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  price,
  isAvailable = true,
  amenities,
  isFavorite,
  onToggleFavorite,
  onPress,
  bottomOffset = 0,
  horizontalInset = 0,
  dismissing = false,
  onHeightChange,
}: MapBottomCardProps) {
  const translateAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(
    () => translateAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }),
    [translateAnim]
  );

  // Pop the heart when the card gets saved (not on unsave, and not when a card
  // mounts already-favorited).
  const heartScale = useRef(new Animated.Value(1)).current;
  const prevFavorite = useRef(isFavorite);
  useEffect(() => {
    if (isFavorite && !prevFavorite.current) {
      heartScale.stopAnimation();
      heartScale.setValue(0.6);
      Animated.spring(heartScale, {
        toValue: 1,
        ...motion.springPop,
        useNativeDriver: true,
      }).start();
    }
    prevFavorite.current = isFavorite;
  }, [isFavorite, heartScale]);

  useEffect(() => {
    if (dismissing) {
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 1,
          duration: motion.duration.standard,
          easing: motion.easing.in,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: motion.duration.fast,
          easing: motion.easing.in,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateAnim.setValue(1);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateAnim, {
          toValue: 0,
          ...motion.spring,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: motion.duration.fast,
          easing: motion.easing.out,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [translateAnim, opacityAnim, title, dismissing]);

  const hasRating = reviewCount > 0 && rating > 0;
  const features = useMemo(
    () => Array.from(new Set((amenities ?? []).filter(Boolean).map(humanizeAmenity))),
    [amenities]
  );

  // "€12.50 total" → bold amount, quiet suffix. The number is the decision;
  // the word is just context.
  const [priceAmount, priceSuffix] = useMemo(() => {
    const m = price.match(/^(\S+)\s+(.+)$/);
    return m ? [m[1], m[2]] : [price, ""];
  }, [price]);

  return (
    <Animated.View
      onLayout={e => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.card,
        {
          bottom: bottomOffset,
          left: horizontalInset,
          right: horizontalInset,
          transform: [{ translateY }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.row}>
        {/* ── Image ─────────────────────────────────────────── */}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <CarFront size={22} color="#b0bac4" strokeWidth={1.9} />
            </View>
          )}
        </View>

        {/* ── Content ───────────────────────────────────────── */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {onToggleFavorite ? (
              <Pressable onPress={onToggleFavorite} hitSlop={10} style={styles.heartBtn}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Heart
                    size={17}
                    color="#0a8050"
                    fill={isFavorite ? "#0a8050" : "none"}
                    strokeWidth={2.1}
                  />
                </Animated.View>
              </Pressable>
            ) : null}
          </View>

          {hasRating ? (
            <View style={styles.ratingRow}>
              <Star size={11.5} color="#111827" fill="#111827" strokeWidth={1.5} />
              <Text style={styles.rating}>
                {rating.toFixed(1)}
                <Text style={styles.ratingCount}> · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}</Text>
              </Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            {isAvailable ? (
              <Text style={styles.price}>
                {priceAmount}
                {priceSuffix ? <Text style={styles.priceSuffix}> {priceSuffix}</Text> : null}
              </Text>
            ) : (
              <Text style={styles.soldOut}>SOLD OUT</Text>
            )}
            {features.length > 0 ? (
              <View style={styles.featureRow}>
                {features.slice(0, 3).map((feature) => (
                  <FeatureChip key={feature} label={feature} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    elevation: 7,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  row: {
    flexDirection: "row",
    minHeight: 108,
  },
  imageWrap: {
    backgroundColor: "#edf1f4",
    overflow: "hidden",
    width: 112,
  },
  image: {
    flex: 1,
    width: "100%",
  },
  imageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  title: {
    color: "#111827",
    flex: 1,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  heartBtn: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 3,
  },
  rating: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: -0.1,
  },
  ratingCount: {
    color: "#98A2AD",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
  },
  featureBadge: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 6,
  },
  featureChip: {
    alignItems: "center",
    backgroundColor: "#F2F5F7",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    minWidth: 26,
    paddingHorizontal: 4,
  },
  featureChipIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  priceRow: {
    borderTopColor: "#EEF1F3",
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 9,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    justifyContent: "flex-end",
    marginLeft: 8,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  price: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 16.5,
    letterSpacing: -0.4,
    lineHeight: 21,
  },
  priceSuffix: {
    color: "#98A2AD",
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  soldOut: {
    color: "#98A2AD",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
