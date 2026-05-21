import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Design tokens
const GREEN      = "#1B8A5A";
const GREEN_SOFT = "#E6F2EC";
const FG         = "#111111";
const FG_2       = "#3D3D3D";
const FG_MUTED   = "#6B6B6B";
const FG_SUBTLE  = "#9A9A9A";
const LINE       = "#E6E6E4";
const LINE_2     = "#D4D4D2";
const BG_2       = "#F7F7F6";

type ParkingTicketProps = {
  companyName?: string;
  companyAddress?: string;
  companySupportEmail?: string;
  title?: string;
  date?: string;
  location?: string;
  orderId?: string;
  spot?: string;
  paidAmount?: string;
  onExtend?: () => void;
  extendBusy?: boolean;
  // legacy props — accepted but unused
  companySubtitle?: string;
  barcodeText?: string;
};

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export const ParkingTicket = memo(function ParkingTicket({
  companyName = "FreeSpace",
  companyAddress = "Dublin, Ireland",
  companySupportEmail = "support@freespace.ie",
  title = "Parking receipt",
  date = "Wed, 11 Feb · 11:14 – 13:14",
  location = "College Green, Dublin 2",
  orderId = "CP-CEF24A",
  spot = "1 Parking Space",
  paidAmount = "€3.00",
  onExtend,
  extendBusy = false,
}: ParkingTicketProps) {
  return (
    <View style={styles.card}>

      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>{companyName}</Text>
          </View>
          <View style={styles.paidChip}>
            <Ionicons name="checkmark" size={11} color={GREEN} />
            <Text style={styles.paidChipText}>Paid</Text>
          </View>
        </View>
        <Text style={styles.receiptTitle}>{title}</Text>
        <Text style={styles.receiptMeta}>{companyAddress}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── Amount ─────────────────────────────── */}
      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>Amount paid</Text>
        <Text style={styles.amountValue}>{paidAmount}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── Info rows ──────────────────────────── */}
      <InfoRow label="Reference" value={orderId} mono />
      <InfoRow label="Date"      value={date} />
      {onExtend ? (
        <Pressable
          style={({ pressed }) => [styles.extendRow, pressed && styles.extendRowPressed]}
          onPress={onExtend}
          disabled={extendBusy}
        >
          <Ionicons name="time-outline" size={14} color={GREEN} />
          <Text style={styles.extendLabel}>
            {extendBusy ? "Extending…" : "Extend end time"}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={GREEN} />
        </Pressable>
      ) : null}
      <InfoRow label="Location"  value={location} />
      <InfoRow label="Product"   value={spot} />

      <View style={styles.divider} />

      {/* ── Reference code block ───────────────── */}
      <View style={styles.codeBlock}>
        <Text style={styles.codeEyebrow}>Booking reference</Text>
        <Text style={styles.codeValue}>{orderId}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── Footer ─────────────────────────────── */}
      <View style={styles.footer}>
        <Ionicons name="mail-outline" size={13} color={FG_SUBTLE} />
        <Text style={styles.footerText}>{companySupportEmail}</Text>
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
    backgroundColor: BG_2,
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE_2,
    overflow: "hidden",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
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
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    color: FG_2,
    letterSpacing: -0.1,
  },
  paidChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN_SOFT,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  paidChipText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    color: GREEN,
  },
  receiptTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 17,
    lineHeight: 22,
    color: FG,
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  receiptMeta: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: FG_MUTED,
  },

  divider: {
    height: 1,
    backgroundColor: LINE,
  },

  // Amount
  amountBlock: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  amountLabel: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    color: FG_SUBTLE,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  amountValue: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
    lineHeight: 37,
    color: FG,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"] as const,
  },

  // Info rows — last row's border is covered by the section divider below
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  infoLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: FG_MUTED,
    flex: 1,
  },
  infoValue: {
    fontFamily: "Inter-Medium",
    fontSize: 13,
    color: FG,
    textAlign: "right",
    flex: 1,
  },
  infoValueMono: {
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.3,
  },
  extendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: GREEN_SOFT,
  },
  extendRowPressed: {
    opacity: 0.7,
  },
  extendLabel: {
    flex: 1,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    color: GREEN,
  },

  // Reference code
  codeBlock: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: "center",
    gap: 8,
  },
  codeEyebrow: {
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    color: FG_SUBTLE,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  codeValue: {
    fontFamily: "Inter-Bold",
    fontSize: 20,
    color: FG,
    letterSpacing: 3,
    fontVariant: ["tabular-nums"] as const,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BG_2,
  },
  footerText: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: FG_MUTED,
  },
});
