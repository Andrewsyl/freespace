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
import { Cctv } from "lucide-react-native";
import { colors, textStyles } from "../styles/theme";

const FEATURE_ICON_URL: Record<string, string> = {
  cctv:     "https://img.icons8.com/ios/96/security-camera.png",
  ev:       "https://img.icons8.com/ios/96/lightning-bolt.png",
  sheltered:"https://img.icons8.com/ios/96/garage.png",
  gated:    "https://img.icons8.com/ios/96/road-closure.png",
  motorbike:"https://img.icons8.com/ios/96/scooter.png",
  car:      "https://img.icons8.com/ios/96/car--v1.png",
  suv:      "https://img.icons8.com/ios/96/suv.png",
  van:      "https://img.icons8.com/ios/96/van.png",
};

const MapCardFeatureIcon = ({ type }: { type: string }) => {
  if (type === "cctv") return <Cctv size={12} color="#6b7280" strokeWidth={1.75} />;
  const url = FEATURE_ICON_URL[type] ?? FEATURE_ICON_URL.sheltered;
  return <Image source={{ uri: url }} style={{ width: 12, height: 12 }} resizeMode="contain" />;
};

type MapBottomCardProps = {
  title: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  price: string;
  subtitle?: string;
  metaLine?: string;
  badgeLabel?: string | null;
  amenities?: string[] | null;
  vehicleSizeLabel?: string | null;
  isAvailable?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
  dismissing?: boolean;
  onHeightChange?: (height: number) => void;
};

export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  price,
  metaLine,
  amenities,
  vehicleSizeLabel,
  isAvailable = true,
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
    () =>
      translateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 120],
      }),
    [translateAnim]
  );
  useEffect(() => {
    if (dismissing) {
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateAnim.setValue(1);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [translateAnim, opacityAnim, title, dismissing]);

  const featureItems = useMemo(() => {
    const items: { key: string; iconType: string; label: string }[] = [];
    const seen = new Set<string>();
    const values = amenities ?? [];
    for (const amenity of values) {
      const raw = amenity.toLowerCase();
      if ((raw.includes("cctv") || raw.includes("camera")) && !seen.has("cctv")) {
        items.push({ key: "cctv", iconType: "cctv", label: "CCTV" });
        seen.add("cctv");
      } else if ((raw.includes("gated") || raw.includes("barrier") || raw.includes("gate")) && !seen.has("gated")) {
        items.push({ key: "gated", iconType: "gated", label: "Gated" });
        seen.add("gated");
      } else if ((raw.includes("covered") || raw.includes("shelter")) && !seen.has("covered")) {
        items.push({ key: "covered", iconType: "sheltered", label: "Covered" });
        seen.add("covered");
      } else if ((raw.includes("ev") || raw.includes("charger") || raw.includes("charging")) && !seen.has("ev")) {
        items.push({ key: "ev", iconType: "ev", label: "EV" });
        seen.add("ev");
      }
    }
    if (vehicleSizeLabel?.trim()) {
      const lower = vehicleSizeLabel.trim().toLowerCase();
      const { label, iconType } =
        lower === "motorcycle"
          ? { label: "Fits motorcycle", iconType: "motorbike" }
          : lower === "car"
            ? { label: "Fits car", iconType: "car" }
            : lower === "van"
              ? { label: "Fits van", iconType: "van" }
              : lower.includes("suv")
                ? { label: "Fits SUV", iconType: "suv" }
                : { label: `Fits ${vehicleSizeLabel.trim()}`, iconType: "car" };
      items.push({ key: "vehicle", iconType, label });
    }
    return items;
  }, [amenities, vehicleSizeLabel]);

  const visibleFeatureItems = featureItems.slice(0, 3);
  const hiddenFeatureCount = Math.max(0, featureItems.length - visibleFeatureItems.length);

  return (
    <Animated.View
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
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
      <Pressable onPress={onPress} style={styles.cardPress}>
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}

          {reviewCount > 0 ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {rating.toFixed(1)}</Text>
            </View>
          ) : null}

        </View>

        <View style={styles.contentSection}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {onToggleFavorite ? (
              <Pressable
                style={styles.inlineFavoriteButton}
                onPress={onToggleFavorite}
                hitSlop={8}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={19}
                  color={isFavorite ? "#0fa968" : "#0fa968"}
                />
              </Pressable>
            ) : null}
          </View>
          {metaLine ? (
            <Text style={styles.metaLine} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
          {visibleFeatureItems.length ? (
            <View style={styles.featuresRow}>
              {visibleFeatureItems.map((item) => (
                <View key={item.key} style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <MapCardFeatureIcon type={item.iconType} />
                  </View>
                  <Text style={styles.featureText} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              ))}
              {hiddenFeatureCount > 0 ? (
                <View style={styles.moreFeaturesBadge}>
                  <Text style={styles.moreFeaturesText}>+ {hiddenFeatureCount}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.dashedDivider} />

          <View style={styles.priceRow}>
            {isAvailable ? (
              <Text style={styles.currentPrice} numberOfLines={1}>{price}</Text>
            ) : (
              <Text style={styles.soldOutText}>SOLD OUT</Text>
            )}
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
    position: "absolute",
    borderWidth: 1,
    borderColor: "#dde3e7",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    overflow: "hidden",
    padding: 6,
  },
  cardPress: {
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    height: 106,
    position: "relative",
    backgroundColor: colors.cardBgMuted,
    borderRadius: 11,
    borderWidth: 0.35,
    borderColor: "#d7dde2",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.cardBgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  
  imagePlaceholderText: {
    ...textStyles.meta,
  },
  ratingBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    minWidth: 54,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e6eaee",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingText: {
    color: "#111827",
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.2,
  },
  contentSection: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.cardBg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    lineHeight: 20,
    color: "#111827",
    letterSpacing: -0.3,
    flex: 1,
  },
  inlineFavoriteButton: {
    width: 26,
    height: 26,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e7eb",
  },
  metaLine: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#6b7280",
    marginBottom: 6,
  },
  dashedDivider: {
    height: 1,
    backgroundColor: "#e4e9ed",
    marginVertical: 5,
  },
  featuresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "48%",
  },
  featureIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#415162",
  },
  moreFeaturesBadge: {
    minWidth: 28,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: "#f3f5f7",
    borderWidth: 1,
    borderColor: "#e1e6ea",
    alignItems: "center",
    justifyContent: "center",
  },
  moreFeaturesText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 10,
    lineHeight: 12,
    color: "#5b6774",
    letterSpacing: -0.1,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  priceLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: "#9ca3af",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  currentPrice: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    lineHeight: 20,
    color: "#111827",
    letterSpacing: -0.4,
  },
  soldOutText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
