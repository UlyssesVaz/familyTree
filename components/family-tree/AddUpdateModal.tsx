import { useState, useEffect, useRef } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import { parseMentions, getMentionString } from '@/utils/mentions';
import type { Update, Person } from '@/types/family-tree';

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
  /** Optional: Initial tagged person IDs - will auto-populate caption with mentions */
  initialTaggedPersonIds?: string[];
}

/**
 * Add Update Modal
 * 
 * Modal for adding photos/updates to profile.
 * Can also be used for editing existing updates.
 */
export function AddUpdateModal({ visible, onClose, onAdd, updateToEdit, onEdit, personId, initialTaggedPersonIds }: AddUpdateModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const isEditMode = !!updateToEdit;
  const people = useFamilyTreeStore((state) => state.people);
  const peopleArray = Array.from(people.values()).filter(
    (person) => person.id !== personId // Exclude owner from mentions
  );

  const [title, setTitle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const captionInputRef = useRef<TextInput>(null);

  // Populate form when editing or when initialTaggedPersonIds is provided
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:59',message:'useEffect triggered - form reset check',data:{visible,isEditMode:!!updateToEdit,hasInitialTags:!!initialTaggedPersonIds,peopleSize:people.size,currentTitle:title,currentPhotoUri:!!photoUri,currentCaption:caption.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (updateToEdit) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:62',message:'Edit mode - populating form',data:{updateId:updateToEdit.id},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setTitle(updateToEdit.title);
      setPhotoUri(updateToEdit.photoUrl);
      setCaption(updateToEdit.caption || '');
      setIsPublic(updateToEdit.isPublic);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:68',message:'Add mode - resetting form',data:{visible,hasInitialTags:!!initialTaggedPersonIds,willClearTitle:true,willClearPhoto:true,willClearCaption:true},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // CRITICAL FIX: Only reset form when modal becomes visible (not on every people change)
      // This prevents clearing user input when people Map reference changes
      if (visible) {
        // Only reset if form is actually empty (user hasn't started typing)
        // This prevents clearing user input mid-typing
        const formIsEmpty = !title && !photoUri && !caption;
        
        if (formIsEmpty) {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:75',message:'Form is empty - resetting',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          setTitle('');
          setPhotoUri(null);
          setIsPublic(true);
          
          // Auto-populate caption with mentions if initialTaggedPersonIds is provided
          if (initialTaggedPersonIds && initialTaggedPersonIds.length > 0) {
            const allPeople = Array.from(people.values());
            const mentions = initialTaggedPersonIds
              .map(id => {
                const person = allPeople.find(p => p.id === id);
                if (person) {
                  return `@${getMentionString(person, allPeople, personId)}`;
                }
                return null;
              })
              .filter(Boolean)
              .join(' ');
            setCaption(mentions ? `${mentions} ` : '');
          } else {
            setCaption('');
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:95',message:'Form has data - NOT resetting to preserve user input',data:{hasTitle:!!title,hasPhoto:!!photoUri,hasCaption:!!caption},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        }
      } else {
        // Modal is closing - reset form for next time
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:100',message:'Modal closing - resetting form',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setTitle('');
        setPhotoUri(null);
        setCaption('');
        setIsPublic(true);
      }
    }
    // Remove 'people' from dependencies - we only need it for initialTaggedPersonIds logic
    // Access people inside the effect when needed, but don't re-run on every people change
  }, [updateToEdit, visible, initialTaggedPersonIds, personId]);

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

    // Extract tagged person IDs from caption @mentions (returns UUIDs)
    const parsedTaggedIds = parseMentions(
      caption.trim(),
      peopleArray,
      personId
    );
    
    // Merge initialTaggedPersonIds with parsed mentions (ensure auto-tagged people are included)
    const taggedPersonIds = initialTaggedPersonIds && initialTaggedPersonIds.length > 0
      ? Array.from(new Set([...initialTaggedPersonIds, ...parsedTaggedIds])) // Remove duplicates
      : parsedTaggedIds;

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
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    setPhotoUri(null);
    setCaption('');
    setIsPublic(true);
    setShowMentionSuggestions(false);
    setMentionQuery('');
    onClose();
  };

  // Handle caption text change and detect @mentions
  const handleCaptionChange = (text: string) => {
    setCaption(text);
    
    // Find the last @ symbol and text after it
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Get text after @
      const afterAt = text.substring(lastAtIndex + 1);
      // Check if there's a space or end of string (means we're still typing the mention)
      const spaceIndex = afterAt.indexOf(' ');
      const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
      
      if (query.length >= 0) {
        setMentionQuery(query);
        setMentionPosition({ start: lastAtIndex, end: lastAtIndex + 1 + query.length });
        setShowMentionSuggestions(true);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  // Filter people based on mention query
  const filteredPeople = peopleArray.filter((person) => {
    if (!mentionQuery) return true;
    const queryLower = mentionQuery.toLowerCase();
    const nameLower = person.name.toLowerCase();
    const firstName = person.name.split(' ')[0].toLowerCase();
    const lastName = person.name.split(' ').pop()?.toLowerCase() || '';
    
    return (
      nameLower.includes(queryLower) ||
      firstName.startsWith(queryLower) ||
      lastName.startsWith(queryLower)
    );
  }).slice(0, 5); // Limit to 5 suggestions

  // Insert mention into caption (using UUID-based mention string with context)
  const insertMention = (person: Person) => {
    const mentionText = getMentionString(person, peopleArray, personId);
    const beforeMention = caption.substring(0, mentionPosition.start);
    const afterMention = caption.substring(mentionPosition.end);
    const newCaption = `${beforeMention}@${mentionText} ${afterMention}`;
    setCaption(newCaption);
    setShowMentionSuggestions(false);
    setMentionQuery('');
    // Keep focus on input
    captionInputRef.current?.focus();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
          nestedScrollEnabled={true}
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
              onChangeText={(text) => {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AddUpdateModal.tsx:277',message:'Title onChangeText',data:{newText:text.substring(0,20),oldText:title.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                setTitle(text);
              }}
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

          {/* Caption with @mention hint */}
          <View style={styles.field}>
            <ThemedText style={styles.label}>Share your story</ThemedText>
            <ThemedText style={styles.hint}>
              Use @name to tag people in this photo (e.g., "Having fun with @John and @Mary")
            </ThemedText>
            <View style={styles.captionContainer}>
              <TextInput
                ref={captionInputRef}
                style={[
                  styles.textArea,
                  {
                    color: colors.text,
                    borderColor: colors.icon,
                    backgroundColor: colors.background,
                  },
                ]}
                value={caption}
                onChangeText={handleCaptionChange}
                placeholder="Add a caption... Use @name to tag people"
                placeholderTextColor={colors.icon}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              {/* Mention Suggestions Dropdown */}
              {showMentionSuggestions && filteredPeople.length > 0 && (
                <View style={[styles.mentionDropdown, { backgroundColor: colors.background, borderColor: colors.icon }]}>
                  {filteredPeople.map((item) => {
                    const mentionText = getMentionString(item, peopleArray, personId);
                    const displayName = item.name.split(' ')[0] === mentionText.split(' ')[0] 
                      ? item.name 
                      : `${item.name.split(' ')[0]} (${mentionText})`; // Show context if different
                    
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => insertMention(item)}
                        style={({ pressed }) => [
                          styles.mentionItem,
                          pressed && { backgroundColor: colors.icon + '20' },
                        ]}
                      >
                        {item.photoUrl ? (
                          <Image
                            source={{ uri: item.photoUrl }}
                            style={styles.mentionAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[styles.mentionAvatarPlaceholder, { backgroundColor: colors.icon }]}>
                            <MaterialIcons name="person" size={20} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={styles.mentionNameContainer}>
                          <ThemedText style={styles.mentionName}>{item.name}</ThemedText>
                          {mentionText !== item.name.split(' ')[0] && (
                            <ThemedText style={styles.mentionContext}>
                              Will mention as: @{mentionText}
                            </ThemedText>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
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
  captionContainer: {
    position: 'relative',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  mentionDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mentionList: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  mentionAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mentionNameContainer: {
    flex: 1,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  mentionContext: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
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
});

