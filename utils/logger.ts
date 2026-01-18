/**
 * Production-Safe Logger Utility
 * 
 * Wraps console statements to prevent Apple App Store rejection.
 * Only logs in development mode (__DEV__).
 * 
 * Apple Guideline 2.3: Apps with excessive debug logging may be rejected.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('Debug message'); // Only in __DEV__
 *   logger.error('Error message'); // Always logged (errors are important)
 *   logger.warn('Warning message'); // Only in __DEV__
 */

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug';

class Logger {
  /**
   * Log a message (development only)
   * Use for debug/info messages that aren't needed in production
   */
  log(...args: any[]): void {
    if (__DEV__) {
      console.log(...args);
    }
  }

  /**
   * Log an error (always logged - errors are important)
   * Use for actual errors that need to be tracked in production
   */
  error(...args: any[]): void {
    // Errors are always logged - they're important for debugging production issues
    console.error(...args);
  }

  /**
   * Log a warning (development only)
   * Use for warnings that aren't critical
   */
  warn(...args: any[]): void {
    if (__DEV__) {
      console.warn(...args);
    }
  }

  /**
   * Log info (development only)
   */
  info(...args: any[]): void {
    if (__DEV__) {
      console.info(...args);
    }
  }

  /**
   * Log debug (development only)
   */
  debug(...args: any[]): void {
    if (__DEV__) {
      console.debug(...args);
    }
  }

  /**
   * Log with a prefix (development only)
   * Useful for component/service-specific logging
   */
  withPrefix(prefix: string) {
    return {
      log: (...args: any[]) => {
        if (__DEV__) {
          console.log(`[${prefix}]`, ...args);
        }
      },
      error: (...args: any[]) => {
        // Errors always logged
        console.error(`[${prefix}]`, ...args);
      },
      warn: (...args: any[]) => {
        if (__DEV__) {
          console.warn(`[${prefix}]`, ...args);
        }
      },
      info: (...args: any[]) => {
        if (__DEV__) {
          console.info(`[${prefix}]`, ...args);
        }
      },
      debug: (...args: any[]) => {
        if (__DEV__) {
          console.debug(`[${prefix}]`, ...args);
        }
      },
    };
  }
}

export const logger = new Logger();
