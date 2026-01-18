import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { usePeople, usePerson, useUpdatePerson } from '@/hooks/use-people';
import { countAncestors, countDescendants } from '@/hooks/use-relationships';
import { useUpdates, useDeleteUpdate, useAddUpdate, useToggleUpdatePrivacy } from '@/hooks/use-updates';
import { useEgoId } from '@/hooks/use-session';
import { formatMentions } from '@/utils/format-mentions';
import { getGenderColor } from '@/utils/gender-utils';
import { getUpdateMenuPermissions } from '@/utils/update-menu-permissions';
import { AddUpdateModal, ReportAbuseModal, type ReportReason } from '@/components/family-tree';
import { reportContent } from '@/services/supabase/reports-api';
import { useAuth } from '@/contexts/auth-context';
import { createInvitationLink } from '@/services/supabase/invitations-api';
import type { Person, Update } from '@/types/family-tree';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';
import { blockUser, unblockUser, getBlock } from '@/services/supabase/blocks-api';
import { useBlockedUserIds, useUnblockUser } from '@/hooks/use-blocked-users';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Person Profile Screen
 * 
 * Displays a profile for ANY person in the family tree (accessed via /person/[personId]).
 * 
 * **Profile Types Handled:**
 * 1. **Shadow Profiles (Ancestors)**: `linkedAuthUserId === null`
 *    - Ancestors who don't have accounts yet
 *    - Shows "Invite" button to send invitation link
 *    - Can view their updates/stats but cannot block them
 * 
 * 2. **Claimed Profiles (Living users)**: `linkedAuthUserId !== null`
 *    - People with accounts in the app
 *    - Shows Block/Unblock button (if not ego)
 *    - Can interact with their content
 * 
 * **Differences from Ego Profile (`app/(tabs)/profile.tsx`):**
 * - Has back button header (not hamburger menu)
 * - Has Invite button for shadow profiles
 * - Has Block/Unblock button for claimed profiles
 * - No Edit Profile button (can't edit others' profiles)
 * - No Sign Out button (not ego's profile)
 * - No location management (only ego manages location)
 * 
 * **Note:** This screen is accessed when tapping on any person card in the family tree.
 * The Profile tab (`app/(tabs)/profile.tsx`) always shows the ego's own profile.
 */
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
  
  const egoId = useEgoId();
  const queryClient = useQueryClient();
  const { data: peopleArray = [] } = usePeople();
  const person: Person | null = personId ? usePerson(personId) || null : null;
  const unblockMutation = useUnblockUser();
  const addUpdateMutation = useAddUpdate();
  const toggleUpdatePrivacyMutation = useToggleUpdatePrivacy();
  const deleteUpdateMutation = useDeleteUpdate();
  const updatePersonMutation = useUpdatePerson();
  const blockedUserIds = useBlockedUserIds(); // Must be at top level, not in useEffect!
  
  // Create getPerson helper from peopleArray
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of peopleArray) {
      map.set(person.id, person);
    }
    return map;
  }, [peopleArray]);
  
  const getPerson = useCallback((id: string) => peopleMap.get(id), [peopleMap]);
  
  // Use custom hook to get updates for this person (must be called after personId is defined)
  const { updates: personUpdates, updateCount } = useProfileUpdates(personId);
  const isEgo = personId === egoId;

  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUpdateId, setReportUpdateId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isCheckingBlock, setIsCheckingBlock] = useState(true);

  // Use ref to avoid stale closure in useEffect
  const deleteUpdateRef = useRef((updateId: string) => {
    if (session?.user?.id) {
      deleteUpdateMutation.mutate({ updateId });
    }
  });
  useEffect(() => {
    deleteUpdateRef.current = (updateId: string) => {
      if (session?.user?.id) {
        deleteUpdateMutation.mutate({ updateId });
      }
    };
  }, [deleteUpdateMutation, session?.user?.id]);

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

  // If person is a placeholder (blocked/deleted/COPPA-deleted), redirect back
  // Placeholders should not be accessible - they're only visual shadows in the tree
  useEffect(() => {
    if (person?.isPlaceholder) {
      router.back();
    }
  }, [person?.isPlaceholder, router]);

  // Check if user is blocked (only for non-ego profiles with linked auth users)
  // CRITICAL: This hook must be BEFORE early returns to follow Rules of Hooks
  useEffect(() => {
    if (!session?.user?.id || isEgo || !person?.linkedAuthUserId) {
      setIsBlocked(false);
      setIsCheckingBlock(false);
      return;
    }

    // Use React Query for block status (blockedUserIds is already defined at top level)
    const isBlockedInStore = person.linkedAuthUserId ? blockedUserIds.has(person.linkedAuthUserId) : false;
    setIsBlocked(isBlockedInStore);
    setIsCheckingBlock(false);
    
    // Sync with backend in background (for consistency, but don't wait)
    const checkBlockStatus = async () => {
      try {
        const block = await getBlock(session.user.id, person.linkedAuthUserId);
        const isActuallyBlocked = !!block;
        setIsBlocked(isActuallyBlocked);
        
        // Sync React Query cache if backend says different
        if (person.linkedAuthUserId) {
          const userId = session?.user?.id;
          if (userId) {
            if (isActuallyBlocked && !isBlockedInStore) {
              // Invalidate to refetch blocked users
              queryClient.invalidateQueries({ queryKey: ['blockedUserIds', userId] });
              queryClient.invalidateQueries({ queryKey: ['blockedUsers', userId] });
            } else if (!isActuallyBlocked && isBlockedInStore) {
              // Invalidate to refetch blocked users
              queryClient.invalidateQueries({ queryKey: ['blockedUserIds', userId] });
              queryClient.invalidateQueries({ queryKey: ['blockedUsers', userId] });
            }
          }
        }
      } catch (error) {
        console.error('[PersonProfile] Error checking block status:', error);
      }
    };

    checkBlockStatus();
    
    // React Query automatically handles reactivity through queries
    // No need to subscribe manually - removed unused unsubscribe()
  }, [session?.user?.id, person?.linkedAuthUserId, isEgo, blockedUserIds, queryClient]);

  // If no person found, show error
  // CRITICAL: All hooks must be called BEFORE any early returns
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

  // If person is a placeholder, show minimal view while redirecting
  if (person.isPlaceholder) {
    return (
      <View style={[styles.wrapper, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ThemedView style={styles.container}>
          <ThemedText>This profile is not available</ThemedText>
        </ThemedView>
      </View>
    );
  }

  const handleBlockUser = async () => {
    if (!session?.user?.id || !person.linkedAuthUserId) {
      Alert.alert('Error', 'Unable to block user. Please try again.');
      return;
    }

    const personName = person.name || 'this user';
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${personName}? You won't be able to see their content, and they won't be able to see yours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const blockedUserId = person.linkedAuthUserId;
            const userId = session.user.id;
            const originalPersonName = person.name || 'User';
            
            // Optimistic update: Update person as placeholder and update blocked users cache
            queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
              old.map((p) => {
                if (p.linkedAuthUserId === blockedUserId) {
                  return {
                    ...p,
                    isPlaceholder: true,
                    placeholderReason: 'blocked',
                    name: '',
                  };
                }
                return p;
              })
            );
            
            queryClient.setQueryData<Set<string>>(['blockedUserIds', userId], (old = new Set()) => {
              const newSet = new Set(old);
              newSet.add(blockedUserId);
              return newSet;
            });
            
            setIsBlocked(true);
            
            try {
              // Sync with backend
              await blockUser(userId, blockedUserId);
              
              // Invalidate to refresh data
              queryClient.invalidateQueries({ queryKey: ['blockedUsers', userId] });
              queryClient.invalidateQueries({ queryKey: ['blockedUserIds', userId] });
              queryClient.invalidateQueries({ queryKey: ['updates', userId] });
              
              // Success
              Alert.alert('User Blocked', `${originalPersonName} has been blocked. Their content will no longer appear in your feed. You can manage blocked users in Settings.`);
              logStatsigEvent(statsigClient, 'user_blocked', {
                blocked_user_id: blockedUserId,
              });
              
              // Navigate back since user is now blocked
              router.back();
            } catch (error: any) {
              // REVERT: Restore optimistic updates on error
              queryClient.invalidateQueries({ queryKey: ['people', userId] });
              queryClient.invalidateQueries({ queryKey: ['blockedUserIds', userId] });
              setIsBlocked(false);
              
              console.error('[PersonProfile] Error blocking user:', error);
              Alert.alert('Error', error.message || 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!session?.user?.id || !person.linkedAuthUserId) {
      Alert.alert('Error', 'Unable to unblock user. Please try again.');
      return;
    }

    const personName = person.name || 'this user';
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${personName}? You will be able to see their content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            const blockedUserId = person.linkedAuthUserId;
            
            // Use React Query mutation for unblocking (handles optimistic updates automatically)
            unblockMutation.mutate(
              { blockedUserId },
              {
                onSuccess: () => {
                  setIsBlocked(false);
                  const personName = person.name || 'User';
                  Alert.alert('User Unblocked', `${personName} has been unblocked. Their content will now appear in your feed.`);
                  logStatsigEvent(statsigClient, 'user_unblocked', {
                    unblocked_user_id: blockedUserId,
                  });
                },
                onError: (error: any) => {
                  setIsBlocked(true);
                  console.error('[PersonProfile] Error unblocking user:', error);
                  Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
                },
              }
            );
          },
        },
      ]
    );
  };

  const ancestorsCount = countAncestors(person.id, peopleArray);
  const descendantsCount = countDescendants(person.id, peopleArray);

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
          {person.name || 'Profile'}
        </ThemedText>
        {/* Block/Unblock button (only for non-ego profiles with linked auth users) */}
        {!isEgo && person.linkedAuthUserId && !isCheckingBlock && (
          <Pressable
            onPress={isBlocked ? handleUnblockUser : handleBlockUser}
            style={styles.blockButton}
          >
            <MaterialIcons
              name={isBlocked ? 'block' : 'block'}
              size={24}
              color={isBlocked ? colors.tint : '#FF3B30'}
            />
          </Pressable>
        )}
        {(!person.linkedAuthUserId || isEgo || isCheckingBlock) && (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ThemedView style={[styles.container, { paddingTop: contentPaddingTop }]}>
          {/* Username at top */}
          <ThemedText type="defaultSemiBold" style={styles.username}>
            {(person.name || 'user').toLowerCase().replace(/\s+/g, '')}
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
                {person.name || 'Profile'}
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
                      const personName = person.name || 'there';
                      const inviteMessage = `Hi ${personName}! I've added you to our family tree. Join us to see and contribute to our shared family history!\n\n${inviteUrl}`;

                      // Share invitation
                      await Share.share({
                        message: inviteMessage,
                        title: `Invite ${personName} to Family Tree`,
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
                                    if (session?.user?.id) {
                                      const hiddenIds = person.hiddenTaggedUpdateIds || [];
                                      const isHidden = hiddenIds.includes(update.id);
                                      const newHiddenIds = isHidden
                                        ? hiddenIds.filter(id => id !== update.id)
                                        : [...hiddenIds, update.id];
                                      
                                      updatePersonMutation.mutate({
                                        userId: session.user.id,
                                        personId: person.id,
                                        updates: {
                                          hiddenTaggedUpdateIds: newHiddenIds,
                                        },
                                      });
                                    }
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
          onAdd={async (title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
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
            await addUpdateMutation.mutateAsync({
              userId: session.user.id,
              input: {
                personId,
                title,
                photoUrl,
                caption,
                isPublic,
                taggedPersonIds: finalTaggedPersonIds,
              },
            });
            
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
              
              // Invalidate updates cache to refresh (reported update will be filtered out by backend)
              if (session?.user?.id) {
                queryClient.invalidateQueries({ queryKey: ['updates', session.user.id] });
              }
              
              Alert.alert('Report Submitted', 'Thank you for keeping the family tree safe. We will review this report. The content has been hidden from your feed.');
            } catch (error: any) {
              console.error('[PersonProfile] Error submitting report:', error);
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
  blockButton: {
    padding: 8,
    marginRight: 8,
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
