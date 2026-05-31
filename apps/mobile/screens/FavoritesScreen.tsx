import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { colors, radius, spacing } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { ArrowLeft } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites, loading, error } = useFavorites();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.contentWrapper}>
          <View style={styles.emptyState}>
            <Text style={styles.title}>Favourites</Text>
            <Text style={styles.subtitle}>Sign in to view your saved spaces.</Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
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
          {loading ? <Text style={styles.muted}>Loading favourites…</Text> : null}
          {favorites.length === 0 ? (
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
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6E4",
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
});
