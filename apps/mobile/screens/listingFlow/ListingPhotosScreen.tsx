import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getListingImageUploadUrl } from "../../api";
import { useAuth } from "../../auth";
import { Button } from "../../components/ui";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, spacing, textStyles } from "../../styles/theme";
import { Plus, X } from "lucide-react-native";

type FlowStackParamList = {
  ListingPhotos: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function ListingPhotosScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photos = draft.photos.filter((photo) => photo?.trim());
  const hasPhoto = photos.length > 0;

  const removePhoto = (url: string) => {
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((photo) => photo !== url),
    }));
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) throw new Error("Sign in to upload photos.");
    const contentType = asset.mimeType ?? "image/jpeg";
    if (!ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase())) {
      throw new Error("Unsupported file type. Please upload a JPG, PNG, WEBP, or HEIC image.");
    }
    const fileSize = asset.fileSize ?? 0;
    if (!fileSize || fileSize > MAX_PHOTO_UPLOAD_BYTES) {
      throw new Error("Each photo must be 10MB or smaller.");
    }
    const upload = await getListingImageUploadUrl({ token, contentType, fileSizeBytes: fileSize });
    if (!upload.uploadUrl || !upload.uploadFields) {
      throw new Error("Upload URL is missing.");
    }
    if (!asset.uri) throw new Error("Selected photo is missing a file URI.");
    const formData = new FormData();
    Object.entries(upload.uploadFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append("file", {
      uri: asset.uri,
      name: `listing-photo.${contentType.split("/")[1] ?? "jpg"}`,
      type: contentType,
    } as unknown as Blob);
    const uploadResult = await fetch(upload.uploadUrl, {
      method: "POST",
      body: formData,
    });
    if (!uploadResult.ok) {
      throw new Error("Upload failed. Try again.");
    }
    return upload.publicUrl;
  };

  const uploadPhotos = async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upload photos.");
      return;
    }
    setUploadError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Enable photo access to upload images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.85,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const nextUrls: string[] = [];
      for (let i = 0; i < result.assets.length; i += 1) {
        setUploadLabel(`Uploading ${i + 1} of ${result.assets.length}...`);
        const asset = result.assets[i];
        if (!asset) continue;
        const url = await uploadAsset(asset);
        if (!url) continue;
        nextUrls.push(url);
      }
      setDraft((prev) => {
        const merged = [...prev.photos, ...nextUrls];
        const deduped = Array.from(new Set(merged.filter((value) => value?.trim())));
        return { ...prev, photos: deduped };
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadLabel(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Add photos (optional)</Text>
        <StepProgress current={6} total={7} />
        <Text style={styles.title}>Show off your space</Text>
        <Text style={styles.subtitle}>
          Add multiple photos in one go. Better photos improve trust and booking conversion.
        </Text>

        {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

        <Pressable
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={uploadPhotos}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={styles.uploadButtonInner}>
              <Plus size={18} color="#ffffff" strokeWidth={2.6} />
              <Text style={styles.uploadButtonText}>
                {hasPhoto ? "Add more photos" : "Upload photos"}
              </Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.uploadHint}>
          {uploadLabel ?? "You can select multiple images from your gallery."}
        </Text>

        {hasPhoto ? (
          <View style={styles.grid}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoCard}>
                <Image source={{ uri }} style={styles.photoImage} />
                <Pressable
                  style={styles.removeChip}
                  onPress={() => removePhoto(uri)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <X size={14} color="#ffffff" strokeWidth={2.8} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={() => navigation.navigate("ListingReview")}
          disabled={!hasPhoto || uploading}
        />
        <Button
          title="Skip for now"
          variant="secondary"
          onPress={() => navigation.navigate("ListingReview")}
          style={styles.secondaryButton}
        />
      </View>
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
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 6,
    lineHeight: 20,
  },
  uploadButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: 18,
    minHeight: 50,
    justifyContent: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.85,
  },
  uploadButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  uploadHint: {
    color: colors.textSoft,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  photoCard: {
    width: "48%",
    aspectRatio: 1.2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  removeChip: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  secondaryButton: {
    marginTop: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 10,
  },
});
