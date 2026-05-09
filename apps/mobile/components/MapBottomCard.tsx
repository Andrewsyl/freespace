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
import { Cctv, EvCharger, Fence, Home, KeyRound } from "lucide-react-native";
import { cardShadow, colors, radius, textStyles } from "../styles/theme";

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
  onReserve: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
  dismissing?: boolean;
};

export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  price,
  amenities,
  isAvailable = true,
  isFavorite,
  onToggleFavorite,
  onReserve,
  onPress,
  bottomOffset = 0,
  horizontalInset = 0,
  dismissing = false,
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
  const features = useMemo(() => {
    const source = amenities ?? [];
    const normalizeAmenity = (value: string) => {
      const normalized = value.toLowerCase();
      if (normalized.includes("cctv") || normalized.includes("camera")) return "CCTV";
      if (normalized.includes("ev") || normalized.includes("charg")) return "EV charging";
      if (normalized.includes("gate") || normalized.includes("barrier")) return "Gated";
      if (normalized.includes("cover") || normalized.includes("shelter") || normalized.includes("roof")) return "Covered";
      if (normalized.includes("code") || normalized.includes("keypad")) return "Code access";
      return value.trim();
    };
    const unique = Array.from(new Set(source.map(normalizeAmenity).filter(Boolean)));
    return unique.slice(0, 3);
  }, [amenities]);

  useEffect(() => {
    if (dismissing) {
      // Animate out
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
      // Animate in
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

  return (
    <Animated.View
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

          {onToggleFavorite ? (
            <Pressable
              style={styles.favoriteButton}
              onPress={onToggleFavorite}
              hitSlop={8}
            >
              <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}>
                {isFavorite ? "♥︎" : "♡"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.detailsRow}>
            {reviewCount > 0 ? (
              <Text style={styles.detailText}>
                <Text style={styles.starText}>★</Text> {rating.toFixed(1)} • {reviewCount} reviews
              </Text>
            ) : (
              <Text style={styles.detailText}>
                <Text style={styles.starText}>★</Text> {rating.toFixed(1)} • New listing
              </Text>
            )}
            {features.length ? (
              <View style={styles.featuresRow}>
                {features.map((feature) => (
                  <View key={feature} style={styles.featureIconWrap}>
                    {feature === "CCTV" ? <Cctv size={14} color="#111111" strokeWidth={2} /> : null}
                    {feature === "EV charging" ? (
                      <EvCharger size={14} color="#111111" strokeWidth={2} />
                    ) : null}
                    {feature === "Gated" ? <Fence size={14} color="#111111" strokeWidth={2} /> : null}
                    {feature === "Code access" ? (
                      <KeyRound size={14} color="#111111" strokeWidth={2} />
                    ) : null}
                    {feature === "Covered" ? <Home size={14} color="#111111" strokeWidth={2} /> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.dashedDivider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Reserve now</Text>
            {isAvailable ? (
              <Text style={styles.currentPrice}>{price}</Text>
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
    borderRadius: 20,
    position: "absolute",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
    overflow: "hidden",
  },
  cardPress: {
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    height: 80,
    position: "relative",
    backgroundColor: colors.cardBgMuted,
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
    left: 10,
    bottom: 10,
    minWidth: 50,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  ratingText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  favoriteIcon: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  favoriteIconActive: {
    color: "#0E8E62",
  },
  contentSection: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.cardBg,
  },
  title: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    lineHeight: 18,
    color: "#111827",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#6B7280",
    flex: 1,
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  featureIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 9,
  },
  starText: {
    fontSize: 13,
    color: "#F7BE38",
    fontWeight: "800",
  },
  dashedDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    lineHeight: 14,
    color: "#6B7280",
  },
  currentPrice: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
    lineHeight: 22,
    color: "#111827",
    letterSpacing: -0.4,
  },
  soldOutText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
