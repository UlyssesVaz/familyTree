import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, Platform, useColorScheme as useRNColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark' | null;

interface ColorSchemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: 'light' | 'dark') => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemColorScheme || 'light');
  const [isManual, setIsManual] = useState(false);

  // Update when system color scheme changes (only if user hasn't manually set it)
  useEffect(() => {
    if (!isManual && systemColorScheme) {
      setColorSchemeState(systemColorScheme);
    }
  }, [systemColorScheme, isManual]);

  const setColorScheme = (scheme: 'light' | 'dark') => {
    setIsManual(true);
    setColorSchemeState(scheme);
    
    // On native platforms, also update the Appearance API
    if (Platform.OS !== 'web') {
      try {
        if (Appearance.setColorScheme) {
          Appearance.setColorScheme(scheme);
        }
      } catch (e) {
        // Appearance.setColorScheme might not be available on all platforms
        console.warn('Appearance.setColorScheme not available:', e);
      }
    }
  };

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, setColorScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorSchemeContext() {
  const context = useContext(ColorSchemeContext);
  if (context === undefined) {
    throw new Error('useColorSchemeContext must be used within a ColorSchemeProvider');
  }
  return context;
}

