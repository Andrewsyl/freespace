import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteListing, getListing, updateListing } from "../api";
import { useAuth } from "../auth";
import { Toast } from "../components/Toast";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "EditListing">;

export function EditListingScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const listing = await getListing(id);
        setTitle(listing.title ?? "");
        setAddress(listing.address ?? "");
        setPricePerDay(String(listing.price_per_day ?? ""));
        setAvailabilityText(listing.availability_text ?? "");
        setImageUrl(listing.image_urls?.[0] ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleSave = async () => {
    if (!token) {
      setError("Sign in to edit listings.");
      return;
    }
    const price = Number.parseFloat(pricePerDay);
    if (!title.trim() || !address.trim()) {
      setError("Title and address are required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price per day.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateListing({
        token,
        listingId: id,
        title: title.trim(),
        address: address.trim(),
        pricePerDay: price,
        availabilityText: availabilityText.trim(),
        imageUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      });
      setToast("Listing updated.");
      setTimeout(() => navigation.goBack(), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save listing");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!token) {
      setError("Sign in to delete listings.");
      return;
    }
    Alert.alert("Delete listing", "This will permanently remove the listing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteListing({ token, listingId: id });
            await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
            setToast("Listing deleted.");
            setTimeout(() => navigation.goBack(), 1600);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete listing");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Toast message={toast ?? ""} variant="success" visible={!!toast} />
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Edit listing</Text>
        <View style={styles.topBarSpacer} />
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <AppTextInput variant="form" containerStyle={styles.fieldInput} value={title} onChangeText={setTitle} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <AppTextInput variant="form" containerStyle={styles.fieldInput} value={address} onChangeText={setAddress} />
          </View>
          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Price / day</Text>
              <AppTextInput
                variant="form"
                containerStyle={styles.fieldInput}
                value={pricePerDay}
                onChangeText={setPricePerDay}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Availability</Text>
              <AppTextInput
                variant="form"
                containerStyle={styles.fieldInput}
                value={availabilityText}
                onChangeText={setAvailabilityText}
                placeholder="Available every day"
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Image URL</Text>
            <AppTextInput
              variant="form"
              containerStyle={styles.fieldInput}
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
            />
          </View>
          </View>
          <Button
            title={saving ? "Saving..." : "Save changes"}
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            style={styles.primaryButton}
          />
          <Button title="Delete listing" variant="ghost" onPress={handleDelete} style={styles.deleteButton} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 6,
  },
  topBarSpacer: {
    height: 34,
    width: 34,
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 40,
  },
  field: {
    marginTop: 18,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldInput: {
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    gap: 14,
    marginTop: 2,
  },
  label: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  primaryButton: {
    marginTop: 24,
  },
  deleteButton: {
    marginTop: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    ...textStyles.meta,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formCard: {
    backgroundColor: colors.cardBg,
    borderColor: "rgba(17, 24, 39, 0.08)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...cardShadow,
  },
});
