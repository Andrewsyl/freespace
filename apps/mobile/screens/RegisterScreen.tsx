import { useState } from "react";
import {
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
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { colors, radius, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;
const AUTH_GREEN = "#2ECC8F";

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legalVersion = "2026-01-10";
  const needsLegalAcceptance = (candidate: { termsVersion?: string | null; privacyVersion?: string | null }) =>
    !candidate.termsVersion || !candidate.privacyVersion;

  const handleSignUp = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmed = email.trim();
    if (!trimmedFirstName) {
      setError("Enter your first name.");
      return;
    }
    if (!trimmedLastName) {
      setError("Enter your last name.");
      return;
    }
    if (trimmedPhone.length < 6) {
      setError("Enter a valid phone number.");
      return;
    }
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
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone,
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
              <Text style={styles.cardTitle}>Create account</Text>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.inputLabel}>First name</Text>
                  <AppTextInput
                    containerStyle={styles.inputContainer}
                    placeholder="John"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.inputLabel}>Last name</Text>
                  <AppTextInput
                    containerStyle={styles.inputContainer}
                    placeholder="Smith"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

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
                <Text style={styles.inputLabel}>Confirm password</Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  placeholder="******"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone number</Text>
                <AppTextInput
                  containerStyle={styles.inputContainer}
                  placeholder="+353 87 123 4567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
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
                  I agree to <Text style={styles.link}>Terms & Privacy</Text>.
                </Text>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                style={styles.signUpButton}
                onPress={handleSignUp}
                disabled={submitting}
                loading={submitting}
                title={submitting ? "Creating..." : "Create account"}
              />
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
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  inputLabel: {
    ...textStyles.meta,
    color: colors.textSoft,
    marginBottom: 6,
  },
  inputContainer: {
    marginBottom: 0,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 4,
    marginBottom: spacing.md,
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
    backgroundColor: AUTH_GREEN,
    borderColor: AUTH_GREEN,
  },
  checkboxText: {
    flex: 1,
    ...textStyles.meta,
    color: colors.textMuted,
  },
  link: {
    color: AUTH_GREEN,
  },
  signUpButton: {
    marginBottom: spacing.xs,
    backgroundColor: AUTH_GREEN,
    borderColor: AUTH_GREEN,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
});
