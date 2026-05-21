import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Image,
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
import { StatusBar } from "expo-status-bar";
import { formatTimeLabel } from "../utils/dateFormat";
import { formatBookingReference } from "../utils/bookingFormat";
import { ParkingTicket } from "../components/ParkingTicket";
import freeSpaceLogo from "../assets/logo-freespace-black-hd.png";
import { colors } from "../styles/theme";

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
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
  const barcodeRaw = booking.id.replace(/-/g, "").slice(0, 12).toUpperCase();
  const barcodeText =
    barcodeRaw.length >= 12
      ? `${barcodeRaw.slice(0, 4)} ${barcodeRaw.slice(4, 8)} ${barcodeRaw.slice(8, 12)}`
      : barcodeRaw;

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

  const handleContactSupport = () => {
    navigation.navigate("Support", {
      prefillSubject: isCanceled ? "Refund request" : "Payment or refund",
      prefillMessage: `Booking reference: ${formatBookingReference(booking.id)}\nListing: ${booking.title}\nIssue:\n`,
    });
  };

  const openSupportCase = (subject: string, issue: string) => {
    navigation.navigate("Support", {
      prefillSubject: subject,
      prefillMessage: `Booking reference: ${formatBookingReference(booking.id)}\nListing: ${booking.title}\nIssue: ${issue}\n\nWhat happened:\n`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" translucent={false} backgroundColor={colors.appBg} />
      <View style={styles.header}>
        <Pressable style={styles.backCircleButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#111827" />
        </Pressable>
        <Image
          source={freeSpaceLogo}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        {/* Review Card */}
        {canReview ? (
          reviewed ? (
            <View style={[styles.reviewButton, styles.reviewButtonTopSpacing]}>
              <View style={styles.reviewedStars}>
                {Array.from({ length: 5 }).map((_, index) => {
                  const filled = reviewedRating != null && index < Math.round(reviewedRating);
                  return (
                    <Ionicons
                      key={`review-star-${index}`}
                      name="star"
                      size={16}
                      color={filled ? "#FBBF24" : "#E5E7EB"}
                    />
                  );
                })}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.reviewButton, styles.reviewButtonTopSpacing]}
              onPress={() => navigation.navigate("Review", { booking })}
            >
              <Ionicons name="star-outline" size={20} color="#2ECC8F" />
              <Text style={styles.reviewButtonText}>Leave a review</Text>
            </TouchableOpacity>
          )
        ) : null}

        <ParkingTicket
          companyName="FREESPACE"
          companySubtitle="PARKING MARKETPLACE"
          companyAddress="Dublin, Ireland"
          companySupportEmail="support@freespace.ie"
          title="PARKING RECEIPT"
          date={bookingDateLabel}
          location={booking.address}
          orderId={formatBookingReference(booking.id)}
          spot="1 Parking Space"
          paidAmount={`€${(localAmountCents / 100).toFixed(2)}`}
          barcodeText={barcodeText}
        />

        {(isUpcoming || isInProgress) && !isCanceled ? (
          <TouchableOpacity style={styles.actionBtn} onPress={handleOpenMaps}>
            <Text style={styles.actionBtnText}>Get Directions</Text>
          </TouchableOpacity>
        ) : null}

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

        {!isCanceled ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>If something goes wrong</Text>
            <View style={styles.edgeCaseList}>
              <Text style={styles.edgeCaseItem}>
                If access fails, try the arrival details first. If you still cannot get in, contact support immediately so we can investigate and review refund eligibility.
              </Text>
              <Text style={styles.edgeCaseItem}>
                If a host cancels, we will cancel the booking, notify you, and return any eligible refund to the original payment method.
              </Text>
              <Text style={styles.edgeCaseItem}>
                If you do not show up, the booking still counts once the booked window starts unless support confirms a host-side access issue.
              </Text>
              <Text style={styles.edgeCaseItem}>
                If you need extra time, extend before the session ends. Unauthorised overstays can trigger enforcement or reduce refund eligibility.
              </Text>
            </View>
            <View style={styles.helpChips}>
              <TouchableOpacity
                style={styles.helpChip}
                onPress={() => openSupportCase("Access issue", "I could not access the booked space.")}
              >
                <Text style={styles.helpChipText}>Access issue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpChip}
                onPress={() => openSupportCase("Host canceled", "The host canceled or could not honor this booking.")}
              >
                <Text style={styles.helpChipText}>Host canceled</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpChip}
                onPress={() => openSupportCase("No-show or overstay", "I need help with no-show or overstay handling.")}
              >
                <Text style={styles.helpChipText}>No-show / overstay</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isCanceled ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Cancellation and refund</Text>
            <Text style={styles.infoCardBody}>
              {cancellationSource === "host"
                ? isRefunded
                  ? `The host canceled this booking. Your refund has been submitted to the original payment method${localRefundedAt ? ` on ${new Date(localRefundedAt).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Dublin" })}` : ""}.`
                  : "The host canceled this booking. If the refund has not appeared yet, contact support and we will trace it."
                : isRefunded
                  ? `This booking was canceled and the refund has been submitted to your original payment method${localRefundedAt ? ` on ${new Date(localRefundedAt).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Dublin" })}` : ""}.`
                  : "This booking was canceled. If you expected a refund and do not see one yet, contact support with your booking reference."}
            </Text>
            <TouchableOpacity style={styles.secondaryLinkButton} onPress={handleContactSupport}>
              <Text style={styles.secondaryLinkButtonText}>
                {cancellationSource === "host"
                  ? "Need help with host cancellation?"
                  : isRefunded
                    ? "Need refund help?"
                    : "Request refund support"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action Buttons */}
        {isUpcoming && localStatus !== "canceled" ? (
          <>
            {canCheckIn ? (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCheckIn}>
                <Text style={styles.actionBtnText}>Check In</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.dangerButton, canceling && styles.dangerButtonDisabled]}
              onPress={handleCancel}
              disabled={canceling}
            >
              <Text style={styles.dangerButtonText}>
                {canceling ? "Canceling..." : "Cancel Booking"}
              </Text>
            </TouchableOpacity>
          </>
        ) : receiptUrl ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(receiptUrl)}>
            <Text style={styles.actionBtnText}>View Receipt</Text>
          </TouchableOpacity>
        ) : null}

        {isInProgress ? (
          <TouchableOpacity
            style={[styles.actionBtn, extendBusy && styles.actionBtnDisabled]}
            onPress={() => setExtendOpen(true)}
            disabled={extendBusy}
          >
            <Text style={styles.actionBtnText}>
              {extendBusy ? "Extending..." : "Extend Booking"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}

        {canBookAgain ? (
          <TouchableOpacity style={styles.bookAgainButton} onPress={handleBookAgain}>
            <Text style={styles.bookAgainText}>Book again</Text>
          </TouchableOpacity>
        ) : null}

        {/* Help Button */}
        <TouchableOpacity style={styles.helpButton} onPress={handleContactSupport}>
          <Ionicons name="help-circle-outline" size={28} color="#2ECC8F" />
          <Text style={styles.helpText}>Need help?</Text>
        </TouchableOpacity>
      </ScrollView>

      <DatePicker
        modal
        open={extendOpen}
        date={minExtendTime}
        minimumDate={minExtendTime}
        mode="datetime"
        minuteInterval={30}
        onConfirm={(date) => {
          setExtendOpen(false);
          handleExtend(date);
        }}
        onCancel={() => {
          setExtendOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.appBg,
  },

  backCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },

  headerLogo: {
    width: 130,
    height: 34,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 44,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  ticketPerforationTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 3,
  },
  ticketPerforationBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 3,
  },
  perfCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC8F',
  },
  receiptSection: {
    paddingVertical: 12,
  },
  receiptTitle: {
    color: '#1A1A2E',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  receiptSubtitle: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 4,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  slotCard: {
    width: '42%',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#EEF2F4',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotDivider: {
    width: 1,
    height: 90,
    borderRightWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9DEE2',
  },
  entryLabel: {
    color: '#2ECC8F',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  exitLabel: {
    color: '#E74C3C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  slotTimeText: {
    color: '#999999',
    fontSize: 11,
    marginTop: 3,
  },
  receiptDashLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
    marginVertical: 4,
  },
  ticketDividerWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 2,
  },
  ticketNotchLeft: {
    position: 'absolute',
    left: -36,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2ECC8F',
    zIndex: 2,
  },
  ticketNotchRight: {
    position: 'absolute',
    right: -36,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2ECC8F',
    zIndex: 2,
  },
  barcodeWrap: {
    marginTop: 14,
    marginBottom: 14,
    alignSelf: 'center',
    height: 24,
    width: 150,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  barcodeBar: {
    backgroundColor: '#111827',
    height: '100%',
    borderRadius: 1,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  durationText: {
    color: '#999999',
    fontSize: 13,
  },
  billAmount: {
    color: '#1A1A2E',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  payButton: {
    backgroundColor: '#3B9DDD',
    height: 52,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // Review card
  reviewCard: {
    backgroundColor: '#2ECC8F',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    alignItems: 'center',
  },

  reviewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },

  // Review button
  reviewButton: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewButtonTopSpacing: {
    marginTop: 20,
  },

  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    fontFamily: 'Inter-SemiBold',
  },
  reviewedStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Outer Green Card - creates the "frame" effect
  outerGreenCard: {
    backgroundColor: '#2ECC8F', // Dark green
    marginHorizontal: 20,
    borderRadius: 18,
    paddingHorizontal: 2,
    paddingBottom: 2,
    overflow: 'hidden',
  },

  outerGreenCardCanceled: {
    backgroundColor: '#DC2626',
  },

  outerGreenCardRefunded: {
    backgroundColor: '#3B82F6',
  },

  outerGreenCardInProgress: {
    backgroundColor: '#F59E0B', // Amber/Orange
  },

  outerGreenCardUpcoming: {
    backgroundColor: '#8B5CF6', // Purple
  },

  // Status Header - dark green area at top
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },

  statusHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Inner White Content - has its own rounded corners
  innerWhiteContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 18,
  },

  // Listing row
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },

  carIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listingText: {
    flex: 1,
  },

  listingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.2,
    fontFamily: 'Inter-SemiBold',
  },

  listingSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },

  // Detail rows - vertical stacked layout
  detailRow: {
    paddingVertical: 12,
    alignItems: 'flex-start',
  },

  // Detail rows - horizontal layout (label left, value right)
  detailRowHorizontal: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Detail rows - two columns side by side
  detailRowDouble: {
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 16,
  },

  detailRowDoubleItem: {
    flex: 1,
    alignItems: 'flex-start',
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'System',
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'System',
  },

  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    fontFamily: 'System',
  },

  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    fontFamily: 'System',
  },

  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },

  // Map section
  mapSection: {
    marginHorizontal: 0,
    marginBottom: 20,
  },

  mapTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
    fontFamily: 'Inter-SemiBold',
  },

  mapAddress: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
  },

  parkingImage: {
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },

  map: {
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
  },

  mapImageButton: {
    borderRadius: 0,
    overflow: "hidden",
    marginBottom: 12,
  },

  mapImage: {
    height: 200,
    width: "100%",
    backgroundColor: "#F3F4F6",
  },

  mapPlaceholder: {
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  mapPlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },

  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 4,
    marginHorizontal: 20,
  },

  mapButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
  },

  // Action buttons
  actionBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 0,
    marginTop: 16,
    alignItems: 'center',
  },

  actionBtnDisabled: {
    opacity: 0.6,
  },

  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  bookAgainButton: {
    marginTop: 12,
    marginHorizontal: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookAgainText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },

  dangerButton: {
    borderWidth: 1,
    borderColor: '#f6caca',
    backgroundColor: '#fff7f7',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 0,
    marginTop: 12,
    alignItems: 'center',
  },

  dangerButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },

  dangerButtonDisabled: {
    opacity: 0.6,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 0,
  },

  infoCard: {
    marginTop: 16,
    marginHorizontal: 0,
    borderRadius: 12,
    padding: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  infoCardBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  edgeCaseList: {
    gap: 10,
  },
  edgeCaseItem: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  accessCodeWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoCardLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    fontFamily: 'Inter-SemiBold',
  },
  accessCodeValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'Inter-Bold',
  },
  secondaryLinkButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLinkButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
  },
  helpChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  helpChip: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  helpChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },

  // Help button
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
    marginHorizontal: 0,
  },

  helpText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
});
