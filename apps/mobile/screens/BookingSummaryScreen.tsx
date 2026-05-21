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
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import DatePicker from "../components/AdaptiveDatePicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, textStyles } from "../styles/theme";
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
import { BackButton, Button, SectionHeader } from "../components/ui";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import { calculateListingTotal } from "../utils/pricing";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

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
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
      }
      setStartAt(next);
      return;
    }
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

  const scheduleBookingConfirmationNotification = useCallback(async () => {
    if (!listing) return;
    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (!permissions.granted) {
      logWarn("Booking confirmation notification skipped: permission not granted");
      return;
    }
    const attachments = await getNotificationImageAttachment();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Booking confirmed",
        body: `${listing.title} · ${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
        data: {
          listingId: listing.id,
          type: "booking_confirmed",
          historyTab: start.getTime() <= Date.now() && Date.now() < end.getTime() ? "active" : "upcoming",
        },
        attachments,
      },
      trigger: null,
    });
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
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents: pricing.finalCents,
        vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
        token,
      });
      const paymentIntentId = payment.paymentIntentId ?? "";
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
            void scheduleBookingConfirmationNotification().catch((notificationError) => {
              logWarn("Immediate booking confirmation notification failed", {
                message: notificationError instanceof Error ? notificationError.message : String(notificationError),
              });
            });
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
      void scheduleBookingConfirmationNotification().catch((notificationError) => {
        logWarn("Immediate booking confirmation notification failed", {
          message: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      });
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
    <>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
      {loadingListing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#2ECC8F" />
          <Text style={styles.muted}>Loading booking…</Text>
        </View>
      ) : !user ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Sign in to continue</Text>
          <Text style={styles.subtitle}>Log in or create an account to confirm your booking.</Text>
          <View style={styles.authButtons}>
            <Button style={styles.authButton} onPress={() => navigation.navigate("SignIn")} title="Sign in" />
            <Button
              variant="secondary"
              style={styles.authButton}
              onPress={() => navigation.navigate("Register")}
              title="Create account"
            />
          </View>
        </View>
      ) : listing ? (
        <>
          <View style={styles.bookingTopBar}>
            <BackButton onPress={() => navigation.goBack()} style={styles.bookingTopBarBack} />
            <Text style={styles.bookingTopBarTitle}>Review booking</Text>
            <View style={styles.bookingTopBarSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.bookingPage}>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryHeaderContent}>
                      <Text style={styles.listingTitle}>{listing.title || "Adam House Car Park"}</Text>
                      <Text style={styles.addressText}>
                        {listing.address || "24 Adam Street, Dublin"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryMetricsWrap}>
                    <View style={styles.summaryMetrics}>
                      <View style={styles.summaryMetricCell}>
                        <Text style={styles.summaryMetricLabel}>Duration</Text>
                        <Text style={styles.summaryMetricValue}>
                          {priceSummary?.durationLabel ?? "--"}
                        </Text>
                      </View>
                      <View style={styles.summaryMetricDivider} />
                      <View style={styles.summaryMetricCell}>
                        <Text style={styles.summaryMetricLabel}>Total</Text>
                        <Text style={styles.summaryMetricValue}>€{Math.round(pricing.finalPrice)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.bookingTimeCard}>
                    <View style={styles.bookingSectionHeaderRow}>
                      <Text style={styles.bookingSectionTitle}>Your times</Text>
                      <Pressable style={styles.bookingTimeEditButton} onPress={() => openPicker("start")}>
                        <Ionicons name="create-outline" size={16} color="#0F172A" />
                        <Text style={styles.bookingTimeEditText}>Edit</Text>
                      </Pressable>
                    </View>
                    <View style={styles.bookingRouteCard}>
                      <View style={styles.bookingRouteTrack}>
                        <View style={styles.bookingRouteDotStart} />
                        <View style={styles.bookingRouteLine} />
                        <View style={styles.bookingRouteDotEnd} />
                      </View>
                      <View style={styles.bookingRouteContent}>
                        <View style={styles.bookingRouteRow}>
                          <Text style={styles.bookingRouteValue}>{formatDateTimeLabel(start)}</Text>
                        </View>
                        <View style={styles.bookingRouteSpacer} />
                        <View style={styles.bookingRouteRow}>
                          <Text style={styles.bookingRouteValue}>{formatDateTimeLabel(end)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.sheetSectionStack}>
                  <View style={styles.regCard}>
                    {vehicleMake ? (
                      <View style={styles.vehicleLogoColumn}>
                        <VehicleBrandLogo make={vehicleMake} size={32} />
                      </View>
                    ) : null}
                    <View style={styles.vehicleContent}>
                      <SectionHeader
                        title="Vehicle"
                        subtitle={vehicleMake && vehicleColor ? `${vehicleMake} - ${vehicleColor}` : undefined}
                        trailing={
                          <Pressable
                            style={styles.vehicleEditButton}
                            onPress={() =>
                              navigation.navigate("VehicleType", {
                                returnTo: "BookingSummary",
                              })
                            }
                          >
                            <Ionicons
                              name={vehicleMake ? "create-outline" : "add"}
                              size={14}
                              color="#0F172A"
                            />
                            <Text style={styles.vehicleEditButtonText}>
                              {vehicleMake ? "Edit" : "Add"}
                            </Text>
                          </Pressable>
                        }
                        style={styles.vehicleSectionHeader}
                      />
                      <View style={styles.regRow}>
                        <View style={styles.plateCountry} />
                        <View style={styles.regDetails}>
                          <Pressable
                            style={styles.regFieldButton}
                            onPress={() =>
                              navigation.navigate("VehicleType", {
                                returnTo: "BookingSummary",
                                focusField: "plate",
                              })
                            }
                          >
                            <Text style={[styles.regInput, !hasVehiclePlate && styles.regPlaceholder]}>
                              {hasVehiclePlate ? vehiclePlate : "Enter reg plate"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                      {requiresVehicleDetails ? (
                        <Text style={styles.regHint}>
                          Add your vehicle details to continue with this booking.
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.priceCard}>
                    <SectionHeader title="Price" style={styles.priceHeader} />
                    <View style={styles.priceBreakdownRow}>
                      <Text style={styles.priceBreakdownLabel}>Parking fee</Text>
                      <Text style={styles.priceBreakdownValue}>€{Math.round(pricing.parkingFee)}</Text>
                    </View>
                    <View style={styles.priceBreakdownRow}>
                      <Text style={styles.priceBreakdownLabel}>Platform fee</Text>
                      <Text style={styles.priceBreakdownMuted}>Included</Text>
                    </View>
                    <View style={styles.priceBreakdownRowLast}>
                      <Text style={styles.priceBreakdownTotalLabel}>Total due today</Text>
                      <Text style={styles.priceBreakdownTotalValue}>€{Math.round(pricing.finalPrice)}</Text>
                    </View>
                  </View>
                </View>
            </View>
          </ScrollView>
        </>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.error}>Listing not found.</Text>
        </View>
      )}
      {listing && user ? (
        <View style={[styles.footerBar, { paddingBottom: 12 + insets.bottom }]}>
          <View style={styles.footerPriceBlock}>
            <Text style={styles.footerPriceLabel}>TOTAL</Text>
            <Text style={styles.footerPriceValue}>€{Math.round(pricing.finalPrice)}</Text>
            <Text style={styles.footerPriceMeta}>{priceSummary?.durationLabel ?? ""}</Text>
          </View>
          <Pressable
            style={[
              styles.footerButton,
              (bookingBusy || bookingConfirmed || requiresVehicleDetails) && styles.footerButtonDisabled,
            ]}
            onPress={handlePayment}
            disabled={bookingBusy || bookingConfirmed || requiresVehicleDetails}
          >
            <View style={styles.footerButtonPill}>
              {bookingBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.footerButtonText}>
                  {confirmingBooking ? "Finalizing..." : "Book Now"}
                </Text>
              )}
            </View>
          </Pressable>
        </View>
      ) : null}
      {pickerVisible ? (
        <Modal transparent animationType="fade" visible>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => {
              setPickerVisible(false);
              setDraftDate(null);
            }}
          >
            <Pressable style={styles.pickerSheet} onPress={() => undefined}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerField === "start" ? "Start" : "End"}
                </Text>
                <Pressable
                  style={styles.pickerDone}
                  onPress={() => {
                    setPickerVisible(false);
                    setDraftDate(null);
                  }}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DatePicker
                date={draftDate ?? (pickerField === "start" ? start : end)}
                mode="datetime"
                minuteInterval={30}
                onDateChange={(date) => {
                  setDraftDate(date);
                  applyPickedDate(date);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
      </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardAvoid: {
    flex: 1,
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CBD5E1",
  },
  heroPlaceholderText: {
    color: "#475569",
    fontFamily: "Inter-Medium",
  },
  bookingTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
  },
  bookingTopBarBack: {
    marginBottom: 0,
  },
  bookingTopBarTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    lineHeight: 22,
    color: "#151b1b",
    letterSpacing: -0.35,
  },
  bookingTopBarSpacer: {
    width: 40,
  },
  bookingPage: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 6,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    width: 56,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  topTitle: {
    width: 120,
  },
  progressHeader: {
    display: "none",
  },
  progressBackButton: {
    position: "absolute",
    left: spacing.screenX,
    top: 10,
    zIndex: 2,
    marginBottom: 0,
  },
  scrollContent: {
    paddingBottom: 168,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardSectionLabel: {
    ...textStyles.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  listingTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.35,
    marginBottom: 4,
  },
  addressText: {
    color: "#6b747b",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  summaryThumb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E8EEF5",
  },
  summaryHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  summaryRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    flexWrap: "wrap",
  },
  summaryRatingText: {
    fontFamily: "Inter-Medium",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  summaryMetricsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  summaryMetrics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaeb",
    borderRadius: 12,
    paddingVertical: 8,
  },
  summaryMetricCell: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 10,
  },
  summaryMetricLabel: {
    color: "#8b949b",
    fontSize: 9,
    lineHeight: 11,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  summaryMetricValue: {
    color: "#151b1b",
    fontSize: 16,
    lineHeight: 18,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  summaryMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#eceff1",
  },
  bookingTimeCard: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  bookingSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bookingSectionTitle: {
    color: "#151b1b",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.25,
  },
  bookingRouteCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e8eaeb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  bookingRouteTrack: {
    alignItems: "center",
    width: 18,
    paddingTop: 4,
  },
  bookingRouteDotStart: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#45C36F",
    borderWidth: 4,
    borderColor: "#DDF7E7",
  },
  bookingRouteLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "#45C36F",
    marginVertical: 3,
  },
  bookingRouteDotEnd: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#45C36F",
  },
  bookingRouteContent: {
    flex: 1,
    gap: 0,
  },
  bookingRouteRow: {
    minHeight: 28,
    justifyContent: "center",
  },
  bookingRouteSpacer: {
    height: 12,
  },
  bookingRouteValue: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    lineHeight: 19,
    color: "#1f2a2a",
  },
  bookingTimeEditButton: {
    alignSelf: "center",
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e4e5",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  bookingTimeEditText: {
    color: "#4f5b5a",
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLabel: {
    ...textStyles.body,
    fontSize: 15,
  },
  rowValue: {
    ...textStyles.bodyStrong,
    fontSize: 15,
  },
  rowSubtext: {
    marginTop: 8,
    ...textStyles.meta,
    lineHeight: 18,
  },
  totalDue: {
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalDueLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter-SemiBold",
    color: "#6B7280",
  },
  totalDueValue: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    color: colors.text,
    letterSpacing: -0.3,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  breakdownLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  breakdownValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter-SemiBold",
  },
  trustRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter-Medium",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  regCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 0,
    flexDirection: "row",
    overflow: "hidden",
    paddingVertical: 10,
  },
  vehicleLogoColumn: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f8f8",
    borderRightWidth: 1,
    borderRightColor: "#e8eaeb",
  },
  vehicleContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },
  vehicleSectionHeader: {
    marginBottom: 8,
  },
  vehicleTypeText: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  vehicleEditButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e0e4e5",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  vehicleEditButtonText: {
    color: "#4f5b5a",
    fontFamily: "Inter-SemiBold",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 16,
  },
  regInputContainer: {
    marginBottom: 0,
    flex: 1,
  },
  priceHeader: {
    marginBottom: 8,
  },
  priceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 0,
  },
  priceBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eceff1",
  },
  priceBreakdownRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },
  priceBreakdownLabel: {
    color: "#6b747b",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  priceBreakdownValue: {
    color: "#151b1b",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  priceBreakdownMuted: {
    color: "#6b747b",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  priceBreakdownTotalLabel: {
    color: "#151b1b",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  priceBreakdownTotalValue: {
    color: "#151b1b",
    fontSize: 24,
    lineHeight: 26,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  regRow: {
    flexDirection: "row",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3D6FB6",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  regDetails: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  regFieldButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  plateCountry: {
    width: 34,
    alignSelf: "stretch",
    backgroundColor: "#3D6FB6",
    alignItems: "center",
    justifyContent: "center",
  },
  regPlaceholder: {
    ...textStyles.bodyMedium,
    color: colors.textSoft,
    letterSpacing: 0.1,
  },
  regInput: {
    color: colors.text,
    fontSize: 24,
    fontFamily: "UKNumberPlate",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 0,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  regHint: {
    ...textStyles.meta,
    color: colors.textSoft,
    marginTop: 4,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    ...textStyles.title,
  },
  subtitle: {
    ...textStyles.subtitle,
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  muted: {
    ...textStyles.meta,
    marginTop: 8,
  },
  noticeCard: {
    backgroundColor: "#fff4f1",
    borderColor: "#f6c7ba",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  noticeTitle: {
    ...textStyles.bodyStrong,
  },
  noticeText: {
    ...textStyles.meta,
    marginTop: 6,
    lineHeight: 18,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    ...textStyles.sectionTitle,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  footerPriceBlock: {
    flex: 1,
    paddingRight: 16,
  },
  footerPriceLabel: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    lineHeight: 18,
    color: "#7a8288",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  footerPriceValue: {
    fontFamily: "Inter-Bold",
    fontSize: 25,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
    letterSpacing: -0.8,
  },
  footerPriceMeta: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#98a4ab",
    fontWeight: "400",
    marginTop: 2,
  },
  sheetSectionStack: {
    gap: 8,
  },
  footerButton: {
    marginBottom: 0,
    minWidth: 178,
  },
  footerButtonDisabled: {
    opacity: 0.55,
  },
  footerButtonPill: {
    minHeight: 50,
    minWidth: 172,
    borderRadius: 12,
    backgroundColor: '#2ECC8F',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  footerButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  successTitle: {
    ...textStyles.titleSmall,
    fontSize: 18,
    textAlign: "center",
  },
  successBody: {
    ...textStyles.bodyMedium,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  authButtons: {
    marginTop: 16,
    width: "100%",
    maxWidth: 320,
    gap: 10,
  },
  authButton: {
    width: "100%",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
