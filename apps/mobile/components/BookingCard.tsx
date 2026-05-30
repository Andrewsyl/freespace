import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BookingSummary } from "../api";

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
const GREEN        = "#0fa968";
const GREEN_SOFT   = "#E6F2EC";
const GREEN_STRIP  = "#F0FAF5";
const FG           = "#111111";
const FG_MUTED     = "#6B6B6B";
const FG_SUBTLE    = "#9A9A9A";
const LINE         = "#EBEBEA";
const BG_2         = "#F5F5F4";

const STATUS_STYLES: Record<
  Props["statusTone"],
  { bg: string; text: string; icon: string }
> = {
  confirmed: { bg: GREEN_SOFT,  text: GREEN,       icon: "checkmark-circle"        },
  active:    { bg: GREEN,       text: "#ffffff",   icon: "play-circle"             },
  completed: { bg: BG_2,        text: FG_MUTED,    icon: "checkmark-circle-outline"},
  pending:   { bg: "#FDF1E0",   text: "#B6691A",   icon: "time"                    },
  canceled:  { bg: "#FBE2DE",   text: "#B5392B",   icon: "close-circle-outline"    },
  refunded:  { bg: "#E2EBF4",   text: "#2C6CA8",   icon: "arrow-undo"              },
};

export function BookingCard({
  booking,
  statusLabel,
  statusTone,
  dateLabel,
  timeLabel,
  onPress,
}: Props) {
  const badge = STATUS_STYLES[statusTone];
  const price = Math.round(booking.amountCents / 100);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const imageUrl =
    booking.imageUrls?.[0] ??
    (mapsKey && booking.latitude != null && booking.longitude != null
      ? `https://maps.googleapis.com/maps/api/streetview?size=240x240&location=${booking.latitude},${booking.longitude}&fov=70&key=${mapsKey}`
      : undefined);
  const [startTime, endTime] = timeLabel.split("–").map((s) => s.trim());

  const secondaryLabel =
    booking.accessCode
      ? "Access code"
      : booking.checkedInAt
      ? "Checked in"
      : booking.refundStatus === "succeeded"
      ? "Refund processed"
      : booking.receiptUrl
      ? "Receipt available"
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={null}
    >
      {/* ── Top section: thumbnail + info ── */}
      <View style={styles.top}>

        {/* Thumbnail with status overlay */}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="car-outline" size={26} color={FG_SUBTLE} />
            </View>
          )}
          {/* Status pill overlaid at bottom of image */}
          <View style={[styles.imagePill, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon as any} size={10} color={badge.text} />
            <Text style={[styles.imagePillText, { color: badge.text }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Text block */}
        <View style={styles.info}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{booking.title}</Text>
            <Text style={styles.price}>€{price}</Text>
          </View>

          {/* Address */}
          <Text style={styles.address} numberOfLines={1}>{booking.address}</Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="car-outline" size={13} color={FG_SUBTLE} />
              <Text style={styles.metaText}>
                {booking.vehiclePlate ?? "No plate"}
              </Text>
            </View>
            {secondaryLabel && (
              <Text style={styles.secondaryMeta} numberOfLines={1}>
                {secondaryLabel}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Time strip ── */}
      <View style={styles.timeStrip}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>ARRIVAL</Text>
          <Text style={styles.timeValue}>{startTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>

        <View style={styles.timeCenter}>
          <View style={styles.timeLine} />
          <View style={styles.timePuck}>
            <Ionicons name="navigate" size={12} color={GREEN} />
          </View>
          <View style={styles.timeLine} />
        </View>

        <View style={[styles.timeColumn, { alignItems: "flex-end" }]}>
          <Text style={styles.timeLabel}>DEPARTURE</Text>
          <Text style={styles.timeValue}>{endTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
      </View>

      {/* ── Footer CTA ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>View details</Text>
        <Ionicons name="arrow-forward" size={13} color={GREEN} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.93,
  },

  // ── Top ──
  top: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },

  // Image
  imageWrap: {
    width: 78,
    height: 78,
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: BG_2,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
  },
  imagePillText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.1,
  },

  // Info
  info: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Bold",
    color: FG,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  price: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans-Bold",
    color: GREEN,
    letterSpacing: -0.3,
  },
  address: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Regular",
    color: FG_MUTED,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    color: FG_MUTED,
  },
  secondaryMeta: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: GREEN,
    flexShrink: 1,
    textAlign: "right",
  },

  // ── Time strip ──
  timeStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_STRIP,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
  },
  timeColumn: {
    flex: 1,
    alignItems: "flex-start",
  },
  timeLabel: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: GREEN,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  timeValue: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Bold",
    color: FG,
    letterSpacing: -0.2,
  },
  timeDate: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans-Regular",
    color: FG_MUTED,
    marginTop: 1,
  },
  timeCenter: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  timeLine: {
    flex: 1,
    height: 1,
    backgroundColor: LINE,
    maxWidth: 28,
  },
  timePuck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: "#ffffff",
  },
  footerText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: GREEN,
  },
});
