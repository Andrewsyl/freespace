import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ChevronRight } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { requestEmailVerification, getHostListings } from "../api";
import { useAuth } from "../auth";
import { useGlobalToast } from "../components/GlobalToast";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

const GREEN  = "#0a8050";
const LINE   = "#d1d5db";
const FG     = "#111827";
const MUTED  = "#374151";
const SUBTLE = "#6b7280";

type RowProps = {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  first?: boolean;
};

function Row({ icon, label, sub, onPress, right, danger, first }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowBorder,
        pressed && !!onPress && styles.rowPressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? "#b42318" : MUTED}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={15} color={SUBTLE} /> : null)}
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

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "U";

  // ── Logged out ────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom + 96, 120) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Profile</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.signInCard, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("Welcome")}
          >
            <View style={styles.signInAvatar}>
              <Ionicons name="person-outline" size={28} color={GREEN} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.signInTitle}>Sign in to FreeSpace</Text>
              <Text style={styles.signInSub}>Access your bookings, vehicle and payments</Text>
            </View>
            <ChevronRight size={16} color={SUBTLE} />
          </Pressable>

          <Text style={styles.groupLabel}>Account</Text>
          <View style={styles.group}>
            <Row first icon="card-outline" label="Payment methods" sub="Cards and bank accounts" onPress={() => navigation.navigate("Welcome")} />
            <Row icon="car-outline" label="My vehicle" sub="Car brand, model and plate" onPress={() => navigation.navigate("Welcome")} />
            <Row icon="lock-closed-outline" label="Login & security" sub="Password and devices" onPress={() => navigation.navigate("Welcome")} />
          </View>

          <Text style={styles.groupLabel}>Hosting</Text>
          <View style={styles.group}>
            <Row first icon="home-outline" label="List your space" sub="Earn from your driveway or garage" onPress={() => navigation.navigate("Welcome")} />
            <Row icon="list-outline" label="Manage spaces" sub="Edit listings and availability" onPress={() => navigation.navigate("Welcome")} />
          </View>

          <Text style={styles.groupLabel}>Support</Text>
          <View style={styles.group}>
            <Row first icon="chatbubble-outline" label="Contact support" sub="Send a message to our team" onPress={() => navigation.navigate("Support")} />
            <Row icon="document-text-outline" label="Terms & privacy" sub="Legal and policies" onPress={() => navigation.navigate("Legal")} />
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom + 96, 120) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <Pressable
          style={({ pressed }) => [styles.profileCard, pressed && styles.profileCardPressed]}
          onPress={() => navigation.navigate("PersonalInfo")}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name?.trim() || "Your account"}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
          </View>
          {user.emailVerified ? (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={13} color={GREEN} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : (
            <Pressable
              style={styles.verifyBtn}
              onPress={resendVerification}
              disabled={sending || resendCooldown > 0}
            >
              <Text style={styles.verifyBtnText}>
                {sending ? "Sending…" : resendCooldown > 0 ? `${resendCooldown}s` : "Verify email"}
              </Text>
            </Pressable>
          )}
        </Pressable>

        {/* ── Hosting CTA — only when user has no listings ── */}
        {hasListings === false && (
          <Pressable
            style={({ pressed }) => [styles.hostingCta, pressed && { opacity: 0.88 }]}
            onPress={() => navigation.navigate("CreateListingFlow")}
          >
            <View style={styles.hostingCtaIcon}>
              <Ionicons name="home" size={22} color={GREEN} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.hostingCtaTitle}>Got a parking space?</Text>
              <Text style={styles.hostingCtaSub}>List it on FreeSpace and start earning</Text>
            </View>
            <ChevronRight size={15} color={GREEN} />
          </Pressable>
        )}

        {/* ── Account ── */}
        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.group}>
          <Row
            first
            icon="card-outline"
            label="Payment methods"
            sub="Cards and bank accounts"
            onPress={() => navigation.navigate("Payments")}
          />
          <Row
            icon="car-outline"
            label="My vehicle"
            sub={
              user.vehicleMake && user.vehicleType
                ? `${user.vehicleMake} · ${user.vehicleType}`
                : "Add your car brand, model and plate"
            }
            onPress={() => navigation.navigate("VehicleType")}
            right={
              <View style={styles.rowRight}>
                {user.vehicleMake ? <VehicleBrandLogo make={user.vehicleMake} size={32} /> : null}
                <ChevronRight size={15} color={SUBTLE} />
              </View>
            }
          />
          <Row
            icon="notifications-outline"
            label="Notifications"
            sub={notificationsEnabled ? "Enabled" : "Disabled"}
            onPress={handleToggleNotifications}
            right={
              <View style={[styles.toggle, notificationsEnabled && styles.toggleOn]}>
                <View style={[styles.toggleKnob, notificationsEnabled && styles.toggleKnobOn]} />
              </View>
            }
          />
          <Row
            icon="lock-closed-outline"
            label="Login & security"
            sub="Password and devices"
            onPress={() => navigation.navigate("LoginSecurity")}
          />
          <Row
            icon="heart-outline"
            label="Favourites"
            sub="Saved spaces"
            onPress={() => navigation.navigate("Favorites")}
          />
          <Row
            icon="settings-outline"
            label="Settings"
            sub="App preferences"
            onPress={() => navigation.navigate("Settings")}
          />
        </View>

        {/* ── Hosting — only when user has listings ── */}
        {hasListings === true && (
          <>
            <Text style={styles.groupLabel}>Hosting</Text>
            <View style={styles.group}>
              <Row
                first
                icon="home-outline"
                label="List your space"
                sub="Earn from your driveway or garage"
                onPress={() => navigation.navigate("CreateListingFlow")}
              />
              <Row
                icon="list-outline"
                label="Manage spaces"
                sub="Edit listings and availability"
                onPress={() => navigation.navigate("Listings")}
              />
            </View>
          </>
        )}

        {/* ── Support ── */}
        <Text style={styles.groupLabel}>Support</Text>
        <View style={styles.group}>
          <Row
            first
            icon="chatbubble-outline"
            label="Contact support"
            sub="Send a message to our team"
            onPress={() => navigation.navigate("Support")}
          />
          <Row
            icon="document-text-outline"
            label="Terms & privacy"
            sub="Legal and policies"
            onPress={() => navigation.navigate("Legal")}
          />
        </View>

        {/* ── Admin ── */}
        {user.role === "admin" ? (
          <View style={[styles.group, { marginTop: 8 }]}>
            <Row
              first
              icon="shield-outline"
              label="Admin panel"
              sub="Moderate users and listings"
              onPress={() => navigation.navigate("Admin")}
            />
          </View>
        ) : null}

        {/* ── Sign out ── */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
          onPress={() =>
            Alert.alert("Sign out", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => logout() },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={19} color="#c0392b" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  scroll: { paddingHorizontal: 16 },

  // ── Page header ──────────────────────────────────────────────
  pageHeader: { paddingBottom: 14, paddingHorizontal: 4 },
  pageTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 29, color: FG, letterSpacing: -0.9,
  },

  // ── Profile card ─────────────────────────────────────────────
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ffffff", borderRadius: 20,
    borderWidth: 1, borderColor: "#E1E7ED",
    paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  profileCardPressed: { opacity: 0.88 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#EDF7F2",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 22, color: GREEN,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 18,
    color: FG, letterSpacing: -0.3,
  },
  profileEmail: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14,
    color: MUTED, marginTop: 2,
  },
  verifiedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EDF7F2", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0,
  },
  verifiedText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: GREEN },
  verifyBtn: {
    borderRadius: 999, borderWidth: 1, borderColor: LINE,
    paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0,
  },
  verifyBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },

  // ── Sign in card (logged out) ────────────────────────────────
  signInCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ffffff", borderRadius: 20,
    borderWidth: 1, borderColor: "#E1E7ED",
    paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 14,
  },
  signInAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#EDF7F2",
    alignItems: "center", justifyContent: "center",
  },
  signInTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.2 },
  signInSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, marginTop: 2 },

  // ── Hosting CTA ──────────────────────────────────────────────
  hostingCta: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#EDF7F2", borderRadius: 20,
    borderWidth: 1, borderColor: "#c6ead8",
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 4,
  },
  hostingCtaIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  hostingCtaTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#0a6640", letterSpacing: -0.2,
  },
  hostingCtaSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: "#2d8a5e", marginTop: 1 },

  // ── Group ────────────────────────────────────────────────────
  groupLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11, color: "#888",
    letterSpacing: 0.8, textTransform: "uppercase",
    marginBottom: 8, marginTop: 20, paddingHorizontal: 4,
  },
  group: {
    borderRadius: 20, borderWidth: 1, borderColor: "#E1E7ED",
    overflow: "hidden", backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  // ── Rows ─────────────────────────────────────────────────────
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: "#ffffff", minHeight: 52,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  rowPressed: { backgroundColor: "#f5f5f3" },
  iconWrap: { width: 22, alignItems: "center", flexShrink: 0 },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG },
  rowLabelDanger: { color: "#b42318" },
  rowSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, marginTop: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },

  // ── Toggle ───────────────────────────────────────────────────
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: LINE, padding: 3,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: GREEN },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#ffffff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleKnobOn: { alignSelf: "flex-end" },

  // ── Sign out button ──────────────────────────────────────────
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 24, marginBottom: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "#fff1f0",
    borderWidth: 1, borderColor: "#fac5c0",
  },
  signOutBtnPressed: { backgroundColor: "#ffe4e1" },
  signOutText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: "#c0392b",
  },
});
