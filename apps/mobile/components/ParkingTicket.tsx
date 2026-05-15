import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ParkingTicketProps = {
  companyName?: string;
  companySubtitle?: string;
  companyAddress?: string;
  companySupportEmail?: string;
  title?: string;
  date?: string;
  location?: string;
  orderId?: string;
  spot?: string;
  paidAmount?: string;
  barcodeText?: string;
};

const BARCODE_PATTERN = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export const ParkingTicket = memo(function ParkingTicket({
  companyName = "FREESPACE",
  companySubtitle = "Parking marketplace",
  companyAddress = "Dublin, Ireland",
  companySupportEmail = "support@freespace.ie",
  title = "Purchase receipt",
  date = "Wed, 11 Feb · 11:14 - 13:14",
  location = "College Green, Dublin 2",
  orderId = "CP-CEF24A",
  spot = "1 Parking Space",
  paidAmount = "€3.00",
  barcodeText = "1234 5678 9012",
}: ParkingTicketProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{companySubtitle}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {companyName} · {companyAddress}
          </Text>
        </View>
        <View style={styles.iconShell}>
          <Ionicons name="document-text-outline" size={18} color="#147A72" />
        </View>
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountCopy}>
          <Text style={styles.amountLabel}>Amount paid</Text>
          <Text style={styles.amountHint}>Charged to your original payment method</Text>
        </View>
        <Text style={styles.amountValue}>{paidAmount}</Text>
      </View>

      <View style={styles.detailsCard}>
        <InfoRow label="Reference" value={orderId} />
        <InfoRow label="Date" value={date} />
        <InfoRow label="Location" value={location} />
        <InfoRow label="Product" value={spot} />
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Receipt code</Text>
        <View style={styles.barcode}>
          {BARCODE_PATTERN.map((width, index) => (
            <View key={`barcode-${index}`} style={[styles.bar, { width }]} />
          ))}
        </View>
        <Text style={styles.codeValue}>{barcodeText}</Text>
      </View>

      <View style={styles.supportRow}>
        <Ionicons name="mail-outline" size={14} color="#6b7280" />
        <Text style={styles.supportText}>{companySupportEmail}</Text>
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
    backgroundColor: "#f6f4ee",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 5,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#147A72",
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 31,
  },
  subtitle: {
    color: "#6b7280",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: "#eef8f5",
    borderColor: "#d8ebe5",
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  amountRow: {
    alignItems: "flex-start",
    borderBottomColor: "#edf1f3",
    borderBottomWidth: 1,
    gap: 10,
    marginTop: 18,
    paddingBottom: 16,
  },
  amountCopy: {
    width: "100%",
  },
  amountLabel: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  amountHint: {
    color: "#7a8288",
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  amountValue: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 32,
    textAlign: "left",
  },
  detailsCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e7ebef",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  infoRow: {
    alignItems: "flex-start",
    borderBottomColor: "#edf1f3",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    color: "#7a8288",
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    fontWeight: "600",
    width: 82,
  },
  infoValue: {
    color: "#111827",
    flex: 1,
    fontFamily: "Inter-Medium",
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 19,
    textAlign: "right",
  },
  codeCard: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#e7ebef",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  codeLabel: {
    color: "#7a8288",
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  barcode: {
    alignItems: "stretch",
    flexDirection: "row",
    height: 54,
    width: 190,
  },
  bar: {
    backgroundColor: "#111111",
    marginRight: 2,
  },
  codeValue: {
    color: "#374151",
    fontFamily: "Inter-SemiBold",
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.1,
    marginTop: 10,
  },
  supportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },
  supportText: {
    color: "#6b7280",
    fontFamily: "Inter-Medium",
    fontSize: 12.5,
    fontWeight: "500",
  },
});
