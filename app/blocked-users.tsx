/**
 * Blocked Users Screen
 * 
 * Displays list of blocked users and allows unblocking.
 * Similar to Instagram's blocked users management.
 */

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
import { getUserProfile } from '@/services/supabase/people-api';
import type { Person } from '@/types/family-tree';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';
import { useBlockedUsers, useUnblockUser } from '@/hooks/use-blocked-users';
import { usePeople, useUpdatePerson } from '@/hooks/use-people';

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
  
  // React Query handles loading, data, and automatic refetching
  const { data: blockedUsers = [], isLoading } = useBlockedUsers();
  const unblockMutation = useUnblockUser();
  const updatePersonMutation = useUpdatePerson();
  const { data: peopleArray = [] } = usePeople();

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
            
            // React Query handles optimistic update, API call, and rollback automatically
            try {
              // STEP 1: Find existing person and fetch fresh data
              const peopleMap = new Map(peopleArray.map(p => [p.id, p]));
              let existingPerson: Person | null = null;
              
              // Find the existing placeholder person to preserve relationships
              for (const person of peopleArray) {
                if (person.linkedAuthUserId === userId) {
                  existingPerson = person;
                  break;
                }
              }
              
              // Fetch fresh person data from database
              let personData: Person | null = null;
              try {
                personData = await getUserProfile(userId);
              } catch (error) {
                console.warn('[BlockedUsers] Could not fetch person data:', error);
              }
              
              // STEP 2: Restore person data using React Query mutation
              if (existingPerson && session?.user?.id) {
                const restoredPerson: Person = {
                  id: existingPerson.id,
                  name: personData?.name || existingPerson.name || '',
                  photoUrl: personData?.photoUrl || existingPerson.photoUrl,
                  bio: personData?.bio || existingPerson.bio,
                  birthDate: personData?.birthDate || existingPerson.birthDate,
                  deathDate: personData?.deathDate || existingPerson.deathDate,
                  gender: personData?.gender || existingPerson.gender,
                  phoneNumber: personData?.phoneNumber || existingPerson.phoneNumber,
                  parentIds: existingPerson.parentIds,
                  spouseIds: existingPerson.spouseIds,
                  childIds: existingPerson.childIds,
                  siblingIds: existingPerson.siblingIds,
                  createdAt: existingPerson.createdAt,
                  updatedAt: personData?.updatedAt || existingPerson.updatedAt || Date.now(),
                  version: personData?.version || existingPerson.version || 1,
                  isPlaceholder: false,
                  placeholderReason: undefined,
                  createdBy: personData?.createdBy || existingPerson.createdBy,
                  updatedBy: personData?.updatedBy || existingPerson.updatedBy,
                  hiddenTaggedUpdateIds: existingPerson.hiddenTaggedUpdateIds,
                  linkedAuthUserId: existingPerson.linkedAuthUserId,
                };
                
                // Update person via React Query
                updatePersonMutation.mutate({
                  userId: session.user.id,
                  personId: existingPerson.id,
                  updates: {
                    name: restoredPerson.name,
                    photoUrl: restoredPerson.photoUrl,
                    bio: restoredPerson.bio,
                    birthDate: restoredPerson.birthDate,
                    deathDate: restoredPerson.deathDate,
                    gender: restoredPerson.gender,
                    phoneNumber: restoredPerson.phoneNumber,
                    isPlaceholder: false,
                    placeholderReason: undefined,
                  },
                });
              } else if (personData && session?.user?.id) {
                // Person not in cache yet - will be added when sync runs
              }
              
              // STEP 3: Trigger React Query unblock mutation (handles API call, optimistic update, rollback)
              // NOTE: React Query automatically invalidates and refetches familyTree on success
              // No manual sync needed - removing duplicate sync to prevent race condition
              unblockMutation.mutate(
                { blockedUserId: userId },
                {
                  onSuccess: () => {
                    // Log event
                    logStatsigEvent(statsigClient, 'user_unblocked', {
                      unblocked_user_id: userId,
                    });
                    
                    // Show success alert
                    Alert.alert(
                      'User Unblocked',
                      `${blockedUser.name} has been unblocked. Their content will now appear in your feed.`,
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            router.back();
                          },
                        },
                      ]
                    );
                  },
                  onError: (error: any) => {
                    // React Query automatically rolled back the optimistic update
                    // Person update will also be rolled back automatically
                    Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
                  },
                }
              );
            } catch (error: any) {
              console.error('[BlockedUsers] Error in handleUnblock:', error);
              Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
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
                disabled={unblockMutation.isPending}
                style={({ pressed }) => [
                  styles.unblockButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: (pressed || unblockMutation.isPending) ? 0.6 : 1,
                  },
                ]}
              >
                {unblockMutation.isPending ? (
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
