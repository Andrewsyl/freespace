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
            <ArrowLeft size={20} color="#111827" strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.navTitle}>Login & security</Text>
          <View style={styles.navSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
        >
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
          </View>
          <Pressable style={styles.deleteLink} onPress={handleDeleteAccount}>
            <Text style={styles.deleteLinkText}>Delete account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  group: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  groupLabel: {
    color: "#6b7280",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  groupHelp: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#6b7280",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.4,
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
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },
  suspendedBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
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
  deleteLink: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  deleteLinkText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: colors.textSoft,
    textDecorationLine: "underline",
  },
  rowSubtitle: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
});
