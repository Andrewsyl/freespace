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
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { colors, spacing } from "../../styles/theme";
import { Camera, Plus, X, Star } from "lucide-react-native";

type FlowStackParamList = {
  ListingPhotos: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// XHR-based S3 upload — more reliable than fetch + FormData for repeated binary uploads in RN
function uploadToS3(uploadUrl: string, formData: FormData): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText ?? "" });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: "" });
    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  });
}

export function ListingPhotosScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photos = draft.photos.filter((photo) => photo?.trim());
  const hasPhoto = photos.length > 0;

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

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
    if (!upload.uploadUrl || !upload.uploadFields) throw new Error("Upload URL is missing.");
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

    const result = await uploadToS3(upload.uploadUrl, formData);
    if (!result.ok) {
      if (result.body.includes("AccessDenied")) throw new Error("Image upload is currently unavailable.");
      if (result.body.includes("SignatureDoesNotMatch")) throw new Error("Image upload signature failed.");
      if (result.body.includes("InvalidAccessKeyId") || result.body.includes("InvalidToken")) throw new Error("Image upload credentials are invalid.");
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
    const nextUrls: string[] = [];
    try {
      for (let i = 0; i < result.assets.length; i += 1) {
        setUploadLabel(`Uploading ${i + 1} of ${result.assets.length}…`);
        const asset = result.assets[i];
        if (!asset) continue;
        const url = await uploadAsset(asset);
        if (url) nextUrls.push(url);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      // Save whatever succeeded, even if a later image errored
      if (nextUrls.length > 0) {
        setDraft((prev) => {
          const merged = [...prev.photos, ...nextUrls];
          const deduped = Array.from(new Set(merged.filter((v) => v?.trim())));
          return { ...prev, photos: deduped };
        });
      }
      setUploading(false);
      setUploadLabel(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={6} total={8} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Photos</Text>
        <Text style={styles.title}>Show off your space</Text>
        <Text style={styles.subtitle}>
          Add at least one photo. Better photos improve trust and booking conversion.
        </Text>

        {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

        {!hasPhoto ? (
          // Empty state — large dashed zone
          <Pressable
            style={[styles.emptyZone, uploading && styles.emptyZoneDisabled]}
            onPress={uploadPhotos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="large" color={hostFlowColors.accent} />
            ) : (
              <>
                <View style={styles.emptyIconWrap}>
                  <Camera size={28} color={hostFlowColors.accent} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>Add photos</Text>
                <Text style={styles.emptyHint}>JPG, PNG, WEBP or HEIC · max 10MB each</Text>
              </>
            )}
          </Pressable>
        ) : (
          <>
            <View style={styles.grid}>
              {photos.map((uri, index) => (
                <View key={uri} style={styles.photoCard}>
                  <Image source={{ uri }} style={styles.photoImage} />
                  {index === 0 ? (
                    <View style={styles.coverBadge}>
                      <Star size={10} color="#ffffff" strokeWidth={2.5} fill="#ffffff" />
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removePhoto(uri)}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <X size={12} color="#ffffff" strokeWidth={2.8} />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Add more — always full-width below the grid, never squeezed into a grid slot */}
            <Pressable
              style={[styles.addMoreBtn, uploading && styles.addMoreBtnDisabled]}
              onPress={uploadPhotos}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <ActivityIndicator size="small" color={hostFlowColors.accent} />
                  {uploadLabel ? <Text style={styles.addMoreText}>{uploadLabel}</Text> : null}
                </>
              ) : (
                <>
                  <Plus size={16} color={hostFlowColors.accent} strokeWidth={2.2} />
                  <Text style={styles.addMoreText}>Add more photos</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel={hasPhoto ? "Continue" : "Skip for now"}
        onPrimary={() => navigation.navigate("ListingPrice")}
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
    paddingBottom: 120,
    paddingTop: 0,
  },
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 20,
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
    marginBottom: 20,
  },
  emptyZone: {
    borderWidth: 1.5,
    borderColor: hostFlowColors.accentSoftBorder,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    gap: 10,
  },
  emptyZoneDisabled: {
    opacity: 0.6,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: hostFlowColors.accentSoftBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  emptyHint: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoCard: {
    width: "48%",
    aspectRatio: 1.2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: hostFlowColors.cardBgMuted,
    borderColor: hostFlowColors.border,
    borderWidth: 1,
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  coverBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(10, 128, 80, 0.88)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  coverBadgeText: {
    color: "#ffffff",
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  removeBtn: {
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
  // Add more — full-width row below the grid, never crammed into a grid slot
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: hostFlowColors.accentSoftBorder,
    backgroundColor: hostFlowColors.accentSoft,
  },
  addMoreBtnDisabled: {
    opacity: 0.5,
  },
  addMoreText: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    marginBottom: 12,
  },
});
