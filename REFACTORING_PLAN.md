# Refactoring Plan: Separation of Concerns

## 📋 Overview

This document outlines an incremental refactoring plan to improve separation of concerns, reduce complexity, and prevent race conditions. Each step is designed to be tested independently before moving to the next.

---

## 🔍 Current State Analysis

### 1. Auth Context Overload (`contexts/auth-context.tsx` - 452 lines)

**Current Responsibilities:**
- ✅ Session management (lines 29-169)
- ❌ Statsig user identity sync (lines 80-120) - **Should be separate**
- ❌ Profile checking/loading (lines 171-279) - **Should be separate**
- ❌ Family tree syncing (lines 206-229) - **Should be separate**
- ❌ Routing guards (lines 281-329) - **Could be cleaner**

**Dependencies:**
- `useFamilyTreeStore` - for ego management and sync
- `getUserProfile` from `@/services/supabase/people-api`
- `useStatsigClient` from `@statsig/expo-bindings`
- `useRouter`, `useSegments` from `expo-router`

**Race Condition Risks:**
- Multiple profile checks can run simultaneously (guarded by `profileCheckRef`)
- Sync can be called multiple times (guarded by `syncFamilyTreeDoneRef`)
- Routing decisions can be made multiple times (guarded by `initialRoutingDoneRef`)

---

### 2. Store Mixed Concerns (`stores/family-tree-store.ts` - 975 lines)

**Current Responsibilities:**
- Person CRUD (lines 446-509)
- Relationship management (lines 511-878)
- Update/post management (lines 234-444)
- Sync logic (lines 910-972)
- Navigation state (egoId) (lines 25, 106, 137-144, 178-184)

**Dependencies:**
- `createRelative`, `getAllPeople` from `@/services/supabase/people-api`
- `createRelationship` from `@/services/supabase/relationships-api`
- `createUpdate`, `deleteUpdate`, `getAllUpdates` from `@/services/supabase/updates-api`

**Race Condition Risks:**
- `isSyncing` flag prevents concurrent syncs (line 16, 912-917)
- Optimistic updates can conflict with sync results
- Multiple relationship additions can create inconsistent state

---

### 3. API Layer Duplication (`services/supabase/*.ts`)

**Duplicated Patterns:**

1. **Photo Upload Logic:**
   - `people-api.ts`: Lines 133-158 (createEgoProfile), 274-300 (updateEgoProfile), 400-421 (createRelative)
   - `updates-api.ts`: Lines 82-109 (createUpdate)
   - **Pattern:** Check if `photoUrl?.startsWith('file://')`, then call `uploadImage()`

2. **Row-to-Model Mapping:**
   - `people-api.ts`: Lines 76-106 (getUserProfile), 209-239 (createEgoProfile), 349-378 (updateEgoProfile), 454-482 (createRelative), 602-628 (getAllPeople)
   - `updates-api.ts`: Lines 163-178 (createUpdate), 234-248 (getUpdatesForPerson), 304-318 (getAllUpdates)
   - **Pattern:** Map database row fields (snake_case) to TypeScript types (camelCase)

3. **Error Handling:**
   - Partially centralized in `@/utils/supabase-error-handler`
   - But some error handling still duplicated across files

---

## 🎯 Target Architecture

### Contexts Structure
```
contexts/
├── auth-context.tsx           # Only session + isAuthenticated
├── profile-context.tsx        # Profile loading + ego management
├── analytics-context.tsx      # Statsig identity sync
└── guards/
    └── auth-guard.tsx         # Route protection component
```

### Stores Structure
```
stores/
├── people-store.ts           # Person CRUD operations
├── relationships-store.ts    # Relationship management
├── updates-store.ts          # Updates/posts management
└── session-store.ts          # Session state (egoId, sync logic)
```

### Services Structure
```
services/supabase/
├── shared/
│   ├── photo-upload.ts       # Centralized photo upload logic
│   └── mappers.ts            # Row-to-model mapping functions
├── people-api.ts             # Uses shared utilities
├── updates-api.ts            # Uses shared utilities
└── relationships-api.ts      # (no changes needed)
```

---

## 📝 Incremental Refactoring Steps

### Phase 1: Extract Shared API Utilities (Low Risk)

**Goal:** Remove duplication in API layer without changing behavior.

**Steps:**
1. Create `services/supabase/shared/photo-upload.ts`
   - Extract `uploadPhotoIfLocal()` function
   - Handle `file://` URI detection and upload
   - Return `string | null`

2. Create `services/supabase/shared/mappers.ts`
   - Extract `mapPersonRow(row: PeopleRow): Person`
   - Extract `mapUpdateRow(row: UpdatesRow): Update`
   - Handle optional fields and type conversions

3. Refactor `people-api.ts`
   - Replace photo upload logic with `uploadPhotoIfLocal()`
   - Replace row mapping with `mapPersonRow()`
   - Test: Create profile, update profile, create relative

4. Refactor `updates-api.ts`
   - Replace photo upload logic with `uploadPhotoIfLocal()`
   - Replace row mapping with `mapUpdateRow()`
   - Test: Create update, fetch updates

**Validation:**
- ✅ All existing tests pass
- ✅ No behavior changes
- ✅ Photo uploads still work
- ✅ Data mapping still correct

**Risk Level:** Low (pure extraction, no logic changes)

---

### Phase 2: Extract Analytics Context (Medium Risk)

**Goal:** Move Statsig identity sync out of AuthContext.

**Steps:**
1. Create `contexts/analytics-context.tsx`
   - Move Statsig user identity sync logic (lines 80-120 from auth-context)
   - Subscribe to auth session changes
   - Handle `updateUserAsync()` and event logging

2. Update `app/_layout.tsx`
   - Wrap `AnalyticsProvider` around `AuthProvider`
   - Ensure StatsigProvider is still above both

3. Update `contexts/auth-context.tsx`
   - Remove Statsig logic (lines 44, 80-120, 375-387)
   - Remove `useStatsigClient` import
   - Keep session management only

4. Test authentication flow
   - Sign in → verify Statsig user updated
   - Sign out → verify Statsig user demoted to guest
   - Check event logging still works

**Validation:**
- ✅ Statsig identity sync still works
- ✅ Auth flow unchanged
- ✅ No race conditions introduced

**Risk Level:** Medium (affects telemetry, but isolated)

---

### Phase 3: Extract Profile Context (Medium Risk)

**Goal:** Move profile checking/loading out of AuthContext.

**Steps:**
1. Create `contexts/profile-context.tsx`
   - Move profile checking logic (lines 171-279 from auth-context)
   - Handle `getUserProfile()` and `loadEgo()`
   - Manage `isCheckingProfile` state

2. Create `contexts/profile-context.tsx` (continued)
   - Move family tree sync logic (lines 206-229)
   - Keep sync guards to prevent race conditions
   - Expose `profile` and `isLoadingProfile` state

3. Update `contexts/auth-context.tsx`
   - Remove profile checking logic
   - Remove `getUserProfile` import
   - Remove `isCheckingProfile` state
   - Keep only session management

4. Update routing logic
   - Move initial routing decision to ProfileContext
   - AuthContext only handles unauthenticated redirects

5. Test profile loading
   - New user → onboarding flow
   - Returning user → tabs navigation
   - Profile loading states

**Validation:**
- ✅ Profile loading still works
- ✅ Routing decisions still correct
- ✅ No duplicate profile checks
- ✅ Sync still runs once per session

**Risk Level:** Medium (affects routing, needs careful testing)

---

### Phase 4: Extract Auth Guard Component (Low Risk)

**Goal:** Clean up routing guard logic.

**Steps:**
1. Create `contexts/guards/auth-guard.tsx`
   - Extract routing guard logic (lines 281-329 from auth-context)
   - Component that wraps protected routes
   - Handles unauthenticated redirects

2. Update `app/_layout.tsx` or route files
   - Use `<AuthGuard>` component where needed
   - Remove routing logic from AuthContext

3. Update `contexts/auth-context.tsx`
   - Remove routing guard useEffect
   - Remove `useSegments` import
   - Keep only session state

**Validation:**
- ✅ Unauthenticated users redirected to login
- ✅ Authenticated users can access tabs
- ✅ No navigation loops

**Risk Level:** Low (isolated to routing)

---

### Phase 5: Split Family Tree Store (High Risk)

**Goal:** Split monolithic store into focused stores.

**Steps:**
1. Create `stores/people-store.ts`
   - Extract person CRUD operations
   - Move `people` Map and related methods
   - Keep `getPerson()`, `addPerson()`, etc.

2. Create `stores/relationships-store.ts`
   - Extract relationship management
   - Move `addParent()`, `addSpouse()`, `addChild()`, `addSibling()`
   - Move `getSiblings()`, `countAncestors()`, `countDescendants()`

3. Create `stores/updates-store.ts`
   - Extract update/post management
   - Move `updates` Map and related methods
   - Move `addUpdate()`, `deleteUpdate()`, `getUpdatesForPerson()`, etc.

4. Create `stores/session-store.ts`
   - Extract session state (egoId)
   - Move `loadEgo()`, `clearEgo()`, `getEgo()`, `updateEgo()`
   - Move `syncFamilyTree()` logic
   - Keep sync guards to prevent race conditions

5. Update all imports
   - Find all `useFamilyTreeStore` usages
   - Update to use appropriate store
   - Test each component

6. Remove old store
   - Delete `stores/family-tree-store.ts`
   - Verify no remaining imports

**Validation:**
- ✅ All components still work
- ✅ No broken imports
- ✅ Store operations still functional
- ✅ Sync still works correctly

**Risk Level:** High (touches many files, needs comprehensive testing)

---

## 🔒 Race Condition Prevention

### Current Guards
1. **Profile Check:** `profileCheckRef` prevents concurrent profile checks
2. **Sync:** `syncFamilyTreeDoneRef` prevents duplicate syncs
3. **Routing:** `initialRoutingDoneRef` prevents duplicate navigation
4. **Store Sync:** `isSyncing` flag prevents concurrent syncs

### Refactored Guards
- **ProfileContext:** Keep `profileCheckRef` and `syncFamilyTreeDoneRef`
- **SessionStore:** Keep `isSyncing` flag
- **AuthGuard:** Keep `initialRoutingDoneRef` (or move to ProfileContext)

### Testing Checklist
- [ ] Sign in → profile loads once
- [ ] Sign in → sync runs once
- [ ] Sign in → navigation happens once
- [ ] Multiple rapid sign-ins → no duplicate operations
- [ ] Sign out → all state cleared
- [ ] App restart → state loads correctly

---

## 📊 Dependency Map

### AuthContext Dependencies
```
auth-context.tsx
├── useFamilyTreeStore (ego management, sync)
├── getUserProfile (profile API)
├── useStatsigClient (analytics)
├── useRouter, useSegments (routing)
└── getAuthService (session management)
```

### FamilyTreeStore Dependencies
```
family-tree-store.ts
├── createRelative, getAllPeople (people API)
├── createRelationship (relationships API)
├── createUpdate, deleteUpdate, getAllUpdates (updates API)
└── uuid (ID generation)
```

### Component Dependencies
```
Components using useFamilyTreeStore:
├── app/(tabs)/index.tsx
├── app/(tabs)/profile.tsx
├── app/person/[personId].tsx
├── app/(tabs)/_layout.tsx
└── (various components)
```

---

## ✅ Success Criteria

1. **Code Quality:**
   - No file over 500 lines
   - Clear separation of concerns
   - No duplicated logic

2. **Functionality:**
   - All existing features work
   - No regressions
   - Performance maintained or improved

3. **Race Conditions:**
   - No duplicate operations
   - Guards prevent concurrent execution
   - State remains consistent

4. **Testability:**
   - Each context/store can be tested independently
   - Mock dependencies easily
   - Clear interfaces

---

## 🚦 Execution Order

1. **Phase 1** (Shared API Utilities) - Start here, lowest risk
2. **Phase 2** (Analytics Context) - Isolated, medium risk
3. **Phase 4** (Auth Guard) - Simple extraction, low risk
4. **Phase 3** (Profile Context) - More complex, medium risk
5. **Phase 5** (Store Split) - Most complex, high risk, do last

---

## 📝 Notes

- Test after each phase before moving to next
- Keep old code commented out initially (remove after validation)
- Update imports incrementally
- Document any new race conditions discovered
- Update this plan as we learn from each phase
