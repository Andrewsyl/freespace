import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { changePassword, deleteAccount, logoutAllSessions } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { Button, Card, SectionHeader, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "LoginSecurity">;

export function LoginSecurityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token, logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
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
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.navigate("Tabs", { screen: "Profile" })}
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

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

          <View style={styles.sheet}>
            <SectionHeader title="Change password" subtitle="Update your password for this account." />
            <AppTextInput
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Enter current password"
            />
            <AppTextInput
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
            />
            <AppTextInput
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm new password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.notice}>{message}</Text> : null}
            <Button title="Update password" onPress={handleChangePassword} disabled={saving} loading={saving} />
          </View>

          <Card style={styles.card} noPadding>
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
          </Card>
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
  sheet: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.xl,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    marginHorizontal: spacing.screenX,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
  },
  backText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
  },
  title: {
    ...textStyles.screenTitle,
  },
  subtitle: {
    ...textStyles.subtitle,
    marginTop: 4,
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
  card: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.screenX,
  },
  error: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.screenX,
  },
  notice: {
    ...textStyles.meta,
    color: colors.accent,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.screenX,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
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
