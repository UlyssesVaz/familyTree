/**
 * Location Service
 * 
 * Handles location permissions and fetching user location.
 * Uses Expo Location API.
 */

import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  formattedAddress?: string;
}

class LocationService {
  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'We need your location to show where you are in your profile. You can skip this for now.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const firstAddress = address[0];
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        city: firstAddress?.city || undefined,
        region: firstAddress?.region || undefined,
        country: firstAddress?.country || undefined,
        formattedAddress: this.formatAddress(firstAddress),
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  /**
   * Format address from reverse geocode result
   */
  private formatAddress(address: Location.LocationGeocodedAddress | undefined): string | undefined {
    if (!address) return undefined;

    const parts: string[] = [];
    if (address.city) parts.push(address.city);
    if (address.region) parts.push(address.region);
    if (address.country) parts.push(address.country);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }
}

export const locationService = new LocationService();

