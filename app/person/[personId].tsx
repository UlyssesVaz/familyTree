import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import type { Gender, Person } from '@/types/family-tree';

export default function PersonProfileModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ personId: string }>();
  const colorSchemeHook = useColorScheme();
  const theme = colorSchemeHook ?? 'light';
  const colors = Colors[theme];
  
  const getPerson = useFamilyTreeStore((state) => state.getPerson);
  const getUpdateCount = useFamilyTreeStore((state) => state.getUpdateCount);
  const getUpdatesForPerson = useFamilyTreeStore((state) => state.getUpdatesForPerson);
  const countAncestors = useFamilyTreeStore((state) => state.countAncestors);
  const countDescendants = useFamilyTreeStore((state) => state.countDescendants);
  
  const person: Person | null = params.personId ? getPerson(params.personId) || null : null;
  
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
  const updatesCount = getUpdateCount(person.id);
  const updates = getUpdatesForPerson(person.id);

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
            </View>

            {updates.length === 0 ? (
              <View style={styles.emptyUpdates}>
                <ThemedText style={[styles.emptyUpdatesText, { color: colors.icon }]}>
                  No updates yet. Tap + to add your first photo!
                </ThemedText>
              </View>
            ) : (
              <View style={styles.updatesGrid}>
                {updates.map((update) => (
                  <View key={update.id} style={styles.updateItem}>
                    <Image
                      source={{ uri: update.photoUrl }}
                      style={styles.updatePhoto}
                      contentFit="cover"
                    />
                    {!update.isPublic && (
                      <View style={styles.privateOverlay}>
                        <MaterialIcons name="lock" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ThemedView>
      </ScrollView>
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
  displayName: {
    fontSize: 16,
    marginBottom: 8,
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
  emptyUpdates: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyUpdatesText: {
    fontSize: 14,
    textAlign: 'center',
  },
  updatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  updateItem: {
    width: '33.33%',
    aspectRatio: 1,
    position: 'relative',
  },
  updatePhoto: {
    width: '100%',
    height: '100%',
  },
  privateOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
});

