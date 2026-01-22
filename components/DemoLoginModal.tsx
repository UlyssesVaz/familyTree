/**
 * Demo Login Modal
 * 
 * Hidden demo login for Apple reviewers.
 * Only accessible via secret tap sequence on login screen.
 */

import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { isEmailPasswordAllowed } from '@/utils/apple-reviewer-backdoor';

interface DemoLoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DemoLoginModal({ visible, onClose }: DemoLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { signInWithEmail } = useAuth();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    // Only allow demo account emails
    if (!isEmailPasswordAllowed(email.trim())) {
      Alert.alert('Access Denied', 'This login method is only available for demo accounts.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // Reset form on success
      setEmail('');
      setPassword('');
      onClose();
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Could not sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setPassword('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <ThemedView style={styles.overlay}>
        <ThemedView style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.icon }]}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>Demo Account Login</ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <ThemedText style={[styles.label, { color: colors.icon }]}>Email</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.icon, color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="apple-reviewer@startceratech.com"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isLoading}
              autoFocus
            />

            <ThemedText style={[styles.label, { color: colors.icon }, styles.labelSpacing]}>Password</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.icon, color: colors.text }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={colors.icon}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              onSubmitEditing={handleSignIn}
            />

            <Pressable
              style={[styles.signInButton, { backgroundColor: colors.tint }, isLoading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.signInButtonText}>Sign In</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelSpacing: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
  },
  signInButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
