# Firebase Integration Guide

## Overview

This guide explains how Firebase integrates with the Family Tree App architecture and how to set it up.

---

## Firebase Architecture Overview

### What is Firebase?

Firebase is Google's Backend-as-a-Service (BaaS) platform that provides:
- **Firebase Auth**: Authentication (SSO, email/password)
- **Firestore**: NoSQL database (real-time sync)
- **Firebase Storage**: File storage (photos)
- **Firebase Realtime Database**: Alternative to Firestore (WebSocket-like)
- **Cloud Functions**: Serverless functions (optional)

### How Firebase Fits Our Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React Native)          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  Components  │  │  Service Layer   │ │
│  │  (UI)        │→ │  (Abstraction)   │ │
│  └──────────────┘  └──────────────────┘ │
│                        ↓                 │
│  ┌──────────────────────────────────┐   │
│  │      Zustand Store (Local)        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Firebase SDK (Client)           │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   Auth   │  │ Firestore│  │Storage│ │
│  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Firebase Backend (Cloud)         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   Auth   │  │ Firestore│  │Storage│ │
│  │  Service │  │ Database │  │Service│ │
│  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────┘
```

**Key Point**: Firebase SDK runs **in the frontend** (React Native app). There's no separate backend server needed for basic operations!

---

## Firebase Services We'll Use

### 1. Firebase Auth (Authentication) ✅ Ready

**What it does:**
- Handles SSO (Google, Microsoft, Apple, Slack)
- Email/password authentication
- User session management
- Token refresh

**How it works:**
- User signs in → Firebase Auth returns user object
- We convert Firebase user to our `AuthSession` format
- Store session in `AuthContext`
- Firebase handles token refresh automatically

**Setup:**
```bash
npm install firebase
# or for Expo:
expo install firebase
```

**Configuration:**
1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication → Sign-in methods
3. Enable providers (Google, Microsoft, Apple, Slack)
4. Copy config to `services/auth/firebase-config.ts`

**Implementation:**
- Already scaffolded in `services/auth/firebase-auth-service.ts`
- Just needs Firebase SDK installed and config added

---

### 2. Firestore (Database) 📋 To Implement

**What it does:**
- Stores people, relationships, updates
- Real-time sync (like WebSockets)
- Offline support
- Automatic conflict resolution

**How it works:**
- Collections: `people`, `updates`, `relationships`
- Documents: Each person/update is a document
- Real-time listeners: Automatically sync changes
- Queries: Filter, sort, paginate

**Data Structure:**
```
firestore/
  ├── people/
  │   ├── {personId}/
  │   │   ├── name: "John Doe"
  │   │   ├── birthDate: "1990-01-01"
  │   │   ├── parentIds: ["uuid1", "uuid2"]
  │   │   └── ...
  │   └── ...
  ├── updates/
  │   ├── {updateId}/
  │   │   ├── personId: "uuid"
  │   │   ├── title: "Birthday"
  │   │   ├── photoUrl: "https://..."
  │   │   └── ...
  │   └── ...
  └── relationships/
      └── (stored as fields in people documents)
```

**Implementation:**
- Create `services/firestore/firestore-service.ts`
- Replace `FamilyTreeService` methods to call Firestore
- Add real-time listeners for sync

---

### 3. Firebase Storage (File Upload) 📋 To Implement

**What it does:**
- Stores photos (person photos, update photos)
- Generates URLs for images
- Handles upload/download

**How it works:**
- Upload photo → Get download URL
- Store URL in Firestore document
- Images served via CDN

**Implementation:**
- Create `services/storage/firebase-storage-service.ts`
- Handle photo uploads in `AddPersonModal`, `AddUpdateModal`
- Replace local photo URLs with Firebase Storage URLs

---

## Integration Approach

### Step 1: Service Layer Pattern

**Current Structure:**
```
services/
  ├── auth/
  │   ├── types.ts (interfaces)
  │   ├── firebase-auth-service.ts (Firebase implementation)
  │   └── index.ts (exports)
  ├── family-tree-service.ts (currently uses Zustand store)
```

**After Firebase Integration:**
```
services/
  ├── auth/
  │   ├── types.ts
  │   ├── firebase-auth-service.ts ✅ (Firebase Auth)
  │   └── index.ts
  ├── firestore/
  │   ├── firestore-service.ts (Firestore operations)
  │   ├── firestore-config.ts (Firestore config)
  │   └── collections.ts (collection names, helpers)
  ├── storage/
  │   ├── firebase-storage-service.ts (file uploads)
  │   └── storage-config.ts
  └── family-tree-service.ts (calls Firestore + Storage)
```

### Step 2: Update FamilyTreeService

**Before (Current):**
```typescript
// services/family-tree-service.ts
addPerson(data) {
  // Direct store call
  return useFamilyTreeStore.getState().addPerson(data);
}
```

**After (Firebase):**
```typescript
// services/family-tree-service.ts
async addPerson(data) {
  // 1. Optimistically update local store
  const id = useFamilyTreeStore.getState().addPerson(data);
  
  // 2. Upload photo to Firebase Storage (if provided)
  let photoUrl = data.photoUrl;
  if (data.photoFile) {
    photoUrl = await firebaseStorageService.uploadPhoto(data.photoFile);
  }
  
  // 3. Save to Firestore
  await firestoreService.addPerson({
    ...data,
    id,
    photoUrl,
    createdAt: Date.now(),
    createdBy: getCurrentUserId(),
  });
  
  // 4. Firestore listener will sync back to store automatically
  return id;
}
```

### Step 3: Real-Time Sync

**Firestore automatically syncs changes!**

```typescript
// services/firestore/firestore-service.ts
export function setupRealtimeSync() {
  // Listen to people collection
  firestore.collection('people').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        // Update Zustand store
        useFamilyTreeStore.getState().syncPerson(change.doc.data());
      } else if (change.type === 'removed') {
        // Remove from store
        useFamilyTreeStore.getState().removePerson(change.doc.id);
      }
    });
  });
  
  // Same for updates collection
  firestore.collection('updates').onSnapshot(...);
}
```

**Benefits:**
- No WebSocket server needed!
- Automatic conflict resolution
- Offline support built-in
- Real-time updates across all devices

---

## SSO Setup (Firebase Auth)

### Why SSO is Easier with Firebase

Firebase Auth handles all the OAuth complexity for you:

1. **Google Sign-In**: Just enable in Firebase Console → Works automatically
2. **Microsoft Sign-In**: Enable Azure AD provider → Works automatically
3. **Apple Sign-In**: Enable Apple provider → Works automatically
4. **Slack Sign-In**: Enable Slack provider → Works automatically

**No need to:**
- Set up OAuth redirect URLs
- Handle token exchange
- Manage refresh tokens
- Store secrets (Firebase handles it)

### Setup Steps

1. **Firebase Console** → Authentication → Sign-in methods
2. **Enable each provider**:
   - Google: Just click "Enable" (uses Google Cloud project)
   - Microsoft: Add Azure AD app credentials
   - Apple: Add Apple Developer credentials
   - Slack: Add Slack app credentials
3. **Configure OAuth redirect URLs** (Firebase provides these)
4. **Install Firebase SDK** in app
5. **Use Firebase Auth SDK** in `firebase-auth-service.ts`

### Code Example

```typescript
// services/auth/firebase-auth-service.ts
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

async signInWithProvider(provider: AuthProvider): Promise<AuthSession> {
  const auth = getAuth();
  
  let firebaseProvider;
  switch (provider) {
    case 'google':
      firebaseProvider = new GoogleAuthProvider();
      break;
    case 'microsoft':
      firebaseProvider = new OAuthProvider('microsoft.com');
      break;
    // ... etc
  }
  
  // Firebase handles all OAuth flow!
  const result = await signInWithPopup(auth, firebaseProvider);
  
  // Convert to our format
  return {
    user: {
      id: result.user.uid,
      email: result.user.email,
      name: result.user.displayName,
      photoUrl: result.user.photoURL,
    },
    // Firebase manages tokens internally
  };
}
```

---

## Database Structure (Firestore)

### Collections

#### `people` Collection
```typescript
{
  id: "uuid",
  name: "John Doe",
  photoUrl: "https://storage...",
  birthDate: "1990-01-01",
  deathDate: null,
  gender: "male",
  bio: "Bio text",
  phoneNumber: "+1234567890",
  parentIds: ["uuid1", "uuid2"],
  childIds: ["uuid3"],
  spouseIds: ["uuid4"],
  siblingIds: ["uuid5"],
  createdAt: 1234567890,
  updatedAt: 1234567890,
  createdBy: "user-uuid",
  updatedBy: "user-uuid",
  version: 1
}
```

#### `updates` Collection
```typescript
{
  id: "uuid",
  personId: "uuid", // Creator
  title: "Birthday",
  photoUrl: "https://storage...",
  caption: "Happy birthday @person-uuid",
  isPublic: true,
  taggedPersonIds: ["uuid1", "uuid2"],
  createdAt: 1234567890
}
```

#### `relationships` Collection (Optional - can be derived from people)
```typescript
{
  id: "uuid",
  personId: "uuid1",
  relatedPersonId: "uuid2",
  relationshipType: "parent" | "spouse" | "child" | "sibling",
  createdAt: 1234567890
}
```

### Security Rules

**Firestore Security Rules** (set in Firebase Console):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // People: Users can read all, write their own or family members
    match /people/{personId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.uid == resource.data.createdBy || 
         isFamilyMember(request.auth.uid));
    }
    
    // Updates: Users can read public or family updates, write their own
    match /updates/{updateId} {
      allow read: if request.auth != null && 
        (resource.data.isPublic || isFamilyMember(request.auth.uid));
      allow write: if request.auth != null && 
        request.auth.uid == request.resource.data.personId;
    }
  }
  
  function isFamilyMember(userId) {
    // Check if user is in same family tree
    // Implementation depends on your family tree structure
    return exists(/databases/$(database)/documents/people/$(userId));
  }
}
```

---

## Implementation Checklist

### Phase 1: Firebase Setup
- [ ] Create Firebase project
- [ ] Install Firebase SDK (`npm install firebase`)
- [ ] Add Firebase config to app
- [ ] Set up Firebase Auth providers (Google, Microsoft, Apple, Slack)

### Phase 2: Auth Integration
- [ ] Complete `firebase-auth-service.ts` implementation
- [ ] Test SSO sign-in flows
- [ ] Test email/password sign-in
- [ ] Verify session persistence

### Phase 3: Firestore Integration
- [ ] Create Firestore collections (people, updates)
- [ ] Implement `firestore-service.ts`
- [ ] Set up real-time listeners
- [ ] Update `FamilyTreeService` to use Firestore
- [ ] Test CRUD operations
- [ ] Test real-time sync

### Phase 4: Storage Integration
- [ ] Set up Firebase Storage buckets
- [ ] Implement `firebase-storage-service.ts`
- [ ] Update photo upload flows
- [ ] Test photo upload/download

### Phase 5: Security & Rules
- [ ] Write Firestore security rules
- [ ] Write Storage security rules
- [ ] Test permissions
- [ ] Test unauthorized access prevention

### Phase 6: Offline Support
- [ ] Enable Firestore offline persistence
- [ ] Test offline operations
- [ ] Test sync when online

---

## Key Differences: Firebase vs Custom Backend

### Firebase Advantages
- ✅ **No backend server needed** - SDK runs in frontend
- ✅ **Real-time sync built-in** - No WebSocket server needed
- ✅ **Offline support** - Automatic caching and sync
- ✅ **Scalable** - Google handles scaling
- ✅ **SSO easier** - Firebase handles OAuth complexity
- ✅ **Security rules** - Declarative permissions

### Firebase Considerations
- ⚠️ **Vendor lock-in** - Harder to migrate later
- ⚠️ **Cost** - Pay per usage (can get expensive at scale)
- ⚠️ **Less control** - Can't customize backend logic easily
- ⚠️ **Learning curve** - Firestore queries different from SQL

### When to Use Firebase
- ✅ **Perfect for**: MVP, rapid prototyping, real-time collaboration
- ✅ **Good for**: Mobile apps, small to medium scale
- ⚠️ **Consider alternatives**: Large scale, complex queries, need SQL

---

## Migration Path

### Current State (Local Store)
```
Component → FamilyTreeService → Zustand Store (local)
```

### After Firebase (Hybrid)
```
Component → FamilyTreeService → Firestore (cloud) + Zustand Store (local cache)
                                    ↓
                            Real-time sync back to store
```

### Benefits
- **Optimistic updates**: Update store immediately, sync to Firestore
- **Offline support**: Store works offline, syncs when online
- **Real-time**: Changes from other users sync automatically
- **No breaking changes**: Components don't need to change!

---

## Next Steps

1. **Set up Firebase project** at https://console.firebase.google.com
2. **Install Firebase SDK**: `npm install firebase` or `expo install firebase`
3. **Complete Auth implementation** in `firebase-auth-service.ts`
4. **Create Firestore service** for database operations
5. **Create Storage service** for file uploads
6. **Update FamilyTreeService** to use Firebase services
7. **Test end-to-end** with real Firebase project

---

## Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **Firebase Auth**: https://firebase.google.com/docs/auth
- **Firestore**: https://firebase.google.com/docs/firestore
- **Firebase Storage**: https://firebase.google.com/docs/storage
- **Expo Firebase**: https://docs.expo.dev/guides/using-firebase/

---

## Summary

**Firebase = No Separate Backend Needed!**

- Firebase SDK runs in your React Native app
- Firebase services (Auth, Firestore, Storage) are accessed directly from frontend
- Real-time sync happens automatically via Firestore listeners
- SSO is easier because Firebase handles OAuth complexity
- You just need to:
  1. Set up Firebase project
  2. Install SDK
  3. Implement service layer to call Firebase APIs
  4. Update `FamilyTreeService` to use Firebase instead of local store

**No separate backend folder needed** - Firebase IS your backend!

