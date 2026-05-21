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
  onPress,
}: Props) {
  const badgeStyle = STATUS_STYLES[statusTone];
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
                  color={statusTone === "canceled" ? colors.danger : "#2ECC8F"}
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
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    padding: 10,
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
    width: 96,
    paddingLeft: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "center",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  reference: {
    color: colors.textSoft,
    fontSize: 9,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  textContent: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
    paddingRight: 4,
    paddingBottom: 2,
    paddingLeft: 8,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "PlusJakartaSans-Bold",
    lineHeight: 21,
    letterSpacing: -0.25,
  },
  address: {
    color: colors.textMuted,
    fontSize: 11.5,
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
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeDanger: {
    backgroundColor: "#fff1f1",
    borderColor: "#f4d4d4",
  },
  statusBadgeText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
  },
  statusBadgeTextDanger: {
    color: colors.danger,
  },
  priceText: {
    color: colors.text,
    fontSize: 18,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.25,
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
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter-Medium",
  },
  secondaryMeta: {
    color: colors.textSoft,
    flexShrink: 1,
    fontFamily: "Inter-Medium",
    fontSize: 11,
    textAlign: "right",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  timeColumn: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 10,
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.45,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 13.5,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  timeDate: {
    fontSize: 10.5,
    color: colors.textMuted,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 8,
  },
  viewMoreText: {
    color: colors.accent,
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: -0.1,
  },
});
