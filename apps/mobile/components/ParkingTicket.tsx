import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Shared design tokens
const GREEN      = "#22c55e";
const GREEN_SOFT = "#E6F2EC";
const GREEN_BAND = "#F0FAF5";
const GREEN_LINE = "rgba(27,138,90,0.14)";
const FG         = "#111111";
const FG_MUTED   = "#6B6B6B";
const FG_SUBTLE  = "#9A9A9A";

type ParkingTicketProps = {
  companyName?: string;
  title?: string;
  location?: string;
  orderId?: string;
  paidAmount?: string;
  // Prefer separate time props; falls back to parsing `date`
  startTime?: string;
  endTime?: string;
  dateLabel?: string;
  date?: string;
  onExtend?: () => void;
  extendBusy?: boolean;
  // Legacy / unused — kept for backward compat
  companyAddress?: string;
  companySupportEmail?: string;
  companySubtitle?: string;
  spot?: string;
  barcodeText?: string;
};

export const ParkingTicket = memo(function ParkingTicket({
  companyName = "FreeSpace",
  title = "Parking Space",
  location = "Dublin, Ireland",
  orderId = "CP-XXXXXX",
  paidAmount = "€0.00",
  startTime: startTimeProp,
  endTime: endTimeProp,
  dateLabel: dateLabelProp,
  date = "",
  onExtend,
  extendBusy = false,
}: ParkingTicketProps) {
  // Parse legacy `date` string ("Mon, 25 May · 09:00 - 17:00") when
  // separate props aren't provided.
  const parts        = date.split(" · ");
  const timeParts    = (parts[1] ?? "").split(" - ").map((s) => s.trim());
  const startTime    = startTimeProp  ?? timeParts[0] ?? "";
  const endTime      = endTimeProp    ?? timeParts[1] ?? "";
  const dateLabel    = dateLabelProp  ?? parts[0] ?? "";

  return (
    <View style={styles.card}>

      {/* ── Header bar: brand + status ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandName}>{companyName}</Text>
        </View>
        <View style={styles.paidChip}>
          <Ionicons name="checkmark" size={11} color={GREEN} />
          <Text style={styles.paidChipText}>Paid</Text>
        </View>
      </View>

      {/* ── Content: listing + price ── */}
      <View style={styles.content}>
        <Text style={styles.listingName} numberOfLines={2}>{title}</Text>
        <Text style={styles.listingAddress} numberOfLines={1}>{location}</Text>

        <View style={styles.priceBlock}>
          <Text style={styles.priceEyebrow}>Amount paid</Text>
          <Text style={styles.priceValue}>{paidAmount}</Text>
        </View>
      </View>

      {/* ── Green band: time + reference ── */}
      <View style={styles.band}>

        {/* Boarding-pass time row */}
        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <Text style={styles.timeEyebrow}>ARRIVAL</Text>
            <Text style={styles.timeValue}>{startTime}</Text>
            <Text style={styles.timeDate}>{dateLabel}</Text>
          </View>

          <View style={styles.timePuck}>
            <Ionicons name="navigate" size={12} color={GREEN} />
          </View>

          <View style={[styles.timeCol, styles.timeColRight]}>
            <Text style={styles.timeEyebrow}>DEPARTURE</Text>
            <Text style={styles.timeValue}>{endTime}</Text>
            <Text style={styles.timeDate}>{dateLabel}</Text>
          </View>
        </View>

        {/* Extend button — sits between time and reference */}
        {onExtend ? (
          <Pressable
            style={({ pressed }) => [styles.extendRow, pressed && { opacity: 0.7 }]}
            onPress={onExtend}
            disabled={extendBusy}
          >
            <Ionicons name="time-outline" size={14} color={GREEN} />
            <Text style={styles.extendText}>
              {extendBusy ? "Extending…" : "Extend end time"}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={GREEN} />
          </Pressable>
        ) : null}

        <View style={styles.bandDivider} />

        {/* Reference row */}
        <View style={styles.refRow}>
          <View>
            <Text style={styles.refEyebrow}>Booking reference</Text>
            <Text style={styles.refValue}>{orderId}</Text>
          </View>
          <View style={styles.refPuck}>
            <Ionicons name="ticket-outline" size={18} color={GREEN} />
          </View>
        </View>

      </View>
    </View>
  );
});

export function ParkingTicketScene(props: ParkingTicketProps) {
  return (
    <View style={styles.scene}>
      <ParkingTicket {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: "#F2F2F1",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },

  // ── Header bar ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEA",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  brandName: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: FG_MUTED,
  },
  paidChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN_SOFT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paidChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: GREEN,
  },

  // ── Content ──
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 26,
  },
  listingName: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    color: FG,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  listingAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: FG_MUTED,
    marginTop: 3,
  },
  priceBlock: {
    marginTop: 22,
  },
  priceEyebrow: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    color: FG_SUBTLE,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  priceValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 40,
    color: GREEN,
    letterSpacing: -1.5,
    lineHeight: 46,
    fontVariant: ["tabular-nums"] as const,
  },

  // ── Green band ──
  band: {
    backgroundColor: GREEN_BAND,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  timeCol: {
    flex: 1,
  },
  timeColRight: {
    alignItems: "flex-end",
  },
  timeEyebrow: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 9,
    color: GREEN,
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  timeValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 24,
    color: FG,
    letterSpacing: -0.6,
  },
  timeDate: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: FG_MUTED,
    marginTop: 2,
  },
  timePuck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  extendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GREEN_LINE,
  },
  extendText: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: GREEN,
  },
  bandDivider: {
    height: 1,
    backgroundColor: GREEN_LINE,
    marginHorizontal: 20,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  refEyebrow: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 9,
    color: GREEN,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  refValue: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 19,
    color: FG,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"] as const,
  },
  refPuck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
});
