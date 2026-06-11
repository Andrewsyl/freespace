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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getListingImageUploadUrl } from "../../api";
import { useAuth } from "../../auth";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { Camera, Info, Plus, Star, X } from "lucide-react-native";

type FlowStackParamList = {
  ListingPhotos: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const CARD_SHADOW = {
  shadowColor: "#2d1a0e",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
} as const;

const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Generous because photos can be several MB on slow uplinks, but bounded so a
// stalled connection can't leave the "Uploading…" state stuck forever.
const UPLOAD_TIMEOUT_MS = 60_000;

function uploadToS3(uploadUrl: string, formData: FormData): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText ?? "" });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: "" });
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.ontimeout = () => resolve({ ok: false, status: 0, body: "timeout" });
    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  });
}

export function ListingPhotosScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
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
      if (result.body === "timeout") throw new Error("Upload timed out. Check your connection and try again.");
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
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardTop}>
            <Text style={styles.headerKicker}>Step 6 · Photos</Text>
            <Text style={styles.headerTitle}>Show off your space</Text>
          </View>
          <View style={styles.headerCardBottom}>
            <Text style={styles.headerSubtitle}>
              Add at least one photo. Better photos improve trust and booking conversion.
            </Text>
          </View>
        </View>

        {/* Photos card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Your photos</Text>
          <View style={styles.cardBody}>
            {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

            {!hasPhoto ? (
              <Pressable
                style={[styles.emptyZone, uploading && styles.emptyZoneDisabled]}
                onPress={uploadPhotos}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="large" color={ACCENT} />
                ) : (
                  <>
                    <View style={styles.emptyIconWrap}>
                      <Camera size={28} color={ACCENT} strokeWidth={1.8} />
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

                <Pressable
                  style={[styles.addMoreBtn, uploading && styles.addMoreBtnDisabled]}
                  onPress={uploadPhotos}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <ActivityIndicator size="small" color={ACCENT} />
                      {uploadLabel ? <Text style={styles.addMoreText}>{uploadLabel}</Text> : null}
                    </>
                  ) : (
                    <>
                      <Plus size={16} color={ACCENT} strokeWidth={2.2} />
                      <Text style={styles.addMoreText}>Add more photos</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Tips card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsRow}>
            <Info size={15} color={ACCENT} strokeWidth={2.2} />
            <Text style={styles.tipsTitle}>Photos matter</Text>
          </View>
          <Text style={styles.tipsBody}>
            Listings with 3+ photos get significantly more bookings. Show the entrance, the bay, and any nearby street landmarks that help drivers find you.
          </Text>
        </View>
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
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  headerCardTop: {
    borderBottomColor: "#E2DAD2",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerKicker: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  headerCardBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSubtitle: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Photos card ──────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0C9C1",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardHeader: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD2",
  },
  cardBody: {
    padding: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    marginBottom: 12,
  },

  emptyZone: {
    borderWidth: 1.5,
    borderColor: hostFlowColors.accentSoftBorder,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    gap: 10,
  },
  emptyZoneDisabled: {
    opacity: 0.6,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: hostFlowColors.accentSoftBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
  emptyHint: {
    color: MUTED,
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
    backgroundColor: "#EDF7F2",
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
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },

  // ── Tips card ────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: "#F0FDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C6F0DC",
    padding: 16,
  },
  tipsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  tipsTitle: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tipsBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
