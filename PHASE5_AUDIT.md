# Phase 5: Store Split - Comprehensive Audit

## 1. Store Method Usage Audit

### Files Using `useFamilyTreeStore` (20 files)

#### Contexts (2 files)
- `contexts/profile-context.tsx` - loadEgo, syncFamilyTree, clearEgo, getEgo
- `contexts/guards/auth-guard.tsx` - getEgo, clearEgo

#### App Routes (7 files)
- `app/(tabs)/index.tsx` - getPerson, getSiblings, egoId, addPerson, addParent, addSpouse, addChild, addSibling
- `app/(tabs)/family.tsx` - getEgo, egoId, people, addUpdate, updateUpdate, toggleUpdatePrivacy, updates.get()
- `app/(tabs)/profile.tsx` - getEgo, egoId, countAncestors, countDescendants, updateEgo, addUpdate, toggleUpdatePrivacy, updateUpdate, getPerson, toggleTaggedUpdateVisibility, people, updates.get()
- `app/(tabs)/_layout.tsx` - getEgo
- `app/person/[personId].tsx` - egoId, getPerson, countAncestors, countDescendants, toggleTaggedUpdateVisibility, addUpdate, people, deleteUpdate
- `app/join/[token].tsx` - syncFamilyTree
- `app/(onboarding)/location.tsx` - updateEgo, getEgo
- `app/(onboarding)/profile.tsx` - loadEgo

#### Components (1 file)
- `components/family-tree/AddUpdateModal.tsx` - people

#### Hooks (4 files)
- `hooks/use-tree-layout.ts` - people.size, people.values(), getPerson, getSiblings
- `hooks/use-update-management.ts` - deleteUpdate
- `hooks/use-profile-updates.ts` - updates, updates.size, getUpdatesForPerson, getUpdateCount, people.size, getPerson
- `hooks/use-family-feed.ts` - updates, updates.size, getPerson

#### Services (1 file)
- `services/family-tree-service.ts` - addPerson, addParent, addSpouse, addChild, addSibling, addUpdate, updateUpdate, deleteUpdate, updateEgo, initializeEgo, egoId

---

## 2. Method Categorization by Target Store

### PeopleStore Methods
**State:**
- `people: Map<string, Person>`

**Methods:**
- `getPerson(id: string): Person | undefined` - Used in 8 files
- `addPerson(data, userId?): Promise<string>` - Used in 2 files
- `people` (direct access) - Used in 6 files
- `people.size` - Used in 2 files
- `people.values()` - Used in 1 file

**Usage Count:** 19 usages across 8 files

### RelationshipsStore Methods
**Methods:**
- `addParent(childId, parentId, userId?): Promise<void>` - Used in 2 files
- `addSpouse(personId1, personId2, userId?): Promise<void>` - Used in 2 files
- `addChild(parentId, childId, userId?): Promise<void>` - Used in 2 files
- `addSibling(personId1, personId2, userId?): Promise<void>` - Used in 2 files
- `getSiblings(personId: string): Person[]` - Used in 2 files
- `countAncestors(personId: string): number` - Used in 2 files
- `countDescendants(personId: string): number` - Used in 2 files

**Usage Count:** 14 usages across 2 files

**Dependencies:** Requires PeopleStore (needs `people` Map to read relationships)

### UpdatesStore Methods
**State:**
- `updates: Map<string, Update>`

**Methods:**
- `addUpdate(...): Promise<string>` - Used in 4 files
- `updateUpdate(...): void` - Used in 3 files
- `deleteUpdate(updateId: string): Promise<void>` - Used in 3 files
- `getUpdatesForPerson(personId: string): Update[]` - Used in 1 file
- `getUpdateCount(personId: string): number` - Used in 1 file
- `toggleUpdatePrivacy(updateId: string): void` - Used in 2 files
- `toggleTaggedUpdateVisibility(personId, updateId): void` - Used in 2 files
- `updates` (direct access) - Used in 3 files
- `updates.size` - Used in 2 files
- `updates.get()` - Used in 3 files

**Usage Count:** 21 usages across 6 files

**Dependencies:** Requires PeopleStore (for tagged person validation)

### SessionStore Methods
**State:**
- `egoId: string | null`

**Methods:**
- `getEgo(): Person | null` - Used in 6 files
- `loadEgo(person: Person): void` - Used in 2 files
- `clearEgo(): void` - Used in 3 files
- `updateEgo(updates): void` - Used in 2 files
- `initializeEgo(name, birthDate, gender, userId?): void` - Used in 1 file
- `syncFamilyTree(userId: string): Promise<void>` - Used in 2 files
- `egoId` (direct access) - Used in 5 files

**Usage Count:** 21 usages across 8 files

**Dependencies:** 
- Requires PeopleStore (to get ego person from people Map)
- Requires UpdatesStore (syncFamilyTree loads updates)
- Requires RelationshipsStore (syncFamilyTree loads relationships)

---

## 3. Store Dependencies

### Dependency Graph
```
SessionStore
  ├── depends on → PeopleStore (getEgo needs people Map)
  ├── depends on → UpdatesStore (syncFamilyTree loads updates)
  └── depends on → RelationshipsStore (syncFamilyTree loads relationships)

RelationshipsStore
  └── depends on → PeopleStore (needs people Map to read relationships)

UpdatesStore
  └── depends on → PeopleStore (for tagged person validation)

PeopleStore
  └── (no dependencies - base store)
```

### Dependency Order (Initialization)
1. **PeopleStore** - Base store, no dependencies
2. **UpdatesStore** - Depends on PeopleStore
3. **RelationshipsStore** - Depends on PeopleStore
4. **SessionStore** - Depends on all three stores

---

## 4. Cross-Store Communication Patterns

### Pattern 1: Direct Store Access
**Current:** Components access multiple stores via single `useFamilyTreeStore`
**After Split:** Components will import and use multiple stores

**Example:**
```typescript
// Current
const getPerson = useFamilyTreeStore((state) => state.getPerson);
const addUpdate = useFamilyTreeStore((state) => state.addUpdate);

// After Split
const getPerson = usePeopleStore((state) => state.getPerson);
const addUpdate = useUpdatesStore((state) => state.addUpdate);
```

### Pattern 2: Store-to-Store Communication
**Challenge:** SessionStore needs to call methods on other stores during sync

**Solution Options:**
1. **Direct Import (Recommended):** SessionStore imports other stores directly
   ```typescript
   import { usePeopleStore } from './people-store';
   import { useUpdatesStore } from './updates-store';
   
   syncFamilyTree: async (userId) => {
     const people = await getAllPeople();
     usePeopleStore.getState().setPeople(people);
     // ...
   }
   ```

2. **Callback Pattern:** Pass store setters as parameters
   ```typescript
   syncFamilyTree: async (userId, { setPeople, setUpdates }) => {
     // ...
   }
   ```
   **Not recommended** - too complex

3. **Event System:** Use Zustand middleware for cross-store events
   **Not recommended** - over-engineering

**Recommendation:** Use Pattern 1 (Direct Import) - simplest and most maintainable

### Pattern 3: Shared State Access
**Challenge:** Some methods need to read from multiple stores

**Example:** `getEgo()` needs `egoId` from SessionStore and `people` from PeopleStore

**Solution:** 
- SessionStore's `getEgo()` will import PeopleStore
- Or: Create a selector hook that combines both stores
  ```typescript
  export function useEgo() {
    const egoId = useSessionStore((state) => state.egoId);
    const getPerson = usePeopleStore((state) => state.getPerson);
    return egoId ? getPerson(egoId) : null;
  }
  ```

---

## 5. Migration Strategy

### Step 1: Create New Stores (No Breaking Changes)
- Create all 4 new stores alongside existing store
- Implement methods, but don't export yet
- Test in isolation

### Step 2: Create Adapter Layer
- Create wrapper that delegates to new stores
- Keep `useFamilyTreeStore` as facade
- Gradually migrate components

### Step 3: Migrate Components Incrementally
- Start with components that use single store
- Move to components using multiple stores
- Test after each migration

### Step 4: Remove Old Store
- Once all components migrated
- Remove `family-tree-store.ts`
- Update all imports

---

## 6. Files Requiring Updates (20 files)

### High Priority (Core Functionality)
1. `contexts/profile-context.tsx` - Uses SessionStore methods
2. `contexts/guards/auth-guard.tsx` - Uses SessionStore methods
3. `app/(tabs)/index.tsx` - Uses PeopleStore + RelationshipsStore
4. `app/(tabs)/family.tsx` - Uses SessionStore + UpdatesStore + PeopleStore
5. `app/(tabs)/profile.tsx` - Uses all stores
6. `app/person/[personId].tsx` - Uses all stores
7. `services/family-tree-service.ts` - Uses all stores

### Medium Priority (Hooks)
8. `hooks/use-tree-layout.ts` - Uses PeopleStore + RelationshipsStore
9. `hooks/use-profile-updates.ts` - Uses UpdatesStore + PeopleStore
10. `hooks/use-family-feed.ts` - Uses UpdatesStore + PeopleStore
11. `hooks/use-update-management.ts` - Uses UpdatesStore

### Low Priority (Simple Usage)
12. `app/(tabs)/_layout.tsx` - Uses SessionStore.getEgo only
13. `app/join/[token].tsx` - Uses SessionStore.syncFamilyTree only
14. `app/(onboarding)/location.tsx` - Uses SessionStore methods only
15. `app/(onboarding)/profile.tsx` - Uses SessionStore.loadEgo only
16. `components/family-tree/AddUpdateModal.tsx` - Uses PeopleStore.people only

---

## 7. Risk Assessment

### High Risk Areas
1. **syncFamilyTree** - Complex method that touches all stores
2. **clearEgo** - Clears all stores, needs coordination
3. **Components using multiple stores** - More import changes needed

### Medium Risk Areas
1. **Relationship methods** - Need to update both people's relationship arrays
2. **Update methods with tagging** - Need to validate people exist

### Low Risk Areas
1. **Simple getters** - getPerson, getEgo, etc.
2. **Single-store components** - Easy to migrate

---

## 8. Testing Strategy

### Unit Tests (Per Store)
- [ ] PeopleStore: addPerson, getPerson
- [ ] RelationshipsStore: addParent, addSpouse, getSiblings
- [ ] UpdatesStore: addUpdate, deleteUpdate, togglePrivacy
- [ ] SessionStore: loadEgo, clearEgo, syncFamilyTree

### Integration Tests
- [ ] syncFamilyTree loads all data correctly
- [ ] clearEgo clears all stores
- [ ] Relationship methods update both people
- [ ] Update tagging validates people exist

### Component Tests
- [ ] All 20 files still work after migration
- [ ] No broken imports
- [ ] No performance regressions

---

## 9. Estimated Effort

- **Store Creation:** 4-6 hours (4 stores, ~200-300 lines each)
- **Component Migration:** 6-8 hours (20 files, testing each)
- **Testing & Debugging:** 4-6 hours
- **Total:** 14-20 hours

---

## 10. Success Criteria

- [ ] All 4 stores created and functional
- [ ] All 20 files migrated successfully
- [ ] No broken imports
- [ ] All existing functionality works
- [ ] No performance regressions
- [ ] Code is more maintainable (smaller, focused stores)
- [ ] Old store removed
