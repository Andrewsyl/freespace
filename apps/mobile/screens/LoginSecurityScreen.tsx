import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { changePassword, deleteAccount, logoutAllSessions, requestPasswordReset } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "LoginSecurity">;

export function LoginSecurityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token, logout, user } = useAuth();
  const isPasswordLogin = (user?.authProvider ?? "password") === "password";
  const authProviderLabel =
    user?.authProvider === "google" ? "Google" : user?.authProvider === "facebook" ? "Facebook" : "Email";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingSetupEmail, setSendingSetupEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogoutAll = () => {
    if (!token) return;
    Alert.alert(
      "Log out of all devices",
      "This will end sessions on all devices. You will need to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out all",
          style: "destructive",
          onPress: async () => {
            try {
              await logoutAllSessions(token);
              await logout();
            } catch (err) {
              Alert.alert("Could not log out all devices", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleSendPasswordSetup = async () => {
    if (!user?.email) return;
    setSendingSetupEmail(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(user.email);
      setMessage(`Password setup email sent to ${user.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send password setup email");
    } finally {
      setSendingSetupEmail(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!token) return;
    Alert.alert(
      "Delete account",
      "This will permanently remove your account, listings, and bookings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(token);
              await logout();
            } catch (err) {
              Alert.alert("Could not delete account", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!token) return;
    if (!currentPassword.trim()) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await changePassword(token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated. You may need to sign in again on other devices.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <Text style={styles.navTitle}>Login & security</Text>
          <View style={styles.navSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Login & security</Text>
            <Text style={styles.subtitle}>Password, sessions, and account access.</Text>
          </View>

          {user?.status === "suspended" ? (
            <View style={styles.suspendedBanner}>
              <Text style={styles.suspendedTitle}>Account suspended</Text>
              <Text style={styles.suspendedBody}>Your access is restricted. Contact support to resolve the issue.</Text>
            </View>
          ) : null}

          <View style={styles.group}>
            <Text style={styles.groupLabel}>{isPasswordLogin ? "Change password" : "Sign-in method"}</Text>
            {isPasswordLogin ? (
              <>
                <Text style={styles.groupHelp}>Update your password for this account.</Text>
                <Text style={styles.fieldLabel}>Current password</Text>
                <AppTextInput
                  containerStyle={styles.editInputContainer}
                  style={styles.editInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Enter current password"
                />
                <Text style={styles.fieldLabel}>New password</Text>
                <AppTextInput
                  containerStyle={styles.editInputContainer}
                  style={styles.editInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Enter new password"
                />
                <Text style={styles.fieldLabel}>Confirm new password</Text>
                <AppTextInput
                  containerStyle={styles.editInputContainer}
                  style={styles.editInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Confirm new password"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {message ? <Text style={styles.notice}>{message}</Text> : null}
                <Button title="Update password" onPress={handleChangePassword} disabled={saving} loading={saving} />
              </>
            ) : (
              <>
                <View style={styles.providerRow}>
                  <View style={styles.providerIconWrap}>
                    <MaterialIcons name="shield" size={18} color={colors.text} />
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={styles.rowTitle}>Signed in with {authProviderLabel}</Text>
                    <Text style={styles.rowSubtitle}>
                      You don’t need an app password when you use {authProviderLabel} sign-in.
                    </Text>
                  </View>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {message ? <Text style={styles.notice}>{message}</Text> : null}
                <Button
                  title="Send password setup email"
                  onPress={handleSendPasswordSetup}
                  disabled={sendingSetupEmail}
                  loading={sendingSetupEmail}
                />
              </>
            )}
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Account access</Text>
            <Pressable style={styles.row} onPress={handleLogoutAll}>
              <MaterialIcons name="logout" size={22} color={colors.danger} />
              <View style={styles.textWrap}>
                <Text style={styles.rowTitle}>Log out of all devices</Text>
                <Text style={styles.rowSubtitle}>Ends sessions on other phones and browsers</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSoft} />
            </Pressable>
            <Pressable style={styles.row} onPress={handleDeleteAccount}>
              <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
              <View style={styles.textWrap}>
                <Text style={[styles.rowTitle, styles.rowDanger]}>Delete account</Text>
                <Text style={styles.rowSubtitle}>Remove your data and listings permanently</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSoft} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6E4",
    backgroundColor: "#ffffff",
  },
  group: {
    marginBottom: 18,
    marginHorizontal: spacing.screenX,
  },
  groupLabel: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  groupHelp: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  editInputContainer: {
    marginBottom: 14,
  },
  editInput: {
    ...textStyles.body,
    color: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111827" },
  navSpacer: { width: 34 },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: "#6B6B6B",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  suspendedBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.md,
    marginHorizontal: spacing.screenX,
    padding: spacing.md,
  },
  suspendedTitle: {
    ...textStyles.sectionTitle,
    color: colors.danger,
  },
  suspendedBody: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: 4,
  },
  error: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  notice: {
    ...textStyles.meta,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  providerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: spacing.md,
    paddingVertical: 6,
  },
  providerIconWrap: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  rowDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
});
