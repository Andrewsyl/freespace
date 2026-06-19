import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  MapPin,
  Phone,
  MessageCircle,
  XCircle,
} from "lucide-react-native";
import { hostCancelBooking, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import type { RootStackParamList } from "../types";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "HostBookingDetail">;

const GREEN  = "#0a8050";
const FG     = "#111827";
const MUTED  = "#6B7575";
const BG     = "#F8FAFC";
const CARD   = "#ffffff";

const SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const dublinDay = (d: Date) =>
  d.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" });

function formatFullDayTime(date: Date): string {
  const day = date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Dublin",
  });
  const time = date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  return `${day}, ${time}`;
}

function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
}

function vehicleSummary(booking: BookingSummary): string | null {
  const desc = [
    booking.driverVehicleColor?.trim(),
    booking.driverVehicleMake?.trim(),
    booking.driverVehicleType?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  return desc || null;
}

function driverInitial(booking: BookingSummary): string {
  return (booking.driverName?.trim() || "D")[0].toUpperCase();
}


export function HostBookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [canceling, setCanceling] = useState(false);

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const now = Date.now();
  const isCanceled = localStatus === "canceled" || booking.refundStatus === "refunded";
  const isLive = !isCanceled && localStatus === "confirmed" && start.getTime() <= now && now < end.getTime();
  const isPast = end.getTime() <= now;
  const isUpcoming = !isCanceled && !isLive && start.getTime() > now;
  const canCancel = !isCanceled && !isPast && localStatus === "confirmed";

  const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const phone = booking.driverPhone?.trim() || null;
  const vehicle = vehicleSummary(booking);
  const plate = booking.vehiclePlate?.trim() || null;
  const checkedInAt = booking.checkedInAt ? new Date(booking.checkedInAt) : null;
  const accessCode = booking.accessCode?.trim() || null;
  const arrivalInstructions = booking.arrivalInstructions?.trim() || null;

  const statusConfig = isCanceled
    ? { label: "Canceled",  accent: "#f87171", cardBg: "#fff8f8", labelColor: "#b42318", dot: false }
    : isLive
      ? { label: "Live now", accent: GREEN,    cardBg: "#f2faf6", labelColor: "#065f46", dot: true  }
      : isPast
        ? { label: "Completed", accent: "#94a3b8", cardBg: "#f8fafc", labelColor: "#475569", dot: false }
        : { label: "Upcoming",  accent: "#3b82f6", cardBg: "#f0f6ff", labelColor: "#1d4ed8", dot: false };

  const handleCancel = () => {
    if (!token) return;
    Alert.alert(
      "Cancel this booking?",
      "The driver will be notified and refunded in full.",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            setCanceling(true);
            try {
              await hostCancelBooking({ token, bookingId: booking.id });
              setLocalStatus("canceled");
            } catch (err) {
              Alert.alert(
                "Could not cancel",
                err instanceof Error ? err.message : "Please try again."
              );
            } finally {
              setCanceling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackOrFallback(navigation, fallbackRoutes.listings)}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={FG} />
        </Pressable>
        <Text style={styles.navTitle}>Booking</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 48 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={[styles.heroCard, SHADOW, { backgroundColor: statusConfig.cardBg }]}>
          {/* Accent bar */}
          <View style={[styles.heroAccent, { backgroundColor: statusConfig.accent }]} />

          <View style={styles.heroInner}>
            {/* Status label */}
            <View style={styles.heroStatusRow}>
              {statusConfig.dot ? (
                <View style={[styles.heroLiveDot, { backgroundColor: statusConfig.accent }]} />
              ) : null}
              <Text style={[styles.heroStatusLabel, { color: statusConfig.labelColor }]}>
                {statusConfig.label}
              </Text>
            </View>

            {/* Space name */}
            <Text style={styles.heroTitle} numberOfLines={2}>
              {booking.title || booking.address}
            </Text>

            {/* Address */}
            {booking.address ? (
              <View style={styles.heroAddressRow}>
                <MapPin size={13} color={MUTED} strokeWidth={2} />
                <Text style={styles.heroAddressText} numberOfLines={2}>{booking.address}</Text>
              </View>
            ) : null}

            {/* Times — FROM / TO two-column */}
            <View style={styles.heroTimesBlock}>
              <View style={styles.heroTimeCol}>
                <Text style={styles.heroTimeLabel}>FROM</Text>
                <Text style={styles.heroTimeValue}>{formatTimeOnly(start)}</Text>
                <Text style={styles.heroTimeDate}>
                  {start.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Dublin" })}
                </Text>
              </View>
              <View style={styles.heroTimeArrow}>
                <Text style={styles.heroTimeArrowText}>→</Text>
              </View>
              <View style={styles.heroTimeCol}>
                <Text style={styles.heroTimeLabel}>TO</Text>
                <Text style={styles.heroTimeValue}>{formatTimeOnly(end)}</Text>
                <Text style={styles.heroTimeDate}>
                  {end.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Dublin" })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings card */}
        <View style={[styles.earningsCard, SHADOW]}>
          <View style={styles.earningsLeft}>
            <Text style={styles.earningsLabel}>
              {isCanceled ? "Refunded to driver" : "You earn"}
            </Text>
            <Text style={[styles.earningsAmount, isCanceled && styles.earningsAmountCanceled]}>
              {fmt(booking.amountCents)}
            </Text>
          </View>
          <View style={styles.earningsRight}>
            <View style={styles.feePill}>
              <Text style={styles.feePillText}>0% fee</Text>
            </View>
            <Text style={styles.feeSubtext}>keep it all</Text>
          </View>
        </View>

        {/* Driver card */}
        <View style={[styles.card, SHADOW]}>
          {/* Name + avatar row */}
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{driverInitial(booking)}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{booking.driverName?.trim() || "Booked driver"}</Text>
              <Text style={styles.driverSubtext}>Driver</Text>
            </View>
            {checkedInAt ? (
              <View style={styles.checkedInPill}>
                <CheckCircle2 size={12} color={GREEN} strokeWidth={2.5} />
                <Text style={styles.checkedInPillText}>Checked in</Text>
              </View>
            ) : null}
            {booking.noShowAt ? (
              <View style={styles.noShowPill}>
                <XCircle size={12} color="#b42318" strokeWidth={2.5} />
                <Text style={styles.noShowPillText}>No show</Text>
              </View>
            ) : null}
          </View>

          {/* Vehicle block */}
          {(booking.driverVehicleMake || booking.driverVehicleColor || booking.driverVehicleType || plate) ? (
            <View style={styles.vehicleBlock}>
              {/* Make row */}
              {booking.driverVehicleMake ? (
                <View style={styles.vehicleMakeRow}>
                  <VehicleBrandLogo make={booking.driverVehicleMake} size={26} />
                  <Text style={styles.vehicleMake}>{booking.driverVehicleMake}</Text>
                </View>
              ) : null}

              {/* Color + type row */}
              {(booking.driverVehicleColor || booking.driverVehicleType) ? (
                <View style={styles.vehicleDetailsRow}>
                  {booking.driverVehicleColor ? (
                    <View style={styles.vehicleDetailChip}>
                      <Text style={styles.vehicleDetailChipText}>
                        {booking.driverVehicleColor}
                      </Text>
                    </View>
                  ) : null}
                  {booking.driverVehicleType ? (
                    <View style={styles.vehicleDetailChip}>
                      <Text style={styles.vehicleDetailChipText}>
                        {booking.driverVehicleType}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Plate */}
              {plate ? (
                <View style={styles.plateRow}>
                  <View style={styles.plateBadge}>
                    <Text style={styles.plateText}>{plate}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Contact buttons */}
          {phone ? (
            <View style={styles.contactRow}>
              <Pressable
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${phone}`)}
                hitSlop={6}
              >
                <Phone size={15} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.contactBtnText}>Call driver</Text>
              </Pressable>
              <Pressable
                style={[styles.contactBtn, styles.contactBtnSecondary]}
                onPress={() => Linking.openURL(`sms:${phone}`)}
                hitSlop={6}
              >
                <MessageCircle size={15} color={GREEN} strokeWidth={2.2} />
                <Text style={[styles.contactBtnText, styles.contactBtnTextSecondary]}>Text</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Access */}
        {(accessCode || arrivalInstructions) ? (
          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardSectionLabel}>Access</Text>
            {accessCode ? (
              <View style={styles.accessCodeRow}>
                <KeyRound size={15} color={GREEN} strokeWidth={2} />
                <Text style={styles.accessCodeText}>{accessCode}</Text>
              </View>
            ) : null}
            {arrivalInstructions ? (
              <Text style={styles.instructionsText}>{arrivalInstructions}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Cancel */}
        {canCancel ? (
          <View style={styles.cancelSection}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={canceling}
            >
              {canceling ? (
                <ActivityIndicator size={14} color="#b42318" />
              ) : (
                <Text style={styles.cancelBtnText}>Cancel booking</Text>
              )}
            </Pressable>
            <Text style={styles.cancelHint}>
              The driver is refunded in full{isUpcoming ? "" : " and asked to leave"}.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  backBtn: { padding: 8, marginLeft: -8, width: 38 },
  navTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
  },

  scroll: { paddingTop: 12, paddingHorizontal: 16, gap: 14 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  heroAccent: {
    height: 5,
    width: "100%",
  },
  heroInner: {
    padding: 20,
    gap: 10,
  },
  heroStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroLiveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  heroStatusLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    color: FG,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  heroAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  heroAddressText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    flex: 1,
    lineHeight: 18,
  },
  heroTimesBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.07)",
  },
  heroTimeCol: {
    flex: 1,
    gap: 3,
  },
  heroTimeLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTimeValue: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 28,
    color: FG,
    letterSpacing: -1,
    lineHeight: 34,
  },
  heroTimeDate: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: MUTED,
  },
  heroTimeArrow: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  heroTimeArrowText: {
    fontSize: 18,
    color: MUTED,
  },

  // Earnings card
  earningsCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  earningsLeft: { gap: 3 },
  earningsLabel: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
  },
  earningsAmount: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 34,
    color: FG,
    letterSpacing: -1,
    lineHeight: 40,
  },
  earningsAmountCanceled: { color: "#94a3b8" },
  earningsRight: { alignItems: "flex-end", gap: 4 },
  feePill: {
    backgroundColor: "#F0FAF6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  feePillText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: GREEN,
  },
  feeSubtext: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: MUTED,
  },

  // Card (driver + access)
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardSectionLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Driver
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: GREEN,
  },
  driverInfo: { flex: 1, gap: 2 },
  driverName: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
  },
  driverSubtext: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: MUTED,
  },
  checkedInPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FAF6",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  checkedInPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: GREEN,
  },
  noShowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff5f5",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  noShowPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: "#b42318",
  },
  vehicleBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  vehicleMakeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vehicleMake: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: FG,
    letterSpacing: -0.3,
  },
  vehicleDetailsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  vehicleDetailChip: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDE5EC",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vehicleDetailChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: MUTED,
    textTransform: "capitalize",
  },
  plateRow: {
    borderTopWidth: 1,
    borderTopColor: "#E8EEF4",
    paddingTop: 12,
  },
  plateBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    color: FG,
    letterSpacing: 1.5,
  },
  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  contactBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  contactBtnSecondary: {
    backgroundColor: "#F0FAF6",
    borderWidth: 1,
    borderColor: "#B6E8D0",
  },
  contactBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  contactBtnTextSecondary: { color: GREEN },

  // Access
  accessCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FAF6",
    borderRadius: 12,
    padding: 14,
  },
  accessCodeText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    color: GREEN,
    letterSpacing: 2,
  },
  instructionsText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
  },

  // Cancel
  cancelSection: { gap: 10 },
  cancelBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fcd5d5",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: "#b42318",
  },
  cancelHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
  },
});
