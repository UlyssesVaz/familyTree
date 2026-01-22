# Demo Login Implementation for Apple Reviewers

## Overview

A hidden demo login feature has been implemented to allow Apple reviewers to access the app using email/password credentials. This is completely hidden from regular users and only accessible via a secret tap sequence.

## Implementation Details

### 1. Extended Backdoor Utility (`utils/apple-reviewer-backdoor.ts`)

Added functions to support demo account access:
- `isDemoAccountEmail()` - Checks if email is allowed for demo access
- `isEmailPasswordAllowed()` - Checks if email/password auth should be enabled

### 2. Email/Password Auth Enabled (`services/auth/supabase-auth-service.ts`)

- `signInWithEmail()` - Now allows email/password for demo accounts only
- `signUpWithEmail()` - Now allows sign-up for demo accounts only
- Both methods check `isEmailPasswordAllowed()` before proceeding
- Regular users still get "not supported" error

### 3. Demo Login Modal (`components/DemoLoginModal.tsx`)

- Modal component with email/password fields
- Only accepts demo account emails (whitelisted)
- Proper error handling and loading states
- Themed to match app design

### 4. Secret Tap Sequence (`app/(auth)/login.tsx`)

- Tap the title "Welcome to Family Tree" 5 times quickly (within 2 seconds)
- Race condition safe with proper timeout cleanup
- Opens demo login modal
- Completely hidden from regular users

## Setup Instructions

### Step 1: Create Demo Account in Supabase

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter:
   - **Email:** `apple-reviewer@startceratech.com`
   - **Password:** (set a secure password)
   - **Auto Confirm User:** ✅ (checked - important!)
4. Click "Create user"

### Step 2: Provide Credentials in App Store Connect

1. Go to App Store Connect → Your App → App Store → App Information
2. Scroll to "App Review Information"
3. Fill in:
   - **Demo Account Email:** `apple-reviewer@startceratech.com`
   - **Demo Account Password:** (the password you set in Supabase)
   - **Notes:** "Tap the title 'Welcome to Family Tree' 5 times quickly on the login screen to access the demo login modal. Then enter the provided credentials."

## Security Features

✅ **Email Whitelist** - Only `apple-reviewer@startceratech.com` can use email/password  
✅ **Hidden UI** - Demo login only appears via secret tap sequence  
✅ **No Public Exposure** - Regular users won't see email/password fields  
✅ **Backward Compatible** - Existing SSO flows remain unchanged  
✅ **Race Condition Safe** - Proper timeout handling prevents issues

## How It Works

1. **Regular Users:**
   - See only Google/Apple Sign-In buttons
   - Cannot access email/password login
   - If they try to use `signInWithEmail()`, they get "not supported" error

2. **Apple Reviewers:**
   - Tap title 5 times quickly → Demo login modal appears
   - Enter `apple-reviewer@startceratech.com` and password
   - System checks email whitelist before allowing login
   - On success, normal authentication flow proceeds

## Testing

To test the demo login:

1. **Test Secret Tap:**
   - Go to login screen
   - Tap "Welcome to Family Tree" title 5 times quickly
   - Demo login modal should appear

2. **Test Email Validation:**
   - Try entering a different email → Should show "Access Denied"
   - Enter `apple-reviewer@startceratech.com` → Should allow

3. **Test Authentication:**
   - Enter correct credentials → Should sign in successfully
   - Enter wrong password → Should show error

## Files Modified

- `utils/apple-reviewer-backdoor.ts` - Extended with demo account support
- `services/auth/supabase-auth-service.ts` - Enabled email/password for demo accounts
- `components/DemoLoginModal.tsx` - New component (created)
- `app/(auth)/login.tsx` - Added secret tap sequence

## Notes

- The demo login is completely hidden from regular users
- No UI changes visible to public users
- All existing SSO flows work exactly as before
- The backdoor still works for Apple Sign-In users with the reviewer email
- Both authentication methods (Apple Sign-In + email/password) work for the reviewer
