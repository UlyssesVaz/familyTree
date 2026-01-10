import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerOptions {
  /** Aspect ratio for image editing [width, height] */
  aspect?: [number, number];
  /** Image quality (0.0 - 1.0) */
  quality?: number;
  /** Custom permission denied message */
  permissionMessage?: string;
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Hook for handling image picking from device gallery
 * 
 * Provides:
 * - Image URI state
 * - Permission handling
 * - Image picking with editing
 * - Error handling
 * - Loading state
 * 
 * This hook eliminates duplicate image picking logic between
 * AddPersonModal.tsx and EditProfileModal.tsx.
 */
export function useImagePicker(
  initialUri: string | null = null,
  options: ImagePickerOptions = {}
) {
  const {
    aspect = [1, 1],
    quality = 0.8,
    permissionMessage = 'Please grant camera roll permissions to add photos',
    errorMessage = 'Failed to pick image',
  } = options;

  const [photoUri, setPhotoUri] = useState<string | null>(initialUri);
  const [isPicking, setIsPicking] = useState(false);

  const pickImage = async (): Promise<string | null> => {
    if (isPicking) return null;
    
    setIsPicking(true);
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', permissionMessage);
        return null;
      }

      // Launch image picker
      // TODO: MediaTypeOptions is deprecated, but MediaType enum doesn't exist in current expo-image-picker version
      // Using MediaTypeOptions for now - will migrate when expo-image-picker updates types
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Deprecated but still works - MediaType enum not available in expo-image-picker@17.0.10
        allowsEditing: true,
        aspect,
        quality,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        return uri;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setIsPicking(false);
    }
  };

  const removePhoto = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const reset = useCallback((uri: string | null = null) => {
    setPhotoUri(uri);
  }, []);

  return {
    photoUri,
    setPhotoUri,
    pickImage,
    removePhoto,
    reset,
    isPicking,
  };
}

