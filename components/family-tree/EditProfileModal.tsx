import { useState, useEffect } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DatePickerField } from './DatePickerField';
import type { Gender, Person } from '@/types/family-tree';

interface EditProfileModalProps {
  /** Person to edit (should be ego) */
  person: Person;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when save is pressed with updated data */
  onSave: (updates: Partial<Pick<Person, 'name' | 'bio' | 'birthDate' | 'gender' | 'photoUrl'>>) => void;
}

/**
 * Edit Profile Modal
 * 
 * Instagram-style edit profile modal for editing name, bio, and basic info.
 */
export function EditProfileModal({ person, visible, onClose, onSave }: EditProfileModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState(person.name);
  const [bio, setBio] = useState(person.bio || '');
  const [birthDate, setBirthDate] = useState(person.birthDate || '');
  const [photoUri, setPhotoUri] = useState<string | null>(person.photoUrl || null);

  // Update form when person changes
  useEffect(() => {
    setName(person.name);
    setBio(person.bio || '');
    setBirthDate(person.birthDate || '');
    setPhotoUri(person.photoUrl || null);
  }, [person]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photos to change your profile picture.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      // Use the edited URI if available, otherwise use the original
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
  };

  const handleSave = () => {
    onSave({
      name: name.trim(),
      bio: bio.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      photoUrl: photoUri || undefined,
    });
    onClose();
  };

  const hasChanges =
    name.trim() !== person.name ||
    bio.trim() !== (person.bio || '') ||
    birthDate.trim() !== (person.birthDate || '') ||
    photoUri !== (person.photoUrl || null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            Edit Profile
          </ThemedText>
          <Pressable
            onPress={handleSave}
            disabled={!hasChanges}
            style={[styles.headerButton, !hasChanges && styles.headerButtonDisabled]}
          >
            <ThemedText
              style={[
                styles.doneText,
                !hasChanges && styles.doneTextDisabled,
              ]}
            >
              Done
            </ThemedText>
          </Pressable>
        </View>

        {/* Form - Scrollable */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
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
                  onPress={pickImage}
                  style={({ pressed }) => [
                    styles.photoButton,
                    pressed && styles.photoButtonPressed,
                  ]}
                >
                  <ThemedText style={styles.photoButtonText}>
                    {photoUri ? 'Change Photo' : 'Select Photo'}
                  </ThemedText>
                </Pressable>
                {photoUri && (
                  <Pressable
                    onPress={removePhoto}
                    style={({ pressed }) => [
                      styles.photoButton,
                      styles.removeButton,
                      pressed && styles.photoButtonPressed,
                    ]}
                  >
                    <ThemedText style={[styles.photoButtonText, styles.removeButtonText]}>
                      Remove
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>Name</ThemedText>
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
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.icon}
            />
          </View>

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
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.icon}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <DatePickerField
            label="Birth Date"
            value={birthDate}
            onChange={setBirthDate}
            placeholder="Select birth date"
            hint="Format: YYYY-MM-DD (e.g., 2000-01-15)"
          />
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonDisabled: {
    opacity: 0.3,
  },
  headerTitle: {
    fontSize: 18,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  doneTextDisabled: {
    opacity: 0.3,
  },
  form: {
    padding: 16,
    paddingBottom: 32,
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
  hint: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.6,
  },
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
    borderColor: '#0a7ea4',
  },
  photoButtonPressed: {
    opacity: 0.7,
  },
  removeButton: {
    borderColor: '#FF3B30',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  removeButtonText: {
    color: '#FF3B30',
  },
});

