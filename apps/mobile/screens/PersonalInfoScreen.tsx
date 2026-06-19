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
import { ArrowLeft, CircleCheck } from "lucide-react-native";
import * as Linking from "expo-linking";
import { useAuth } from "../auth";
import { requestPhoneVerification, updateMe, verifyPhone } from "../api";
import { useGlobalToast, useToastOnMessage } from "../components/GlobalToast";
import type { RootStackParamList } from "../types";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "PersonalInfo">;

export function PersonalInfoScreen({ navigation, route }: Props) {
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

  useEffect(() => {
    if (!route.params?.notice) return;
    setMessage(route.params.notice);
  }, [route.params?.notice]);

  useEffect(() => {
    if (route.params?.focusField !== "phone") return;
    scrollToField(phoneFieldY.current);
  }, [route.params?.focusField]);

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

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.navBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBackOrFallback(navigation, fallbackRoutes.profile)}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#111827" strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.navTitle}>Personal information</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.gatedWrap}>
          <Text style={styles.gatedTitle}>Sign in to edit your profile</Text>
          <Text style={styles.gatedBody}>Your name, email, and phone number are only available after you sign in.</Text>
          <Button title="Sign in" onPress={() => navigation.navigate("SignIn")} style={styles.gatedPrimaryButton} />
          <Button
            title="Browse spaces"
            variant="secondary"
            onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.navBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBackOrFallback(navigation, fallbackRoutes.profile)}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#111827" strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.navTitle}>Personal information</Text>
          <View style={styles.navSpacer} />
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
        >
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
                      <CircleCheck size={15} color="#0a8050" strokeWidth={2.2} />
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
                      <CircleCheck size={15} color="#0a8050" strokeWidth={2.2} />
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
    backgroundColor: "#F4F6F8",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },
  gatedWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.screenX,
    paddingBottom: 48,
  },
  gatedTitle: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 10,
  },
  gatedBody: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  gatedPrimaryButton: {
    marginBottom: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  phoneStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: 12,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statusMetaRow: {
    marginTop: 12,
  },
  statusOk: {
    color: "#0a8050",
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  statusMuted: {
    color: "#374151",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  inlineButton: {
    borderColor: "#E5E7EB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inlineButtonDisabled: {
    opacity: 0.7,
  },
  inlineButtonText: {
    color: "#111111",
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 14,
    lineHeight: 18,
  },
  verifyPanel: {
    gap: spacing.xs,
    marginTop: 12,
  },
  verifyHelp: {
    color: "#374151",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
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
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  previewLink: {
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  previewLinkText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13,
    lineHeight: 19,
  },
});
