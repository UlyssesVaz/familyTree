import { useState, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Conditionally import DateTimePicker only on native platforms
let DateTimePicker: any = null;
let hasDateTimePicker = false;
try {
  if (Platform.OS !== 'web') {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
    hasDateTimePicker = !!DateTimePicker;
  }
} catch (error) {
  // DateTimePicker not available, will use fallback
  hasDateTimePicker = false;
}

interface DatePickerFieldProps {
  /** Label for the field */
  label: string;
  /** Current date value in YYYY-MM-DD format */
  value?: string;
  /** Callback when date changes (receives YYYY-MM-DD format) */
  onChange: (date: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Optional hint text below the field */
  hint?: string;
}

/**
 * DatePickerField Component
 * 
 * A reusable date picker field that uses the native system calendar when available,
 * otherwise falls back to a text input with validation.
 * Works on iOS, Android, and Web.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  hint,
}: DatePickerFieldProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [showPicker, setShowPicker] = useState(false);
  const [textInputValue, setTextInputValue] = useState(value || '');

  // Parse YYYY-MM-DD string to Date object
  const parseDate = (dateString?: string): Date => {
    if (!dateString) return new Date();
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return new Date();
    }
  };

  // Format Date object to YYYY-MM-DD string
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Validate YYYY-MM-DD format
  const validateDate = (dateString: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = parseDate(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && date <= new Date();
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseDate(value));

  // Sync selectedDate and textInputValue when value prop changes
  useEffect(() => {
    if (value) {
      setSelectedDate(parseDate(value));
      setTextInputValue(value);
    } else {
      setTextInputValue('');
    }
  }, [value]);

  const handleDateChange = (event: any, date?: Date) => {
    // On Android, the picker closes when a date is selected
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (date) {
      setSelectedDate(date);
      const formatted = formatDate(date);
      onChange(formatted);
      setTextInputValue(formatted);
    } else if (Platform.OS === 'android') {
      // User cancelled on Android
      setShowPicker(false);
    }
  };

  const handleTextChange = (text: string) => {
    setTextInputValue(text);
    if (validateDate(text)) {
      onChange(text);
    }
  };

  const displayValue = value || placeholder;
  const hasValue = !!value;
  const useNativePicker = hasDateTimePicker && Platform.OS !== 'web';

  return (
    <View style={styles.field}>
      <ThemedText type="defaultSemiBold" style={styles.label}>
        {label}
      </ThemedText>
      
      {useNativePicker ? (
        // Native picker (iOS/Android when available)
        <>
          <Pressable
            onPress={() => {
              setShowPicker(true);
            }}
            style={({ pressed }) => [
              styles.input,
              {
                borderColor: colors.icon,
                backgroundColor: colors.background,
              },
              pressed && styles.inputPressed,
            ]}
          >
            <ThemedText
              style={[
                styles.inputText,
                { color: hasValue ? colors.text : colors.icon },
              ]}
            >
              {displayValue}
            </ThemedText>
            <MaterialIcons name="calendar-today" size={20} color={colors.icon} />
          </Pressable>

          {/* iOS: Show inline picker */}
          {showPicker && Platform.OS === 'ios' && DateTimePicker && (
            <View style={[styles.iosPickerContainer, { borderColor: colors.icon }]}>
              <View style={[styles.iosPickerHeader, { borderBottomColor: colors.icon }]}>
                <Pressable
                  onPress={() => setShowPicker(false)}
                  style={styles.iosPickerButton}
                >
                  <ThemedText style={[styles.iosPickerButtonText, { color: colors.tint }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(formatDate(selectedDate));
                    setShowPicker(false);
                  }}
                  style={styles.iosPickerButton}
                >
                  <ThemedText style={[styles.iosPickerButtonText, { color: colors.tint }]}>
                    Done
                  </ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setSelectedDate(date);
                  }
                }}
                maximumDate={new Date()}
                style={styles.iosPicker}
              />
            </View>
          )}

          {/* Android: Show modal picker */}
          {showPicker && Platform.OS === 'android' && DateTimePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </>
      ) : Platform.OS === 'web' ? (
        // Web: Use HTML5 date input
        <input
          type="date"
          value={value || ''}
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value);
              setTextInputValue(e.target.value);
            }
          }}
          max={new Date().toISOString().split('T')[0]}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: `1px solid ${colors.icon}`,
            borderRadius: '8px',
            backgroundColor: colors.background,
            color: colors.text,
          }}
        />
      ) : (
        // Native fallback: Text input when DateTimePicker unavailable
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text,
              borderColor: colors.icon,
              backgroundColor: colors.background,
            },
          ]}
          value={textInputValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.icon}
          keyboardType="numeric"
          maxLength={10}
        />
      )}
      
      {hint && (
        <ThemedText style={[styles.hint, { color: colors.icon }]}>
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputPressed: {
    opacity: 0.7,
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  iosPickerContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  iosPickerButton: {
    padding: 4,
  },
  iosPickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosPicker: {
    height: 200,
  },
  webPickerContainer: {
    marginTop: 12,
  },
});
