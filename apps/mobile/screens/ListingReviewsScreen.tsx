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
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { listListingReviews, type ListingReview } from "../api";
import type { RootStackParamList } from "../types";
import { formatReviewDate } from "../utils/dateFormat";

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
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#111827" strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Ionicons name="star" size={20} color="#111827" />
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
              <Ionicons name="chevron-down" size={16} color="#64748B" />
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
                      <Ionicons
                        key={`${review.id}-star-${idx}`}
                        name="star"
                        size={12}
                        color={idx < Math.round(review.rating) ? "#F59E0B" : "#E5E7EB"}
                      />
                    ))}
                    <Text style={styles.reviewMeta}>
                      • {formatReviewDate(new Date(createdAt))} • Posted on FreeSpace
                    </Text>
                  </View>
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No reviews yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
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
    color: "#111827",
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  summarySection: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    color: "#111827",
  },
  summaryCount: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#6b7280",
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
    borderColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  sortText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: "#111827",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    color: "#111827",
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewMeta: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11,
    color: "#9ca3af",
  },
  reviewBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: "#374151",
    lineHeight: 21,
    marginTop: 2,
  },
  emptyText: {
    marginTop: 20,
    fontFamily: "PlusJakartaSans-Regular",
    color: "#9ca3af",
    fontSize: 13,
    textAlign: "center",
  },
});
