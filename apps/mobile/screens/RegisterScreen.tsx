import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { CommonActions, type CompositeScreenProps } from "@react-navigation/native";
import { Check, ChevronDown, X } from "lucide-react-native";
import { useAuth } from "../auth";
import type { AuthReturnTo, AuthStackParamList, RootStackParamList } from "../types";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { colors, radius, spacing, textStyles } from "../styles/theme";

type Props = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, "Register">,
  NativeStackScreenProps<RootStackParamList>
>;
const AUTH_GREEN = colors.primary;

const COUNTRIES = [
  { flag: "🇮🇪", name: "Ireland", dialCode: "+353" },
  { flag: "🇬🇧", name: "United Kingdom", dialCode: "+44" },
  { flag: "🇺🇸", name: "United States", dialCode: "+1" },
  { flag: "🇨🇦", name: "Canada", dialCode: "+1" },
  { flag: "🇦🇺", name: "Australia", dialCode: "+61" },
  { flag: "🇳🇿", name: "New Zealand", dialCode: "+64" },
  { flag: "🇩🇪", name: "Germany", dialCode: "+49" },
  { flag: "🇫🇷", name: "France", dialCode: "+33" },
  { flag: "🇪🇸", name: "Spain", dialCode: "+34" },
  { flag: "🇮🇹", name: "Italy", dialCode: "+39" },
  { flag: "🇳🇱", name: "Netherlands", dialCode: "+31" },
  { flag: "🇧🇪", name: "Belgium", dialCode: "+32" },
  { flag: "🇵🇹", name: "Portugal", dialCode: "+351" },
  { flag: "🇵🇱", name: "Poland", dialCode: "+48" },
  { flag: "🇸🇪", name: "Sweden", dialCode: "+46" },
  { flag: "🇳🇴", name: "Norway", dialCode: "+47" },
  { flag: "🇩🇰", name: "Denmark", dialCode: "+45" },
  { flag: "🇫🇮", name: "Finland", dialCode: "+358" },
  { flag: "🇨🇭", name: "Switzerland", dialCode: "+41" },
  { flag: "🇦🇹", name: "Austria", dialCode: "+43" },
  { flag: "🇬🇷", name: "Greece", dialCode: "+30" },
  { flag: "🇨🇿", name: "Czech Republic", dialCode: "+420" },
  { flag: "🇭🇺", name: "Hungary", dialCode: "+36" },
  { flag: "🇷🇴", name: "Romania", dialCode: "+40" },
  { flag: "🇭🇷", name: "Croatia", dialCode: "+385" },
  { flag: "🇸🇰", name: "Slovakia", dialCode: "+421" },
  { flag: "🇸🇮", name: "Slovenia", dialCode: "+386" },
  { flag: "🇱🇹", name: "Lithuania", dialCode: "+370" },
  { flag: "🇱🇻", name: "Latvia", dialCode: "+371" },
  { flag: "🇪🇪", name: "Estonia", dialCode: "+372" },
  { flag: "🇮🇳", name: "India", dialCode: "+91" },
  { flag: "🇿🇦", name: "South Africa", dialCode: "+27" },
  { flag: "🇦🇪", name: "UAE", dialCode: "+971" },
  { flag: "🇸🇬", name: "Singapore", dialCode: "+65" },
];

export function RegisterScreen({ navigation, route }: Props) {
  const { register } = useAuth();
  const returnTo = route.params?.returnTo;
  const scrollRef = useRef<ScrollView | null>(null);
  const lastNameRef = useRef<RNTextInput | null>(null);
  const emailRef = useRef<RNTextInput | null>(null);
  const passwordRef = useRef<RNTextInput | null>(null);
  const confirmPasswordRef = useRef<RNTextInput | null>(null);
  const phoneRef = useRef<RNTextInput | null>(null);
  const cardOffsetY = useRef(0);
  const nameRowY = useRef(0);
  const emailFieldY = useRef(0);
  const passwordFieldY = useRef(0);
  const confirmPasswordFieldY = useRef(0);
  const phoneFieldY = useRef(0);

  const scrollToField = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, cardOffsetY.current + y - 120), animated: true });
    });
  };

  // Reset the ROOT navigator (owns Tabs + return destination), not the nested
  // auth modal stack — getParent() is the root stack.
  const navigateAfterAuth = (dest?: AuthReturnTo) => {
    const root = navigation.getParent() ?? navigation;
    if (dest) {
      root.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: "Tabs" }, { name: dest.screen, params: dest.params }],
        })
      );
    } else {
      root.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Search" } }] })
      );
    }
  };
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
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
    if (trimmedPhone && trimmedPhone.length < 4) {
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
        phone: trimmedPhone ? `${selectedCountry.dialCode}${trimmedPhone.replace(/^0/, "")}` : undefined,
        termsVersion: legalVersion,
        privacyVersion: legalVersion,
      });
      if (needsLegalAcceptance(result.user)) {
        return;
      }
      navigateAfterAuth(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setPassword("");
      setConfirmPassword("");
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
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <BackButton onPress={() => navigation.goBack()} />
            </View>

            <View style={styles.card} onLayout={(e) => { cardOffsetY.current = e.nativeEvent.layout.y; }}>
              <Text style={styles.cardTitle}>Create account</Text>

              <View style={styles.inputRow} onLayout={(e) => { nameRowY.current = e.nativeEvent.layout.y; }}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.inputLabel}>First name</Text>
                  <AppTextInput
                    containerStyle={styles.inputContainer}
                    placeholder="John"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    textContentType="givenName"
                    autoComplete="given-name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                    onFocus={() => scrollToField(nameRowY.current)}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.inputLabel}>Last name</Text>
                  <AppTextInput
                    ref={lastNameRef}
                    containerStyle={styles.inputContainer}
                    placeholder="Smith"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    textContentType="familyName"
                    autoComplete="family-name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                    onFocus={() => scrollToField(nameRowY.current)}
                  />
                </View>
              </View>

              <View style={styles.inputGroup} onLayout={(e) => { emailFieldY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.inputLabel}>Email</Text>
                <AppTextInput
                  ref={emailRef}
                  containerStyle={styles.inputContainer}
                  placeholder="johndoe@gmail.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={() => scrollToField(emailFieldY.current)}
                />
              </View>

              <View style={styles.inputGroup} onLayout={(e) => { passwordFieldY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.inputLabel}>Password</Text>
                <AppTextInput
                  ref={passwordRef}
                  containerStyle={styles.inputContainer}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  onFocus={() => scrollToField(passwordFieldY.current)}
                />
              </View>

              <View style={styles.inputGroup} onLayout={(e) => { confirmPasswordFieldY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.inputLabel}>Confirm password</Text>
                <AppTextInput
                  ref={confirmPasswordRef}
                  containerStyle={styles.inputContainer}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  onFocus={() => scrollToField(confirmPasswordFieldY.current)}
                />
              </View>

              <View style={styles.inputGroup} onLayout={(e) => { phoneFieldY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.inputLabel}>Phone number <Text style={styles.optionalLabel}>(optional)</Text></Text>
                <View style={styles.phoneRow}>
                  <Pressable
                    style={styles.dialCodeBtn}
                    onPress={() => setCountryPickerVisible(true)}
                    hitSlop={4}
                  >
                    <Text style={styles.dialCodeFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.dialCodeText}>{selectedCountry.dialCode}</Text>
                    <ChevronDown size={13} color={colors.textDisabled} strokeWidth={2.2} />
                  </Pressable>
                  <View style={styles.phoneDivider} />
                  <RNTextInput
                    ref={phoneRef}
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    placeholder="87 123 4567"
                    placeholderTextColor={colors.textDisabled}
                    onFocus={() => scrollToField(phoneFieldY.current)}
                  />
                </View>
              </View>

              <Modal
                visible={countryPickerVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setCountryPickerVisible(false)}
              >
                <Pressable style={styles.pickerOverlay} onPress={() => setCountryPickerVisible(false)}>
                  <Pressable style={styles.pickerSheet} onPress={() => {}}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select country</Text>
                      <Pressable hitSlop={8} onPress={() => setCountryPickerVisible(false)}>
                        <X size={22} color={colors.text} strokeWidth={2.2} />
                      </Pressable>
                    </View>
                    <FlatList
                      data={COUNTRIES}
                      keyExtractor={(item) => item.name}
                      contentContainerStyle={{ paddingBottom: 24 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.countryRow}
                          onPress={() => { setSelectedCountry(item); setCountryPickerVisible(false); }}
                        >
                          <Text style={styles.countryFlag}>{item.flag}</Text>
                          <Text style={styles.countryName}>{item.name}</Text>
                          <Text style={styles.countryDial}>{item.dialCode}</Text>
                        </Pressable>
                      )}
                    />
                  </Pressable>
                </Pressable>
              </Modal>

              <Pressable
                style={styles.checkboxRow}
                onPress={() => setAccepted((value) => !value)}
                testID="terms-checkbox"
              >
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                  {accepted ? <Check size={16} color={colors.textInverse} strokeWidth={2.4} /> : null}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to{" "}
                  <Text style={styles.link} onPress={() => navigation.navigate("Legal")}>
                    Terms &amp; Privacy
                  </Text>
                  .
                </Text>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                style={styles.signUpButton}
                onPress={handleSignUp}
                disabled={submitting}
                loading={submitting}
                title={submitting ? "Creating..." : "Create account"}
                testID="register-btn"
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
    // Keyboard-height worth of slack so the ScrollView can always lift the
    // lower fields (confirm password, phone) clear of the keyboard. Without
    // this the scroll clamps and the keyboard covers those fields.
    paddingBottom: 320,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.appBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cardTitle: {
    ...textStyles.sectionTitle,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
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
    marginTop: 6,
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
    marginBottom: 4,
    backgroundColor: AUTH_GREEN,
    borderColor: AUTH_GREEN,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  optionalLabel: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 58,
  },
  dialCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 15,
    paddingRight: 10,
  },
  dialCodeFlag: {
    fontSize: 20,
  },
  dialCodeText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 17,
  },
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    color: colors.text,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 17,
    paddingVertical: 15,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  countryFlag: {
    fontSize: 22,
  },
  countryName: {
    flex: 1,
    color: colors.text,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
  },
  countryDial: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
  },
});
