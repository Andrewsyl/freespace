import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import { createReview } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { StarRating } from "../components/ui/StarRating";
import { colors, spacing, typography } from "../theme";

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
    if (isSubmitted) return "✓ Thank you!";
    if (existingRating) return "Reviewed";
    if (rating >= 4) return "Share the love";
    return "Submit review";
  }, [isSubmitted, existingRating, rating]);

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
      setTimeout(() => {
        navigation.popToTop();
      }, 900);
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
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
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

          {existingRating ? (
            <Animated.View entering={FadeInDown.delay(50)} style={styles.notice}>
              <Text style={styles.noticeText}>
                You already rated this booking {existingRating} out of 5.
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
              <Animated.Text entering={FadeIn} exiting={FadeOut} style={styles.ratingFeedback}>
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
            {feedback.length > 0 ? (
              <Animated.Text entering={FadeIn} style={styles.charCount}>
                {feedback.length} chars · Looking good ✨
              </Animated.Text>
            ) : null}
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Animated.View entering={FadeInDown.delay(300)} style={styles.ctaWrap}>
            {!canReview || rating === 0 || !!existingRating ? (
              <View style={[styles.ctaBtn, styles.ctaBtnDisabled]}>
                <Text style={styles.ctaBtnTextDisabled}>{submitLabel}</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.82 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaBtnText}>{submitLabel}</Text>
                )}
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isSubmitted ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.successOverlay} pointerEvents="none">
          <Animated.View entering={ZoomIn.springify().damping(10)} exiting={ZoomOut} style={styles.successCircle}>
            <Text style={styles.successEmoji}>🎉</Text>
          </Animated.View>
        </Animated.View>
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
  charCount: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
  ctaWrap: {
    marginTop: spacing.lg,
  },
  ctaBtn: {
    backgroundColor: "#0fa968",
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  ctaBtnDisabled: {
    backgroundColor: "#E0E0DE",
  },
  ctaBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: -0.1,
  },
  ctaBtnTextDisabled: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#9A9A9A",
    letterSpacing: -0.1,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error.main,
    marginTop: spacing.xs,
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  successCircle: {
    backgroundColor: colors.background.secondary,
    borderRadius: 80,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successEmoji: {
    fontSize: 52,
  },
});
