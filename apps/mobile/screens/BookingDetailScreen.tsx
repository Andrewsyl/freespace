import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SquircleBtn } from "../components/SquircleBtn";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DatePicker from "../components/AdaptiveDatePicker";
import { useStripe } from "@stripe/stripe-react-native";
import { cancelBooking, checkInBooking, confirmBookingExtension, createBookingExtensionIntent } from "../api";
import { useAuth } from "../auth";
import { googlePayConfig } from "../utils/googlePay";
import {
  bookingReminderIds,
  cancelBookingReminders,
} from "../notifications";
import type { RootStackParamList } from "../types";
import {
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  CirclePlay,
  CircleX,
  Clock,
  Navigation,
  RefreshCw,
  Star,
  type LucideIcon,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { formatTimeLabel } from "../utils/dateFormat";
import { formatBookingReference } from "../utils/bookingFormat";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

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
  // Ticks every 30s so status flags (in progress / completed / check-in window)
  // stay accurate while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  // Tick only while focused (and refresh on focus) so the screen doesn't keep
  // waking every 30s while it sits unfocused under the navigation stack.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const interval = setInterval(() => setNow(Date.now()), 30_000);
      return () => clearInterval(interval);
    }, [])
  );
  const isUpcoming = end.getTime() > now && start.getTime() > now;
  const isInProgress = start.getTime() <= now && end.getTime() > now && localStatus === "confirmed";
  const isCanceled = localStatus === "canceled";
  const isRefunded = localRefundStatus === "succeeded";
  const canReview = end.getTime() <= now && localStatus === "confirmed";
  const [reviewed, setReviewed] = useState(false);
  const [reviewedRating, setReviewedRating] = useState<number | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  // The "ending soon" reminder (with the "Extend +" action) is now sent
  // server-side via the notification processor, so we no longer schedule it
  // locally here — that avoids duplicate notifications and keeps it correct if
  // the booking is extended or cancelled.

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
    now >= start.getTime() - 15 * 60 * 1000 &&
    now <= end.getTime();
  const isCompleted = !isUpcoming && !isInProgress && !isCanceled;
  const canBookAgain = isCanceled || (!isUpcoming && !isInProgress);
  const statusConfig = (() => {
    if (isCanceled) return {
      label: "Booking canceled",
      icon: CircleX,
      cardGradient: ["#C0392B", "#000000"] as const,
    };
    if (isInProgress) return {
      label: "In progress",
      icon: CirclePlay,
      cardGradient: ["#0a8050", "#000000"] as const,
    };
    if (isUpcoming) return {
      label: "Confirmed",
      icon: CircleCheck,
      cardGradient: ["#1E6E47", "#000000"] as const,
    };
    return {
      label: "Completed",
      icon: CircleCheck,
      cardGradient: ["#3D4D63", "#000000"] as const,
    };
  })();
  const StatusIcon = statusConfig.icon as LucideIcon;
  const showArrivalInfo =
    (isUpcoming || isInProgress || canReview) &&
    (Boolean(booking.arrivalInstructions?.trim()) || Boolean(booking.accessCode?.trim()));
  const cancellationSource = booking.cancellationSource ?? null;
  const bookingDateLabel = `${start.toLocaleDateString("en-IE", {
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
      // Drop the pending "starts soon"/"ends soon" reminders for this booking.
      void cancelBookingReminders([
        bookingReminderIds.start(booking.listingId, start.getTime()),
        bookingReminderIds.end(booking.listingId, end.getTime()),
      ]);
      setLocalStatus("canceled");
      if (result.refunded) {
        setLocalRefundStatus("succeeded");
        setLocalRefundedAt(new Date().toISOString());
      }
      setCanceling(false);
      // The "Booking canceled" notification is sent server-side
      // (sendBookingStatusPush) to both driver and host, so we don't fire a
      // duplicate local one here.
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
        void cancelBookingReminders([
          bookingReminderIds.end(booking.listingId, end.getTime()),
        ]);
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
        applePay: { merchantCountryCode: "IE" },
        googlePay: googlePayConfig,
      });
      if (initResult.error) {
        setExtendError("We couldn't start the extension payment.");
        return;
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        // Dismissing the payment sheet isn't an error — stay silent.
        if (presentResult.error.code !== "Canceled") {
          setExtendError(presentResult.error.message ?? "Payment failed.");
        }
        return;
      }

      const confirm = await confirmBookingExtension({
        token,
        bookingId: booking.id,
        paymentIntentId: result.paymentIntentId,
        newEndTime: result.newEndTime,
        newTotalCents: result.newTotalCents,
      });
      // The old end-time reminder is now wrong; the schedule effect will create
      // one for the new end time when localEndTime updates.
      void cancelBookingReminders([
        bookingReminderIds.end(booking.listingId, end.getTime()),
      ]);
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
      <StatusBar style="dark" translucent={false} backgroundColor="#F8FAFC" />

      {/* Nav header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBackOrFallback(navigation, fallbackRoutes.bookings)}>
          <ArrowLeft size={20} color={FG} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.navTitle}>Booking details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Review CTA — full bleed ── */}
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
                    <Star
                      size={36}
                      color={filled ? "#F59E0B" : "rgba(255,255,255,0.45)"}
                      fill={filled ? "#F59E0B" : "none"}
                      strokeWidth={2}
                    />
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
                <Star
                  key={i}
                  size={22}
                  color={reviewedRating != null && i < Math.round(reviewedRating) ? "#F59E0B" : "#E5E7EB"}
                  fill={reviewedRating != null && i < Math.round(reviewedRating) ? "#F59E0B" : "none"}
                  strokeWidth={2}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Cards ── */}
        <View style={styles.cards}>

          {/* Combined header + time card */}
          <View style={styles.headerCard}>
            <View style={styles.headerCardTop}>
              <View style={[styles.statusPill, isCanceled && styles.statusPillCanceled, (isInProgress || isCompleted) && styles.statusPillActive]}>
                <StatusIcon
                  size={11}
                  color={isCanceled ? "#DC2626" : (isInProgress || isCompleted) ? ACCENT : "#374151"}
                  strokeWidth={2.4}
                />
                <Text style={[styles.statusPillText, isCanceled && styles.statusPillTextCanceled, (isInProgress || isCompleted) && styles.statusPillTextActive]}>
                  {statusConfig.label}
                </Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={2}>{booking.title}</Text>
              <Text style={styles.headerSubtitle}>{booking.address}</Text>
            </View>
            <View style={styles.cardBody}>
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
                  <Clock size={14} color={ACCENT} strokeWidth={2.2} />
                  <Text style={styles.extendText}>{extendBusy ? "Extending…" : "Extend end time"}</Text>
                  <ChevronRight size={13} color={ACCENT} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Directions card */}
          {(isUpcoming || isInProgress) && !isCanceled && !canCheckIn ? (
            <TouchableOpacity style={styles.card} onPress={handleOpenMaps} activeOpacity={0.8}>
              <Text style={styles.cardSectionHeader}>Location</Text>
              <View style={[styles.detailRow]}>
                <View style={styles.directionsIconWrap}>
                  <Navigation size={16} color={ACCENT} strokeWidth={2.2} />
                </View>
                <Text style={styles.directionsAddress} numberOfLines={2}>{booking.address}</Text>
                <ChevronRight size={16} color={MUTED} strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Details card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionHeader}>Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total paid</Text>
              <Text style={styles.detailValue}>€{(localAmountCents / 100).toFixed(2)}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={[styles.detailValue, styles.detailRef]} selectable>{formatBookingReference(booking.id)}</Text>
            </View>
            {booking.vehiclePlate ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>Vehicle</Text>
                <Text style={styles.detailValue}>{booking.vehiclePlate}</Text>
              </View>
            ) : null}
            {checkedInAt ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>Checked in</Text>
                <Text style={[styles.detailValue, { color: ACCENT }]}>{formatTimeLabel(checkedInAt)}</Text>
              </View>
            ) : null}
          </View>

          {/* Getting in card */}
          {showArrivalInfo ? (
            <View style={styles.card}>
              <Text style={styles.cardSectionHeader}>Getting in</Text>
              <View style={styles.cardBody}>
                {booking.arrivalInstructions?.trim() ? (
                  <Text style={styles.instructionsText}>{booking.arrivalInstructions.trim()}</Text>
                ) : null}
                {booking.accessCode?.trim() ? (
                  <View style={[styles.codeBox, booking.arrivalInstructions?.trim() ? { marginTop: 12 } : null]}>
                    <Text style={styles.codeLabel}>Entry code</Text>
                    <Text style={styles.codeValue} selectable>{booking.accessCode.trim()}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Cancellation note */}
          {isCanceled ? (
            <View style={styles.cancellationNote}>
              <Text style={styles.cancellationText}>
                {isRefunded ? "Refund submitted to your original payment method."
                  : cancellationSource === "host" ? "Canceled by the host."
                  : "Booking canceled."}
                {!isRefunded ? <Text style={styles.sectionLink} onPress={handleContactSupport}> Contact support →</Text> : null}
              </Text>
            </View>
          ) : null}

        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {canCheckIn ? (
            <SquircleBtn
              label="Check in"
              onPress={handleCheckIn}
              icon={<CircleCheck size={18} color="#fff" strokeWidth={2.2} />}
            />
          ) : null}

          {canBookAgain ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleBookAgain}>
              <RefreshCw size={16} color={FG} strokeWidth={2.2} />
              <Text style={styles.secondaryBtnText}>Book again</Text>
            </TouchableOpacity>
          ) : null}

          {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}

          {isUpcoming && !isCanceled ? (
            <Pressable style={styles.cancelRow} onPress={handleCancel} disabled={canceling}>
              <Text style={styles.cancelText}>{canceling ? "Canceling…" : "Cancel booking"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.linkRow}>
            {receiptUrl ? (
              <Pressable onPress={() => Linking.openURL(receiptUrl)}>
                <Text style={styles.linkText}>View receipt</Text>
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

const ACCENT = "#0a8050";
const FG     = "#101414";
const MUTED  = "#465050";
const SUBTLE = "#6B7575";
const LINE   = "#DDE5EC";

const CARD_SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // ── Nav header ──────────────────────────────────────────────
  header: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E8EDF2",
    backgroundColor: "#ffffff",
  },
  backButton: { padding: 6, position: "absolute", left: 14 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: FG, textAlign: "center" },

  // ── Scroll content ───────────────────────────────────────────
  content: { paddingBottom: 48 },

  // ── Full-bleed banners ───────────────────────────────────────
  reviewSection: {
    backgroundColor: ACCENT,
    paddingVertical: 28, paddingHorizontal: 20,
    alignItems: "center", gap: 14,
  },
  reviewSectionDone: { backgroundColor: "#F8FAFC" },
  reviewTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#fff", letterSpacing: -0.3 },
  reviewTitleDone: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: FG },
  reviewStars: { flexDirection: "row", gap: 8 },

  directionsIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 12,
  },
  directionsAddress: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: FG, flex: 1, lineHeight: 20 },

  // ── Cards wrapper ─────────────────────────────────────────────
  cards: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card (status + title + time) ──────────────────────
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
    alignItems: "flex-start",
    gap: 4,
  },
  headerTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 26,
    textAlign: "left",
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },

  // ── Status pill ──────────────────────────────────────────────
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F3F4F6", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statusPillCanceled: { backgroundColor: "#FEF2F2" },
  statusPillActive: { backgroundColor: "#ECFDF5" },
  statusPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 12, color: "#374151" },
  statusPillTextCanceled: { color: "#DC2626" },
  statusPillTextActive: { color: ACCENT },

  // ── Card (generic) ───────────────────────────────────────────
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
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  cardBody: { padding: 16 },

  // ── Time row ─────────────────────────────────────────────────
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeSlot: { flex: 1, alignItems: "center", paddingVertical: 8 },
  timeSlotLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10, color: ACCENT,
    letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 5,
  },
  timeSlotTime: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 28, color: FG, letterSpacing: -0.8, lineHeight: 32,
  },
  timeSlotDate: { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: MUTED, marginTop: 2 },
  timeArrow: { alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  timeArrowLine: { width: 16, height: 1, backgroundColor: "#CBD5E1" },
  timeArrowDuration: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: SUBTLE, letterSpacing: 0.2 },

  // ── Progress bar (in-progress bookings) ──────────────────────
  progressWrap: { marginTop: 14 },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: ACCENT },

  // ── Extend row ───────────────────────────────────────────────
  extendRow: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE,
  },
  extendText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: ACCENT },

  // ── Detail rows (inside Details card) ────────────────────────
  detailRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: LINE },
  detailLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  detailValue: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: FG },
  detailRef: { fontFamily: "PlusJakartaSans-Bold", letterSpacing: 1.2, fontVariant: ["tabular-nums"] as const },

  // ── Getting in ───────────────────────────────────────────────
  instructionsText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED, lineHeight: 22 },
  codeBox: { padding: 16, backgroundColor: "#F9FAFB", borderRadius: 14, borderWidth: 1, borderColor: LINE },
  codeLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" as const, marginBottom: 6 },
  codeValue: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), fontSize: 30, color: FG, letterSpacing: 6, fontVariant: ["tabular-nums"] as const },

  // ── Cancellation note ────────────────────────────────────────
  cancellationNote: { paddingHorizontal: 4 },
  cancellationText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, lineHeight: 21 },
  sectionLink: { fontFamily: "PlusJakartaSans-SemiBold", color: ACCENT },

  // ── Actions ──────────────────────────────────────────────────
  actionsSection: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  secondaryBtn: {
    backgroundColor: "#fff", minHeight: 52, borderRadius: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1, borderColor: "#D5DCE3",
  },
  secondaryBtnText: { color: FG, fontSize: 15, fontFamily: "PlusJakartaSans-SemiBold", letterSpacing: -0.2 },
  errorText: { color: "#DC2626", fontSize: 13, textAlign: "center", fontFamily: "PlusJakartaSans-Regular" },
  cancelRow: {
    borderWidth: 1, borderColor: "#fca5a5", borderRadius: 14,
    backgroundColor: "#fff5f5",
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: "#DC2626" },
  linkRow: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 4 },
  linkText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: MUTED },
  linkTextDanger: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: "#DC2626" },
});
