/**
 * Statsig Event Tracking Utility
 * 
 * Provides a safe way to log events to Statsig throughout the app.
 * Handles cases where Statsig client might not be available (race conditions, initialization).
 * 
 * IMPORTANT: Events are flushed immediately to ensure they appear in Statsig dashboard.
 */

import { logger } from './logger';

const statsigLogger = logger.withPrefix('Statsig');

/**
 * Log an event to Statsig (safe to call even if Statsig is not initialized)
 * 
 * This function is async but should be called without await (fire-and-forget)
 * to avoid blocking the UI. Events are flushed immediately for dashboard visibility.
 * 
 * @param client - Statsig client (from useStatsigClient hook, can be null/undefined)
 * @param eventName - Name of the event
 * @param value - Optional value for the event (string or number)
 * @param metadata - Optional metadata object
 * @param flush - Whether to flush immediately (default: true for important events)
 */
export function logStatsigEvent(
  client: { 
    logEvent: (eventName: string, value?: string | number, metadata?: Record<string, any>) => void;
    flush?: () => Promise<void>;
  } | null | undefined,
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>,
  flush: boolean = true
): void {
  // Fire-and-forget: don't block UI, but ensure events are sent
  (async () => {
    if (!client) {
      statsigLogger.log(`Would log event: ${eventName}`, { value, metadata });
      return;
    }

    try {
      client.logEvent(eventName, value, metadata);
      
      // Flush immediately to ensure event appears in dashboard
      // This is important for production visibility
      if (flush && client.flush) {
        await client.flush();
      }
      
      statsigLogger.log(`Logged event: ${eventName}`, { value, metadata });
    } catch (error) {
      statsigLogger.error(`Error logging event ${eventName}:`, error);
    }
  })().catch(() => {
    // Silently fail - don't break app if Statsig fails
  });
}
