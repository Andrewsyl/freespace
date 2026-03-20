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
import DatePicker from "react-native-date-picker";
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

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [localStatus, setLocalStatus] = useState(booking.status);
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
  const canReview = end.getTime() <= now && booking.status === "confirmed";
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
  const canBookAgain = !isUpcoming && !isInProgress;
  const bookingDateLabel = `${start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
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
      await cancelBooking({ token, bookingId: booking.id });
      await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
      setLocalStatus("canceled");
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
    Alert.alert("Cancel booking", "Cancel this reservation and release the space?", [
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
        returnURL: "carparking://stripe-redirect",
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" translucent={false} backgroundColor="#2ECC8F" />
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

        {/* Action Buttons */}
        {isUpcoming && localStatus !== "cancelled" ? (
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
        <TouchableOpacity style={styles.helpButton}>
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
    backgroundColor: '#2ECC8F',
  },

  header: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },

  backCircleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 34,
    height: 34,
  },

  headerLogo: {
    width: 130,
    height: 34,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
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
    fontSize: 22,
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
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  reviewButtonTopSpacing: {
    marginTop: 20,
  },

  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
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
    borderRadius: 28, // Outer corner radius
    paddingHorizontal: 4, // Thin green "border" on sides
    paddingBottom: 4, // Thin green "border" at bottom
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 24, // Match outer container radius
    borderBottomRightRadius: 24, // Match outer container radius
    padding: 20,
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
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.2,
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
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
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
    borderColor: '#2ECC8F',
    borderRadius: 16,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 4,
    marginHorizontal: 20,
  },

  mapButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },

  // Action buttons
  actionBtn: {
    backgroundColor: '#2ECC8F',
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },

  actionBtnDisabled: {
    opacity: 0.6,
  },

  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  bookAgainButton: {
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: '#2ECC8F',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookAgainText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  dangerButton: {
    borderWidth: 2,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
  },

  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },

  dangerButtonDisabled: {
    opacity: 0.6,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 20,
  },

  // Help button
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
    marginHorizontal: 20,
  },

  helpText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2ECC8F',
  },
});
