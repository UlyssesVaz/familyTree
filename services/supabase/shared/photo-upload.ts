/**
 * Shared Photo Upload Utility
 * 
 * Centralized logic for uploading local photos to Supabase Storage.
 * Used by people-api.ts and updates-api.ts to avoid duplication.
 */

import { uploadImage, STORAGE_BUCKETS } from '../storage-api';

/**
 * Upload a photo to Supabase Storage if it's a local file URI
 * 
 * @param photoUrl - Photo URL (can be local file:// URI or remote URL)
 * @param bucket - Storage bucket name (default: PERSON_PHOTOS)
 * @param folder - Folder path within bucket (e.g., 'profiles/{userId}', 'relatives/{userId}')
 * @param apiName - Name of the calling API (for error logging)
 * @returns Uploaded URL if local file was uploaded, original URL if remote, or null/undefined if upload failed
 */
export async function uploadPhotoIfLocal(
  photoUrl: string | undefined,
  bucket: string = STORAGE_BUCKETS.PERSON_PHOTOS,
  folder?: string,
  apiName: string = 'API'
): Promise<string | null | undefined> {
  // If no photo URL provided, return as-is
  if (!photoUrl) {
    return photoUrl;
  }

  // If not a local file URI, return original URL
  if (!photoUrl.startsWith('file://')) {
    return photoUrl;
  }

  // Upload local file to Supabase Storage
  try {
    const uploadedUrl = await uploadImage(photoUrl, bucket, folder);

    if (uploadedUrl) {
      return uploadedUrl; // Use uploaded URL instead of local URI
    } else {
      console.warn(`[${apiName}] Photo upload returned null, continuing without photo`);
      return null;
    }
  } catch (error: any) {
    console.error(`[${apiName}] Error uploading photo:`, error);
    // Don't fail the entire operation if photo upload fails
    // Return null to indicate upload failed (caller can handle appropriately)
    return null;
  }
}
