import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { Check, ChevronRight } from "lucide-react-native";
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
import { StepProgress } from "./StepProgress";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingReview: undefined;
  ListingLocation: undefined;
  ListingStreetView: undefined;
  ListingDetails: undefined;
  ListingAvailability: undefined;
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingReview">;

export function ListingReviewScreen({ navigation }: Props) {
  const { draft, setDraft, listingId } = useListingFlow();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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

  const buildAvailabilityPayloads = () => {
    const weekdayIndex: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
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
      return [
        {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
          repeatUntil: null,
        },
      ];
    }
    if (mode === "recurring") {
      const repeatWeekdays = draft.availability.weekdays
        .map((day) => weekdayIndex[day])
        .filter((value) => typeof value === "number");
      if (!repeatWeekdays.length) return [];
      const dayTimeRanges = draft.availability.dayTimeRanges ?? {};
      const payloads = repeatWeekdays.map((weekdayIdx) => {
        const dayCode = Object.entries(weekdayIndex).find(([, idx]) => idx === weekdayIdx)?.[0] ?? "Mon";
        const range = dayTimeRanges[dayCode];
        const startRef = range?.start ? new Date(range.start) : timeStart;
        const endRef = range?.end ? new Date(range.end) : timeEnd;
        const startsAt = withTime(baseDate, startRef);
        const endsAt = withTime(baseDate, endRef);
        if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
        return {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          repeatWeekdays: [weekdayIdx],
          repeatUntil: null,
        };
      });
      return payloads;
    }
    const dateStart = new Date(draft.availability.dateStart);
    const dateEnd = new Date(draft.availability.dateEnd);
    const startsAt = withTime(dateStart, timeStart);
    const endsAt = withTime(dateEnd, timeEnd);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    return [
      {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        repeatWeekdays: null,
        repeatUntil: null,
      },
    ];
  };

  const syncAvailability = async (targetListingId: string) => {
    if (!token) return;
    const existing = await listAvailability({ token, listingId: targetListingId });
    await Promise.all(
      existing.map((entry) =>
        deleteAvailabilityEntry({ token, availabilityId: entry.id })
      )
    );
    const payloads = buildAvailabilityPayloads();
    if (!payloads.length) return;
    await Promise.all(
      payloads.map((payload) =>
        createAvailabilityEntry({
          token,
          listingId: targetListingId,
          kind: "open",
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          repeatWeekdays: payload.repeatWeekdays,
          repeatUntil: payload.repeatUntil,
        })
      )
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!published) return;
      const actionType = event.data.action.type;
      if (actionType === "GO_BACK" || actionType === "POP") {
        event.preventDefault();
      }
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
    if (
      !draft.spaceType ||
      !draft.permissionDeclared ||
      (requiresShortStay && (!hasHourlyPrice || !hasDailyPrice)) ||
      (requiresMonthly && !hasMonthlyPrice)
    ) {
      setError("Complete the required steps first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void trackEvent("mobile_host_publish_started", {
        pricingMode: draft.pricingMode,
        hasPhotos: draft.photos.length > 0,
      });
      const coverUrl =
        draft.coverHeading != null && mapsKey
          ? `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${draft.location.latitude},${draft.location.longitude}&heading=${draft.coverHeading}&pitch=${draft.coverPitch ?? 0}&fov=80&key=${mapsKey}`
          : null;
      const imageUrls = [
        ...(coverUrl ? [coverUrl] : []),
        ...draft.photos.filter(Boolean),
      ];
      const parsedHourly = Number.parseFloat(draft.pricePerHour);
      const parsedDaily = Number.parseFloat(draft.pricePerDay);
      const parsedMonthly = Number.parseFloat(draft.pricePerMonth);
      const inferredRateType =
        requiresShortStay && Number.isFinite(parsedHourly) && parsedHourly > 0 ? "hourly" : "daily";
      if (listingId) {
        await updateListing({
          token,
          listingId,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          rateType: inferredRateType,
          pricePerDay: parsedDaily,
          pricePerHour: requiresShortStay ? parsedHourly : null,
          pricePerMonth: requiresMonthly ? parsedMonthly : null,
          availabilityText: draft.availability.detail,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          arrivalInstructions: draft.arrivalInstructions.trim() || null,
          permissionDeclared: draft.permissionDeclared,
        });
        await syncAvailability(listingId);
      } else {
        const newListingId = await createListing({
          token,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          rateType: inferredRateType,
          pricePerDay: parsedDaily,
          pricePerHour: requiresShortStay ? parsedHourly : null,
          pricePerMonth: requiresMonthly ? parsedMonthly : null,
          availabilityText: draft.availability.detail,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          arrivalInstructions: draft.arrivalInstructions.trim() || null,
          permissionDeclared: draft.permissionDeclared,
        });
        await syncAvailability(newListingId);
      }
      setPublished(true);
      setShowSuccess(true);
      void trackEvent("mobile_host_publish_succeeded", {
        pricingMode: draft.pricingMode,
        listingId: listingId ?? "new",
      });
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })
          ?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Listings" as keyof RootStackParamList }],
            })
          );
      }, 1800);
    } catch (err) {
      void trackEvent("mobile_host_publish_failed", {
        pricingMode: draft.pricingMode,
        listingId: listingId ?? "new",
      });
      setError(err instanceof Error ? err.message : "Could not publish");
      setPublished(false);
      setShowSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <Text style={styles.kicker}>
          {listingId ? "Review & update" : "Review & publish"}
        </Text>
        <StepProgress current={7} total={7} />
        <Text style={styles.title}>Double‑check your details</Text>
        <Text style={styles.subtitle}>
          {listingId ? "Confirm everything looks right." : "You can edit anything after publishing."}
        </Text>

        <Pressable
          style={[
            styles.confirmRow,
            draft.permissionDeclared && styles.confirmRowActive,
          ]}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              permissionDeclared: !prev.permissionDeclared,
            }))
          }
        >
          <View
            style={[
              styles.confirmBox,
              draft.permissionDeclared && styles.confirmBoxActive,
            ]}
          >
            {draft.permissionDeclared ? (
              <Check size={14} color={colors.cardBg} strokeWidth={3} />
            ) : null}
          </View>
          <View style={styles.confirmTextWrap}>
            <Text style={styles.confirmTitle}>I have permission to rent this space</Text>
            <Text style={styles.confirmSubtitle}>
              You confirm you own this space or have the owner’s consent to list it.
            </Text>
          </View>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.mapPreview}>
            <Image
              style={styles.map}
              source={{
                uri: `https://maps.googleapis.com/maps/api/staticmap?center=${draft.location.latitude},${draft.location.longitude}&zoom=15&size=640x320&scale=2&markers=color:0x111111%7C${draft.location.latitude},${draft.location.longitude}&key=${mapsKey}`,
              }}
              resizeMode="cover"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Space type</Text>
            <Text style={styles.value}>{draft.spaceType || "Not set"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Availability</Text>
            <Text style={styles.value}>{draft.availability.detail || "Not set"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Price</Text>
            <Text style={styles.value}>
              {requiresShortStay && requiresMonthly
                ? `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day · €${draft.pricePerMonth}/month`
                : requiresMonthly
                  ? `€${draft.pricePerMonth || "0"}/month`
                  : draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0
                    ? `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day`
                    : draft.pricePerHour.trim().length > 0
                      ? `€${draft.pricePerHour}/hr`
                      : `€${draft.pricePerDay || "0"}/day`}
            </Text>
          </View>
        </View>
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>Edit a section</Text>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingLocation")}
          >
            <Text style={styles.editLabel}>Location</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingStreetView")}
          >
            <Text style={styles.editLabel}>Street view</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingDetails")}
          >
            <Text style={styles.editLabel}>Space details</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingAvailability")}
          >
            <Text style={styles.editLabel}>Availability</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
          <Pressable style={styles.editRow} onPress={() => navigation.navigate("ListingPrice")}>
            <Text style={styles.editLabel}>Price</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={[styles.editRow, styles.editRowLast]}
            onPress={() => navigation.navigate("ListingPhotos")}
          >
            <Text style={styles.editLabel}>Photos</Text>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>What gets bookings</Text>
          <Text style={styles.guidanceBody}>
            The strongest listings are easy to trust at a glance and easy to use after booking.
          </Text>
          <Text style={styles.guidanceBullet}>• Show exactly where the driver should park</Text>
          <Text style={styles.guidanceBullet}>• Add arrival notes and any code they need after booking</Text>
          <Text style={styles.guidanceBullet}>• Keep price and availability accurate to avoid cancellations</Text>
        </View>
      </ScrollView>
      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[
            styles.primaryButton,
            (!canPublish || submitting || published) && styles.primaryButtonDisabled,
          ]}
          onPress={handlePublish}
          disabled={!canPublish || submitting || published}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Saving..." : listingId ? "Update listing" : "Publish space"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={submitting || published}
        >
          <Text style={styles.secondaryButtonText}>Save and finish later</Text>
        </Pressable>
      </View>
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>Published</Text>
            <Text style={styles.successBody}>Your space is now live.</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 160,
    paddingTop: 0,
  },
  heroIllustration: {
    width: "100%",
    height: 160,
    marginBottom: 10,
  },
  kicker: {
    ...textStyles.kicker,
    fontFamily: "Inter-SemiBold",
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginTop: 12,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "#667085",
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    lineHeight: 22,
  },
  guidanceCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 18,
  },
  guidanceTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  guidanceBody: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    lineHeight: 22,
    marginTop: 6,
  },
  guidanceBullet: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "Inter-Medium",
    lineHeight: 20,
    marginTop: 8,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  editCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  editTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    letterSpacing: 0.2,
  },
  editRow: {
    alignItems: "center",
    borderTopColor: "rgba(17, 24, 39, 0.06)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  editRowLast: {
    borderBottomWidth: 0,
  },
  editLabel: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  mapPreview: {
    height: 160,
  },
  map: {
    flex: 1,
  },
  row: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmRow: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 16,
  },
  confirmRowActive: {
    borderColor: colors.accent,
  },
  confirmBox: {
    alignItems: "center",
    borderColor: "#cbd5f5",
    borderRadius: 8,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 2,
    width: 22,
  },
  confirmBoxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  confirmTextWrap: {
    flex: 1,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  confirmSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    width: 240,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Inter-Regular",
    marginTop: 4,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
});
