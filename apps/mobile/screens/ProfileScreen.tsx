import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { requestEmailVerification } from "../api";
import { useAuth } from "../auth";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button, Card, Screen, SectionHeader } from "../components/ui";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const url = await requestEmailVerification(user.email);
      setPreviewUrl(url);
      setMessage(
        url
          ? "Verification link ready. Open it to confirm your email."
          : "Verification email sent. Check your inbox."
      );
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSending(false);
    }
  };

  const syncNotificationStatus = async () => {
    const settings = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(settings.granted);
  };

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      Alert.alert(
        "Turn off notifications",
        "Notifications are managed in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(
        "Enable notifications",
        "Notifications are off. Open system settings to enable them.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
      return;
    }
    await syncNotificationStatus();
  };

  useEffect(() => {
    void syncNotificationStatus();
  }, []);

  const showPlaceholder = (title: string) => {
    Alert.alert(title, "This section is coming soon.");
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Screen style={styles.emptyState}>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.subtitle}>Sign in to manage your profile and security.</Text>
          <Button style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")} title="Sign in" />
          <Pressable
            style={styles.ghostButton}
            onPress={() => navigation.navigate("Tabs", { screen: "Search" })}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.ghostButtonText}>Search</Text>
          </Pressable>
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Screen
        scroll
        scrollProps={{ contentContainerStyle: styles.content as any }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.subtitle}>Manage your account info, verification, and security.</Text>
        </View>

        {message ? <Text style={styles.notice}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {previewUrl ? (
          <Pressable style={styles.linkButton} onPress={() => Linking.openURL(previewUrl)}>
            <Text style={styles.linkButtonText}>Open verification link</Text>
          </Pressable>
        ) : null}

        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("PersonalInfo")}
          >
            <View style={styles.personIconShell}>
              <Ionicons name="person-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Personal information</Text>
              <Text style={styles.rowSubtitle}>{user.name?.trim() || "Name, phone number, email"}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>

        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Favorites")}
          >
            <MaterialIcons name="favorite-border" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Favourites</Text>
              <Text style={styles.rowSubtitle}>Saved spaces</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Settings")}
          >
            <MaterialIcons name="settings" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Settings</Text>
              <Text style={styles.rowSubtitle}>Preferences</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>

        <SectionHeader title="Account" style={styles.sectionHeaderWrap} />
        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Payments")}
          >
            <MaterialIcons name="credit-card" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Payment methods</Text>
              <Text style={styles.rowSubtitle}>Add cards or bank accounts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("VehicleType")}
          >
            <MaterialIcons name="directions-car" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>My vehicle</Text>
              <Text style={styles.rowSubtitle}>
                {user.vehicleMake && user.vehicleType
                  ? `${user.vehicleMake} • ${user.vehicleType}`
                  : "Add your car brand and model"}
              </Text>
            </View>
            <View style={styles.rowActions}>
              {user.vehicleMake ? <VehicleBrandLogo make={user.vehicleMake} size={30} /> : null}
              <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={handleToggleNotifications}
          >
            <MaterialIcons name="notifications-none" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowSubtitle}>Trips, reminders, updates</Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                notificationsEnabled && styles.toggleTrackActive,
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  notificationsEnabled && styles.toggleKnobActive,
                ]}
              />
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("LoginSecurity")}
          >
            <MaterialIcons name="lock-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Login & security</Text>
              <Text style={styles.rowSubtitle}>Password, 2FA, devices</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Promo codes")}
          >
            <MaterialIcons name="local-offer" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Promo codes</Text>
              <Text style={styles.rowSubtitle}>Apply discounts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <View style={styles.row}>
            <MaterialIcons
              name={user.emailVerified ? "verified" : "mark-email-unread"}
              size={24}
              color="#111827"
            />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {user.emailVerified ? "Email verified" : "Verify your email"}
              </Text>
              <Text style={styles.rowSubtitle}>
                {user.emailVerified ? "Your email is confirmed." : "Finish verification."}
              </Text>
            </View>
            {!user.emailVerified ? (
              <Pressable
                style={styles.inlineButton}
                onPress={resendVerification}
                disabled={sending || resendCooldown > 0}
              >
                <Text style={styles.inlineButtonText}>
                  {sending
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Retry in ${resendCooldown}s`
                      : "Resend"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.inlineStatus}>Verified</Text>
            )}
          </View>
        </Card>

        <SectionHeader title="Hosting" style={styles.sectionHeaderWrap} />
        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("CreateListingFlow")}
          >
            <MaterialIcons name="add-business" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>List your space</Text>
              <Text style={styles.rowSubtitle}>Earn from your parking spot</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Listings")}
          >
            <MaterialIcons name="home-work" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Manage spaces</Text>
              <Text style={styles.rowSubtitle}>Edit listings and availability</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Space owner guide")}
          >
            <MaterialIcons name="menu-book" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>View our space owner guide</Text>
              <Text style={styles.rowSubtitle}>Best practices and tips</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>

        <SectionHeader title="Support" style={styles.sectionHeaderWrap} />
        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Help centre")}
          >
            <MaterialIcons name="help-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Help centre</Text>
              <Text style={styles.rowSubtitle}>FAQs and guides</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Support")}
          >
            <MaterialIcons name="support-agent" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Contact support</Text>
              <Text style={styles.rowSubtitle}>Send a message to our team</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Legal")}
          >
            <MaterialIcons name="info-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Terms & privacy</Text>
              <Text style={styles.rowSubtitle}>Legal and policies</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>

        <SectionHeader title="Account" style={styles.sectionHeaderWrap} />
        <Card style={styles.section} noPadding>
          {user?.role === "admin" ? (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate("Admin")}
            >
              <MaterialIcons name="admin-panel-settings" size={24} color="#111827" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Admin panel</Text>
                <Text style={styles.rowSubtitle}>Moderate users and listings</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("LoginSecurity")}
          >
            <MaterialIcons name="delete-outline" size={24} color={colors.danger} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, styles.rowTitleDanger]}>Delete account</Text>
              <Text style={styles.rowSubtitle}>Permanently remove your profile, bookings, and listings</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => logout()}
          >
            <MaterialIcons name="logout" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Sign out</Text>
              <Text style={styles.rowSubtitle}>Log out of this device</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    paddingBottom: 0,
    paddingTop: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    ...textStyles.screenTitle,
    marginTop: 6,
  },
  subtitle: {
    ...textStyles.subtitle,
    fontSize: 15,
    marginTop: 6,
  },
  notice: {
    backgroundColor: "#ecfdf7",
    borderColor: "#a7f3d0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#2ECC8F",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  section: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
    ...cardShadow,
  },
  sectionHeaderWrap: {
    marginBottom: 10,
    marginTop: 18,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  rowPressed: {
    backgroundColor: colors.appBg,
  },
  personIconShell: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  toggleTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 26,
    padding: 3,
    width: 48,
  },
  toggleTrackActive: {
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    height: 20,
    width: 20,
  },
  toggleKnobActive: {
    marginLeft: 22,
  },
  rowText: {
    flex: 1,
  },
  rowActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  rowTitle: {
    ...textStyles.bodyStrong,
    fontSize: 15,
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    ...textStyles.bodyMedium,
    marginTop: 2,
  },
  inlineButton: {
    borderColor: "#99f6e4",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineButtonText: {
    ...textStyles.meta,
    color: "#0f766e",
  },
  linkButton: {
    alignItems: "center",
    marginBottom: 12,
  },
  linkButtonText: {
    ...textStyles.meta,
    color: "#0f766e",
  },
  inlineStatus: {
    ...textStyles.meta,
    color: "#2ECC8F",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    width: 220,
    height: 150,
    marginBottom: 18,
  },
  primaryButton: {
    marginTop: 16,
    width: "100%",
  },
  ghostButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  ghostButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
