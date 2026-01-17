/**
 * Blocked Users Screen
 * 
 * Displays list of blocked users and allows unblocking.
 * Similar to Instagram's blocked users management.
 */

import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { getBlockedUsersWithInfo, unblockUser } from '@/services/supabase/blocks-api';
import { getUserProfile } from '@/services/supabase/people-api';
import { usePeopleStore } from '@/stores/people-store';
import { useBlockedUsersStore } from '@/stores/blocked-users-store';
import { useSessionStore } from '@/stores/session-store';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';

interface BlockedUser {
  userId: string; // auth.users.id
  personId: string; // people.user_id
  name: string;
  photoUrl?: string;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { session } = useAuth();
  const { client: statsigClient } = useStatsigClient();
  
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  // Load blocked users on mount - use store which auto-loads on mount via useBlockedUsers hook
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    // Load from backend if not already loaded (for optimistic updates)
    const storeBlockedIds = useBlockedUsersStore.getState().blockedUserIds;
    if (storeBlockedIds.size === 0 && !useBlockedUsersStore.getState().isLoading) {
      useBlockedUsersStore.getState().loadBlockedUsers(session.user.id);
    }

    // Fetch blocked users with info directly from database
    // CRITICAL: Don't use PeopleStore because blocked users are placeholders with empty names
    const loadBlockedUsersList = async () => {
      setIsLoading(true);
      try {
        const blockedUsersList = await getBlockedUsersWithInfo(session.user.id);
        setBlockedUsers(blockedUsersList);
      } catch (error) {
        console.error('[BlockedUsers] Error loading blocked users:', error);
        setBlockedUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadBlockedUsersList();

    // Subscribe to store changes for reactive updates (when user blocks/unblocks)
    const unsubscribe = useBlockedUsersStore.subscribe((state) => {
      // Reload from database when store changes (optimistic update happened)
      if (!state.isLoading) {
        loadBlockedUsersList();
      }
    });

    return () => unsubscribe();
  }, [session?.user?.id]);

  const handleUnblock = (blockedUser: BlockedUser) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be signed in to unblock users.');
      return;
    }

    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${blockedUser.name}? You will be able to see their content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            const userId = blockedUser.userId;
            setUnblockingUserId(userId);
            
            // STEP 1: OPTIMISTIC UPDATE - Remove from blocked list immediately
            useBlockedUsersStore.getState().removeBlockedUser(userId);
            // List will update automatically via store subscription
            
            // STEP 2: OPTIMISTIC UPDATE - Restore person's data in PeopleStore
            // CRITICAL: Do the INVERSE of blocking - restore everything immediately
            const people = usePeopleStore.getState().people;
            let existingPerson: Person | null = null;
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:113',message:'unblock: searching for existing person',data:{userId,peopleCount:people.size,peopleIds:Array.from(people.keys()),peopleLinkedAuthUserIds:Array.from(people.values()).map(p=>p.linkedAuthUserId).filter(Boolean)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // Find the existing placeholder person to preserve relationships
            for (const [personId, person] of people.entries()) {
              if (person.linkedAuthUserId === userId) {
                existingPerson = person;
                break;
              }
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:124',message:'unblock: found existing person',data:{foundExistingPerson:!!existingPerson,existingPersonId:existingPerson?.id,existingIsPlaceholder:existingPerson?.isPlaceholder,existingName:existingPerson?.name||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // Fetch fresh person data from database FIRST (before optimistic update)
            // This ensures we have the real name and data immediately
            let personData: Person | null = null;
            try {
              personData = await getUserProfile(userId);
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:134',message:'unblock: fetched personData from DB',data:{gotPersonData:!!personData,personDataId:personData?.id,personDataName:personData?.name||'',personDataIsPlaceholder:personData?.isPlaceholder},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
            } catch (error) {
              console.warn('[BlockedUsers] Could not fetch person data for optimistic update:', error);
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:138',message:'unblock: ERROR fetching personData',data:{error:error instanceof Error?error.message:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
            }
            
            // If we found the existing placeholder, restore it IMMEDIATELY (optimistic)
            // CRITICAL: Use the SAME person ID and merge fresh data if available
            if (existingPerson) {
              const restoredPerson: Person = {
                // Use existing person's ID to ensure we update the same person in the Map
                id: existingPerson.id,
                // Use fresh data if available, otherwise keep existing data
                name: personData?.name || existingPerson.name || '',
                photoUrl: personData?.photoUrl || existingPerson.photoUrl,
                bio: personData?.bio || existingPerson.bio,
                birthDate: personData?.birthDate || existingPerson.birthDate,
                deathDate: personData?.deathDate || existingPerson.deathDate,
                gender: personData?.gender || existingPerson.gender,
                phoneNumber: personData?.phoneNumber || existingPerson.phoneNumber,
                // Preserve relationships from existing placeholder
                parentIds: existingPerson.parentIds,
                spouseIds: existingPerson.spouseIds,
                childIds: existingPerson.childIds,
                siblingIds: existingPerson.siblingIds,
                // Preserve timestamps and version
                createdAt: existingPerson.createdAt,
                updatedAt: personData?.updatedAt || existingPerson.updatedAt || Date.now(),
                version: personData?.version || existingPerson.version || 1,
                // CRITICAL: Clear placeholder flags - this is the inverse of blocking
                isPlaceholder: false,
                placeholderReason: undefined,
                // Preserve other fields
                createdBy: personData?.createdBy || existingPerson.createdBy,
                updatedBy: personData?.updatedBy || existingPerson.updatedBy,
                hiddenTaggedUpdateIds: existingPerson.hiddenTaggedUpdateIds,
                linkedAuthUserId: existingPerson.linkedAuthUserId,
              };
              
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:171',message:'unblock: updating person in store',data:{restoredPersonId:restoredPerson.id,restoredPersonName:restoredPerson.name||'',restoredIsPlaceholder:restoredPerson.isPlaceholder,hasParentIds:restoredPerson.parentIds.length,hasChildIds:restoredPerson.childIds.length,hasSpouseIds:restoredPerson.spouseIds.length,hasSiblingIds:restoredPerson.siblingIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
              // Update the person in the store - this should trigger re-render
              usePeopleStore.getState().updatePerson(restoredPerson);
              
              // #region agent log
              const afterUpdate = usePeopleStore.getState().people.get(restoredPerson.id);
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:177',message:'unblock: after updatePerson in store',data:{personInStore:!!afterUpdate,personId:afterUpdate?.id,personName:afterUpdate?.name||'',personIsPlaceholder:afterUpdate?.isPlaceholder,storeSize:usePeopleStore.getState().people.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
            } else if (personData) {
              // Person not in store yet - just add them
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:187',message:'unblock: adding new person (not found in store)',data:{personDataId:personData.id,personDataName:personData.name||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              usePeopleStore.getState().updatePerson({
                ...personData,
                isPlaceholder: false,
                placeholderReason: undefined,
              });
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blocked-users.tsx:195',message:'unblock: WARNING no existing person and no personData',data:{userId,foundExistingPerson:!!existingPerson,gotPersonData:!!personData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
            }
            
            try {
              // STEP 3: Sync with backend in background
              await unblockUser(session.user.id, userId);
              
              // STEP 4: CRITICAL - Trigger a full sync to refetch updates from unblocked user
              // This ensures their posts appear again in the feed immediately
              // Don't await - let it happen in background
              const currentUserId = session.user.id;
              useSessionStore.getState().syncFamilyTree(currentUserId).catch((syncError) => {
                console.warn('[BlockedUsers] Background sync after unblock failed (non-fatal):', syncError);
              });
              
              // Success - state already updated optimistically
              logStatsigEvent(statsigClient, 'user_unblocked', {
                unblocked_user_id: userId,
              });
              
              Alert.alert('User Unblocked', `${blockedUser.name} has been unblocked. Their content will now appear in your feed.`);
            } catch (error: any) {
              // REVERT: If backend fails, add back to blocked list
              useBlockedUsersStore.getState().addBlockedUser(userId);
              
              // Revert person back to placeholder (find existing person and mark as placeholder)
              const people = usePeopleStore.getState().people;
              for (const [personId, person] of people.entries()) {
                if (person.linkedAuthUserId === userId) {
                  const placeholderPerson: Person = {
                    ...person,
                    isPlaceholder: true,
                    placeholderReason: 'blocked',
                    name: '', // Clear name for privacy
                  };
                  usePeopleStore.getState().updatePerson(placeholderPerson);
                  break;
                }
              }
              
              console.error('[BlockedUsers] Error unblocking user:', error);
              Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.icon }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Blocked Users
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
            Loading blocked users...
          </ThemedText>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="block" size={64} color={colors.icon} style={styles.emptyIcon} />
          <ThemedText type="defaultSemiBold" style={[styles.emptyTitle, { color: colors.text }]}>
            No Blocked Users
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
            Users you block won't be able to see your content, and you won't see theirs.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {blockedUsers.map((blockedUser) => (
            <View
              key={blockedUser.userId}
              style={[styles.userRow, { borderBottomColor: colors.icon }]}
            >
              {/* User Avatar */}
              <View style={[styles.avatarContainer, { backgroundColor: colors.icon + '20' }]}>
                {blockedUser.photoUrl ? (
                  <Image
                    source={{ uri: blockedUser.photoUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <MaterialIcons name="person" size={32} color={colors.icon} />
                )}
              </View>

              {/* User Info */}
              <View style={styles.userInfo}>
                <ThemedText type="defaultSemiBold" style={[styles.userName, { color: colors.text }]}>
                  {blockedUser.name}
                </ThemedText>
              </View>

              {/* Unblock Button */}
              <Pressable
                onPress={() => handleUnblock(blockedUser)}
                disabled={unblockingUserId === blockedUser.userId}
                style={({ pressed }) => [
                  styles.unblockButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: (pressed || unblockingUserId === blockedUser.userId) ? 0.6 : 1,
                  },
                ]}
              >
                {unblockingUserId === blockedUser.userId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.unblockButtonText}>Unblock</ThemedText>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
  },
  unblockButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
