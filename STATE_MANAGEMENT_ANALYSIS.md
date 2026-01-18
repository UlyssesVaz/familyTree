# State Management Analysis: Zustand vs React Query

## Overview

**React Query** and **Zustand** solve different problems:

### React Query (Server State)
- ✅ **Fetches** data from APIs/backends
- ✅ **Caches** server responses
- ✅ **Synchronizes** with server (refetch, invalidation)
- ✅ **Optimistic updates** with rollback
- ✅ **Loading/error states** for async operations
- ✅ **Background refetching** and cache management

### Zustand (Client State)
- ✅ **UI state** (modals, form inputs, selections)
- ✅ **Derived state** calculations
- ✅ **Non-persistent preferences** (theme, filters)
- ✅ **Cross-component state** that doesn't need server sync
- ✅ **Simple global state** that doesn't fit React Query patterns

## Current Migration Status

### ✅ Migrated to React Query (Server State)

1. **People/Person Data** (`usePeople`, `usePerson`)
   - ✅ Fetched from backend (`getAllPeople`)
   - ✅ Mutations with optimistic updates (`useAddPerson`, `useUpdatePerson`)
   - ✅ Automatic cache invalidation on mutations

2. **Updates/Posts** (`useUpdates`)
   - ✅ Fetched from backend (`getAllUpdates`)
   - ✅ Mutations: `useAddUpdate`, `useUpdateUpdate`, `useDeleteUpdate`, `useToggleUpdatePrivacy`
   - ✅ Cache invalidation on create/update/delete

3. **Blocked Users** (`useBlockedUsers`, `useBlockedUserIds`)
   - ✅ Fetched from backend (`getBlockedUsersWithInfo`)
   - ✅ Mutation: `useUnblockUser` with optimistic updates

4. **Relationships** (via people cache updates)
   - ✅ Mutations: `useAddParent`, `useAddSpouse`, `useAddChild`, `useAddSibling`
   - ✅ Updates `people` cache optimistically

5. **Session/Ego** (`useEgo`, `useEgoId`)
   - ✅ Derived from `people` data (finds person with matching `linkedAuthUserId`)
   - ✅ `useSyncFamilyTree` - fetches and caches all data

### 📋 Still Using Zustand (May Need Analysis)

1. **Session Store** (`stores/session-store.ts`)
   - `isSyncing` - Loading state for sync operation
   - `syncError` - Error state for sync failures
   - `deletionStatus` - Account deletion state
   - **Analysis**: These could move to React Query's `isLoading`/`error` states, but they're simple enough for Zustand

2. **Profile Context** (`contexts/profile-context.tsx`)
   - Uses `useSessionStore` for `isSyncing` and `deletionStatus`
   - **Analysis**: Could use React Query mutation states instead

## Recommendations

### ✅ Keep in React Query (Correctly Used)

- All server data fetching
- All mutations that modify server state
- Cache management and invalidation
- Optimistic updates

### 🤔 Consider Keeping in Zustand (Client State)

1. **UI State**
   - Modal open/close states
   - Form inputs
   - Selected filters (if not synced to URL)
   - Current tab/route selection

2. **Session Store** (`isSyncing`, `syncError`, `deletionStatus`)
   - These are simple boolean/status flags
   - Could stay in Zustand OR use React Query mutation states
   - **Recommendation**: Move `isSyncing` to React Query mutation state, keep simple flags in Zustand

3. **Derived State Calculations**
   - Tree layout calculations (already using React Query data via `usePeople`)
   - Relationship utilities (`getSiblings`, `countAncestors`, etc.)
   - **Current**: These are utility functions (good!)
   - **No store needed** - they work with React Query data

### 🔄 Migration Opportunities

1. **Session Store** → React Query
   - `isSyncing` → Use `useSyncFamilyTree().isPending`
   - `syncError` → Use `useSyncFamilyTree().error`
   - `deletionStatus` → Could be a React Query query if fetched from server

2. **Profile Context**
   - Replace `useSessionStore((state) => state.isSyncing)` with React Query mutation state
   - Use `useSyncFamilyTree().isPending` instead

## Current Architecture Assessment

### ✅ What We're Doing Right

1. **React Query for all server data** - People, Updates, Blocked Users
2. **Utility functions instead of stores** - `getSiblings`, `countAncestors`, etc.
3. **Hooks pattern** - `usePeople()`, `useUpdates()`, etc. provide clean API
4. **Optimistic updates** - Mutations handle UI updates immediately

### 📝 Minor Improvements

1. **Replace `isSyncing` in session store** with React Query mutation state
2. **Profile context** could use React Query states instead of Zustand
3. **Consider React Context** for very simple UI state instead of Zustand

## Conclusion

**We're using React Query correctly for server state!** 

The remaining Zustand usage is mostly:
- ✅ Session flags (`isSyncing`, `deletionStatus`) - Simple client state
- ✅ Store files kept for backward compatibility during migration

**Recommendation**: The architecture is solid. The remaining Zustand usage is minimal and appropriate for simple client state. Consider migrating `isSyncing` to React Query mutation state if you want to fully remove session-store dependency.
