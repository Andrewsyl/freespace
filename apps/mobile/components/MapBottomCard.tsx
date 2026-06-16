import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Cctv, CircleCheck, ShieldCheck, Warehouse, Zap } from "lucide-react-native";
import { colors } from "../styles/theme";

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

type FeatureKey = "instant" | "cctv" | "ev" | "gated" | "covered";

function deriveFeatureKeys(amenities?: string[] | null, title?: string): FeatureKey[] {
  const features = [...(amenities ?? [])].map((value) => value.toLowerCase());
  const titleText = title?.toLowerCase() ?? "";
  const has = (needle: string) => features.some((feature) => feature.includes(needle));

  const out: FeatureKey[] = [];
  if (has("instant")) out.push("instant");
  if (has("cctv") || has("camera")) out.push("cctv");
  if (has("ev") || has("charg")) out.push("ev");
  if (has("gat") || has("barrier")) out.push("gated");
  if (
    has("cover") ||
    has("shelter") ||
    has("roof") ||
    titleText.includes("garage") ||
    titleText.includes("underground") ||
    titleText.includes("indoor") ||
    titleText.includes("covered")
  ) {
    out.push("covered");
  }

  return out;
}

function FeatureBadge({ feature }: { feature: FeatureKey }) {
  const iconProps = { size: 13, strokeWidth: 1.8 } as const;
  if (feature === "instant") {
    return (
      <View style={[styles.featureBadge, styles.instantBadge]}>
        <CircleCheck {...iconProps} color="#0f7a4d" />
        <Text style={styles.instantBadgeText}>Instant</Text>
      </View>
    );
  }

  const Icon =
    feature === "cctv"
      ? Cctv
      : feature === "ev"
        ? Zap
        : feature === "gated"
          ? ShieldCheck
          : Warehouse;

  return (
    <View style={styles.featureBadge}>
      <Icon {...iconProps} color="#4b5563" />
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

  useEffect(() => {
    if (dismissing) {
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateAnim.setValue(1);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [translateAnim, opacityAnim, title, dismissing]);

  const hasRating = reviewCount > 0 && rating > 0;
  const features = useMemo(() => deriveFeatureKeys(amenities, title), [amenities, title]);

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
              <Ionicons name="car-outline" size={22} color="#b0bac4" />
            </View>
          )}
        </View>

        {/* ── Content ───────────────────────────────────────── */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {onToggleFavorite ? (
              <Pressable onPress={onToggleFavorite} hitSlop={10} style={styles.heartBtn}>
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={17}
                  color="#0a8050"
                />
              </Pressable>
            ) : null}
          </View>

          {hasRating ? (
            <Text style={styles.rating}>
              ★ {rating.toFixed(1)}
              <Text style={styles.ratingCount}> · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}</Text>
            </Text>
          ) : null}

          <View style={styles.priceRow}>
            {isAvailable ? (
              <Text style={styles.price}>{price}</Text>
            ) : (
              <Text style={styles.soldOut}>SOLD OUT</Text>
            )}
            {features.length > 0 ? (
              <View style={styles.featureRow}>
                {features.slice(0, 3).map((feature) => (
                  <FeatureBadge key={feature} feature={feature} />
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
    borderColor: "#dde3e7",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 8,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  row: {
    flexDirection: "row",
    minHeight: 108,
  },
  imageWrap: {
    backgroundColor: "#edf1f4",
    borderRightColor: "#e4e9ed",
    borderRightWidth: 1,
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
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  rating: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 3,
  },
  ratingCount: {
    color: "#8896a5",
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
  instantBadge: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 7,
  },
  instantBadgeText: {
    color: "#0f7a4d",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: -0.1,
  },
  priceRow: {
    borderTopColor: "#eaeff3",
    borderTopWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 8,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    marginLeft: 8,
    flex: 1,
  },
  price: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.5,
    lineHeight: 20,
  },
  soldOut: {
    color: "#94a3b8",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
