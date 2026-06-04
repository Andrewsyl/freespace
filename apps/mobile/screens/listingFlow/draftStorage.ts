import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ListingDraft } from "./context";

const HOST_LISTING_DRAFT_KEY = "host-listing-draft";

export type SavedHostListingDraft = {
  draft: ListingDraft;
  updatedAt: string;
};

export function hasMeaningfulHostListingDraft(draft: ListingDraft) {
  return Boolean(
    draft.location.address.trim() ||
      draft.spaceType.trim() ||
      draft.vehicleSize.trim() ||
      draft.photos.some((photo) => photo.trim().length > 0) ||
      draft.accessOptions.length > 0 ||
      draft.accessCode.trim() ||
      draft.arrivalInstructions.trim() ||
      draft.spaceCount.trim()
  );
}

export async function saveHostListingDraft(draft: ListingDraft) {
  const payload: SavedHostListingDraft = {
    draft,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(HOST_LISTING_DRAFT_KEY, JSON.stringify(payload));
}

export async function loadHostListingDraft() {
  const raw = await AsyncStorage.getItem(HOST_LISTING_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedHostListingDraft;
  } catch {
    return null;
  }
}

export async function clearHostListingDraft() {
  await AsyncStorage.removeItem(HOST_LISTING_DRAFT_KEY);
}
