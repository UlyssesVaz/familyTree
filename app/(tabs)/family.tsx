import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Modal, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HamburgerMenuButton } from '@/components/settings/SettingsHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { AddUpdateModal, ReportAbuseModal, type ReportReason } from '@/components/family-tree';
import { reportContent } from '@/services/supabase/reports-api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyFeed, type FeedFilter } from '@/hooks/use-family-feed';
import { useUpdateManagement } from '@/hooks/use-update-management';
import { usePeopleStore } from '@/stores/people-store';
import { useUpdatesStore } from '@/stores/updates-store';
import { useSessionStore } from '@/stores/session-store';
import { formatMentions } from '@/utils/format-mentions';
import { getUpdateMenuPermissions } from '@/utils/update-menu-permissions';
import { useAuth } from '@/contexts/auth-context';
import type { Update, Person } from '@/types/family-tree';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'group'>('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUpdateId, setReportUpdateId] = useState<string | null>(null);
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  const { session } = useAuth();
  const { client: statsigClient } = useStatsigClient();
  
  const ego = useSessionStore((state) => state.getEgo());
  const egoId = useSessionStore((state) => state.egoId);
  const people = usePeopleStore((state) => state.people);
  const peopleArray = Array.from(people.values());
  const addUpdate = useUpdatesStore((state) => state.addUpdate);
  const updateUpdate = useUpdatesStore((state) => state.updateUpdate);
  const toggleUpdatePrivacy = useUpdatesStore((state) => state.toggleUpdatePrivacy);

  // Use custom hook to get filtered family feed updates
  const { updates: allFamilyUpdates } = useFamilyFeed(filter as FeedFilter);

  // Use centralized update management hook (handles delete confirmation)
  const {
    isAddingUpdate,
    setIsAddingUpdate,
    updateToEdit,
    setUpdateToEdit,
    expandedUpdateId,
    setExpandedUpdateId,
    menuUpdateId,
    setMenuUpdateId,
    pendingDeleteId,
    setPendingDeleteId,
  } = useUpdateManagement();

  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  // Get family name (for now, use ego's last name or "Family")
  const familyName = ego?.name.split(' ').pop() || 'Family';

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      <HamburgerMenuButton />
      <ErrorBoundary
        fallback={(error) => (
          <ThemedView style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
            <ThemedText type="title" style={styles.errorTitle}>
              Failed to Load Family Feed
            </ThemedText>
            <ThemedText style={styles.errorText}>{error.message}</ThemedText>
            {__DEV__ && error.stack && (
              <ThemedText style={styles.errorStack}>{error.stack}</ThemedText>
            )}
            <Pressable 
              onPress={() => {
                // Retry sync
                if (session?.user?.id) {
                  useSessionStore.getState().syncFamilyTree(session.user.id).catch((syncError) => {
                    console.error('[FamilyScreen] Error retrying sync:', syncError);
                  });
                }
              }}
              style={[styles.retryButton, { backgroundColor: colors.tint }]}
            >
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}
        onReset={() => {
          // Reset error boundary state
          if (session?.user?.id) {
            useSessionStore.getState().syncFamilyTree(session.user.id).catch((syncError) => {
              console.error('[FamilyScreen] Error retrying sync after reset:', syncError);
            });
          }
        }}
      >
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
                  
                  // Use utility function to determine menu permissions
                  const menuPermissions = getUpdateMenuPermissions(
                    update,
                    session?.user?.id,
                    person?.id, // The person whose wall this update is on
                    egoId,
                    undefined // Not viewing a specific person's profile in family feed
                  );

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
                          {/* Menu button - always show (Report is always available) */}
                          {menuPermissions.showMenuButton && (
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
                              {/* For own updates, show privacy and edit options */}
                              {menuPermissions.canChangeVisibility && (
                                <Pressable
                                  onPress={async () => {
                                    try {
                                      await toggleUpdatePrivacy(update.id);
                                    } catch (error: any) {
                                      Alert.alert('Error', 'Failed to change update visibility. Please try again.');
                                    }
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
                              )}

                              {menuPermissions.canEdit && (
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
                              )}

                              {/* Report option - always available for all updates */}
                              {menuPermissions.canReport && (
                                <Pressable
                                  onPress={() => {
                                    setReportUpdateId(update.id);
                                    setMenuUpdateId(null);
                                    setShowReportModal(true);
                                  }}
                                  style={styles.menuItem}
                                >
                                  <MaterialIcons name="flag" size={20} color={colors.text} />
                                  <ThemedText style={styles.menuItemText}>Report</ThemedText>
                                </Pressable>
                              )}

                              {/* Delete option - only for own updates */}
                              {menuPermissions.canDelete && (
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
                              )}
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
      </ErrorBoundary>

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
          onAdd={async (title, photoUrl, caption, isPublic, taggedPersonIds) => {
            if (!ego?.id || !session?.user?.id) {
              console.error('[Family] Cannot add update: Missing egoId or session');
              return;
            }
            // Post update on ego's wall (ego.id = user_id in updates table)
            // created_by will be session.user.id (the authenticated user posting)
            await addUpdate(ego.id, title, photoUrl, caption, isPublic, taggedPersonIds, session.user.id);
            
            // Track event: update_posted
            logStatsigEvent(statsigClient, 'update_posted', undefined, {
              isOnOtherWall: false,
              hasTagging: (taggedPersonIds?.length ?? 0) > 0,
              taggedCount: taggedPersonIds?.length ?? 0,
            });
            
            setIsAddingUpdate(false);
            setUpdateToEdit(null);
          }}
          onEdit={async (updateId, title, photoUrl, caption, isPublic, taggedPersonIds) => {
            try {
              await updateUpdate(updateId, title, photoUrl, caption, isPublic, taggedPersonIds);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to update post. Please try again.');
              return;
            }
            
            // Track event: wall_entry_updated
            const update = useUpdatesStore.getState().updates.get(updateId);
            const egoId = useSessionStore.getState().egoId;
            const isOnOtherWall = update?.personId !== egoId;
            const hasTagging = (taggedPersonIds?.length ?? 0) > 0;
            
            logStatsigEvent(statsigClient, 'wall_entry_updated', undefined, {
              isOnOtherWall,
              hasTagging,
              taggedCount: taggedPersonIds?.length ?? 0,
            });
            
            setIsAddingUpdate(false);
            setUpdateToEdit(null);
          }}
        />
      )}

      {/* Report Abuse Modal */}
      {reportUpdateId && (
        <ReportAbuseModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportUpdateId(null);
          }}
          onSubmit={async (reason: ReportReason, description?: string) => {
            if (!session?.user?.id) {
              Alert.alert('Error', 'You must be signed in to submit a report.');
              return;
            }
            
            try {
              // Map 'other' reason to 'abuse' for API compatibility
              const apiReason = reason === 'other' ? 'abuse' : reason;
              
              await reportContent(session.user.id, {
                reportType: 'update',
                targetId: reportUpdateId!,
                reason: apiReason as any, // Type assertion needed due to 'other' -> 'abuse' mapping
                description,
              });
              
              // Immediately hide reported update from local store
              useUpdatesStore.getState().hideReportedUpdate(reportUpdateId!);
              
              Alert.alert('Report Submitted', 'Thank you for keeping the family tree safe. We will review this report. The content has been hidden from your feed.');
            } catch (error: any) {
              console.error('[Family] Error submitting report:', error);
              Alert.alert('Error', 'Failed to submit report. Please try again.');
            }
          }}
          reportType="update"
          targetId={reportUpdateId}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  errorStack: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 24,
    opacity: 0.5,
    textAlign: 'left',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

