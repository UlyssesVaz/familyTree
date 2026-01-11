/**
 * Storage API Service
 * 
 * Handles all Supabase Storage operations for images.
 * Provides functions for uploading and downloading images from storage buckets.
 */

import { File } from 'expo-file-system/next';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from './supabase-init';

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  PERSON_PHOTOS: 'profile-images',
  UPDATE_PHOTOS: 'update-photos',
} as const;

/**
 * Upload a local image file to Supabase Storage
 * 
 * @param localUri - Local file URI (file://...)
 * @param bucket - Storage bucket name (default: profile-images)
 * @param folder - Optional folder path within bucket (e.g., 'profiles', 'updates')
 * @returns Public URL of uploaded image, or null if upload failed
 * @throws Error if upload fails
 */
export async function uploadImage(
  localUri: string,
  bucket: string = STORAGE_BUCKETS.PERSON_PHOTOS,
  folder?: string
): Promise<string | null> {
  // Validate URI format
  if (!localUri?.startsWith('file://')) {
    console.warn('[Storage API] Invalid local URI format:', localUri);
    return null;
  }

  const supabase = getSupabaseClient();

  try {
    // Read file as base64 using new File API (expo-file-system/next)
    const file = new File(localUri);
    const base64 = await file.base64();

    // Generate unique filename to prevent collisions
    const fileExtension = localUri.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Construct file path (with optional folder)
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Determine content type from extension
    const contentType = getContentType(fileExtension);

    // Decode base64 to ArrayBuffer for upload
    const arrayBuffer = decode(base64);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('[Storage API] Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upload succeeded but no data returned');
    }

    // Get public URL (bucket must be public)
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error: any) {
    console.error('[Storage API] Error uploading image:', error);
    throw error;
  }
}

/**
 * Download an image from Supabase Storage
 * 
 * @param path - File path in storage bucket
 * @param bucket - Storage bucket name (default: profile-images)
 * @returns Data URL (base64) of the image, or null if download failed
 */
export async function downloadImage(
  path: string,
  bucket: string = STORAGE_BUCKETS.PERSON_PHOTOS
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error('[Storage API] Download error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Convert blob to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error('[Storage API] FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(data);
    });
  } catch (error: any) {
    console.error('[Storage API] Error downloading image:', error);
    return null;
  }
}

/**
 * Get public URL for an image in Supabase Storage
 * 
 * @param path - File path in storage bucket
 * @param bucket - Storage bucket name (default: profile-images)
 * @returns Public URL string
 */
export function getPublicImageUrl(
  path: string,
  bucket: string = STORAGE_BUCKETS.PERSON_PHOTOS
): string {
  if (!path) {
    return '';
  }

  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const supabase = getSupabaseClient();
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete an image from Supabase Storage
 * 
 * @param path - File path in storage bucket
 * @param bucket - Storage bucket name (default: profile-images)
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteImage(
  path: string,
  bucket: string = STORAGE_BUCKETS.PERSON_PHOTOS
): Promise<boolean> {
  if (!path) {
    return false;
  }

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('[Storage API] Delete error:', error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('[Storage API] Error deleting image:', error);
    return false;
  }
}

/**
 * Get content type from file extension
 */
function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };

  return contentTypes[extension.toLowerCase()] || 'image/png';
}
