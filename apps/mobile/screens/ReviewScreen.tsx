import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SquircleBtn } from "../components/SquircleBtn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { ArrowLeft } from "lucide-react-native";
import { createReview } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { StarRating } from "../components/ui/StarRating";
import { colors, spacing, typography } from "../theme";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export function ReviewScreen({ navigation, route }: Props) {
  const { booking, initialRating } = route.params;
  const { token } = useAuth();
  const [rating, setRating] = useState(initialRating ?? 5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(100);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const end = new Date(booking.endTime);
  const canReview = booking.status === "confirmed" && end.getTime() <= Date.now();
  const showReviewNotice = !canReview && booking.status !== "canceled";

  const ratingPrompt = useMemo(() => {
    if (rating >= 4) return "Awesome! What did you like?";
    if (rating === 3) return "It was okay";
    if (rating > 0) return "What went wrong?";
    return "";
  }, [rating]);

  const submitLabel = useMemo(() => {
    if (existingRating) return "Reviewed";
    if (rating >= 4) return "Share the love";
    return "Submit review";
  }, [existingRating, rating]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(`bookingRating:${booking.id}`);
        if (!stored) return;
        const parsed = JSON.parse(stored) as { rating?: number };
        if (typeof parsed.rating === "number") {
          setExistingRating(parsed.rating);
          setRating(parsed.rating);
        }
      } catch {
        // Ignore stored rating errors.
      }
    })();
  }, [booking.id]);

  const handleSubmit = async () => {
    if (!token || !canReview || existingRating) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReview({
        token,
        bookingId: booking.id,
        rating,
        comment: feedback.trim() ? feedback.trim() : undefined,
      });
      await AsyncStorage.setItem(
        `bookingRating:${booking.id}`,
        JSON.stringify({ rating })
      );
      setIsSubmitted(true);
      setExistingRating(rating);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBackOrFallback(navigation, fallbackRoutes.bookings)}>
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Leave a review</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(0)}>
            <Text style={styles.mainTitle}>How was your parking?</Text>
            <Text style={styles.helperText}>Your feedback helps other drivers find great spots.</Text>
          </Animated.View>

          {showReviewNotice ? (
            <Animated.View entering={FadeInDown.delay(50)} style={styles.notice}>
              <Text style={styles.noticeText}>
                Reviews unlock once the booking has ended and is confirmed.
              </Text>
            </Animated.View>
          ) : null}

          <View style={styles.divider} />

          <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
            <Text style={styles.sectionLabel}>Your rating</Text>
            <View style={styles.starsRow}>
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                size={40}
                disabled={!!existingRating}
              />
            </View>
            {rating > 0 ? (
              <Animated.Text entering={FadeIn} style={styles.ratingFeedback}>
                {ratingPrompt}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <View style={styles.divider} />

          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <Text style={styles.sectionLabel}>Your feedback <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Tell other drivers what to expect…"
              placeholderTextColor={colors.text.tertiary}
              multiline
              style={[styles.textInput, { height: Math.max(100, inputHeight) }]}
              textAlignVertical="top"
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
              editable={canReview && !existingRating}
            />
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(300)} style={styles.ctaWrap}>
            <SquircleBtn
              label={submitLabel}
              onPress={handleSubmit}
              disabled={!canReview || rating === 0 || !!existingRating}
              loading={submitting}
              fullWidth
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isSubmitted ? (
        <Pressable style={styles.successOverlay} onPress={() => resetToSafeRoute(navigation, fallbackRoutes.bookings)}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../assets/successfully.json")}
              autoPlay
              loop={false}
              onAnimationFinish={() => {
                setTimeout(() => resetToSafeRoute(navigation, fallbackRoutes.bookings), 400);
              }}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>Review submitted!</Text>
            <Text style={styles.successBody}>
              Thanks for helping other drivers find great spots.
            </Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 34,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  notice: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.accent,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  noticeText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#d1d5db",
    marginVertical: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optional: {
    fontWeight: "400",
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 12,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingFeedback: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
    marginTop: 2,
  },
  textInput: {
    minHeight: 100,
    padding: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: 10,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  ctaWrap: {
    marginTop: spacing.lg,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#b42318",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
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
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 28,
    width: 280,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    lineHeight: 26,
    color: "#111827",
    marginTop: 8,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },
});
