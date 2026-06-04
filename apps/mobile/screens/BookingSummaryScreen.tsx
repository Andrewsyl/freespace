import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { Button, SkeletonBlock, usePulse } from "../components/ui";
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
  const skeletonPulse = usePulse();
  const [error, setError] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [startAt, setStartAt] = useState(() => {
    const rawStart = new Date(from);
    const now = Date.now();
    if (rawStart.getTime() < now) {
      return new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
    }
    return rawStart;
  });
  const [endAt, setEndAt] = useState(() => {
    const rawStart = new Date(from);
    const rawEnd = new Date(to);
    const durationMs = rawEnd.getTime() - rawStart.getTime();
    const now = Date.now();
    if (rawStart.getTime() < now) {
      const rounded = new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
      return new Date(rounded.getTime() + durationMs);
    }
    return rawEnd;
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerOverlayVisible, setPickerOverlayVisible] = useState(false);
  const pickerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const pickerSheetTranslateY = useRef(new Animated.Value(320)).current;
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
    const rawStart = new Date(from);
    const rawEnd = new Date(to);
    const durationMs = rawEnd.getTime() - rawStart.getTime();
    const now = Date.now();
    if (rawStart.getTime() < now) {
      // Round up to next 5-minute boundary
      const rounded = new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
      setStartAt(rounded);
      setEndAt(new Date(rounded.getTime() + durationMs));
    } else {
      setStartAt(rawStart);
      setEndAt(rawEnd);
    }
  }, [from, to]);

  useEffect(() => {
    setVehicleMake(user?.vehicleMake ?? "");
    setVehicleColor(user?.vehicleColor ?? "");
    setVehiclePlate(user?.vehiclePlate ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate]);

  useEffect(() => {
    if (pickerVisible) {
      pickerBackdropOpacity.setValue(0);
      pickerSheetTranslateY.setValue(320);
      setPickerOverlayVisible(true);
    } else {
      Animated.parallel([
        Animated.timing(pickerBackdropOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(pickerSheetTranslateY, { toValue: 320, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setPickerOverlayVisible(false); });
    }
  }, [pickerVisible, pickerBackdropOpacity, pickerSheetTranslateY]);

  useEffect(() => {
    if (!pickerOverlayVisible) return;
    Animated.parallel([
      Animated.timing(pickerBackdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(pickerSheetTranslateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, [pickerOverlayVisible, pickerBackdropOpacity, pickerSheetTranslateY]);

  const start = useMemo(() => startAt, [startAt]);
  const end = useMemo(() => endAt, [endAt]);
  const priceSummary = useMemo(() => {
    if (!listing) return null;
    return calculateListingTotal(listing, start, end);
  }, [end, listing, start]);

  const pricing = useMemo(() => {
    const parkingFee = priceSummary?.total ?? 0;
    const serviceFee = Math.round(parkingFee * 0.08 * 100) / 100;
    const finalPrice = parkingFee + serviceFee;
    const finalCents = Math.round(finalPrice * 100);
    return {
      parkingFee,
      serviceFee,
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
          title: "Your parking ends in 30 minutes",
          body: `${listing.title} — need more time?`,
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
        applePay: { merchantCountryCode: "IE" },
        googlePay: { merchantCountryCode: "IE", testEnv: __DEV__ },
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
        let isAmbiguousResult = isAmbiguousPaymentSheetResultError(presentResult.error.message);
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
            const recoveryMsg = recoveryError instanceof Error ? recoveryError.message : "";
            logWarn("Payment sheet recovery confirmation failed", {
              paymentIntentId,
              message: recoveryMsg,
            });
            setConfirmingBooking(false);
            // If Stripe confirmed the payment was never made, it’s not actually ambiguous.
            if (/requires_payment_method|requires_action/i.test(recoveryMsg)) {
              isAmbiguousResult = false;
            }
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
            : "Payment failed. Try again."
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
          <ScrollView style={styles.flex} contentContainerStyle={styles.skeletonScroll} scrollEnabled={false}>
            {/* Listing summary card skeleton */}
            <View style={styles.skeletonCard}>
              <SkeletonBlock width={56} height={56} borderRadius={12} pulse={skeletonPulse} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBlock width="80%" height={16} pulse={skeletonPulse} />
                <SkeletonBlock width="55%" height={12} pulse={skeletonPulse} />
              </View>
            </View>
            {/* Date section skeleton */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={100} height={14} borderRadius={6} pulse={skeletonPulse} />
              <View style={styles.skeletonPickerRow}>
                <SkeletonBlock height={56} borderRadius={14} pulse={skeletonPulse} style={{ flex: 1 }} />
                <SkeletonBlock width={24} height={24} borderRadius={6} pulse={skeletonPulse} />
                <SkeletonBlock height={56} borderRadius={14} pulse={skeletonPulse} style={{ flex: 1 }} />
              </View>
            </View>
            {/* Price section skeleton */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={80} height={14} borderRadius={6} pulse={skeletonPulse} />
              <SkeletonBlock height={80} borderRadius={14} pulse={skeletonPulse} style={{ marginTop: 10 }} />
            </View>
            {/* Vehicle section skeleton */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={90} height={14} borderRadius={6} pulse={skeletonPulse} />
              <SkeletonBlock height={56} borderRadius={14} pulse={skeletonPulse} style={{ marginTop: 10 }} />
            </View>
          </ScrollView>
        ) : !user ? (
          <View style={styles.centered}>
            <Text style={styles.centeredTitle}>Sign in to continue</Text>
            <Text style={styles.centeredSubtitle}>Log in or create an account to confirm your booking.</Text>
            <View style={styles.authButtons}>
              <Button style={styles.authButton} onPress={() => navigation.navigate("SignIn", { returnTo: { screen: "BookingSummary" as const, params: route.params } })} title="Sign in" />
              <Button variant="secondary" style={styles.authButton} onPress={() => navigation.navigate("Register", { returnTo: { screen: "BookingSummary" as const, params: route.params } })} title="Create account" />
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

            {/* ── Time ── */}
            <View style={styles.section}>
              <View style={styles.timeRow}>
                <TouchableOpacity style={styles.timeSlot} activeOpacity={0.7} onPress={() => openPicker("start")}>
                  <Text style={styles.timeSlotLabel}>ARRIVING</Text>
                  <Text style={styles.timeSlotTime}>{formatTimeLabel(start)}</Text>
                  <Text style={styles.timeSlotDate}>{formatDateLabel(start)}</Text>
                </TouchableOpacity>
                <View style={styles.timeArrow}>
                  <View style={styles.timeArrowLine} />
                  <Text style={styles.timeArrowDuration}>{priceSummary?.durationLabel ?? ""}</Text>
                  <View style={styles.timeArrowLine} />
                </View>
                <TouchableOpacity style={styles.timeSlot} activeOpacity={0.7} onPress={() => openPicker("end")}>
                  <Text style={styles.timeSlotLabel}>LEAVING</Text>
                  <Text style={styles.timeSlotTime}>{formatTimeLabel(end)}</Text>
                  <Text style={styles.timeSlotDate}>{formatDateLabel(end)}</Text>
                </TouchableOpacity>
              </View>
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
                  <Text style={styles.priceRowLabel}>Duration</Text>
                  <Text style={styles.priceRowValue}>{priceSummary?.durationLabel ?? ""}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder]}>
                  <Text style={styles.priceRowLabel}>Service fee (8%)</Text>
                  <Text style={styles.priceRowValue}>€{pricing.serviceFee.toFixed(2)}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder, styles.priceTotalRow]}>
                  <Text style={styles.priceTotalLabel}>Total</Text>
                  <Text style={styles.priceTotalValue}>€{pricing.finalPrice.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* ── Vehicle ── */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View>
                  {vehicleMake ? (
                    <View style={styles.vehicleHeaderRow}>
                      <VehicleBrandLogo make={vehicleMake} size={40} />
                      <Text style={styles.vehicleHeaderText}>
                        {[vehicleMake, vehicleColor, user?.vehicleType].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.sectionTitle}>Vehicle</Text>
                  )}
                </View>
                <Pressable style={styles.editBtn} onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}>
                  <Text style={styles.editBtnText}>{vehicleMake ? "Edit" : "Add"}</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.plate}
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

            {/* ── Payment ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.trustCard}>
                <View style={styles.trustCardTop}>
                  <View style={styles.trustShieldWrap}>
                    <Ionicons name="shield-checkmark" size={22} color={GREEN} />
                  </View>
                  <View style={styles.trustCardCopy}>
                    <Text style={styles.trustCardTitle}>Secure checkout</Text>
                    <Text style={styles.trustCardSub}>256-bit encryption · PCI DSS compliant</Text>
                  </View>
                </View>
                <View style={styles.trustDivider} />
                <View style={styles.methodsRow}>
                  {/* Apple Pay / Google Pay */}
                  <View style={styles.methodPill}>
                    <Ionicons name={Platform.OS === "ios" ? "logo-apple" : "logo-google"} size={13} color={FG} />
                    <Text style={styles.methodPillText}>{Platform.OS === "ios" ? "Pay" : "Pay"}</Text>
                  </View>

                  {/* Visa logo */}
                  <View style={[styles.methodPill, styles.visaPill]}>
                    <Text style={styles.visaText}>VISA</Text>
                  </View>

                  {/* Mastercard logo */}
                  <View style={[styles.methodPill, styles.mastercardPill]}>
                    <View style={styles.mcCircleWrap}>
                      <View style={[styles.mcCircle, { backgroundColor: "#EB001B" }]} />
                      <View style={[styles.mcCircle, { backgroundColor: "#F79E1B", marginLeft: -8 }]} />
                    </View>
                    <Text style={styles.mastercardText}>Mastercard</Text>
                  </View>
                </View>
                <View style={styles.stripeRow}>
                  <Ionicons name="lock-closed" size={10} color={SUBTLE} />
                  <Text style={styles.stripeText}>Powered by Stripe · trusted by millions of businesses</Text>
                </View>
              </View>
            </View>

            {/* ── Reassurance ── */}
            <View style={styles.reassuranceBlock}>
              <View style={styles.reassuranceRow}>
                <Ionicons name="refresh-outline" size={13} color={SUBTLE} />
                <Text style={styles.reassuranceText}>Free cancellation up to 2 hours before arrival</Text>
              </View>
              <Text style={styles.legalText}>By booking you agree to the FreeSpace terms and liability policy.</Text>
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
          <Pressable
            style={[styles.footerBtn, (bookingBusy || bookingConfirmed || requiresVehicleDetails) && styles.footerBtnDisabled]}
            onPress={handlePayment}
            disabled={bookingBusy || bookingConfirmed || requiresVehicleDetails}
          >
            {bookingBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.footerBtnText}>
                {confirmingBooking ? "Confirming…" : `Pay €${pricing.finalPrice.toFixed(2)}`}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal transparent animationType="none" visible={pickerOverlayVisible} onRequestClose={() => { setPickerVisible(false); setDraftDate(null); }}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pickerBackdropLayer, { opacity: pickerBackdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setPickerVisible(false); setDraftDate(null); }} />
          </Animated.View>
          <Animated.View style={[styles.pickerSheet, { paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: pickerSheetTranslateY }] }]}>
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
          </Animated.View>
        </View>
      </Modal>
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

const GREEN = "#0a8050";
const LINE  = "#d1d5db";
const FG    = "#111827";
const MUTED = "#374151";
const SUBTLE = "#6b7280";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonScroll: { padding: 20, gap: 0 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    marginBottom: 14,
  },
  skeletonSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    padding: 16,
    gap: 0,
    marginBottom: 14,
  },
  skeletonPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  // ── Nav header ──────────────────────────────────────────────
  header: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: "#ffffff",
  },
  backButton: { padding: 6, position: "absolute", left: 14 },
  headerTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG, textAlign: "center" },
  headerSpacer: { width: 34 },

  // ── Page header ─────────────────────────────────────────────
  // ── Listing card ─────────────────────────────────────────────
  listingCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  listingThumb: {
    width: 60, height: 60, borderRadius: 12,
    backgroundColor: "#f0f0ee", flexShrink: 0,
  },
  listingThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  listingCardText: { flex: 1 },
  listingCardTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15,
    color: FG, letterSpacing: -0.2, lineHeight: 20, marginBottom: 3,
  },
  listingCardAddress: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13,
    color: MUTED, lineHeight: 17,
  },

  pageHeader: {
    borderBottomWidth: 1, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    alignItems: "center",
  },
  pageLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: GREEN, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
    textAlign: "center",
  },
  pageTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 22,
    color: FG, letterSpacing: -0.5, lineHeight: 28, marginBottom: 2,
    textAlign: "center",
  },
  pageAddress: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, textAlign: "center" },

  // ── Sections ────────────────────────────────────────────────
  section: {
    borderBottomWidth: 1, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingVertical: 18,
  },
  sectionTitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
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

  // ── Session summary box ──────────────────────────────────────
  summaryBox: {
    borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
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
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3D6FB6",
    overflow: "hidden",
    backgroundColor: "#FAFAF8",
    alignItems: "center",
  },
  plateMt: { marginTop: 14 },
  plateEuBadge: {
    width: 34,
    alignSelf: "stretch",
    backgroundColor: "#3D6FB6",
  },
  plateBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  plateNumber: {
    fontFamily: "UKNumberPlate",
    fontSize: 24,
    color: "#111827",
    letterSpacing: 1,
    textTransform: "uppercase",
    includeFontPadding: false,
    textAlign: "center",
  },
  platePlaceholder: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: SUBTLE, letterSpacing: 0, textTransform: "none" },
  regHint: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: "#F59E0B", marginTop: 10, lineHeight: 18 },

  // ── Price rows ───────────────────────────────────────────────
  priceRows: { marginTop: 10 },
  priceRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11,
  },
  priceRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  priceTotalRow: { paddingTop: 13, marginTop: 2 },
  priceRowLabel: { fontFamily: "PlusJakartaSans-Medium", fontSize: 14, color: MUTED },
  priceRowValue: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG },
  priceRowMuted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: SUBTLE },
  priceTotalLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG },
  priceTotalValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: GREEN, letterSpacing: -0.4 },
  noHiddenFees: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE, marginTop: 8 },

  // ── Duration line ────────────────────────────────────────────
  durationLine: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: SUBTLE,
    marginTop: 10, lineHeight: 18,
  },

  // ── Payment row ──────────────────────────────────────────────
  paymentRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, backgroundColor: "#f0fdf8",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  paymentRowText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED,
    flex: 1, lineHeight: 18,
  },

  // ── Footer notes ─────────────────────────────────────────────
  footerNotes: { paddingHorizontal: 20, paddingVertical: 18, gap: 10 },
  footerNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  footerNoteIcon: { marginTop: 2 },
  footerNoteText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED,
    flex: 1, lineHeight: 19,
  },

  // ── Legal ────────────────────────────────────────────────────
  legalBlock: { paddingHorizontal: 20, paddingVertical: 16 },
  legalText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE, lineHeight: 18 },

  // ── Trust card ────────────────────────────────────────────────
  trustCard: {
    marginTop: 12,
    borderRadius: 14, borderWidth: 1, borderColor: LINE,
    backgroundColor: "#fafafa", overflow: "hidden",
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  trustCardTop: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  trustShieldWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#edf7f2",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  trustCardCopy: { flex: 1 },
  trustCardTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: FG, letterSpacing: -0.2,
  },
  trustCardSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: MUTED, marginTop: 2,
  },
  trustDivider: {
    height: 1, backgroundColor: LINE,
  },
  methodsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 7,
  },
  methodPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: LINE, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  methodPillText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG,
  },

  // Visa
  visaPill: { paddingHorizontal: 10, paddingVertical: 7 },
  visaText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 13, color: "#1A1F71",
    fontStyle: "italic", letterSpacing: 0.5,
  },

  // Mastercard
  mastercardPill: { paddingHorizontal: 9, paddingVertical: 6 },
  mcCircleWrap: { flexDirection: "row", alignItems: "center" },
  mcCircle: { width: 16, height: 16, borderRadius: 8 },
  mastercardText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: "#252525", marginLeft: 5,
  },
  stripeRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  stripeText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE,
  },

  // ── Legacy payment styles (unused) ───────────────────────────
  paymentOptions: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden" },
  paymentOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "#ffffff" },
  paymentIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f5f5f4", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  paymentOptionText: { flex: 1, marginLeft: 12 },
  paymentOptionBorder: { borderTopWidth: 1, borderTopColor: LINE },
  paymentOptionLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG },
  paymentOptionSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: MUTED, marginTop: 1 },
  paymentBadge: { backgroundColor: "#f0fdf4", borderRadius: 6, borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 7, paddingVertical: 3 },
  paymentBadgeText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 10, color: GREEN, letterSpacing: 0.2 },

  // ── Time slot ────────────────────────────────────────────────
  timeRow: {
    flexDirection: "row", alignItems: "center", gap: 0,
  },
  timeSlot: {
    flex: 1, alignItems: "center", paddingVertical: 6,
  },
  timeSlotLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 10,
    color: GREEN, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
  },
  timeSlotTime: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 26,
    color: FG, letterSpacing: -0.8, lineHeight: 30,
  },
  timeSlotDate: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12,
    color: MUTED, marginTop: 2,
  },
  timeArrow: {
    alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8,
  },
  timeArrowLine: {
    width: 18, height: 1, backgroundColor: LINE,
  },
  timeArrowDuration: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: SUBTLE, letterSpacing: 0.2,
  },

  // ── Price total ──────────────────────────────────────────────
  priceTotalBlock: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  priceTotalBig: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 36,
    color: FG, letterSpacing: -1.2, lineHeight: 40,
  },
  priceTotalSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13,
    color: MUTED, marginTop: 4, lineHeight: 18,
  },

  // ── Vehicle header ───────────────────────────────────────────
  vehicleHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50,
  },
  vehicleHeaderText: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, lineHeight: 18, color: FG,
  },

  // ── Reassurance block ────────────────────────────────────────
  reassuranceBlock: {
    paddingHorizontal: 20, paddingVertical: 16, gap: 8,
  },
  reassuranceRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
  },
  reassuranceText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, flex: 1, lineHeight: 18,
  },

  // ── Sticky footer ───────────────────────────────────────────
  footerBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 20, paddingTop: 12,
    shadowColor: "#111111", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
  },
  footerPriceBlock: { flex: 1 },
  footerPriceMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE },
  footerPriceValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: FG, letterSpacing: -0.5 },
  footerBtn: {
    height: 54, width: "100%", borderRadius: 14,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#ffffff", letterSpacing: -0.3 },

  // ── Empty / auth states ─────────────────────────────────────
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  centeredTitle: { fontSize: 20, fontFamily: "PlusJakartaSans-Bold", color: FG, textAlign: "center" },
  centeredSubtitle: { fontSize: 15, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8, textAlign: "center" },
  muted: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8 },
  authButtons: { marginTop: 16, width: "100%", maxWidth: 320, gap: 10 },
  authButton: { width: "100%" },

  // ── Date picker modal ───────────────────────────────────────
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  pickerBackdropLayer: { backgroundColor: "rgba(0,0,0,0.45)" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 36, alignItems: "center", paddingTop: 12,
    position: "absolute", bottom: 0, left: 0, right: 0,
  },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", marginBottom: 12 },
  pickerTitle: { fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: FG, marginBottom: 4, textAlign: "center" },
  pickerDoneBtn: {
    alignSelf: "stretch", marginHorizontal: 20, marginTop: 16,
    backgroundColor: GREEN, borderRadius: 14, minHeight: 54, alignItems: "center", justifyContent: "center",
  },
  pickerDoneBtnText: { fontSize: 17, fontFamily: "PlusJakartaSans-Bold", color: "#ffffff", letterSpacing: -0.2 },

  // ── Overlay ─────────────────────────────────────────────────
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
});
