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
import { useCallback, useEffect, useRef, useState } from "react";
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

  // Schedule "ending soon" notification with an Extend action button
  useEffect(() => {
    if (isCanceled || (!isUpcoming && !isInProgress)) return;
    const endReminder = new Date(end.getTime() - 30 * 60 * 1000);
    if (endReminder.getTime() <= Date.now()) return;

    let cancelled = false;
    void (async () => {
      try {
        await Notifications.setNotificationCategoryAsync("booking_ending", [
          {
            identifier: "extend_booking",
            buttonTitle: "Extend +",
            options: { opensAppToForeground: true },
          },
        ]);
        if (cancelled) return;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Your parking ends in 30 minutes",
            body: `${booking.title} — need more time?`,
            categoryIdentifier: "booking_ending",
            data: {
              type: "booking_extend_prompt",
              bookingId: booking.id,
              historyTab: "active" as const,
            },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endReminder },
        });
      } catch {
        // Notification scheduling is best-effort
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id, booking.title, end]);

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
  const isCompleted = !isUpcoming && !isInProgress && !isCanceled;
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
      cardGradient: ["#0fa968", "#000000"] as const,
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
    Linking.openURL(mapsUrl);
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

  const SERVICE_FEE_CENTS = 150;
  const progressPct = isInProgress
    ? Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())))
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" translucent={false} backgroundColor="#fff" />

      {/* ── Nav header — mirrors BookingSummaryScreen ── */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={FG} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* ── Review CTA ── */}
        {canReview && !reviewed ? (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>How was your parking?</Text>
            <View style={styles.reviewStars}>
              {Array.from({ length: 5 }).map((_, i) => {
                const star = i + 1;
                const filled = pendingRating !== null && star <= pendingRating;
                return (
                  <Pressable key={i} onPress={() => handleStarPress(star)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} hitSlop={12}>
                    <Ionicons name={filled ? "star" : "star-outline"} size={36}
                      color={filled ? "#F59E0B" : "rgba(255,255,255,0.45)"} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : canReview && reviewed ? (
          <View style={[styles.reviewSection, styles.reviewSectionDone]}>
            <Text style={styles.reviewTitleDone}>Thanks for your review</Text>
            <View style={styles.reviewStars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons key={i} name="star" size={22}
                  color={reviewedRating != null && i < Math.round(reviewedRating) ? "#F59E0B" : "#E5E7EB"} />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Directions banner ── */}
        {(isUpcoming || isInProgress) && !isCanceled && !canCheckIn ? (
          <TouchableOpacity style={styles.directionsBanner} onPress={handleOpenMaps} activeOpacity={0.8}>
            <View style={styles.directionsIconWrap}>
              <Ionicons name="navigate" size={20} color="#fff" />
            </View>
            <View style={styles.directionsText}>
              <Text style={styles.directionsLabel}>Get directions</Text>
              <Text style={styles.directionsAddress} numberOfLines={1}>{booking.address}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        ) : null}

        {/* ── Page header ── */}
        <View style={styles.pageHeader}>
          <View style={[styles.statusPill, isCanceled && styles.statusPillCanceled, (isInProgress || isCompleted) && styles.statusPillActive]}>
            <Ionicons name={statusConfig.icon} size={11}
              color={isCanceled ? "#DC2626" : (isInProgress || isCompleted) ? GREEN : "#374151"} />
            <Text style={[styles.statusPillText, isCanceled && styles.statusPillTextCanceled, (isInProgress || isCompleted) && styles.statusPillTextActive]}>
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.pageTitle} numberOfLines={2}>{booking.title}</Text>
          <Text style={styles.pageAddress}>{booking.address}</Text>
        </View>

        {/* ── Time section ── */}
        <View style={styles.section}>
          <View style={styles.timeRow}>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>ARRIVING</Text>
              <Text style={styles.timeSlotTime}>{formatTimeLabel(start)}</Text>
              <Text style={styles.timeSlotDate}>{startDateLabel}</Text>
            </View>
            <View style={styles.timeArrow}>
              <View style={styles.timeArrowLine} />
              <Text style={styles.timeArrowDuration}>{durationLabel}</Text>
              <View style={styles.timeArrowLine} />
            </View>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>LEAVING</Text>
              <Text style={styles.timeSlotTime}>{formatTimeLabel(end)}</Text>
              <Text style={styles.timeSlotDate}>{endDateLabel}</Text>
            </View>
          </View>
          {isInProgress ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` as `${number}%` }]} />
              </View>
            </View>
          ) : null}
          {(isUpcoming || isInProgress) && !isCanceled ? (
            <Pressable
              style={({ pressed }) => [styles.extendRow, pressed && { opacity: 0.6 }]}
              onPress={() => setExtendOpen(true)}
              disabled={extendBusy}
            >
              <Ionicons name="time-outline" size={14} color={GREEN} />
              <Text style={styles.extendText}>{extendBusy ? "Extending…" : "Extend end time"}</Text>
              <Ionicons name="chevron-forward" size={13} color={GREEN} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Details section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total paid</Text>
              <Text style={styles.summaryValue}>€{(localAmountCents / 100).toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowBorder]}>
              <Text style={styles.summaryLabel}>Reference</Text>
              <Text style={[styles.summaryValue, styles.summaryRef]} selectable>{formatBookingReference(booking.id)}</Text>
            </View>
            {booking.vehiclePlate ? (
              <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                <Text style={styles.summaryLabel}>Vehicle</Text>
                <Text style={styles.summaryValue}>{booking.vehiclePlate}</Text>
              </View>
            ) : null}
            {checkedInAt ? (
              <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                <Text style={styles.summaryLabel}>Checked in</Text>
                <Text style={[styles.summaryValue, { color: GREEN }]}>{formatTimeLabel(checkedInAt)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Getting in ── */}
        {showArrivalInfo ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Getting in</Text>
            {booking.arrivalInstructions?.trim() ? (
              <Text style={styles.sectionBody}>{booking.arrivalInstructions.trim()}</Text>
            ) : null}
            {booking.accessCode?.trim() ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Entry code</Text>
                <Text style={styles.codeValue} selectable>{booking.accessCode.trim()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Cancellation ── */}
        {isCanceled ? (
          <View style={styles.section}>
            <Text style={styles.sectionBody}>
              {isRefunded ? "Refund submitted to your original payment method."
                : cancellationSource === "host" ? "Canceled by the host."
                : "Booking canceled."}
              {!isRefunded ? <Text style={styles.sectionLink} onPress={handleContactSupport}> Contact support →</Text> : null}
            </Text>
          </View>
        ) : null}

        {/* ── Actions ── */}
        <View style={styles.actionsSection}>
          {canCheckIn ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCheckIn}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Check in</Text>
            </TouchableOpacity>
          ) : null}

          {canBookAgain ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleBookAgain}>
              <Ionicons name="refresh-outline" size={16} color={FG} />
              <Text style={styles.secondaryBtnText}>Book again</Text>
            </TouchableOpacity>
          ) : null}

          {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}

          <View style={styles.linkRow}>
            {receiptUrl ? (
              <Pressable onPress={() => Linking.openURL(receiptUrl)}>
                <Text style={styles.linkText}>View receipt</Text>
              </Pressable>
            ) : null}
            {isUpcoming && !isCanceled ? (
              <Pressable onPress={handleCancel} disabled={canceling}>
                <Text style={styles.linkTextDanger}>{canceling ? "Canceling…" : "Cancel booking"}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={handleContactSupport}>
              <Text style={styles.linkText}>Help</Text>
            </Pressable>
          </View>
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

// ── Design tokens (match BookingSummaryScreen) ─────────────────────────────
const GREEN      = "#0fa968";
const FG         = "#111827";
const MUTED      = "#374151";
const LINE       = "#D1D5DB";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Nav header — identical pattern to BookingSummaryScreen
  header: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: "#fff",
  },
  backButton: { padding: 6, position: "absolute", left: 14 },
  headerTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG, textAlign: "center" },

  // Review — green section at top when due
  reviewSection: {
    backgroundColor: GREEN,
    paddingVertical: 28, paddingHorizontal: 20,
    alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  reviewSectionDone: { backgroundColor: "#fff" },
  reviewTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#fff", letterSpacing: -0.3 },
  reviewTitleDone: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: FG },
  reviewStars: { flexDirection: "row", gap: 8 },

  // Page header — mirrors BookingSummaryScreen pageHeader
  pageHeader: {
    borderBottomWidth: 1, borderBottomColor: LINE,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    alignItems: "center", gap: 6,
  },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillCanceled: { backgroundColor: "#FEF2F2" },
  statusPillActive: { backgroundColor: "#ECFDF5" },
  statusPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: "#374151" },
  statusPillTextCanceled: { color: "#DC2626" },
  statusPillTextActive: { color: GREEN },
  pageTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: FG, letterSpacing: -0.5, lineHeight: 28, textAlign: "center" },
  pageAddress: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED, textAlign: "center" },

  // Sections — identical to BookingSummaryScreen
  section: { borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 20, paddingVertical: 18 },
  sectionTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3, marginBottom: 12 },
  sectionBody: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, lineHeight: 22 },
  sectionLink: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  // Time row — matches BookingSummaryScreen
  timeRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  timeSlot: { flex: 1, alignItems: "center", paddingVertical: 6 },
  timeSlotLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    color: GREEN,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  timeSlotTime: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    color: FG,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  timeSlotDate: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  timeArrow: { alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  timeArrowLine: { width: 18, height: 1, backgroundColor: LINE },
  timeArrowDuration: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: MUTED,
    letterSpacing: 0.2,
  },

  progressWrap: { marginTop: 14 },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: GREEN },

  directionsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  directionsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  directionsText: { flex: 1 },
  directionsLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#fff" },
  directionsAddress: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  extendRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE },
  extendText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN },

  // Summary box — mirrors BookingSummaryScreen summaryBox
  summaryBox: { borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: "hidden" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  summaryLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  summaryValue: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  summaryRef: { fontFamily: "PlusJakartaSans-Bold", letterSpacing: 1.2, fontVariant: ["tabular-nums"] as const },

  // Getting in — access code stands out naturally at this size
  codeBox: { marginTop: 12, padding: 14, backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: LINE },
  codeLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" as const, marginBottom: 6 },
  codeValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 32, color: FG, letterSpacing: 5, fontVariant: ["tabular-nums"] as const },

  // Actions section
  actionsSection: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  primaryBtn: {
    backgroundColor: GREEN, paddingVertical: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "PlusJakartaSans-Bold" },
  secondaryBtn: {
    backgroundColor: "#fff", paddingVertical: 14, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1, borderColor: LINE,
  },
  secondaryBtnText: { color: FG, fontSize: 15, fontFamily: "PlusJakartaSans-SemiBold" },
  errorText: { color: "#DC2626", fontSize: 13, textAlign: "center", fontFamily: "PlusJakartaSans-Regular" },
  linkRow: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 4 },
  linkText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: MUTED },
  linkTextDanger: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: "#DC2626" },
});
