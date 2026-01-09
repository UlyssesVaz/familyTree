import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DatePickerField } from './DatePickerField';
import type { Gender, Person, RelativeType } from '@/types/family-tree';

interface AddPersonModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Person to add relative to */
  person: Person;
  /** Type of relative being added */
  relativeType: RelativeType;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when person is added */
  onAdd: (data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Gender;
    phoneNumber?: string;
  }) => void;
}

/**
 * Modal for adding a new person to the family tree
 * 
 * Form fields:
 * - Name (required)
 * - Photo (optional)
 * - Birth Date (optional)
 * - Gender (optional)
 */
export function AddPersonModal({
  visible,
  person,
  relativeType,
  onClose,
  onAdd,
}: AddPersonModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  const resetForm = () => {
    setName('');
    setPhotoUrl(undefined);
    setBirthDate('');
    setGender(undefined);
    setPhoneNumber('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a name');
      return;
    }

    onAdd({
      name: name.trim(),
      photoUrl,
      birthDate: birthDate.trim() || undefined,
      gender,
      phoneNumber: phoneNumber.trim() || undefined,
    });

    resetForm();
    onClose();
  };

  const pickImage = async () => {
    if (isPickingPhoto) return;
    
    setIsPickingPhoto(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const removePhoto = () => {
    setPhotoUrl(undefined);
  };

  const getRelativeTypeLabel = () => {
    switch (relativeType) {
      case 'parent':
        return 'Parent';
      case 'spouse':
        return 'Spouse';
      case 'child':
        return 'Child';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <ThemedView
          style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.icon }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.icon }]}>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <ThemedText style={[styles.headerButtonText, { color: colors.tint }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
              Add {getRelativeTypeLabel()}
            </ThemedText>
            <Pressable onPress={handleSave} style={styles.headerButton}>
              <ThemedText style={[styles.headerButtonText, { color: colors.tint }]}>
                Done
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Photo Section */}
            <View style={styles.photoSection}>
              {photoUrl ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
                  <Pressable onPress={removePhoto} style={styles.removePhotoButton}>
                    <MaterialIcons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={pickImage}
                  style={({ pressed }) => [
                    styles.photoPlaceholder,
                    { borderColor: colors.icon },
                    pressed && styles.photoPlaceholderPressed,
                  ]}
                  disabled={isPickingPhoto}
                >
                  <MaterialIcons name="add-photo-alternate" size={48} color={colors.icon} />
                  <ThemedText style={[styles.photoPlaceholderText, { color: colors.icon }]}>
                    {isPickingPhoto ? 'Loading...' : 'Add Photo'}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {/* Name Field */}
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Name *
              </ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                placeholder="Enter name"
                placeholderTextColor={colors.icon}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            {/* Birth Date Field */}
            <DatePickerField
              label="Birth Date"
                value={birthDate}
              onChange={setBirthDate}
              placeholder="Select birth date"
              hint="Format: YYYY-MM-DD (e.g., 1990-01-15)"
              />

            {/* Phone Number Field */}
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Phone Number
              </ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                placeholder="+1234567890 (optional)"
                placeholderTextColor={colors.icon}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              <ThemedText style={[styles.hint, { color: colors.icon }]}>
                We'll send them an invite to join the family tree
              </ThemedText>
            </View>

            {/* Gender Field */}
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Gender
              </ThemedText>
              <View style={styles.genderOptions}>
                <Pressable
                  onPress={() => setGender(gender === 'male' ? undefined : 'male')}
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
                  onPress={() => setGender(gender === 'female' ? undefined : 'female')}
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
                  onPress={() => setGender(gender === 'other' ? undefined : 'other')}
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
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderPressed: {
    opacity: 0.7,
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  hint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
