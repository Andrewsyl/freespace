import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useAuth } from "../auth";
import { getMe, requestPhoneVerification, updateMe, verifyPhone } from "../api";
import type { RootStackParamList } from "../types";
import { Button, Card, SectionHeader, TextInput as AppTextInput } from "../components/ui";
import { colors, radius, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PersonalInfo">;

export function PersonalInfoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, token, setAuthUser } = useAuth();
  const scrollRef = useRef<any>(null);
  const nameFieldY = useRef(0);
  const phoneFieldY = useRef(0);
  const verifyFieldY = useRef(0);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const originalName = (user?.name ?? "").trim();
  const originalEmail = (user?.email ?? "").trim().toLowerCase();
  const originalPhone = (user?.phone ?? "").trim();
  const currentName = name.trim();
  const currentEmail = email.trim().toLowerCase();
  const currentPhone = phone.trim();
  const savedName = originalName || "";
  const hasChanges =
    currentName !== originalName || currentEmail !== originalEmail || currentPhone !== originalPhone;
  const phoneChanged = currentPhone !== originalPhone;
  const phoneVerified = !!user?.phoneVerified && currentPhone === originalPhone;
  const emailChanged = currentEmail !== originalEmail;

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
    setEditingName(false);
    setEditingEmail(false);
    setShowPhoneVerify(false);
    setVerificationCode("");
    setPreviewUrl(null);
  }, [user?.name, user?.email, user?.phone]);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await getMe(token);
        await setAuthUser(res.user);
      } catch {
        // Keep local profile if fetch fails.
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token, setAuthUser]);

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    setPreviewUrl(null);
    try {
      const res = await updateMe(token, {
        email: currentEmail || null,
        name: currentName || null,
        phone: currentPhone || null,
      });
      await setAuthUser(res.user);
      setPreviewUrl(res.previewUrl ?? null);
      setMessage(
        emailChanged
          ? "Profile saved. Check your inbox to verify your new email."
          : "Profile saved"
      );
      if (currentPhone && phoneChanged) {
        setShowPhoneVerify(true);
      } else if (!currentPhone) {
        setShowPhoneVerify(false);
        setVerificationCode("");
      }
      if (emailChanged) {
        setEditingEmail(false);
      }
      if (currentName !== originalName) {
        setEditingName(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onSendCode = async () => {
    if (!token || !currentPhone) return;
    setSendingCode(true);
    setMessage(null);
    setError(null);
    try {
      await requestPhoneVerification(token, currentPhone);
      setShowPhoneVerify(true);
      setMessage("Verification code sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification code");
    } finally {
      setSendingCode(false);
    }
  };

  const onVerifyCode = async () => {
    if (!token || !verificationCode.trim()) return;
    setVerifyingCode(true);
    setMessage(null);
    setError(null);
    try {
      const res = await verifyPhone(token, verificationCode.trim());
      if (res.user) {
        await setAuthUser(res.user);
      }
      setShowPhoneVerify(false);
      setVerificationCode("");
      setMessage("Phone number verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify phone number");
    } finally {
      setVerifyingCode(false);
    }
  };

  const scrollToField = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 120), animated: true });
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.navigate("Tabs", { screen: "Profile" })}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Personal information</Text>
            <Text style={styles.subtitle}>Your account details</Text>
          </View>

          <View style={styles.sheet}>
            <View style={styles.profileSummary}>
              <View style={styles.profileIcon}>
                <Ionicons name="person-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileLabel}>Personal information</Text>
                <Text style={styles.profileName}>{savedName || user?.email || "Your profile"}</Text>
              </View>
            </View>

            <SectionHeader title="Profile details" subtitle="Keep your driver profile up to date." />

            <View
              style={styles.editableRow}
              onLayout={(event) => {
                nameFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <View style={styles.emailRowHeader}>
                <Text style={styles.emailLabel}>Name</Text>
                {!editingName ? (
                  <Pressable onPress={() => setEditingName(true)} hitSlop={10}>
                    <Text style={styles.emailEditButton}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
              {editingName ? (
                <AppTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  onFocus={() => scrollToField(nameFieldY.current)}
                />
              ) : (
                <Text style={styles.emailValue}>{savedName || "Not set"}</Text>
              )}
            </View>

            <View style={styles.editableRow}>
              <View style={styles.emailRowHeader}>
                <Text style={styles.emailLabel}>Email</Text>
                {!editingEmail ? (
                  <Pressable onPress={() => setEditingEmail(true)} hitSlop={10}>
                    <Text style={styles.emailEditButton}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
              {editingEmail ? (
                <AppTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => scrollToField(nameFieldY.current)}
                />
              ) : (
                <Text style={styles.emailValue}>{user?.email ?? "Not set"}</Text>
              )}
              <Text style={[styles.verifyBadge, styles.emailVerifyBadge, user?.emailVerified ? styles.verifyBadgeOk : styles.verifyBadgePending]}>
                {user?.emailVerified ? "Email verified" : "Email not verified"}
              </Text>
            </View>

            <View
              onLayout={(event) => {
                phoneFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <AppTextInput
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                onFocus={() => scrollToField(phoneFieldY.current)}
              />

              <View style={styles.phoneStatusRow}>
                <Text
                  style={[
                    styles.verifyBadge,
                    phoneVerified ? styles.verifyBadgeOk : styles.verifyBadgePending,
                  ]}
                >
                  {phoneVerified ? "Phone verified" : currentPhone ? "Phone not verified" : "No phone added"}
                </Text>
                {currentPhone ? (
                  <Pressable
                    style={[styles.inlineButton, (sendingCode || saving || loading) && styles.inlineButtonDisabled]}
                    onPress={onSendCode}
                    disabled={sendingCode || saving || loading}
                  >
                    <Text style={styles.inlineButtonText}>
                      {sendingCode ? "Sending..." : phoneVerified ? "Resend code" : "Verify"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {(showPhoneVerify || (!!currentPhone && !phoneVerified && !phoneChanged)) ? (
                <View style={styles.verifyPanel}>
                  <Text style={styles.verifyHelp}>
                    Enter the 6-digit code sent to {currentPhone}.
                  </Text>
                  <View
                    onLayout={(event) => {
                      verifyFieldY.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <AppTextInput
                      label="Verification code"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="Verification code"
                      keyboardType="number-pad"
                      onFocus={() => scrollToField(phoneFieldY.current + verifyFieldY.current)}
                    />
                  </View>
                  <Button
                    title={verifyingCode ? "Verifying..." : "Verify phone"}
                    onPress={onVerifyCode}
                    disabled={!verificationCode.trim() || verifyingCode}
                    loading={verifyingCode}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {previewUrl ? (
            <Pressable style={styles.previewLink} onPress={() => Linking.openURL(previewUrl)}>
              <Text style={styles.previewLinkText}>Open verification link</Text>
            </Pressable>
          ) : null}

          <Button
            style={styles.saveButton}
            title="Save"
            onPress={onSave}
            disabled={!hasChanges || saving || loading}
            loading={saving || loading}
          />
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
    flex: 1,
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: spacing.md,
  },
  profileSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  profileIcon: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  profileLabel: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  profileName: {
    ...textStyles.titleSmall,
    color: colors.text,
  },
  backButton: {
    paddingHorizontal: spacing.screenX,
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
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
  phoneStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  verifyBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    fontSize: 12,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifyBadgeOk: {
    backgroundColor: "#D1FAE5",
    color: "#065f46",
  },
  verifyBadgePending: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  inlineButton: {
    backgroundColor: "#ECFDF5",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineButtonDisabled: {
    opacity: 0.7,
  },
  inlineButtonText: {
    ...textStyles.meta,
    color: colors.accent,
  },
  verifyPanel: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  verifyHelp: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  editableRow: {
    marginBottom: spacing.md,
  },
  emailRowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  emailLabel: {
    ...textStyles.label,
    color: colors.textSoft,
    marginBottom: spacing.xxs,
  },
  emailValue: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  emailVerifyBadge: {
    marginTop: spacing.xs,
  },
  emailEditButton: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  saveButton: {
    marginTop: spacing.md,
    marginHorizontal: spacing.screenX,
  },
  notice: {
    ...textStyles.meta,
    color: colors.accent,
    marginTop: spacing.sm,
    marginHorizontal: spacing.screenX,
  },
  previewLink: {
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  previewLinkText: {
    ...textStyles.meta,
    color: colors.accent,
  },
  error: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.sm,
    marginHorizontal: spacing.screenX,
  },
});
