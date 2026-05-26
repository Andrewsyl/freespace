import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createListing } from "../api";
import { useAuth } from "../auth";
import { BackButton, Button, TextInput as AppTextInput } from "../components/ui";
import { colors, spacing, textStyles } from "../styles/theme";

type Props = NativeStackScreenProps<any, any>;

export function CreateListingScreen({ navigation }: Props) {
  const decimalKeyboardType = Platform.OS === "ios" ? "decimal-pad" : "numeric";
  const { token, user } = useAuth();
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!token) {
      setError("Sign in to create a listing.");
      return;
    }
    if (!title.trim() || !address.trim() || !pricePerDay.trim()) {
      setError("Title, address, and price are required.");
      return;
    }
    const price = Number.parseFloat(pricePerDay);
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price per day.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Latitude and longitude are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createListing({
        token,
        title: title.trim(),
        address: address.trim(),
        pricePerDay: price,
        availabilityText: availabilityText.trim() || "Available now",
        latitude: lat,
        longitude: lng,
        imageUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      });
      navigation.replace("Listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Listing creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>List a space</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>List your space</Text>
            <Text style={styles.heroBody}>
              Add the key details now. You can refine pricing, photos, and availability later.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.kicker}>Host details</Text>
            <Text style={styles.subtitle}>
              Add the essentials so drivers can find and book your space.
            </Text>
            {user?.email ? <Text style={styles.notice}>Listing as {user.email}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <AppTextInput
                variant="form"
                containerStyle={styles.fieldInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Private driveway near city centre"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <AppTextInput
                variant="form"
                containerStyle={styles.fieldInput}
                value={address}
                onChangeText={setAddress}
                placeholder="123 Example Street, Dublin"
              />
            </View>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Price / day</Text>
                <AppTextInput
                  variant="form"
                  containerStyle={styles.fieldInput}
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  keyboardType={decimalKeyboardType}
                  placeholder="22"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Availability</Text>
                <AppTextInput
                  variant="form"
                  containerStyle={styles.fieldInput}
                  value={availabilityText}
                  onChangeText={setAvailabilityText}
                  placeholder="Available now"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Latitude</Text>
                <AppTextInput
                  variant="form"
                  containerStyle={styles.fieldInput}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType={decimalKeyboardType}
                  placeholder="53.3498"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Longitude</Text>
                <AppTextInput
                  variant="form"
                  containerStyle={styles.fieldInput}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType={decimalKeyboardType}
                  placeholder="-6.2603"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Image URL (optional)</Text>
              <AppTextInput
                variant="form"
                containerStyle={styles.fieldInput}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://..."
                autoCapitalize="none"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <Button
          title={submitting ? "Creating..." : "Publish listing"}
          onPress={handleCreate}
          disabled={submitting}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarSpacer: {
    height: 40,
    width: 40,
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
    paddingBottom: 108,
  },
  heroCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  heroIllustration: {
    width: 220,
    height: 150,
    marginBottom: 10,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  kicker: {
    ...textStyles.kicker,
    fontFamily: "Inter-SemiBold",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    lineHeight: 22,
    marginTop: 8,
  },
  notice: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  field: {
    marginTop: 16,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldInput: {
    marginBottom: 0,
  },
  label: {
    color: colors.textSoft,
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  footer: {
    backgroundColor: colors.appBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
