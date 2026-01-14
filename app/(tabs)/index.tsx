import { useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Alert, ScrollView, Dimensions, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { createInvitationLink } from '@/services/supabase/invitations-api';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';

import {
  PersonCard,
  AddRelativeOrStoryModal,
  AddRelativeTypeModal,
  AddPersonModal,
  InfiniteCanvas,
  type RelativeType,
} from '@/components/family-tree';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTreeLayout } from '@/hooks/use-tree-layout';
import { usePeopleStore } from '@/stores/people-store';
import { useRelationshipsStore } from '@/stores/relationships-store';
import { useSessionStore } from '@/stores/session-store';
import type { Gender, Person } from '@/types/family-tree';

/**
 * GenerationRow Component - Displays a generation of people (all siblings to each other)
 * Shows each person with their spouses, and all people in the generation are spaced out
 * Used for parents row, children row, etc.
 */
function GenerationRow({ 
  people, 
  isEgo = false,
  egoPerson,
  onEgoPress,
  onEgoAddPress,
  onPersonAddPress,
  onPersonPress,
}: { 
  people: Person[];
  isEgo?: boolean;
  egoPerson?: Person;
  onEgoPress?: () => void;
  onEgoAddPress?: () => void;
  onPersonAddPress?: (person: Person) => void;
  onPersonPress?: (person: Person) => void;
}) {
  const getPerson = usePeopleStore((state) => state.getPerson);
  const getSiblings = useRelationshipsStore((state) => state.getSiblings);

  if (isEgo && egoPerson) {
    // Special handling for ego row - ego is centered, then siblings on right
    const egoSpouses = egoPerson.spouseIds
      .map((id) => getPerson(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    const egoSiblings = getSiblings(egoPerson.id);

    return (
      <View style={styles.personRow}>
        {/* Ego's Spouses (Left) - Tight spacing */}
        {egoSpouses.length > 0 && (
          <View style={styles.spousesContainer}>
            {egoSpouses.map((spouse) => (
              <View key={spouse.id} style={[styles.spouseCardWrapper, { flexShrink: 0 }]}>
                <PersonCard 
                  person={spouse} 
                  width={200}
                  onPress={() => onPersonPress?.(spouse)}
                  onAddPress={() => onPersonAddPress?.(spouse)}
                  showAddButton={true}
                />
              </View>
            ))}
          </View>
        )}

        {/* Ego Card (Center) */}
        <View style={[styles.personCardWrapper, { flexShrink: 0 }]}>
          <PersonCard 
            person={egoPerson} 
            width={250} 
            onPress={onEgoPress}
            onAddPress={onEgoAddPress}
            showAddButton={true}
          />
        </View>

        {/* Ego's Siblings (Right) - Spaced out horizontally with room for their spouses */}
        {egoSiblings.length > 0 && (
          <View style={styles.siblingsContainer}>
            {egoSiblings.map((sibling) => {
              const siblingSpouses = sibling.spouseIds
                .map((id) => getPerson(id))
                .filter((p): p is NonNullable<typeof p> => p !== undefined);
              
              return (
                  <View key={sibling.id} style={styles.siblingGroup}>
                  <View style={styles.siblingCardWrapper}>
                    <PersonCard 
                      person={sibling} 
                      width={200}
                      onPress={() => onPersonPress?.(sibling)}
                      onAddPress={() => onPersonAddPress?.(sibling)}
                      showAddButton={true}
                    />
                  </View>
                  {siblingSpouses.length > 0 && (
                    <View style={styles.siblingSpouseContainer}>
                      {siblingSpouses.map((spouse) => (
                        <View key={spouse.id} style={styles.siblingSpouseWrapper}>
                          <PersonCard 
                            person={spouse} 
                            width={180}
                            onPress={() => onPersonPress?.(spouse)}
                            onAddPress={() => onPersonAddPress?.(spouse)}
                            showAddButton={true}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  // For generation rows (parents, children) - all people are siblings to each other
  // Display each person with their spouses, spaced out
  return (
    <View style={styles.personRow}>
      {people.map((person) => {
        const personSpouses = person.spouseIds
          .map((id) => getPerson(id))
          .filter((p): p is NonNullable<typeof p> => p !== undefined);

        return (
          <View key={person.id} style={styles.generationPersonGroup}>
            {/* Person's spouses (if any) - displayed before person */}
            {personSpouses.length > 0 && (
              <View style={styles.spousesContainer}>
                {personSpouses.map((spouse) => (
                  <View key={spouse.id} style={[styles.spouseCardWrapper, { flexShrink: 0 }]}>
                    <PersonCard 
                      person={spouse} 
                      width={180}
                      onPress={() => onPersonPress?.(spouse)}
                      onAddPress={() => onPersonAddPress?.(spouse)}
                      showAddButton={true}
                    />
                  </View>
                ))}
              </View>
            )}
            {/* Person card */}
            <View style={styles.generationPersonCard}>
              <PersonCard 
                person={person} 
                width={200}
                onPress={() => onPersonPress?.(person)}
                onAddPress={() => onPersonAddPress?.(person)}
                showAddButton={true}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const egoId = useSessionStore((state) => state.egoId);
  const { client: statsigClient } = useStatsigClient();
  
  // Use the custom hook to get all tree layout calculations
  // This hook encapsulates all the complex tree traversal logic
  const { ancestorGenerations, descendantGenerations, spouses, siblings, ego } = useTreeLayout(egoId);
  
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRelativeTypeModal, setShowRelativeTypeModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [selectedRelativeType, setSelectedRelativeType] = useState<RelativeType | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null); // Track which person we're adding to

  // REMOVED: Demo profile initialization
  // This was leftover test code. Ego should only come from:
  // 1. Database (via getUserProfile after authentication)
  // 2. Onboarding flow (via createEgoProfile)
  // Never create demo/test profiles - always require proper authentication and onboarding

  const handleEgoCardPress = () => {
    // Navigate to profile tab when ego card is clicked
    router.push('/profile');
  };

  const handleAddPress = (person?: Person) => {
    // Use provided person or default to ego
    const personToAddTo = person || ego;
    if (!personToAddTo) return;
    setSelectedPerson(personToAddTo);
    setShowAddModal(true);
  };

  const handleAddRelative = () => {
    setShowAddModal(false);
    setShowRelativeTypeModal(true);
  };

  const handleAddStory = () => {
    if (!selectedPerson || !egoId) {
      setShowAddModal(false);
      return;
    }
    
    // Don't allow adding story to yourself - navigate to profile and open Add Update modal
    if (selectedPerson.id === egoId) {
      setShowAddModal(false);
      // Navigate to profile with a query param to trigger Add Update modal
      router.push({ pathname: '/profile', params: { addUpdate: 'true' } });
      return;
    }
    
    // Navigate to the target person's profile page with addStory param to open Add Update modal there
    setShowAddModal(false);
    router.push({ pathname: '/person/[personId]', params: { personId: selectedPerson.id, addStory: 'true' } });
  };

  const handleSelectRelativeType = (type: RelativeType) => {
    // Set state in the correct order: first set the type, then close the type modal, then open the add person modal
    // This ensures selectedPerson remains set throughout the transition
    setSelectedRelativeType(type);
    setShowRelativeTypeModal(false);
    setShowAddPersonModal(true);
  };

  const handleAddPerson = async (data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Gender;
    phoneNumber?: string;
  }) => {
    if (!selectedPerson || !selectedRelativeType) {
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to add a person.');
      return;
    }

    const addPerson = usePeopleStore.getState().addPerson;
    const addParent = useRelationshipsStore.getState().addParent;
    const addSpouse = useRelationshipsStore.getState().addSpouse;
    const addChild = useRelationshipsStore.getState().addChild;
    const addSibling = useRelationshipsStore.getState().addSibling;

    try {
      // Create the new person (await async call and pass userId)
      const newPersonId = await addPerson(data, userId);

      // Track event: relative_added
      logStatsigEvent(statsigClient, 'relative_added');

      // Create the relationship based on type (await async calls and pass userId)
      switch (selectedRelativeType) {
        case 'parent':
          await addParent(selectedPerson.id, newPersonId, userId);
          break;
        case 'spouse':
          await addSpouse(selectedPerson.id, newPersonId, userId);
          break;
        case 'child':
          await addChild(selectedPerson.id, newPersonId, userId);
          break;
        case 'sibling':
          await addSibling(selectedPerson.id, newPersonId, userId);
          break;
      }

      // Success - reset state
      setSelectedRelativeType(null);
      setSelectedPerson(null);
      setShowAddPersonModal(false);

      // Always offer to send invite via native share
      // Delay to ensure modal is fully closed before showing share sheet
      setTimeout(async () => {
        try {
          // Create invitation link for the newly added person
          const invitation = await createInvitationLink({
            targetPersonId: newPersonId,
            userId: userId,
          });

          // Generate invitation URL
          // Using app scheme for deep linking (familytreeapp://join/[token])
          // For web, this would be https://yourdomain.com/join/[token]
          const inviteUrl = `familytreeapp://join/${invitation.token}`;
          const inviteMessage = `Hi ${data.name}! I've added you to our family tree. Join us to see and contribute to our shared family history!\n\n${inviteUrl}`;
          
          Alert.alert(
            'Person Added!',
            `Would you like to send ${data.name} an invite?`,
            [
              { text: 'Skip', style: 'cancel' },
              {
                text: 'Share Invite',
                onPress: async () => {
                  try {
                    // Small delay to ensure alert is dismissed before showing share sheet
                    setTimeout(async () => {
                      await Share.share({
                        message: inviteMessage,
                        title: `Invite ${data.name} to Family Tree`,
                        // Don't include url parameter - it causes duplication on iOS
                        // The URL is already in the message text
                      });
                      
                      // Track event: invite_sent
                      // Note: React Native Share API doesn't expose method (SMS/Email)
                      // We can't determine which method was used
                      logStatsigEvent(statsigClient, 'invite_sent');
                    }, 300);
                  } catch (error) {
                    console.error('Error sharing invite:', error);
                  }
                },
              },
            ]
          );
        } catch (error: any) {
          console.error('[HomeScreen] Error creating invitation link:', error);
          // Still show success message, but without invite link
          Alert.alert(
            'Person Added!',
            `${data.name} has been added to your family tree.`,
            [{ text: 'OK' }]
          );
        }
      }, 300);
    } catch (error: any) {
      console.error('[HomeScreen] Error adding person:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to add person. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  if (!ego) {
    return (
      <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
        <ThemedView style={[styles.treeContainer, { paddingTop: contentPaddingTop, justifyContent: 'center' }]}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      <InfiniteCanvas>
        <ThemedView style={[styles.treeContainer, { paddingTop: contentPaddingTop }]}>
          {/* Ancestor Generations (Above Ego) - Recursively display all parent generations */}
          {ancestorGenerations.map((generation, index) => (
            <View key={`ancestor-gen-${index}`} style={styles.generationSection}>
              <GenerationRow 
                people={generation}
                onPersonAddPress={handleAddPress}
                onPersonPress={(person) => router.push({ pathname: '/person/[personId]', params: { personId: person.id } })}
              />
            </View>
          ))}

          {/* Ego Row (Center) */}
          <GenerationRow 
            people={[]}
            isEgo={true}
            egoPerson={ego}
            onEgoPress={handleEgoCardPress}
            onEgoAddPress={() => handleAddPress(ego)}
            onPersonAddPress={handleAddPress}
            onPersonPress={(person) => router.push({ pathname: '/person/[personId]', params: { personId: person.id } })}
          />

          {/* Descendant Generations (Below Ego) - Recursively display all child generations */}
          {descendantGenerations.map((generation, index) => (
            <View key={`descendant-gen-${index}`} style={styles.generationSection}>
              <GenerationRow 
                people={generation}
                onPersonAddPress={handleAddPress}
                onPersonPress={(person) => router.push({ pathname: '/person/[personId]', params: { personId: person.id } })}
              />
            </View>
          ))}

          {/* Empty State */}
          {ancestorGenerations.length === 0 && spouses.length === 0 && descendantGenerations.length === 0 && siblings.length === 0 && (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>
                Tap the + button to add relatives to your family tree
              </ThemedText>
            </View>
          )}
        </ThemedView>
      </InfiniteCanvas>

      {/* Add Relative or Story Modal */}
      {selectedPerson && (
        <>
          <AddRelativeOrStoryModal
            visible={showAddModal}
            person={selectedPerson}
            onClose={() => {
              setShowAddModal(false);
              setSelectedPerson(null);
            }}
            onAddRelative={() => {
              setShowAddModal(false); // Close this modal first
              handleAddRelative(); // Then open next modal
            }}
            onAddStory={handleAddStory}
          />

          {/* Add Relative Type Modal */}
          <AddRelativeTypeModal
            visible={showRelativeTypeModal}
            person={selectedPerson}
            onClose={() => {
              // Only clear selectedPerson if user manually closes (not when transitioning to AddPersonModal)
              setShowRelativeTypeModal(false);
              setSelectedPerson(null);
            }}
            onSelectType={(type) => {
              handleSelectRelativeType(type);
            }}
          />

          {/* Add Person Modal */}
          {selectedRelativeType && selectedPerson && (
            <AddPersonModal
              visible={showAddPersonModal}
              person={selectedPerson}
              relativeType={selectedRelativeType}
              onClose={() => {
                setShowAddPersonModal(false);
                setSelectedRelativeType(null);
                setSelectedPerson(null);
              }}
              onAdd={handleAddPerson}
            />
          )}

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
  treeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 20,
  },
  generationSection: {
    marginVertical: 40,
    alignItems: 'center',
    width: '100%',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center', // Center align all cards vertically
    justifyContent: 'center',
    flexWrap: 'nowrap', // Keep everything on one row, InfiniteCanvas handles overflow
    paddingHorizontal: 10,
    width: '100%',
  },
  generationPersonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Tight spacing between person's spouses and person
    flexShrink: 0,
    marginHorizontal: 20, // Space between each person in the generation
  },
  generationPersonCard: {
    alignItems: 'center',
  },
  spousesContainer: {
    flexDirection: 'row',
    gap: 8, // Tight spacing - spouses form a pair/rectangle with person
    flexShrink: 0,
  },
  spouseCardWrapper: {
    alignItems: 'center',
  },
  personCardWrapper: {
    alignItems: 'center',
    marginHorizontal: 8, // Space between person and spouses
  },
  siblingsContainer: {
    flexDirection: 'row',
    gap: 40, // Generous spacing between sibling groups - allows room for their spouses
    flexShrink: 0,
    marginLeft: 20, // Extra space between person and first sibling
  },
  siblingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Tight spacing between sibling and their spouse(s)
    flexShrink: 0,
  },
  siblingCardWrapper: {
    alignItems: 'center',
  },
  siblingSpouseContainer: {
    flexDirection: 'row',
    gap: 8, // Tight spacing for sibling's spouses (if multiple)
  },
  siblingSpouseWrapper: {
    alignItems: 'center',
  },
  emptyState: {
    marginTop: 60,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
});
