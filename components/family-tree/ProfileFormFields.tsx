/**
 * Profile Form Fields Component
 * 
 * Reusable form fields extracted from EditProfileModal.
 * Used in both EditProfileModal and Onboarding screens.
 */

import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useImagePicker } from '@/hooks/use-image-picker';
import { DatePickerField } from './DatePickerField';
import type { Gender } from '@/types/family-tree';

export interface ProfileFormData {
  name: string;
  bio?: string;
  birthDate?: string;
  gender?: Gender;
  photoUrl?: string;
}

interface ProfileFormFieldsProps {
  /** Initial form values */
  initialValues?: Partial<ProfileFormData>;
  /** Callback when form data changes */
  onChange: (data: ProfileFormData) => void;
  /** Whether to show bio field */
  showBio?: boolean;
  /** Whether name is required */
  nameRequired?: boolean;
}

export function ProfileFormFields({
  initialValues = {},
  onChange,
  showBio = true,
  nameRequired = true,
}: ProfileFormFieldsProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState(initialValues.name || '');
  const [bio, setBio] = useState(initialValues.bio || '');
  const [birthDate, setBirthDate] = useState(initialValues.birthDate || '');
  const [gender, setGender] = useState<Gender | undefined>(initialValues.gender);
  
  // Use centralized image picker hook
  const { photoUri, pickImage, removePhoto, reset: resetImage, isPicking } = useImagePicker(
    initialValues.photoUrl || null,
    {
      aspect: [1, 1],
      quality: 0.8,
      permissionMessage: 'We need access to your photos to add a profile picture.',
    }
  );

  // Update image picker when initialValues change (e.g., when editing existing profile)
  useEffect(() => {
    if (initialValues.photoUrl !== photoUri) {
      resetImage(initialValues.photoUrl || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues.photoUrl]); // Only react to photoUrl changes from parent

  // Notify parent of changes
  const updateParent = (updates: Partial<ProfileFormData>) => {
    onChange({
      name,
      bio: bio || undefined,
      birthDate: birthDate || undefined,
      gender,
      photoUrl: photoUri || undefined,
      ...updates,
    });
  };

  // Handle image picked - update parent immediately
  const handlePickImage = async () => {
    const uri = await pickImage();
    if (uri) {
      updateParent({ photoUrl: uri });
    }
  };

  const handleRemovePhoto = () => {
    removePhoto();
    updateParent({ photoUrl: undefined });
  };

  const handleNameChange = (text: string) => {
    setName(text);
    updateParent({ name: text });
  };

  const handleBioChange = (text: string) => {
    setBio(text);
    updateParent({ bio: text || undefined });
  };

  const handleBirthDateChange = (date: string) => {
    setBirthDate(date);
    updateParent({ birthDate: date || undefined });
  };

  const handleGenderChange = (newGender: Gender) => {
    const finalGender = gender === newGender ? undefined : newGender;
    setGender(finalGender);
    updateParent({ gender: finalGender });
  };

  return (
    <View>
      {/* Photo Section */}
      <View style={styles.photoSection}>
        <ThemedText style={styles.label}>Profile Photo</ThemedText>
        <View style={styles.photoContainer}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.photoPreview}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: colors.icon }]}>
              <MaterialIcons name="person" size={60} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.photoButtons}>
            <Pressable
              onPress={handlePickImage}
              disabled={isPicking}
              style={({ pressed }) => [
                styles.photoButton,
                { borderColor: colors.tint, opacity: (isPicking || pressed) ? 0.6 : 1 },
                pressed && styles.photoButtonPressed,
              ]}
            >
              <ThemedText style={[styles.photoButtonText, { color: colors.tint }]}>
                {isPicking ? 'Loading...' : (photoUri ? 'Change Photo' : 'Select Photo')}
              </ThemedText>
            </Pressable>
            {photoUri && (
              <Pressable
                onPress={handleRemovePhoto}
                style={({ pressed }) => [
                  styles.photoButton,
                  styles.removeButton,
                  { borderColor: '#FF3B30' },
                  pressed && styles.photoButtonPressed,
                ]}
              >
                <ThemedText style={[styles.photoButtonText, { color: '#FF3B30' }]}>
                  Remove
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Name Field */}
      <View style={styles.field}>
        <ThemedText style={styles.label}>
          Name {nameRequired && '*'}
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.icon,
              backgroundColor: colors.background,
            },
          ]}
          value={name}
          onChangeText={handleNameChange}
          placeholder="Your name"
          placeholderTextColor={colors.icon}
        />
      </View>

      {/* Bio Field */}
      {showBio && (
        <View style={styles.field}>
          <ThemedText style={styles.label}>Bio</ThemedText>
          <TextInput
            style={[
              styles.textArea,
              {
                color: colors.text,
                borderColor: colors.icon,
                backgroundColor: colors.background,
              },
            ]}
            value={bio}
            onChangeText={handleBioChange}
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.icon}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Birth Date Field */}
      <DatePickerField
        label="Birth Date"
        value={birthDate}
        onChange={handleBirthDateChange}
        placeholder="Select birth date"
        hint="Format: YYYY-MM-DD (e.g., 2000-01-15)"
      />

      {/* Gender Field */}
      <View style={styles.field}>
        <ThemedText style={styles.label}>Gender</ThemedText>
        <View style={styles.genderOptions}>
          <Pressable
            onPress={() => handleGenderChange('male')}
            style={({ pressed }) => [
              styles.genderOption,
              { borderColor: colors.icon },
              gender === 'male' && { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
              pressed && styles.genderOptionPressed,
            ]}
          >
            <ThemedText
              style={[
                styles.genderOptionText,
                gender === 'male' && { color: '#FFFFFF' },
              ]}
            >
              Male
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleGenderChange('female')}
            style={({ pressed }) => [
              styles.genderOption,
              { borderColor: colors.icon },
              gender === 'female' && { backgroundColor: '#F5A623', borderColor: '#F5A623' },
              pressed && styles.genderOptionPressed,
            ]}
          >
            <ThemedText
              style={[
                styles.genderOptionText,
                gender === 'female' && { color: '#FFFFFF' },
              ]}
            >
              Female
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleGenderChange('other')}
            style={({ pressed }) => [
              styles.genderOption,
              { borderColor: colors.icon },
              gender === 'other' && { backgroundColor: colors.icon, borderColor: colors.icon },
              pressed && styles.genderOptionPressed,
            ]}
          >
            <ThemedText
              style={[
                styles.genderOptionText,
                gender === 'other' && { color: '#FFFFFF' },
              ]}
            >
              Other
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    opacity: 0.8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  photoButtonPressed: {
    opacity: 0.7,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    borderColor: '#FF3B30',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderOptionPressed: {
    opacity: 0.7,
  },
  genderOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

