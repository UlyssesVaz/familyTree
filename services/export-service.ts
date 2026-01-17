/**
 * Export Service
 * 
 * Handles exporting user data in JSON format.
 * Returns JSON string for display in UI (modal with copy functionality).
 * 
 * Separation of Concerns:
 * - export-api.ts: Data fetching (pure API logic)
 * - export-service.ts: JSON formatting (data transformation)
 * - UI components: Display and copy functionality
 */

import { exportUserData, type ExportData } from '@/services/supabase/export-api';

/**
 * Get exported user data as JSON string
 * 
 * Flow:
 * 1. Fetch user data using export-api
 * 2. Convert to JSON string (pretty-printed for readability)
 * 3. Return JSON string for UI display
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @returns JSON string of user's data
 * @throws Error if export fails
 */
export async function getExportDataAsJson(userId: string): Promise<string> {
  try {
    // STEP 1: Get export data from API
    const exportData: ExportData = await exportUserData(userId);
    
    // STEP 2: Convert to JSON string (pretty-printed for readability)
    const jsonString = JSON.stringify(exportData, null, 2);
    
    return jsonString;
  } catch (error: any) {
    console.error('[Export Service] Error exporting user data:', error);
    throw new Error(`Failed to export data: ${error?.message || 'Unknown error'}`);
  }
}
