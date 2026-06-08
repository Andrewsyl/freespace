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

const ACCENT = "#0a8050";
const FG     = "#101414";
const MUTED  = "#465050";
const SUBTLE = "#6B7575";
const LINE   = "#DDE5EC";
const BG     = "#F8FAFC";

const STATUS: Record<
  Props["statusTone"],
  { icon: string; pillBg: string; pillText: string }
> = {
  confirmed: { icon: "checkmark-circle",         pillBg: "rgba(255,255,255,0.93)", pillText: ACCENT      },
  active:    { icon: "play-circle",               pillBg: ACCENT,                  pillText: "#ffffff"    },
  completed: { icon: "checkmark-circle-outline",  pillBg: "rgba(255,255,255,0.93)", pillText: MUTED       },
  pending:   { icon: "time",                      pillBg: "rgba(255,255,255,0.93)", pillText: "#B6691A"   },
  canceled:  { icon: "close-circle-outline",      pillBg: "rgba(255,255,255,0.93)", pillText: "#DC2626"   },
  refunded:  { icon: "arrow-undo",                pillBg: "rgba(255,255,255,0.93)", pillText: "#2563EB"   },
};

export function BookingCard({
  booking,
  statusLabel,
  statusTone,
  dateLabel,
  timeLabel,
  onPress,
}: Props) {
  const badge = STATUS[statusTone];
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
      {/* ── Top: thumbnail + info ── */}
      <View style={styles.top}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="car-outline" size={28} color={SUBTLE} />
            </View>
          )}
          <View style={[styles.imagePill, { backgroundColor: badge.pillBg }]}>
            <Ionicons name={badge.icon as any} size={9} color={badge.pillText} />
            <Text style={[styles.imagePillText, { color: badge.pillText }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{booking.title}</Text>
            <Text style={styles.price}>€{price}</Text>
          </View>
          <Text style={styles.address} numberOfLines={1}>{booking.address}</Text>
          {secondaryLabel ? (
            <Text style={styles.secondaryMeta} numberOfLines={1}>{secondaryLabel}</Text>
          ) : null}
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
            <Ionicons name="navigate" size={11} color={ACCENT} />
          </View>
          <View style={styles.timeLine} />
        </View>

        <View style={[styles.timeColumn, { alignItems: "flex-end" }]}>
          <Text style={styles.timeLabel}>DEPARTURE</Text>
          <Text style={styles.timeValue}>{endTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>View details</Text>
        <Ionicons name="arrow-forward" size={13} color={ACCENT} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DCE4",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPressed: { opacity: 0.92 },

  // ── Top ──────────────────────────────────────────────────────
  top: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  imageWrap: {
    width: 82,
    height: 82,
    borderRadius: 12,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: BG,
  },
  thumb: { width: "100%", height: "100%" },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
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
    paddingVertical: 5,
  },
  imagePillText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.1,
  },
  info: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
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
    fontSize: 17,
    fontFamily: "PlusJakartaSans-Bold",
    color: ACCENT,
    letterSpacing: -0.3,
  },
  address: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Regular",
    color: MUTED,
  },
  secondaryMeta: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: ACCENT,
    marginTop: 2,
  },

  // ── Time strip ───────────────────────────────────────────────
  timeStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timeColumn: {
    flex: 1,
    alignItems: "flex-start",
  },
  timeLabel: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: ACCENT,
    letterSpacing: 0.9,
    textTransform: "uppercase",
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
    color: MUTED,
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
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Footer ───────────────────────────────────────────────────
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
    color: ACCENT,
  },
});
