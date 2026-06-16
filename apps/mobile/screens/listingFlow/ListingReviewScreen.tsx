import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SquircleBtn } from "../../components/SquircleBtn";
import { PhoneVerifyModal } from "../../components/PhoneVerifyModal";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import {
  Check,
  ChevronRight,
  MapPin,
  Clock,
  Tag,
  Camera,
  KeyRound,
  Users,
  Lightbulb,
} from "lucide-react-native";
import {
  createAvailabilityEntry,
  createListing,
  deleteAvailabilityEntry,
  listAvailability,
  updateListing,
} from "../../api";
import { trackEvent } from "../../analytics";
import { useAuth } from "../../auth";
import type { RootStackParamList } from "../../types";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { colors, spacing } from "../../styles/theme";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";
import { clearHostListingDraft } from "./draftStorage";

type FlowStackParamList = {
  ListingReview: undefined;
  ListingLocation: undefined;
  ListingStreetView: undefined;
  ListingDetails: undefined;
  ListingFeaturesAccess: undefined;
  ListingAvailability: undefined;
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingReview">;

// Require hosts to verify their phone before a listing goes live. Keep this OFF
// until AWS grants SMS production access (out of the SNS sandbox) — while in the
// sandbox only pre-verified numbers can receive codes, so enforcing it would
// block every host from publishing. Flip to true once the sandbox exit is approved.
const PHONE_VERIFICATION_REQUIRED = false;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const SOFT = hostFlowColors.textSoft;
const BORDER = "#E2E8ED";
const CARD = "#ffffff";

export function ListingReviewScreen({ navigation }: Props) {
  const { draft, setDraft, listingId } = useListingFlow();
  const { token, user, setAuthUser } = useAuth();
  const insets = useSafeAreaInsets();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootNavigation = navigation.getParent();
  const requiresShortStay =
    draft.pricingMode === "hourly_daily" || draft.pricingMode === "both";
  const requiresMonthly = draft.pricingMode === "monthly" || draft.pricingMode === "both";
  const canPublish =
    draft.spaceType.trim().length > 0 &&
    (!requiresShortStay || (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)) &&
    (!requiresMonthly || draft.pricePerMonth.trim().length > 0) &&
    draft.location.address.trim().length > 0 &&
    draft.permissionDeclared;

  const priceLabel = (() => {
    if (requiresShortStay && requiresMonthly)
      return `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day · €${draft.pricePerMonth}/month`;
    if (requiresMonthly)
      return `€${draft.pricePerMonth || "0"}/month`;
    if (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)
      return `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day`;
    if (draft.pricePerHour.trim().length > 0)
      return `€${draft.pricePerHour}/hr`;
    return `€${draft.pricePerDay || "0"}/day`;
  })();

  const buildAvailabilityPayloads = () => {
    const weekdayIndex: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const mode = draft.availability.mode;
    const timeStart = new Date(draft.availability.timeStart);
    const timeEnd = new Date(draft.availability.timeEnd);
    const withTime = (date: Date, time: Date) => {
      const next = new Date(date);
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      return next;
    };
    const baseDate = new Date();
    if (mode === "daily") {
      const startsAt = withTime(baseDate, timeStart);
      const endsAt = withTime(baseDate, timeEnd);
      if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
      return [{ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: [0, 1, 2, 3, 4, 5, 6], repeatUntil: null }];
    }
    if (mode === "recurring") {
      const repeatWeekdays = draft.availability.weekdays
        .map((day) => weekdayIndex[day])
        .filter((value) => typeof value === "number");
      if (!repeatWeekdays.length) return [];
      const dayTimeRanges = draft.availability.dayTimeRanges ?? {};
      return repeatWeekdays.map((weekdayIdx) => {
        const dayCode = Object.entries(weekdayIndex).find(([, idx]) => idx === weekdayIdx)?.[0] ?? "Mon";
        const range = dayTimeRanges[dayCode];
        const startRef = range?.start ? new Date(range.start) : timeStart;
        const endRef = range?.end ? new Date(range.end) : timeEnd;
        const startsAt = withTime(baseDate, startRef);
        const endsAt = withTime(baseDate, endRef);
        if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
        return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: [weekdayIdx], repeatUntil: null };
      });
    }
    const dateStart = new Date(draft.availability.dateStart);
    const dateEnd = new Date(draft.availability.dateEnd);
    const startsAt = withTime(dateStart, timeStart);
    const endsAt = withTime(dateEnd, timeEnd);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    return [{ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: null, repeatUntil: null }];
  };

  const syncAvailability = async (targetListingId: string) => {
    if (!token) return;
    const existing = await listAvailability({ token, listingId: targetListingId });
    await Promise.all(existing.map((entry) => deleteAvailabilityEntry({ token, availabilityId: entry.id })));
    const payloads = buildAvailabilityPayloads();
    if (!payloads.length) return;
    await Promise.all(payloads.map((payload) =>
      createAvailabilityEntry({ token, listingId: targetListingId, kind: "open", startsAt: payload.startsAt, endsAt: payload.endsAt, repeatWeekdays: payload.repeatWeekdays, repeatUntil: payload.repeatUntil })
    ));
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!published) return;
      const actionType = event.data.action.type;
      if (actionType === "GO_BACK" || actionType === "POP") event.preventDefault();
    });
    return unsubscribe;
  }, [navigation, published]);

  const handlePublish = async () => {
    if (!token) {
      setError(listingId ? "Sign in to update your space." : "Sign in to publish your space.");
      return;
    }
    const hasHourlyPrice = draft.pricePerHour.trim().length > 0;
    const hasDailyPrice = draft.pricePerDay.trim().length > 0;
    const hasMonthlyPrice = draft.pricePerMonth.trim().length > 0;
    if (!draft.spaceType || !draft.permissionDeclared || (requiresShortStay && (!hasHourlyPrice || !hasDailyPrice)) || (requiresMonthly && !hasMonthlyPrice)) {
      setError("Complete the required steps first.");
      return;
    }
    // Hosts must have a verified phone before a listing goes live, since drivers
    // may call them if they can't find the space. Verified once, never re-asked.
    // Gated behind a flag so we don't block publishing while SMS is still in the
    // SNS sandbox (see PHONE_VERIFICATION_REQUIRED above).
    if (PHONE_VERIFICATION_REQUIRED && !user?.phoneVerified) {
      setError(null);
      setShowPhoneVerify(true);
      return;
    }
    await doPublish();
  };

  const doPublish = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      void trackEvent("mobile_host_publish_started", { pricingMode: draft.pricingMode, hasPhotos: draft.photos.length > 0 });
      const coverUrl = draft.coverHeading != null && mapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${draft.location.latitude},${draft.location.longitude}&heading=${draft.coverHeading}&pitch=${draft.coverPitch ?? 0}&fov=80&key=${mapsKey}`
        : null;
      const imageUrls = [...(coverUrl ? [coverUrl] : []), ...draft.photos.filter(Boolean)];
      const parsedHourly = Number.parseFloat(draft.pricePerHour);
      const parsedDaily = Number.parseFloat(draft.pricePerDay);
      const parsedMonthly = Number.parseFloat(draft.pricePerMonth);
      const inferredRateType = requiresShortStay && Number.isFinite(parsedHourly) && parsedHourly > 0 ? "hourly" : "daily";
      if (listingId) {
        await updateListing({ token, listingId, title: draft.spaceType ? `${draft.spaceType} parking` : "Parking space", address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, imageUrls, amenities: draft.accessOptions, accessCode: draft.accessCode.trim() || null, arrivalInstructions: draft.arrivalInstructions.trim() || null, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity });
        await syncAvailability(listingId);
      } else {
        const newListingId = await createListing({ token, title: draft.spaceType ? `${draft.spaceType} parking` : "Parking space", address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, latitude: draft.location.latitude, longitude: draft.location.longitude, imageUrls, amenities: draft.accessOptions, accessCode: draft.accessCode.trim() || null, arrivalInstructions: draft.arrivalInstructions.trim() || null, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity });
        await syncAvailability(newListingId);
      }
      await clearHostListingDraft();
      setPublished(true);
      setShowSuccess(true);
      void trackEvent("mobile_host_publish_succeeded", { pricingMode: draft.pricingMode, listingId: listingId ?? "new" });
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })?.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Listings" as keyof RootStackParamList }] })
        );
      }, 1800);
    } catch (err) {
      void trackEvent("mobile_host_publish_failed", { pricingMode: draft.pricingMode, listingId: listingId ?? "new" });
      setError(err instanceof Error ? err.message : "Could not publish");
      setPublished(false);
      setShowSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={8} total={8} onClose={exitFlow} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.kicker}>{listingId ? "Review & update" : "Review & publish"}</Text>
          <Text style={styles.title}>Double‑check your details</Text>
          <Text style={styles.subtitle}>
            {listingId ? "Confirm everything looks right before saving." : "You can edit anything after publishing."}
          </Text>
        </View>

        {/* ── Listing preview card ── */}
        <View style={styles.card}>
          {/* Map */}
          <View style={styles.mapWrap}>
            <Image
              style={styles.map}
              source={{
                uri: `https://maps.googleapis.com/maps/api/staticmap?center=${draft.location.latitude},${draft.location.longitude}&zoom=15&size=640x360&scale=2&style=feature:poi|visibility:off&style=feature:transit|visibility:off&markers=color:0x0a8050%7C${draft.location.latitude},${draft.location.longitude}&key=${mapsKey}`,
              }}
              resizeMode="cover"
            />
          </View>
          {/* Title + address row */}
          <View style={styles.listingMeta}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {draft.spaceType ? `${draft.spaceType} parking` : "Parking space"}
            </Text>
            <View style={styles.listingAddressRow}>
              <MapPin size={12} color={SOFT} strokeWidth={2} />
              <Text style={styles.listingAddress} numberOfLines={1}>
                {draft.location.address || "Location not set"}
              </Text>
            </View>
          </View>
          {/* Key facts strip */}
          <View style={styles.factsStrip}>
            <View style={styles.factItem}>
              <Tag size={13} color={ACCENT} strokeWidth={2} />
              <Text style={styles.factText}>{priceLabel}</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.factItem}>
              <Clock size={13} color={ACCENT} strokeWidth={2} />
              <Text style={styles.factText} numberOfLines={1}>
                {draft.availability.detail || "Availability not set"}
              </Text>
            </View>
            {draft.capacity > 1 ? (
              <>
                <View style={styles.factDivider} />
                <View style={styles.factItem}>
                  <Users size={13} color={ACCENT} strokeWidth={2} />
                  <Text style={styles.factText}>{draft.capacity} spaces</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Details (tap any row to edit) ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Listing details</Text>
          <Text style={styles.cardSubHeader}>Tap any section to edit it.</Text>
          <DetailRow
            icon={<Tag size={15} color={ACCENT} strokeWidth={2} />}
            label="Space type"
            value={draft.spaceType || "Not set"}
            onPress={() => navigation.navigate("ListingDetails")}
          />
          <DetailRow
            icon={<MapPin size={15} color={ACCENT} strokeWidth={2} />}
            label="Location"
            value={draft.location.address || "Not set"}
            onPress={() => navigation.navigate("ListingLocation")}
          />
          <DetailRow
            icon={<Camera size={15} color={ACCENT} strokeWidth={2} />}
            label="Street view"
            value={draft.coverHeading != null ? "Cover set" : "Set the cover view"}
            onPress={() => navigation.navigate("ListingStreetView")}
          />
          <DetailRow
            icon={<Clock size={15} color={ACCENT} strokeWidth={2} />}
            label="Availability"
            value={draft.availability.detail || "Not set"}
            onPress={() => navigation.navigate("ListingAvailability")}
          />
          <DetailRow
            icon={<Tag size={15} color={ACCENT} strokeWidth={2} />}
            label="Price"
            value={priceLabel}
            onPress={() => navigation.navigate("ListingPrice")}
          />
          <DetailRow
            icon={<Camera size={15} color={ACCENT} strokeWidth={2} />}
            label="Photos"
            value={draft.photos.length > 0 ? `${draft.photos.length} photo${draft.photos.length !== 1 ? "s" : ""}` : "No photos added"}
            valueStyle={draft.photos.length === 0 ? styles.valueWarning : undefined}
            onPress={() => navigation.navigate("ListingPhotos")}
          />
          {draft.capacity > 1 ? (
            <DetailRow
              icon={<Users size={15} color={ACCENT} strokeWidth={2} />}
              label="Spaces"
              value={`${draft.capacity}`}
              onPress={() => navigation.navigate("ListingDetails")}
            />
          ) : null}
          <DetailRow
            icon={<KeyRound size={15} color={ACCENT} strokeWidth={2} />}
            label="Access code"
            value={draft.accessCode.trim() || "None"}
            onPress={() => navigation.navigate("ListingFeaturesAccess")}
            isLast
          />
        </View>

        {/* ── Tips ── */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <View style={styles.tipsIconWrap}>
              <Lightbulb size={15} color={ACCENT} strokeWidth={2} />
            </View>
            <Text style={styles.tipsTitle}>What gets bookings</Text>
          </View>
          <View style={styles.tipsList}>
            <TipRow text="Show exactly where the driver should park" />
            <TipRow text="Add arrival notes and any code needed after booking" />
            <TipRow text="Keep price and availability accurate to avoid cancellations" />
          </View>
        </View>

        {/* ── Error ── */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* ── Permission ── */}
        <Pressable
          style={[styles.permissionCard, draft.permissionDeclared && styles.permissionCardActive]}
          onPress={() => setDraft((prev) => ({ ...prev, permissionDeclared: !prev.permissionDeclared }))}
        >
          <View style={[styles.checkbox, draft.permissionDeclared && styles.checkboxActive]}>
            {draft.permissionDeclared ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
          </View>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>I have permission to rent this space</Text>
            <Text style={styles.permissionSubtitle}>
              You confirm you own this space or have the owner's consent to list it.
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <SquircleBtn
          label={submitting ? "Saving…" : listingId ? "Update listing" : "Publish space"}
          onPress={handlePublish}
          disabled={!canPublish || submitting || published}
          loading={submitting}
          fullWidth
        />
        <Pressable
          style={styles.saveLaterBtn}
          onPress={() => navigation.goBack()}
          disabled={submitting || published}
        >
          <Text style={styles.saveLaterText}>Save and finish later</Text>
        </Pressable>
      </View>

      {/* ── Phone verification gate ── */}
      {token ? (
        <PhoneVerifyModal
          visible={showPhoneVerify}
          token={token}
          initialPhone={user?.phone}
          onClose={() => setShowPhoneVerify(false)}
          onVerified={async (verifiedPhone) => {
            setShowPhoneVerify(false);
            if (user) {
              await setAuthUser({ ...user, phone: verifiedPhone, phoneVerified: true });
            }
            await doPublish();
          }}
        />
      ) : null}

      {/* ── Success overlay ── */}
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>
              {listingId ? "Updated" : "Published"}
            </Text>
            <Text style={styles.successBody}>
              {listingId ? "Your listing has been saved." : "Your space is now live."}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  isLast,
  valueStyle,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
  valueStyle?: object;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.detailIconWrap}>{icon}</View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, valueStyle]} numberOfLines={2}>{value}</Text>
      </View>
      {onPress ? <ChevronRight size={18} color={SOFT} strokeWidth={2.2} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.detailRow,
          !isLast && styles.detailRowBorder,
          pressed && styles.editRowPressed,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>{content}</View>
  );
}

function TipRow({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <View style={styles.tipDot} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  scroll: { paddingTop: 4, paddingHorizontal: 16, gap: 14 },

  // ── Page header ──────────────────────────────────────────────
  pageHeader: { paddingTop: 10, paddingBottom: 6 },
  kicker: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    color: ACCENT,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 26,
    color: FG,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: MUTED,
    lineHeight: 21,
  },

  // ── Cards ────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardHeader: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    color: FG,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardSubHeader: {
    fontSize: 12.5,
    color: MUTED,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  // ── Map + listing meta ───────────────────────────────────────
  mapWrap: { height: 175, backgroundColor: "#e8f0f4" },
  map: { flex: 1 },
  listingMeta: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD2",
  },
  listingTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  listingAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  listingAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    flex: 1,
  },
  factsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  factItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  factText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: FG,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  factDivider: { width: 1, height: 16, backgroundColor: BORDER },

  // ── Detail rows ──────────────────────────────────────────────
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD2",
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  detailBody: { flex: 1 },
  detailLabel: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11,
    color: SOFT,
    letterSpacing: 0.2,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  detailValue: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  valueWarning: { color: "#F59E0B" },

  // ── Edit rows ────────────────────────────────────────────────
  editRowPressed: { backgroundColor: "#F8FAFC" },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: "#F0FDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C6F0DC",
    padding: 16,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tipsIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
  },
  tipsList: { gap: 8 },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ACCENT,
    marginTop: 7,
    flexShrink: 0,
  },
  tipText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
    flex: 1,
  },

  // ── Error ────────────────────────────────────────────────────
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  // ── Permission card ──────────────────────────────────────────
  permissionCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    alignItems: "flex-start",
    ...CARD_SHADOW,
  },
  permissionCardActive: {
    borderColor: ACCENT,
    backgroundColor: "#F7FDFB",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#C5D0D8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  permissionText: { flex: 1 },
  permissionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 4,
  },
  permissionSubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    gap: 8,
  },
  saveLaterBtn: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
  },
  saveLaterText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: MUTED,
  },

  // ── Success overlay ──────────────────────────────────────────
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 24,
    width: 240,
    ...CARD_SHADOW,
  },
  successAnimation: { height: 130, width: 130 },
  successTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    color: FG,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: MUTED,
    marginTop: 4,
    textAlign: "center",
  },
});
