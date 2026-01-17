/**
 * Export Data Modal
 * 
 * Displays exported user data in JSON format with copy functionality.
 * Works on all platforms (including Expo Go).
 */

import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Pressable, View, Alert, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ExportDataModalProps {
  visible: boolean;
  jsonData: string | null;
  onClose: () => void;
}

export function ExportDataModal({ visible, jsonData, onClose }: ExportDataModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!jsonData) return;
    
    // Web: Use browser clipboard API (works without native modules)
    if (Platform.OS === 'web') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(jsonData);
          setCopied(true);
          Alert.alert('Copied!', 'Your data has been copied to clipboard. You can paste it into a text file or email.');
          setTimeout(() => setCopied(false), 2000);
          return;
        }
      } catch (error: any) {
        console.error('[ExportDataModal] Clipboard API failed, using fallback:', error);
      }
      
      // Fallback for older browsers or if clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = jsonData;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        Alert.alert('Copied!', 'Your data has been copied to clipboard.');
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (error: any) {
        console.error('[ExportDataModal] Fallback copy failed:', error);
      }
    }
    
    // Native (iOS/Android): Show manual copy instructions
    // expo-clipboard requires dev build, so we just provide instructions for Expo Go
    Alert.alert(
      'Copy Instructions',
      'To copy your data:\n\n1. Tap and hold on the text above\n2. Select "Select All"\n3. Tap "Copy"\n\nThen paste it into a text file, email, or notes app.',
      [{ text: 'OK' }]
    );
  };

  const handleDownload = () => {
    if (!jsonData || Platform.OS !== 'web') return;
    
    // Web: Create download link
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `familytree-export-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Your Data Export
          </ThemedText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <ThemedText style={[styles.infoText, { color: colors.icon }]}>
            This is your complete data export in JSON format. You can copy it to save in a text file or email it to yourself.
          </ThemedText>
        </View>

        {/* JSON Data Display */}
        <ScrollView 
          style={[styles.jsonContainer, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.jsonContent}
        >
          <ThemedText 
            style={[styles.jsonText, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
            selectable
          >
            {jsonData || 'Loading...'}
          </ThemedText>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleCopy}
            style={[styles.button, styles.copyButton, { backgroundColor: colors.tint }]}
          >
            <MaterialIcons 
              name={copied ? 'check' : (Platform.OS === 'web' ? 'content-copy' : 'info-outline')} 
              size={20} 
              color="#FFFFFF" 
            />
            <ThemedText style={styles.buttonText}>
              {copied ? 'Copied!' : (Platform.OS === 'web' ? 'Copy to Clipboard' : 'Copy Instructions')}
            </ThemedText>
          </Pressable>

          {Platform.OS === 'web' && (
            <Pressable
              onPress={handleDownload}
              style={[styles.button, styles.downloadButton, { backgroundColor: colors.tint }]}
            >
              <MaterialIcons name="download" size={20} color="#FFFFFF" />
              <ThemedText style={styles.buttonText}>Download as File</ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            style={[styles.button, styles.closeButtonFooter]}
          >
            <ThemedText style={[styles.buttonText, { color: colors.text }]}>Close</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  jsonContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  jsonContent: {
    padding: 16,
  },
  jsonText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  copyButton: {
    // backgroundColor set dynamically
  },
  downloadButton: {
    // backgroundColor set dynamically
  },
  closeButtonFooter: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
