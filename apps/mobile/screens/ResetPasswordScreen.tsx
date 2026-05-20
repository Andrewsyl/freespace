import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { requestPasswordReset, resetPassword } from "../api";
import { useToastOnMessage } from "../components/GlobalToast";
import type { RootStackParamList } from "../types";
import { colors, radius, spacing, textStyles } from "../styles/theme";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const emailFieldY = useRef(0);
  const tokenFieldY = useRef(0);
  const passwordFieldY = useRef(0);
  const confirmPasswordFieldY = useRef(0);
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [apiBaseOverride, setApiBaseOverride] = useState<string | undefined>(route.params?.apiBase);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const launchedFromEmailLink = Boolean(route.params?.token);

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(notice, { variant: "info" });

  useEffect(() => {
    if (route.params?.token) {
      setToken(route.params.token);
      setStep("reset");
    }
    if (route.params?.apiBase) {
      setApiBaseOverride(route.params.apiBase);
    }
  }, [route.params?.apiBase, route.params?.token]);

  const extractToken = (url: string) => {
    const match = url.match(/token=([^&]+)/);
    return match?.[1] ?? "";
  };

  const handleRequest = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestPasswordReset(trimmed);
      setPreviewUrl(result.previewUrl ?? null);
      setNotice(
        result.previewUrl
          ? "Reset link ready. Open it or paste the token below."
          : "If an account exists, we sent a reset link."
      );
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (token.trim().length < 10) {
      setError("Paste the reset token from your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await resetPassword(token.trim(), password, apiBaseOverride);
      setNotice("Password updated. You can sign in now.");
      navigation.replace("Welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToField = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              {step === "request"
                ? "We will send a secure link to update your password."
                : "Choose a new password for your account."}
            </Text>
          </View>

          <View style={styles.card}>
            {step === "request" ? (
              <>
                <View
                  style={styles.field}
                  onLayout={(event) => {
                    emailFieldY.current = event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Email</Text>
                  <AppTextInput
                    containerStyle={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    onFocus={() => scrollToField(emailFieldY.current)}
                  />
                </View>
                <Button
                  title={submitting ? "Sending..." : "Send reset link"}
                  onPress={handleRequest}
                  disabled={submitting}
                  loading={submitting}
                  style={styles.primaryButton}
                />
              </>
            ) : (
              <>
                {previewUrl && !launchedFromEmailLink ? (
                  <View style={styles.previewRow}>
                    <Button
                      title="Open reset link"
                      size="medium"
                      style={styles.linkButton}
                      onPress={() => Linking.openURL(previewUrl)}
                    />
                    <Button
                      title="Use token"
                      variant="secondary"
                      size="medium"
                      style={styles.secondaryButton}
                      onPress={() => setToken(extractToken(previewUrl))}
                    />
                  </View>
                ) : null}
                {!launchedFromEmailLink ? (
                  <View
                    style={styles.field}
                    onLayout={(event) => {
                      tokenFieldY.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.label}>Reset token</Text>
                    <AppTextInput
                      containerStyle={styles.fieldInput}
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="none"
                      placeholder="Paste the token from your email"
                      onFocus={() => scrollToField(tokenFieldY.current)}
                    />
                  </View>
                ) : null}
                <View
                  style={styles.field}
                  onLayout={(event) => {
                    passwordFieldY.current = event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>New password</Text>
                  <AppTextInput
                    containerStyle={styles.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    onFocus={() => scrollToField(passwordFieldY.current)}
                  />
                </View>
                <View
                  style={styles.field}
                  onLayout={(event) => {
                    confirmPasswordFieldY.current = event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Confirm password</Text>
                  <AppTextInput
                    containerStyle={styles.fieldInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    onFocus={() => scrollToField(confirmPasswordFieldY.current)}
                  />
                </View>
                <Button
                  title={submitting ? "Updating..." : "Update password"}
                  onPress={handleReset}
                  disabled={submitting}
                  loading={submitting}
                  style={styles.primaryButton}
                />
              </>
            )}
          </View>

          <BackButton style={styles.ghostButton} onPress={() => navigation.goBack()} />
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: spacing.screenY,
  },
  header: {
    marginBottom: 14,
  },
  kicker: textStyles.kicker,
  title: {
    ...textStyles.title,
    marginTop: 6,
  },
  subtitle: {
    ...textStyles.subtitle,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.card,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  fieldInput: {
    marginBottom: 0,
  },
  previewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  linkButton: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
  },
  ghostButton: {
    alignSelf: "center",
    marginTop: 16,
  },
});
