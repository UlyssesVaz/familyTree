/**
 * Statsig Event Tracking Utility
 * 
 * Provides a safe way to log events to Statsig throughout the app.
 * Handles cases where Statsig client might not be available (race conditions, initialization).
 */

/**
 * Log an event to Statsig (safe to call even if Statsig is not initialized)
 * 
 * @param client - Statsig client (from useStatsigClient hook, can be null/undefined)
 * @param eventName - Name of the event
 * @param value - Optional value for the event (string or number)
 * @param metadata - Optional metadata object
 */
export function logStatsigEvent(
  client: { logEvent: (eventName: string, value?: string | number, metadata?: Record<string, any>) => void } | null | undefined,
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>
) {
  if (!client) {
    if (__DEV__) {
      console.log(`[Statsig] Would log event: ${eventName}`, { value, metadata });
    }
    return;
  }

  try {
    client.logEvent(eventName, value, metadata);
    if (__DEV__) {
      console.log(`[Statsig] Logged event: ${eventName}`, { value, metadata });
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`[Statsig] Error logging event ${eventName}:`, error);
    }
  }
}
