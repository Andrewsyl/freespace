import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { requestEmailVerification } from "../api";
import type { RootStackParamList } from "../types";
import freeSpaceLogo from "../assets/logo-freespace-black-hd.png";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { logInfo, logWarn } from "../logger";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { login, register, loginWithOAuth } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const emailFieldY = useRef(0);
  const passwordFieldY = useRef(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [acceptLegalChecked, setAcceptLegalChecked] = useState(false);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const legalVersion = "2026-01-10";
  const needsLegalAcceptance = (candidate: { termsVersion?: string | null; privacyVersion?: string | null }) =>
    !candidate.termsVersion || !candidate.privacyVersion;

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

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId || undefined,
      iosClientId: Platform.OS === "ios" ? googleIosClientId || undefined : undefined,
    });
    logInfo("Configured Google sign-in", {
      platform: Platform.OS,
      hasWebClientId: Boolean(googleWebClientId),
      hasIosClientId: Boolean(googleIosClientId),
      webClientIdSuffix: googleWebClientId ? googleWebClientId.slice(-12) : null,
    });
  }, [googleWebClientId, googleIosClientId]);

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
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const authUser = await login(trimmed, password);
      if (needsLegalAcceptance(authUser)) {
        setNotice("Please accept Terms & Privacy to continue.");
        return;
      }
      setNotice("Signed in successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const trimmed = email.trim();
    if (!acceptLegalChecked) {
      setError("Please accept the Terms & Privacy to create an account.");
      return;
    }
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { previewUrl: nextPreviewUrl, user } = await register(trimmed, password, {
        termsVersion: legalVersion,
        privacyVersion: legalVersion,
      });
      setPreviewUrl(nextPreviewUrl);
      setNotice(
        nextPreviewUrl
          ? "Account created. Verify your email to continue."
          : "Account created. Check your email to verify."
      );
      if (needsLegalAcceptance(user)) return;
      setNotice("Account created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
      const url = await requestEmailVerification(trimmed);
      setPreviewUrl(url);
      setNotice(
        url
          ? "Verification link ready. Open it to confirm your email."
          : "Verification email sent (if the account exists)."
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
            <Image source={freeSpaceLogo} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Access your bookings and host dashboard.</Text>

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
                color={acceptLegalChecked ? colors.accent : colors.textSoft}
              />
              <Text style={styles.checkboxText}>
                I agree to the{" "}
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

            <Button
              variant="secondary"
              style={styles.secondaryButton}
              onPress={handleRegister}
              disabled={submitting || !acceptLegalChecked}
              title="Create account"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.socialButton}
              onPress={async () => {
                setError(null);
                setNotice(null);
                setAuthSuccess(null);
                try {
                  logInfo("Google sign-in starting", { screen: "SignIn" });
                  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                  logInfo("Google Play Services available", { screen: "SignIn" });
                  const signInResult = await GoogleSignin.signIn();
                  logInfo("Google account selected", {
                    screen: "SignIn",
                    email: signInResult?.data?.user?.email ?? null,
                  });
                  const tokens = await GoogleSignin.getTokens();
                  logInfo("Google tokens received", {
                    screen: "SignIn",
                    hasIdToken: Boolean(tokens.idToken),
                    accessTokenSuffix: tokens.accessToken ? tokens.accessToken.slice(-8) : null,
                  });
                  const idToken = tokens.idToken;
                  if (!idToken) throw new Error("Missing Google idToken");
                  const authUser = await loginWithOAuth("google", idToken);
                  logInfo("Backend Google OAuth login succeeded", {
                    screen: "SignIn",
                    userId: authUser.id,
                    email: authUser.email,
                  });
                  if (needsLegalAcceptance(authUser)) {
                    setNotice("Please accept Terms & Privacy to continue.");
                    return;
                  }
                  setAuthSuccess("Signed in with Google");
                } catch (err) {
                  const errorCode =
                    err && typeof err === "object" && "code" in err ? String(err.code) : "";
                  if (errorCode === statusCodes.SIGN_IN_CANCELLED) return;
                  const message = err instanceof Error ? err.message : "Google sign-in failed";
                  logWarn("Google sign-in failed", {
                    screen: "SignIn",
                    code: errorCode || null,
                    message,
                    raw:
                      err && typeof err === "object"
                        ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
                        : err,
                  });
                  setError(errorCode ? `${message} (${errorCode})` : message);
                }
              }}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialText}>Google</Text>
            </Pressable>

            <Text style={styles.legalNote}>
              By continuing, you agree to the{" "}
              <Text style={styles.link} onPress={() => navigation.navigate("Legal")}>
                Terms & Privacy
              </Text>
              .
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {previewUrl ? (
              <Pressable style={styles.linkButton} onPress={() => Linking.openURL(previewUrl)}>
                <Text style={styles.linkButtonText}>Open verification link</Text>
              </Pressable>
            ) : null}
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
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    ...cardShadow,
  },
  brandLogo: {
    width: "100%",
    height: 46,
    marginBottom: spacing.xxs,
  },
  cardTitle: {
    ...textStyles.screenTitle,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...textStyles.subtitle,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...textStyles.label,
    color: colors.textSoft,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    marginBottom: 0,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  forgotText: {
    ...textStyles.meta,
    color: colors.accent,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkboxText: {
    ...textStyles.meta,
    color: colors.textMuted,
    flex: 1,
  },
  link: {
    color: colors.accent,
    fontWeight: "500",
  },
  primaryButton: {
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    marginBottom: spacing.md,
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...textStyles.meta,
    color: colors.textSoft,
    marginHorizontal: spacing.md,
  },
  socialButton: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    paddingVertical: 14,
  },
  socialText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  legalNote: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  noticeText: {
    ...textStyles.meta,
    color: colors.accent,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  linkButtonText: {
    ...textStyles.meta,
    color: colors.accent,
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
    borderRadius: radius.card,
    maxWidth: 320,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: "100%",
    ...cardShadow,
  },
  successTitle: {
    ...textStyles.titleSmall,
    marginBottom: spacing.xxs,
  },
  successMessage: {
    ...textStyles.bodyMedium,
  },
});
