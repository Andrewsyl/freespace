import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ParkingTicketProps = {
  companyName?: string;
  companySubtitle?: string;
  title?: string;
  date?: string;
  location?: string;
  orderId?: string;
  spot?: string;
  paidAmount?: string;
  barcodeText?: string;
};

const BARCODE_PATTERN = [2, 1, 3, 1, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1];
function FieldRow({
  label,
  value,
  valueAlign = "right",
  valueLarge = false,
  valueSmall = false,
}: {
  label: string;
  value: string;
  valueAlign?: "left" | "center" | "right";
  valueLarge?: boolean;
  valueSmall?: boolean;
}) {
  return (
    <View style={styles.fieldRowWrap}>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.fieldValue,
            valueAlign === "center" && styles.fieldValueCenter,
            valueAlign === "left" && styles.fieldValueLeft,
            valueLarge && styles.fieldValueLarge,
            valueSmall && styles.fieldValueSmall,
          ]}
        >
          {value}
        </Text>
      </View>
      <View style={styles.dottedLine} />
    </View>
  );
}

export const ParkingTicket = memo(function ParkingTicket({
  companyName = "FREESPACE",
  companySubtitle = "PARKING MARKETPLACE",
  title = "PARKING RECEIPT",
  date = "Wed, 11 Feb · 11:14 - 13:14",
  location = "College Green, Dublin 2",
  orderId = "CP-CEF24A",
  spot = "1 Parking Space",
  paidAmount = "€3.00",
  barcodeText = "1234 5678 9012",
}: ParkingTicketProps) {
  return (
    <View style={styles.ticketShadowWrap}>
      <View style={styles.ticketCard}>
        <View style={styles.scallopTop}>
          {Array.from({ length: 18 }).map((_, index) => (
            <View key={`scallop-top-${index}`} style={styles.scallopDot} />
          ))}
        </View>

        <View style={styles.headerBand}>
          <Ionicons name="car-sport" size={24} color="#1a1f26" />
          <View style={styles.companyTextWrap}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companySub}>{companySubtitle}</Text>
          </View>
        </View>

        <View style={styles.dottedLine} />
        <Text style={styles.mainTitle}>{title}</Text>
        <View style={styles.dottedLine} />

        <FieldRow label="DATE" value={date} valueSmall />
        <FieldRow label="LOCATION" value={location} />
        <FieldRow label="ORDER ID" value={orderId} />
        <FieldRow label="SPOT" value={spot} />
        <FieldRow label="PAID" value={paidAmount} valueLarge />

        <View style={styles.barcodeWrap}>
          {BARCODE_PATTERN.map((width, index) => (
            <View key={`barcode-${index}`} style={[styles.bar, { width }]} />
          ))}
        </View>
        <Text style={styles.barcodeText}>{barcodeText}</Text>

        <View style={styles.scallopBottom}>
          {Array.from({ length: 18 }).map((_, index) => (
            <View key={`scallop-bottom-${index}`} style={styles.scallopDot} />
          ))}
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
    backgroundColor: "#B0B0B0",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  ticketShadowWrap: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 10,
  },
  ticketCard: {
    width: "100%",
    backgroundColor: "#FAFAFA",
    borderRadius: 4,
    overflow: "hidden",
  },
  scallopTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginTop: -5,
    marginBottom: 6,
  },
  scallopBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: -5,
    marginTop: 8,
  },
  scallopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2ECC8F",
  },
  headerBand: {
    backgroundColor: "#FAFAFA",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  companyTextWrap: {
    flex: 1,
  },
  companyName: {
    color: "#1a1f26",
    fontSize: 26,
    fontWeight: "900",
    fontStyle: "italic",
    lineHeight: 24,
    letterSpacing: 0.4,
  },
  companySub: {
    color: "#555",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 1,
  },
  dottedLine: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#8a8a8a",
    borderStyle: "dotted",
    marginHorizontal: 16,
  },
  mainTitle: {
    marginTop: 12,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: "#1A1A1A",
    letterSpacing: 0.8,
  },
  fieldRowWrap: {
    marginTop: 0,
  },
  fieldRow: {
    marginHorizontal: 16,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldLabel: {
    width: 82,
    fontSize: 12,
    fontWeight: "900",
    color: "#23262b",
    letterSpacing: 0.4,
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    color: "#23262b",
    textAlign: "right",
    fontWeight: "500",
  },
  fieldValueCenter: {
    textAlign: "center",
  },
  fieldValueLeft: {
    textAlign: "left",
  },
  fieldValueLarge: {
    fontSize: 36,
    fontWeight: "900",
    color: "#111",
  },
  fieldValueSmall: {
    fontSize: 11,
  },
  barcodeWrap: {
    marginTop: 12,
    alignSelf: "center",
    height: 36,
    width: 180,
    flexDirection: "row",
    alignItems: "stretch",
  },
  bar: {
    backgroundColor: "#111111",
    marginRight: 2,
  },
  barcodeText: {
    textAlign: "center",
    color: "#2a2a2a",
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 14,
  },
});
