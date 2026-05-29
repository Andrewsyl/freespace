import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { requestEmailVerification } from "../api";
import { useAuth } from "../auth";
import { useGlobalToast } from "../components/GlobalToast";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button, Card, Screen, SectionHeader } from "../components/ui";
import { colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { showError, showSuccess } = useGlobalToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [sending, setSending] = useState(false);
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
    try {
      const url = await requestEmailVerification(user.email);
      setPreviewUrl(url);
      showSuccess(
        url
          ? "Verification email sent. Check your email to confirm your address."
          : "Verification email sent. Check your email to confirm your address."
      );
      setResendCooldown(30);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not send verification email");
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

  const promptLogin = () => navigation.navigate("Welcome");
  const gatedPress = (callback?: () => void) => () => {
    if (!user) {
      promptLogin();
      return;
    }
    callback?.();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Screen scroll scrollProps={{ contentContainerStyle: styles.content as any }}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your account, payments, hosting, and support.</Text>
          </View>

          <View style={styles.contentBody}>
            <Card style={styles.section} noPadding>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.avatarShell}>
                  <Text style={styles.avatarText}>U</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Your account</Text>
                  <Text style={styles.rowSubtitle}>Sign in to access your profile</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
            </Card>

            <SectionHeader title="Account" style={styles.sectionHeaderWrap} />
            <Card style={styles.section} noPadding>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="credit-card" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Payment methods</Text>
                  <Text style={styles.rowSubtitle}>Add cards or bank accounts</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="directions-car" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>My vehicle</Text>
                  <Text style={styles.rowSubtitle}>Add your car brand and model</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="lock-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Login & security</Text>
                  <Text style={styles.rowSubtitle}>Password, 2FA, devices</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
            </Card>

            <SectionHeader title="Hosting" style={styles.sectionHeaderWrap} />
            <Card style={styles.section} noPadding>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="add-business" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>List your space</Text>
                  <Text style={styles.rowSubtitle}>Earn from your parking spot</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="home-work" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Manage spaces</Text>
                  <Text style={styles.rowSubtitle}>Edit listings and availability</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
            </Card>

            <SectionHeader title="Support" style={styles.sectionHeaderWrap} />
            <Card style={styles.section} noPadding>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="help-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Help centre</Text>
                  <Text style={styles.rowSubtitle}>FAQs and guides</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={promptLogin}>
                <View style={styles.iconShell}>
                  <MaterialIcons name="support-agent" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Contact support</Text>
                  <Text style={styles.rowSubtitle}>Send a message to our team</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
              </Pressable>
            </Card>
            <View style={styles.bottomSpacer} />
          </View>
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
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account, verification, hosting, and support.</Text>
        </View>

        <View style={styles.contentBody}>
        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("PersonalInfo")}
          >
            <View style={styles.avatarShell}>
              <Text style={styles.avatarText}>
                {user.name?.trim()?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{user.name?.trim() || "Your account"}</Text>
              <Text style={styles.rowSubtitle}>Profile</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>

        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Favorites")}
          >
            <View style={styles.iconShell}>
              <MaterialIcons name="favorite-border" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="settings" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="credit-card" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="directions-car" size={20} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>My vehicle</Text>
              <Text style={styles.rowSubtitle}>
                {user.vehicleMake && user.vehicleType
                  ? `${user.vehicleMake} - ${user.vehicleType}`
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
            <View style={styles.iconShell}>
              <MaterialIcons name="notifications-none" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="lock-outline" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="local-offer" size={20} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Promo codes</Text>
              <Text style={styles.rowSubtitle}>Apply discounts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <View style={styles.row}>
            <View style={styles.iconShell}>
              <MaterialIcons
                name={user.emailVerified ? "verified" : "mark-email-unread"}
                size={20}
                color={colors.accent}
              />
            </View>
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
          {previewUrl ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(previewUrl)}>
              <Text style={styles.linkButtonText}>Open verification link</Text>
            </Pressable>
          ) : null}
        </Card>

        <SectionHeader title="Hosting" style={styles.sectionHeaderWrap} />
        <Card style={styles.section} noPadding>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("CreateListingFlow")}
          >
            <View style={styles.iconShell}>
              <MaterialIcons name="add-business" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="home-work" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="menu-book" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="help-outline" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="support-agent" size={20} color={colors.accent} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="info-outline" size={20} color={colors.accent} />
            </View>
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
              <View style={styles.iconShell}>
                <MaterialIcons name="admin-panel-settings" size={20} color={colors.accent} />
              </View>
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
            <View style={styles.iconShellDanger}>
              <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
            </View>
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
            <View style={styles.iconShell}>
              <MaterialIcons name="logout" size={20} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Sign out</Text>
              <Text style={styles.rowSubtitle}>Log out of this device</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </Card>
        <View style={styles.bottomSpacer} />
        </View>
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
    paddingBottom: spacing.section,
    paddingTop: 16,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    ...textStyles.titleSmall,
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "800",
    marginTop: 0,
  },
  subtitle: {
    ...textStyles.meta,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  avatarShell: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    fontWeight: "700",
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  profileEmail: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 1,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillVerified: {
    backgroundColor: "#e8faf2",
  },
  statusPillPending: {
    backgroundColor: "#fef3c7",
  },
  statusPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 9.5,
    fontWeight: "600",
  },
  statusPillTextVerified: {
    color: "#127c63",
  },
  statusPillTextPending: {
    color: "#a16207",
  },
  contentBody: {
    marginTop: 14,
  },
  section: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  sectionHeaderWrap: {
    marginBottom: 4,
    marginTop: 12,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: colors.cardBgMuted,
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  iconShellDanger: {
    alignItems: "center",
    backgroundColor: "#fff1f1",
    borderColor: "#f4d4d4",
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
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
    gap: 8,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    ...textStyles.bodyMedium,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },
  inlineButton: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inlineButtonText: {
    ...textStyles.meta,
    color: colors.accent,
  },
  linkButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  linkButtonText: {
    ...textStyles.meta,
    color: colors.accent,
  },
  inlineStatus: {
    ...textStyles.meta,
    color: colors.accent,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyHero: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  emptyLogoWrap: {
    alignItems: "center",
    height: 170,
    justifyContent: "center",
    marginBottom: 10,
    overflow: "visible",
    width: "100%",
  },
  emptyLogo: {
    height: 190,
    transform: [{ scale: 2.1 }],
    width: 430,
  },
  emptyIllustration: {
    height: 268,
    marginBottom: 28,
    width: 408,
  },
  primaryButton: {
    marginTop: 0,
    width: "100%",
  },
  emptyLoginRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 24,
  },
  emptyLoginText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  emptyLoginLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 96,
  },
});
