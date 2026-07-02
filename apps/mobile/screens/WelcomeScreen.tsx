import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Mail } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useAuth } from "../auth";
import { AppleSignInButton } from "../components/AppleSignInButton";
import type { AuthReturnTo, RootStackParamList } from "../types";
import freeSpaceLogo from "../assets/freespace-logo-grid-black.png";
import { trackEvent } from "../analytics";
import { logInfo, logWarn } from "../logger";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;
const AUTH_GREEN = "#0a8050";

export function WelcomeScreen({ navigation, route }: Props) {
  const { user, loginWithOAuth } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);
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

        <View style={styles.authCopyWrap}>
          <Text style={styles.authTitle}>
            <Text style={styles.authTitleAccent}>Log in </Text>
            or create an account.
          </Text>
          <Text style={styles.authBody}>
            You&apos;ll need an account to book spaces and manage your reservations.
          </Text>
        </View>

        <AppleSignInButton
          source="welcome"
          onStart={() => {
            setError(null);
            setAppleSubmitting(true);
          }}
          onDone={() => setAppleSubmitting(false)}
          onError={setError}
        />

        <Pressable
          style={({ pressed }) => [
            styles.authOutlineBtn,
            (pressed || submitting) && !submitting ? styles.authOutlineBtnPressed : null,
          ]}
          disabled={submitting || appleSubmitting}
          onPress={handleGoogleSignIn}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={AUTH_GREEN} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={AUTH_GREEN} style={styles.authBtnIcon} />
              <Text style={styles.authOutlineText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.authOutlineBtn, pressed ? styles.authOutlineBtnPressed : null]}
          onPress={() => {
            void trackEvent("mobile_signin_view_started", { source: "welcome" });
            navigation.navigate("SignIn", returnTo ? { returnTo } : undefined);
          }}
        >
          <Mail size={19} color={AUTH_GREEN} strokeWidth={2.1} style={styles.authBtnIcon} />
          <Text style={styles.authOutlineText}>Log in with email</Text>
        </Pressable>

        <View style={styles.authDivider}>
          <View style={styles.authDividerLine} />
          <Text style={styles.authDividerText}>or</Text>
          <View style={styles.authDividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.authCreateBtn, pressed ? styles.authCreateBtnPressed : null]}
          onPress={() => {
            void trackEvent("mobile_signup_view_started", { source: "welcome" });
            navigation.navigate("Register", returnTo ? { returnTo } : undefined);
          }}
        >
          <Text style={styles.authCreateText}>Create account</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.legalText}>
          By continuing, you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
            Terms &amp; Privacy
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: "100%",
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 4,
    overflow: "visible",
  },
  logo: {
    width: 200,
    height: 112,
  },
  illustration: {
    width: 332,
    height: 196,
    marginBottom: 16,
  },
  authCopyWrap: {
    width: "100%",
    maxWidth: 360,
    marginBottom: 20,
  },
  authTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: "#111827",
    marginBottom: 10,
  },
  authTitleAccent: {
    color: "#0a8050",
  },
  authBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
  },
  authOutlineBtn: {
    width: "100%",
    maxWidth: 360,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9DEDE",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  authOutlineBtnPressed: {
    opacity: 0.92,
  },
  authBtnIcon: {
    marginRight: 10,
  },
  authOutlineText: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  authDivider: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#D9DEDE",
  },
  authDividerText: {
    marginHorizontal: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#6B7280",
  },
  authCreateBtn: {
    width: "100%",
    maxWidth: 360,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#0a8050",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  authCreateBtnPressed: {
    opacity: 0.95,
  },
  authCreateText: {
    color: "#ffffff",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: "#D14343",
    textAlign: "center",
    maxWidth: 360,
  },
  legalText: {
    marginTop: 22,
    maxWidth: 320,
    textAlign: "center",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7280",
  },
  legalLink: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: "#0a8050",
  },
});
