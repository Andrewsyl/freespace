import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
} from "../api";
import { useAuth } from "../auth";
import { logError, logInfo } from "../logger";
import { getNotificationImageAttachment } from "../notifications";
import { BookingProgressBar } from "../components/BookingProgressBar";
import { useGlobalLoading } from "../components/GlobalLoading";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { BackButton, Button, SectionHeader, TextInput as AppTextInput } from "../components/ui";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

function formatIrishPlateInput(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";

  const firstLetterIndex = compact.search(/[A-Z]/);
  if (firstLetterIndex === -1) {
    return compact.slice(0, 11);
  }

  const yearDigits = compact.slice(0, firstLetterIndex).replace(/\D/g, "");
  const year = yearDigits.slice(0, 3);
  const afterYear = compact.slice(firstLetterIndex);
  const county = (afterYear.match(/[A-Z]/g) ?? []).join("").slice(0, 2);
  const serial = afterYear.replace(/[A-Z]/g, "").replace(/\D/g, "").slice(0, 6);

  if (!year) return compact.slice(0, 11);
  if (!county) return year;
  if (!serial) return `${year}-${county}`;
  return `${year}-${county}-${serial}`;
}

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
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const { reset: resetGlobalLoading } = useGlobalLoading();
  const [plateFocused, setPlateFocused] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const plateScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plateSectionYRef = useRef(0);

  useEffect(() => {
    return () => {
      if (plateScrollTimeoutRef.current) clearTimeout(plateScrollTimeoutRef.current);
    };
  }, []);

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
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapCenter =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : null;
  const mapCoords = useMemo(() => {
    if (typeof listing?.latitude !== "number" || typeof listing?.longitude !== "number") {
      return null;
    }
    return { latitude: listing.latitude, longitude: listing.longitude };
  }, [listing?.latitude, listing?.longitude]);
  const mapCoordsKey = mapCoords
    ? `${mapCoords.latitude.toFixed(6)},${mapCoords.longitude.toFixed(6)}`
    : null;
  const lastMapKeyRef = useRef<string | null>(null);
  const [staticMapVersion, setStaticMapVersion] = useState(0);
  const staticMapUrl = useMemo(() => {
    if (!mapsKey || !mapCenter) return null;
    const cacheBuster = `${staticMapVersion}`;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(
      mapCenter
    )}&zoom=16&size=640x280&scale=2&format=png&maptype=roadmap&markers=color:0x10B981|${encodeURIComponent(
      mapCenter
    )}&key=${mapsKey}&v=${encodeURIComponent(cacheBuster)}`;
  }, [mapsKey, mapCenter, staticMapVersion]);

  useEffect(() => {
    setStaticMapFailed(false);
    if (mapCoords) {
      console.log("[BookingSummary] Map coords", mapCoords);
    } else {
      console.warn("[BookingSummary] Missing map coords");
    }
    if (staticMapUrl) {
      console.log("[BookingSummary] Static map URL", staticMapUrl);
    }
  }, [staticMapUrl, mapCoords]);

  useEffect(() => {
    if (!mapCoordsKey) return;
    if (lastMapKeyRef.current === mapCoordsKey) return;
    lastMapKeyRef.current = mapCoordsKey;
    setStaticMapVersion((prev) => prev + 1);
  }, [mapCoordsKey]);
  const durationHours = useMemo(() => {
    const ms = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }, [end, start]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    const hourlyRate = listing.price_per_day / 24;
    const total = Math.round(hourlyRate * durationHours);
    return { total, totalCents: total * 100 };
  }, [durationHours, listing]);

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

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      let nextEnd = endAt;
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        nextEnd = bumped;
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

  const scrollPlateIntoView = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, plateSectionYRef.current - 24),
      animated: true,
    });
  }, []);

  const scheduleBookingReminders = useCallback(async () => {
    if (!listing) return;
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    const nowMs = Date.now();
    const startReminder = new Date(start.getTime() - 60 * 60 * 1000);
    const endReminder = new Date(end.getTime() - 30 * 60 * 1000);

    if (startReminder.getTime() > nowMs) {
      const attachments = await getNotificationImageAttachment();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking starts soon",
          body: `${listing.title} starts in 1 hour.`,
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
    setPaymentFailed(false);
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
        returnURL: "carparking://stripe-redirect",
      });
      if (initResult.error) {
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        setPaymentFailed(true);
        setPaymentFailureMessage("We couldn’t start the payment. Please try again.");
        return;
      }
      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        if (presentResult.error.code === "Canceled") {
          setPaymentFailed(true);
          setPaymentFailureMessage("Payment canceled. You can try again anytime.");
          return;
        }
        setPaymentFailed(true);
        setPaymentFailureMessage(
          presentResult.error.message ?? "Payment failed. Please try again."
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
      void scheduleBookingReminders().catch(() => {
        // Reminder failures shouldn't block the success flow.
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      if (message.toLowerCase().includes("time slot already booked")) {
        setPaymentFailed(true);
        setPaymentFailureMessage(
          "That slot was just booked by someone else. Please choose another time."
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
      <View style={styles.progressHeader}>
        <BackButton
          onPress={() => navigation.goBack()}
          style={styles.progressBackButton}
        />
        <BookingProgressBar currentStep={bookingBusy || confirmingBooking ? 3 : 2} />
      </View>
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pageTitleBlock}>
            <Text style={styles.pageTitle}>Booking Confirmation</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryMapWrap}>
              {Platform.OS !== "ios" && staticMapUrl && !staticMapFailed ? (
                <Image
                  source={{ uri: staticMapUrl }}
                  style={styles.summaryMap}
                  resizeMode="cover"
                  onError={(event) => {
                    setStaticMapFailed(true);
                    console.warn("[BookingSummary] Static map failed", event.nativeEvent);
                  }}
                  onLoad={() => {
                    console.log("[BookingSummary] Static map loaded");
                  }}
                />
              ) : mapCoords ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.summaryMap}
                  region={{
                    latitude: mapCoords.latitude,
                    longitude: mapCoords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  pointerEvents="none"
                >
                  <Marker coordinate={mapCoords} />
                </MapView>
              ) : (
                <View style={styles.summaryMapPlaceholder}>
                  <Text style={styles.summaryMapPlaceholderText}>Map preview unavailable</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryHeader}>
              <Text style={styles.listingTitle}>{listing.title || "Adam House Car Park"}</Text>
              <View style={styles.addressRow}>
                <Ionicons name="location-sharp" size={14} color={colors.textMuted} />
                <Text style={styles.addressText}>
                  {listing.address || "24 Adam Street, Dublin"}
                </Text>
              </View>
            </View>

            <View style={styles.sessionTable}>
              <View style={styles.sessionTableRow}>
                <View style={styles.sessionTableLabelCell}>
                  <Text style={styles.sessionTableLabel}>Duration</Text>
                </View>
                <View style={styles.sessionTableValueCell}>
                  <Text style={styles.sessionTableValue}>{durationHours} hours</Text>
                </View>
              </View>
              <View style={styles.sessionTableRow}>
                <View style={styles.sessionTableLabelCell}>
                  <Text style={styles.sessionTableLabel}>Start time</Text>
                </View>
                <View style={styles.sessionTableValueCell}>
                  <Text style={styles.sessionTableValue}>{formatDateTimeLabel(start)}</Text>
                </View>
              </View>
              <View style={styles.sessionTableRowLast}>
                <View style={styles.sessionTableLabelCell}>
                  <Text style={styles.sessionTableLabel}>End time</Text>
                </View>
                <View style={styles.sessionTableValueCell}>
                  <Text style={styles.sessionTableValue}>{formatDateTimeLabel(end)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={styles.regCard}
            onLayout={(event) => {
              plateSectionYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <SectionHeader
              title="Vehicle"
              subtitle={
                vehicleMake && vehicleColor
                  ? `${vehicleMake} · ${vehicleColor}`
                  : vehicleMake || "Add your vehicle details"
              }
              trailing={
                <Button
                  title={vehicleMake ? "Edit" : "Add"}
                  variant="ghost"
                  size="small"
                  style={styles.vehicleEditButton}
                  onPress={() => navigation.navigate("VehicleType")}
                />
              }
            />
            {vehicleMake ? (
              <View style={styles.vehicleCardInfo}>
                <VehicleBrandLogo make={vehicleMake} size={20} />
                <View style={styles.vehicleCardText}>
                  {user?.vehicleType ? <Text style={styles.vehicleTypeText}>{user.vehicleType}</Text> : null}
                </View>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Vehicle registration</Text>
            <View style={styles.regRow}>
              <View style={styles.plateCountry} />
              <View style={styles.regDetails}>
                <AppTextInput
                  variant="embedded"
                  value={vehiclePlate}
                  onChangeText={(value) => setVehiclePlate(formatIrishPlateInput(value))}
                  placeholder="Enter reg plate"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textAlign="center"
                  containerStyle={styles.regInputContainer}
                  style={styles.regInput}
                  onFocus={() => {
                    setPlateFocused(true);
                    if (plateScrollTimeoutRef.current) clearTimeout(plateScrollTimeoutRef.current);
                    plateScrollTimeoutRef.current = setTimeout(() => {
                      scrollPlateIntoView();
                    }, Platform.OS === "android" ? 180 : 60);
                  }}
                  onBlur={() => {
                    setPlateFocused(false);
                  }}
                />
              </View>
            </View>
          </View>

          <View style={styles.priceCard}>
            <SectionHeader
              title="Price breakdown"
              subtitle="No hidden fees will be added after checkout."
              style={styles.priceHeader}
            />
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

          {paymentFailed ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Payment didn’t go through</Text>
              <Text style={styles.noticeText}>
                {paymentFailureMessage ?? "Please try again or use another payment method."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.error}>Listing not found.</Text>
        </View>
      )}
      {listing && user && !plateFocused ? (
        <View style={[styles.footerBar, { paddingBottom: Math.max(insets.bottom, 22) }]}>
          <Text style={styles.footerDisclosure}>
            FreeSpace is the booking marketplace. Hosts manage the physical space and site rules.
          </Text>
          <Button
            style={styles.footerButton}
            onPress={handlePayment}
            disabled={bookingBusy || bookingConfirmed}
            loading={bookingBusy}
            title={
              bookingBusy
                ? confirmingBooking
                  ? "Finalizing..."
                  : "Processing..."
                : `Pay and reserve • €${Math.round(pricing.finalPrice)}`
            }
          />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  keyboardAvoid: {
    flex: 1,
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
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  progressBackButton: {
    position: "absolute",
    left: spacing.screenX,
    top: 10,
    zIndex: 2,
    marginBottom: 0,
  },
  pageTitleBlock: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  pageTitle: {
    color: "#15171A",
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Inter-Medium",
    fontWeight: "500",
    letterSpacing: -0.45,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 180,
    paddingTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...cardShadow,
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
    ...textStyles.titleSmall,
    marginBottom: 6,
  },
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  addressDot: {
    backgroundColor: colors.textSoft,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  addressText: {
    ...textStyles.bodyMedium,
  },
  summaryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...cardShadow,
    overflow: "hidden",
  },
  summaryMapWrap: {
    backgroundColor: "transparent",
  },
  summaryMap: {
    width: "100%",
    height: 122,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  summaryMapPlaceholder: {
    width: "100%",
    height: 122,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMapPlaceholderText: {
    ...textStyles.meta,
    color: colors.textSoft,
  },
  summaryCode: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#22a06b",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  summaryCodeText: {
    color: "#111827",
    fontWeight: "700",
    fontFamily: "Poppins-Bold",
    fontSize: 16,
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  sectionLabel: {
    ...textStyles.sectionTitle,
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sessionLabel: {
    ...textStyles.bodyMedium,
    fontSize: 13,
  },
  sessionValue: {
    ...textStyles.bodyStrong,
  },
  sessionTable: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  sessionTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 52,
  },
  sessionTableRowLast: {
    flexDirection: "row",
    minHeight: 52,
  },
  sessionTableLabelCell: {
    width: "46%",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  sessionTableValueCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 14,
  },
  sessionTableLabel: {
    ...textStyles.bodyMedium,
    color: "#374151",
  },
  sessionTableValue: {
    ...textStyles.bodyStrong,
    fontSize: 15,
    textAlign: "right",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateColumn: {
    flex: 1,
  },
  dateLabel: {
    ...textStyles.label,
    marginBottom: 6,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#F7FFFB",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateTimeText: {
    ...textStyles.bodyStrong,
    fontSize: 13,
    flex: 1,
  },
  durationPill: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    width: 38,
    height: 38,
  },
  durationValue: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
    color: colors.text,
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
    fontFamily: "Poppins-SemiBold",
    color: "#6B7280",
  },
  totalDueValue: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Poppins-Bold",
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
    fontFamily: "Poppins-SemiBold",
  },
  breakdownValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
  },
  trustRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    ...textStyles.sectionTitle,
    marginBottom: 12,
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
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  vehicleCardInfo: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 10,
    marginBottom: 12,
  },
  vehicleCardText: {
    flexShrink: 1,
  },
  vehicleTypeText: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  vehicleEditButton: {
    paddingHorizontal: 12,
    minHeight: 36,
  },
  regInputContainer: {
    marginBottom: 0,
    flex: 1,
  },
  priceHeader: {
    marginBottom: spacing.sm,
  },
  priceCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  priceBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  priceBreakdownRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  priceBreakdownLabel: {
    ...textStyles.bodyMedium,
  },
  priceBreakdownValue: {
    ...textStyles.bodyStrong,
  },
  priceBreakdownMuted: {
    ...textStyles.bodyMedium,
    fontSize: 13,
  },
  priceBreakdownTotalLabel: {
    ...textStyles.bodyStrong,
  },
  priceBreakdownTotalValue: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "Poppins-Bold",
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  regRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    overflow: "hidden",
    backgroundColor: colors.cardBg,
    alignItems: "center",
  },
  regDetails: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  plateCountry: {
    width: 34,
    alignSelf: "stretch",
    backgroundColor: "#003399",
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
    backgroundColor: colors.cardBg,
    borderColor: "#fee2e2",
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: spacing.card,
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
    fontFamily: "Poppins-SemiBold",
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  footerDisclosure: {
    ...textStyles.meta,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  footerButton: {
    minHeight: 56,
    marginBottom: 16,
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
    borderRadius: radius.card,
    paddingHorizontal: 24,
    paddingVertical: 20,
    ...cardShadow,
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
    fontFamily: "Poppins-Regular",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
