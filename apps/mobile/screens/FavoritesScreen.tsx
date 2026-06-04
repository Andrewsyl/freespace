import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SkeletonBlock, usePulse } from "../components/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { colors, radius, spacing } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { ArrowLeft, Heart, ShieldCheck } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites, loading, error } = useFavorites();
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
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Favourites</Text>
        <View style={styles.navSpacer} />
      </View>
      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
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
                <View style={styles.icon} />
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
    backgroundColor: colors.appBg,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111827" },
  navSpacer: { width: 34 },
  title: {
    color: colors.text,
    fontSize: 17,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  content: {
    padding: spacing.screenX,
    gap: 12,
  },
  row: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  icon: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginTop: spacing.screenX,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  gatedIconWrap: {
    alignItems: "center",
    backgroundColor: "#edf7f2",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 14,
    width: 48,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  helper: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
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
