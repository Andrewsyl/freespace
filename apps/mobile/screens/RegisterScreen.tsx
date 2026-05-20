import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import freeSpaceLogo from "../assets/logo-freespace-black-hd.png";
import { logInfo, logWarn } from "../logger";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { colors, radius, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register, loginWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const legalVersion = "2026-01-10";
  const needsLegalAcceptance = (candidate: { termsVersion?: string | null; privacyVersion?: string | null }) =>
    !candidate.termsVersion || !candidate.privacyVersion;

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId || undefined,
      iosClientId: Platform.OS === "ios" ? googleIosClientId || undefined : undefined,
    });
    logInfo("Configured Google sign-in", {
      platform: Platform.OS,
      screen: "Register",
      hasWebClientId: Boolean(googleWebClientId),
      hasIosClientId: Boolean(googleIosClientId),
      webClientIdSuffix: googleWebClientId ? googleWebClientId.slice(-12) : null,
    });
  }, [googleWebClientId, googleIosClientId]);

  const handleSignUp = async () => {
    const trimmed = email.trim();
    if (!accepted) {
      setError("Please accept the terms and privacy policy.");
      return;
    }
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
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
    try {
      const result = await register(trimmed, password, {
        termsVersion: legalVersion,
        privacyVersion: legalVersion,
      });
      if (needsLegalAcceptance(result.user)) {
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    try {
      logInfo("Google sign-up starting", { screen: "Register" });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      logInfo("Google Play Services available", { screen: "Register" });
      const signInResult = await GoogleSignin.signIn();
      logInfo("Google account selected", {
        screen: "Register",
        email: signInResult?.data?.user?.email ?? null,
      });
      let idToken: string | null = null;
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken ?? null;
        logInfo("Google tokens received", {
          screen: "Register",
          hasIdToken: Boolean(idToken),
          accessTokenSuffix: tokens.accessToken ? tokens.accessToken.slice(-8) : null,
        });
      } catch {
        idToken = null;
      }
      if (!idToken) {
        setError("Google sign-in completed but no ID token was returned.");
        return;
      }
      const authUser = await loginWithOAuth("google", idToken);
      logInfo("Backend Google OAuth login succeeded", {
        screen: "Register",
        userId: authUser.id,
        email: authUser.email,
      });
      if (needsLegalAcceptance(authUser)) {
        setError("Please accept Terms & Privacy to continue.");
        return;
      }
    } catch (err) {
      const errorCode = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      logWarn("Google sign-up failed", {
        screen: "Register",
        code: errorCode || null,
        message,
        raw:
          err && typeof err === "object"
            ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
            : err,
      });
      setError(errorCode ? `${message} (${errorCode})` : message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <BackButton onPress={() => navigation.goBack()} />
            </View>

            <View style={styles.card}>
              <Image
                source={freeSpaceLogo}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.cardTitle}>Sign Up</Text>
              <Text style={styles.cardSubtitle}>Create your account to book and host with FreeSpace.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  placeholder="johndoe@gmail.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  placeholder="******"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password again</Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  placeholder="******"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <Pressable
                style={styles.checkboxRow}
                onPress={() => setAccepted((value) => !value)}
              >
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                  {accepted ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to the <Text style={styles.link}>terms</Text> and{" "}
                  <Text style={styles.link}>privacy</Text> policy.
                </Text>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                style={styles.signUpButton}
                onPress={handleSignUp}
                disabled={submitting}
                loading={submitting}
                title={submitting ? "Creating..." : "Sign Up"}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable style={styles.socialButton} onPress={handleGoogleSignup}>
                  <Ionicons name="logo-google" size={20} color="#DB4437" />
                  <Text style={styles.socialText}>Google</Text>
                </Pressable>

                <Pressable style={styles.socialButton}>
                  <Ionicons name="logo-facebook" size={20} color="#4267B2" />
                  <Text style={styles.socialText}>Facebook</Text>
                </Pressable>
              </View>
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
  safeArea: {
    flex: 1,
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxText: {
    flex: 1,
    ...textStyles.meta,
    color: colors.textMuted,
  },
  link: {
    color: colors.accent,
  },
  signUpButton: {
    marginBottom: spacing.md,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...textStyles.meta,
    color: colors.textSoft,
    marginHorizontal: spacing.md,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  socialText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
});
