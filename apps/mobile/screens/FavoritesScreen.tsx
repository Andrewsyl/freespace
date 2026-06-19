import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { colors, radius, spacing } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { ArrowLeft, Heart, MapPin, ShieldCheck } from "lucide-react-native";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites, loading, error, refresh } = useFavorites();
  const skeletonPulse = usePulse();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.contentWrapper}>
          <View style={styles.gatedCard}>
            <View style={styles.gatedIconWrap}>
              <Heart size={24} color="#0a8050" strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>Favourites</Text>
            <Text style={styles.subtitle}>Save spaces you trust and come back to them in one tap.</Text>
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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
        <ScrollView contentContainerStyle={styles.content}>
          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void refresh()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <SkeletonBlock width={44} height={44} borderRadius={10} pulse={skeletonPulse} />
                  <View style={styles.skeletonCopy}>
                    <SkeletonBlock width="62%" height={14} pulse={skeletonPulse} />
                    <SkeletonBlock width="45%" height={11} pulse={skeletonPulse} style={{ marginTop: 7 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {!loading && favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.subtitle}>No favourites yet.</Text>
              <Text style={styles.helper}>Tap the heart on a listing to save it.</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
              >
                <Text style={styles.primaryButtonText}>Browse spaces</Text>
              </Pressable>
            </View>
          ) : (
            favorites.map((item) => (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() =>
                  navigation.navigate("Listing", {
                    id: item.id,
                    from: new Date().toISOString(),
                    to: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                  })
                }
              >
                {item.image_urls?.[0] ? (
                  <Image source={{ uri: item.image_urls[0] }} style={styles.icon} />
                ) : (
                  <View style={styles.iconPlaceholder}>
                    <MapPin size={16} color={colors.textSoft} strokeWidth={1.8} />
                  </View>
                )}
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSubtitle}>{item.address}</Text>
                </View>
              </Pressable>
            ))
          )}
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },
  title: {
    color: colors.text,
    fontSize: 17,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  content: {
    padding: spacing.screenX,
    gap: 14,
  },
  row: {
    backgroundColor: "#ffffff",
    borderColor: "#E3E8EE",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  icon: {
    borderRadius: 12,
    height: 56,
    width: 56,
    backgroundColor: colors.cardBg,
  },
  iconPlaceholder: {
    borderRadius: 12,
    height: 56,
    width: 56,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  helper: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  errorRow: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
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
  muted: {
    color: colors.textSoft,
    fontSize: 12,
    textAlign: "center",
  },
  skeletonList: { gap: 2 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  skeletonCopy: { flex: 1 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: colors.text,
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
});
