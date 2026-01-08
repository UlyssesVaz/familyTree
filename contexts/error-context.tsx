/**
 * Error Context
 * 
 * Centralized error handling and display for the application.
 * 
 * **Why use an Error Context?**
 * - Consistent error handling across the app
 * - User-friendly error messages
 * - Error recovery and retry logic
 * - Error logging and monitoring (ready for Sentry integration)
 * 
 * **Usage:**
 * ```tsx
 * const { showError, clearError, error } = useError();
 * 
 * try {
 *   await someOperation();
 * } catch (err) {
 *   showError('Failed to save', err, { retry: () => retryOperation() });
 * }
 * ```
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';

export interface ErrorInfo {
  /** User-friendly error message */
  message: string;
  /** Technical error details (for logging) */
  error?: Error | unknown;
  /** Optional retry function */
  retry?: () => void | Promise<void>;
  /** Optional error code for handling specific errors */
  code?: string;
  /** Timestamp when error occurred */
  timestamp: number;
}

interface ErrorContextType {
  /** Current error state */
  error: ErrorInfo | null;
  /** Show an error to the user */
  showError: (
    message: string,
    error?: Error | unknown,
    options?: {
      retry?: () => void | Promise<void>;
      code?: string;
      showAlert?: boolean;
    }
  ) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Handle API errors consistently */
  handleApiError: (error: unknown, defaultMessage?: string) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorInfo | null>(null);

  const showError = useCallback((
    message: string,
    error?: Error | unknown,
    options?: {
      retry?: () => void | Promise<void>;
      code?: string;
      showAlert?: boolean;
    }
  ) => {
    const errorInfo: ErrorInfo = {
      message,
      error,
      retry: options?.retry,
      code: options?.code,
      timestamp: Date.now(),
    };

    setError(errorInfo);

    // Log error for debugging/monitoring
    console.error('[ErrorContext]', message, error);

    // TODO: Send to error monitoring service (Sentry, etc.)
    // if (typeof fetch !== 'undefined') {
    //   fetch('/api/errors', {
    //     method: 'POST',
    //     body: JSON.stringify({ message, error, code: options?.code }),
    //   }).catch(() => {});
    // }

    // Show alert if requested (default: true)
    if (options?.showAlert !== false) {
      const alertButtons: any[] = [{ text: 'OK', onPress: () => setError(null) }];
      
      if (options?.retry) {
        alertButtons.unshift({
          text: 'Retry',
          onPress: async () => {
            setError(null);
            try {
              await options.retry?.();
            } catch (retryError) {
              showError('Retry failed', retryError, { showAlert: true });
            }
          },
        });
      }

      if (Platform.OS === 'web') {
        // Web: Use window.alert for consistency
        window.alert(message);
      } else {
        // Native: Use Alert
        Alert.alert('Error', message, alertButtons);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleApiError = useCallback((error: unknown, defaultMessage = 'An error occurred') => {
    // Handle different types of API errors
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        showError('Network error. Please check your connection.', error, {
          code: 'NETWORK_ERROR',
          retry: () => {
            // Retry logic can be passed in
          },
        });
        return;
      }

      // API errors with status codes
      if ('status' in error && typeof (error as any).status === 'number') {
        const status = (error as any).status;
        if (status === 401) {
          showError('Please sign in to continue', error, { code: 'UNAUTHORIZED' });
          return;
        }
        if (status === 403) {
          showError('You don\'t have permission to perform this action', error, { code: 'FORBIDDEN' });
          return;
        }
        if (status === 404) {
          showError('Resource not found', error, { code: 'NOT_FOUND' });
          return;
        }
        if (status >= 500) {
          showError('Server error. Please try again later.', error, {
            code: 'SERVER_ERROR',
            retry: () => {
              // Retry logic
            },
          });
          return;
        }
      }

      // Generic error with message
      showError(error.message || defaultMessage, error);
      return;
    }

    // Unknown error type
    showError(defaultMessage, error);
  }, [showError]);

  return (
    <ErrorContext.Provider
      value={{
        error,
        showError,
        clearError,
        handleApiError,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

