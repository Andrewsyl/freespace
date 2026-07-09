import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ShieldCheck } from "lucide-react-native";
import { changePassword, deleteAccount, logoutAllSessions, requestPasswordReset } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { SignInWall } from "../components/SignInWall";
import { DetailNavBar, FieldRow, SectionTitle } from "../components/profileUi";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";
import { colors } from "../styles/theme";

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
  const newPasswordRef = useRef<RNTextInput | null>(null);
  const confirmPasswordRef = useRef<RNTextInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingSetupEmail, setSendingSetupEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogoutAll = () => {
    if (!token) return;
    Alert.alert("Log out of all devices", "This will end sessions on all devices. You will need to sign in again.", [
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
    ]);
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
    Alert.alert("Delete account", "This will permanently remove your account, listings, and bookings.", [
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
    ]);
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

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <DetailNavBar title="Login & security" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
        <SignInWall
          icon={<ShieldCheck size={26} color={colors.primary} strokeWidth={2.2} />}
          title="Sign in to manage security"
          body="Your password, active sessions and account controls are available once you sign in."
          onSignIn={() => navigation.navigate("Auth", { screen: "Welcome" })}
          onBrowse={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <DetailNavBar title="Login & security" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {user.status === "suspended" ? (
            <View style={styles.suspended}>
              <Text style={styles.suspendedTitle}>Account suspended</Text>
              <Text style={styles.suspendedBody}>Your access is restricted. Contact support to resolve the issue.</Text>
            </View>
          ) : null}

          {isPasswordLogin ? (
            <>
              <SectionTitle style={styles.firstSection}>Password</SectionTitle>
              <Text style={styles.help}>Update your password for this account.</Text>
              <Text style={styles.fieldLabel}>Current password</Text>
              <AppTextInput
                containerStyle={styles.inputWrap}
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => newPasswordRef.current?.focus()}
                placeholder="Enter current password"
              />
              <Text style={styles.fieldLabel}>New password</Text>
              <AppTextInput
                containerStyle={styles.inputWrap}
                style={styles.input}
                ref={newPasswordRef}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                placeholder="Enter new password"
              />
              <Text style={styles.fieldLabel}>Confirm new password</Text>
              <AppTextInput
                containerStyle={styles.inputWrap}
                style={styles.input}
                ref={confirmPasswordRef}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleChangePassword}
                placeholder="Confirm new password"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.notice}>{message}</Text> : null}
              <Button title="Update password" onPress={handleChangePassword} disabled={saving} loading={saving} style={styles.actionBtn} />
            </>
          ) : (
            <>
              <SectionTitle style={styles.firstSection}>Sign-in method</SectionTitle>
              <View style={styles.providerRow}>
                <View style={styles.providerIcon}>
                  <ShieldCheck size={18} color={colors.text} strokeWidth={2.1} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.providerTitle}>Signed in with {authProviderLabel}</Text>
                  <Text style={styles.providerSub}>
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
                style={styles.actionBtn}
              />
            </>
          )}

          <SectionTitle>Account access</SectionTitle>
          <FieldRow label="Log out of all devices" onPress={handleLogoutAll} />
          <FieldRow label="Delete account" danger onPress={handleDeleteAccount} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cardBg },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  firstSection: { marginTop: 8 },
  help: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: colors.textSoft, lineHeight: 20, marginBottom: 14 },
  fieldLabel: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: colors.text,
    letterSpacing: -0.2, marginBottom: 6, marginTop: 20,
  },
  inputWrap: { marginBottom: 0 },
  input: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 17, color: colors.text, letterSpacing: -0.2,
    backgroundColor: "transparent", borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, borderRadius: 0,
    paddingHorizontal: 0, paddingVertical: 10,
  },
  actionBtn: { marginTop: 6 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, marginBottom: 8 },
  providerIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: colors.cardBgMuted,
    alignItems: "center", justifyContent: "center",
  },
  providerTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: colors.text },
  providerSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: colors.textSoft, marginTop: 2, lineHeight: 20 },
  error: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.danger, marginBottom: 10 },
  notice: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.primary, marginBottom: 10 },
  suspended: {
    backgroundColor: colors.status.canceled.background, borderColor: colors.status.canceled.border, borderWidth: 1, borderRadius: 16,
    padding: 16, marginTop: 12,
  },
  suspendedTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: colors.danger },
  suspendedBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.textSoft, marginTop: 4, lineHeight: 19 },
});
