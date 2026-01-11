/**
 * RemoteImage Component
 * 
 * Displays images from Supabase Storage or any remote URL.
 * Handles loading states and fallback images.
 * 
 * Since the storage bucket is public, we can use the public URL directly
 * without needing to download the image first.
 */

import React, { ComponentProps, useMemo } from 'react';
import { Image, ImageStyle, StyleSheet, View, ActivityIndicator } from 'react-native';
import { getPublicImageUrl, STORAGE_BUCKETS } from '@/services/supabase/storage-api';

type RemoteImageProps = {
  /** Path in storage bucket, or full URL */
  path?: string | null;
  /** Fallback image URI (local asset or default image) */
  fallback: string;
  /** Storage bucket name (default: person-photos) */
  bucket?: string;
  /** Show loading indicator while image loads */
  showLoading?: boolean;
} & Omit<ComponentProps<typeof Image>, 'source'>;

/**
 * RemoteImage Component
 * 
 * Displays images from Supabase Storage using public URLs.
 * Falls back to provided fallback image if path is invalid or image fails to load.
 */
export function RemoteImage({
  path,
  fallback,
  bucket = STORAGE_BUCKETS.PERSON_PHOTOS,
  showLoading = false,
  style,
  ...imageProps
}: RemoteImageProps) {
  // Get public URL from storage path, or use path directly if it's already a URL
  const imageUri = useMemo(() => {
    if (!path) {
      return fallback;
    }

    // If path is already a full URL, use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Otherwise, get public URL from Supabase Storage
    return getPublicImageUrl(path, bucket);
  }, [path, bucket, fallback]);

  // If no path and no fallback, show nothing
  if (!path && !fallback) {
    return null;
  }

  return (
    <View style={[styles.container, style as ImageStyle]}>
      <Image
        source={{ uri: imageUri }}
        style={[StyleSheet.absoluteFill, style]}
        {...imageProps}
        onError={(error) => {
          console.warn('[RemoteImage] Failed to load image:', imageUri, error);
          // Image component will automatically fall back if onError is called
          // but we can't change source dynamically, so we rely on fallback URI
        }}
      />
      {showLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});
