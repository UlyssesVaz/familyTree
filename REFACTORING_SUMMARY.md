# Refactoring Summary: Separation of Concerns

## Overview

We've refactored the codebase to follow best practices for separation of concerns, making it cleaner, more maintainable, and easier to extend with backend integration.

---

## What Changed?

### Before: Mixed Concerns

**Problem:** Business logic, UI rendering, and data management were all mixed together in large component files.

- `index.tsx` (707 lines): Tree layout calculations + UI rendering + modal state
- `profile.tsx` (1126 lines): Update fetching + filtering + UI rendering + location logic
- `family.tsx` (552 lines): Feed filtering + sorting + UI rendering

**Issues:**
- Hard to test logic independently
- Difficult to reuse logic across components
- Backend integration would require changes in multiple places
- Components were doing too much

### After: Clean Separation

**Solution:** Extracted logic into reusable hooks and a service layer.

- **Hooks** (`hooks/`): Reusable stateful logic
- **Service Layer** (`services/`): Abstraction for data operations
- **Components**: Focus only on UI rendering

---

## Key Concepts Explained

### 1. **Hooks** (`hooks/`)

**What are Hooks?**
Hooks are reusable functions that encapsulate stateful logic and side effects. They're React's way of sharing logic between components.

**Why use them?**
- **Reusability**: Write logic once, use it anywhere
- **Testability**: Test logic separately from UI
- **Cleaner Components**: Components focus on rendering, not calculations
- **Performance**: Built-in memoization prevents unnecessary recalculations

**Examples:**

```typescript
// Before: Logic mixed in component
function HomeScreen() {
  const people = useFamilyTreeStore(...);
  const ego = useMemo(() => {
    // 200+ lines of tree calculation logic here
  }, [people]);
  // ... UI rendering
}

// After: Logic extracted to hook
function HomeScreen() {
  const { ancestorGenerations, descendantGenerations, ego } = useTreeLayout(egoId);
  // ... UI rendering (much cleaner!)
}
```

**Our Hooks:**
- `useTreeLayout`: Calculates tree generations, relationships
- `useProfileUpdates`: Fetches and manages updates for a person
- `useFamilyFeed`: Filters and sorts family feed updates

---

### 2. **Service Layer** (`services/`)

**What is a Service Layer?**
A service layer sits between your UI components and your data store/API. It provides an abstraction for data operations.

**Why use it?**
- **Abstraction**: Components don't care if data comes from store or API
- **Future-proofing**: Easy to swap mock data for real API calls
- **Centralized Logic**: All data operations in one place
- **Error Handling**: Consistent error handling across the app

**Example:**

```typescript
// Before: Direct store access
function Component() {
  const addPerson = useFamilyTreeStore(state => state.addPerson);
  addPerson(data); // Hard to add API call later
}

// After: Service abstraction
function Component() {
  familyTreeService.addPerson(data);
  // Later: Service can call API + update store
}
```

**Our Service:**
- `FamilyTreeService`: Wraps store calls, ready for API integration

---

### 3. **Utils** (`utils/`)

**What are Utils?**
Pure functions (no side effects) that perform calculations or transformations.

**Why use them?**
- **Pure Functions**: Same input = same output, easy to test
- **Reusability**: Use anywhere without React dependencies
- **Performance**: Can be optimized independently

**Example:**

```typescript
// Pure function - no React, no side effects
export function calculateTreeLayout(people: Map, egoId: string): TreeLayout {
  // Pure calculation logic
  return { generations, relationships };
}
```

**Note:** We've kept calculation logic in hooks for now since they need React state. Pure functions can be extracted later if needed.

---

## File Structure

```
FamilyTreeApp/
├── hooks/
│   ├── use-tree-layout.ts      # Tree calculation logic
│   ├── use-profile-updates.ts   # Profile update fetching
│   └── use-family-feed.ts       # Feed filtering/sorting
├── services/
│   └── family-tree-service.ts   # Data operation abstraction
├── components/
│   └── ...                      # UI components (cleaner now!)
└── app/
    └── (tabs)/
        ├── index.tsx            # Tree view (much smaller!)
        ├── profile.tsx          # Profile view (much smaller!)
        └── family.tsx           # Feed view (much smaller!)
```

---

## Benefits

### ✅ **Cleaner Code**
- Components are now ~200-300 lines instead of 500-1100 lines
- Logic is separated from UI
- Easier to read and understand

### ✅ **Easier Testing**
- Test hooks independently
- Test service layer independently
- Test components with mocked hooks

### ✅ **Backend Ready**
- Service layer makes API integration straightforward
- Just swap store calls for API calls in service methods
- Components don't need to change

### ✅ **Reusability**
- `useProfileUpdates` used in both `profile.tsx` and `person/[personId].tsx`
- `useTreeLayout` can be reused in other tree views
- Service methods can be called from anywhere

### ✅ **Maintainability**
- Changes to tree logic only affect `use-tree-layout.ts`
- Changes to update logic only affect `use-profile-updates.ts`
- Changes to data operations only affect service layer

---

## Migration Path

### Current State
- ✅ Hooks extract logic from components
- ✅ Service layer provides abstraction
- ✅ Components use hooks and service

### Next Steps (When Adding Backend)

1. **Update Service Layer**
   ```typescript
   // services/family-tree-service.ts
   async addPerson(data) {
     // 1. Optimistically update store
     const id = useFamilyTreeStore.getState().addPerson(data);
     
     // 2. Call API
     const response = await fetch('/api/people', {
       method: 'POST',
       body: JSON.stringify(data)
     });
     
     // 3. Sync response with store
     const serverData = await response.json();
     useFamilyTreeStore.getState().updatePerson(id, serverData);
   }
   ```

2. **Components Don't Change**
   - Components still call `familyTreeService.addPerson()`
   - Service handles API calls internally
   - No component changes needed!

---

## Testing Strategy

### Before Refactoring
- Hard to test: Logic mixed with UI
- Required rendering entire component
- Difficult to isolate specific logic

### After Refactoring
- **Hooks**: Test with `@testing-library/react-hooks`
- **Service**: Test with unit tests (no React needed)
- **Components**: Test with mocked hooks

**Example Hook Test:**
```typescript
test('useTreeLayout calculates ancestors correctly', () => {
  const { result } = renderHook(() => useTreeLayout(egoId));
  expect(result.current.ancestorGenerations).toHaveLength(2);
});
```

---

## Performance Considerations

### Memoization
- Hooks use `useMemo` to prevent unnecessary recalculations
- Only recalculate when dependencies change
- Components re-render only when hook results change

### Store Subscriptions
- Hooks subscribe to specific store values
- Components only re-render when relevant data changes
- No unnecessary re-renders

---

## Summary

We've successfully refactored the codebase to follow best practices:

1. ✅ **Hooks** extract reusable logic
2. ✅ **Service Layer** provides data abstraction
3. ✅ **Components** focus on UI rendering
4. ✅ **Code is cleaner** and easier to maintain
5. ✅ **Backend integration** will be straightforward

The codebase is now:
- **More maintainable**: Changes are isolated to specific files
- **More testable**: Logic can be tested independently
- **More scalable**: Easy to add features without breaking existing code
- **Backend-ready**: Service layer makes API integration simple

---

## Questions?

If you have questions about:
- **Hooks**: See `hooks/use-tree-layout.ts` for examples
- **Service Layer**: See `services/family-tree-service.ts` for structure
- **Component Usage**: See `app/(tabs)/index.tsx` for how hooks are used

