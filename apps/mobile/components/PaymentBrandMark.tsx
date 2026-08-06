import { Platform, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { colors, radius } from "../styles/theme";
import {
  PAYMENT_BRAND_LABELS,
  PAYMENT_BRAND_MARKS,
  type PaymentBrandKey,
} from "../assets/payment/brandMarks";

// Apple and Google marks lifted from the web checkout so both surfaces draw the
// same artwork. Trademark colours — never restyled to the app palette.
const APPLE_XML = `<svg viewBox="0 0 24 24"><path fill="#000000" d="M17.05 12.4c-.02-2.25 1.84-3.33 1.93-3.38-1.05-1.54-2.69-1.75-3.27-1.77-1.39-.14-2.72.82-3.43.82-.72 0-1.82-.8-2.99-.78-1.54.02-2.96.9-3.75 2.28-1.6 2.77-.41 6.87 1.15 9.12.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.96-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.27 1.23-2.5 1.25-2.57-.03-.01-2.4-.92-2.42-3.65ZM14.8 5.78c.63-.76 1.05-1.82.94-2.88-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.95 2.78 1.01.08 2.04-.52 2.67-1.27Z"/></svg>`;

const GOOGLE_XML = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z"/></svg>`;

/** The wallet this device can actually present. */
export const platformWallet: PaymentBrandKey =
  Platform.OS === "ios" ? "applePay" : "googlePay";

const isWallet = (brand: PaymentBrandKey) =>
  brand === "applePay" || brand === "googlePay";

/**
 * A payment brand mark in its own hairline box.
 *
 * Prefers Stripe's official artwork when it has been added to
 * `assets/payment/brandMarks.ts`. Until then it falls back to the same drawn
 * marks the web checkout already ships (`apps/web/app/checkout/[id]/page.tsx`),
 * so the two surfaces agree. Dropping an official SVG into brandMarks.ts
 * replaces the drawn mark automatically — no change needed here.
 */
export function PaymentBrandMark({
  brand,
  width,
  height = 24,
}: {
  brand: PaymentBrandKey;
  width?: number;
  height?: number;
}) {
  // Wallets carry a "Pay" wordmark next to the glyph, so they need more room
  // than a card mark does.
  const boxWidth = width ?? (isWallet(brand) ? 52 : 38);
  const xml = PAYMENT_BRAND_MARKS[brand];
  return (
    <View
      style={[styles.box, { width: boxWidth, height }]}
      accessibilityRole="image"
      accessibilityLabel={PAYMENT_BRAND_LABELS[brand]}
    >
      {xml ? (
        <SvgXml xml={xml} width={boxWidth - 8} height={height - 8} />
      ) : (
        <DrawnMark brand={brand} glyph={height - 11} />
      )}
    </View>
  );
}

function DrawnMark({ brand, glyph }: { brand: PaymentBrandKey; glyph: number }) {
  if (brand === "visa") {
    return <Text style={styles.visaText}>VISA</Text>;
  }
  if (brand === "mastercard") {
    // Two interlocking circles. React Native has no mix-blend-multiply, so the
    // overlap is faked with a translucent amber disc over the red one.
    return (
      <View style={styles.mcWrap}>
        <View style={[styles.mcCircle, styles.mcRed]} />
        <View style={[styles.mcCircle, styles.mcAmber]} />
      </View>
    );
  }
  return (
    <View style={styles.walletWrap}>
      <SvgXml
        xml={brand === "applePay" ? APPLE_XML : GOOGLE_XML}
        width={glyph}
        height={glyph}
      />
      <Text style={styles.walletText}>Pay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm / 2,
    backgroundColor: colors.cardBg,
    overflow: "hidden",
  },
  // Brand colours, matched to the web checkout. These are trademark colours,
  // not palette tokens — they never move to the theme and are never restyled.
  visaText: {
    fontSize: 11,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.4,
    color: "#1A1F71",
    includeFontPadding: false,
  },
  mcWrap: { flexDirection: "row", alignItems: "center", width: 22, height: 13 },
  mcCircle: { position: "absolute", width: 13, height: 13, borderRadius: 7 },
  mcRed: { left: 0, backgroundColor: "#EB001B" },
  mcAmber: { left: 9, backgroundColor: "#F79E1B", opacity: 0.85 },
  walletWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  walletText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    includeFontPadding: false,
  },
});
