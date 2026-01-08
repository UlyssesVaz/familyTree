import React from 'react';
import { Text, TextStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { Person } from '@/types/family-tree';

/**
 * Format caption text with styled @mentions
 * 
 * Returns an array of Text components where @mentions are highlighted
 * 
 * Example:
 * "Having fun with @John and @Mary" 
 * -> [<Text>Having fun with </Text>, <Text style={mentionStyle}>@John</Text>, <Text> and </Text>, <Text style={mentionStyle}>@Mary</Text>]
 */
export function formatMentions(
  caption: string,
  mentionStyle?: TextStyle,
  people?: Person[]
): React.ReactNode[] {
  if (!caption) return [];

  // Match @mentions in the text
  const mentionRegex = /@(\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(caption)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <ThemedText key={`text-${lastIndex}`}>
          {caption.substring(lastIndex, match.index)}
        </ThemedText>
      );
    }

    // Check if this mention matches a person in the tree
    const mentionName = match[1];
    const matchedPerson = people?.find(
      p => p.name.toLowerCase().includes(mentionName.toLowerCase()) ||
           p.name.split(' ')[0].toLowerCase() === mentionName.toLowerCase()
    );

    // Add the mention with styling
    parts.push(
      <ThemedText
        key={`mention-${match.index}`}
        style={[
          {
            color: '#007AFF', // Blue color for mentions
            fontWeight: '600',
          },
          mentionStyle,
        ]}
      >
        {match[0]} {/* @name */}
      </ThemedText>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < caption.length) {
    parts.push(
      <ThemedText key={`text-${lastIndex}`}>
        {caption.substring(lastIndex)}
      </ThemedText>
    );
  }

  return parts.length > 0 ? parts : [<ThemedText key="caption">{caption}</ThemedText>];
}

