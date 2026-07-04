import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import { requestPasswordReset, resetPassword } from "../api";
import { useToastOnMessage } from "../components/GlobalToast";
import type { RootStackParamList } from "../types";
import { colors, spacing } from "../styles/theme";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;
const AUTH_GREEN = "#0a8050";

export function ResetPasswordScreen({ navigation, route }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const confirmPasswordRef = useRef<RNTextInput | null>(null);
  const emailFieldY = useRef(0);
  const passwordFieldY = useRef(0);
  const confirmPasswordFieldY = useRef(0);
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(route.params?.token ?? "");
  const [apiBaseOverride] = useState<string | undefined>(route.params?.apiBase);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const launchedFromEmailLink = Boolean(route.params?.token);
  const BadgeIcon = step === "request" ? Mail : Lock;

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(notice, { variant: "info" });

  useEffect(() => {
    if (route.params?.token) {
      setToken(route.params.token);
      setStep("reset");
    }
  }, [route.params?.token]);

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
      setNotice("If an account exists, we sent a reset link. Check your inbox and tap the link.");
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
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
        <View style={styles.navBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#111827" strokeWidth={2.2} />
          </Pressable>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconBadge}>
            <BadgeIcon size={24} color={AUTH_GREEN} strokeWidth={2.1} />
          </View>
          <Text style={styles.title}>
            {step === "request" ? "Reset password" : "Set a new password"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "request"
              ? "Enter your email and we'll send you a secure link to reset your password."
              : "Choose a new password for your account."}
          </Text>

          <View style={styles.form}>
            {step === "request" ? (
              <>
                <View
                  style={styles.field}
                  onLayout={(event) => { emailFieldY.current = event.nativeEvent.layout.y; }}
                >
                  <Text style={styles.label}>Email</Text>
                  <AppTextInput
                    containerStyle={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
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
                <View
                  style={styles.field}
                  onLayout={(event) => { passwordFieldY.current = event.nativeEvent.layout.y; }}
                >
                  <Text style={styles.label}>New password</Text>
                  <AppTextInput
                    containerStyle={styles.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    autoComplete="new-password"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    placeholder="••••••••"
                    onFocus={() => scrollToField(passwordFieldY.current)}
                  />
                </View>
                <View
                  style={styles.field}
                  onLayout={(event) => { confirmPasswordFieldY.current = event.nativeEvent.layout.y; }}
                >
                  <Text style={styles.label}>Confirm password</Text>
                  <AppTextInput
                    ref={confirmPasswordRef}
                    containerStyle={styles.fieldInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                    placeholder="••••••••"
                    onFocus={() => scrollToField(confirmPasswordFieldY.current)}
                  />
                </View>
                <Button
                  title={submitting ? "Updating..." : "Set new password"}
                  onPress={handleReset}
                  disabled={submitting}
                  loading={submitting}
                  style={styles.primaryButton}
                />
              </>
            )}
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
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 26,
  },
  form: {},
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12.5,
    marginBottom: 7,
  },
  fieldInput: {
    marginBottom: 0,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: AUTH_GREEN,
    borderColor: AUTH_GREEN,
  },
});
