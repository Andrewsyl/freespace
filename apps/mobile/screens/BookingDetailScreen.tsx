import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import DatePicker from "../components/AdaptiveDatePicker";
import { useStripe } from "@stripe/stripe-react-native";
import { cancelBooking, checkInBooking, confirmBookingExtension, createBookingExtensionIntent } from "../api";
import { useAuth } from "../auth";
import { getNotificationImageAttachment } from "../notifications";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { formatTimeLabel } from "../utils/dateFormat";
import { formatBookingReference } from "../utils/bookingFormat";

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [localRefundStatus, setLocalRefundStatus] = useState(booking.refundStatus ?? null);
  const [localRefundedAt, setLocalRefundedAt] = useState(booking.refundedAt ?? null);
  const [localEndTime, setLocalEndTime] = useState(() => new Date(booking.endTime));
  const [localAmountCents, setLocalAmountCents] = useState(booking.amountCents);
  const [canceling, setCanceling] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState(
    booking.checkedInAt ? new Date(booking.checkedInAt) : null
  );
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const start = new Date(booking.startTime);
  const end = localEndTime;
  const now = Date.now();
  const isUpcoming = end.getTime() > now && start.getTime() > now;
  const isInProgress = start.getTime() <= now && end.getTime() > now && localStatus === "confirmed";
  const isCanceled = localStatus === "canceled";
  const isRefunded = localRefundStatus === "succeeded";
  const canReview = end.getTime() <= now && localStatus === "confirmed";
  const [reviewed, setReviewed] = useState(false);
  const [reviewedRating, setReviewedRating] = useState<number | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPendingRating(null);
      void (async () => {
        try {
          const stored = await AsyncStorage.getItem(`bookingRating:${booking.id}`);
          if (!stored) {
            if (active) {
              setReviewed(false);
              setReviewedRating(null);
            }
            return;
          }
          const parsed = JSON.parse(stored) as { rating?: number };
          if (!active) return;
          if (typeof parsed.rating === "number") {
            setReviewed(true);
            setReviewedRating(parsed.rating);
          } else {
            setReviewed(false);
            setReviewedRating(null);
          }
        } catch {
          if (active) {
            setReviewed(false);
            setReviewedRating(null);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [booking.id])
  );

  const receiptUrl = booking.receiptUrl ?? null;
  const destination =
    typeof booking.latitude === "number" && typeof booking.longitude === "number"
      ? `${booking.latitude},${booking.longitude}`
      : booking.address;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
  const minExtendTime = new Date(end.getTime() + 5 * 60 * 1000);
  const canCheckIn =
    localStatus === "confirmed" &&
    !checkedInAt &&
    Date.now() >= start.getTime() - 15 * 60 * 1000 &&
    Date.now() <= end.getTime();
  const canBookAgain = isCanceled || (!isUpcoming && !isInProgress);
  const statusConfig = (() => {
    if (isCanceled) return {
      label: "Booking canceled",
      icon: "close-circle" as const,
      cardGradient: ["#C0392B", "#000000"] as const,
    };
    if (isInProgress) return {
      label: "In progress",
      icon: "play-circle" as const,
      cardGradient: ["#1B8A5A", "#000000"] as const,
    };
    if (isUpcoming) return {
      label: "Confirmed",
      icon: "checkmark-circle" as const,
      cardGradient: ["#1E6E47", "#000000"] as const,
    };
    return {
      label: "Completed",
      icon: "checkmark-circle-outline" as const,
      cardGradient: ["#3D4D63", "#000000"] as const,
    };
  })();
  const showArrivalInfo =
    (isUpcoming || isInProgress || canReview) &&
    (Boolean(booking.arrivalInstructions?.trim()) || Boolean(booking.accessCode?.trim()));
  const cancellationSource = booking.cancellationSource ?? null;
  const bookingDateLabel = `${start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Dublin",
  })} · ${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
  const startDateLabel = start.toLocaleDateString("en-IE", {
    weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin",
  });
  const endDateLabel = end.toLocaleDateString("en-IE", {
    weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin",
  });
  const durationMs    = end.getTime() - start.getTime();
  const durH          = Math.floor(durationMs / 3_600_000);
  const durM          = Math.floor((durationMs % 3_600_000) / 60_000);
  const durationLabel = durH > 0
    ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`)
    : `${durM}m`;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const heroUrl: string | null =
    booking.imageUrls?.[0] ??
    (mapsKey && booking.latitude != null && booking.longitude != null
      ? `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${booking.latitude},${booking.longitude}&fov=90&key=${mapsKey}`
      : null);

  const performCancel = async () => {
    if (!token || canceling || localStatus === "canceled") return;
    setCanceling(true);
    try {
      const result = await cancelBooking({ token, bookingId: booking.id });
      await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
      setLocalStatus("canceled");
      if (result.refunded) {
        setLocalRefundStatus("succeeded");
        setLocalRefundedAt(new Date().toISOString());
      }
      setCanceling(false);
      try {
        const attachments = await getNotificationImageAttachment();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Booking canceled",
            body: "The space is now back on the map.",
            attachments,
          },
          trigger: null,
        });
      } catch {
        // Notification failures shouldn't block the cancel flow.
      }
    } catch (err) {
      setCanceling(false);
      Alert.alert("Cancellation failed", err instanceof Error ? err.message : "Could not cancel booking. Please try again.");
    }
  };

  const handleCancel = () => {
    if (!token || canceling || localStatus === "canceled") return;
    Alert.alert("Cancel booking", "Cancel this reservation and release the space? Eligible refunds are returned to the original payment method.", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: performCancel },
    ]);
  };

  const handleExtend = async (nextEnd: Date) => {
    if (!token || extendBusy || localStatus !== "confirmed") return;
    setExtendBusy(true);
    setExtendError(null);
    try {
      const result = await createBookingExtensionIntent({
        token,
        bookingId: booking.id,
        newEndTime: nextEnd.toISOString(),
      });

      if ("noCharge" in result && result.noCharge) {
        setLocalEndTime(new Date(result.newEndTime));
        setLocalAmountCents(result.newTotalCents);
        Alert.alert("Booking updated", "Your end time has been extended.");
        return;
      }

      if (!("paymentIntentClientSecret" in result)) {
        setExtendError("We could not prepare the extension payment.");
        return;
      }

      const initResult = await initPaymentSheet({
        merchantDisplayName: "FreeSpace",
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKeySecret,
        paymentIntentClientSecret: result.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
      });
      if (initResult.error) {
        setExtendError("We couldn't start the extension payment.");
        return;
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        setExtendError(
          presentResult.error.code === "Canceled"
            ? "Extension canceled."
            : presentResult.error.message ?? "Payment failed."
        );
        return;
      }

      const confirm = await confirmBookingExtension({
        token,
        bookingId: booking.id,
        paymentIntentId: result.paymentIntentId,
        newEndTime: result.newEndTime,
        newTotalCents: result.newTotalCents,
      });
      setLocalEndTime(new Date(confirm.newEndTime));
      setLocalAmountCents(confirm.newTotalCents);
      Alert.alert("Booking extended", "Your end time has been updated.");
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : "Could not extend booking");
    } finally {
      setExtendBusy(false);
    }
  };

  const handleCheckIn = async () => {
    if (!token || !canCheckIn) return;
    try {
      const result = await checkInBooking({ token, bookingId: booking.id });
      setCheckedInAt(new Date(result.checkedInAt));
      Alert.alert("Checked in", "Thanks! Enjoy your booking.");
    } catch (err) {
      Alert.alert("Check-in failed", err instanceof Error ? err.message : "Try again.");
    }
  };

  const handleBookAgain = () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    navigation.navigate("Listing", {
      id: booking.listingId,
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    });
  };

  const handleOpenMaps = () => {
    Alert.alert("Open Google Maps", "Open directions to this space?", [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => Linking.openURL(mapsUrl) },
    ]);
  };

  const handleStarPress = (star: number) => {
    setPendingRating(star);
    // Navigate after a short delay so the filled stars are visible during
    // the transition. pendingRating is NOT cleared here — it resets via
    // useFocusEffect when the user returns to this screen.
    setTimeout(() => {
      navigation.navigate("Review", { booking, initialRating: star });
    }, 350);
  };

  const handleContactSupport = () => {
    navigation.navigate("Support", {
      prefillSubject: isCanceled ? "Refund request" : "Payment or refund",
      prefillMessage: `Booking reference: ${formatBookingReference(booking.id)}\nListing: ${booking.title}\nIssue:\n`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" translucent={false} backgroundColor={SCREEN_BG} />

      {/* ── Navigation header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={FG} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{booking.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} ref={scrollRef}>

        {/* ── Review CTA — sits above the ticket when a review is due ── */}
        {canReview ? (
          reviewed ? (
            <View style={styles.reviewCta}>
              <Text style={styles.reviewCtaQuestion}>Thanks for your review!</Text>
              <View style={styles.reviewCtaStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                    key={`star-top-${i}`}
                    name="star"
                    size={30}
                    color={reviewedRating != null && i < Math.round(reviewedRating) ? "#fff" : "rgba(255,255,255,0.3)"}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.reviewCta}>
              <Text style={styles.reviewCtaQuestion}>How was your parking experience?</Text>
              <View style={styles.reviewCtaStars}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const star = i + 1;
                  const filled = pendingRating !== null && star <= pendingRating;
                  return (
                    <Pressable
                      key={`star-top-${i}`}
                      onPress={() => handleStarPress(star)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={filled ? "star" : "star-outline"}
                        size={34}
                        color="#fff"
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )
        ) : null}

        {/* ═══════════════════════════════════════
            E-TICKET CARD
        ═══════════════════════════════════════ */}
        <View style={styles.ticketCard}>

          {/* ── Dark top section ── */}
          <LinearGradient
            colors={statusConfig.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.ticketTop}
          >

            {/* Status chip + price */}
            <View style={styles.ticketHeaderRow}>
              <View style={styles.statusChip}>
                <Ionicons name={statusConfig.icon} size={12} color="#fff" />
                <Text style={styles.statusChipText}>{statusConfig.label}</Text>
              </View>
              <Text style={styles.ticketPrice}>
                €{(localAmountCents / 100).toFixed(2)}
              </Text>
            </View>

            {/* Listing name + address */}
            <Text style={styles.ticketTitle} numberOfLines={2}>{booking.title}</Text>
            <Text style={styles.ticketAddress} numberOfLines={1}>{booking.address}</Text>

            {/* Time row */}
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.timeEyebrow}>ARRIVAL</Text>
                <Text style={styles.timeBig}>{formatTimeLabel(start)}</Text>
                <Text style={styles.timeSub}>{startDateLabel}</Text>
              </View>

              <View style={styles.timeMid}>
                <View style={styles.timeLine} />
                <View style={styles.durationPill}>
                  <Text style={styles.durationText}>{durationLabel}</Text>
                </View>
                <View style={styles.timeLine} />
              </View>

              <View style={[styles.timeCol, styles.timeColRight]}>
                <Text style={styles.timeEyebrow}>DEPARTURE</Text>
                <Text style={styles.timeBig}>{formatTimeLabel(end)}</Text>
                <Text style={styles.timeSub}>{endDateLabel}</Text>
              </View>
            </View>

            {/* Extend end time */}
            {(isUpcoming || isInProgress) && !isCanceled ? (
              <Pressable
                style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setExtendOpen(true)}
                disabled={extendBusy}
              >
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.extendBtnText}>
                  {extendBusy ? "Extending…" : "Extend end time"}
                </Text>
                <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.5)" />
              </Pressable>
            ) : null}

          </LinearGradient>

          {/* ── White bottom section ── */}
          <View style={styles.ticketBottom}>
            <View style={styles.refRow}>
              <View>
                <Text style={styles.refEyebrow}>Booking reference</Text>
                <Text style={styles.refCode}>{formatBookingReference(booking.id)}</Text>
              </View>
              {booking.vehiclePlate ? (
                <View style={styles.plateChip}>
                  <Ionicons name="car-outline" size={12} color={FG_MUTED} />
                  <Text style={styles.plateChipText}>{booking.vehiclePlate}</Text>
                </View>
              ) : null}
            </View>
          </View>

        </View>

        {/* ═══════════════════════════════════════
            ACTIONS
        ═══════════════════════════════════════ */}
        <View style={styles.actionBlock}>
          {(isUpcoming || isInProgress) && !isCanceled ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenMaps}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Get directions</Text>
            </TouchableOpacity>
          ) : null}

          {canCheckIn ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCheckIn}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Check in</Text>
            </TouchableOpacity>
          ) : null}

          {receiptUrl ? (
            <TouchableOpacity style={styles.outlineBtn} onPress={() => Linking.openURL(receiptUrl)}>
              <Ionicons name="receipt-outline" size={16} color={GREEN} />
              <Text style={styles.outlineBtnText}>View receipt</Text>
            </TouchableOpacity>
          ) : null}

          {canBookAgain ? (
            <TouchableOpacity style={styles.outlineBtn} onPress={handleBookAgain}>
              <Ionicons name="refresh-outline" size={16} color={FG} />
              <Text style={styles.outlineBtnText}>Book again</Text>
            </TouchableOpacity>
          ) : null}

          {isUpcoming && !isCanceled ? (
            <TouchableOpacity
              style={[styles.dangerBtn, canceling && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={canceling}
            >
              <Text style={styles.dangerBtnText}>
                {canceling ? "Canceling…" : "Cancel booking"}
              </Text>
            </TouchableOpacity>
          ) : null}

          {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}
        </View>

        {/* ── Arrival details ── */}
        {showArrivalInfo ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Arrival details</Text>
            {booking.arrivalInstructions?.trim() ? (
              <Text style={styles.infoCardBody}>{booking.arrivalInstructions.trim()}</Text>
            ) : null}
            {booking.accessCode?.trim() ? (
              <View style={styles.accessCodeWrap}>
                <Text style={styles.infoCardLabel}>Entry code</Text>
                <Text style={styles.accessCodeValue}>{booking.accessCode.trim()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Cancellation status ── */}
        {isCanceled ? (
          <View style={styles.cancelCard}>
            <Text style={styles.cancelEyebrow}>Cancellation status</Text>

            <Text style={styles.cancelNote}>
              {cancellationSource === "host"
                ? isRefunded
                  ? "The host canceled this booking. Your refund has been submitted to the original payment method."
                  : "The host canceled this booking. If no refund has appeared yet, contact support and we will trace it."
                : isRefunded
                  ? "This booking was canceled. Your refund has been submitted to the original payment method."
                  : "This booking was canceled. If you expected a refund and have not received one, contact support with your reference."}
            </Text>

            {isRefunded ? (
              <View style={styles.cancelTimeline}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineIndicator}>
                    <View style={styles.timelineDot}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineTitle}>Refund processed</Text>
                    {localRefundedAt ? (
                      <Text style={styles.timelineSub}>
                        {new Date(localRefundedAt).toLocaleDateString("en-IE", {
                          day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Dublin",
                        })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={styles.secondaryLinkBtn} onPress={handleContactSupport}>
              <Text style={styles.secondaryLinkBtnText}>
                {cancellationSource === "host"
                  ? "Need help with host cancellation?"
                  : isRefunded ? "Need refund help?" : "Request refund support"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}


        {/* ── Help ── */}
        <View style={styles.helpCard}>
          <TouchableOpacity style={styles.helpRow} onPress={handleContactSupport} activeOpacity={0.7}>
            <View style={styles.helpIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={GREEN} />
            </View>
            <View style={styles.helpRowBody}>
              <Text style={styles.helpRowTitle}>Need help?</Text>
              <Text style={styles.helpRowSub}>Contact support about this booking</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color="#9A9A9A" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      <DatePicker
        modal
        open={extendOpen}
        date={minExtendTime}
        minimumDate={minExtendTime}
        mode="datetime"
        minuteInterval={30}
        onConfirm={(date) => { setExtendOpen(false); handleExtend(date); }}
        onCancel={() => setExtendOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Design tokens ──────────────────────────────────────────────────────────
const SCREEN_BG  = "#EFEEEC";
const GREEN      = "#1B8A5A";
const GREEN_SOFT = "#E6F2EC";
const FG         = "#111111";
const FG_MUTED   = "#6B6B6B";
const LINE       = "#EBEBEA";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: SCREEN_BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    color: FG,
    letterSpacing: -0.1,
    paddingHorizontal: 8,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 52,
    gap: 12,
  },

  // ── E-ticket card ───────────────────────────────────────────────────────
  ticketCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },

  // Dark top section (no own shadow — card handles it)
  ticketTop: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ticketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    color: "#fff",
  },
  ticketPrice: {
    fontFamily: "Inter-Bold",
    fontSize: 28,
    color: "#fff",
    letterSpacing: -0.8,
  },
  ticketTitle: {
    fontFamily: "Inter-Bold",
    fontSize: 20,
    color: "#fff",
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 4,
  },
  ticketAddress: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.58)",
    marginBottom: 24,
  },

  // Time row
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeCol: { flex: 1 },
  timeColRight: { alignItems: "flex-end" },
  timeEyebrow: {
    fontFamily: "Inter-SemiBold",
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  timeBig: {
    fontFamily: "Inter-Bold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: -0.5,
  },
  timeSub: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  timeMid: {
    flexDirection: "row",
    alignItems: "center",
    flex: 0.85,
    justifyContent: "center",
  },
  timeLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  durationPill: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 6,
  },
  durationText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },

  // Extend button
  extendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.13)",
    paddingTop: 14,
    marginTop: 18,
  },
  extendBtnText: {
    flex: 1,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
  },

  // White bottom section
  ticketBottom: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  refEyebrow: {
    fontFamily: "Inter-SemiBold",
    fontSize: 9,
    color: GREEN,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  refCode: {
    fontFamily: "Inter-Bold",
    fontSize: 22,
    color: FG,
    letterSpacing: 2.5,
    fontVariant: ["tabular-nums"] as const,
  },
  plateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F4",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plateChipText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    color: FG_MUTED,
  },

  // ── Action buttons ───────────────────────────────────────────────────────
  actionBlock: { gap: 10 },
  primaryBtn: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
  },
  outlineBtn: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: LINE,
  },
  outlineBtnText: {
    color: FG,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: "#f6caca",
    backgroundColor: "#fff7f7",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  dangerBtnText: {
    color: "#DC2626",
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
  },
  btnDisabled: { opacity: 0.6 },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter-Regular",
  },

  // ── Info cards ───────────────────────────────────────────────────────────
  infoCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LINE,
  },
  infoCardTitle: {
    color: FG,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    marginBottom: 8,
  },
  infoCardBody: {
    color: FG_MUTED,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter-Regular",
  },
  accessCodeWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  infoCardLabel: {
    color: "#9A9A9A",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
    fontFamily: "Inter-SemiBold",
  },
  accessCodeValue: {
    color: FG,
    fontSize: 20,
    letterSpacing: 2.5,
    fontFamily: "Inter-Bold",
  },
  secondaryLinkBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: GREEN_SOFT,
  },
  secondaryLinkBtnText: {
    color: GREEN,
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
  },

  // ── Cancellation timeline card ───────────────────────────────────────────
  cancelCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LINE,
  },
  cancelEyebrow: {
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    color: FG_MUTED,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  cancelNote: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: FG_MUTED,
    lineHeight: 22,
    marginBottom: 20,
  },
  cancelTimeline: {
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 14,
  },
  timelineIndicator: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    backgroundColor: GREEN,
    marginVertical: 3,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 18,
  },
  timelineTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    color: FG,
  },
  timelineSub: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: FG_MUTED,
    marginTop: 2,
  },

  // ── Review CTA ───────────────────────────────────────────────────────────
  reviewCta: {
    borderRadius: 16,
    backgroundColor: "#1B8A5A",
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  reviewCtaQuestion: {
    fontFamily: "Inter-Bold",
    fontSize: 17,
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
  },
  reviewCtaStars: {
    flexDirection: "row",
    gap: 10,
  },

  // ── Help card ────────────────────────────────────────────────────────────
  helpCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LINE,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  helpIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  helpRowBody: { flex: 1 },
  helpRowTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: FG,
  },
  helpRowSub: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: FG_MUTED,
    marginTop: 2,
  },
});
