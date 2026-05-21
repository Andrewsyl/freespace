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

// Design tokens
const GREEN = "#1B8A5A";
const GREEN_SOFT = "#E6F2EC";
const FG = "#111111";
const FG_2 = "#3D3D3D";
const FG_MUTED = "#6B6B6B";
const FG_SUBTLE = "#9A9A9A";
const LINE = "#E6E6E4";
const LINE_2 = "#BEBEBE";
const BG_2 = "#F7F7F6";

const STATUS_STYLES: Record<
  Props["statusTone"],
  { background: string; text: string; icon: string; border: string }
> = {
  confirmed: { background: GREEN_SOFT, text: GREEN,      icon: "checkmark-circle",         border: GREEN     },
  active:    { background: GREEN,      text: "#ffffff",  icon: "play-circle",               border: GREEN     },
  completed: { background: BG_2,       text: FG_MUTED,  icon: "checkmark-circle-outline",  border: LINE      },
  pending:   { background: "#FDF1E0",  text: "#B6691A",  icon: "time",                      border: "#B6691A" },
  canceled:  { background: "#FBE2DE",  text: "#B5392B",  icon: "close-circle-outline",      border: "#B5392B" },
  refunded:  { background: "#E2EBF4",  text: "#2C6CA8",  icon: "arrow-undo",                border: "#2C6CA8" },
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
              <View style={[styles.statusBadge, { backgroundColor: badgeStyle.background, borderColor: badgeStyle.border }]}>
                <Ionicons name={badgeStyle.icon as any} size={11} color={badgeStyle.text} />
                <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
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
          <Ionicons name="arrow-forward" size={16} color={FG_SUBTLE} />
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Departure</Text>
          <Text style={styles.timeValue}>{endTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.viewMoreRow}>
        <Text style={styles.viewMoreText}>View details</Text>
        <Ionicons name="chevron-forward" size={14} color={FG_MUTED} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE_2,
    overflow: "hidden",
    padding: 12,
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
    width: 88,
    justifyContent: "center",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: BG_2,
  },
  reference: {
    color: FG_SUBTLE,
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  textContent: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
    paddingRight: 2,
    paddingBottom: 2,
    paddingLeft: 8,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: FG,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  address: {
    color: FG_MUTED,
    fontSize: 13,
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  priceGroup: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 6,
    paddingTop: 1,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
  },
  priceText: {
    color: FG,
    fontSize: 17,
    fontFamily: "Inter-Bold",
    letterSpacing: -0.2,
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
    gap: 5,
    flex: 1,
  },
  metaText: {
    color: FG_MUTED,
    fontSize: 13,
    fontFamily: "Inter-Regular",
  },
  secondaryMeta: {
    color: FG_SUBTLE,
    flexShrink: 1,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    textAlign: "right",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  timeColumn: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 11,
    color: FG_SUBTLE,
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: FG,
  },
  timeDate: {
    fontSize: 12,
    color: FG_MUTED,
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
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingBottom: 2,
  },
  viewMoreText: {
    color: FG_MUTED,
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
  },
});
