import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SquircleBtn } from "./SquircleBtn";
import { requestPhoneVerification, verifyPhone } from "../api";
import {
  COUNTRIES,
  type Country,
  DEFAULT_COUNTRY,
  flagEmoji,
  splitE164,
  toE164,
} from "./countryDialCodes";

const ACCENT = "#22c55e";
const FG = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#E2E8ED";

type Stage = "phone" | "code";

interface PhoneVerifyModalProps {
  visible: boolean;
  token: string;
  initialPhone?: string | null;
  onClose: () => void;
  /** Called after the phone is verified. Receives the verified number. */
  onVerified: (phone: string) => void;
}

export function PhoneVerifyModal({
  visible,
  token,
  initialPhone,
  onClose,
  onVerified,
}: PhoneVerifyModalProps) {
  const [stage, setStage] = useState<Stage>("phone");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const e164 = useMemo(() => toE164(country, national), [country, national]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  // Reset to a clean state each time the modal is opened. Pre-fill from an
  // existing number if we have one, otherwise default to Ireland.
  useEffect(() => {
    if (visible) {
      const { country: c, national: n } = splitE164(initialPhone);
      setStage("phone");
      setCountry(c);
      setNational(n);
      setCode("");
      setError(null);
      setBusy(false);
      setPickerOpen(false);
      setSearch("");
    }
  }, [visible, initialPhone]);

  const sendCode = async () => {
    if (national.replace(/\D/g, "").length < 5) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPhoneVerification(token, e164);
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter the code we texted you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyPhone(token, trimmed);
      onVerified(e164);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't match. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {stage === "phone" ? (
            <>
              <Text style={styles.title}>Verify your phone</Text>
              <Text style={styles.subtitle}>
                Drivers may call you if they can't find your space, so we verify your number
                before publishing. We'll text you a code.
              </Text>
              <View style={styles.phoneRow}>
                <Pressable
                  style={styles.countryBtn}
                  onPress={() => setPickerOpen(true)}
                  disabled={busy}
                >
                  <Text style={styles.countryFlag}>{flagEmoji(country.code)}</Text>
                  <Text style={styles.countryDial}>{country.dial}</Text>
                  <Text style={styles.countryCaret}>▾</Text>
                </Pressable>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="87 123 4567"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={national}
                  onChangeText={setNational}
                  editable={!busy}
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <SquircleBtn
                label={busy ? "Sending…" : "Send code"}
                onPress={sendCode}
                disabled={busy}
                loading={busy}
                fullWidth
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter the code</Text>
              <Text style={styles.subtitle}>
                We texted a 6-digit code to {e164}. It expires in 10 minutes.
              </Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!busy}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <SquircleBtn
                label={busy ? "Verifying…" : "Verify & publish"}
                onPress={confirmCode}
                disabled={busy}
                loading={busy}
                fullWidth
              />
              <Pressable onPress={sendCode} disabled={busy} style={styles.resend}>
                <Text style={styles.resendText}>Resend code</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={onClose} disabled={busy} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {/* Country picker */}
        <Modal
          visible={pickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerOpen(false)}
        >
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerSheet}>
              <View style={styles.handle} />
              <Text style={styles.pickerTitle}>Select country</Text>
              <TextInput
                style={styles.search}
                placeholder="Search country or code"
                placeholderTextColor={MUTED}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.countryRow}
                    onPress={() => {
                      setCountry(item);
                      setPickerOpen(false);
                      setSearch("");
                    }}
                  >
                    <Text style={styles.countryRowFlag}>{flagEmoji(item.code)}</Text>
                    <Text style={styles.countryRowName}>{item.name}</Text>
                    <Text style={styles.countryRowDial}>{item.dial}</Text>
                  </Pressable>
                )}
              />
              <Pressable onPress={() => setPickerOpen(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: FG,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: FG,
    marginBottom: 16,
  },
  phoneRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  countryFlag: { fontSize: 18 },
  countryDial: { fontSize: 17, color: FG, fontWeight: "600" },
  countryCaret: { fontSize: 12, color: MUTED },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FG,
    marginBottom: 12,
  },
  search: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: FG,
    marginBottom: 8,
  },
  pickerList: {
    flexGrow: 0,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  countryRowFlag: { fontSize: 22 },
  countryRowName: { flex: 1, fontSize: 16, color: FG },
  countryRowDial: { fontSize: 16, color: MUTED },
  codeInput: {
    letterSpacing: 8,
    textAlign: "center",
    fontSize: 22,
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 14,
  },
  resend: {
    alignSelf: "center",
    paddingVertical: 14,
  },
  resendText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "600",
  },
  cancel: {
    alignSelf: "center",
    paddingVertical: 10,
  },
  cancelText: {
    color: MUTED,
    fontSize: 15,
  },
});
