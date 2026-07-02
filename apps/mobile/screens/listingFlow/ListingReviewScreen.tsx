import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  Pencil,
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
import { generateListingDescription } from "./generateDescription";
import { FlowHeader } from "./FlowHeader";
import { colors, spacing } from "../../styles/theme";
import { hostFlowColors } from "./hostFlowTheme";
import { clearHostListingDraft } from "./draftStorage";
import { buildStreetViewImageUrl } from "../../utils/streetView";

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

type RowStatus = "ok" | "warn";

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
  const [editingDescription, setEditingDescription] = useState(false);
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

  // The single price drivers glance at first, shown over the cover. The full
  // multi-rate breakdown still lives in the Pricing edit row below.
  const heroPrice = (() => {
    if (draft.pricePerDay.trim().length > 0) return `€${draft.pricePerDay}/day`;
    if (draft.pricePerMonth.trim().length > 0) return `€${draft.pricePerMonth}/mo`;
    if (draft.pricePerHour.trim().length > 0) return `€${draft.pricePerHour}/hr`;
    return null;
  })();

  const photoCount = useMemo(() => draft.photos.filter((p) => p?.trim()).length, [draft.photos]);

  // The exact cover a driver will see: the framed Street View leads (matching
  // publish), otherwise the first uploaded photo.
  const coverPhotoUri = useMemo(() => {
    const { latitude, longitude } = draft.location;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const url = buildStreetViewImageUrl({
        coverPanoId: draft.coverPanoId,
        coverHeading: draft.coverHeading,
        coverPitch: draft.coverPitch,
        latitude,
        longitude,
        mapsKey,
      });
      if (url) return url;
    }
    return draft.photos.find((p) => p?.trim()) ?? null;
  }, [draft.coverHeading, draft.coverPitch, draft.coverPanoId, draft.location, draft.photos, mapsKey]);

  const spaceTypeValue = draft.spaceType
    ? draft.capacity > 1
      ? `${draft.spaceType} · ${draft.capacity} spaces`
      : draft.spaceType
    : "Not set";

  const pricingOk: RowStatus =
    (!requiresShortStay || (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)) &&
    (!requiresMonthly || draft.pricePerMonth.trim().length > 0)
      ? "ok"
      : "warn";

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

  // Pre-fill the description box with an auto-generated one the first time the
  // host reaches this screen (only if they haven't written/edited their own).
  useEffect(() => {
    if (!draft.description?.trim()) {
      setDraft((prev) => ({ ...prev, description: generateListingDescription(prev) }));
    }
    // Run once on mount; the host can freely edit afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const coverUrl = buildStreetViewImageUrl({
        coverPanoId: draft.coverPanoId,
        coverHeading: draft.coverHeading,
        coverPitch: draft.coverPitch,
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        mapsKey,
      });
      const imageUrls = [...(coverUrl ? [coverUrl] : []), ...draft.photos.filter(Boolean)];
      const parsedHourly = Number.parseFloat(draft.pricePerHour);
      const parsedDaily = Number.parseFloat(draft.pricePerDay);
      const parsedMonthly = Number.parseFloat(draft.pricePerMonth);
      const inferredRateType = requiresShortStay && Number.isFinite(parsedHourly) && parsedHourly > 0 ? "hourly" : "daily";
      if (listingId) {
        await updateListing({ token, listingId, title: draft.spaceType ? `${draft.spaceType} parking` : "Parking space", address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, imageUrls, amenities: draft.accessOptions, accessCode: draft.accessCode.trim() || null, arrivalInstructions: draft.arrivalInstructions.trim() || null, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity, description: (draft.description ?? "").trim() || null });
        await syncAvailability(listingId);
      } else {
        const newListingId = await createListing({ token, title: draft.spaceType ? `${draft.spaceType} parking` : "Parking space", address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, latitude: draft.location.latitude, longitude: draft.location.longitude, imageUrls, amenities: draft.accessOptions, accessCode: draft.accessCode.trim() || null, arrivalInstructions: draft.arrivalInstructions.trim() || null, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity, description: (draft.description ?? "").trim() || null });
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
          <Text style={styles.kicker}>{listingId ? "Review & update" : "Final step"}</Text>
          <Text style={styles.title}>{listingId ? "Review your changes" : "Here's your listing"}</Text>
          <Text style={styles.subtitle}>
            {listingId
              ? "Confirm everything looks right before saving."
              : "Take a quick look. You can edit anything now — or anytime after you publish."}
          </Text>
        </View>

        {/* ── Hero: exactly what drivers will see (tap to edit photos) ── */}
        <Pressable
          style={styles.heroCard}
          onPress={() => navigation.navigate("ListingPhotos")}
        >
          <View style={styles.heroMedia}>
            {coverPhotoUri ? (
              <Image style={styles.heroImage} source={{ uri: coverPhotoUri }} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Camera size={26} color={SOFT} strokeWidth={1.7} />
                <Text style={styles.heroPlaceholderText}>Add photos of your space</Text>
              </View>
            )}
            <View style={styles.heroEditChip}>
              <Pencil size={11} color={FG} strokeWidth={2.2} />
              <Text style={styles.heroEditChipText}>
                {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? "s" : ""}` : "Add"}
              </Text>
            </View>
            {heroPrice ? (
              <View style={styles.heroPricePill}>
                <Text style={styles.heroPriceText}>{heroPrice}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {draft.spaceType ? `${draft.spaceType} parking` : "Parking space"}
            </Text>
            <View style={styles.heroAddressRow}>
              <MapPin size={12} color={SOFT} strokeWidth={2} />
              <Text style={styles.heroAddress} numberOfLines={1}>
                {draft.location.address || "Location not set"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* ── Description (reviewable text, lightweight edit) ── */}
        <View style={styles.descCard}>
          <View style={styles.descHeaderRow}>
            <Text style={styles.cardHeader}>Description</Text>
            <Pressable onPress={() => setEditingDescription((v) => !v)} hitSlop={10}>
              <Text style={styles.editLink}>{editingDescription ? "Done" : "Edit"}</Text>
            </Pressable>
          </View>
          {editingDescription ? (
            <TextInput
              style={styles.descriptionInput}
              value={draft.description ?? ""}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, description: text }))}
              multiline
              autoFocus
              textAlignVertical="top"
              placeholder="Describe your space…"
              placeholderTextColor={MUTED}
            />
          ) : (
            <Text style={styles.descriptionText}>
              {draft.description?.trim() || "Add a short description to help drivers choose your space."}
            </Text>
          )}
        </View>

        {/* ── Review & edit (only what isn't already shown above) ── */}
        <View style={styles.card}>
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.cardHeader}>Review &amp; edit</Text>
            <Text style={styles.reviewHeaderHint}>Tap to change</Text>
          </View>
          <DetailRow
            icon={<MapPin size={15} color={ACCENT} strokeWidth={2} />}
            label="Location"
            value={draft.location.address || "Not set"}
            status={draft.location.address.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingLocation")}
          />
          <DetailRow
            icon={<Tag size={15} color={ACCENT} strokeWidth={2} />}
            label="Space"
            value={spaceTypeValue}
            status={draft.spaceType.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingDetails")}
          />
          <DetailRow
            icon={<Tag size={15} color={ACCENT} strokeWidth={2} />}
            label="Price"
            value={priceLabel}
            status={pricingOk}
            onPress={() => navigation.navigate("ListingPrice")}
          />
          <DetailRow
            icon={<Clock size={15} color={ACCENT} strokeWidth={2} />}
            label="Availability"
            value={draft.availability.detail || "Not set"}
            status={draft.availability.detail.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingAvailability")}
          />
          <DetailRow
            icon={<KeyRound size={15} color={ACCENT} strokeWidth={2} />}
            label="Access"
            value={draft.accessCode.trim() || "No code needed"}
            onPress={() => navigation.navigate("ListingFeaturesAccess")}
            isLast
          />
        </View>

        {/* ── The conclusion: reassure, confirm, publish ── */}
        <View style={styles.publishPanel}>
          <Text style={styles.publishTitle}>{listingId ? "Save your changes" : "Ready to go live"}</Text>
          <View style={styles.reassureRow}>
            <View style={styles.reassureDot}><Check size={11} color={ACCENT} strokeWidth={3} /></View>
            <Text style={styles.reassureText}>
              {listingId ? "Your updates show to drivers right away." : "Your space appears on the map the moment you publish."}
            </Text>
          </View>
          <View style={styles.reassureRow}>
            <View style={styles.reassureDot}><Check size={11} color={ACCENT} strokeWidth={3} /></View>
            <Text style={styles.reassureText}>You can edit, pause or remove it anytime.</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.permissionCard, draft.permissionDeclared && styles.permissionCardActive]}
            onPress={() => setDraft((prev) => ({ ...prev, permissionDeclared: !prev.permissionDeclared }))}
          >
            <View style={[styles.checkbox, draft.permissionDeclared && styles.checkboxActive]}>
              {draft.permissionDeclared ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
            </View>
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>I have the right to list this space</Text>
              <Text style={styles.permissionSubtitle}>
                You own it or have the owner's permission — and you're happy with everything above.
              </Text>
            </View>
          </Pressable>
        </View>
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
  status,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
  status?: RowStatus;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.detailRow,
        !isLast && styles.detailRowBorder,
        pressed && styles.editRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.detailIconWrap}>{icon}</View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, status === "warn" && styles.valueWarning]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {status === "ok" ? (
        <View style={styles.statusOk}>
          <Check size={11} color="#ffffff" strokeWidth={3} />
        </View>
      ) : status === "warn" ? (
        <View style={styles.statusWarn} />
      ) : null}
      <ChevronRight size={18} color={SOFT} strokeWidth={2.2} />
    </Pressable>
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
  pageHeader: { paddingTop: 10, paddingBottom: 2 },
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

  // ── Hero (the listing as drivers see it) ─────────────────────
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  heroMedia: { height: 200, backgroundColor: "#e8f0f4", position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EDF2F5",
  },
  heroPlaceholderText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: SOFT,
  },
  heroEditChip: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroEditChipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: FG,
    letterSpacing: -0.1,
  },
  heroPricePill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(15, 23, 42, 0.86)",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  heroPriceText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  heroMeta: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14 },
  heroTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroAddressRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    flex: 1,
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
  },

  // ── Description (lighter than the surrounding cards) ─────────
  descCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  descHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  editLink: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: ACCENT,
    letterSpacing: -0.1,
  },
  descriptionText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
  },
  descriptionInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: FG,
  },

  // ── Review list header ───────────────────────────────────────
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  reviewHeaderHint: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: SOFT,
    letterSpacing: -0.1,
  },

  // ── Detail rows ──────────────────────────────────────────────
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EDE7E0",
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
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
  statusOk: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusWarn: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    flexShrink: 0,
  },

  // ── Edit rows ────────────────────────────────────────────────
  editRowPressed: { backgroundColor: "#F8FAFC" },

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
    marginTop: 14,
  },

  // ── Publish panel (the conclusion) ───────────────────────────
  publishPanel: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 18,
    marginTop: 4,
  },
  publishTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  reassureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  reassureDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reassureText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13.5,
    color: MUTED,
    lineHeight: 19,
    flex: 1,
  },

  // ── Permission card (inside the conclusion) ──────────────────
  permissionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    alignItems: "flex-start",
    marginTop: 5,
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
