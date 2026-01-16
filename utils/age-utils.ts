/**
 * Age Utilities
 * 
 * Functions for calculating age from birth dates.
 * Used for COPPA compliance (age gate).
 */

/**
 * Calculates age from a birth date string (YYYY-MM-DD format).
 * 
 * @param birthDate - Birth date in YYYY-MM-DD format
 * @returns Age in years, or null if birthDate is invalid
 */
export function calculateAge(birthDate: string): number | null {
  if (!birthDate) {
    return null;
  }

  try {
    const [year, month, day] = birthDate.split('-').map(Number);
    const birth = new Date(year, month - 1, day);
    const today = new Date();

    // Validate date
    if (isNaN(birth.getTime()) || birth > today) {
      return null;
    }

    // Calculate age
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // Adjust if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  } catch {
    return null;
  }
}

/**
 * Checks if a user is at least 13 years old (COPPA requirement).
 * 
 * @param birthDate - Birth date in YYYY-MM-DD format
 * @returns true if user is 13 or older, false otherwise
 */
export function isAtLeast13(birthDate: string): boolean {
  const age = calculateAge(birthDate);
  return age !== null && age >= 13;
}

/**
 * Extracts the birth year from a birth date string.
 * 
 * @param birthDate - Birth date in YYYY-MM-DD format
 * @returns Birth year as number, or null if invalid
 */
export function getBirthYear(birthDate: string): number | null {
  if (!birthDate) {
    return null;
  }

  try {
    const [year] = birthDate.split('-').map(Number);
    return isNaN(year) ? null : year;
  } catch {
    return null;
  }
}
