/**
 * "Review and continue" — the booking confirmation step: a close button, a big
 * title, one bordered card holding the whole booking, and a single dark action
 * pinned to the bottom.
 *
 * Rendered by BookingSummaryScreen, which owns the Stripe flow. This is the
 * presentation only; `handlePayment` on that screen is still the single path
 * that charges, and the server is still the only thing that decides the price.
 */
import { useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Star, X } from "lucide-react-native";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { ReviewRow, ScrollHeader, useScrollHeader } from "../components/ui/page";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import { formatPriceValue } from "../utils/pricing";
import { CANCELLATION_FREE_CUTOFF_MS } from "../utils/cancellationPolicy";
import { INK, MUTED, PILL, RULE, WHITE } from "../styles/pageTokens";

const FREE_CANCELLATION_HOURS = CANCELLATION_FREE_CUTOFF_MS / (60 * 60 * 1000);

type PriceSummary = {
  grossTotal: number;
  total: number;
  serviceFee: number;
  durationLabel: string;
  dailyCapApplied: boolean;
  dailyCapSavingGross: number;
};

export function BookingReviewBody({
  onClose,
  onContinue,
  onChangeTimes,
  title,
  locationLabel,
  address,
  imageUri,
  rating,
  ratingCount,
  startAt,
  endAt,
  priceSummary,
  vehicleMake,
  vehicleLine,
  vehiclePlate,
  onChangeVehicle,
  payBlockedReason,
}: {
  onClose: () => void;
  onContinue: () => void;
  onChangeTimes: () => void;
  title: string;
  locationLabel: string;
  address: string;
  imageUri?: string;
  rating: number | null;
  ratingCount: number;
  startAt: Date;
  endAt: Date;
  priceSummary: PriceSummary | null;
  vehicleMake: string;
  vehicleLine: string;
  vehiclePlate: string;
  onChangeVehicle: () => void;
  /**
   * Why paying isn't possible yet, or undefined when it is. The booking screen
   * blocks its own CTA on the same conditions; surfacing it here means the
   * driver fixes it before paying instead of being bounced to another screen
   * after committing.
   */
  payBlockedReason?: string;
}) {
  const insets = useSafeAreaInsets();
  const [showBreakdown, setShowBreakdown] = useState(false);
  // No hero here, so the bar arrives almost immediately.
  const header = useScrollHeader({ barRange: [12, 52], titleRange: [34, 74] });

  // Same calendar day reads as one date with a time range; spanning midnight
  // has to name both days or the window is ambiguous.
  const sameDay = startAt.toDateString() === endAt.toDateString();
  const windowLabel = sameDay
    ? `${formatDateLabel(startAt)}, ${formatTimeLabel(startAt)} – ${formatTimeLabel(endAt)}`
    : `${formatDateLabel(startAt)}, ${formatTimeLabel(startAt)} – ${formatDateLabel(
        endAt
      )}, ${formatTimeLabel(endAt)}`;

  return (
    <View style={styles.screen}>
        <ScrollHeader
          title="Review and continue"
          topInset={insets.top}
          barOpacity={header.barOpacity}
          titleOpacity={header.titleOpacity}
          insetLeft={64}
          insetRight={64}
        />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={styles.close}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={22} color={INK} strokeWidth={2.2} />
          </Pressable>
        </View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          scrollEventThrottle={16}
          onScroll={header.onScroll}
        >
          <Text style={styles.title}>Review and continue</Text>

          <View style={styles.card}>
            {/* Subject: what is being booked, so it reads before its details. */}
            <View style={styles.subject}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.subjectCopy}>
                <Text style={styles.subjectTitle} numberOfLines={2}>
                  {title}
                </Text>
                {locationLabel ? (
                  <Text style={styles.subjectMeta} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                ) : null}
                {rating !== null && ratingCount > 0 ? (
                  <View style={styles.subjectRating}>
                    <Star size={14} color={INK} fill={INK} strokeWidth={0} />
                    <Text style={styles.subjectRatingText}>
                      {`${rating.toFixed(1)} (${ratingCount})`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            <ReviewRow label="Parking window" actionLabel="Change" onAction={onChangeTimes}>
              <Text style={styles.rowValue}>{windowLabel}</Text>
              {priceSummary?.durationLabel ? (
                <Text style={styles.rowSub}>{priceSummary.durationLabel}</Text>
              ) : null}
            </ReviewRow>

            <View style={styles.divider} />

            {/* The plate is what the host actually checks, so it gets its own
                line under the model rather than being run together with it. */}
            <ReviewRow
              label="Vehicle"
              actionLabel={vehicleLine || vehiclePlate ? "Change" : "Add"}
              onAction={onChangeVehicle}
              footer={
                vehiclePlate ? (
                  <View style={styles.plate}>
                    <View style={styles.plateBand}>
                      <Text style={styles.plateBandText}>IRL</Text>
                    </View>
                    <Text style={styles.plateText}>{vehiclePlate.toUpperCase()}</Text>
                  </View>
                ) : null
              }
            >
              {vehicleLine ? (
                /* The marque's own logo beside its name — the same
                   `VehicleBrandLogo` the booking, host and profile screens
                   use, so a Volkswagen looks identical everywhere. */
                <View style={styles.vehicleRow}>
                  {vehicleMake ? <VehicleBrandLogo make={vehicleMake} size={26} /> : null}
                  <Text style={[styles.rowValue, styles.vehicleLine]}>{vehicleLine}</Text>
                </View>
              ) : vehiclePlate ? null : (
                <Text style={styles.rowSub}>
                  Add the car you'll park so the host knows what to look for.
                </Text>
              )}
            </ReviewRow>

            <View style={styles.divider} />

            <ReviewRow label="Location">
              <Text style={styles.rowValue}>{address || locationLabel}</Text>
              {/* Stated plainly rather than left to be discovered at the gate. */}
              <Text style={styles.rowSub}>
                Exact address and access code are sent once the booking is confirmed.
              </Text>
            </ReviewRow>

            <View style={styles.divider} />

            <ReviewRow
              label="Total price"
              actionLabel={showBreakdown ? "Hide" : "Details"}
              onAction={() => setShowBreakdown((prev) => !prev)}
            >
              <Text style={styles.rowValue}>
                {`€${formatPriceValue(priceSummary?.grossTotal ?? 0)} including fees`}
              </Text>
              {showBreakdown && priceSummary ? (
                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {`Parking · ${priceSummary.durationLabel}`}
                    </Text>
                    <Text style={styles.breakdownValue}>
                      {`€${formatPriceValue(priceSummary.total)}`}
                    </Text>
                  </View>
                  {priceSummary.dailyCapApplied ? (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Day rate saving</Text>
                      <Text style={styles.breakdownValue}>
                        {`−€${formatPriceValue(priceSummary.dailyCapSavingGross)}`}
                      </Text>
                    </View>
                  ) : null}
                  {/* The platform fee is baked into the displayed price by the
                      server, so there is nothing added on at the end. Saying
                      "Included" is the honest line, not a €0.00. */}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Service fee</Text>
                    <Text style={styles.breakdownValue}>Included</Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownTotalLabel}>Total</Text>
                    <Text style={styles.breakdownTotalValue}>
                      {`€${formatPriceValue(priceSummary.grossTotal)}`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </ReviewRow>

            <View style={styles.divider} />

            {/* No saved-card row: Stripe's Payment Sheet owns method entry, and
                the booking screen deliberately shows the real thing rather than
                a fake selected-card state. This says who handles it and when
                the charge lands, which is what a reviewer needs to know. */}
            <ReviewRow label="Payment">
              <Text style={styles.rowValue}>Handled by Stripe</Text>
              <Text style={styles.rowSub}>
                You'll choose a card on the next step. Charged when the host confirms.
              </Text>
            </ReviewRow>

            <View style={styles.divider} />

            <View style={styles.policy}>
              <Text style={styles.policyText}>
                {`Free cancellation up to ${FREE_CANCELLATION_HOURS} hours before you arrive.`}
              </Text>
              <Text style={styles.policyText}>Reserved instantly — no host approval needed.</Text>
            </View>
          </View>

          <Pressable
            style={styles.expandHint}
            onPress={onChangeTimes}
            accessibilityRole="button"
          >
            <Text style={styles.expandHintText}>Wrong times?</Text>
            <ChevronDown size={15} color={MUTED} strokeWidth={2.2} />
          </Pressable>
        </Animated.ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 16 }]}>
          {/* States the amount on the control that commits to it, so the
              number is never a scroll away from the button that charges it.
              When something blocks payment the button says so and goes to the
              fix, rather than promising a charge it can't start. */}
          <Pressable
            style={styles.next}
            onPress={payBlockedReason ? onChangeVehicle : onContinue}
            accessibilityRole="button"
          >
            <Text style={styles.nextLabel}>
              {payBlockedReason ?? `Pay €${formatPriceValue(priceSummary?.grossTotal ?? 0)}`}
            </Text>
          </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WHITE },
  header: { paddingHorizontal: 16, paddingBottom: 4, alignItems: "flex-end", zIndex: 3 },
  close: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: INK,
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 26,
  },

  card: {
    marginHorizontal: 24,
    borderWidth: 1, borderColor: RULE, borderRadius: 12,
  },
  divider: { height: 1, backgroundColor: RULE, marginHorizontal: 18 },

  subject: { flexDirection: "row", gap: 14, padding: 18 },
  thumb: { width: 96, height: 96, borderRadius: 8, flexShrink: 0 },
  thumbEmpty: { backgroundColor: PILL },
  subjectCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  subjectTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: INK,
  },
  subjectMeta: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 17, color: MUTED, marginTop: 3,
  },
  subjectRating: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  subjectRatingText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },

  rowValue: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 17, lineHeight: 24,
    color: INK, marginTop: 3,
  },
  rowSub: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 16, lineHeight: 22,
    color: MUTED, marginTop: 3,
  },

  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 },
  // The row's own marginTop moves to the wrapper so the logo and the name sit
  // on one baseline.
  vehicleLine: { flex: 1, minWidth: 0, marginTop: 0 },

  // Irish plate: blue EU band, then the registration in the same monospaced
  // weight the booking screen uses.
  // Full width of the row, so it reads as the plate itself rather than a chip
  // that happens to hold a registration.
  plate: {
    flexDirection: "row", alignItems: "stretch",
    borderRadius: 6, overflow: "hidden",
    borderWidth: 1, borderColor: RULE,
  },
  plateBand: {
    backgroundColor: "#3D6FB6", width: 30, alignItems: "center", justifyContent: "center",
  },
  plateBandText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 11, color: WHITE },
  // Centred in the space left of the band, which is what makes it read as a
  // plate rather than a left-aligned label.
  plateText: {
    flex: 1, textAlign: "center",
    fontFamily: "PlusJakartaSans-Bold", fontSize: 22, letterSpacing: 2,
    color: INK, paddingHorizontal: 10, paddingVertical: 9,
  },

  breakdown: { marginTop: 12, gap: 8 },
  breakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  breakdownLabel: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },
  breakdownValue: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, marginTop: 2 },
  breakdownTotalLabel: { flex: 1, fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: INK },
  breakdownTotalValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: INK },

  policy: { padding: 18, gap: 4 },
  policyText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 16, lineHeight: 22, color: INK,
  },


  expandHint: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 18,
  },
  expandHintText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: MUTED },

  dock: {
    borderTopWidth: 1, borderTopColor: RULE, backgroundColor: WHITE,
    paddingHorizontal: 24, paddingTop: 14,
  },
  next: {
    height: 56, borderRadius: 999, backgroundColor: INK,
    alignItems: "center", justifyContent: "center",
  },
  nextLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: WHITE },
});
