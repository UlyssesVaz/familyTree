# Onboarding Implementation Guide

## Overview

Simple, robust onboarding flow with:
- ✅ Provider-agnostic auth abstraction
- ✅ SSO support (Google, Microsoft, Apple, Slack)
- ✅ Reusable profile form components
- ✅ Location integration
- ✅ Routing guards (no race conditions)
- ✅ Firebase-ready (but uses mock for now)

---

## Architecture

### 1. Auth Abstraction Layer

**Location**: `services/auth/`

- **`types.ts`**: Provider-agnostic auth interfaces
- **`firebase-auth-service.ts`**: Firebase implementation (ready for Firebase)
- **`index.ts`**: Factory function to switch implementations

**Key Benefits**:
- Switch auth providers without changing components
- Currently uses `MockAuthService` for development
- Easy to swap to Firebase when ready

### 2. Auth Context

**Location**: `contexts/auth-context.tsx`

- Manages auth state globally
- Handles routing guards automatically
- Prevents race conditions with `isLoading` state
- Redirects based on auth/onboarding status

**Routing Logic**:
```
Not authenticated → /(auth)/login
Authenticated + needs onboarding → /(onboarding)/welcome
Authenticated + onboarding complete → /(tabs)
```

### 3. Location Service

**Location**: `services/location-service.ts`

- Uses `expo-location` for location access
- Handles permissions gracefully
- Reverse geocoding for formatted addresses
- Can be skipped if user denies permission

---

## Onboarding Flow

### Step 1: Login (`app/(auth)/login.tsx`)
- SSO buttons (Google, Microsoft, Apple, Slack)
- Minimal typing required
- Auth context handles routing after sign-in

### Step 2: Welcome (`app/(onboarding)/welcome.tsx`)
- Welcomes user by name
- Shows what's next
- "Get Started" button

### Step 3: Profile Setup (`app/(onboarding)/profile.tsx`)
- Reuses `ProfileFormFields` component
- Name (required), Bio, Birth Date, Gender, Photo
- Pre-fills from SSO data when available
- Validates before continuing

### Step 4: Location (`app/(onboarding)/location.tsx`)
- Requests location permission
- Shows formatted address
- Can skip if denied
- Adds location to profile bio

### Completion
- Redirects to `/(tabs)` (main app)
- Ego initialized in store
- Profile data saved

---

## Key Features

### ✅ No Race Conditions
- `isLoading` state prevents premature redirects
- Auth state checked before routing decisions
- Single source of truth (AuthContext)

### ✅ Smooth UX
- SSO for minimal typing
- Pre-filled data from SSO
- Skip options where appropriate
- Clear progress indicators

### ✅ Reusable Components
- `ProfileFormFields`: Used in both onboarding and edit profile
- Consistent UI/UX across app

### ✅ Provider-Agnostic
- Easy to switch auth providers
- Mock service for development
- Firebase-ready when configured

---

## Firebase Setup (When Ready)

### 1. Install Firebase
```bash
npm install firebase
# For Expo: expo install firebase
```

### 2. Configure Firebase
Create `services/auth/firebase-config.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  // ... other config
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### 3. Enable Providers in Firebase Console
- Google Sign-In
- Microsoft Sign-In
- Apple Sign-In
- Slack Sign-In (custom OAuth)

### 4. Switch to Firebase
In `services/auth/index.ts`:
```typescript
export function getAuthService(): AuthService {
  // Change this:
  const useMock = false; // Was: true
  
  if (useMock) {
    return new MockAuthService();
  }
  
  return new FirebaseAuthService();
}
```

### 5. Complete Firebase Implementation
Uncomment and implement TODOs in `firebase-auth-service.ts`

---

## Dependencies Needed

Add to `package.json`:
```json
{
  "dependencies": {
    "expo-location": "~18.0.0",
    "firebase": "^10.0.0" // When ready
  }
}
```

Install:
```bash
npm install expo-location
# Firebase later: npm install firebase
```

---

## Testing the Flow

### With Mock Auth (Current)
1. Start app → Redirects to login
2. Click any SSO button → Signs in with mock user
3. Welcome screen → Shows mock name
4. Profile setup → Fill form, continue
5. Location → Allow/deny, continue
6. App → Main tabs load

### With Firebase (Future)
1. Configure Firebase
2. Enable providers in console
3. Switch to Firebase service
4. Test real SSO flows

---

## File Structure

```
app/
  (auth)/
    login.tsx          # SSO login screen
  (onboarding)/
    welcome.tsx        # Welcome message
    profile.tsx        # Profile setup
    location.tsx       # Location setup
  (tabs)/              # Main app (protected)

services/
  auth/
    types.ts                    # Auth interfaces
    firebase-auth-service.ts     # Firebase impl
    index.ts                    # Factory
  location-service.ts           # Location handling

contexts/
  auth-context.tsx              # Auth state + routing

components/
  family-tree/
    ProfileFormFields.tsx      # Reusable form
```

---

## Next Steps

1. ✅ **Install expo-location**: `npm install expo-location`
2. ✅ **Test mock flow**: Run app, test onboarding
3. ⏭️ **Set up Firebase**: When ready for backend
4. ⏭️ **Configure SSO**: Enable providers in Firebase
5. ⏭️ **Switch to Firebase**: Update `getAuthService()`

---

## Notes

- **Routing Guards**: AuthContext handles all redirects automatically
- **No Flicker**: `isLoading` prevents premature renders
- **Skip Options**: Location can be skipped, profile name is required
- **SSO First**: Designed for SSO, email/password available but not primary
- **Location Storage**: Currently adds to bio, can be separate field later

