import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import { ModernTimePickerSheet, addMinutes, roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import {
  ArrowLeft,
  CarFront,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Info,
  MapPin,
  Plus,
  ShieldCheck,
} from "lucide-react-native";
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
import { PaymentBrandMark, platformWallet } from "../components/PaymentBrandMark";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button, SkeletonBlock, usePulse } from "../components/ui";
import { colors, displayScale, radius, scaleDisplay } from "../styles/theme";
import { isMobileE2EActive } from "../e2e/testMode";
import { trackEvent } from "../analytics";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import {
  calculateListingTotal,
  calculateMonthlyTotal,
  formatPriceValue,
} from "../utils/pricing";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

export function BookingSummaryScreen({ navigation, route }: Props) {
  const { id, from, to, mode } = route.params;
  // A one-off single-month booking (from → from+1 month) priced off the host's
  // monthly rate. The term is fixed here — the start date is chosen on the
  // listing screen — so we skip the hourly arrival/departure pickers and promo.
  const isMonthly = mode === "monthly";
  // Measured rather than guessed: the dock's height moves with the brand-mark
  // row and the home-indicator inset, and the old hardcoded 140 over-padded it
  // by ~30px, leaving dead space under the last card.
  const [footerHeight, setFooterHeight] = useState(0);
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  // Clears the dock plus a small gap; falls back to an estimate for the first
  // frame, before onLayout has reported.
  const footerSpacer = (footerHeight || 110 + insets.bottom) + 16;
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
  const [promoExpanded, setPromoExpanded] = useState(false);
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
    if (isMonthly) return calculateMonthlyTotal(Number(listing.price_per_month ?? 0));
    return calculateListingTotal(listing, start, end);
  }, [end, listing, start, isMonthly]);

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

  const whenLine = useMemo(
    () =>
      isMonthly
        ? `${formatDateLabel(start)} – ${formatDateLabel(end)}`
        : `${formatDateLabel(start)} · ${formatTimeLabel(start)} – ${formatTimeLabel(end)}`,
    [isMonthly, start, end]
  );

  // "{street}, {area}" — drops the Eircode, the country and the house number,
  // and shortens "Dublin 8" to "D8". The exact address is only shared after
  // booking, so this is deliberately street-level.
  const addressLine = useMemo(() => {
    const parts = (listing?.address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const isEircode = (value: string) => /^[A-Z]\d{2}\s*[A-Z0-9]{4}$/i.test(value);
    const isCountry = (value: string) => /^ireland$/i.test(value);
    const trimmed = parts
      .filter((part) => !isEircode(part) && !isCountry(part))
      .map((part) =>
        part.replace(/^Dublin\s*(\d+)$/i, (_, n) => `D${n}`).replace(/^Co\.?\s+/i, "")
      );
    if (!trimmed.length) return "";
    const street = trimmed[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    const area = trimmed[trimmed.length - 1];
    return street === area ? street : `${street}, ${area}`;
  }, [listing?.address]);

  // "Volkswagen Estate · Silver" — one line, because the plate below it is the
  // detail that actually gets checked.
  const vehicleLine = useMemo(() => {
    const model = [vehicleMake, user?.vehicleType].filter(Boolean).join(" ");
    return [model, vehicleColor].filter(Boolean).join(" · ");
  }, [vehicleMake, user?.vehicleType, vehicleColor]);

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
      if (isMonthly) {
        // The month term is set on the listing screen — send them back to pick
        // a different start date rather than opening an hourly time picker.
        showPaymentRecovery("This space is fully booked for that month. Pick another start date.", "bookings");
        return;
      }
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
        mode: isMonthly ? "monthly" : undefined,
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

  const ctaLabel = selectedTimeUnavailable
    ? isMonthly
      ? "Choose another date"
      : "Choose another time"
    : confirmingBooking
      ? "Confirming…"
      : "Confirm and pay";
  const ctaDisabled =
    bookingBusy || bookingConfirmed || (!selectedTimeUnavailable && requiresVehicleDetails);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {/* The skeleton mirrors the real layout — masthead, then the ground's
            headers and tiles. No spinner, no invented delay. */}
        {loadingListing ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.skeletonContent} scrollEnabled={false}>
            <SkeletonBlock width={36} height={36} borderRadius={18} pulse={skeletonPulse} />
            <SkeletonBlock width="55%" height={28} borderRadius={8} pulse={skeletonPulse} style={{ marginTop: 14 }} />
            <SkeletonBlock width="70%" height={14} borderRadius={5} pulse={skeletonPulse} style={{ marginTop: 8 }} />
            {[0, 1, 2].map((row) => (
              <SkeletonBlock
                key={row}
                height={44}
                borderRadius={6}
                pulse={skeletonPulse}
                style={{ marginTop: 16 }}
              />
            ))}
          </ScrollView>
        ) : !user ? (
          <View style={styles.centered}>
            <Text style={styles.centeredTitle}>Sign in to continue</Text>
            <Text style={styles.centeredSubtitle}>Log in or create an account to confirm your booking.</Text>
            <View style={styles.authButtons}>
              <Button style={styles.authButton} onPress={() => navigation.navigate("Auth", { screen: "SignIn", params: { returnTo: { screen: "BookingSummary" as const, params: route.params } } })} title="Sign in" />
              <Button variant="secondary" style={styles.authButton} onPress={() => navigation.navigate("Auth", { screen: "Register", params: { returnTo: { screen: "BookingSummary" as const, params: route.params } } })} title="Create account" />
            </View>
          </View>
        ) : listing ? (
          <ScrollView
            // Ground-coloured so the bottom spacer continues the tint rather
            // than exposing the container's white between the last card and
            // the dock.
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: footerSpacer }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── White masthead sheet ── */}
            <View style={styles.masthead}>
              <Pressable
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}
              >
                <ArrowLeft size={18} color={FG} strokeWidth={2.3} />
              </Pressable>

              <View style={styles.mastheadCopy}>
                <Text style={styles.pageTitle}>Your booking</Text>
              </View>
            </View>

            {/* Where you're parking sits directly under the title — it's the
                thing being booked, so it reads before the details of it. */}
            <View style={styles.sheetBlock}>
              <View style={styles.factRow}>
                <View style={styles.factIcon}>
                  <MapPin size={18} color={MUTED} strokeWidth={1.9} />
                </View>
                <View style={styles.factBody}>
                  <Text style={styles.spaceName}>{listing.title || "Parking space"}</Text>
                  {addressLine ? (
                    <Text style={styles.spaceAddress}>{addressLine}</Text>
                  ) : null}
                  <Text style={styles.factMeta}>Exact address and gate code sent on booking</Text>
                </View>
              </View>
            </View>

            {/* ── Ground: titled sections from here down ── */}
            <View style={styles.ground}>
              <Text style={styles.groundHeader}>When</Text>

              {/* Arriving / leaving read as two editable fields side by side —
                  the pair is what people re-check before paying, so each gets
                  its own tap target instead of one combined date line. Monthly
                  has no leaving time to show, so it keeps the single row. */}
              {isMonthly ? (
                <View style={styles.monthlyCard}>
                  <Clock size={18} color={MUTED} strokeWidth={1.9} />
                  <View style={styles.factBody}>
                    <Text style={styles.factTitle}>{whenLine}</Text>
                    <Text style={styles.factMeta}>1 month · reserved instantly</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.whenCard}>
                  <View style={styles.whenCols}>
                    <Pressable style={styles.whenCol} onPress={() => openPicker("start")}>
                      {/* Filled dot for arrival, hollow for departure — the pair
                          reads as a journey between two points, matching the
                          listing screen's picker. */}
                      <View style={styles.whenLabelRow}>
                        <View style={styles.whenDotFilled} />
                        <Text style={styles.whenLabel}>ARRIVING</Text>
                      </View>
                      <View style={styles.whenValueRow}>
                        <Text style={styles.whenTime}>{formatTimeLabel(start)}</Text>
                        <ChevronDown size={14} color={SUBTLE} strokeWidth={2.6} />
                      </View>
                      <Text style={styles.whenDay}>{formatDateLabel(start)}</Text>
                    </Pressable>
                    <View style={styles.whenColDivider} />
                    <Pressable style={styles.whenCol} onPress={() => openPicker("end")}>
                      <View style={styles.whenLabelRow}>
                        <View style={styles.whenDotHollow} />
                        <Text style={styles.whenLabel}>LEAVING</Text>
                      </View>
                      <View style={styles.whenValueRow}>
                        <Text style={styles.whenTime}>{formatTimeLabel(end)}</Text>
                        <ChevronDown size={14} color={SUBTLE} strokeWidth={2.6} />
                      </View>
                      <Text style={styles.whenDay}>{formatDateLabel(end)}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.whenFooter}>
                    <Clock size={15} color={MUTED} strokeWidth={1.9} />
                    <Text style={styles.whenDuration}>{priceSummary?.durationLabel ?? ""}</Text>
                    <Text style={styles.whenInstant}>Reserved instantly</Text>
                  </View>
                </View>
              )}

              {/* Section title carries the action, so the card below holds only
                  the vehicle itself. */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.groundHeaderFlush}>Vehicle</Text>
                <Pressable
                  onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}
                >
                  <Text style={styles.factAction}>{vehicleMake ? "Change" : "Add"}</Text>
                </Pressable>
              </View>

              <View style={styles.vehicleCard}>
                {/* One line: the car is a single fact, so make, body style and
                    colour run together rather than stacking a title over a meta
                    row. The plate underneath is what carries the weight. */}
                <Pressable
                  style={styles.vehicleRow}
                  onPress={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}
                >
                  {vehicleMake ? (
                    <VehicleBrandLogo make={vehicleMake} size={26} />
                  ) : (
                    <CarFront size={22} color={MUTED} strokeWidth={1.9} />
                  )}
                  <Text style={styles.vehicleName} numberOfLines={1}>
                    {vehicleLine || "Add your vehicle"}
                  </Text>
                </Pressable>

                {/* The plate is the one detail a host checks at the barrier, so
                    it renders as a real Irish plate rather than another text
                    row. Tapping it jumps straight to the plate field, not the
                    top of the vehicle form. */}
                <Pressable
                  style={styles.plate}
                  onPress={() =>
                    navigation.navigate("VehicleType", { returnTo: "BookingSummary", focusField: "plate" })
                  }
                >
                  <View style={styles.plateEuBadge}>
                    <Text style={styles.plateEuText}>IRL</Text>
                  </View>
                  <View style={styles.plateBody}>
                    <Text style={[styles.plateNumber, !hasVehiclePlate && styles.platePlaceholder]}>
                      {hasVehiclePlate ? vehiclePlate.toUpperCase() : "Enter reg plate"}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {requiresVehicleDetails ? (
                <Text style={styles.regHint}>Add your vehicle details to continue.</Text>
              ) : null}

              {selectedTimeUnavailable ? (
                <Pressable
                  style={styles.noticeCard}
                  onPress={isMonthly ? () => goBackOrFallback(navigation, fallbackRoutes.search) : () => openPicker("start")}
                >
                  <CircleX size={16} color={colors.danger} strokeWidth={2.2} />
                  <View style={styles.noticeCopy}>
                    <Text style={styles.noticeTitle}>
                      {isMonthly ? "Fully booked that month" : "This time is unavailable"}
                    </Text>
                    <Text style={styles.noticeBody}>
                      {isMonthly ? "Pick another start date to continue." : "Choose another arrival time to continue."}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

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

              {/* ── Payment details ── */}
              <Text style={styles.groundHeader}>Payment details</Text>
              <View style={styles.tile}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    {`Parking · ${isMonthly ? "1 month" : priceSummary?.durationLabel ?? ""}`}
                  </Text>
                  <Text style={styles.priceValueStrong}>
                    €{formatPriceValue(priceSummary?.grossTotal ?? 0)}
                  </Text>
                </View>

                <Pressable
                  style={styles.priceRow}
                  accessibilityRole="button"
                  accessibilityLabel="Show service fee details"
                  onPress={() => setShowServiceFeeInfo((current) => !current)}
                >
                  <Text style={styles.priceLabel}>Service fee</Text>
                  <Text style={styles.priceValueStrong}>Included</Text>
                </Pressable>
                {showServiceFeeInfo ? (
                  <Text style={styles.serviceFeeInfoText}>
                    {`Service fee included in total: €${pricing.serviceFee.toFixed(2)}. This helps cover secure payments, support, and platform operations.`}
                  </Text>
                ) : null}

                {!isMonthly ? (
                  appliedPromo ? (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel} numberOfLines={1}>
                        {`${appliedPromo.code} · ${
                          appliedPromo.discountType === "percent"
                            ? `${appliedPromo.discountValue}% off`
                            : `€${(appliedPromo.discountValue / 100).toFixed(2)} off`
                        }`}
                      </Text>
                      <View style={styles.promoAppliedEnd}>
                        <Text style={styles.priceValueGreen}>
                          −€{(pricing.discountCents / 100).toFixed(2)}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove promo code"
                          hitSlop={8}
                          onPress={() => {
                            setAppliedPromo(null);
                            setPromoError(null);
                            setPromoExpanded(false);
                          }}
                        >
                          <CircleX size={15} color={SUBTLE} strokeWidth={2.1} />
                        </Pressable>
                      </View>
                    </View>
                  ) : promoExpanded ? (
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
                        autoFocus
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
                  ) : (
                    <Pressable
                      style={styles.priceRow}
                      accessibilityRole="button"
                      onPress={() => setPromoExpanded(true)}
                    >
                      <Text style={styles.priceLabel}>Promo code</Text>
                      <Text style={styles.priceValueGreen}>Add</Text>
                    </Pressable>
                  )
                ) : null}
                {!isMonthly && promoError ? (
                  <Text style={styles.promoErrorText}>{promoError}</Text>
                ) : null}

                <View style={styles.tileHairline} />
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  {/* Ink, not green: green on the total competes with the CTA
                      and reads as a discount. */}
                  <Text style={styles.totalValue}>€{pricing.finalPrice.toFixed(2)}</Text>
                </View>
              </View>

              {/* ── Pay with ── */}
              <Text style={styles.groundHeader}>Pay with</Text>
              {/* Stripe's Payment Sheet owns method entry and the saved-card
                  list, so there is nothing to list here yet — one row that opens
                  it, rather than a fake selected-card state. */}
              <View style={styles.tileFlush}>
                <Pressable
                  style={styles.methodRow}
                  accessibilityRole="button"
                  disabled={bookingBusy || bookingConfirmed}
                  onPress={handlePayment}
                >
                  <View style={styles.methodTile}>
                    <Plus size={14} color={FG} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.methodLabel}>Add a payment method</Text>
                  <ChevronRight size={16} color={colors.textDisabled} strokeWidth={2.4} />
                </Pressable>
              </View>

              {/* ── Trust + legal, straight on the ground ── */}
              <View style={styles.trustBlock}>
                <View style={styles.trustLine}>
                  <ShieldCheck size={15} color={GREEN} strokeWidth={2.1} />
                  <Text style={styles.trustText}>
                    Payments handled by Stripe. Free cancellation up to 2 hours before arrival.
                  </Text>
                </View>
                <Text style={styles.legalText}>
                  By confirming you agree to the FreeSpace{" "}
                  <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
                    terms and liability policy
                  </Text>
                  .
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Listing not found.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {listing && user ? (
        <View
          style={[styles.footerBar, { paddingBottom: 14 + insets.bottom }]}
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        >
          <Pressable
            accessibilityRole="button"
            // The amount is a separate Text for layout, so fold it into the
            // accessible name — otherwise the button announces as "Confirm and
            // pay" with no price attached.
            accessibilityLabel={
              selectedTimeUnavailable || confirmingBooking
                ? ctaLabel
                : `${ctaLabel} €${pricing.finalPrice.toFixed(2)}`
            }
            disabled={ctaDisabled}
            onPress={
              selectedTimeUnavailable
                ? isMonthly
                  ? () => goBackOrFallback(navigation, fallbackRoutes.search)
                  : () => openPicker("start")
                : handlePayment
            }
            style={({ pressed }) => [
              styles.ctaBar,
              ctaDisabled && styles.ctaBarDisabled,
              pressed && !ctaDisabled && styles.ctaBarPressed,
            ]}
          >
            {bookingBusy && !confirmingBooking ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                {!selectedTimeUnavailable && !confirmingBooking ? (
                  <Text style={styles.ctaAmount}>€{pricing.finalPrice.toFixed(2)}</Text>
                ) : null}
              </>
            )}
          </Pressable>
          <View style={styles.footerMarks}>
            {(["visa", "mastercard", platformWallet] as const).map((brand) => (
              <PaymentBrandMark key={brand} brand={brand} height={22} />
            ))}
            <Text style={styles.footerStripeText}>Powered by Stripe</Text>
          </View>
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

// Sourced from styles/theme.ts. CARD_SHADOW is gone: the sticky dock is the
// only elevated surface on this screen; everything else is a flat tile whose
// border does the separating.
const GREEN    = colors.primary;
const FG       = colors.text;
const MUTED    = colors.textMuted;
const SUBTLE   = colors.textSoft;
// #DDE2E2 per the funnel design: light enough to describe a tile edge without
// drawing a line around it. `colors.border` (#C7CFCF) reads as an outline here.
const EDGE     = colors.borderHairline;
const GROUND   = colors.ground;   // page tint + in-tile hairlines

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  flex: { flex: 1 },
  scrollBody: { flex: 1, backgroundColor: GROUND },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonContent: { paddingHorizontal: 16, paddingTop: 13 },

  // ── White masthead sheet ─────────────────────────────────────
  // Back button sits inline with the title rather than stacked above it, so the
  // header costs one row instead of three.
  masthead: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.appBg,
    paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 14,
    // 2a rules the title off from the location row below it (#C9D0D0 there;
    // colors.border is #C7CFCF, the same line to the eye).
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  mastheadCopy: { flex: 1, minWidth: 0 },
  // White panel; the ground below does the separating.
  sheetBlock: { backgroundColor: colors.appBg, paddingHorizontal: 16 },
  backButton: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: GROUND,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  pageTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDisplay(22), lineHeight: scaleDisplay(27),
    letterSpacing: -0.6 * displayScale, color: FG,
  },

  // ── Fact stack ───────────────────────────────────────────────
  // 2a: gap 12, 15 vertical padding, icon nudged 1 to sit on the first line.
  // flex-start rather than centre because this row stacks a name, an address
  // and a note — the icon aligns to the first line, not to the block.
  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 15 },
  factIcon: { flexShrink: 0, alignItems: "center", paddingTop: 1 },
  factBody: { flex: 1, minWidth: 0 },
  // The booking window is the fact people re-read most on this screen, so it
  // gets a step of its own above the rest of the stack.
  factTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18, lineHeight: 23, letterSpacing: -0.4, color: FG,
  },
  factText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: FG },
  // The space's own name leads; the street sits under it in grey, the way the
  // confirm screen presents it.
  spaceName: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18, lineHeight: 23, letterSpacing: -0.4, color: FG,
  },
  spaceAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14, lineHeight: 19, color: MUTED, marginTop: 2,
  },
  // 2a: 12px #7C8383, 2 under the line it qualifies.
  factMeta: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: SUBTLE, marginTop: 2,
  },
  factAction: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN,
    flexShrink: 0, paddingTop: 4,
  },

  // ── When: arriving / leaving ─────────────────────────────────
  // Same edge and radius as `tile` (payment details) — every card on the ground
  // shares one border treatment.
  whenCard: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 16, marginBottom: 20,
  },
  monthlyCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 20,
    padding: 14,
  },
  whenCols: { flexDirection: "row", alignItems: "stretch" },
  // 2a: 14 / 16 / 15.
  whenCol: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 15 },
  // Inset top and bottom rather than full height, so the rule separates the two
  // fields without touching the card's own edges.
  whenColDivider: { width: 1, backgroundColor: colors.divider, marginVertical: 16 },
  // 2a: 7px dots, filled for arrival and 1.5px-outlined for departure.
  whenLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  whenDotFilled: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  whenDotHollow: {
    width: 7, height: 7, borderRadius: 4,
    borderWidth: 1.5, borderColor: GREEN,
  },
  whenLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: GREEN,
  },
  whenValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 },
  // 2a: 27/29, 800, -1.1.
  whenTime: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27, lineHeight: 29, letterSpacing: -1.1, color: FG,
  },
  whenDay: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: SUBTLE, marginTop: 3 },
  whenFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.divider,
    backgroundColor: colors.groundSoft,
  },
  whenDuration: { flex: 1, fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: FG },
  whenInstant: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: SUBTLE },

  // ── Vehicle ──────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 10,
  },
  groundHeaderFlush: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20, letterSpacing: -0.6, color: FG,
  },
  // 2a gives the vehicle tile radius 8 — a notch tighter than the 12 used by
  // the section cards, so the plate inside it doesn't read as a card-in-a-card.
  vehicleCard: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 8,
    marginHorizontal: 16, marginBottom: 20,
    paddingHorizontal: 16, paddingTop: 14,
  },
  vehicleRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingBottom: 12,
  },
  vehicleName: {
    flex: 1, minWidth: 0,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14, lineHeight: 19, color: FG,
  },

  // ── Irish number plate ───────────────────────────────────────
  // #3D6FB6 is the EU plate band blue — a real-world constant rather than a
  // brand colour, so it stays literal instead of moving into the theme.
  plate: {
    flexDirection: "row",
    alignItems: "stretch",
    // 2a: 44 tall, 30 band, radius 6, 12 above.
    marginTop: 12,
    marginBottom: 14,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3D6FB6",
    overflow: "hidden",
    backgroundColor: colors.cardBg,
  },
  plateEuBadge: {
    width: 30,
    backgroundColor: "#3D6FB6",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  plateEuText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 9,
    lineHeight: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  plateBody: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // 2a renders 24/700 at 2px tracking. The design doc substitutes a monospace
  // fallback because UKNumberPlate isn't available in a browser — here the real
  // plate font is loaded, so it stays.
  plateNumber: {
    fontFamily: "UKNumberPlate",
    fontSize: 26,
    color: colors.text,
    letterSpacing: 2,
    textTransform: "uppercase",
    includeFontPadding: false,
    textAlign: "center",
  },
  platePlaceholder: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: SUBTLE,
    letterSpacing: 0,
    textTransform: "none",
  },

  // ── Ground ───────────────────────────────────────────────────
  // Hairline where the white blocks meet the tint, matching the listing page —
  // without it the two surfaces fade into each other.
  ground: {
    backgroundColor: GROUND, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: EDGE,
  },
  groundHeader: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20, letterSpacing: -0.6, color: FG,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  regHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: colors.warning,
    paddingHorizontal: 16, paddingBottom: 14,
  },

  // Tiles — sharper than the mock's 8: a 4px corner over a 1px `border` grey
  // reads crisp on the tint instead of soft.
  tile: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tileFlush: {
    backgroundColor: colors.appBg,
    borderWidth: 1, borderColor: EDGE, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 16,
    overflow: "hidden",
  },
  tileHairline: { height: 1, backgroundColor: GROUND, marginVertical: 6 },

  // ── Price rows ───────────────────────────────────────────────
  priceRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    gap: 12, paddingVertical: 6,
  },
  priceLabel: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, flexShrink: 1,
  },
  priceValueStrong: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  priceValueGreen: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN },
  promoAppliedEnd: { flexDirection: "row", alignItems: "center", gap: 8 },
  serviceFeeInfoText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, lineHeight: 17,
    color: MUTED, paddingBottom: 6,
  },
  totalLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: FG },
  totalValue: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20, letterSpacing: -0.5, color: FG,
  },

  // ── Promo ────────────────────────────────────────────────────
  promoInputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  promoInput: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1, borderColor: EDGE,
    backgroundColor: GROUND,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG,
  },
  promoApplyBtn: {
    borderRadius: 4, backgroundColor: FG,
    minWidth: 68, alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  promoApplyBtnDisabled: { opacity: 0.4 },
  promoApplyText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textInverse,
  },
  promoErrorText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: colors.danger, paddingBottom: 6,
  },

  // ── Pay with ─────────────────────────────────────────────────
  methodRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  methodTile: {
    width: 34, height: 22, borderRadius: 3,
    backgroundColor: GROUND,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  methodLabel: {
    flex: 1, minWidth: 0,
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: FG,
  },

  // ── Notices ──────────────────────────────────────────────────
  noticeCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 12, borderWidth: 1,
    borderColor: colors.status.canceled.border,
    backgroundColor: colors.status.canceled.background,
    padding: 12,
  },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 13, lineHeight: 18, color: colors.danger,
  },
  noticeBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 18,
    color: MUTED, marginTop: 2,
  },
  recoveryCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 12, borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    padding: 14,
  },
  recoveryIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  recoveryCopy: { flex: 1, minWidth: 0 },
  recoveryTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 13, lineHeight: 18, color: FG, marginBottom: 3,
  },
  recoveryBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 18, color: MUTED,
  },
  recoveryButton: {
    alignSelf: "flex-start", marginTop: 10,
    borderRadius: radius.pill, backgroundColor: GREEN,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  recoveryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: colors.textInverse,
  },

  // ── Trust + legal ────────────────────────────────────────────
  trustBlock: { paddingHorizontal: 16, paddingBottom: 20 },
  trustLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  trustText: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12, lineHeight: 17, color: MUTED,
  },
  legalText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 11, lineHeight: 16,
    color: SUBTLE, marginTop: 10,
  },
  legalLink: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // ── Sticky dock — the one elevated surface ───────────────────
  footerBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.appBg,
    borderTopWidth: 1, borderTopColor: colors.divider,
    paddingHorizontal: 16, paddingTop: 10,
    shadowColor: "#101414", shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06, shadowRadius: 18, elevation: 12,
  },
  ctaBar: {
    height: 50, borderRadius: 12,
    backgroundColor: GREEN,
    paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
  },
  ctaBarPressed: { backgroundColor: colors.brandDark },
  ctaBarDisabled: { backgroundColor: colors.border },
  ctaLabel: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15, letterSpacing: -0.2,
    color: colors.textInverse,
  },
  ctaAmount: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 15, letterSpacing: -0.3,
    color: colors.textInverse,
  },
  footerMarks: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 10,
  },
  footerStripeText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 11, color: SUBTLE,
  },

  // ── Empty / auth states ─────────────────────────────────────
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  centeredTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 20, lineHeight: 25,
    letterSpacing: -0.6, color: FG, textAlign: "center",
  },
  centeredSubtitle: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: MUTED, marginTop: 10, textAlign: "center",
  },
  muted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19, color: MUTED },
  authButtons: { marginTop: 16, width: "100%", maxWidth: 320, gap: 12 },
  authButton: { width: "100%" },

  // ── Overlay ─────────────────────────────────────────────────
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
});
