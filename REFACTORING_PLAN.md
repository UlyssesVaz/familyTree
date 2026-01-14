# Refactoring Plan: Separation of Concerns

## 📋 Overview

This document outlines an incremental refactoring plan to improve separation of concerns, reduce complexity, and prevent race conditions. Each step is designed to be tested independently before moving to the next.

## 🎯 Current Status: 80% Complete

**✅ Completed (4/5 phases):**
- Phase 1: Shared API Utilities
- Phase 2: Analytics Context
- Phase 3: Profile Context
- Phase 4: Auth Guard

**🔄 Next Phase:**
- Phase 5: Split Family Tree Store (High Risk)

**📊 Impact:**
- AuthContext: 452 lines → 172 lines (62% reduction)
- Created 3 new focused contexts
- Eliminated code duplication in API layer
- Clear separation of concerns achieved

---

## 🔍 Current State Analysis

### ✅ Completed Refactoring

**Phase 1: Shared API Utilities** ✅
- Created `services/supabase/shared/photo-upload.ts`
- Created `services/supabase/shared/mappers.ts`
- Refactored `people-api.ts` and `updates-api.ts` to use shared utilities

**Phase 2: Analytics Context** ✅
- Created `contexts/analytics-context.tsx`
- Moved Statsig identity sync out of AuthContext
- AuthContext reduced from 452 lines to ~172 lines

**Phase 3: Profile Context** ✅
- Created `contexts/profile-context.tsx`
- Moved profile checking, family tree sync, and initial routing decisions
- AuthContext now focuses solely on session management

**Phase 4: Auth Guard** ✅
- Created `contexts/guards/auth-guard.tsx`
- Extracted routing guard logic from AuthContext
- Clean separation of route protection

### Current Architecture

**Contexts:**
- `auth-context.tsx` (~172 lines) - ✅ Session management only
- `analytics-context.tsx` - ✅ Statsig identity sync
- `profile-context.tsx` - ✅ Profile loading, ego management, family tree sync, initial routing
- `guards/auth-guard.tsx` - ✅ Route protection

**Remaining Work:**
- Phase 5: Split Family Tree Store (High Risk) - **Next Phase**

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

### Phase 1: Extract Shared API Utilities (Low Risk) ✅ COMPLETE

**Goal:** Remove duplication in API layer without changing behavior.

**Status:** ✅ Completed
- Created `services/supabase/shared/photo-upload.ts`
- Created `services/supabase/shared/mappers.ts`
- Refactored `people-api.ts` to use shared utilities
- Refactored `updates-api.ts` to use shared utilities

**Results:**
- ✅ Photo uploads still work
- ✅ Data mapping still correct
- ✅ No behavior changes
- ✅ Code duplication eliminated

**Risk Level:** Low (pure extraction, no logic changes)

---

### Phase 2: Extract Analytics Context (Medium Risk) ✅ COMPLETE

**Goal:** Move Statsig identity sync out of AuthContext.

**Status:** ✅ Completed
- Created `contexts/analytics-context.tsx`
- Moved Statsig user identity sync logic
- Updated `app/_layout.tsx` to include AnalyticsProvider
- Removed Statsig logic from AuthContext

**Results:**
- ✅ Statsig identity sync still works
- ✅ Auth flow unchanged
- ✅ No duplicate Statsig updates (prevents duplicate logging)
- ✅ AuthContext reduced by ~30 lines

**Risk Level:** Medium (affects telemetry, but isolated)

---

### Phase 3: Extract Profile Context (Medium Risk) ✅ COMPLETE

**Goal:** Move profile checking/loading out of AuthContext.

**Status:** ✅ Completed
- Created `contexts/profile-context.tsx`
- Moved profile checking logic (~110 lines)
- Moved family tree sync logic
- Moved initial routing decisions
- Updated `app/_layout.tsx` to include ProfileProvider
- Removed profile logic from AuthContext

**Results:**
- ✅ Profile loading still works
- ✅ Routing decisions still correct
- ✅ No duplicate profile checks
- ✅ Sync still runs once per session
- ✅ AuthContext reduced from ~342 lines to ~172 lines (50% reduction!)

**Risk Level:** Medium (affects routing, needs careful testing)

---

### Phase 4: Extract Auth Guard Component (Low Risk) ✅ COMPLETE

**Goal:** Clean up routing guard logic.

**Status:** ✅ Completed
- Created `contexts/guards/auth-guard.tsx`
- Extracted routing guard logic (~50 lines)
- Updated `app/_layout.tsx` to use AuthGuard component
- Removed routing guard logic from AuthContext

**Results:**
- ✅ Unauthenticated users redirected to login
- ✅ Authenticated users can access tabs
- ✅ No navigation loops
- ✅ Clean separation of route protection logic

**Risk Level:** Low (isolated to routing)

---

### Phase 5: Split Family Tree Store (High Risk) 🔄 NEXT

**Goal:** Split monolithic store into focused stores.

**📋 Comprehensive Audit:** See `PHASE5_AUDIT.md` for detailed analysis

**Current State:**
- `stores/family-tree-store.ts` - 975 lines
- Handles: Person CRUD, Relationships, Updates, Sync, Ego management
- **20 files** using the store (audited and documented)

**Target State:**
- `stores/people-store.ts` - Person CRUD operations
- `stores/relationships-store.ts` - Relationship management
- `stores/updates-store.ts` - Update/post management
- `stores/session-store.ts` - Ego state and sync logic

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

**Pre-Phase 5 Preparation:** ✅ COMPLETE
- [x] Audit all `useFamilyTreeStore` usages across codebase (20 files identified)
- [x] Document which methods are used where (see PHASE5_AUDIT.md)
- [x] Plan store dependencies (dependency graph documented)
- [x] Consider cross-store communication patterns (direct import pattern recommended)

**See:** `PHASE5_AUDIT.md` for comprehensive audit details

**Validation:**
- [ ] All components still work
- [ ] No broken imports
- [ ] Store operations still functional
- [ ] Sync still works correctly
- [ ] No performance regressions

**Risk Level:** High (touches 20 files, needs comprehensive testing)

**High Risk Areas:**
- `syncFamilyTree` - Complex method touching all stores
- `clearEgo` - Needs coordination across all stores
- Components using multiple stores (7 files)

**Estimated Effort:** 14-20 hours
- Store Creation: 4-6 hours
- Component Migration: 6-8 hours
- Testing & Debugging: 4-6 hours

**Estimated Impact:**
- **20 files** will need import updates (audited and documented)
- Store will be split into 4 focused stores (~200-300 lines each)
- Better testability and maintainability

**Audit Results Summary:**
- **PeopleStore:** 19 usages across 8 files
- **RelationshipsStore:** 14 usages across 2 files (depends on PeopleStore)
- **UpdatesStore:** 21 usages across 6 files (depends on PeopleStore)
- **SessionStore:** 21 usages across 8 files (depends on all 3 stores)

**Dependency Order:**
1. PeopleStore (base, no dependencies)
2. UpdatesStore & RelationshipsStore (depend on PeopleStore)
3. SessionStore (depends on all 3 stores)

**Cross-Store Communication:** Direct import pattern (simplest and most maintainable)

---

## 🔒 Race Condition Prevention

### Current Guards
1. **Profile Check:** `profileCheckRef` prevents concurrent profile checks
2. **Sync:** `syncFamilyTreeDoneRef` prevents duplicate syncs
3. **Routing:** `initialRoutingDoneRef` prevents duplicate navigation
4. **Store Sync:** `isSyncing` flag prevents concurrent syncs

### Refactored Guards (Current State)
- **ProfileContext:** ✅ `profileCheckRef`, `syncFamilyTreeDoneRef`, `initialRoutingDoneRef`
- **AuthGuard:** ✅ No refs needed (runs on every route change)
- **FamilyTreeStore:** ⏳ `isSyncing` flag (will move to SessionStore in Phase 5)

### Testing Checklist
- [x] Sign in → profile loads once ✅
- [x] Sign in → sync runs once ✅
- [x] Sign in → navigation happens once ✅
- [x] Multiple rapid sign-ins → no duplicate operations ✅
- [x] Sign out → all state cleared ✅
- [x] App restart → state loads correctly ✅
- [x] Statsig identity sync works ✅
- [x] Route protection works ✅

---

## 📊 Dependency Map

### Current Context Dependencies

**AuthContext:**
```
auth-context.tsx (~172 lines)
└── getAuthService (session management only)
```

**AnalyticsContext:**
```
analytics-context.tsx
├── useStatsigClient (Statsig SDK)
└── getAuthService (subscribe to session changes)
```

**ProfileContext:**
```
profile-context.tsx
├── useAuth (get session from AuthContext)
├── useFamilyTreeStore (ego management, sync)
├── getUserProfile (profile API)
└── useRouter (initial routing decisions)
```

**AuthGuard:**
```
auth-guard.tsx
├── useAuth (get session from AuthContext)
├── useFamilyTreeStore (check ego state)
└── useRouter, useSegments (route protection)
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

1. ✅ **Phase 1** (Shared API Utilities) - **COMPLETE** - Lowest risk
2. ✅ **Phase 2** (Analytics Context) - **COMPLETE** - Isolated, medium risk
3. ✅ **Phase 4** (Auth Guard) - **COMPLETE** - Simple extraction, low risk
4. ✅ **Phase 3** (Profile Context) - **COMPLETE** - More complex, medium risk
5. 🔄 **Phase 5** (Store Split) - **NEXT** - Most complex, high risk, do last

## 📈 Progress Summary

### Completed Phases: 4/5 (80%)

**Context Refactoring:** ✅ Complete
- AuthContext: 452 lines → 172 lines (62% reduction)
- AnalyticsContext: New (isolated Statsig logic)
- ProfileContext: New (isolated profile/routing logic)
- AuthGuard: New (isolated route protection)

**API Refactoring:** ✅ Complete
- Shared photo upload utility
- Shared mapper utilities
- Eliminated code duplication

**Remaining Work:**
- Phase 5: Split Family Tree Store (High Risk)
  - Split 975-line store into 4 focused stores
  - Update all component imports
  - Comprehensive testing required

---

## 📝 Notes

- Test after each phase before moving to next
- Keep old code commented out initially (remove after validation)
- Update imports incrementally
- Document any new race conditions discovered
- Update this plan as we learn from each phase
