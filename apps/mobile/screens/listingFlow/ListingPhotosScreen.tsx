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
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";
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
      const responseText = await uploadResult.text().catch(() => "");
      if (responseText.includes("AccessDenied")) {
        throw new Error("Image upload is currently unavailable. S3 access was denied.");
      }
      if (responseText.includes("SignatureDoesNotMatch")) {
        throw new Error("Image upload signature failed. Check the server S3 credentials.");
      }
      if (responseText.includes("InvalidAccessKeyId") || responseText.includes("InvalidToken")) {
        throw new Error("Image upload credentials are invalid on the server.");
      }
      throw new Error("Upload failed. The storage service rejected the image.");
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Add photos (optional)</Text>
        <StepProgress current={7} total={8} />
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
      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel={hasPhoto ? "Continue" : "Skip for now"}
        onPrimary={() => navigation.navigate("ListingReview")}
        primaryDisabled={uploading}
      />
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
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: hostFlowColors.text,
    fontSize: 26,
    lineHeight: 34,
    fontFamily: "PlusJakartaSans-Bold",
    marginTop: 10,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: hostFlowColors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 8,
    lineHeight: 22,
  },
  uploadButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 16,
    minHeight: 48,
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
    fontSize: 16,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  uploadHint: {
    color: colors.textSoft,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 10,
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
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderWidth: 1,
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
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  continueButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
  },
  continueButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  secondaryButton: {
    borderRadius: 12,
    marginTop: 10,
    minHeight: 48,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    marginTop: 10,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: hostFlowColors.textMuted,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
});
