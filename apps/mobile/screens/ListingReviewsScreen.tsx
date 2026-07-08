import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ChevronDown, Star } from "lucide-react-native";
import { listListingReviews, type ListingReview } from "../api";
import { colors } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { formatReviewDate } from "../utils/dateFormat";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

const SORT_OPTIONS = ["Most relevant", "Newest"] as const;

type Props = NativeStackScreenProps<RootStackParamList, "ListingReviews">;

type SortKey = (typeof SORT_OPTIONS)[number];

const sortReviews = (items: ListingReview[], sort: SortKey) => {
  if (sort === "Newest") {
    return [...items].sort((a, b) => {
      const aDate = Date.parse((a as { created_at?: string }).created_at ?? a.createdAt ?? "");
      const bDate = Date.parse((b as { created_at?: string }).created_at ?? b.createdAt ?? "");
      return bDate - aDate;
    });
  }
  return items;
};

export function ListingReviewsScreen({ navigation, route }: Props) {
  const { id, rating, ratingCount } = route.params;
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("Most relevant");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listListingReviews(id);
        if (!active) return;
        setReviews(data);
      } catch {
        if (active) setReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const totalReviews = ratingCount ?? reviews.length;
  const ratingValue = typeof rating === "number" ? rating : 0;
  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBackOrFallback(navigation, fallbackRoutes.search)}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Star size={20} color={colors.text} fill={colors.text} strokeWidth={2} />
              <View>
                <Text style={styles.summaryRating}>{ratingValue.toFixed(2)}</Text>
                <Text style={styles.summaryCount}>{totalReviews} Reviews</Text>
              </View>
            </View>
            <Pressable
              style={styles.sortButton}
              onPress={() =>
                setSort((prev) => (prev === "Most relevant" ? "Newest" : "Most relevant"))
              }
            >
              <Text style={styles.sortText}>{sort}</Text>
              <ChevronDown size={16} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        ) : sortedReviews.length ? (
          <View style={styles.reviewList}>
            {sortedReviews.map((review) => {
              const createdAt = (review as { created_at?: string }).created_at ?? review.createdAt;
              const author =
                (review as { author_name?: string }).author_name ?? review.authorName ?? "Guest";
              return (
                <View key={review.id} style={styles.reviewRow}>
                  <Text style={styles.reviewAuthor}>{author}</Text>
                  <View style={styles.reviewStarsRow}>
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Star
                        key={`${review.id}-star-${idx}`}
                        size={12}
                        color={idx < Math.round(review.rating) ? colors.star.active : colors.star.inactive}
                        fill={idx < Math.round(review.rating) ? colors.star.active : "none"}
                        strokeWidth={2}
                      />
                    ))}
                    <Text style={styles.reviewMeta}>
                      {formatReviewDate(new Date(createdAt))}
                    </Text>
                  </View>
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reviews yet.</Text>
            <Pressable style={styles.emptyButton} onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}>
              <Text style={styles.emptyButtonText}>Browse spaces</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardBgMuted,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  summarySection: {
    backgroundColor: colors.cardBgMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryRating: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: colors.text,
  },
  summaryCount: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  sortText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: colors.text,
  },
  loader: {
    marginTop: 24,
    alignItems: "center",
  },
  reviewList: {
    marginTop: 12,
    gap: 10,
  },
  reviewRow: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewAuthor: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewMeta: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11,
    color: colors.textDisabled,
  },
  reviewBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 20,
  },
  emptyText: {
    fontFamily: "PlusJakartaSans-Regular",
    color: colors.textDisabled,
    fontSize: 13,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  emptyButtonText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
});
