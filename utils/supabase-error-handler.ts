/**
 * Supabase Error Handler Utility
 * 
 * Centralized error handling for all Supabase API operations.
 * Handles common error codes consistently across the application.
 * 
 * Common Supabase/PostgreSQL Error Codes:
 * - PGRST116: No rows returned (expected for queries that might not find data)
 * - 23505: Unique constraint violation (duplicate key)
 * - 23503: Foreign key constraint violation
 * - 23502: Not null constraint violation
 * - 42P01: Undefined table
 * - 42703: Undefined column
 */

/**
 * Supabase error response type
 */
export interface SupabaseError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * Error handling options
 */
export interface ErrorHandlerOptions {
  /** API name for logging (e.g., 'People API', 'Updates API') */
  apiName: string;
  /** Operation name for error messages (e.g., 'fetch user profile', 'create update') */
  operation: string;
  /** Whether to allow null return for PGRST116 (no rows found) */
  allowNullForNotFound?: boolean;
  /** Custom handler for specific error codes */
  customHandlers?: {
    [errorCode: string]: (error: SupabaseError) => any;
  };
}

/**
 * Handle Supabase query errors with consistent behavior
 * 
 * @param data - Response data from Supabase
 * @param error - Error object from Supabase
 * @param options - Error handling options
 * @returns Data if successful, null if allowed, or throws error
 * @throws Error if error cannot be handled gracefully
 */
export function handleSupabaseError<T>(
  data: T | null,
  error: SupabaseError | null,
  options: ErrorHandlerOptions
): T {
  const { apiName, operation, allowNullForNotFound = false, customHandlers = {} } = options;

  // No error - check if data exists
  if (!error) {
    if (!data && !allowNullForNotFound) {
      throw new Error(`Failed to ${operation}: No data returned`);
    }
    return data as T;
  }

  // Check for custom handler first (allows override of default behavior)
  if (error.code && customHandlers[error.code]) {
    return customHandlers[error.code](error);
  }

  // Handle common error codes
  switch (error.code) {
    case 'PGRST116':
      // No rows returned - this is expected for queries that might not find data
      if (allowNullForNotFound) {
        return null as T;
      }
      // If null not allowed, treat as error
      console.error(`[${apiName}] No rows found for ${operation}`);
      throw new Error(`Failed to ${operation}: No data found`);

    case '23505':
      // Unique constraint violation (duplicate key)
      // This is a race condition - item was created between check and insert
      console.warn(`[${apiName}] Duplicate key error for ${operation}:`, error.message);
      throw new Error(`Failed to ${operation}: Item already exists (duplicate key)`);

    case '23503':
      // Foreign key constraint violation
      console.error(`[${apiName}] Foreign key violation for ${operation}:`, error.message);
      throw new Error(`Failed to ${operation}: Referenced record does not exist`);

    case '23502':
      // Not null constraint violation
      console.error(`[${apiName}] Not null violation for ${operation}:`, error.message);
      throw new Error(`Failed to ${operation}: Required field is missing`);

    case '42P01':
      // Undefined table
      console.error(`[${apiName}] Table not found for ${operation}:`, error.message);
      throw new Error(`Failed to ${operation}: Database table does not exist`);

    case '42703':
      // Undefined column
      console.error(`[${apiName}] Column not found for ${operation}:`, error.message);
      throw new Error(`Failed to ${operation}: Database column does not exist`);

    default:
      // Unknown error - log and throw
      console.error(`[${apiName}] Error ${operation}:`, error);
      throw new Error(`Failed to ${operation}: ${error.message}`);
  }
}

/**
 * Handle Supabase errors that should return null for "not found" cases
 * 
 * Convenience wrapper for queries that expect null when no data is found
 * 
 * @param data - Response data from Supabase
 * @param error - Error object from Supabase
 * @param options - Error handling options (operation and apiName required)
 * @returns Data if found, null if not found, throws for other errors
 */
export function handleSupabaseQuery<T>(
  data: T | null,
  error: SupabaseError | null,
  options: Omit<ErrorHandlerOptions, 'allowNullForNotFound'>
): T | null {
  return handleSupabaseError(data, error, {
    ...options,
    allowNullForNotFound: true,
  });
}

/**
 * Handle Supabase errors that should always throw (no null returns)
 * 
 * Convenience wrapper for mutations that should never return null
 * 
 * @param data - Response data from Supabase
 * @param error - Error object from Supabase
 * @param options - Error handling options (operation and apiName required)
 * @returns Data if successful, throws for any error
 */
export function handleSupabaseMutation<T>(
  data: T | null,
  error: SupabaseError | null,
  options: Omit<ErrorHandlerOptions, 'allowNullForNotFound'>
): T {
  return handleSupabaseError(data, error, {
    ...options,
    allowNullForNotFound: false,
  });
}

/**
 * Handle duplicate key errors with custom recovery logic
 * 
 * Used for race conditions where an item might be created concurrently
 * 
 * @param error - Error object from Supabase
 * @param recoveryFn - Function to fetch existing item if duplicate
 * @param apiName - API name for logging
 * @param operation - Operation name for error messages
 * @returns Result from recovery function, or throws if recovery fails
 */
export async function handleDuplicateKeyError<T>(
  error: SupabaseError | null,
  recoveryFn: () => Promise<T | null>,
  apiName: string,
  operation: string
): Promise<T> {
  if (!error || error.code !== '23505') {
    // Not a duplicate key error - rethrow original error
    throw error;
  }

  // Try to recover by fetching existing item
  const existing = await recoveryFn();
  if (existing) {
    if (__DEV__) {
      console.log(`[${apiName}] Recovered from duplicate key error for ${operation}`);
    }
    return existing;
  }

  // Recovery failed - throw error
  console.error(`[${apiName}] Duplicate key error for ${operation} and recovery failed:`, error.message);
  throw new Error(`Failed to ${operation}: Item already exists and could not be retrieved`);
}
