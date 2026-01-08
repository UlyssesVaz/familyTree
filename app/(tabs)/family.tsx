import { useState, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Modal, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AddUpdateModal } from '@/components/family-tree';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyFeed, type FeedFilter } from '@/hooks/use-family-feed';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import { formatMentions } from '@/utils/format-mentions';
import type { Update, Person } from '@/types/family-tree';

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<Update | null>(null);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'group'>('all');
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  
  const ego = useFamilyTreeStore((state) => state.getEgo());
  const egoId = useFamilyTreeStore((state) => state.egoId);
  const people = useFamilyTreeStore((state) => state.people);
  const peopleArray = Array.from(people.values());
  const addUpdate = useFamilyTreeStore((state) => state.addUpdate);
  const deleteUpdate = useFamilyTreeStore((state) => state.deleteUpdate);
  const updateUpdate = useFamilyTreeStore((state) => state.updateUpdate);
  const toggleUpdatePrivacy = useFamilyTreeStore((state) => state.toggleUpdatePrivacy);

  // Use custom hook to get filtered family feed updates
  const { updates: allFamilyUpdates } = useFamilyFeed(filter as FeedFilter);

  // Use ref to avoid stale closure in useEffect
  const deleteUpdateRef = useRef(deleteUpdate);
  useEffect(() => {
    deleteUpdateRef.current = deleteUpdate;
  }, [deleteUpdate]);

  // Show delete alert after menu modal closes
  useEffect(() => {
    if (pendingDeleteId && !menuUpdateId) {
      const updateIdToDelete = pendingDeleteId;
      setPendingDeleteId(null);
      
      requestAnimationFrame(() => {
        setTimeout(() => {
          Alert.alert(
            'Delete Update',
            'Are you sure you want to delete this update?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  deleteUpdateRef.current(updateIdToDelete);
                },
              },
            ],
            { cancelable: true }
          );
        }, Platform.OS === 'ios' ? 300 : 100);
      });
    }
  }, [pendingDeleteId, menuUpdateId]);

  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  // Get family name (for now, use ego's last name or "Family")
  const familyName = ego?.name.split(' ').pop() || 'Family';

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ThemedView style={[styles.container, { paddingTop: contentPaddingTop }]}>
          {/* Family Header Section */}
          <View style={styles.familyHeader}>
            {/* Family Photo - Circular placeholder for now */}
            <View style={[styles.familyPhotoContainer, { borderColor: colors.icon }]}>
              <MaterialIcons name="people" size={60} color={colors.icon} />
            </View>
            
            {/* Family Name */}
            <ThemedText type="defaultSemiBold" style={styles.familyName}>
              {familyName} Family
            </ThemedText>
          </View>

          {/* Updates Section */}
          <View style={styles.updatesSection}>
            <View style={styles.updatesHeader}>
              <ThemedText type="defaultSemiBold" style={styles.updatesTitle}>
                Family Updates
              </ThemedText>
              {ego && (
                <Pressable
                  onPress={() => setIsAddingUpdate(true)}
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.addButtonPressed,
                  ]}
                >
                  <MaterialIcons name="add" size={24} color={colors.tint} />
                </Pressable>
              )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <Pressable
                onPress={() => setFilter('all')}
                style={[
                  styles.filterTab,
                  filter === 'all' && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterTabText,
                    filter === 'all' && { color: colors.tint, fontWeight: '600' },
                  ]}
                >
                  All
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setFilter('group')}
                style={[
                  styles.filterTab,
                  filter === 'group' && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterTabText,
                    filter === 'group' && { color: colors.tint, fontWeight: '600' },
                  ]}
                >
                  Group Photos
                </ThemedText>
              </Pressable>
            </View>

            {allFamilyUpdates.length === 0 ? (
              <ThemedView style={styles.emptyTimeline}>
                <ThemedText style={styles.placeholderText}>
                  No family updates yet. Tap + to add your first update!
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.updatesList}>
                {allFamilyUpdates.map(({ update, person, taggedPeople }) => {
                  const date = new Date(update.createdAt);
                  const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const isExpanded = expandedUpdateId === update.id;
                  const showMenu = menuUpdateId === update.id;
                  const isOwnUpdate = update.personId === egoId;

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
                            <View style={styles.updateMeta}>
                              <ThemedText style={[styles.updateAuthor, { color: colors.tint }]}>
                                {person?.name}
                              </ThemedText>
                              <ThemedText style={[styles.updateDate, { color: colors.icon, opacity: 0.7 }]}>
                                {formattedDate}
                              </ThemedText>
                            </View>
                          </View>
                          {/* Menu button - only show for own updates */}
                          {isOwnUpdate && (
                            <Pressable
                              onPress={() => setMenuUpdateId(update.id)}
                              style={styles.menuButton}
                            >
                              <MaterialIcons name="more-vert" size={20} color={colors.icon} />
                            </Pressable>
                          )}
                        </View>

                        {/* Photo */}
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
                        {taggedPeople.length > 0 && (
                          <View style={styles.taggedSection}>
                            <MaterialIcons name="people" size={16} color={colors.icon} />
                            <ThemedText style={styles.taggedText}>
                              {taggedPeople.length === 1
                                ? `With ${taggedPeople[0].name}`
                                : `With ${taggedPeople.slice(0, 2).map(p => p.name).join(', ')}${taggedPeople.length > 2 ? ` +${taggedPeople.length - 2} more` : ''}`}
                            </ThemedText>
                          </View>
                        )}

                        {/* Caption */}
                        {update.caption && (
                          <View style={styles.updateCardContent}>
                            <ThemedText
                              style={styles.updateCaption}
                              numberOfLines={isExpanded ? undefined : 3}
                            >
                              {formatMentions(update.caption, undefined, peopleArray)}
                            </ThemedText>
                            {update.caption.length > 100 && (
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
                            <View style={[styles.menu, { backgroundColor: colors.background }]}>
                              <Pressable
                                onPress={() => {
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
                                  {update.isPublic ? 'Make Private' : 'Make Public'}
                                </ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setMenuUpdateId(null);
                                  setUpdateToEdit(update);
                                }}
                                style={styles.menuItem}
                              >
                                <MaterialIcons name="edit" size={20} color={colors.text} />
                                <ThemedText style={styles.menuItemText}>Edit</ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setMenuUpdateId(null);
                                  setPendingDeleteId(update.id);
                                }}
                                style={[styles.menuItem, styles.menuItemDanger]}
                              >
                                <MaterialIcons name="delete" size={20} color="#FF3B30" />
                                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>
                                  Delete
                                </ThemedText>
                              </Pressable>
                            </View>
                          </Pressable>
                        </Modal>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ThemedView>
      </ScrollView>

      {/* Add/Edit Update Modal */}
      {ego && (
        <AddUpdateModal
          visible={isAddingUpdate || !!updateToEdit}
          updateToEdit={updateToEdit || undefined}
          onClose={() => {
            setIsAddingUpdate(false);
            setUpdateToEdit(null);
          }}
          personId={ego.id}
          onAdd={(title, photoUrl, caption, isPublic, taggedPersonIds) => {
            addUpdate(ego.id, title, photoUrl, caption, isPublic, taggedPersonIds);
            setIsAddingUpdate(false);
            setUpdateToEdit(null);
          }}
          onEdit={(updateId, title, photoUrl, caption, isPublic, taggedPersonIds) => {
            updateUpdate(updateId, title, photoUrl, caption, isPublic, taggedPersonIds);
            setIsAddingUpdate(false);
            setUpdateToEdit(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  familyHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  familyPhotoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  familyName: {
    fontSize: 24,
  },
  updatesSection: {
    marginTop: 8,
  },
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  updatesTitle: {
    fontSize: 20,
  },
  addButton: {
    padding: 8,
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  emptyTimeline: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
  updatesList: {
    gap: 16,
  },
  updateCardWrapper: {
    marginBottom: 16,
  },
  updateCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  updateCardPrivate: {
    opacity: 0.7,
  },
  updateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
  },
  updateCardTitleSection: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  updateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateDate: {
    fontSize: 12,
  },
  menuButton: {
    padding: 4,
  },
  photoContainerDOM: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
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
  },
  updateCaption: {
    fontSize: 14,
    lineHeight: 20,
  },
  expandButton: {
    marginTop: 8,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuItemText: {
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 14,
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

