import { useState, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Modal, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AddUpdateModal, EditProfileModal } from '@/components/family-tree';
import { useColorSchemeContext } from '@/contexts/color-scheme-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import type { Gender, Update, Person } from '@/types/family-tree';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<Update | null>(null);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { colorScheme, setColorScheme } = useColorSchemeContext();
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  
  const ego = useFamilyTreeStore((state) => state.getEgo());
  const egoId = useFamilyTreeStore((state) => state.egoId);
  
  // Profile tab always shows ego's profile (no personId param)
  const person = ego;
  const isEgo = true; // Always true for profile tab
  const countAncestors = useFamilyTreeStore((state) => state.countAncestors);
  const countDescendants = useFamilyTreeStore((state) => state.countDescendants);
  const updateEgo = useFamilyTreeStore((state) => state.updateEgo);
  const addUpdate = useFamilyTreeStore((state) => state.addUpdate);
  const toggleUpdatePrivacy = useFamilyTreeStore((state) => state.toggleUpdatePrivacy);
  const deleteUpdate = useFamilyTreeStore((state) => state.deleteUpdate);
  const updateUpdate = useFamilyTreeStore((state) => state.updateUpdate);
  const getPerson = useFamilyTreeStore((state) => state.getPerson);
  
  // Subscribe to updates Map directly so component re-renders when it changes
  const updatesMap = useFamilyTreeStore((state) => state.updates);
  
  // Calculate derived values that depend on updates
  const getUpdateCount = useFamilyTreeStore((state) => state.getUpdateCount);
  const getUpdatesForPerson = useFamilyTreeStore((state) => state.getUpdatesForPerson);

  // Use ref to avoid stale closure in useEffect
  const deleteUpdateRef = useRef(deleteUpdate);
  useEffect(() => {
    deleteUpdateRef.current = deleteUpdate;
  }, [deleteUpdate]);

  const toggleColorScheme = () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(newScheme);
  };

  // Show delete alert after menu modal closes
  // Using ref and delay to avoid iOS Alert timing issues
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:57',message:'useEffect triggered',data:{pendingDeleteId,menuUpdateId,condition:!!(pendingDeleteId && !menuUpdateId)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (pendingDeleteId && !menuUpdateId) {
      // Menu has closed, wait for animation to complete then show alert
      const updateIdToDelete = pendingDeleteId;
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:60',message:'Condition met, preparing alert',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Clear pending state immediately to prevent re-triggering
      setPendingDeleteId(null);
      
      // Use requestAnimationFrame + setTimeout to ensure modal is fully unmounted
      // This is necessary on iOS where Alert can fail if called too soon after Modal dismissal
      requestAnimationFrame(() => {
        setTimeout(() => {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:74',message:'Preparing confirmation dialog',data:{updateIdToDelete,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // On web, Alert.alert callbacks may not fire reliably - use window.confirm as fallback
          if (Platform.OS === 'web') {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:77',message:'Using window.confirm for web',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            const confirmed = window.confirm('Are you sure you want to delete this update?');
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:80',message:'window.confirm result',data:{updateIdToDelete,confirmed},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            if (confirmed) {
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:83',message:'Web confirm Delete confirmed',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              deleteUpdateRef.current(updateIdToDelete);
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:87',message:'Web confirm Cancel',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
            }
          } else {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:91',message:'Using Alert.alert for native',data:{updateIdToDelete,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            Alert.alert(
              'Delete Update',
              'Are you sure you want to delete this update?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:99',message:'Alert Cancel pressed',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                  },
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:107',message:'Alert Delete confirmed',data:{updateIdToDelete},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                    console.log('Delete confirmed for update:', updateIdToDelete);
                    deleteUpdateRef.current(updateIdToDelete);
                    console.log('Delete function called');
                  },
                },
              ]
            );
          }
        }, Platform.OS === 'ios' ? 300 : 100); // Longer delay on iOS
      });
    }
  }, [pendingDeleteId, menuUpdateId]);

  // If no person found, show loading or error
  if (!person) {
    return (
      <View style={[styles.wrapper, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ThemedView style={styles.container}>
          <ThemedText>Person not found</ThemedText>
        </ThemedView>
      </View>
    );
  }

  const ancestorsCount = person ? countAncestors(person.id) : 0;
  const descendantsCount = person ? countDescendants(person.id) : 0;
  const updatesCount = person ? getUpdateCount(person.id) : 0;
  const updates = person ? getUpdatesForPerson(person.id) : [];
  // #region agent log
  useEffect(() => {
    try {
      if (typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:148',message:'Component render with updates',data:{updatesCount,updatesLength:updates.length,updatesMapSize:updatesMap?.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
    } catch (e) {
      // Silently fail logging
    }
  }, [updatesCount, updates.length, updatesMap]);
  // #endregion

  // Gender-based colors for photo placeholder
  const getGenderColor = (gender?: Gender): string => {
    switch (gender) {
      case 'male':
        return '#4A90E2'; // Blue
      case 'female':
        return '#F5A623'; // Orange
      default:
        return colors.icon; // Default gray
    }
  };

  const genderColor = getGenderColor(person.gender);
  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ThemedView style={[styles.container, { paddingTop: contentPaddingTop }]}>
        {/* Username at top */}
        <ThemedText type="defaultSemiBold" style={styles.username}>
          {person.name.toLowerCase().replace(/\s+/g, '')}
        </ThemedText>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            {person.photoUrl ? (
              <Image
                source={{ uri: person.photoUrl }}
                style={[styles.profilePhoto, { borderColor: genderColor }]}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: genderColor }]}>
                <MaterialIcons name="person" size={60} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Stats Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                {updatesCount}
              </ThemedText>
              <ThemedText style={styles.statLabel}>updates</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                {ancestorsCount}
              </ThemedText>
              <ThemedText style={styles.statLabel}>ancestors</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                {descendantsCount}
              </ThemedText>
              <ThemedText style={styles.statLabel}>descendants</ThemedText>
            </View>
          </View>
        </View>

        {/* Edit Button Row - Only show for ego */}
        {isEgo && (
          <View style={styles.editButtonRow}>
            <Pressable
              onPress={() => setIsEditing(true)}
              style={({ pressed }) => [
                styles.editButton,
                { borderColor: colors.icon },
                pressed && styles.editButtonPressed,
              ]}
            >
              <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Name and Bio */}
        <View style={styles.infoSection}>
          <ThemedText type="defaultSemiBold" style={styles.displayName}>
            {person.name}
          </ThemedText>
          {person.bio && (
            <ThemedText style={styles.bio}>{person.bio}</ThemedText>
          )}
        </View>

        {/* Updates Section */}
        <View style={styles.updatesSection}>
          <View style={styles.updatesHeader}>
            <ThemedText type="defaultSemiBold" style={styles.updatesTitle}>
              Updates
            </ThemedText>
            <Pressable
              onPress={() => setIsAddingUpdate(true)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <MaterialIcons name="add" size={24} color={colors.tint} />
            </Pressable>
          </View>

          {updates.length === 0 ? (
            <ThemedView style={styles.emptyTimeline}>
              <ThemedText style={styles.placeholderText}>
                No updates yet. Tap + to add your first photo!
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.updatesList}>
              {updates.map((update) => {
                const date = new Date(update.createdAt);
                const formattedDate = date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const isExpanded = expandedUpdateId === update.id;
                const showMenu = menuUpdateId === update.id;

                return (
                  <View key={update.id} style={styles.updateCardWrapper}>
                    {/* Update card */}
                    <View
                      style={[
                        styles.updateCard,
                        { borderColor: colors.icon },
                        !update.isPublic && styles.updateCardPrivate,
                      ]}
                    >
                      {/* Card Header */}
                      <View style={styles.updateCardHeader}>
                        <View style={styles.updateCardTitleSection}>
                          <ThemedText type="defaultSemiBold" style={styles.updateTitle}>
                            {update.title}
                          </ThemedText>
                          <ThemedText style={[styles.updateDate, { color: colors.icon, opacity: 0.7 }]}>
                            {formattedDate}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => setMenuUpdateId(update.id)}
                          style={styles.menuButton}
                        >
                          <MaterialIcons name="more-vert" size={20} color={colors.icon} />
                        </Pressable>
                      </View>

                      {/* Photo - in DOM, not affected by theme */}
                      <View style={styles.photoContainerDOM}>
                        <Image
                          source={{ uri: update.photoUrl }}
                          style={styles.updateCardPhoto}
                          contentFit="cover"
                        />
                        {!update.isPublic && (
                          <View style={styles.privateOverlay}>
                            <MaterialIcons name="lock" size={16} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      {/* Tagged People */}
                      {update.taggedPersonIds && update.taggedPersonIds.length > 0 && (
                        <View style={styles.taggedSection}>
                          <MaterialIcons name="people" size={16} color={colors.icon} />
                          <ThemedText style={styles.taggedText}>
                            {(() => {
                              const taggedPeople = update.taggedPersonIds
                                .map(id => getPerson(id))
                                .filter(Boolean) as Person[];
                              if (taggedPeople.length === 1) {
                                return `With ${taggedPeople[0].name}`;
                              }
                              return `With ${taggedPeople.slice(0, 2).map(p => p.name).join(', ')}${taggedPeople.length > 2 ? ` +${taggedPeople.length - 2} more` : ''}`;
                            })()}
                          </ThemedText>
                        </View>
                      )}

                      {/* Caption */}
                      {update.caption && (
                        <View style={styles.updateCardContent}>
                          <ThemedText
                            style={styles.updateCaption}
                            numberOfLines={isExpanded ? undefined : 1}
                          >
                            {update.caption}
                          </ThemedText>
                          {update.caption.length > 50 && (
                            <Pressable
                              onPress={() =>
                                setExpandedUpdateId(isExpanded ? null : update.id)
                              }
                              style={styles.expandButton}
                            >
                              <ThemedText style={styles.expandButtonText}>
                                {isExpanded ? 'Show less' : 'Show more'}
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Menu Modal */}
                    {showMenu && (
                      <Modal
                        visible={showMenu}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setMenuUpdateId(null)}
                      >
                        <Pressable
                          style={styles.menuOverlay}
                          onPress={() => setMenuUpdateId(null)}
                        >
                          <Pressable
                            style={[styles.menu, { backgroundColor: colors.background, borderColor: colors.icon }]}
                            onPress={(e) => {
                              // Prevent event from bubbling to overlay
                              e.stopPropagation();
                            }}
                          >
                            <Pressable
                              onPress={(e) => {
                                // #region agent log
                                fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:333',message:'Privacy toggle pressed',data:{updateId:update.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
                                // #endregion
                                e.stopPropagation();
                                toggleUpdatePrivacy(update.id);
                                setMenuUpdateId(null);
                              }}
                              style={styles.menuItem}
                            >
                              <MaterialIcons
                                name={update.isPublic ? 'lock' : 'lock-open'}
                                size={20}
                                color={colors.text}
                              />
                              <ThemedText style={styles.menuItemText}>
                                Make {update.isPublic ? 'Private' : 'Public'}
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              onPress={(e) => {
                                // #region agent log
                                fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:349',message:'Edit button pressed',data:{updateId:update.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
                                // #endregion
                                e.stopPropagation();
                                setUpdateToEdit(update);
                                setMenuUpdateId(null);
                                setIsAddingUpdate(true);
                              }}
                              style={styles.menuItem}
                            >
                              <MaterialIcons name="edit" size={20} color={colors.text} />
                              <ThemedText style={styles.menuItemText}>Edit</ThemedText>
                            </Pressable>
                            <Pressable
                              onPress={(e) => {
                                // #region agent log
                                fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:360',message:'Delete button pressed',data:{updateId:update.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
                                // #endregion
                                e.stopPropagation();
                                // Set pending delete and close menu
                                // useEffect will handle showing alert after modal closes
                                setPendingDeleteId(update.id);
                                setMenuUpdateId(null);
                                // #region agent log
                                fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.tsx:366',message:'State set for delete',data:{pendingDeleteId:update.id,menuUpdateId:'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
                                // #endregion
                              }}
                              style={styles.menuItem}
                            >
                              <MaterialIcons name="delete" size={20} color="#FF3B30" />
                              <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>
                                Delete
                              </ThemedText>
                            </Pressable>
                          </Pressable>
                        </Pressable>
                      </Modal>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Temporary: Dark mode toggle (will be moved to settings later) */}
        <ThemedView style={styles.buttonContainer}>
          <Pressable
            onPress={toggleColorScheme}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText style={styles.buttonText}>
              Toggle {colorScheme === 'dark' ? 'Light' : 'Dark'} Mode
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
      </ScrollView>

      {/* Edit Profile Modal - Only show for ego */}
      {isEgo && person && (
        <>
          <EditProfileModal
            person={person}
            visible={isEditing}
            onClose={() => setIsEditing(false)}
            onSave={updateEgo}
          />
          <AddUpdateModal
            visible={isAddingUpdate}
            onClose={() => {
              setIsAddingUpdate(false);
              setUpdateToEdit(null);
            }}
            updateToEdit={updateToEdit || undefined}
            personId={egoId || undefined}
            onAdd={(title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
              if (egoId) {
                addUpdate(egoId, title, photoUrl, caption, isPublic, taggedPersonIds);
              }
            }}
            onEdit={(updateId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
              updateUpdate(updateId, title, photoUrl, caption, isPublic, taggedPersonIds);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    // Background color extends into notch area
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  username: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  photoContainer: {
    marginRight: 20,
  },
  profilePhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  editButtonRow: {
    marginBottom: 16,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 24,
  },
  displayName: {
    fontSize: 16,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  updatesSection: {
    marginBottom: 20,
  },
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updatesTitle: {
    fontSize: 18,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  emptyTimeline: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  updatesList: {
    gap: 16,
  },
  updateCardWrapper: {
    position: 'relative',
  },
  updateCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  updateCardPrivate: {
    opacity: 0.6,
  },
  updateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    paddingBottom: 8,
  },
  updateCardTitleSection: {
    flex: 1,
    marginRight: 8,
  },
  updateTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  updateDate: {
    fontSize: 14,
  },
  menuButton: {
    padding: 4,
  },
  photoContainerDOM: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#000', // Ensures photo container is not affected by theme
  },
  updateCardPhoto: {
    width: '100%',
    height: '100%',
  },
  privateOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 6,
  },
  updateCardContent: {
    padding: 12,
    paddingTop: 8,
  },
  updateCaption: {
    fontSize: 14,
    lineHeight: 20,
  },
  expandButton: {
    marginTop: 4,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  button: {
    padding: 15,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  taggedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  taggedText: {
    fontSize: 13,
    opacity: 0.8,
  },
});