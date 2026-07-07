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
  ArrowLeft,
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
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

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

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <CarFront size={34} color="#b0bac4" strokeWidth={1.7} />
          </View>
        )}
        {hasRating ? (
          <View style={styles.ratingPill}>
            <Star size={13} color="#0a8050" fill="#0a8050" strokeWidth={2} />
            <Text style={styles.ratingPillText}>{ratingValue.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Pressable onPress={onUnsave} hitSlop={12} accessibilityLabel="Remove from favourites">
            <Heart size={24} color="#0a8050" fill="#0a8050" strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>

        {amenities.length > 0 ? (
          <View style={styles.featureRow}>
            {amenities.map((amenity) => {
              const Icon = FEATURE_ICONS[getFeatureIconType(amenity)] ?? FEATURE_ICONS.sheltered;
              return (
                <View key={amenity} style={styles.featureIcon}>
                  <Icon size={17} color="#64748b" strokeWidth={1.9} />
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.dashed} />

        <View style={styles.priceRow}>
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
            icon={<Heart size={26} color="#0a8050" strokeWidth={2.2} />}
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
                  <SkeletonBlock width="100%" height={178} borderRadius={0} pulse={skeletonPulse} />
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
    backgroundColor: "#FFFFFF",
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  list: { gap: 20 },

  // TGTG-style favourite card — white card floating on white with a soft shadow
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 22,
    elevation: 5,
  },
  imageWrap: {
    width: "100%",
    height: 178,
    backgroundColor: "#edf1f4",
  },
  image: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  ratingPill: {
    position: "absolute", top: 12, right: 12,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFFFF", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: "#0B1220", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14, shadowRadius: 5, elevation: 3,
  },
  ratingPillText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#1f2937", letterSpacing: -0.1 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontFamily: "PlusJakartaSans-Bold", fontSize: 19, color: "#111820", letterSpacing: -0.4 },
  addr: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: "#64748b", lineHeight: 19, marginTop: 3 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  featureIcon: { alignItems: "center", justifyContent: "center" },
  dashed: {
    borderTopWidth: 1, borderStyle: "dashed", borderTopColor: "#DCE2E8",
    marginTop: 14, marginBottom: 12,
  },
  priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" },
  price: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 19, color: "#111820", letterSpacing: -0.5 },
  priceUnit: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: "#94a3b8" },

  // Skeleton
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 22,
    elevation: 5,
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
