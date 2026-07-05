import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { SquircleBtn } from "./SquircleBtn";
import { Button } from "./ui";

type SignInWallProps = {
  /** A lucide icon element, e.g. <Heart size={24} color="#0a8050" strokeWidth={2.2} /> */
  icon: ReactNode;
  title: string;
  body: string;
  onSignIn: () => void;
  onBrowse?: () => void;
  onCreateAccount?: () => void;
  /** Optional trust line shown under the actions (e.g. "encrypted and secure"). */
  reassurance?: string;
  signInLabel?: string;
};

/**
 * The single "sign in to continue" state shared by every gated Profile screen.
 * Screens keep their own nav bar and render this as the body — it centres itself
 * and fills available space. Modelled on the Payments gated state so all four
 * sign-in walls read as one design instead of four.
 */
export function SignInWall({
  icon,
  title,
  body,
  onSignIn,
  onBrowse,
  onCreateAccount,
  reassurance,
  signInLabel = "Sign in",
}: SignInWallProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      <View style={styles.actions}>
        <SquircleBtn label={signInLabel} onPress={onSignIn} fullWidth />
        {onCreateAccount ? (
          <Button title="Create account" variant="secondary" onPress={onCreateAccount} />
        ) : null}
        {onBrowse ? (
          <Button title="Browse spaces" variant="secondary" onPress={onBrowse} />
        ) : null}
      </View>

      {reassurance ? (
        <View style={styles.hintRow}>
          <ShieldCheck size={14} color="#9ca3af" strokeWidth={2.1} />
          <Text style={styles.hintText}>{reassurance}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f0faf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 21,
    color: "#111827",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    gap: 12,
    marginTop: 24,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 8,
  },
  hintText: {
    color: "#9ca3af",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "center",
  },
});
