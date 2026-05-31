import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import { DrumRollPicker } from "../components/DrumRollPicker";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
} from "../api";
import { useAuth } from "../auth";
import { logError, logInfo, logWarn } from "../logger";
import { getNotificationImageAttachment } from "../notifications";
import { useGlobalLoading } from "../components/GlobalLoading";
import { useToastOnMessage } from "../components/GlobalToast";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button } from "../components/ui";
import { isMobileE2EActive } from "../e2e/testMode";
import { trackEvent } from "../analytics";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatDateTimeLabel, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal, formatListingPriceLine } from "../utils/pricing";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

export function BookingSummaryScreen({ navigation, route }: Props) {
  const { id, from, to } = route.params;
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const { reset: resetGlobalLoading } = useGlobalLoading();

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(paymentFailureMessage, { variant: "danger" });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingListing(true);
      setError(null);
      try {
        const data = await getListing(id);
        if (!active) return;
        setListing(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Listing failed");
      } finally {
        if (!active) return;
        setLoadingListing(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (bookingBusy || bookingConfirmed) return true;
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Tabs", params: { screen: "Search" } }],
          })
        );
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [bookingBusy, bookingConfirmed, navigation])
  );

  useEffect(() => {
    setStartAt(new Date(from));
    setEndAt(new Date(to));
  }, [from, to]);

  useEffect(() => {
    setVehicleMake(user?.vehicleMake ?? "");
    setVehicleColor(user?.vehicleColor ?? "");
    setVehiclePlate(user?.vehiclePlate ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate]);

  const start = useMemo(() => startAt, [startAt]);
  const end = useMemo(() => endAt, [endAt]);
  const priceSummary = useMemo(() => {
    if (!listing) return null;
    return calculateListingTotal(listing, start, end);
  }, [end, listing, start]);

  const pricing = useMemo(() => {
    const parkingFee = priceSummary?.total ?? 0;
    const transactionFee = 0;
    const finalPrice = parkingFee;
    const finalCents = Math.round(parkingFee * 100);
    return {
      parkingFee,
      transactionFee,
      finalPrice,
      finalCents,
    };
  }, [priceSummary]);

  const hasVehicleProfile =
    !!user?.vehicleMake?.trim() && !!user?.vehicleType?.trim();
  const hasVehiclePlate = vehiclePlate.trim().length > 0;
  const requiresVehicleDetails = !hasVehicleProfile || !hasVehiclePlate;

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      setStartAt(next);
      // Always push "until" to 2 h after the new "from" time.
      const bumped = new Date(next);
      bumped.setHours(bumped.getHours() + 2);
      setEndAt(bumped);
      return;
    }
    // For the "until" picker: enforce at least 1 h after "from".
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
  };

  const isAmbiguousPaymentSheetResultError = (message?: string | null) =>
    typeof message === "string" &&
    message.toLowerCase().includes("failed to retrieve a paymentsheetresult");

  const scheduleBookingReminders = useCallback(async () => {
    if (!listing) return;
    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (!permissions.granted) {
      logWarn("Booking reminders skipped: notification permission not granted");
      return;
    }

    const nowMs = Date.now();
    const startReminder = new Date(start.getTime() - 60 * 60 * 1000);
    const endReminder = new Date(end.getTime() - 30 * 60 * 1000);

    if (startReminder.getTime() > nowMs) {
      const attachments = await getNotificationImageAttachment();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking starts soon",
          body: `${listing.title} starts in 1 hour.`,
          data: {
            type: "booking_reminder",
            historyTab: "upcoming",
          },
          attachments,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: startReminder },
      });
    }

    if (endReminder.getTime() > nowMs) {
      const attachments = await getNotificationImageAttachment();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking ending soon",
          body: `${listing.title} ends in 30 minutes.`,
          data: {
            type: "booking_reminder",
            historyTab: "active",
          },
          attachments,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endReminder },
      });
    }
  }, [end, listing, start]);

  const handlePayment = async () => {
    if (!listing || !priceSummary || !token || bookingConfirmed) return;
    setBookingBusy(true);
    setError(null);
    setPaymentFailureMessage(null);
    let didConfirm = false;
    try {
      logInfo("Booking started", {
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
      });
      void trackEvent("mobile_booking_started", {
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents: pricing.finalCents,
      });
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents: pricing.finalCents,
        vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
        token,
      });
      const paymentIntentId = payment.paymentIntentId ?? "";
      if (isMobileE2EActive()) {
        setConfirmingBooking(true);
        await confirmBookingPayment({ paymentIntentId, token });
        didConfirm = true;
        setBookingConfirmed(true);
        setConfirmingBooking(false);
        resetGlobalLoading();
        void trackEvent("mobile_booking_confirmed", {
          listingId: listing.id,
          paymentIntentId,
          amountCents: pricing.finalCents,
        });
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Tabs",
                params: {
                  screen: "History",
                  params: {
                    showSuccess: true,
                    refreshToken: Date.now(),
                    initialTab: "upcoming",
                  },
                },
              },
            ],
          })
        );
        return;
      }
      const initResult = await initPaymentSheet({
        merchantDisplayName: "FreeSpace",
        customerId: payment.customerId,
        customerEphemeralKeySecret: payment.ephemeralKeySecret,
        paymentIntentClientSecret: payment.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
      });
      if (initResult.error) {
        logWarn("Payment sheet init failed", {
          paymentIntentId,
          code: initResult.error.code,
          message: initResult.error.message,
        });
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        setPaymentFailureMessage("Couldn’t start payment. Try again.");
        return;
      }
      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        logWarn("Payment sheet present failed", {
          paymentIntentId,
          code: presentResult.error.code,
          message: presentResult.error.message,
        });
        const isAmbiguousResult = isAmbiguousPaymentSheetResultError(presentResult.error.message);
        if (isAmbiguousResult && paymentIntentId) {
          logWarn("Payment sheet result was ambiguous; attempting booking confirmation recovery", {
            paymentIntentId,
            code: presentResult.error.code,
            message: presentResult.error.message,
          });
          try {
            setConfirmingBooking(true);
            await confirmBookingPayment({ paymentIntentId, token });
            didConfirm = true;
            setBookingConfirmed(true);
            setConfirmingBooking(false);
            resetGlobalLoading();
            const nowMs = Date.now();
            const startMs = Date.parse(from);
            const endMs = Date.parse(to);
            const initialTab =
              Number.isFinite(startMs) &&
              Number.isFinite(endMs) &&
              startMs <= nowMs &&
              nowMs < endMs
                ? "active"
                : "upcoming";
            void scheduleBookingReminders().catch((notificationError) => {
              logWarn("Booking reminder scheduling failed", {
                message: notificationError instanceof Error ? notificationError.message : String(notificationError),
              });
            });
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: "Tabs",
                    params: {
                      screen: "History",
                      params: {
                        showSuccess: true,
                        refreshToken: Date.now(),
                        initialTab,
                      },
                    },
                  },
                ],
              })
            );
            return;
          } catch (recoveryError) {
            logWarn("Payment sheet recovery confirmation failed", {
              paymentIntentId,
              message: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
            });
            setConfirmingBooking(false);
          }
        }
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        if (presentResult.error.code === "Canceled") {
          setPaymentFailureMessage("Payment canceled.");
          return;
        }
        setPaymentFailureMessage(
          isAmbiguousResult
            ? "We couldn’t confirm payment. Check your bookings before trying again."
            : presentResult.error.message ?? "Payment failed. Try again."
        );
        return;
      }
      const confirmWithRetry = async () => {
        const attempts = [0, 400, 900];
        let lastError: unknown;
        for (const delay of attempts) {
          if (delay) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          try {
            await confirmBookingPayment({ paymentIntentId, token });
            return;
          } catch (err) {
            if (
              err instanceof Error &&
              err.message.toLowerCase().includes("time slot already booked")
            ) {
              throw err;
            }
            lastError = err;
          }
        }
        throw lastError instanceof Error ? lastError : new Error("Payment confirmation failed");
      };
      setConfirmingBooking(true);
      await confirmWithRetry();
      didConfirm = true;
      setBookingConfirmed(true);
      setConfirmingBooking(false);
      resetGlobalLoading();
      void trackEvent("mobile_booking_confirmed", {
        listingId: listing.id,
        paymentIntentId,
        amountCents: pricing.finalCents,
      });
      const nowMs = Date.now();
      const startMs = Date.parse(from);
      const endMs = Date.parse(to);
      const initialTab =
        Number.isFinite(startMs) &&
        Number.isFinite(endMs) &&
        startMs <= nowMs &&
        nowMs < endMs
          ? "active"
          : "upcoming";
      void scheduleBookingReminders().catch((notificationError) => {
        logWarn("Booking reminder scheduling failed", {
          message: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              params: {
                screen: "History",
                params: {
                  showSuccess: true,
                  refreshToken: Date.now(),
                  initialTab,
                },
              },
            },
          ],
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      void trackEvent("mobile_booking_failed", {
        listingId: listing?.id ?? id,
        message,
      });
      if (message.toLowerCase().includes("time slot already booked")) {
        setPaymentFailureMessage(
          "That slot was just taken. Choose another time."
        );
        setError(null);
        return;
      }
      setError(message);
    } finally {
      setConfirmingBooking(false);
      if (!didConfirm) {
        setBookingBusy(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Confirm booking</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {loadingListing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#0fa968" />
          </View>
        ) : !user ? (
          <View style={styles.centered}>
            <Text style={styles.centeredTitle}>Sign in to continue</Text>
            <Text style={styles.centeredSubtitle}>Log in or create an account to confirm your booking.</Text>
            <View style={styles.authButtons}>
              <Button style={styles.authButton} onPress={() => navigation.navigate("SignIn")} title="Sign in" />
              <Button variant="secondary" style={styles.authButton} onPress={() => navigation.navigate("Register")} title="Create account" />
            </View>
          </View>
        ) : listing ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Page header ── */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageLabel}>Confirm booking</Text>
              <Text style={styles.pageTitle}>{listing.title || "Parking space"}</Text>
              <Text style={styles.pageAddress}>{listing.address || ""}</Text>
            </View>

            {/* ── Your session ── */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Your session</Text>
                {priceSummary?.durationLabel ? (
                  <View style={styles.durationPill}>
                    <Text style={styles.durationPillText}>{priceSummary.durationLabel}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.pickerRow}>
                <TouchableOpacity style={styles.pickerField} activeOpacity={0.7} onPress={() => openPicker("start")}>
                  <View style={styles.pickerFieldInner}>
                    <Text style={styles.pickerFieldLabel}>From</Text>
                    <Text style={styles.pickerFieldValue}>{formatDateTimeLabel(start)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerField} activeOpacity={0.7} onPress={() => openPicker("end")}>
                  <View style={styles.pickerFieldInner}>
                    <Text style={styles.pickerFieldLabel}>Until</Text>
                    <Text style={styles.pickerFieldValue}>{formatDateTimeLabel(end)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <View style={styles.summaryBox}>
                {[
                  { label: "Arrives",  value: formatDateTimeLabel(start) },
                  { label: "Departs",  value: formatDateTimeLabel(end) },
                  { label: "Duration", value: priceSummary?.durationLabel ?? "" },
                ].map((row, i) => (
                  <View key={row.label} style={[styles.summaryRow, i > 0 && styles.summaryRowBorder]}>
                    <Text style={styles.summaryRowLabel}>{row.label}</Text>
                    <Text style={styles.summaryRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Vehicle ── */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Vehicle</Text>
                <Pressable style={styles.editBtn} onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}>
                  <Text style={styles.editBtnText}>{vehicleMake ? "Edit" : "Add"}</Text>
                </Pressable>
              </View>

              {vehicleMake ? (
                <View style={styles.vehicleInfoRow}>
                  <VehicleBrandLogo make={vehicleMake} size={36} />
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleMakeText}>{vehicleMake}</Text>
                    {(vehicleColor || user?.vehicleType) ? (
                      <Text style={styles.vehicleSubText}>
                        {[vehicleColor, user?.vehicleType].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <Pressable
                style={[styles.plate, vehicleMake && styles.plateMt]}
                onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary", focusField: "plate" })}
              >
                <View style={styles.plateEuBadge} />
                <View style={styles.plateBody}>
                  <Text style={[styles.plateNumber, !hasVehiclePlate && styles.platePlaceholder]}>
                    {hasVehiclePlate ? vehiclePlate : "Enter reg plate"}
                  </Text>
                </View>
              </Pressable>

              {requiresVehicleDetails ? (
                <Text style={styles.regHint}>Add your vehicle details to continue.</Text>
              ) : null}
            </View>

            {/* ── Price breakdown ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price breakdown</Text>
              <View style={styles.priceRows}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceRowLabel}>Rate</Text>
                  <Text style={styles.priceRowValue}>{formatListingPriceLine(listing)}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder]}>
                  <Text style={styles.priceRowLabel}>Billing period</Text>
                  <Text style={styles.priceRowValue}>{priceSummary?.durationLabel ?? ""}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder]}>
                  <Text style={styles.priceRowLabel}>Platform fee</Text>
                  <Text style={styles.priceRowMuted}>Included</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder]}>
                  <Text style={styles.priceTotalLabel}>Total</Text>
                  <Text style={styles.priceTotalValue}>€{pricing.finalPrice.toFixed(2)}</Text>
                </View>
              </View>
              <Text style={styles.noHiddenFees}>No hidden fees will be added at checkout.</Text>
            </View>

            {/* ── Payment method ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment method</Text>
              <View style={styles.paymentOptions}>
                <View style={styles.paymentOption}>
                  <Ionicons
                    name={Platform.OS === "ios" ? "logo-apple" : "logo-google"}
                    size={18}
                    color={FG}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={styles.paymentOptionLabel}>
                      {Platform.OS === "ios" ? "Apple Pay" : "Google Pay"}
                    </Text>
                    <Text style={styles.paymentOptionSub}>Fast checkout</Text>
                  </View>
                </View>
                <View style={[styles.paymentOption, styles.paymentOptionBorder]}>
                  <Ionicons name="card-outline" size={18} color={FG} />
                  <View style={styles.paymentOptionText}>
                    <Text style={styles.paymentOptionLabel}>Card</Text>
                    <Text style={styles.paymentOptionSub}>Stripe</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Cancellation policy ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cancellation policy</Text>
              <Text style={styles.sectionBody}>
                Cancel up to 2 hours before the start time for a full refund. Late cancellations may incur a fee.
              </Text>
            </View>

            {/* ── Legal ── */}
            <View style={styles.legalBlock}>
              <Text style={styles.legalText}>
                By booking you agree to the FreeSpace parking terms and liability policy.
              </Text>
            </View>

          </ScrollView>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Listing not found.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {listing && user ? (
        <View style={[styles.footerBar, { paddingBottom: 14 + insets.bottom }]}>
          <View style={styles.footerPriceBlock}>
            <Text style={styles.footerPriceMeta}>{priceSummary?.durationLabel ?? ""}</Text>
            <Text style={styles.footerPriceValue}>€{pricing.finalPrice.toFixed(2)}</Text>
          </View>
          <Pressable
            style={[styles.footerBtn, (bookingBusy || bookingConfirmed || requiresVehicleDetails) && styles.footerBtnDisabled]}
            onPress={handlePayment}
            disabled={bookingBusy || bookingConfirmed || requiresVehicleDetails}
          >
            {bookingBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.footerBtnText}>
                {confirmingBooking ? "Confirming…" : "Pay & reserve"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {pickerVisible ? (
        <Modal transparent animationType="slide" visible>
          <View style={styles.pickerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setPickerVisible(false); setDraftDate(null); }} />
            <View style={[styles.pickerSheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
              <View style={styles.pickerHandle} />
              <Text style={styles.pickerTitle}>
                {pickerField === "start" ? "Select arrival time" : "Select departure time"}
              </Text>
              <DrumRollPicker
                date={draftDate ?? (pickerField === "start" ? start : end)}
                minuteInterval={5}
                onChange={(d) => {
                  setDraftDate(d);
                  applyPickedDate(d);
                }}
              />
              <Pressable
                style={styles.pickerDoneBtn}
                onPress={() => {
                  setPickerVisible(false);
                  setDraftDate(null);
                }}
              >
                <Text style={styles.pickerDoneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

const GREEN = "#0fa968";
const LINE  = "#E6E6E4";
const FG    = "#111827";
const MUTED = "#6b7280";
const SUBTLE = "#9ca3af";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  // ── Nav header ──────────────────────────────────────────────
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE,
    backgroundColor: "#ffffff",
  },
  backButton: { padding: 6, marginLeft: -6 },
  headerTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG },
  headerSpacer: { width: 34 },

  // ── Page header ─────────────────────────────────────────────
  pageHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  pageLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: GREEN, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
  },
  pageTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 22,
    color: FG, letterSpacing: -0.5, lineHeight: 28, marginBottom: 2,
  },
  pageAddress: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },

  // ── Sections ────────────────────────────────────────────────
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingVertical: 20,
  },
  sectionTitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 17,
    color: FG, letterSpacing: -0.3,
  },
  sectionBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14,
    color: MUTED, lineHeight: 22, marginTop: 8,
  },

  // ── Date/time picker fields ──────────────────────────────────
  pickerRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  pickerField: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F7F7F6", borderRadius: 12,
    borderWidth: 1, borderColor: LINE,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pickerFieldInner: { flex: 1, gap: 2 },
  pickerFieldLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: GREEN, textTransform: "uppercase", letterSpacing: 0.6,
  },
  pickerFieldValue: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: FG,
  },

  // ── Duration pill ────────────────────────────────────────────
  durationPill: {
    backgroundColor: "#EDF7F2", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  durationPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: GREEN },

  // ── Session summary box ──────────────────────────────────────
  summaryBox: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  summaryRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  summaryRowLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  summaryRowValue: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },

  // ── Vehicle ─────────────────────────────────────────────────
  editBtn: {
    paddingVertical: 5, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: LINE,
  },
  editBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },

  vehicleInfoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  vehicleDetails: { flex: 1 },
  vehicleMakeText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3 },
  vehicleSubText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 2 },

  // ── Irish number plate ───────────────────────────────────────
  plate: {
    flexDirection: "row",
    borderRadius: 8, borderWidth: 2, borderColor: "#111827",
    overflow: "hidden", backgroundColor: "#FAFAF8", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 4, elevation: 3,
  },
  plateMt: { marginTop: 14 },
  plateEuBadge: { width: 38, alignSelf: "stretch", backgroundColor: "#003399" },
  plateBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  plateNumber: {
    fontFamily: "UKNumberPlate", fontSize: 28, color: "#111827",
    letterSpacing: 2, textTransform: "uppercase", includeFontPadding: false,
  },
  platePlaceholder: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: SUBTLE, letterSpacing: 0, textTransform: "none" },
  regHint: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: "#F59E0B", marginTop: 10, lineHeight: 18 },

  // ── Price rows ───────────────────────────────────────────────
  priceRows: { marginTop: 12 },
  priceRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11,
  },
  priceRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  priceRowLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  priceRowValue: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  priceRowMuted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: SUBTLE },
  priceTotalLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: FG },
  priceTotalValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 20, color: GREEN, letterSpacing: -0.4 },
  noHiddenFees: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE, marginTop: 8 },

  // ── Payment method ──────────────────────────────────────────
  paymentOptions: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden" },
  paymentOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#ffffff",
  },
  paymentOptionText: { flex: 1, marginLeft: 12 },
  paymentOptionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  paymentOptionLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG },
  paymentOptionSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE },

  // ── Legal ────────────────────────────────────────────────────
  legalBlock: { paddingHorizontal: 20, paddingVertical: 16 },
  legalText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE, lineHeight: 18 },

  // ── Sticky footer ───────────────────────────────────────────
  footerBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 20, paddingTop: 12,
    flexDirection: "row", alignItems: "center", gap: 14,
    shadowColor: "#111111", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
  },
  footerPriceBlock: { flex: 1 },
  footerPriceMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE },
  footerPriceValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: FG, letterSpacing: -0.5 },
  footerBtn: {
    height: 48, minWidth: 148, borderRadius: 14,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center", paddingHorizontal: 24,
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#ffffff", letterSpacing: -0.2 },

  // ── Empty / auth states ─────────────────────────────────────
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  centeredTitle: { fontSize: 20, fontFamily: "PlusJakartaSans-Bold", color: FG, textAlign: "center" },
  centeredSubtitle: { fontSize: 15, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8, textAlign: "center" },
  muted: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8 },
  authButtons: { marginTop: 16, width: "100%", maxWidth: 320, gap: 10 },
  authButton: { width: "100%" },

  // ── Date picker modal ───────────────────────────────────────
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 36, alignItems: "center", paddingTop: 12,
  },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", marginBottom: 18 },
  pickerTitle: { fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: FG, marginBottom: 4, textAlign: "center" },
  pickerDoneBtn: {
    alignSelf: "stretch", marginHorizontal: 20, marginTop: 16,
    backgroundColor: GREEN, borderRadius: 14, minHeight: 54, alignItems: "center", justifyContent: "center",
  },
  pickerDoneBtnText: { fontSize: 17, fontFamily: "PlusJakartaSans-Bold", color: "#ffffff", letterSpacing: -0.2 },

  // ── Overlay ─────────────────────────────────────────────────
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
});
