import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SquircleBtn } from "../components/SquircleBtn";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useAuth } from "../auth";
import { requestEmailVerification } from "../api";
import type { AuthReturnTo, RootStackParamList } from "../types";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";
import { trackEvent } from "../analytics";
import { logInfo, logWarn } from "../logger";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;
const AUTH_GREEN = "#0a8050";

export function SignInScreen({ navigation, route }: Props) {
  const { login, loginWithOAuth } = useAuth();
  const returnTo = route.params?.returnTo;
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

  const navigateAfterAuth = (dest?: AuthReturnTo) => {
    if (dest) {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: "Tabs" }, { name: dest.screen, params: dest.params }],
        })
      );
    } else {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Search" } }] })
      );
    }
  };
  const scrollRef = useRef<ScrollView | null>(null);
  const emailFieldY = useRef(0);
  const passwordFieldY = useRef(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [acceptLegalChecked, setAcceptLegalChecked] = useState(false);
  const needsLegalAcceptance = (candidate: { termsVersion?: string | null; privacyVersion?: string | null }) =>
    !candidate.termsVersion || !candidate.privacyVersion;

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: Platform.OS === "android" ? googleWebClientId || undefined : undefined,
      iosClientId: Platform.OS === "ios" ? googleIosClientId || undefined : undefined,
    });
  }, [googleWebClientId, googleIosClientId]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      logInfo("Google sign-in starting", { screen: "SignIn" });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type !== "success") return;
      let idToken: string | null = signInResult.data.idToken ?? null;
      if (!idToken) {
        try {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken ?? null;
        } catch {
          idToken = null;
        }
      }
      if (!idToken) return;
      await loginWithOAuth("google", idToken);
      void trackEvent("mobile_login_succeeded", { method: "google" });
    } catch (err) {
      const errorCode = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) return;
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      logWarn("Google sign-in failed", { screen: "SignIn", code: errorCode || null, message });
      setError(errorCode ? `${message} (${errorCode})` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!acceptLegalChecked) {
      setError("Please agree to the Terms & Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const authUser = await login(trimmed, password);
      if (needsLegalAcceptance(authUser)) {
        setNotice("Please accept Terms & Privacy to continue.");
        return;
      }
      navigateAfterAuth(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice("Enter your email to resend verification.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await requestEmailVerification(trimmed);
      setNotice(
        "Verification email sent. Check your inbox and tap the link."
      );
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
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
            <BackButton onPress={() => navigation.goBack()} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log in</Text>

            {/* Google */}
            <SquircleBtn
              label="Continue with Google"
              onPress={handleGoogleSignIn}
              disabled={submitting}
              loading={submitting}
              icon={<Ionicons name="logo-google" size={18} color="#fff" />}
              fullWidth
              style={{ marginBottom: 18 }}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View
              style={styles.inputGroup}
              onLayout={(event) => {
                emailFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.inputLabel}>Email</Text>
              <AppTextInput
                containerStyle={styles.inputContainer}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                onFocus={() => scrollToField(emailFieldY.current)}
              />
            </View>

            <View
              style={styles.inputGroup}
              onLayout={(event) => {
                passwordFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.inputLabel}>Password</Text>
              <AppTextInput
                containerStyle={styles.inputContainer}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                onFocus={() => scrollToField(passwordFieldY.current)}
              />
            </View>

            <Pressable style={styles.forgotRow} onPress={() => navigation.navigate("ResetPassword")}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAcceptLegalChecked((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptLegalChecked }}
            >
              <MaterialIcons
                name={acceptLegalChecked ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={acceptLegalChecked ? AUTH_GREEN : colors.textSoft}
              />
              <Text style={styles.checkboxText}>
                I agree to{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("Legal")}>
                  Terms & Privacy
                </Text>
                .
              </Text>
            </Pressable>

            <Button
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={submitting}
              loading={submitting}
              title={submitting ? "Signing in..." : "Sign In"}
              testID="sign-in-button"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            <Pressable
              style={styles.linkButton}
              onPress={handleResend}
              disabled={submitting || resendCooldown > 0}
            >
              <Text style={styles.linkButtonText}>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend verification email"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {authSuccess ? (
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Success</Text>
              <Text style={styles.successMessage}>{authSuccess}</Text>
            </View>
          </View>
        ) : null}
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
    paddingBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: 4,
  },
  card: {
    flex: 1,
    backgroundColor: colors.appBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    ...textStyles.sectionTitle,
    marginBottom: spacing.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...textStyles.meta,
    color: colors.textSoft,
    marginBottom: 6,
  },
  inputContainer: {
    marginBottom: 0,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: spacing.xs,
    marginTop: -4,
  },
  forgotText: {
    ...textStyles.meta,
    color: AUTH_GREEN,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  checkboxText: {
    ...textStyles.meta,
    color: colors.textMuted,
    flex: 1,
  },
  link: {
    color: AUTH_GREEN,
    fontWeight: "500",
  },
  primaryButton: {
    marginBottom: spacing.xs,
    backgroundColor: AUTH_GREEN,
    borderColor: AUTH_GREEN,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  noticeText: {
    ...textStyles.meta,
    color: AUTH_GREEN,
    marginTop: 6,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: spacing.xs,
  },
  linkButtonText: {
    ...textStyles.meta,
    color: AUTH_GREEN,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  successCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 320,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: "100%",
  },
  successTitle: {
    ...textStyles.titleSmall,
    marginBottom: spacing.xxs,
  },
  successMessage: {
    ...textStyles.bodyMedium,
  },
});
