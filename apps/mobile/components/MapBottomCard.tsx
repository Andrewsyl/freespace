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
import { colors } from "../styles/theme";

type MapBottomCardProps = {
  title: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  price: string;
  subtitle?: string;
  metaLine?: string;
  badgeLabel?: string | null;
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
                  color="#0fa968"
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
  priceRow: {
    borderTopColor: "#eaeff3",
    borderTopWidth: 1,
    paddingTop: 8,
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
