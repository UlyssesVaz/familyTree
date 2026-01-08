import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorSchemeContext } from '@/contexts/color-scheme-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  try {
    // Try to use the context if available (when wrapped in ColorSchemeProvider)
    const { colorScheme } = useColorSchemeContext();
    return hasHydrated ? colorScheme : 'light';
  } catch {
    // Fall back to system color scheme if context is not available
    const colorScheme = useRNColorScheme();
    return hasHydrated ? colorScheme : 'light';
  }
}
