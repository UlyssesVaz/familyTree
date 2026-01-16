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
import { getBlockedUsers, unblockUser } from '@/services/supabase/blocks-api';
import { usePeopleStore } from '@/stores/people-store';
import { useBlockedUsersStore } from '@/stores/blocked-users-store';
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

    // Load from backend if not already loaded
    const storeBlockedIds = useBlockedUsersStore.getState().blockedUserIds;
    if (storeBlockedIds.size === 0 && !useBlockedUsersStore.getState().isLoading) {
      useBlockedUsersStore.getState().loadBlockedUsers(session.user.id);
    }

    // Build list from store (reactive - updates when store changes)
    const updateBlockedUsersList = () => {
      const blockedUserIds = useBlockedUsersStore.getState().blockedUserIds;
      const people = usePeopleStore.getState().people;
      const blockedUsersList: BlockedUser[] = [];
      
      for (const blockedUserId of blockedUserIds) {
        // Find person with matching linkedAuthUserId
        for (const [personId, person] of people.entries()) {
          if (person.linkedAuthUserId === blockedUserId) {
            blockedUsersList.push({
              userId: blockedUserId,
              personId,
              name: person.name,
              photoUrl: person.photoUrl,
            });
            break;
          }
        }
      }
      
      setBlockedUsers(blockedUsersList);
      setIsLoading(false);
    };

    // Initial load
    setIsLoading(true);
    updateBlockedUsersList();

    // Subscribe to store changes for reactive updates
    const unsubscribe = useBlockedUsersStore.subscribe((state) => {
      if (state.isLoading) {
        setIsLoading(true);
      } else {
        updateBlockedUsersList();
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
            
            // OPTIMISTIC UPDATE: Immediately remove from local state for instant UI feedback
            useBlockedUsersStore.getState().removeBlockedUser(userId);
            // List will update automatically via store subscription
            
            try {
              // Sync with backend in background
              await unblockUser(session.user.id, userId);
              
              // Success - state already updated optimistically
              logStatsigEvent(statsigClient, 'user_unblocked', {
                unblocked_user_id: userId,
              });
              
              Alert.alert('User Unblocked', `${blockedUser.name} has been unblocked. Their content will now appear in your feed.`);
            } catch (error: any) {
              // REVERT: If backend fails, add back to local state
              useBlockedUsersStore.getState().addBlockedUser(userId);
              
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
