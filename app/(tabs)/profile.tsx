import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Modal, Alert, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HamburgerMenuButton } from '@/components/settings/SettingsHeader';

import { AddUpdateModal, EditProfileModal, ReportAbuseModal, type ReportReason } from '@/components/family-tree';
import { reportContent } from '@/services/supabase/reports-api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useProfileUpdates } from '@/hooks/use-profile-updates';
import { useUpdateManagement } from '@/hooks/use-update-management';
import { usePeopleStore } from '@/stores/people-store';
import { useRelationshipsStore } from '@/stores/relationships-store';
import { useUpdatesStore } from '@/stores/updates-store';
import { useSessionStore } from '@/stores/session-store';
import { formatMentions } from '@/utils/format-mentions';
import { getGenderColor } from '@/utils/gender-utils';
import { getUpdateMenuPermissions } from '@/utils/update-menu-permissions';
import { useAuth } from '@/contexts/auth-context';
import { locationService, LocationData } from '@/services/location-service';
import { uploadImage, STORAGE_BUCKETS } from '@/services/supabase/storage-api';
import { updateEgoProfile, COPPAViolationError } from '@/services/supabase/people-api';
import type { Update, Person } from '@/types/family-tree';
import { useStatsigClient } from '@statsig/expo-bindings';
import { logStatsigEvent } from '@/utils/statsig-tracking';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ addUpdate?: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [manualLocationText, setManualLocationText] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUpdateId, setReportUpdateId] = useState<string | null>(null);
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  const { signOut, session } = useAuth();
  const { client: statsigClient } = useStatsigClient();
  
  const ego = useSessionStore((state) => state.getEgo());
  const egoId = useSessionStore((state) => state.egoId);
  
  // Profile tab always shows ego's profile (no personId param)
  const person = ego;
  const isEgo = true; // Always true for profile tab
  const countAncestors = useRelationshipsStore((state) => state.countAncestors);
  const countDescendants = useRelationshipsStore((state) => state.countDescendants);
  const updateEgoStore = useSessionStore((state) => state.updateEgo);
  
  // Handle profile updates with photo upload and database save
  const handleUpdateEgo = async (updates: Partial<Pick<Person, 'name' | 'bio' | 'birthDate' | 'gender' | 'photoUrl'>>) => {
    if (!session?.user?.id) {
      console.error('[Profile] Cannot update profile: No user session');
      Alert.alert('Error', 'You must be signed in to update your profile.');
      return;
    }
    
    try {
      // STEP 1: Update database via API (handles photo upload internally)
      // The API will:
      // - Upload photo if it's a local file URI
      // - Verify user owns the profile (security check)
      // - Update database row
      // - Return updated Person object
      const updatedPerson = await updateEgoProfile(session.user.id, updates);
      
      // STEP 2: Update Zustand store with the response from database
      // This ensures local state matches database state
      updateEgoStore({
        name: updatedPerson.name,
        bio: updatedPerson.bio,
        birthDate: updatedPerson.birthDate,
        gender: updatedPerson.gender,
        photoUrl: updatedPerson.photoUrl,
      });
      
      if (__DEV__) {
        console.log('[Profile] Profile updated successfully');
      }
    } catch (error: any) {
      console.error('[Profile] Error updating profile:', error);
      
      // COPPA Compliance: If account was deleted due to age violation, sign out immediately
      if (error instanceof COPPAViolationError) {
        Alert.alert(
          'Account Deleted',
          'Your account has been deleted in compliance with COPPA regulations. You must be at least 13 years old to use this app.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Sign out immediately after COPPA violation
                try {
                  await signOut();
                } catch (signOutError) {
                  console.error('[Profile] Error signing out after COPPA violation:', signOutError);
                  // Still navigate away even if sign out fails
                  router.replace('/(auth)/login');
                }
              },
            },
          ]
        );
        return;
      }
      
      Alert.alert(
        'Update Failed',
        error.message || 'Failed to update profile. Please try again.'
      );
    }
  };
  const addUpdate = useUpdatesStore((state) => state.addUpdate);
  const toggleUpdatePrivacy = useUpdatesStore((state) => state.toggleUpdatePrivacy);
  const updateUpdate = useUpdatesStore((state) => state.updateUpdate);
  const getPerson = usePeopleStore((state) => state.getPerson);
  const toggleTaggedUpdateVisibility = useUpdatesStore((state) => state.toggleTaggedUpdateVisibility);
  
  // Use custom hook to get updates for the profile person
  const { updates, updateCount } = useProfileUpdates(egoId);
  
  // Use centralized update management hook
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
  
  // Subscribe to people Map for other uses
  const people = usePeopleStore((state) => state.people);
  const peopleArray = Array.from(people.values());

  // Extract location from bio if present
  useEffect(() => {
    if (person?.bio) {
      // Look for location pattern: 📍 Address (can be on same line or next line)
      const locationMatch = person.bio.match(/📍\s*([^\n]+)/);
      if (locationMatch) {
        // Location is in bio, extract it
        const locationText = locationMatch[1].trim();
        // Set location state
        setLocation({ formattedAddress: locationText } as LocationData);
      } else {
        // No location found in bio
        setLocation(null);
      }
    } else {
      setLocation(null);
    }
  }, [person?.bio]);

  // Request location if not available
  const handleRequestLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const locationData = await locationService.getCurrentLocation();
      if (locationData?.formattedAddress) {
        setLocation(locationData);
        // Update bio with location
        const currentBio = person?.bio || '';
        const locationText = `📍 ${locationData.formattedAddress}`;
        // Remove old location if exists
        const bioWithoutLocation = currentBio.replace(/📍\s*[^\n]+/g, '').trim();
        const newBio = bioWithoutLocation ? `${bioWithoutLocation}\n\n${locationText}` : locationText;
        updateEgoStore({ bio: newBio });
      } else {
        // Location permission denied or failed - offer manual input
        Alert.alert(
          'Location Not Available',
          'We couldn\'t access your device location. Would you like to enter it manually?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Enter Manually', onPress: () => setShowLocationInput(true) },
          ]
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      // Offer manual input on error
      Alert.alert(
        'Location Error',
        'We couldn\'t get your location. Would you like to enter it manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enter Manually', onPress: () => setShowLocationInput(true) },
        ]
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSaveManualLocation = () => {
    if (!manualLocationText.trim()) {
      Alert.alert('Required', 'Please enter a location');
      return;
    }

    const locationData: LocationData = {
      formattedAddress: manualLocationText.trim(),
    } as LocationData;
    
    setLocation(locationData);
    // Update bio with location
    const currentBio = person?.bio || '';
    const locationText = `📍 ${manualLocationText.trim()}`;
    // Remove old location if exists
    const bioWithoutLocation = currentBio.replace(/📍\s*[^\n]+/g, '').trim();
    const newBio = bioWithoutLocation ? `${bioWithoutLocation}\n\n${locationText}` : locationText;
    updateEgoStore({ bio: newBio });
    
    setShowLocationInput(false);
    setManualLocationText('');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              // Only show error if sign out actually failed (not just navigation)
              console.error('Sign out error:', error);
              // Don't show alert - sign out likely succeeded, just navigation might have failed
            }
          },
        },
      ]
    );
  };

  // Check if we should open Add Update modal from navigation params
  useEffect(() => {
    if (params.addUpdate === 'true') {
      setIsAddingUpdate(true);
      // Clear the param to prevent re-opening on re-renders
      router.setParams({ addUpdate: undefined });
    }
  }, [params.addUpdate, router]);

  // Delete confirmation is handled by useUpdateManagement hook

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

  const genderColor = getGenderColor(person?.gender, colors.icon);
  const backgroundColor = colors.background;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const contentPaddingTop = Math.max(topInset, Platform.OS === 'web' ? 0 : 8);

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topInset }]}>
      <HamburgerMenuButton />
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
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                { borderColor: colors.icon },
                pressed && styles.editButtonPressed,
              ]}
            >
              <MaterialIcons name="logout" size={16} color={colors.icon} />
              <ThemedText style={[styles.editButtonText, { marginLeft: 6 }]}>Sign Out</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Name and Bio */}
        <View style={styles.infoSection}>
          <ThemedText type="defaultSemiBold" style={styles.displayName}>
            {person.name}
          </ThemedText>
          
          {/* Location Display */}
          {isEgo && (
            <View style={styles.locationContainer}>
              {location?.formattedAddress ? (
                <View style={styles.locationRow}>
                  <MaterialIcons name="location-on" size={16} color={colors.icon} />
                  <ThemedText style={[styles.locationText, { color: colors.icon }]}>
                    {location.formattedAddress}
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  onPress={handleRequestLocation}
                  disabled={isLoadingLocation}
                  style={styles.locationRequestButton}
                >
                  {isLoadingLocation ? (
                    <ThemedText style={[styles.locationText, { color: colors.icon, opacity: 0.6 }]}>
                      Loading location...
                    </ThemedText>
                  ) : (
                    <>
                      <MaterialIcons name="location-on" size={16} color={colors.tint} />
                      <ThemedText style={[styles.locationText, { color: colors.tint }]}>
                        Add location
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}
          
          {/* Bio without location */}
          {person.bio && (() => {
            // Remove location from bio display (it's shown separately above)
            const bioWithoutLocation = person.bio.replace(/📍\s*[^\n]+/g, '').trim();
            return bioWithoutLocation ? (
              <ThemedText style={styles.bio}>{bioWithoutLocation}</ThemedText>
            ) : null;
          })()}
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
                
                // Use utility function to determine menu permissions
                const menuPermissions = getUpdateMenuPermissions(
                  update,
                  session?.user?.id,
                  person?.id,
                  egoId,
                  person
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
                            {formatMentions(update.caption, undefined, peopleArray)}
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
                            {/* For tagged updates, show hide/show option */}
                            {menuPermissions.canToggleTaggedVisibility && (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  if (person?.id) {
                                    toggleTaggedUpdateVisibility(person.id, update.id);
                                  }
                                  setMenuUpdateId(null);
                                }}
                                style={styles.menuItem}
                              >
                                <MaterialIcons
                                  name={person?.hiddenTaggedUpdateIds?.includes(update.id) ? 'visibility' : 'visibility-off'}
                                  size={20}
                                  color={colors.text}
                                />
                                <ThemedText style={styles.menuItemText}>
                                  {person?.hiddenTaggedUpdateIds?.includes(update.id) ? 'Show on Profile' : 'Hide from Profile'}
                                </ThemedText>
                              </Pressable>
                            )}
                            
                            {/* For own updates, show privacy and edit options */}
                            {menuPermissions.canChangeVisibility && (
                              <Pressable
                                onPress={async (e) => {
                                  e.stopPropagation();
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
                                  Make {update.isPublic ? 'Private' : 'Public'}
                                </ThemedText>
                              </Pressable>
                            )}

                            {menuPermissions.canEdit && (
                              <Pressable
                                onPress={(e) => {
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
                                  // Set pending delete and close menu
                                  // useEffect will handle showing alert after modal closes
                                  setPendingDeleteId(update.id);
                                  setMenuUpdateId(null);
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

      {/* Edit Profile Modal - Only show for ego */}
      {isEgo && person && (
        <>
          <EditProfileModal
            person={person}
            visible={isEditing}
            onClose={() => setIsEditing(false)}
            onSave={handleUpdateEgo}
          />
          {/* Manual Location Input Modal */}
          <Modal
            visible={showLocationInput}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLocationInput(false)}
          >
            <View style={styles.modalOverlay}>
              <ThemedView style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Enter Location
                  </ThemedText>
                  <Pressable onPress={() => setShowLocationInput(false)}>
                    <MaterialIcons name="close" size={24} color={colors.icon} />
                  </Pressable>
                </View>
                
                <ThemedText style={[styles.modalDescription, { color: colors.icon }]}>
                  Enter your location (e.g., City, State or full address)
                </ThemedText>
                
                <TextInput
                  style={[
                    styles.locationInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.icon,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Enter location..."
                  placeholderTextColor={colors.icon}
                  value={manualLocationText}
                  onChangeText={setManualLocationText}
                  autoFocus
                />
                
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => {
                      setShowLocationInput(false);
                      setManualLocationText('');
                    }}
                    style={[styles.modalButton, styles.modalButtonCancel]}
                  >
                    <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveManualLocation}
                    style={[
                      styles.modalButton,
                      styles.modalButtonSave,
                      { backgroundColor: colors.tint },
                    ]}
                  >
                    <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </View>
          </Modal>

          <AddUpdateModal
            visible={isAddingUpdate}
            onClose={() => {
              setIsAddingUpdate(false);
              setUpdateToEdit(null);
            }}
            updateToEdit={updateToEdit || undefined}
            personId={egoId || undefined}
            onAdd={async (title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
              if (egoId && session?.user?.id) {
                await addUpdate(egoId, title, photoUrl, caption, isPublic, taggedPersonIds, session.user.id);
                
                // Track event: update_posted
                logStatsigEvent(statsigClient, 'update_posted', undefined, {
                  isOnOtherWall: false,
                  hasTagging: (taggedPersonIds?.length ?? 0) > 0,
                  taggedCount: taggedPersonIds?.length ?? 0,
                });
              } else {
                console.error('[Profile] Cannot add update: Missing egoId or session');
              }
            }}
            onEdit={async (updateId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => {
              try {
                await updateUpdate(updateId, title, photoUrl, caption, isPublic, taggedPersonIds);
              } catch (error: any) {
                Alert.alert('Error', 'Failed to update post. Please try again.');
                return;
              }
              
              // Track event: wall_entry_updated
              const update = useUpdatesStore.getState().updates.get(updateId);
              const currentEgoId = useSessionStore.getState().egoId;
              const isOnOtherWall = update?.personId !== currentEgoId;
              const hasTagging = (taggedPersonIds?.length ?? 0) > 0;
              
              logStatsigEvent(statsigClient, 'wall_entry_updated', undefined, {
                isOnOtherWall,
                hasTagging,
                taggedCount: taggedPersonIds?.length ?? 0,
              });
            }}
          />

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
                  
                  Alert.alert('Report Submitted', 'Thank you for keeping the family tree safe. We will review this report.');
                } catch (error: any) {
                  console.error('[Profile] Error submitting report:', error);
                  Alert.alert('Error', 'Failed to submit report. Please try again.');
                }
              }}
              reportType="update"
              targetId={reportUpdateId}
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
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logoutButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    opacity: 0.8,
  },
  locationRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  settingsSection: {
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  settingsTitle: {
    fontSize: 18,
    padding: 16,
    paddingBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingsItemPressed: {
    opacity: 0.7,
  },
  settingsItemDanger: {
    // Styled inline for danger color
  },
  settingsItemText: {
    fontSize: 16,
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
  updateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.7,
  },
  locationInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonSave: {
    // backgroundColor set inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});