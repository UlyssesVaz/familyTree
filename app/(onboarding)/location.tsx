/**
 * Location Setup Screen (Onboarding Step 3)
 * 
 * Optional location setup.
 * User can skip or allow location access.
 */

import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { locationService, LocationData } from '@/services/location-service';
import { useFamilyTreeStore } from '@/stores/family-tree-store';

export default function LocationSetupScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const updateEgo = useFamilyTreeStore((state) => state.updateEgo);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Try to get location automatically
    loadLocation();
  }, []);

  const loadLocation = async () => {
    setIsLoading(true);
    try {
      const loc = await locationService.getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      console.error('Error loading location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Save location to bio or separate field (for now, add to bio)
    if (location?.formattedAddress) {
      const ego = useFamilyTreeStore.getState().getEgo();
      const currentBio = ego?.bio || '';
      const locationText = `📍 ${location.formattedAddress}`;
      const newBio = currentBio ? `${currentBio}\n\n${locationText}` : locationText;
      
      updateEgo({ bio: newBio });
    }

    // Complete onboarding - redirect to app
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.tint }]}>
            <MaterialIcons name="location-on" size={48} color="#FFFFFF" />
          </View>
          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            Add Your Location
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            This helps your family find you and shows where you're from.
          </ThemedText>
        </View>

        {/* Location Display */}
        <View style={styles.locationSection}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.tint} />
          ) : location ? (
            <View style={[styles.locationCard, { borderColor: '#4CAF50', backgroundColor: theme === 'dark' ? '#1B5E20' : '#E8F5E9' }]}>
              <MaterialIcons name="check-circle" size={24} color={colors.tint} />
              <View style={styles.locationInfo}>
                <ThemedText style={[styles.locationText, { color: colors.text }]}>
                  {location.formattedAddress || `${location.city}, ${location.country}`}
                </ThemedText>
                {location.city && (
                  <ThemedText style={[styles.locationSubtext, { color: colors.icon }]}>
                    {location.city}, {location.region} {location.country}
                  </ThemedText>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.noLocationCard, { borderColor: colors.icon }]}>
              <MaterialIcons name="location-off" size={24} color={colors.icon} />
              <ThemedText style={[styles.noLocationText, { color: colors.icon }]}>
                Location not available
              </ThemedText>
            </View>
          )}

          {!location && !isLoading && (
            <Pressable
              onPress={loadLocation}
              style={({ pressed }) => [
                styles.retryButton,
                {
                  borderColor: colors.tint,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="refresh" size={20} color={colors.tint} />
              <ThemedText style={[styles.retryButtonText, { color: colors.tint }]}>
                Try Again
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: colors.tint,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.continueButtonText, { color: '#FFFFFF' }]}>
              {location ? 'Continue' : 'Skip for Now'}
            </ThemedText>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>

          {location && (
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.skipButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText style={[styles.skipButtonText, { color: colors.icon }]}>
                Skip
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  locationSection: {
    marginBottom: 48,
    alignItems: 'center',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    gap: 16,
    width: '100%',
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationSubtext: {
    fontSize: 14,
  },
  noLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 16,
    width: '100%',
  },
  noLocationText: {
    fontSize: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    // Color is set inline to ensure white text on colored background
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
  },
});

