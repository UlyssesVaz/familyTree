import type { Gender } from '@/types/family-tree';

/**
 * Gender color constants (FamilySearch style: blue = male, orange = female)
 */
export const GENDER_COLORS = {
  male: '#4A90E2', // Blue
  female: '#F5A623', // Orange
} as const;

/**
 * Get gender-based color for photo placeholder or border
 * 
 * @param gender - Person's gender
 * @param fallbackColor - Fallback color when gender is 'other' or undefined (typically theme icon color)
 * @returns Color hex string
 */
export function getGenderColor(gender?: Gender, fallbackColor: string = '#888'): string {
  if (!gender || gender === 'other') {
    return fallbackColor;
  }
  return GENDER_COLORS[gender];
}

