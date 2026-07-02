import { useEffect, useState } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../auth";
import { trackEvent } from "../analytics";
import { logWarn } from "../logger";

type Props = {
  source: string;
  onError: (message: string) => void;
  onStart?: () => void;
  onDone?: () => void;
  onSuccess?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Native Sign in with Apple button (App Store Guideline 4.8 requires offering
// it wherever third-party logins like Google appear). Renders nothing on
// Android/web or when the device doesn't support Apple authentication.
export function AppleSignInButton({ source, onError, onStart, onDone, onSuccess, style }: Props) {
  const { loginWithOAuth } = useAuth();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    onStart?.();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        onError("Apple sign-in failed. Please try again.");
        return;
      }
      // Apple only shares the name on the very first authorization, and only
      // to the client — forward it so the account isn't created nameless.
      const fullName =
        [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(" ")
          .trim() || null;
      await loginWithOAuth("apple", credential.identityToken, { fullName });
      void trackEvent("mobile_login_succeeded", { method: "apple", source });
      onSuccess?.();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code === "ERR_REQUEST_CANCELED") return;
      const message = err instanceof Error ? err.message : "Apple sign-in failed";
      logWarn("Apple sign-in failed", { source, code: code || null, message });
      onError(message);
    } finally {
      onDone?.();
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={16}
      style={[styles.button, style]}
      onPress={() => void handlePress()}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    marginBottom: 12,
    maxWidth: 360,
    width: "100%",
  },
});
