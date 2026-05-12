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
import { cardShadow, colors, radius, textStyles } from "../styles/theme";

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
  metaLine,
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
                  color={isFavorite ? "#0E8E62" : "#0b7b73"}
                />
              </Pressable>
            ) : null}
          </View>
          {metaLine ? (
            <Text style={styles.metaLine} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}

          <View style={styles.dashedDivider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Price</Text>
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
    borderRadius: 22,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#e3e7ea",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 7,
    overflow: "hidden",
    paddingTop: 4,
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 4,
  },
  cardPress: {
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    height: 102,
    position: "relative",
    backgroundColor: colors.cardBgMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d6dde2",
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
    right: 10,
    top: 10,
    minWidth: 56,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    paddingVertical: 5,
    paddingHorizontal: 10,
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
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.2,
  },
  contentSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: colors.cardBg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 0,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    lineHeight: 21,
    color: "#111827",
    letterSpacing: -0.3,
    flex: 1,
  },
  inlineFavoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6ebee",
  },
  metaLine: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "#4b5563",
    marginBottom: 3,
  },
  dashedDivider: {
    height: 1,
    backgroundColor: "#e8edf0",
    marginBottom: 4,
    marginTop: 1,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 11.5,
    lineHeight: 15,
    color: "#7a8288",
  },
  currentPrice: {
    fontFamily: "PlusJakartaSans-Bold",
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
