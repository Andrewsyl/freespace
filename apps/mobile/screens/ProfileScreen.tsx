import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ArrowRight, ChevronRight } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { requestEmailVerification, getHostListings } from "../api";
import { useAuth } from "../auth";
import { useGlobalToast } from "../components/GlobalToast";
import type { RootStackParamList } from "../types";
import { colors } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

// Sourced from styles/theme.ts (see docs/PARKING_DESIGN_BIBLE.md §0).
const GREEN = colors.primary;

type RowProps = {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
};

function Row({ icon, label, value, onPress, danger }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !!onPress && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.ico}>
        <Ionicons name={icon as any} size={21} color={danger ? colors.danger : colors.text} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();
  const { showError, showSuccess } = useGlobalToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasListings, setHasListings] = useState<boolean | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const syncNotifications = async () => {
    const s = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(s.granted);
  };

  useEffect(() => { void syncNotifications(); }, []);

  useEffect(() => {
    if (!token) return;
    getHostListings(token)
      .then((res) => setHasListings((res?.listings?.length ?? 0) > 0))
      .catch(() => setHasListings(false));
  }, [token]);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      Alert.alert("Turn off notifications", "Notifications are managed in your device settings.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open settings", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert("Enable notifications", "Open system settings to enable them.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open settings", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    await syncNotifications();
  };

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true);
    try {
      await requestEmailVerification(user.email);
      showSuccess("Verification email sent. Check your inbox.");
      setResendCooldown(30);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSending(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "U";

  // ── Logged out ────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom + 96, 120) }]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={({ pressed }) => [styles.masthead, pressed && styles.mastheadPressed]}
            onPress={() => navigation.navigate("Welcome")}
          >
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={30} color={GREEN} />
            </View>
            <Text style={styles.name}>Sign in to FreeSpace</Text>
            <Text style={styles.mastheadSub} numberOfLines={2}>
              Access your bookings, vehicle and payments
            </Text>
            <View style={styles.signInChip}>
              <Text style={styles.signInChipText}>Sign in or create account</Text>
              <ArrowRight size={15} color={GREEN} strokeWidth={2.2} />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.host, pressed && styles.hostPressed]}
            onPress={() => navigation.navigate("Welcome")}
          >
            <View style={styles.hostText}>
              <Text style={styles.hostTitle}>Earn with your space</Text>
              <Text style={styles.hostSub}>List your driveway or garage and start earning</Text>
            </View>
            <ArrowRight size={19} color={GREEN} strokeWidth={2.1} />
          </Pressable>

          <Text style={styles.secLabel}>Support</Text>
          <View>
            <Row icon="headset-outline" label="Contact support" onPress={() => navigation.navigate("Support")} />
            <Row icon="document-text-outline" label="Terms & privacy" onPress={() => navigation.navigate("Legal")} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Logged in ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom + 96, 120) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Masthead ── */}
        <Pressable
          style={({ pressed }) => [styles.masthead, pressed && styles.mastheadPressed]}
          onPress={() => navigation.navigate("PersonalInfo")}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {user.name?.trim() || "Your account"}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            {user.emailVerified ? (
              <>
                <View style={styles.metaDot} />
                <View style={styles.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </>
            ) : null}
          </View>
          {!user.emailVerified ? (
            <Pressable
              style={styles.verifyChip}
              onPress={resendVerification}
              disabled={sending || resendCooldown > 0}
              hitSlop={6}
            >
              <Text style={styles.verifyChipText}>
                {sending
                  ? "Sending…"
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Verify your email"}
              </Text>
            </Pressable>
          ) : null}
        </Pressable>

        {/* ── Host strip — only when user has no listings ── */}
        {hasListings === false && (
          <Pressable
            style={({ pressed }) => [styles.host, pressed && styles.hostPressed]}
            onPress={() => navigation.navigate("CreateListingFlow")}
          >
            <View style={styles.hostText}>
              <Text style={styles.hostTitle}>Earn with your space</Text>
              <Text style={styles.hostSub}>List your driveway or garage and start earning</Text>
            </View>
            <ArrowRight size={19} color={GREEN} strokeWidth={2.1} />
          </Pressable>
        )}

        {/* ── Account ── */}
        <Text style={styles.secLabel}>Your account</Text>
        <View>
          <Row icon="card-outline" label="Payment methods" onPress={() => navigation.navigate("Payments")} />
          <Row
            icon="car-outline"
            label="Vehicle"
            value={user.vehicleMake ?? "Add"}
            onPress={() => navigation.navigate("VehicleType")}
          />
          <Row
            icon="notifications-outline"
            label="Notifications"
            value={notificationsEnabled ? "On" : "Off"}
            onPress={handleToggleNotifications}
          />
          <Row icon="lock-closed-outline" label="Login & security" onPress={() => navigation.navigate("LoginSecurity")} />
          <Row icon="heart-outline" label="Favourites" onPress={() => navigation.navigate("Favorites")} />
        </View>

        {/* ── Hosting — only when user has listings ── */}
        {hasListings === true && (
          <>
            <Text style={styles.secLabel}>Hosting</Text>
            <View>
              <Row icon="home-outline" label="List your space" onPress={() => navigation.navigate("CreateListingFlow")} />
              <Row icon="list-outline" label="Manage spaces" onPress={() => navigation.navigate("Listings")} />
            </View>
          </>
        )}

        {/* ── Support ── */}
        <Text style={styles.secLabel}>Support</Text>
        <View>
          <Row icon="headset-outline" label="Contact support" onPress={() => navigation.navigate("Support")} />
          <Row icon="document-text-outline" label="Terms & privacy" onPress={() => navigation.navigate("Legal")} />
        </View>

        {/* ── Admin ── */}
        {user.role === "admin" ? (
          <>
            <Text style={styles.secLabel}>Admin</Text>
            <View>
              <Row icon="shield-outline" label="Admin panel" onPress={() => navigation.navigate("Admin")} />
            </View>
          </>
        ) : null}

        {/* ── Sign out ── */}
        <Pressable style={styles.signOut} onPress={confirmSignOut} hitSlop={8}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cardBg },
  scroll: { paddingHorizontal: 20 },

  // ── Masthead (open, no box) ──────────────────────────────────
  masthead: { alignItems: "flex-start", paddingTop: 6, paddingBottom: 18 },
  mastheadPressed: { opacity: 0.72 },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: colors.tileBg,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 28, color: GREEN, letterSpacing: -0.5,
  },
  name: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 27,
    color: colors.text, letterSpacing: -0.8, marginTop: 16, lineHeight: 31,
  },
  metaRow: {
    flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8, flexWrap: "wrap",
  },
  email: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14.5, color: colors.textSoft },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN },
  mastheadSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14.5,
    color: colors.textSoft, marginTop: 8, lineHeight: 20,
  },
  verifyChip: {
    alignSelf: "flex-start", marginTop: 12,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  verifyChipText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12.5, color: GREEN },
  signInChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: 16,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9,
  },
  signInChipText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: GREEN },

  // ── Host strip (single colour moment) ────────────────────────
  host: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.tileBg, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 18, paddingHorizontal: 17, paddingVertical: 15,
    marginTop: 6, marginBottom: 8,
  },
  hostPressed: { opacity: 0.9 },
  hostText: { flex: 1 },
  hostTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15.5, color: colors.status.active.text, letterSpacing: -0.2,
  },
  hostSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13.5, color: colors.accent, marginTop: 2,
  },

  // ── Sections (icon list, no dividers) ────────────────────────
  secLabel: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 11.5, color: colors.textMuted,
    letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 4,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 15,
    paddingVertical: 12,
  },
  ico: { width: 24, alignItems: "center", flexShrink: 0 },
  rowPressed: { opacity: 0.55 },
  rowLabel: {
    flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15.5,
    color: colors.text, letterSpacing: -0.2,
  },
  rowLabelDanger: { color: colors.danger },
  rowValue: {
    fontFamily: "PlusJakartaSans-Medium", fontSize: 14,
    color: colors.textMuted, letterSpacing: -0.1, maxWidth: 170,
  },

  // ── Sign out (quiet text link) ───────────────────────────────
  signOut: { alignItems: "center", paddingTop: 30, paddingBottom: 8 },
  signOutText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.danger },
});
