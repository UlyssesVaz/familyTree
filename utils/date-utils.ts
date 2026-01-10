/**
 * Format date range for display
 * 
 * Converts YYYY-MM-DD date strings to user-friendly format:
 * - Both dates: "1900 - 1961"
 * - Birth only: "Born 1900"
 * - No dates: null
 * 
 * @param birthDate - Birth date in YYYY-MM-DD format (optional)
 * @param deathDate - Death date in YYYY-MM-DD format (optional)
 * @returns Formatted date string or null
 */
export function formatDateRange(birthDate?: string, deathDate?: string): string | null {
  if (!birthDate && !deathDate) return null;
  
  const birthYear = birthDate?.split('-')[0] || '';
  const deathYear = deathDate?.split('-')[0] || '';
  
  if (birthYear && deathYear) {
    return `${birthYear} - ${deathYear}`;
  } else if (birthYear) {
    return `Born ${birthYear}`;
  }
  return null;
}

/**
 * Extract year from YYYY-MM-DD date string
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Year as string or null
 */
export function formatYear(dateString?: string): string | null {
  return dateString?.split('-')[0] || null;
}

