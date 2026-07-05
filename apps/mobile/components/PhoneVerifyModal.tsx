import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { requestPhoneVerification, verifyPhone } from "../api";
import {
  COUNTRIES,
  type Country,
  DEFAULT_COUNTRY,
  flagEmoji,
  splitE164,
  toE164,
} from "./countryDialCodes";

const ACCENT = "#0a8050";
const INK = "#111820";
const MUTED = "#69727D";
const FAINT = "#98A2AD";
const RULE = "#DFE4E9";

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

  const back = () => {
    if (busy) return;
    if (stage === "code") {
      setStage("phone");
      setError(null);
    } else {
      onClose();
    }
  };

  const primary = stage === "phone" ? sendCode : confirmCode;
  const actionLabel =
    stage === "phone" ? (busy ? "Sending…" : "Send") : busy ? "Verifying…" : "Verify";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back} presentationStyle="fullScreen">
      <SafeAreaView style={styles.page} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={back} hitSlop={8} accessibilityLabel="Go back">
            <ArrowLeft size={22} color={INK} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {stage === "phone" ? "Your phone number" : "Enter code"}
          </Text>
          <Pressable style={styles.navAction} onPress={primary} disabled={busy} hitSlop={8} accessibilityLabel={actionLabel}>
            <Text style={[styles.navActionText, busy && styles.navActionDisabled]}>{actionLabel}</Text>
          </Pressable>
        </View>

        {stage === "phone" ? (
          <>
            <View style={styles.gridHead}>
              <Text style={[styles.colLabel, styles.countryCol]}>Country</Text>
              <Text style={styles.colLabel}>Phone number</Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.gridRow}>
              <Pressable style={styles.countryCol} onPress={() => setPickerOpen(true)} disabled={busy}>
                <Text style={styles.dial}>{country.dial}</Text>
              </Pressable>
              <TextInput
                style={styles.phoneInput}
                placeholder="87 123 4567"
                placeholderTextColor={FAINT}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={national}
                onChangeText={setNational}
                editable={!busy}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={sendCode}
              />
            </View>
            <View style={styles.rule} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.help}>
              We'll text a code to confirm it's you. Drivers may call this number if they can't
              find your space.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.codeLabel}>6-digit code</Text>
            <View style={styles.rule} />
            <TextInput
              style={styles.codeInput}
              placeholder="123456"
              placeholderTextColor={FAINT}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!busy}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmCode}
            />
            <View style={styles.rule} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.help}>We texted a 6-digit code to {e164}. It expires in 10 minutes.</Text>
            <Pressable onPress={sendCode} disabled={busy} style={styles.resend}>
              <Text style={styles.resendText}>Resend code</Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>

      {/* Country picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select country</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                <Text style={styles.pickerClose}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search country or code"
              placeholderTextColor={FAINT}
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
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  navTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    color: INK,
    letterSpacing: -0.3,
  },
  navAction: { minWidth: 44, height: 38, alignItems: "flex-end", justifyContent: "center" },
  navActionText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15.5,
    color: ACCENT,
    letterSpacing: -0.1,
  },
  navActionDisabled: { color: FAINT },

  gridHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 14,
  },
  countryCol: { width: 104 },
  colLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: INK, letterSpacing: -0.3 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: RULE },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dial: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#7C8A93", letterSpacing: -0.2 },
  phoneInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 17,
    color: INK,
    letterSpacing: -0.2,
    padding: 0,
  },

  codeLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: INK,
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 14,
  },
  codeInput: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 22,
    color: INK,
    letterSpacing: 6,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  error: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13.5,
    color: "#B4402E",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  help: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resend: { alignSelf: "flex-start", paddingHorizontal: 20, paddingVertical: 16 },
  resendText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: ACCENT },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.42)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  pickerTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: INK, letterSpacing: -0.3 },
  pickerClose: { fontFamily: "PlusJakartaSans-Medium", fontSize: 15.5, color: MUTED },
  search: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: INK,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RULE,
    paddingHorizontal: 2,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pickerList: { flexGrow: 0 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RULE,
  },
  countryRowFlag: { fontSize: 22 },
  countryRowName: { flex: 1, fontFamily: "PlusJakartaSans-Medium", fontSize: 16, color: INK },
  countryRowDial: { fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: MUTED },
});
