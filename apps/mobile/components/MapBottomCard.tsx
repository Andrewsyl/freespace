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
        {/* Image with rating badge overlay */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
          
          {/* Rating badge in top right corner of image */}
          {reviewCount > 0 ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {rating.toFixed(1)}</Text>
            </View>
          ) : null}
          
          {/* Favorite button */}
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
        
        {/* Content section */}
        <View style={styles.contentSection}>
          {/* Title and details */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          
          {/* Distance and time */}
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
          
          {/* Dashed divider */}
          <View style={styles.dashedDivider} />
          
          {/* Price section */}
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
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "absolute",
    shadowColor: "#1D1515",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  
  cardPress: {
    width: "100%",
  },
  
  // Image section
  imageContainer: {
    width: "100%",
    height: 84,
    position: "relative",
    backgroundColor: "#F2EEE7",
  },
  
  image: {
    width: "100%",
    height: "100%",
  },
  
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  
  imagePlaceholderText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  
  // Rating badge in top right corner of image
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 50,
    backgroundColor: "rgba(252, 252, 251, 0.96)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D2C2A9",
  },
  
  ratingText: {
    color: "#1D1515",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  
  // Favorite button
  favoriteButton: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(252, 252, 251, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D2C2A9",
    shadowColor: "#1D1515",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  
  favoriteIcon: {
    fontSize: 14,
    color: "#D1D5DB",
    fontWeight: "600",
  },
  
  favoriteIconActive: {
    color: "#2ECC8F",
  },
  
  // Content section
  contentSection: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 9,
    backgroundColor: "#FFFFFF",
  },
  
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
    letterSpacing: -0.3,
    lineHeight: 17,
  },
  
  detailsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 5,
    gap: 8,
  },
  
  detailText: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "500",
    flex: 1,
  },

  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },

  featureIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    backgroundColor: "#FCFCFB",
    borderColor: "#D2C2A9",
    borderWidth: 1,
    borderRadius: 9,
  },

  starText: {
    fontSize: 14,
    color: "#F2B01E",
    fontWeight: "800",
  },
  
  // Dashed divider (receipt style)
  dashedDivider: {
    height: 1,
    backgroundColor: "#E8DDCD",
    marginBottom: 8,
  },
  
  // Price section
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  
  priceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  originalPrice: {
    fontSize: 13,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  
  currentPrice: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1D1515",
    letterSpacing: -0.5,
  },
  
  soldOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
