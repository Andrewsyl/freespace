import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { colors, spacing } from "../styles/theme";
import type { ListingSummary, RootStackParamList } from "../types";
import { ArrowLeft, CarFront, Heart, MapPin, ShieldCheck, Star } from "lucide-react-native";
import { FeatureChip } from "../components/MapBottomCard";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

function formatMoney(value: number | string | null | undefined): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? `${n}` : n.toFixed(2);
}

function priceLabel(item: ListingSummary): { value: string; unit: string } | null {
  const hour = formatMoney(item.price_per_hour);
  const day = formatMoney(item.price_per_day);
  const month = formatMoney(item.price_per_month);
  if (item.rate_type === "hourly" && hour != null) return { value: `€${hour}`, unit: "/hr" };
  if (day != null) return { value: `€${day}`, unit: "/day" };
  if (hour != null) return { value: `€${hour}`, unit: "/hr" };
  if (month != null) return { value: `€${month}`, unit: "/mo" };
  return null;
}

function FavoriteCard({
  item,
  onOpen,
  onUnsave,
}: {
  item: ListingSummary;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const ratingValue = Number(item.rating);
  const ratingCount = Number(item.rating_count);
  const hasRating =
    Number.isFinite(ratingValue) && ratingValue > 0 && Number.isFinite(ratingCount) && ratingCount > 0;
  const price = priceLabel(item);
  const amenities = Array.from(
    new Set((item.amenities ?? []).filter(Boolean))
  ).slice(0, 3);
  const image = item.image_urls?.[0];

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardImageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImageFallback}>
            <CarFront size={30} color="#b0bac4" strokeWidth={1.7} />
          </View>
        )}
        <Pressable
          onPress={onUnsave}
          hitSlop={10}
          style={styles.heartBtn}
          accessibilityLabel="Remove from favourites"
        >
          <Heart size={18} color="#0a8050" fill="#0a8050" strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        {hasRating ? (
          <View style={styles.cardRatingRow}>
            <Star size={13} color="#F4B942" fill="#F4B942" strokeWidth={2} />
            <Text style={styles.cardRating}>{ratingValue.toFixed(1)}</Text>
            <Text style={styles.cardRatingCount}>
              · {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardAddrRow}>
          <MapPin size={13} color="#94a3b8" strokeWidth={2} />
          <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
        </View>

        <View style={styles.cardFooter}>
          {price ? (
            <Text style={styles.cardPrice}>
              {price.value}
              <Text style={styles.cardPriceUnit}>{price.unit}</Text>
            </Text>
          ) : (
            <View />
          )}
          {amenities.length > 0 ? (
            <View style={styles.chipRow}>
              {amenities.map((a) => (
                <FeatureChip key={a} label={a} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites, loading, error, refresh, remove } = useFavorites();
  const skeletonPulse = usePulse();
  const insets = useSafeAreaInsets();
  // The tab bar floats absolutely over the screen (height 58 + safe-area inset),
  // so the scroll content must reserve that much plus breathing room or the last
  // card sits under the nav.
  const listBottomPad = 58 + Math.max(8, insets.bottom) + 24;

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.contentWrapper}>
          <View style={styles.gatedCard}>
            <View style={styles.gatedIconWrap}>
              <Heart size={24} color="#0a8050" strokeWidth={2.2} />
            </View>
            <Text style={styles.gatedTitle}>Save your favourite spaces</Text>
            <Text style={styles.subtitle}>Sign in to keep the spaces you trust one tap away.</Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.secondaryButton]}
              onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
            >
              <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>Browse spaces</Text>
            </Pressable>
            <View style={styles.gatedHintRow}>
              <ShieldCheck size={14} color={colors.textSoft} strokeWidth={2.1} />
              <Text style={styles.gatedHintText}>Your saved spaces stay attached to your account.</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackOrFallback(navigation, fallbackRoutes.saved)}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Favourites</Text>
        <View style={styles.navSpacer} />
      </View>
      <View style={styles.contentWrapper}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && favorites.length > 0}
              onRefresh={() => void refresh()}
              tintColor="#0a8050"
              colors={["#0a8050"]}
            />
          }
        >
          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void refresh()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {loading && favorites.length === 0 ? (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <SkeletonBlock width="100%" height={160} borderRadius={0} pulse={skeletonPulse} />
                  <View style={styles.skeletonBody}>
                    <SkeletonBlock width="72%" height={16} pulse={skeletonPulse} />
                    <SkeletonBlock width="46%" height={12} pulse={skeletonPulse} style={{ marginTop: 10 }} />
                    <SkeletonBlock width="34%" height={16} pulse={skeletonPulse} style={{ marginTop: 12 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {!loading && favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Heart size={30} color="#0a8050" strokeWidth={2} />
              </View>
              <Text style={styles.emptyTitle}>No saved spaces yet</Text>
              <Text style={styles.subtitle}>
                Tap the heart on any space to save it here for quick access.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
              >
                <Text style={styles.primaryButtonText}>Browse spaces</Text>
              </Pressable>
            </View>
          ) : null}

          {favorites.length > 0 ? (
            <>
              <Text style={styles.countLabel}>
                {favorites.length} saved {favorites.length === 1 ? "space" : "spaces"}
              </Text>
              <View style={styles.list}>
                {favorites.map((item) => (
                  <FavoriteCard
                    key={item.id}
                    item={item}
                    onOpen={() =>
                      navigation.navigate("Listing", {
                        id: item.id,
                        from: new Date().toISOString(),
                        to: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                      })
                    }
                    onUnsave={() => void remove(item.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },

  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 28,
  },
  countLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#64748b",
    letterSpacing: -0.1,
    marginTop: 6,
    marginBottom: 12,
  },
  list: { gap: 14 },

  // Premium listing card
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#E4E9EF",
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  cardImageWrap: {
    width: "100%",
    height: 160,
    backgroundColor: "#edf1f4",
  },
  cardImage: { width: "100%", height: "100%" },
  cardImageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardBody: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 5,
  },
  cardTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#0f172a",
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  cardRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRating: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12.5, color: "#0f172a" },
  cardRatingCount: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12.5, color: "#8896a5" },
  cardAddrRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardAddr: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#eef1f4",
  },
  cardPrice: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#0f172a", letterSpacing: -0.4 },
  cardPriceUnit: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12.5, color: "#94a3b8" },
  chipRow: { flexDirection: "row", gap: 5, flexShrink: 1, justifyContent: "flex-end", overflow: "hidden" },

  // Skeleton
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderColor: "#E4E9EF",
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  skeletonBody: { paddingHorizontal: 15, paddingVertical: 14 },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 19,
    color: "#0f172a",
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  // Gated (signed-out)
  gatedCard: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginTop: spacing.screenX,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  gatedIconWrap: {
    alignItems: "center",
    backgroundColor: "#edf7f2",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    marginBottom: 14,
    width: 60,
  },
  gatedTitle: {
    color: "#0f172a",
    fontSize: 19,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: "center",
  },
  gatedHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },
  gatedHintText: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },

  // Buttons
  primaryButton: {
    backgroundColor: "#0a8050",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: colors.text,
  },

  // Error
  errorRow: {
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 14,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    width: "100%",
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0a8050",
  },
  retryText: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
});
