import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../styles/theme";
import type { BookingSummary } from "../api";
import { formatBookingReference } from "../utils/bookingFormat";

type Props = {
  booking: BookingSummary;
  statusLabel: string;
  statusTone: "confirmed" | "completed" | "pending" | "canceled" | "refunded" | "active";
  dateLabel: string;
  timeLabel: string;
  rating?: number;
  onPress: () => void;
};

const STATUS_STYLES: Record<
  Props["statusTone"],
  { background: string; text: string; icon: string; border: string }
> = {
  confirmed: {
    background: colors.status.confirmed.background,
    text: colors.status.confirmed.text,
    icon: "checkmark-circle",
    border: colors.status.confirmed.border,
  },
  active: {
    background: colors.status.active.background,
    text: colors.status.active.text,
    icon: "play-circle",
    border: colors.status.active.border,
  },
  completed: {
    background: colors.status.completed.background,
    text: colors.status.completed.text,
    icon: "checkmark-circle-outline",
    border: colors.status.completed.border,
  },
  pending: {
    background: colors.status.pending.background,
    text: colors.status.pending.text,
    icon: "time",
    border: colors.status.pending.border,
  },
  canceled: {
    background: colors.status.canceled.background,
    text: colors.status.canceled.text,
    icon: "close-circle-outline",
    border: colors.status.canceled.border,
  },
  refunded: {
    background: colors.status.refunded.background,
    text: colors.status.refunded.text,
    icon: "arrow-undo",
    border: colors.status.refunded.border,
  },
};


export function BookingCard({
  booking,
  statusLabel,
  statusTone,
  dateLabel,
  timeLabel,
  rating,
  onPress,
}: Props) {
  const badgeStyle = STATUS_STYLES[statusTone];
  const ratingValue = typeof rating === "number" ? Math.round(rating) : null;
  const price = Math.round(booking.amountCents / 100);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const imageUrl =
    booking.imageUrls?.[0] ??
    (mapsKey && booking.latitude != null && booking.longitude != null
      ? `https://maps.googleapis.com/maps/api/streetview?size=240x240&location=${booking.latitude},${booking.longitude}&fov=70&key=${mapsKey}`
      : undefined);
  const [startTime, endTime] = timeLabel.split("–").map((item) => item.trim());
  const secondaryLabel =
    booking.accessCode
      ? "Access code"
      : booking.checkedInAt
      ? "Checked in"
      : booking.refundStatus === "succeeded"
      ? "Refund processed"
      : booking.receiptUrl
      ? "Receipt available"
      : statusLabel;

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      android_ripple={null}
    >
      <View style={styles.mainContent}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}
        </View>
        <View style={styles.textContent}>
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={styles.reference}>{formatBookingReference(booking.id)}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {booking.title}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {booking.address}
              </Text>
            </View>
            <View style={styles.priceGroup}>
              <View
                style={[
                  styles.statusBadge,
                  statusTone === "canceled" && styles.statusBadgeDanger,
                ]}
              >
                <Ionicons
                  name={badgeStyle.icon as any}
                  size={12}
                  color={statusTone === "canceled" ? colors.danger : "#158a83"}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    statusTone === "canceled" && styles.statusBadgeTextDanger,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
              <Text style={styles.priceText}>€{price}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="car-outline" size={14} color={colors.textSoft} />
              <Text style={styles.metaText}>
                {booking.vehiclePlate ? booking.vehiclePlate : "Not selected"}
              </Text>
            </View>
            <Text style={styles.secondaryMeta} numberOfLines={1}>
              {secondaryLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.timeBlock}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Arrival</Text>
          <Text style={styles.timeValue}>{startTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
        <View style={styles.timeArrow}>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Departure</Text>
          <Text style={styles.timeValue}>{endTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.viewMoreRow}>
        <Text style={styles.viewMoreText}>VIEW MORE</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffef9",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e3e7ea",
    overflow: "hidden",
    padding: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  mainContent: {
    flexDirection: "row",
  },
  imageWrap: {
    width: 102,
    paddingLeft: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "center",
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: "#d9dfe4",
  },
  thumbPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 13,
    backgroundColor: colors.border,
  },
  reference: {
    color: "#8a949d",
    fontSize: 9.5,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  textContent: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 4,
    paddingLeft: 10,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: "#111827",
    fontSize: 17,
    fontFamily: "PlusJakartaSans-Bold",
    lineHeight: 22,
    letterSpacing: -0.35,
  },
  address: {
    color: "#4b5563",
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 3,
  },
  priceGroup: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 6,
    paddingTop: 1,
  },
  statusBadge: {
    alignItems: "center",
    backgroundColor: "#eef8f5",
    borderColor: "#d8ebe5",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeDanger: {
    backgroundColor: "#fff1f1",
    borderColor: "#f4d4d4",
  },
  statusBadgeText: {
    color: "#158a83",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10.5,
  },
  statusBadgeTextDanger: {
    color: colors.danger,
  },
  priceText: {
    color: "#111827",
    fontSize: 19,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.35,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  metaText: {
    color: "#5d7773",
    fontSize: 11.5,
    fontFamily: "Inter-Medium",
  },
  secondaryMeta: {
    color: "#7a8288",
    flexShrink: 1,
    fontFamily: "Inter-Medium",
    fontSize: 11.5,
    textAlign: "right",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e8edf0",
    marginTop: 8,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  timeColumn: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 10,
    color: "#7a8288",
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.45,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Bold",
    color: "#111827",
  },
  timeDate: {
    fontSize: 10.5,
    color: "#6b7280",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  timeArrow: {
    width: 32,
    alignItems: "center",
  },
  viewMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 0,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#e8edf0",
    paddingBottom: 7,
  },
  viewMoreText: {
    color: "#158a83",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: -0.1,
  },
});
