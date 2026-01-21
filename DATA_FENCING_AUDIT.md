# Data Fencing Audit Report

## Executive Summary

This audit examines potential data fencing issues where backend data is being fetched and stored in the frontend. The audit identified several areas where **all data is loaded into memory without proper pagination, filtering, or access controls at the frontend level**.

## Critical Findings

### 🔴 HIGH RISK: Complete Data Fetching

#### 1. **People Data - Complete Database Fetch**
**Location:** `services/supabase/people-api.ts::getAllPeople()`

**Issue:**
- Fetches **ALL people** from database using `.select('*')`
- Fetches **ALL relationships** from database using `.select('*')`
- No pagination - entire dataset loaded at once
- All data stored in memory (React Query cache + Zustand store)

**Code:**
```typescript
// Line 456-459: Fetches ALL people
const [peopleResponse, relationshipsResponse] = await Promise.all([
  supabase
    .from('people')
    .select('*') // ⚠️ Selects ALL fields from ALL people
    .order('created_at', { ascending: true }),
  supabase.from('relationships').select('*'), // ⚠️ Selects ALL relationships
]);
```

**Security Concerns:**
- Blocked users are fetched but converted to placeholders **only at mapper level** (line 560-573)
- All sensitive data (names, photos, bios, phone numbers) loaded into memory even for blocked users
- No frontend-level access control - relies entirely on backend RLS policies
- Data persists in React Query cache (in-memory) and Zustand store

**Storage Locations:**
- React Query cache: `queryKey: ['people', userId]` (via `usePeople()` hook)
- Zustand store: `usePeopleStore.getState().people` (Map<string, Person>)
- Both stores hold complete dataset in memory

---

#### 2. **Updates/Posts Data - Complete Database Fetch**
**Location:** `services/supabase/updates-api.ts::getAllUpdates()`

**Issue:**
- Fetches **ALL updates** from database using `.select('*')`
- Fetches **ALL update_tags** for all updates
- No pagination - entire dataset loaded at once
- Filtering happens **after** fetch in JavaScript (line 334-354), not at database level

**Code:**
```typescript
// Line 275-276: Fetches ALL updates
const { data: updatesData, error: updatesError } = await query
  .from('updates')
  .select('*') // ⚠️ Selects ALL updates from ALL users
  .order('created_at', { ascending: false });

// Line 303-305: Fetches ALL tags
const { data: tagsData, error: tagsError } = await supabase
  .from('update_tags')
  .select('*')
  .in('update_id', updateIds);
```

**Security Concerns:**
- Deleted users' updates are filtered in JavaScript **after** fetch (line 332-354)
- Blocked users' updates are filtered in JavaScript **after** fetch
- All photo URLs and captions loaded into memory even if later filtered
- No pagination - performance issue for large families

**Storage Locations:**
- React Query cache: `queryKey: ['updates', userId]` (via `useUpdates()` hook)
- Zustand store: `useUpdatesStore.getState().updates` (Map<string, Update>)

---

#### 3. **Relationships Data - Complete Fetch**
**Location:** `services/supabase/relationships-api.ts::getAllRelationships()`

**Issue:**
- Fetches **ALL relationships** from database
- Called implicitly via `getAllPeople()` (line 459 in people-api.ts)
- No separate storage, but all relationships loaded into memory during people fetch

**Security Concerns:**
- All relationship data exposed in memory
- Relationships include person IDs that could reveal blocked users

---

### 🟡 MEDIUM RISK: Client-Side Data Storage

#### 4. **React Query Cache - In-Memory Storage**
**Location:** Multiple hooks (`hooks/use-people.ts`, `hooks/use-updates.ts`)

**Issue:**
- All data cached in React Query's in-memory cache
- Cache persists across component unmounts (until manual invalidation)
- Stale time: 60 seconds (line 42 in use-people.ts, line 38 in use-updates.ts)
- No encryption or secure storage

**Storage:**
- React Query maintains separate cache entries:
  - `['people', userId]` → `Person[]`
  - `['updates', userId]` → `Update[]`
  - `['relationships', userId]` → `Relationship[]`

---

#### 5. **Zustand Stores - In-Memory Storage**
**Location:** `stores/people-store.ts`, `stores/updates-store.ts`, `stores/relationships-store.ts`

**Issue:**
- Zustand stores maintain complete dataset in memory
- Stores are global state - accessible from anywhere in the app
- Migration from Zustand to React Query is **in progress** (see `STATE_MANAGEMENT_ANALYSIS.md`)
- Dual storage during migration increases memory footprint

**Current State:**
- Both React Query AND Zustand store data simultaneously
- Data synchronization handled manually (see `usePeople()` hook comments)

---

#### 6. **Session Store - Ego and Sync State**
**Location:** `stores/session-store.ts::syncFamilyTree()`

**Issue:**
- `syncFamilyTree()` method calls `getAllPeople()` and `getAllUpdates()` (line 174-175)
- Loads entire dataset on app initialization
- Data persists until explicit logout (`clearEgo()`)

**Code:**
```typescript
// Line 174-175: Loads ALL data on sync
usePeopleStore.getState().setPeople(peopleFromBackend);
useUpdatesStore.getState().setUpdates(updatesFromBackend);
```

---

### 🟢 LOW RISK: Filtering Mechanisms

#### 7. **Blocked Users - Presentation-Level Filtering**

**Implementation:**
- Blocked users are fetched from database but converted to placeholders
- Mapper function (`mapPersonRow()`) checks `blockedUserIds` and creates placeholders
- Placeholders have empty names but maintain relationship integrity

**Location:** `services/supabase/shared/mappers.ts` (referenced in people-api.ts line 565)

**Concern:**
- Original data still exists in memory before mapping
- Blocked user data is accessible before placeholder conversion
- Should ideally filter at database level using RLS policies

---

## Recommendations

### Immediate Actions (High Priority)

1. **Implement Database-Level Filtering**
   - Use Supabase RLS policies to filter blocked users at database level
   - Don't fetch blocked users' data at all - filter in SQL query
   - Reduces data transferred and stored in memory

2. **Add Pagination**
   - Implement paginated queries for people and updates
   - Load data on-demand as user scrolls/explores
   - Reduces initial load time and memory footprint

3. **Implement Field-Level Access Control**
   - Only fetch fields that user has permission to see
   - Use database views or RLS policies to limit fields
   - Don't fetch sensitive data (phone numbers, etc.) for blocked users

### Short-Term Improvements (Medium Priority)

4. **Remove Dual Storage**
   - Complete migration from Zustand to React Query
   - Eliminate duplicate data storage
   - Reduces memory usage and sync complexity

5. **Add Data Encryption**
   - Encrypt sensitive data (phone numbers, personal info) in memory
   - Use secure storage for cached data
   - Implement data-at-rest encryption

6. **Implement Data Cleanup**
   - Clear React Query cache on logout
   - Remove Zustand store data on logout
   - Add automatic cache expiration for inactive users

### Long-Term Enhancements (Low Priority)

7. **Implement Incremental Sync**
   - Only fetch data that changed since last sync
   - Use database change tracking (e.g., `updated_at` timestamps)
   - Reduce network traffic and memory usage

8. **Add Data Validation**
   - Validate data before storing in frontend
   - Verify user permissions before displaying data
   - Add runtime checks for data integrity

9. **Implement Secure Storage**
   - Move sensitive data to encrypted storage (AsyncStorage with encryption)
   - Use keychain/keystore for authentication tokens
   - Implement secure data transmission (already using HTTPS)

---

## Data Flow Diagram

```
Backend (Supabase)
    ↓
[getAllPeople()] → Fetches ALL people with .select('*')
    ↓
[getAllUpdates()] → Fetches ALL updates with .select('*')
    ↓
[getAllRelationships()] → Fetches ALL relationships
    ↓
Frontend (React Query Cache)
    ↓
- ['people', userId] → Person[] (ALL people)
- ['updates', userId] → Update[] (ALL updates)
- ['relationships', userId] → Relationship[] (ALL relationships)
    ↓
Frontend (Zustand Stores) [DEPRECATED, being migrated]
    ↓
- usePeopleStore.people → Map<string, Person>
- useUpdatesStore.updates → Map<string, Update>
    ↓
Components
    ↓
- Filtered/displayed to user (blocked users shown as placeholders)
```

---

## Files Affected

### Core Data Fetching
- `services/supabase/people-api.ts` - `getAllPeople()` (line 441-576)
- `services/supabase/updates-api.ts` - `getAllUpdates()` (line 249-357)
- `services/supabase/relationships-api.ts` - `getAllRelationships()` (line 178+)

### State Management
- `hooks/use-people.ts` - React Query hook for people (line 31-44)
- `hooks/use-updates.ts` - React Query hook for updates (line 27-39)
- `stores/people-store.ts` - Zustand store for people (DEPRECATED)
- `stores/updates-store.ts` - Zustand store for updates (DEPRECATED)
- `stores/session-store.ts` - Session sync (line 150-176)

### Data Display
- `app/(tabs)/index.tsx` - Uses `usePeople()` (line 224)
- `app/(tabs)/family.tsx` - Uses `useUpdates()` and `usePeople()`
- `app/(tabs)/profile.tsx` - Uses `usePeople()` (line 75)
- All components that display people/updates data

---

## Compliance Considerations

### COPPA Compliance
- User data (including birth dates) is stored in memory
- Placeholders for COPPA-deleted users are handled but original data may persist in cache
- Recommendation: Ensure cache is cleared immediately when COPPA deletion is detected

### GDPR Compliance
- Right to be forgotten: Data may persist in frontend cache after deletion request
- Data minimization: More data is fetched than necessary
- Recommendation: Implement automatic cache invalidation on user deletion

### Privacy
- Phone numbers stored in memory for all users (including blocked users)
- Personal photos and bios stored without encryption
- Recommendation: Encrypt sensitive data or use secure storage

---

## Testing Recommendations

1. **Memory Profiling**
   - Profile memory usage with large datasets (1000+ people)
   - Test with multiple blocked users
   - Measure cache size over time

2. **Security Testing**
   - Verify blocked users' data is not accessible via console/debugger
   - Test data cleanup on logout
   - Verify cache invalidation on user deletion

3. **Performance Testing**
   - Measure initial load time with large datasets
   - Test pagination implementation
   - Benchmark memory usage before/after pagination

---

## Conclusion

The current implementation loads **all data into frontend memory** without pagination or database-level filtering. While backend RLS policies provide security, the frontend fetches more data than necessary and stores it in multiple locations (React Query + Zustand).

**Priority:** High - Immediate attention recommended for database-level filtering and pagination.

**Risk Level:** Medium-High - Data is accessible in memory but protected by backend RLS and presentation-level filtering.

**Next Steps:**
1. Implement database-level filtering for blocked users
2. Add pagination to data fetching
3. Complete Zustand → React Query migration
4. Add data cleanup on logout