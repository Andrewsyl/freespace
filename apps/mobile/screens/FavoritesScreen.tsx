import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { colors, spacing } from "../styles/theme";
import { applyServiceFee } from "../utils/pricing";
import type { ListingSummary, RootStackParamList } from "../types";
import {
  Accessibility,
  ArrowDownUp,
  BatteryCharging,
  Bike,
  CarFront,
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
  type LucideIcon,
} from "lucide-react-native";
import { SignInWall } from "../components/SignInWall";
import { fallbackRoutes, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

// Mirror of the amenity icon mapping in ListingScreen so favourite cards read
// the same visual language (icons, not words).
const FEATURE_ICONS: Record<string, LucideIcon> = {
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
};

const getFeatureIconType = (label: string) => {
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
};

function formatMoney(value: number | string | null | undefined, feeInclusive = false): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const gross = feeInclusive ? applyServiceFee(n) : n;
  return Number.isInteger(gross) ? `${gross}` : gross.toFixed(2);
}

function priceLabel(item: ListingSummary): { value: string; unit: string } | null {
  // Hourly/daily rates are quoted fee-inclusive so they match what checkout
  // charges. Monthly is enquiry-only — no checkout, so the listed rate stands.
  const hour = formatMoney(item.price_per_hour, true);
  const day = formatMoney(item.price_per_day, true);
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

  const distanceKm = typeof item.distance_m === "number" ? (item.distance_m / 1000).toFixed(1) : null;

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <CarFront size={34} color={colors.border} strokeWidth={1.7} />
          </View>
        )}
        {hasRating ? (
          <View style={styles.ratingPill}>
            <Star size={13} color={colors.primary} fill={colors.primary} strokeWidth={2} />
            <Text style={styles.ratingPillText}>{ratingValue.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Pressable onPress={onUnsave} hitSlop={12} accessibilityLabel="Remove from favourites">
            <Heart size={22} color={colors.primary} fill={colors.primary} strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
        {distanceKm ? <Text style={styles.meta}>{distanceKm} km away</Text> : null}

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          {amenities.length > 0 ? (
            <View style={styles.featureRow}>
              {amenities.map((amenity) => {
                const Icon = FEATURE_ICONS[getFeatureIconType(amenity)] ?? FEATURE_ICONS.sheltered;
                return (
                  <View key={amenity} style={styles.featureIcon}>
                    <Icon size={17} color={colors.textMuted} strokeWidth={1.9} />
                  </View>
                );
              })}
            </View>
          ) : null}
          {price ? (
            <Text style={styles.price}>
              {price.value}
              <Text style={styles.priceUnit}> {price.unit}</Text>
            </Text>
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
          <SignInWall
            icon={<Heart size={26} color={colors.primary} strokeWidth={2.2} />}
            title="Save your favourite spaces"
            body="Sign in to keep the spaces you trust one tap away."
            onSignIn={() => navigation.navigate("Welcome")}
            onBrowse={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
            reassurance="Your saved spaces stay attached to your account."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Favourites</Text>
      </View>
      <View style={styles.contentWrapper}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && favorites.length > 0}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
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
                  <SkeletonBlock height={150} borderRadius={12} pulse={skeletonPulse} style={{ margin: 8, marginBottom: 0 }} />
                  <View style={styles.skeletonBody}>
                    <SkeletonBlock width="72%" height={16} pulse={skeletonPulse} />
                    <SkeletonBlock width="46%" height={12} pulse={skeletonPulse} style={{ marginTop: 8 }} />
                    <SkeletonBlock width="34%" height={16} pulse={skeletonPulse} style={{ marginTop: 8 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {!loading && favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Heart size={30} color={colors.primary} strokeWidth={2} />
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
    backgroundColor: colors.cardBg,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  navTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 28, lineHeight: 34, color: colors.primary, letterSpacing: -0.6 },

  content: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 28,
  },
  countLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: -0.1,
    marginTop: 6,
    marginBottom: 12,
  },
  list: { gap: 14 },

  // Favourite card edge matches the map search bar: colors.border keeps the
  // card defined against light backgrounds, where on iOS the shadow alone
  // reads too softly to register as a card edge.
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  // Image sits inset within the card (not edge-to-edge) so the white card
  // frame reads clearly all the way around, per the reference card style.
  imageWrap: {
    height: 120,
    borderRadius: 14,
    margin: 8,
    marginBottom: 0,
    overflow: "hidden",
    backgroundColor: colors.cardBgMuted,
  },
  image: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  ratingPill: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.cardBg, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: "#0B1220", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14, shadowRadius: 5, elevation: 3,
  },
  ratingPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: colors.text, letterSpacing: -0.1 },
  body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 16, fontFamily: "PlusJakartaSans-Bold", color: colors.text, letterSpacing: -0.3 },
  addr: { fontSize: 12.5, fontFamily: "PlusJakartaSans-Regular", color: colors.textMuted },
  meta: { fontSize: 12.5, fontFamily: "PlusJakartaSans-Regular", color: colors.textMuted },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { alignItems: "center", justifyContent: "center" },
  divider: {
    borderTopWidth: 1, borderTopColor: colors.divider,
    marginTop: 8, marginBottom: 6,
  },
  priceRow: { flexDirection: "row", alignItems: "center" },
  price: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: colors.primary, letterSpacing: -0.3, marginLeft: "auto" },
  priceUnit: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textMuted },

  // Skeleton
  skeletonCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 19,
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  // Gated (signed-out)
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },

  // Error
  errorRow: {
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  error: {
    backgroundColor: colors.status.canceled.background,
    borderColor: colors.status.canceled.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.status.canceled.text,
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
    borderColor: colors.primary,
  },
  retryText: {
    color: colors.primary,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
});
