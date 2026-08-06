// Card brand marks for the checkout dock.
//
// Prefer Stripe's official brand assets over redrawn ones: homemade payment
// marks undercut exactly the trust they exist to create. Until an official SVG
// is pasted in, PaymentBrandMark falls back to the same drawn marks the web
// checkout already ships, so the two surfaces agree. Adding real artwork here
// replaces the drawn mark automatically.
//
// To add one:
//   1. Download the SVG from https://stripe.com/newsroom/brand-assets
//      (card brand marks section — use the marks Stripe itself ships).
//   2. Open the .svg in a text editor and paste its full markup below as a
//      template literal. No build config needed: these render through
//      `SvgXml` from react-native-svg, the same path VehicleBrandLogo uses.
//   3. Keep the artwork's own colours. Card marks are trademarks — they are not
//      recoloured to the app palette, and they are never restyled.
//
// Sized to 38×24 by the consuming component; the source viewBox scales.

export type PaymentBrandKey = "visa" | "mastercard" | "applePay" | "googlePay";

// Amex is deliberately absent: it isn't offered, and showing a mark for a card
// we don't take is a promise the checkout can't keep. The wallet shown is
// chosen per platform by the consuming screen — Google Pay on an iPhone (or
// Apple Pay on Android) is a button the device can never present.
export const PAYMENT_BRAND_LABELS: Record<PaymentBrandKey, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  applePay: "Apple Pay",
  googlePay: "Google Pay",
};

export const PAYMENT_BRAND_MARKS: Record<PaymentBrandKey, string | null> = {
  visa: null,
  mastercard: null,
  applePay: null,
  googlePay: null,
};
