import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorSchemeContext } from '@/contexts/color-scheme-context';

export function useColorScheme() {
  try {
    // Try to use the context if available (when wrapped in ColorSchemeProvider)
    const { colorScheme } = useColorSchemeContext();
    return colorScheme;
  } catch {
    // Fall back to system color scheme if context is not available
    return useRNColorScheme();
  }
}
