import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useAuth } from "../auth";
import type { AuthReturnTo, RootStackParamList } from "../types";
import freeSpaceLogo from "../assets/freespace-logo-grid-black.png";
import { trackEvent } from "../analytics";
import { logInfo, logWarn } from "../logger";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation, route }: Props) {
  const { user, loginWithOAuth } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const returnTo = route.params?.returnTo;

  useEffect(() => {
    if (user) {
      navigateAfterAuth(returnTo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const navigateAfterAuth = (dest?: AuthReturnTo) => {
    if (dest) {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: "Tabs" }, { name: dest.screen, params: dest.params }],
        })
      );
    } else {
      navigation.replace("Tabs", { screen: "Search" });
    }
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: Platform.OS === "android" ? googleWebClientId || undefined : undefined,
      iosClientId: Platform.OS === "ios" ? googleIosClientId || undefined : undefined,
    });
  }, [googleWebClientId, googleIosClientId]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      logInfo("Google sign-in starting", { screen: "Welcome" });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type !== "success") {
        return;
      }
      let idToken: string | null = signInResult.data.idToken ?? null;
      if (!idToken) {
        try {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken ?? null;
        } catch {
          idToken = null;
        }
      }
      logInfo("Google tokens received", {
        screen: "Welcome",
        hasIdToken: Boolean(idToken),
        email: signInResult.data.user.email ?? null,
      });
      if (!idToken) {
        return;
      }
      await loginWithOAuth("google", idToken);
      void trackEvent("mobile_login_succeeded", {
        method: "google",
      });
    } catch (err) {
      const errorCode =
        err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      logWarn("Google sign-in failed", {
        screen: "Welcome",
        code: errorCode || null,
        message,
      });
      setError(errorCode ? `${message} (${errorCode})` : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={freeSpaceLogo}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Image
          source={require("../assets/car-illustration.png")}
          style={styles.illustration}
          resizeMode="contain"
        />

        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={submitting}
        >
          <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>{submitting ? "Connecting..." : "Continue with Google"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            void trackEvent("mobile_signin_view_started", { source: "welcome" });
            navigation.navigate("SignIn", returnTo ? { returnTo } : undefined);
          }}
        >
          <Text style={styles.secondaryButtonText}>Log in with email or phone number</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => {
            void trackEvent("mobile_signup_view_started", { source: "welcome" });
            navigation.navigate("Register", returnTo ? { returnTo } : undefined);
          }}
        >
          <Text style={styles.tertiaryButtonText}>Create account</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: "100%",
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "visible",
  },
  logo: {
    width: 250,
    height: 142,
  },
  illustration: {
    width: 408,
    height: 268,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: "#0a8050",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    maxWidth: 360,
    marginBottom: 14,
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  secondaryButton: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9DEDE",
    backgroundColor: "#FFFFFF",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: "#101414",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  tertiaryButton: {
    width: "100%",
    maxWidth: 360,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tertiaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a8050",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: "#D14343",
    textAlign: "center",
    maxWidth: 360,
  },
});
