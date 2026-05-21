import { useEffect, useRef, useState } from "react";
import {
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
import { requestPhoneVerification, updateMe, verifyPhone } from "../api";
import { useGlobalToast, useToastOnMessage } from "../components/GlobalToast";
import type { RootStackParamList } from "../types";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PersonalInfo">;

export function PersonalInfoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, token, setAuthUser } = useAuth();
  const { showSuccess } = useGlobalToast();
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
  const hasChanges =
    currentName !== originalName || currentEmail !== originalEmail || currentPhone !== originalPhone;
  const phoneChanged = currentPhone !== originalPhone;
  const phoneVerified = !!user?.phoneVerified && currentPhone === originalPhone;
  const emailChanged = currentEmail !== originalEmail;

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(message, { variant: "success" });

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
    setShowPhoneVerify(false);
    setVerificationCode("");
    setPreviewUrl(null);
  }, [user?.name, user?.email, user?.phone]);

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
      const successMessage = emailChanged
        ? "Personal information updated. Check your inbox to verify your new email."
        : "Personal information updated.";
      showSuccess(successMessage);
      if (currentPhone && phoneChanged) {
        setShowPhoneVerify(true);
        setMessage("Profile saved. Verify your new phone number below.");
      } else if (!currentPhone) {
        setShowPhoneVerify(false);
        setVerificationCode("");
        setMessage(null);
      } else {
        setShowPhoneVerify(false);
        setVerificationCode("");
        setMessage(null);
      }
      if (emailChanged && res.previewUrl) {
        setMessage("Profile saved. Check your email to confirm your new address.");
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
    setShowPhoneVerify(true);
    try {
      await requestPhoneVerification(token, currentPhone);
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
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Personal information</Text>
            <Text style={styles.subtitle}>Your account details</Text>
          </View>

          <View style={styles.sheet}>
            <View
              style={styles.section}
              onLayout={(event) => {
                nameFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Name</Text>
              <AppTextInput
                containerStyle={styles.editInputContainer}
                style={styles.editInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                onFocus={() => scrollToField(nameFieldY.current)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Email address</Text>
              <AppTextInput
                containerStyle={styles.editInputContainer}
                style={styles.editInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => scrollToField(nameFieldY.current)}
              />
              <View style={styles.statusMetaRow}>
                <View style={styles.statusRow}>
                  {user?.emailVerified ? (
                    <>
                      <Ionicons name="checkmark-circle" size={15} color="#2ECC8F" />
                      <Text style={styles.statusOk}>Verified</Text>
                    </>
                  ) : (
                    <Text style={styles.statusMuted}>Not verified</Text>
                  )}
                </View>
              </View>
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                phoneFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Phone number</Text>
              <AppTextInput
                containerStyle={styles.editInputContainer}
                style={styles.editInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                onFocus={() => scrollToField(phoneFieldY.current)}
              />

              <View style={styles.phoneStatusRow}>
                <View style={styles.statusRow}>
                  {phoneVerified ? (
                    <>
                      <Ionicons name="checkmark-circle" size={15} color="#2ECC8F" />
                      <Text style={styles.statusOk}>Verified</Text>
                    </>
                  ) : (
                    <Text style={styles.statusMuted}>
                      {currentPhone ? "Not verified" : "No phone added"}
                    </Text>
                  )}
                </View>
                {currentPhone ? (
                  <Pressable
                    style={[styles.inlineButton, (sendingCode || saving) && styles.inlineButtonDisabled]}
                    onPress={onSendCode}
                    disabled={sendingCode || saving}
                  >
                    <Text style={styles.inlineButtonText}>
                      {sendingCode ? "Sending..." : phoneVerified ? "Resend code" : "Verify"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {showPhoneVerify ? (
                <View style={styles.verifyPanel}>
                  <Text style={styles.verifyHelp}>Enter the 6-digit code sent to {currentPhone}.</Text>
                  <View
                    onLayout={(event) => {
                      verifyFieldY.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <AppTextInput
                      containerStyle={styles.editInputContainer}
                      style={styles.verifyInput}
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

          {previewUrl ? (
            <Pressable style={styles.previewLink} onPress={() => Linking.openURL(previewUrl)}>
              <Text style={styles.previewLinkText}>Open verification link</Text>
            </Pressable>
          ) : null}

          <Button
            style={styles.saveButton}
            title="Save"
            onPress={onSave}
            disabled={!hasChanges || saving}
            loading={saving}
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
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    marginLeft: spacing.screenX,
    marginTop: spacing.screenY,
  },
  backText: {
    ...textStyles.body,
    color: colors.text,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 29,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  sheet: {
    backgroundColor: "transparent",
    flex: 1,
    paddingHorizontal: spacing.screenX,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.text,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 10,
  },
  phoneStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: 10,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statusMetaRow: {
    marginTop: 10,
  },
  statusOk: {
    color: "#2ECC8F",
    fontFamily: "Inter-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  statusMuted: {
    color: "#6B7280",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  inlineButton: {
    borderColor: "#E5E7EB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  inlineButtonDisabled: {
    opacity: 0.7,
  },
  inlineButtonText: {
    color: "#111111",
    fontFamily: "Inter-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  verifyPanel: {
    gap: spacing.xs,
    marginTop: 10,
  },
  verifyHelp: {
    color: "#6B7280",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  editInputContainer: {
    marginBottom: 0,
  },
  editInput: {
    ...textStyles.body,
    color: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  verifyInput: {
    ...textStyles.body,
    color: colors.text,
    backgroundColor: colors.cardBg,
    borderColor: "#D7DEE7",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    marginHorizontal: spacing.screenX,
    marginTop: spacing.lg,
  },
  previewLink: {
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  previewLinkText: {
    color: colors.accent,
    fontFamily: "Inter-Medium",
    fontSize: 13,
    lineHeight: 19,
  },
});
