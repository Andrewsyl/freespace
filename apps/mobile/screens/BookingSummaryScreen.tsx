import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { SquircleBtn } from "../components/SquircleBtn";
import { ModernTimePickerSheet, addMinutes, roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import { ArrowLeft, CircleX, Info, Lock, RefreshCw, ShieldCheck } from "lucide-react-native";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
  validatePromoCode,
  type PromoValidation,
} from "../api";
import { useAuth } from "../auth";
import { googlePayConfig } from "../utils/googlePay";
import { logError, logInfo, logWarn } from "../logger";
import { useGlobalLoading } from "../components/GlobalLoading";
import { useToastOnMessage } from "../components/GlobalToast";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button, SkeletonBlock, usePulse } from "../components/ui";
import { isMobileE2EActive } from "../e2e/testMode";
import { trackEvent } from "../analytics";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatDateTimeLabel, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal, formatListingPriceLine } from "../utils/pricing";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

function AppleLogo({ size = 14, color = "#101414" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.37 1.43c0 1.14-.44 2.17-1.16 2.97-.74.82-1.95 1.45-3.02 1.36-.14-1.1.42-2.25 1.08-2.97.72-.8 1.98-1.4 3.1-1.36ZM20.74 17.38c-.52 1.2-.77 1.74-1.44 2.8-.94 1.42-2.26 3.2-3.9 3.22-1.46.02-1.84-.95-3.82-.94-1.98.01-2.4.97-3.86.95-1.64-.02-2.9-1.62-3.84-3.05-2.64-4.02-2.92-8.74-1.29-11.25 1.16-1.78 2.98-2.82 4.7-2.82 1.76 0 2.87.97 4.33.97 1.42 0 2.28-.97 4.32-.97 1.54 0 3.18.84 4.34 2.28-3.82 2.1-3.2 7.55.46 8.81Z"
      />
    </Svg>
  );
}

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
  const bookingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [paymentRecoveryAction, setPaymentRecoveryAction] = useState<"retry" | "bookings" | "time" | null>(null);
  const [showServiceFeeInfo, setShowServiceFeeInfo] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);
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
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const { reset: resetGlobalLoading } = useGlobalLoading();

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(paymentFailureMessage, { variant: "danger" });

  const showPaymentRecovery = (
    message: string,
    action: "retry" | "bookings" | "time" | null = "retry"
  ) => {
    setPaymentFailureMessage(message);
    setPaymentRecoveryAction(action);
  };

  const clearPaymentRecovery = () => {
    setPaymentFailureMessage(null);
    setPaymentRecoveryAction(null);
  };

  const goToBookings = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Tabs",
            params: {
              screen: "History",
              params: {
                refreshToken: Date.now(),
                initialTab: "upcoming",
              },
            },
          },
        ],
      })
    );
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingListing(true);
      setError(null);
      try {
        const data = await getListing(id, {
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
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
  }, [endAt, id, startAt]);

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

  const start = useMemo(() => startAt, [startAt]);
  const end = useMemo(() => endAt, [endAt]);
  const priceSummary = useMemo(() => {
    if (!listing) return null;
    return calculateListingTotal(listing, start, end);
  }, [end, listing, start]);

  const pricing = useMemo(() => {
    // Same fee-inclusive quote the map, list and listing screens display —
    // the price must never change between search and checkout.
    const parkingFee = priceSummary?.total ?? 0;
    const serviceFee = priceSummary?.serviceFee ?? 0;
    const baseCents = priceSummary?.grossTotalCents ?? 0;
    // Same floor the API applies: Stripe can't charge less than €0.50.
    const discountCents = appliedPromo
      ? Math.min(appliedPromo.discountCents, Math.max(baseCents - 50, 0))
      : 0;
    const finalCents = baseCents - discountCents;
    return {
      parkingFee,
      serviceFee,
      discountCents,
      finalPrice: finalCents / 100,
      finalCents,
    };
  }, [priceSummary, appliedPromo]);

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code || !listing || !token || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const result = await validatePromoCode({
        code,
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        token,
      });
      setAppliedPromo(result);
      setPromoInput("");
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "That promo code isn't valid.");
    } finally {
      setPromoBusy(false);
    }
  }, [promoInput, listing, token, promoBusy, startAt, endAt]);

  // Booking times change the total, so an applied code has to be re-quoted
  // (percent discounts scale; minimum-spend rules may stop applying).
  const appliedCodeRef = useRef<string | null>(null);
  useEffect(() => {
    appliedCodeRef.current = appliedPromo?.code ?? null;
  }, [appliedPromo]);
  useEffect(() => {
    const code = appliedCodeRef.current;
    if (!code || !listing || !token) return;
    let active = true;
    validatePromoCode({
      code,
      listingId: listing.id,
      from: startAt.toISOString(),
      to: endAt.toISOString(),
      token,
    })
      .then((result) => {
        if (active) setAppliedPromo(result);
      })
      .catch((err) => {
        if (!active) return;
        setAppliedPromo(null);
        setPromoError(
          err instanceof Error ? err.message : "Promo code no longer applies to these times."
        );
      });
    return () => {
      active = false;
    };
  }, [startAt, endAt, listing, token]);

  const hasVehicleProfile =
    !!user?.vehicleMake?.trim() && !!user?.vehicleType?.trim();
  const hasVehiclePlate = vehiclePlate.trim().length > 0;
  const requiresVehicleDetails = !hasVehicleProfile || !hasVehiclePlate;
  const selectedTimeUnavailable = listing?.is_available === false;

  const applyPickedDate = useCallback((field: "start" | "end", next: Date) => {
    if (field === "start") {
      setStartAt(next);
      // Keep the chosen "until" time unless the new "from" passes it
      // (same behaviour as the search screen).
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
      }
      return;
    }
    // For the "until" picker: enforce at least 1 h after "from".
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
  }, [endAt, startAt]);

  const openPicker = useCallback((field: "start" | "end") => {
    setPickerField(field);
    setPickerVisible(true);
  }, []);

  const pickerMinimumDate = useMemo(
    () =>
      pickerField === "start"
        ? roundUpToMinuteInterval(new Date(), 5)
        : addMinutes(startAt, 60),
    [pickerField, startAt]
  );

  const pickerQuickOptions = useMemo(() => {
    if (pickerField === "end") {
      return [1, 2, 4, 8].map((hours) => ({
        label: `${hours}h`,
        value: addMinutes(startAt, hours * 60),
      }));
    }
    const now = roundUpToMinuteInterval(new Date(), 5);
    return [
      { label: "Now", value: now },
      { label: "+30m", value: addMinutes(now, 30) },
      { label: "+1h", value: addMinutes(now, 60) },
    ];
  }, [pickerField, startAt]);

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
      // Don't fail silently: the user expects start/end reminders for this
      // booking. Missing the end-time one can mean a fine, so offer Settings.
      Alert.alert(
        "Reminders are off",
        "Your booking is confirmed, but we can't remind you before it starts or ends. Enable notifications in Settings to get parking reminders.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }

    // All booking notifications — the "Booking confirmed" message plus the
    // start/end reminders — are sent server-side (sendBookingStatusPush +
    // scheduled_notifications/notification processor). That keeps a single
    // source of truth, avoids duplicate notifications, works cross-device, and
    // stays correct if the booking is extended or cancelled. We only ensure
    // notification permission here so those pushes can be shown.
  }, []);

  const handlePayment = async () => {
    if (!listing || !priceSummary || !token || bookingConfirmed) return;
    if (selectedTimeUnavailable) {
      showPaymentRecovery("That time is unavailable. Choose another arrival time.", "time");
      openPicker("start");
      return;
    }
    setBookingBusy(true);
    setError(null);
    clearPaymentRecovery();
    bookingTimeoutRef.current = setTimeout(() => {
      setBookingBusy(false);
      showPaymentRecovery(
        "Still checking this booking. Open My bookings before paying again.",
        "bookings"
      );
      bookingTimeoutRef.current = null;
    }, 45_000);
    let didConfirm = false;
    let paymentCompleted = false;
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
        promoCode: appliedPromo?.code ?? undefined,
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
        googlePay: googlePayConfig,
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
        showPaymentRecovery("Couldn’t start payment. Try again.", "retry");
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
            const initialTab =
              startAt.getTime() <= nowMs && nowMs < endAt.getTime()
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
          // User dismissed the payment sheet — not an error, so no user-facing
          // message, but it's the one abandonment point in the funnel with no
          // visibility otherwise (no error, no confirmation, silent return).
          void trackEvent("mobile_payment_sheet_abandoned", {
            listingId: listing.id,
            amountCents: pricing.finalCents,
          });
          return;
        }
        showPaymentRecovery(
          isAmbiguousResult
            ? "Still checking this booking. Open My bookings before paying again."
            : "Payment not completed. No booking was created.",
          isAmbiguousResult ? "bookings" : "retry"
        );
        return;
      }
      paymentCompleted = true;
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
      const initialTab =
        startAt.getTime() <= nowMs && nowMs < endAt.getTime()
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
        showPaymentRecovery(
          "That slot was just taken. Choose another time.",
          "time"
        );
        setError(null);
        return;
      }
      if (paymentCompleted) {
        // The payment sheet succeeded; only the confirmation call failed.
        // Send users to their bookings instead of asking them to pay again.
        showPaymentRecovery(
          "Payment received. We're still confirming your booking. Check My bookings now.",
          "bookings"
        );
        setError(null);
        return;
      }
      setError(message);
    } finally {
      if (bookingTimeoutRef.current) {
        clearTimeout(bookingTimeoutRef.current);
        bookingTimeoutRef.current = null;
      }
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
        <Pressable style={styles.backButton} onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.navTitle}>Confirm booking</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {loadingListing ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.skeletonContent} scrollEnabled={false}>
            <View style={[styles.card, { padding: 16, gap: 8 }]}>
              <SkeletonBlock width="45%" height={10} borderRadius={4} pulse={skeletonPulse} />
              <SkeletonBlock width="85%" height={20} borderRadius={6} pulse={skeletonPulse} />
              <SkeletonBlock width="65%" height={13} borderRadius={4} pulse={skeletonPulse} />
            </View>
            <View style={[styles.card, { overflow: "hidden" }]}>
              <SkeletonBlock width={90} height={13} borderRadius={5} pulse={skeletonPulse} style={{ margin: 16 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
                <SkeletonBlock height={60} borderRadius={10} pulse={skeletonPulse} style={{ flex: 1 }} />
                <SkeletonBlock width={20} height={20} borderRadius={4} pulse={skeletonPulse} />
                <SkeletonBlock height={60} borderRadius={10} pulse={skeletonPulse} style={{ flex: 1 }} />
              </View>
            </View>
            <View style={[styles.card, { overflow: "hidden" }]}>
              <SkeletonBlock width={110} height={13} borderRadius={5} pulse={skeletonPulse} style={{ margin: 16 }} />
              <SkeletonBlock height={80} borderRadius={0} pulse={skeletonPulse} />
            </View>
            <View style={[styles.card, { overflow: "hidden" }]}>
              <SkeletonBlock width={80} height={13} borderRadius={5} pulse={skeletonPulse} style={{ margin: 16 }} />
              <SkeletonBlock height={52} borderRadius={0} pulse={skeletonPulse} />
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
            contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Listing + When card ── */}
            <View style={styles.headerCard}>
              <View style={styles.headerCardTop}>
                <Text style={styles.headerKicker}>Confirm booking</Text>
                <Text style={styles.headerTitle}>{listing.title || "Parking space"}</Text>
                <Text style={styles.headerSubtitle}>{listing.address || ""}</Text>
              </View>
              <View style={styles.cardBody}>
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
                {selectedTimeUnavailable ? (
                  <Pressable style={styles.timeUnavailableCard} onPress={() => openPicker("start")}>
                    <CircleX size={16} color="#B42318" strokeWidth={2.2} />
                    <View style={styles.timeUnavailableCopy}>
                      <Text style={styles.timeUnavailableTitle}>This time is unavailable</Text>
                      <Text style={styles.timeUnavailableBody}>Choose another arrival time to continue.</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* ── Price card ── */}
            <View style={styles.card}>
              <Text style={styles.cardSectionHeader}>Price breakdown</Text>
              <View style={styles.priceRows}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceRowLabel}>Rate</Text>
                  <Text style={styles.priceRowValue}>{formatListingPriceLine(listing)}</Text>
                </View>
                <View style={[styles.priceRow, styles.priceRowBorder]}>
                  <Text style={styles.priceRowLabel}>Duration</Text>
                  <Text style={styles.priceRowValue}>{priceSummary?.durationLabel ?? ""}</Text>
                </View>
                {appliedPromo ? (
                  <View style={[styles.priceRow, styles.priceRowBorder]}>
                    <View style={styles.promoAppliedLabelWrap}>
                      <Text style={styles.priceRowLabel}>
                        {appliedPromo.code} ·{" "}
                        {appliedPromo.discountType === "percent"
                          ? `${appliedPromo.discountValue}% off`
                          : `€${(appliedPromo.discountValue / 100).toFixed(2)} off`}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove promo code"
                        hitSlop={8}
                        onPress={() => {
                          setAppliedPromo(null);
                          setPromoError(null);
                        }}
                      >
                        <CircleX size={16} color={SUBTLE} strokeWidth={2.1} />
                      </Pressable>
                    </View>
                    <Text style={styles.promoDiscountValue}>
                      −€{(pricing.discountCents / 100).toFixed(2)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.priceRow, styles.priceRowBorder, styles.priceTotalRow]}>
                  <Text style={styles.priceTotalLabel}>Total</Text>
                  <Text style={styles.priceTotalValue}>€{pricing.finalPrice.toFixed(2)}</Text>
                </View>
                {!appliedPromo ? (
                  <View style={styles.promoInputRow}>
                    <TextInput
                      style={styles.promoInput}
                      value={promoInput}
                      onChangeText={(value) => {
                        setPromoInput(value);
                        if (promoError) setPromoError(null);
                      }}
                      placeholder="Promo code"
                      placeholderTextColor={SUBTLE}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => void applyPromo()}
                      editable={!promoBusy}
                    />
                    <Pressable
                      accessibilityRole="button"
                      style={[
                        styles.promoApplyBtn,
                        (!promoInput.trim() || promoBusy) && styles.promoApplyBtnDisabled,
                      ]}
                      disabled={!promoInput.trim() || promoBusy}
                      onPress={() => void applyPromo()}
                    >
                      <Text style={styles.promoApplyText}>{promoBusy ? "…" : "Apply"}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {promoError ? <Text style={styles.promoErrorText}>{promoError}</Text> : null}
                <View style={styles.priceMetaRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Show service fee details"
                    hitSlop={8}
                    onPress={() => setShowServiceFeeInfo((current) => !current)}
                    style={styles.serviceFeeToggle}
                  >
                    <Info size={16} color={SUBTLE} strokeWidth={2.2} />
                    <Text style={styles.serviceFeeToggleText}>Includes service fee</Text>
                  </Pressable>
                </View>
                {showServiceFeeInfo ? (
                  <View style={styles.serviceFeeInfoCard}>
                    <Text style={styles.serviceFeeInfoText}>
                      Service fee included in total: €{pricing.serviceFee.toFixed(2)}. This helps
                      cover secure payments, support, and platform operations.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── Vehicle (flat) ── */}
            <View style={styles.vehicleSection}>
              <View style={styles.vehicleSectionHeader}>
                <Text style={styles.vehicleSectionLabel}>Vehicle</Text>
                <Pressable style={styles.editBtn} onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}>
                  <Text style={styles.editBtnText}>{vehicleMake ? "Edit" : "Add"}</Text>
                </Pressable>
              </View>
              <View style={styles.vehicleSectionBody}>
                {vehicleMake ? (
                  <View style={styles.vehicleHeaderRow}>
                    <VehicleBrandLogo make={vehicleMake} size={40} />
                    <View style={styles.vehicleHeaderInfo}>
                      <Text style={styles.vehicleHeaderText}>
                        {[vehicleMake, user?.vehicleType].filter(Boolean).join(" - ")}
                      </Text>
                      {vehicleColor ? (
                        <Text style={styles.vehicleSubText}>{vehicleColor}</Text>
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
            </View>

            {paymentFailureMessage ? (
              <View style={styles.recoveryCard}>
                <View style={styles.recoveryIconWrap}>
                  <Info size={18} color={GREEN} strokeWidth={2.2} />
                </View>
                <View style={styles.recoveryCopy}>
                  <Text style={styles.recoveryTitle}>
                    {paymentRecoveryAction === "bookings"
                      ? "Check booking status"
                      : paymentRecoveryAction === "time"
                        ? "Choose another time"
                        : "Payment needs attention"}
                  </Text>
                  <Text style={styles.recoveryBody}>{paymentFailureMessage}</Text>
                  <Pressable
                    style={styles.recoveryButton}
                    disabled={bookingBusy}
                    onPress={
                      paymentRecoveryAction === "bookings"
                        ? goToBookings
                        : paymentRecoveryAction === "time"
                          ? () => openPicker("start")
                          : handlePayment
                    }
                  >
                    <Text style={styles.recoveryButtonText}>
                      {paymentRecoveryAction === "bookings"
                        ? "Open My bookings"
                        : paymentRecoveryAction === "time"
                          ? "Change time"
                          : "Try payment again"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* ── Payment card ── */}
            <View style={styles.card}>
              <Text style={styles.cardSectionHeader}>Payment</Text>
              <View style={styles.cardBody}>
                <View style={styles.trustCardTop}>
                  <View style={styles.trustShieldWrap}>
                    <ShieldCheck size={22} color={GREEN} strokeWidth={2.1} />
                  </View>
                  <View style={styles.trustCardCopy}>
                    <Text style={styles.trustCardTitle}>Secure checkout</Text>
                    <Text style={styles.trustCardSub}>256-bit encryption · PCI DSS compliant</Text>
                  </View>
                </View>
                <View style={[styles.trustDivider, { marginVertical: 14 }]} />
                <View style={styles.methodsRow}>
                  <View style={styles.methodPill}>
                    {Platform.OS === "ios" ? (
                      <AppleLogo size={13} color={FG} />
                    ) : (
                      <Ionicons name="logo-google" size={13} color={GREEN} />
                    )}
                    <Text style={styles.methodPillText}>{Platform.OS === "ios" ? "Pay" : "Pay"}</Text>
                  </View>
                  <View style={[styles.methodPill, styles.visaPill]}>
                    <Text style={styles.visaText}>VISA</Text>
                  </View>
                  <View style={[styles.methodPill, styles.mastercardPill]}>
                    <View style={styles.mcCircleWrap}>
                      <View style={[styles.mcCircle, { backgroundColor: "#EB001B" }]} />
                      <View style={[styles.mcCircle, { backgroundColor: "#F79E1B", marginLeft: -8 }]} />
                    </View>
                    <Text style={styles.mastercardText}>Mastercard</Text>
                  </View>
                </View>
                <View style={[styles.stripeRow, { marginTop: 10 }]}>
                  <Lock size={10} color={SUBTLE} strokeWidth={2.2} />
                  <Text style={styles.stripeText}>Powered by Stripe · trusted by millions of businesses</Text>
                </View>
              </View>
            </View>

            {/* ── Reassurance ── */}
            <View style={styles.reassuranceBlock}>
              <View style={styles.reassuranceRow}>
                <RefreshCw size={13} color={SUBTLE} strokeWidth={2.2} />
                <Text style={styles.reassuranceText}>Free cancellation up to 2 hours before arrival</Text>
              </View>
              <Text style={styles.legalText}>
                By booking you agree to the FreeSpace{" "}
                <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
                  terms and liability policy
                </Text>
                .
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
          <SquircleBtn
            label={
              selectedTimeUnavailable
                ? "Choose another time"
                : confirmingBooking
                  ? "Confirming…"
                  : `Pay €${pricing.finalPrice.toFixed(2)}`
            }
            onPress={selectedTimeUnavailable ? () => openPicker("start") : handlePayment}
            disabled={bookingBusy || bookingConfirmed || (!selectedTimeUnavailable && requiresVehicleDetails)}
            loading={bookingBusy && !confirmingBooking}
            fullWidth
          />
        </View>
      ) : null}

      <ModernTimePickerSheet
        visible={pickerVisible}
        title={pickerField === "start" ? "Arrival time" : "Departure time"}
        subtitle={pickerField === "end" ? `Arriving ${formatTimeLabel(startAt)}` : "Pick a date, hour and minute."}
        value={pickerField === "start" ? start : end}
        minimumDate={pickerMinimumDate}
        minuteInterval={5}
        quickOptions={pickerQuickOptions}
        confirmLabel={pickerField === "start" ? "Use arrival" : "Use departure"}
        onCancel={() => setPickerVisible(false)}
        onConfirm={(next) => {
          applyPickedDate(pickerField, next);
          setPickerVisible(false);
        }}
      />
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

const GREEN  = "#0a8050";
const LINE   = "#E2DAD2";
const FG     = "#101414";
const MUTED  = "#465050";
const SUBTLE = "#6B7575";

const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonContent: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },

  // ── Nav header ──────────────────────────────────────────────
  header: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: "#F8FAFC",
  },
  backButton: { padding: 6, position: "absolute", left: 14 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG, textAlign: "center" },
  headerSpacer: { width: 34 },

  // ── Scroll content ───────────────────────────────────────────
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },

  // ── Header card (listing info) ───────────────────────────────
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E1E7ED",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 4,
    alignItems: "flex-start",
  },
  headerKicker: {
    color: GREEN,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  headerTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 26,
    textAlign: "left",
  },
  headerCardBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },

  // ── Cards ────────────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E1E7ED",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardSectionHeader: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 16,
    letterSpacing: -0.4,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  cardBody: { padding: 16 },

  // ── Vehicle flat section ──────────────────────────────────────
  vehicleSection: {
    paddingHorizontal: 4,
  },
  vehicleSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vehicleSectionLabel: {
    color: FG,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
  vehicleSectionBody: {
    gap: 0,
  },
  recoveryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#B8E4D0",
    backgroundColor: "#F0FAF6",
    padding: 14,
  },
  recoveryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recoveryCopy: {
    flex: 1,
    minWidth: 0,
  },
  recoveryTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  recoveryBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  recoveryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recoveryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#ffffff",
  },
  editBtn: {
    paddingVertical: 5, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: "#BEB7AF",
  },
  editBtnText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },

  // ── Time slot ────────────────────────────────────────────────
  timeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  timeSlot: { flex: 1, alignItems: "center", paddingVertical: 8 },
  timeSlotLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 10,
    color: GREEN, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5,
  },
  timeSlotTime: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 28,
    color: FG, letterSpacing: -0.8, lineHeight: 32,
  },
  timeSlotDate: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 2 },
  timeArrow: { alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  timeArrowLine: {
    width: 16, height: 1, backgroundColor: "#CBD5E1",
  },
  timeArrowDuration: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: SUBTLE, letterSpacing: 0.2,
  },
  timeUnavailableCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeUnavailableCopy: {
    flex: 1,
    minWidth: 0,
  },
  timeUnavailableTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: "#B42318",
    letterSpacing: -0.1,
  },
  timeUnavailableBody: {
    marginTop: 2,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },

  // ── Price rows ───────────────────────────────────────────────
  priceRows: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  priceRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14,
  },
  priceRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  priceTotalRow: { paddingTop: 14, marginTop: 2 },
  priceRowLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: SUBTLE, textTransform: "uppercase", letterSpacing: 0.8 },
  priceRowValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: FG },
  priceTotalLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: SUBTLE, textTransform: "uppercase", letterSpacing: 0.8 },
  priceTotalValue: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 26, color: GREEN, letterSpacing: -0.6 },
  priceMetaRow: { marginTop: 2, paddingBottom: 8 },
  serviceFeeToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 4,
  },
  serviceFeeToggleText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: SUBTLE,
  },
  serviceFeeInfoCard: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8D0C7",
    backgroundColor: "#F3EDE6",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serviceFeeInfoText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
  },
  promoAppliedLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promoDiscountValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    color: GREEN,
  },
  promoInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  promoInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#FBF8F4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
  },
  promoApplyBtn: {
    borderRadius: 14,
    backgroundColor: FG,
    minWidth: 74,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  promoApplyBtnDisabled: {
    opacity: 0.4,
  },
  promoApplyText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: "#fff",
  },
  promoErrorText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#C03A2B",
    marginBottom: 8,
  },

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

  // ── Vehicle header ───────────────────────────────────────────
  vehicleHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, marginBottom: 2,
  },
  vehicleHeaderInfo: {
    flexShrink: 1, gap: 2,
  },
  vehicleHeaderText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, lineHeight: 18, color: FG,
  },
  vehicleSubText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, lineHeight: 16, color: MUTED,
  },

  // ── Payment / trust ──────────────────────────────────────────
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
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, marginTop: 2,
  },
  trustDivider: {
    height: 1, backgroundColor: LINE, marginVertical: 8,
  },
  methodsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  methodPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: "#D5DCE3", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  methodPillText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: FG,
  },
  visaPill: { paddingHorizontal: 10, paddingVertical: 7 },
  visaText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 13, color: "#1A1F71",
    fontStyle: "italic", letterSpacing: 0.5,
  },
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

  // ── Reassurance block ────────────────────────────────────────
  reassuranceBlock: {
    paddingHorizontal: 12, paddingBottom: 6, gap: 8,
  },
  reassuranceRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
  },
  reassuranceText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, flex: 1, lineHeight: 18,
  },
  legalText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE, lineHeight: 18 },
  legalLink: { fontFamily: "PlusJakartaSans-SemiBold", color: "#0a8050" },

  // ── Sticky footer ───────────────────────────────────────────
  footerBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 16, paddingTop: 12,
    shadowColor: "#111111", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
  },

  // ── Empty / auth states ─────────────────────────────────────
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  centeredTitle: { fontSize: 22, fontFamily: "PlusJakartaSans-Bold", color: FG, textAlign: "center", letterSpacing: -0.3 },
  centeredSubtitle: { fontSize: 15, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8, textAlign: "center", lineHeight: 22 },
  muted: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: MUTED, marginTop: 8 },
  authButtons: { marginTop: 16, width: "100%", maxWidth: 320, gap: 12 },
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

  // ── Overlay ─────────────────────────────────────────────────
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
});
