import type { Person } from '@/types/family-tree';

/**
 * Get a display name for a person that includes context to differentiate duplicates
 * Shows relationship or last name if there are multiple people with the same first name
 */
export function getDisplayNameWithContext(
  person: Person,
  allPeople: Person[],
  currentPersonId?: string
): string {
  const firstName = person.name.split(' ')[0];
  const lastName = person.name.split(' ').pop() || '';
  
  // Find all people with the same first name
  const peopleWithSameFirstName = allPeople.filter(
    p => p.id !== currentPersonId && p.name.split(' ')[0].toLowerCase() === firstName.toLowerCase()
  );
  
  // If there are duplicates, add context
  if (peopleWithSameFirstName.length > 0) {
    // If they have a last name, use it
    if (lastName && lastName !== firstName) {
      return `${firstName} ${lastName}`;
    }
    // Otherwise, try to find relationship context (this would require ego context)
    // For now, just use full name
    return person.name;
  }
  
  // No duplicates, just use first name for mentions
  return firstName;
}

/**
 * Parses a caption string for @mentions and returns an array of tagged person IDs.
 * It attempts to match mentioned names to actual people in the family tree.
 * Now uses UUID internally but matches on names with context.
 *
 * @param caption The caption text to parse.
 * @param people An array of all people in the family tree.
 * @param excludePersonId Optional person ID to exclude from matching (e.g., the update owner).
 * @returns An array of unique person IDs that were successfully tagged.
 */
export function parseMentions(
  caption: string,
  people: Person[],
  excludePersonId?: string
): string[] {
  const taggedIds: Set<string> = new Set();
  const mentionRegex = /@([a-zA-Z0-9_.-]+(?:\s+[a-zA-Z0-9_.-]+)?)/g; // Matches @name or @first last
  let match;

  const availablePeople = excludePersonId
    ? people.filter(p => p.id !== excludePersonId)
    : people;

  while ((match = mentionRegex.exec(caption)) !== null) {
    const mentionedText = match[1]; // The text after '@'
    const mentionedParts = mentionedText.trim().split(/\s+/);
    const mentionedFirst = mentionedParts[0].toLowerCase();
    const mentionedLast = mentionedParts.length > 1 ? mentionedParts[1].toLowerCase() : null;

    // Try to find a matching person
    let foundPerson: Person | undefined;

    // 1. Try exact full name match (case-insensitive)
    if (mentionedLast) {
      foundPerson = availablePeople.find(person => {
        const nameLower = person.name.toLowerCase();
        return nameLower === mentionedText.toLowerCase() ||
               nameLower === `${mentionedFirst} ${mentionedLast}`;
      });
    }

    // 2. Try first name + last name match
    if (!foundPerson && mentionedLast) {
      foundPerson = availablePeople.find(person => {
        const parts = person.name.split(' ');
        if (parts.length >= 2) {
          const personFirst = parts[0].toLowerCase();
          const personLast = parts[parts.length - 1].toLowerCase();
          return personFirst === mentionedFirst && personLast === mentionedLast;
        }
        return false;
      });
    }

    // 3. Try first name match (only if no last name was provided)
    if (!foundPerson && !mentionedLast) {
      const matches = availablePeople.filter(person => {
        const personFirst = person.name.split(' ')[0].toLowerCase();
        return personFirst === mentionedFirst;
      });
      
      // If only one match, use it
      if (matches.length === 1) {
        foundPerson = matches[0];
      }
      // If multiple matches, try to match by last name if available in caption context
      // For now, we'll just take the first match and let user be more specific
      else if (matches.length > 0) {
        foundPerson = matches[0]; // Default to first match, but ideally user should be more specific
      }
    }

    // 4. Try partial match as fallback
    if (!foundPerson) {
      foundPerson = availablePeople.find(person => {
        const nameLower = person.name.toLowerCase();
        return nameLower.includes(mentionedFirst) || 
               nameLower.includes(mentionedText.toLowerCase());
      });
    }

    if (foundPerson) {
      taggedIds.add(foundPerson.id); // Store UUID internally
    }
  }

  return Array.from(taggedIds);
}

/**
 * Get a mention string for a person (what to insert when user selects them)
 * Includes context if there are duplicate names
 */
export function getMentionString(
  person: Person,
  allPeople: Person[],
  currentPersonId?: string
): string {
  const firstName = person.name.split(' ')[0];
  const lastName = person.name.split(' ').pop() || '';
  
  // Check for duplicates
  const duplicates = allPeople.filter(
    p => p.id !== currentPersonId && 
         p.id !== person.id &&
         p.name.split(' ')[0].toLowerCase() === firstName.toLowerCase()
  );
  
  // If there are duplicates and person has a last name, include it
  if (duplicates.length > 0 && lastName && lastName !== firstName) {
    return `${firstName} ${lastName}`;
  }
  
  // Otherwise just use first name
  return firstName;
}
