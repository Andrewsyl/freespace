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
import { colors, textStyles } from "../styles/theme";

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
                  color={isFavorite ? "#ff6363" : "#ff6363"}
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
    paddingTop: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingBottom: 4,
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
    paddingBottom: 2,
    backgroundColor: colors.cardBg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 1,
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
    fontSize: 12,
    lineHeight: 16,
    color: "#4b5563",
    marginBottom: 4,
  },
  dashedDivider: {
    height: 1,
    backgroundColor: "#e4e9ed",
    marginBottom: 5,
    marginTop: 0,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontFamily: "PlusJakartaSans-Regular",
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
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
