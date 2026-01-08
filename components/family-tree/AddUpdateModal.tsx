import { useState, useEffect } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import type { Update } from '@/types/family-tree';

interface AddUpdateModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when photo is added */
  onAdd: (title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => void;
  /** Optional: Update to edit (if provided, modal is in edit mode) */
  updateToEdit?: Update;
  /** Optional: Callback when update is edited */
  onEdit?: (updateId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => void;
  /** Optional: Person ID - if provided, this person won't appear in tag list (they're the owner) */
  personId?: string;
}

/**
 * Add Update Modal
 * 
 * Modal for adding photos/updates to profile.
 * Can also be used for editing existing updates.
 */
export function AddUpdateModal({ visible, onClose, onAdd, updateToEdit, onEdit, personId }: AddUpdateModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const isEditMode = !!updateToEdit;
  const people = useFamilyTreeStore((state) => state.people);
  const getPerson = useFamilyTreeStore((state) => state.getPerson);

  const [title, setTitle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [taggedPersonIds, setTaggedPersonIds] = useState<string[]>([]);

  // Populate form when editing
  useEffect(() => {
    if (updateToEdit) {
      setTitle(updateToEdit.title);
      setPhotoUri(updateToEdit.photoUrl);
      setCaption(updateToEdit.caption || '');
      setIsPublic(updateToEdit.isPublic);
      setTaggedPersonIds(updateToEdit.taggedPersonIds || []);
    } else {
      // Reset form when not editing
      setTitle('');
      setPhotoUri(null);
      setCaption('');
      setIsPublic(true);
      setTaggedPersonIds([]);
    }
  }, [updateToEdit, visible]);

  // Get all people except the owner (personId) for tagging
  const availablePeople = Array.from(people.values()).filter(
    (person) => person.id !== personId
  );

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photos to add updates.'
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
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleAdd = () => {
    if (!photoUri) {
      Alert.alert('No Photo', 'Please select a photo first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this update.');
      return;
    }

    if (isEditMode && updateToEdit && onEdit) {
      // Edit mode
      onEdit(updateToEdit.id, title.trim(), photoUri, caption.trim() || undefined, isPublic, taggedPersonIds);
    } else {
      // Add mode
      onAdd(title.trim(), photoUri, caption.trim() || undefined, isPublic, taggedPersonIds);
    }

    // Reset form
    setTitle('');
    setPhotoUri(null);
    setCaption('');
    setIsPublic(true);
    setTaggedPersonIds([]);
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    setPhotoUri(null);
    setCaption('');
    setIsPublic(true);
    setTaggedPersonIds([]);
    onClose();
  };

  const toggleTag = (personIdToTag: string) => {
    if (taggedPersonIds.includes(personIdToTag)) {
      setTaggedPersonIds(taggedPersonIds.filter((id) => id !== personIdToTag));
    } else {
      setTaggedPersonIds([...taggedPersonIds, personIdToTag]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            {isEditMode ? 'Edit Update' : 'New Update'}
          </ThemedText>
          <Pressable
            onPress={handleAdd}
            disabled={!photoUri || !title.trim()}
            style={[styles.headerButton, (!photoUri || !title.trim()) && styles.headerButtonDisabled]}
          >
            <ThemedText
              style={[
                styles.doneText,
                (!photoUri || !title.trim()) && styles.doneTextDisabled,
              ]}
            >
              {isEditMode ? 'Save' : 'Add'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title - At the top */}
          <View style={styles.field}>
            <ThemedText style={styles.label}>Title *</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.icon,
                  backgroundColor: colors.background,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title for this update"
              placeholderTextColor={colors.icon}
            />
          </View>

          {/* Photo Preview or Select Button */}
          {photoUri ? (
            <View style={styles.photoSection}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                contentFit="cover"
              />
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [
                  styles.changePhotoButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <ThemedText style={styles.changePhotoText}>Change Photo</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickImage}
              style={({ pressed }) => [
                styles.selectPhotoButton,
                { borderColor: colors.icon },
                pressed && styles.buttonPressed,
              ]}
            >
              <MaterialIcons name="add-photo-alternate" size={36} color={colors.icon} />
              <ThemedText style={styles.selectPhotoText}>Select Photo</ThemedText>
            </Pressable>
          )}

          {/* Caption */}
          <View style={styles.field}>
            <ThemedText style={styles.label}>Share your story</ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: colors.text,
                  borderColor: colors.icon,
                  backgroundColor: colors.background,
                },
              ]}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor={colors.icon}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Tag People */}
          {availablePeople.length > 0 && (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Tag People</ThemedText>
              <ThemedText style={styles.hint}>
                Select people who are also in this photo
              </ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.tagScrollView}
                contentContainerStyle={styles.tagContainer}
              >
                {availablePeople.map((person) => {
                  const isTagged = taggedPersonIds.includes(person.id);
                  return (
                    <Pressable
                      key={person.id}
                      onPress={() => toggleTag(person.id)}
                      style={[
                        styles.tagChip,
                        { 
                          backgroundColor: isTagged ? colors.tint : colors.background,
                          borderColor: isTagged ? colors.tint : colors.icon,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tagChipText,
                          { color: isTagged ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {person.name}
                      </ThemedText>
                      {isTagged && (
                        <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.tagCheck} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Privacy Toggle */}
          <View style={styles.field}>
            <Pressable
              onPress={() => setIsPublic(!isPublic)}
              style={styles.privacyRow}
            >
              <ThemedText style={styles.label}>
                {isPublic ? 'Public' : 'Private'}
              </ThemedText>
              <MaterialIcons
                name={isPublic ? 'public' : 'lock'}
                size={24}
                color={colors.icon}
              />
            </Pressable>
            <ThemedText style={styles.hint}>
              {isPublic
                ? 'Everyone can see this update'
                : 'Only you can see this update (will appear greyed out)'}
            </ThemedText>
          </View>
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  changePhotoButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  selectPhotoButton: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  selectPhotoText: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.7,
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
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  tagScrollView: {
    marginTop: 8,
  },
  tagContainer: {
    gap: 8,
    paddingRight: 16,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 14,
  },
  tagCheck: {
    marginLeft: 4,
  },
});

