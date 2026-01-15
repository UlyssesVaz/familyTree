import { useState, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Modal, Alert, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useProfileUpdates } from '@/hooks/use-profile-updates';
import { usePeopleStore } from '@/stores/people-store';
import { useRelationshipsStore } from '@/stores/relationships-store';
import { useUpdatesStore } from '@/stores/updates-store';
import { useSessionStore } from '@/stores/session-store';
import { formatMentions } from '@/utils/format-mentions';
import { getGenderColor } from '@/utils/gender-utils';
import { getUpdateMenuPermissions } from '@/utils/update-menu-permissions';
import { AddUpdateModal, ReportAbuseModal, type ReportReason } from '@/components/family-tree';
import { useAuth } from '@/contexts/auth-context';
import { createInvitationLink } from '@/services/supabase/invitations-api';
import type { Person, Update } from '@/types/family-tree';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';

export default function PersonProfileModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ personId?: string; addStory?: string }>();
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  
  const personId = params.personId;
  const { session } = useAuth();
  const { client: statsigClient } = useStatsigClient();
  
  const egoId = useSessionStore((state) => state.egoId);
  const getPerson = usePeopleStore((state) => state.getPerson);
  const countAncestors = useRelationshipsStore((state) => state.countAncestors);
  const countDescendants = useRelationshipsStore((state) => state.countDescendants);
  const toggleTaggedUpdateVisibility = useUpdatesStore((state) => state.toggleTaggedUpdateVisibility);
  const addUpdate = useUpdatesStore((state) => state.addUpdate);
  const people = usePeopleStore((state) => state.people);
  const peopleArray = Array.from(people.values());
  
  // Use custom hook to get updates for this person (must be called after personId is defined)
  const { updates: personUpdates, updateCount } = useProfileUpdates(personId);
  const person: Person | null = personId ? getPerson(personId) || null : null;
  const isEgo = personId === egoId;

  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUpdateId, setReportUpdateId] = useState<string | null>(null);

  // Use ref to avoid stale closure in useEffect
  const deleteUpdateRef = useRef(useUpdatesStore.getState().deleteUpdate);
  useEffect(() => {
    deleteUpdateRef.current = useUpdatesStore.getState().deleteUpdate;
  }, []);

  // Check if we should open Add Update modal from navigation params (for Add Story feature)
  useEffect(() => {
    if (params.addStory === 'true' && personId && egoId) {
      setIsAddingUpdate(true);
    }
  }, [params.addStory, personId, egoId]);

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

  // If no person found, show error
  if (!person) {
    return (
      <View style={[styles.wrapper, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ThemedView style={styles.container}>
          <ThemedText>Person not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={{ color: colors.tint }}>Go Back</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    );
  }

  const ancestorsCount = countAncestors(person.id);
  const descendantsCount = countDescendants(person.id);

  const genderColor = getGenderColor(person.gender, colors.icon);
  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      {/* Header with back button */}
      <View style={[styles.header, { borderBottomColor: colors.icon }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          {person.name}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

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
                  {updateCount}
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

          {/* Name and Bio */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <ThemedText type="defaultSemiBold" style={styles.displayName}>
                {person.name}
              </ThemedText>
              {/* Invite button - only show for ancestor profiles (no linkedAuthUserId) */}
              {!person.linkedAuthUserId && session?.user?.id && (
                <Pressable
                  onPress={async () => {
                    if (!session?.user?.id || !personId) return;
                    try {
                      // Create invitation link
                      const invitation = await createInvitationLink({
                        targetPersonId: personId,
                        userId: session.user.id,
                      });

                      // Generate invitation URL
                      const inviteUrl = `familytreeapp://join/${invitation.token}`;
                      const inviteMessage = `Hi ${person.name}! I've added you to our family tree. Join us to see and contribute to our shared family history!\n\n${inviteUrl}`;

                      // Share invitation
                      await Share.share({
                        message: inviteMessage,
                        title: `Invite ${person.name} to Family Tree`,
                        // Don't include url parameter - it causes duplication on iOS
                        // The URL is already in the message text
                      });
                      
                      // Track event: invite_sent
                      // Note: React Native Share API doesn't expose method (SMS/Email)
                      // We can't determine which method was used
                      logStatsigEvent(statsigClient, 'invite_sent');
                    } catch (error: any) {
                      console.error('[PersonProfile] Error creating invitation:', error);
                      Alert.alert(
                        'Error',
                        error?.message || 'Failed to create invitation link. Please try again.',
                        [{ text: 'OK' }]
                      );
                    }
                  }}
                  style={({ pressed }) => [
                    styles.inviteButton,
                    { backgroundColor: colors.tint },
                    pressed && styles.inviteButtonPressed,
                  ]}
                >
                  <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.inviteButtonText}>Invite</ThemedText>
                </Pressable>
              )}
            </View>
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
              {/* + Button to add story/memory about this person */}
              {egoId && (
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

            {personUpdates.length === 0 ? (
              <View style={styles.emptyUpdates}>
                <ThemedText style={[styles.emptyUpdatesText, { color: colors.icon }]}>
                  No updates yet. Tap + to add your first photo!
                </ThemedText>
              </View>
            ) : (
              <View style={styles.updatesList}>
                {personUpdates.map((update) => {
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
                    person.id, // The person whose profile we're viewing
                    egoId,
                    person // The person object for tagged visibility check
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
                            <View style={styles.updateTitleRow}>
                              <ThemedText type="defaultSemiBold" style={styles.updateTitle}>
                                {update.title}
                              </ThemedText>
                              {menuPermissions.canToggleTaggedVisibility && (
                                <View style={[styles.taggedBadge, { backgroundColor: colors.tint + '20' }]}>
                                  <MaterialIcons name="person" size={12} color={colors.tint} />
                                  <ThemedText style={[styles.taggedBadgeText, { color: colors.tint }]}>
                                    Tagged
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                            <View style={styles.updateMetaRow}>
                              {menuPermissions.canToggleTaggedVisibility && (
                                <ThemedText style={[styles.updateAuthor, { color: colors.icon, opacity: 0.7 }]}>
                                  {(() => {
                                    const author = getPerson(update.personId);
                                    return author ? `by ${author.name}` : '';
                                  })()}
                                </ThemedText>
                              )}
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
                            <Pressable
                              style={[styles.menu, { backgroundColor: colors.background, borderColor: colors.icon }]}
                              onPress={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              {/* For tagged updates, show hide/show option */}
                              {menuPermissions.canToggleTaggedVisibility && (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    toggleTaggedUpdateVisibility(person.id, update.id);
                                    setMenuUpdateId(null);
                                  }}
                                  style={styles.menuItem}
                                >
                                  <MaterialIcons
                                    name={person.hiddenTaggedUpdateIds?.includes(update.id) ? 'visibility' : 'visibility-off'}
                                    size={20}
                                    color={colors.text}
                                  />
                                  <ThemedText style={styles.menuItemText}>
                                    {person.hiddenTaggedUpdateIds?.includes(update.id) ? 'Show on Profile' : 'Hide from Profile'}
                                  </ThemedText>
                                </Pressable>
                              )}

                              {/* For own updates, show privacy and edit options */}
                              {menuPermissions.canChangeVisibility && (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement visibility toggle API
                                    console.log('[PersonProfile] Toggle visibility:', update.id);
                                    Alert.alert('Coming Soon', 'Visibility toggle will be available soon.');
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
                              )}

                              {menuPermissions.canEdit && (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement edit functionality for person profile
                                    console.log('[PersonProfile] Edit update:', update.id);
                                    Alert.alert('Coming Soon', 'Edit functionality will be available soon.');
                                    setMenuUpdateId(null);
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
                                  onPress={(e) => {
                                    e.stopPropagation();
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
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setMenuUpdateId(null);
                                    setPendingDeleteId(update.id);
                                  }}
                                  style={styles.menuItem}
                                >
                                  <MaterialIcons name="delete" size={20} color="#FF3B30" />
                                  <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>
                                    Delete
                                  </ThemedText>
                                </Pressable>
                              )}
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
        </ThemedView>
      </ScrollView>

      {/* Add Update Modal (for Add Story feature - when ego adds a story about this person) */}
      {egoId && personId && (
        <AddUpdateModal
          visible={isAddingUpdate}
          personId={egoId}
          initialTaggedPersonIds={[personId]}
          onClose={() => {
            setIsAddingUpdate(false);
          }}
          onAdd={(title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
            if (!personId || !session?.user?.id) {
              console.error('[PersonProfile] Cannot add update: Missing personId or session');
              return;
            }
            
            // Ensure personId is included in taggedPersonIds if they're not already tagged
            // This is for the "Tagged" indicator on the update card
            const finalTaggedPersonIds = taggedPersonIds && taggedPersonIds.length > 0 
              ? taggedPersonIds.includes(personId) 
                ? taggedPersonIds 
                : [...taggedPersonIds, personId]
              : [personId];
            
            // CRITICAL: Post update on target person's wall (personId = user_id in updates table)
            // created_by will be session.user.id (the authenticated user posting)
            // This enables posting updates on anyone's wall, not just the ego user
            addUpdate(personId, title, photoUrl, caption, isPublic, finalTaggedPersonIds, session.user.id);
            
            // Track event: update_posted
            const isOnOtherWall = personId !== egoId;
            const hasTagging = finalTaggedPersonIds.length > 0;
            logStatsigEvent(statsigClient, 'update_posted', undefined, {
              isOnOtherWall,
              hasTagging,
              taggedCount: finalTaggedPersonIds.length,
            });
            
            // Close modal - update will appear on this person's profile automatically
            setIsAddingUpdate(false);
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
          onSubmit={(reason: ReportReason, description?: string) => {
            // TODO: Implement report API call
            console.log('[PersonProfile] Report submitted:', {
              updateId: reportUpdateId,
              reason,
              description,
            });
            Alert.alert('Report Submitted', 'Thank you for keeping the family tree safe. We will review this report.');
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
  },
  headerSpacer: {
    width: 40,
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
  username: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    marginBottom: 16,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  infoSection: {
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  displayName: {
    fontSize: 16,
    flex: 1,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  inviteButtonPressed: {
    opacity: 0.7,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  updatesSection: {
    marginTop: 24,
  },
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  emptyUpdates: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyUpdatesText: {
    fontSize: 14,
    textAlign: 'center',
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
  updateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  updateTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  updateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  taggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  taggedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  updateAuthor: {
    fontSize: 12,
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
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
  },
});
