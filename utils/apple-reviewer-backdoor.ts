/**
 * Apple Reviewer Backdoor
 * 
 * Hardened backdoor for Apple App Store security review.
 * Only whitelists the specific Apple reviewer email address.
 * 
 * SECURITY: This is a hardened backdoor that only allows the exact email
 * specified by Apple for security review purposes.
 */

/**
 * Apple reviewer email whitelist
 * Only this exact email is allowed through the backdoor
 */
const APPLE_REVIEWER_EMAIL = 'apple-reviewer@startceratech.com';

/**
 * Check if an email is the Apple reviewer email
 * Uses strict comparison to prevent any bypass attempts
 */
export function isAppleReviewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Strict comparison - must match exactly
  return email.toLowerCase().trim() === APPLE_REVIEWER_EMAIL.toLowerCase().trim();
}

/**
 * Get the Apple reviewer email (for logging/debugging purposes)
 */
export function getAppleReviewerEmail(): string {
  return APPLE_REVIEWER_EMAIL;
}
