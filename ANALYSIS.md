# Family Tree App - Comprehensive Code Analysis

## 1. Tab Rename ✅
- ✅ Renamed "explore" tab to "family"
- ✅ Updated tab layout configuration
- ✅ Renamed component from `ExploreScreen` to `FamilyScreen`
- ✅ Updated icon to `people.fill` (more appropriate)

---

## 2. Frontend Completeness Check (vs Roadmap)

### ✅ Completed (Beyond Roadmap)
- **Phase 1-5**: Core tree functionality complete
- **Profile System**: Instagram-style profile with updates (not in roadmap)
- **Family Feed**: Family updates timeline (not in roadmap)
- **Infinite Canvas**: Pan/zoom infrastructure (partially complete)
- **Date Picker**: Native calendar integration
- **Story/Update System**: Add stories to any person's profile

### ⚠️ Missing from Roadmap

#### Phase 0: Foundation
- ✅ Type definitions exist (`Person`, `Update` interfaces)
- ⚠️ **Missing**: `FamilyTreeState` interface (store interface exists but not exported as type)

#### Phase 2: Onboarding & Auth
- ✅ **Completed**: Auth flow structure with Supabase
- ✅ **Completed**: Google SSO authentication (native SDK with ID token)
- ⚠️ **Note**: Nonce check skipped (SDK generates nonce internally, extracted from token)
- ✅ **Completed**: Auth context with routing guards
- ✅ **Completed**: Onboarding screens
- ❌ **Not Started**: Invite flow handling

#### Phase 4: DAG Validation
- ❌ **Missing**: `utils/dag-validation.ts` - Cycle detection
- ❌ **Missing**: Merge detection logic
- ❌ **Missing**: Conflict prevention (version tracking exists but not used)

#### Phase 6: Graph Visualization
- ⚠️ **Partial**: Layout algorithm exists but basic
- ❌ **Missing**: Connection lines rendering
- ⚠️ **Partial**: Pan/zoom working on web, mobile in progress

#### Phase 7: Multi-User Collaboration
- ⚠️ **Partial**: Optimistic updates (UI updates immediately)
- ❌ **Missing**: Real-time sync (Firebase/Supabase)
- ❌ **Missing**: Conflict resolution UI
- ❌ **Missing**: Permissions system

#### Phase 8: Persistence
- ❌ **Missing**: AsyncStorage integration
- ❌ **Missing**: Backend API integration
- ❌ **Missing**: Search functionality

---

## 3. Separation of Concerns Analysis

### ✅ **Well Separated**

#### **Types** (`types/family-tree.ts`)
- ✅ Clean interfaces for `Person` and `Update`
- ✅ No business logic
- ✅ Well documented

#### **Store** (`stores/family-tree-store.ts`)
- ✅ Single responsibility: State management
- ✅ Pure functions for actions
- ✅ No UI logic
- ✅ Bidirectional relationship management is clean

#### **Components** (`components/family-tree/`)
- ✅ Reusable components
- ✅ Props-based configuration
- ✅ No direct store access (uses hooks)

#### **Utils** (`utils/`)
- ✅ Pure functions
- ✅ Mention parsing/formatting separated

### ⚠️ **Areas for Improvement**

#### **1. Screen Components Too Large**
- `app/(tabs)/index.tsx` (707 lines) - Tree visualization logic mixed with UI
- `app/(tabs)/profile.tsx` (862 lines) - Profile logic + update rendering + modals
- `app/(tabs)/family.tsx` (552 lines) - Feed logic + filtering + modals

**Recommendation**: Extract logic into custom hooks:
```typescript
// hooks/use-tree-layout.ts
export function useTreeLayout(egoId: string) {
  // Calculate positions, relationships, etc.
  return { parents, spouses, children, positions };
}

// hooks/use-profile-updates.ts
export function useProfileUpdates(personId: string) {
  // Filter, sort, manage update state
  return { updates, isLoading, refetch };
}
```

#### **2. Modal State Management** ✅ **COMPLETED**
- ✅ Created `ModalProvider` and `useModal` hook
- ✅ Centralized modal state management
- ✅ Reduces prop drilling
- ⚠️ **Note**: Components can migrate to use modal context incrementally

#### **3. Business Logic in Components**
- Relationship calculations in `index.tsx`
- Update filtering logic in `family.tsx`

**Recommendation**: Move to store selectors or utils:
```typescript
// stores/family-tree-store.ts
getTreeLayout: (egoId: string) => TreeLayout

// utils/tree-layout.ts
export function calculateTreeLayout(people: Map, egoId: string): TreeLayout
```

#### **4. Missing Service Layer**
- Direct store access everywhere
- No abstraction for future API calls

**Recommendation**: Create service layer:
```typescript
// services/family-tree-service.ts
export class FamilyTreeService {
  async addPerson(data) { /* API call + store update */ }
  async syncTree() { /* Fetch from API */ }
}
```

---

## 4. Tech Stack Review

### ✅ **Current Stack is Solid**

#### **React Native + Expo**
- ✅ Excellent choice for mobile-first
- ✅ Cross-platform (web, iOS, Android)
- ✅ Good developer experience
- ✅ Rich ecosystem

#### **Zustand**
- ✅ Lightweight, no boilerplate
- ✅ Good for optimistic updates
- ✅ Easy to add persistence later
- ⚠️ Consider: For complex state, might need middleware

#### **Expo Router**
- ✅ File-based routing (familiar)
- ✅ Type-safe routes
- ✅ Good for this use case

#### **UUID v4**
- ✅ Perfect for distributed systems
- ✅ No collisions
- ✅ Works offline

### ⚠️ **Potential Improvements**

#### **1. State Management**
**Current**: Zustand with Maps
**Consider**: 
- Add `zustand/middleware` for persistence (AsyncStorage)
- Add `immer` middleware for immutable updates (cleaner code)
- Consider `@tanstack/react-query` for server state (when backend added)

#### **2. Form Management**
**Current**: Manual state management in modals
**Consider**: 
- `react-hook-form` for form validation/state
- `zod` for schema validation (TypeScript-first)

#### **3. Date Handling**
**Current**: Manual YYYY-MM-DD strings
**Consider**: 
- `date-fns` or `dayjs` for date operations
- Already using native date picker ✅

#### **4. Testing**
**Missing**: No test infrastructure
**Recommend**: 
- `jest` + `@testing-library/react-native`
- Add unit tests for store actions
- Add integration tests for critical flows

#### **5. Error Handling**
**Current**: Basic error handling
**Consider**: 
- Error boundary (exists ✅)
- Error logging service (Sentry?)
- User-friendly error messages

#### **6. Performance**
**Current**: Basic memoization
**Consider**: 
- `react-native-reanimated` (already using ✅)
- `react-native-fast-image` for image optimization
- Virtual lists for large trees (`@shopify/flash-list`)

---

## 5. Best Engineering Practices

### ✅ **Following Best Practices**

1. **TypeScript**: Full type safety
2. **Component Composition**: Reusable components
3. **Single Responsibility**: Components do one thing
4. **Immutable Updates**: Zustand enforces immutability
5. **Error Boundaries**: Error handling in place
6. **Platform Detection**: Platform-specific code handled
7. **Safe Area**: Proper mobile safe area handling

### ⚠️ **Areas to Improve**

#### **1. Code Organization**
- Large files (700+ lines)
- **Fix**: Extract hooks, utils, sub-components

#### **2. Testing**
- No tests
- **Fix**: Add unit tests for store, utils
- Add integration tests for critical flows

#### **3. Documentation**
- Good inline comments
- **Missing**: API documentation, architecture docs
- **Fix**: Add JSDoc for public APIs

#### **4. Error Handling** ✅ **ENHANCED**
- ✅ Error boundary exists
- ✅ Created `ErrorProvider` and `useError` hook
- ✅ User-friendly error messages
- ✅ Retry logic support
- ✅ API error handling utilities
- ⚠️ **Note**: Components can migrate to use error context incrementally

#### **5. Performance Monitoring**
- No performance tracking
- **Fix**: Add performance monitoring (React DevTools Profiler)

#### **6. Accessibility**
- Basic accessibility
- **Missing**: Screen reader support, accessibility labels
- **Fix**: Add `accessibilityLabel`, `accessibilityRole`

---

## 6. Connection Lines Implementation Approach

### **The Challenge**
Drawing lines between cards requires:
1. **Absolute positioning** of cards
2. **Calculated coordinates** for connection points
3. **SVG or Canvas** rendering for lines
4. **Layout algorithm** that provides consistent spacing

### **Why It Broke Before**
- Cards in ScrollViews have **relative positioning**
- No fixed coordinate system
- Lines need **absolute coordinates** but cards are **flexbox/relative**

### **Recommended Approach**

#### **Option 1: SVG Overlay (Recommended)**
```typescript
// components/family-tree/TreeConnections.tsx
import Svg, { Line, Path } from 'react-native-svg';

export function TreeConnections({ connections }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {connections.map(({ from, to, type }) => (
        <Line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#ccc"
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}
```

**Implementation Steps**:
1. **Calculate card positions** using `onLayout` callbacks
2. **Store positions** in state/context
3. **Render SVG overlay** above cards but below interactions
4. **Update on layout changes** (use `useEffect` + `onLayout`)

**Key Points**:
- Use `react-native-svg` (already in ecosystem)
- Position SVG absolutely over the tree
- Calculate connection points (card centers, top/bottom edges)
- Handle pan/zoom by transforming SVG coordinates

#### **Option 2: Canvas-Based (More Complex)**
- Use `react-native-skia` for advanced rendering
- Better for complex animations
- More performance overhead

#### **Option 3: CSS/View-Based (Limited)**
- Use `View` with `borderWidth` and rotation
- Very limited, doesn't work well for complex trees
- Not recommended

### **Specific Implementation Strategy**

```typescript
// 1. Track card positions
const [cardPositions, setCardPositions] = useState<Map<string, Position>>();

// 2. Measure cards on layout
<PersonCard
  onLayout={(event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setCardPositions(prev => new Map(prev).set(personId, {
      x: x + width / 2,  // center X
      y: y + height / 2, // center Y
      top: y,
      bottom: y + height,
    }));
  }}
/>

// 3. Calculate connections
const connections = useMemo(() => {
  const lines = [];
  // Parent-child lines
  parents.forEach(parent => {
    const parentPos = cardPositions.get(parent.id);
    const childPos = cardPositions.get(egoId);
    if (parentPos && childPos) {
      lines.push({
        from: { x: parentPos.x, y: parentPos.bottom },
        to: { x: childPos.x, y: childPos.top },
        type: 'parent-child'
      });
    }
  });
  return lines;
}, [cardPositions, parents, egoId]);

// 4. Render lines
<TreeConnections connections={connections} />
```

### **Challenges to Address**

1. **Dynamic Layout**: Cards can move (pan/zoom, scroll)
   - **Solution**: Re-measure on layout changes, use `onLayout`

2. **Performance**: Many lines = many SVG elements
   - **Solution**: Memoize connections, use `React.memo` for SVG components

3. **Z-Index**: Lines behind cards but above background
   - **Solution**: Layer SVG between background and cards

4. **Curved Lines**: Better UX than straight lines
   - **Solution**: Use SVG `Path` with bezier curves for parent-child connections

---

## 7. Onboarding & Auth Flow Approach

### **Recommended Sequence**

#### **Step 1: Frontend-Only Onboarding (No Backend)**
1. **Create onboarding screens** (Welcome → Create Profile → Done)
2. **Store ego locally** (Zustand + AsyncStorage)
3. **Mock auth state** (local boolean: `isAuthenticated`)
4. **Test full flow** end-to-end

**Why**: Validate UX before backend complexity

#### **Step 2: Add Auth Context** ✅ **COMPLETED**
1. ✅ **Created `AuthContext`** with:
   - `session: AuthSession | null`
   - `isAuthenticated: boolean`
   - `signInWithProvider(provider)` - Google SSO only
   - `signOut()`
   - `signInWithEmail()` / `signUpWithEmail()` - Not supported (Google SSO only)
2. ✅ **Protected routes** in `app/_layout.tsx` with routing guards
3. ✅ **Redirect logic** implemented (login → onboarding → app)
4. ✅ **Service layer** abstraction (`services/auth/`) for easy backend swaps
5. ✅ **Native Google Sign-In** using `@react-native-google-signin/google-signin`
6. ⚠️ **Nonce verification**: Skipped (SDK generates nonce internally, extracted from JWT token for Supabase)

**Why**: Clean separation, easy to swap implementations

#### **Step 3: Backend Integration** ⚠️ **PARTIALLY COMPLETE**
1. ✅ **API design documented** (`API_DESIGN.md`)
2. ✅ **Auth service layer** (`services/auth/`) with Supabase implementation
3. ✅ **Auth integration**:
   - ✅ Google SSO via Supabase `signInWithIdToken()`
   - ✅ Session management (stored by Supabase)
   - ✅ Token refresh (via Supabase)
   - ✅ Auth state listener (`onAuthStateChanged`)
   - ❌ Email/password auth (not supported - Google SSO only)
4. ✅ **Token management** (handled by Supabase client)
5. ⏭️ **API client** for family tree endpoints (next step)

**Why**: Incremental, testable, maintainable

### **Onboarding Flow Design**

```
┌─────────────┐
│   Welcome   │ → "Get Started"
└─────────────┘
      ↓
┌─────────────┐
│ Create Self │ → Name, Birth Date, Gender, Photo
└─────────────┘
      ↓
┌─────────────┐
│ Join/Create │ → "Join Family" or "Create New Family"
│   Family    │   (Phone number for invites)
└─────────────┘
      ↓
┌─────────────┐
│     App     │ → Initialize ego, redirect to home
└─────────────┘
```

### **Auth Flow Design**

```
App Start
    ↓
Check Auth State (SecureStore)
    ↓
┌──────────┐      ┌──────────────┐
│ Logged   │      │ Not Logged   │
│   In     │      │     In       │
└──────────┘      └──────────────┘
    ↓                   ↓
  App              Login Screen
                      ↓
              ┌──────────────┐
              │ Sign Up /    │
              │ Sign In      │
              └──────────────┘
                      ↓
              ┌──────────────┐
              │ Onboarding   │
              │   (if new)   │
              └──────────────┘
                      ↓
                    App
```

### **Backend API Design (Future)**

#### **Auth Endpoints**
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
POST   /api/auth/logout
```

#### **Family Tree Endpoints**
```
GET    /api/family-tree          # Get full tree
POST   /api/family-tree/person   # Add person
PUT    /api/family-tree/person/:id
DELETE /api/family-tree/person/:id
POST   /api/family-tree/relationship
```

#### **Invite Endpoints**
```
POST   /api/invites              # Send invite
GET    /api/invites/:token       # Validate invite
POST   /api/invites/:token/accept
```

### **Implementation Priority**

1. ✅ **Frontend onboarding** (complete with screens)
2. ✅ **Auth context** (Supabase integration with Google SSO)
3. ✅ **Backend API design** (document endpoints in `API_DESIGN.md`)
4. ⏭️ **API integration** (connect family tree service to backend APIs)
5. ⏭️ **Real-time sync** (WebSockets/Supabase Realtime)

---

## 8. Recommendations Summary

### **Immediate (Before Backend)**
1. ✅ Extract large components into hooks
2. ✅ Add form validation library
3. ✅ Add error handling improvements
4. ✅ Add basic tests
5. ✅ Implement connection lines (SVG approach)

### **Short-term (With Backend)**
1. ✅ Create API service layer (auth service complete, family tree service ready)
2. ✅ Add auth context + onboarding (Google SSO with Supabase)
3. ⏭️ Add AsyncStorage persistence (for offline support)
4. ⏭️ Add DAG validation utils
5. ⏭️ Connect family tree service to backend APIs

### **Medium-term**
1. ⏭️ Real-time sync (Firebase/Supabase)
2. ⏭️ Conflict resolution UI
3. ⏭️ Performance optimizations
4. ⏭️ Advanced tree layout algorithms

---

## 9. Conclusion

### **Strengths**
- ✅ Solid architecture foundation
- ✅ Good separation of types/store/components
- ✅ Clean component structure
- ✅ Type-safe throughout
- ✅ Mobile-first approach

### **Areas for Growth**
- ⚠️ Extract logic from large components
- ⚠️ Add testing infrastructure
- ⚠️ Improve error handling
- ⚠️ Add service layer abstraction
- ⚠️ Implement connection lines properly

### **Next Steps**
1. **Frontend polish**: Extract hooks, add tests
2. **Onboarding flow**: Build screens, mock auth
3. **Backend design**: Document API contracts
4. **Backend integration**: Connect frontend to APIs
5. **Real-time sync**: Add collaboration features

**Overall Assessment**: 🟢 **Good foundation, ready for backend integration**

---

## 10. Refactoring & Code Quality Opportunities

### **Priority 1: Easy Wins (Low Effort, High Impact)**

#### **1.1 Duplicate Utility Functions** 🔴 **HIGH PRIORITY**

**Issue**: Same utility functions duplicated across multiple files.

**Duplicates Found**:
- `getGenderColor()` - Duplicated in:
  - `components/family-tree/PersonCard.tsx` (lines 56-65)
  - `app/(tabs)/profile.tsx` (lines 249-259)
  - `app/person/[personId].tsx` (lines 106-116)
- `formatDateRange()` - Only in `PersonCard.tsx`, but date formatting logic appears elsewhere
- Gender color constants (`#4A90E2`, `#F5A623`) - Hardcoded in multiple places

**Refactoring**:
```typescript
// utils/gender-utils.ts
export const GENDER_COLORS = {
  male: '#4A90E2',
  female: '#F5A623',
  other: undefined, // Uses theme color
} as const;

export function getGenderColor(gender?: Gender, themeColor?: string): string {
  if (!gender || gender === 'other') return themeColor || '#888';
  return GENDER_COLORS[gender];
}

// utils/date-utils.ts
export function formatDateRange(birthDate?: string, deathDate?: string): string | null {
  if (!birthDate && !deathDate) return null;
  const birthYear = birthDate?.split('-')[0] || '';
  const deathYear = deathDate?.split('-')[0] || '';
  if (birthYear && deathYear) return `${birthYear} - ${deathYear}`;
  if (birthYear) return `Born ${birthYear}`;
  return null;
}

export function formatYear(dateString?: string): string | null {
  return dateString?.split('-')[0] || null;
}
```

**Impact**: 
- ✅ Removes ~30 lines of duplicate code
- ✅ Single source of truth for gender colors
- ✅ Easier to update styling consistently
- ✅ Better testability

**Estimated Effort**: 30 minutes

---

#### **1.2 Duplicate Update State Management** 🔴 **HIGH PRIORITY**

**Issue**: Same state variables and logic duplicated in `profile.tsx` and `family.tsx`.

**Duplicates Found**:
```typescript
// Both files have:
const [isAddingUpdate, setIsAddingUpdate] = useState(false);
const [updateToEdit, setUpdateToEdit] = useState<Update | null>(null);
const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
const deleteUpdateRef = useRef(deleteUpdate);
// Plus similar useEffect for delete confirmation
```

**Refactoring**:
```typescript
// hooks/use-update-management.ts
export function useUpdateManagement() {
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<Update | null>(null);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  const deleteUpdate = useFamilyTreeStore((state) => state.deleteUpdate);
  const deleteUpdateRef = useRef(deleteUpdate);
  
  useEffect(() => {
    deleteUpdateRef.current = deleteUpdate;
  }, [deleteUpdate]);

  // Delete confirmation logic
  useEffect(() => {
    if (pendingDeleteId && !menuUpdateId) {
      const updateIdToDelete = pendingDeleteId;
      setPendingDeleteId(null);
      requestAnimationFrame(() => {
        setTimeout(() => {
          Alert.alert(
            'Delete Update',
            'Are you sure you want to delete this update?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteUpdateRef.current(updateIdToDelete),
              },
            ],
            { cancelable: true }
          );
        }, Platform.OS === 'ios' ? 300 : 100);
      });
    }
  }, [pendingDeleteId, menuUpdateId]);

  return {
    isAddingUpdate,
    setIsAddingUpdate,
    updateToEdit,
    setUpdateToEdit,
    expandedUpdateId,
    setExpandedUpdateId,
    menuUpdateId,
    setMenuUpdateId,
    pendingDeleteId,
    setPendingDeleteId,
  };
}
```

**Impact**:
- ✅ Removes ~50 lines of duplicate code
- ✅ Single source of truth for update state management
- ✅ Consistent behavior across screens
- ✅ Easier to add features (e.g., undo delete)

**Estimated Effort**: 1 hour

---

#### **1.3 Duplicate Image Picking Logic** 🟡 **MEDIUM PRIORITY**

**Issue**: Similar image picking code in `AddPersonModal.tsx` and `EditProfileModal.tsx`.

**Similar Code**:
- Permission requesting
- Image picker configuration
- Error handling
- Photo removal

**Refactoring**:
```typescript
// hooks/use-image-picker.ts
export function useImagePicker(options?: {
  aspect?: [number, number];
  quality?: number;
}) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const pickImage = async () => {
    if (isPicking) return;
    setIsPicking(true);
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: options?.aspect || [1, 1],
        quality: options?.quality || 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        return result.assets[0].uri;
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsPicking(false);
    }
  };

  const removePhoto = () => setPhotoUri(null);

  return { photoUri, setPhotoUri, pickImage, removePhoto, isPicking };
}
```

**Impact**:
- ✅ Removes ~60 lines of duplicate code
- ✅ Consistent image picking behavior
- ✅ Easier to add camera support later
- ✅ Better error handling centralization

**Estimated Effort**: 45 minutes

---

### **Priority 2: Medium Complexity (Moderate Effort, Good Impact)**

#### **2.1 Duplicate Gender Selection UI** 🟡 **MEDIUM PRIORITY**

**Issue**: Gender selection buttons duplicated in `AddPersonModal.tsx` and `ProfileFormFields.tsx` with nearly identical code (~50 lines each).

**Refactoring**:
```typescript
// components/family-tree/GenderSelector.tsx
export function GenderSelector({
  value,
  onChange,
  colors, // Theme colors
}: {
  value?: Gender;
  onChange: (gender?: Gender) => void;
  colors: ThemeColors;
}) {
  // Extract the gender button rendering logic
  // Single component, reusable everywhere
}
```

**Impact**:
- ✅ Removes ~100 lines of duplicate code
- ✅ Consistent gender selection UI
- ✅ Easier to update styling
- ✅ Better accessibility (can add labels once)

**Estimated Effort**: 1.5 hours

---

#### **2.2 Extract Update Rendering Component** 🟡 **MEDIUM PRIORITY**

**Issue**: Update rendering logic duplicated in `profile.tsx` and `family.tsx` with minor variations.

**Similar Code**:
- Update card rendering
- Mention formatting
- Expand/collapse logic
- Menu actions
- Photo display

**Refactoring**:
```typescript
// components/family-tree/UpdateCard.tsx
export function UpdateCard({
  update,
  person,
  isExpanded,
  onExpand,
  onEdit,
  onDelete,
  onTogglePrivacy,
  onPress,
  // ... other props
}) {
  // Extract all update rendering logic
  // Handle both profile and feed variations
}
```

**Impact**:
- ✅ Removes ~200+ lines of duplicate code
- ✅ Consistent update display
- ✅ Easier to add features (e.g., reactions, comments)
- ✅ Better performance (can memoize properly)

**Estimated Effort**: 2-3 hours

---

#### **2.3 Form Validation Utilities** 🟡 **MEDIUM PRIORITY**

**Issue**: Basic validation scattered across modals (name required, date format, etc.).

**Refactoring**:
```typescript
// utils/form-validation.ts
export const personFormSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    validate: (value: string) => value.trim().length > 0,
  },
  birthDate: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    validate: (value: string) => {
      if (!value) return true; // Optional
      const date = new Date(value);
      return !isNaN(date.getTime()) && date < new Date();
    },
  },
  phoneNumber: {
    pattern: /^\+?[\d\s\-()]+$/,
    optional: true,
  },
};

export function validatePersonForm(data: Partial<Person>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  // Centralized validation logic
}
```

**Impact**:
- ✅ Consistent validation across forms
- ✅ Easier to add new validation rules
- ✅ Better error messages
- ✅ Ready for form library integration (react-hook-form)

**Estimated Effort**: 2 hours

---

### **Priority 3: Higher Complexity (Higher Effort, Strategic Impact)**

#### **3.1 Extract Large Screen Components** 🔵 **STRATEGIC**

**Issue**: Large screen files (700-800+ lines) mixing UI, business logic, and state management.

**Files to Refactor**:
- `app/(tabs)/index.tsx` (707 lines) - Tree visualization + layout logic
- `app/(tabs)/profile.tsx` (862 lines) - Profile + updates + modals
- `app/(tabs)/family.tsx` (552 lines) - Feed + filtering + modals

**Refactoring Strategy**:

**For `index.tsx`**:
- ✅ Already extracted `useTreeLayout` hook (good!)
- ⏭️ Extract `GenerationRow` to separate file
- ⏭️ Extract share/favorite logic to hooks
- ⏭️ Extract modal state management

**For `profile.tsx`**:
- ✅ Already using `useProfileUpdates` hook (good!)
- ⏭️ Extract profile header to `ProfileHeader.tsx`
- ⏭️ Extract update list to `UpdateList.tsx`
- ⏭️ Use `useUpdateManagement` hook (Priority 1.2)
- ⏭️ Extract location management to hook

**For `family.tsx`**:
- ✅ Already using `useFamilyFeed` hook (good!)
- ⏭️ Extract feed header to `FamilyFeedHeader.tsx`
- ⏭️ Extract filter UI to `FeedFilterBar.tsx`
- ⏭️ Use `useUpdateManagement` hook
- ⏭️ Extract update list component

**Target Structure**:
```
app/(tabs)/
  index.tsx (200-300 lines) - Main tree screen, orchestrates components
  profile.tsx (200-300 lines) - Main profile screen, orchestrates components
  family.tsx (200-300 lines) - Main feed screen, orchestrates components

components/family-tree/
  tree/
    GenerationRow.tsx
    TreeHeader.tsx
    TreeActions.tsx (share, favorite)
  profile/
    ProfileHeader.tsx
    UpdateList.tsx
    ProfileActions.tsx
  feed/
    FeedHeader.tsx
    FeedFilterBar.tsx
    FeedUpdateList.tsx
```

**Impact**:
- ✅ Much easier to maintain
- ✅ Better testability
- ✅ Reusable components
- ✅ Faster development (less scrolling, clearer structure)

**Estimated Effort**: 1-2 days

---

#### **3.2 Store Selector Optimization** 🔵 **STRATEGIC**

**Issue**: Multiple `useFamilyTreeStore` calls in components, potentially causing unnecessary re-renders.

**Current Pattern**:
```typescript
const ego = useFamilyTreeStore((state) => state.getEgo());
const egoId = useFamilyTreeStore((state) => state.egoId);
const people = useFamilyTreeStore((state) => state.people);
const addPerson = useFamilyTreeStore((state) => state.addPerson);
// ... many more
```

**Refactoring**:
```typescript
// hooks/use-family-tree.ts - Composite hook
export function useFamilyTree() {
  const store = useFamilyTreeStore();
  
  return {
    // Person access
    getEgo: () => store.getEgo(),
    egoId: store.egoId,
    getPerson: store.getPerson,
    people: store.people,
    
    // Actions
    addPerson: store.addPerson,
    updatePerson: store.updatePerson,
    // ... etc
    
    // Computed values (memoized)
    peopleArray: useMemo(() => Array.from(store.people.values()), [store.people]),
  };
}

// Or use Zustand selectors for better performance
const usePeople = () => useFamilyTreeStore((state) => state.people);
const useEgo = () => useFamilyTreeStore((state) => state.getEgo());
```

**Impact**:
- ✅ Better performance (fewer re-renders)
- ✅ Cleaner component code
- ✅ Easier to optimize later
- ✅ Better TypeScript inference

**Estimated Effort**: 3-4 hours

---

#### **3.3 Extract Relationship Calculation Logic** 🔵 **STRATEGIC**

**Issue**: Relationship traversal logic exists in store, but some calculations might be in components.

**Opportunity**: Create pure utility functions for relationship queries that can be:
- Tested independently
- Used by store and components
- Optimized with memoization
- Documented with examples

**Refactoring**:
```typescript
// utils/relationship-queries.ts
export function getAncestors(personId: string, people: Map<string, Person>): Person[] {
  // Pure function, easily testable
}

export function getDescendants(personId: string, people: Map<string, Person>): Person[] {
  // Pure function
}

export function getCousins(personId: string, people: Map<string, Person>): Person[] {
  // Complex logic, but isolated and testable
}

export function calculateRelationship(person1: Person, person2: Person, people: Map<string, Person>): RelationshipType {
  // "Uncle", "Cousin", "Great-grandparent", etc.
}
```

**Impact**:
- ✅ Better testability
- ✅ Reusable across store and components
- ✅ Can add complex queries (e.g., "find all cousins")
- ✅ Performance optimizations (memoization, caching)

**Estimated Effort**: 4-6 hours

---

### **Priority 4: Architecture Improvements (Long-term)**

#### **4.1 Consider Form Library Integration** 🟢 **FUTURE**

**Current**: Manual form state management in every modal.

**Consider**: `react-hook-form` + `zod` for:
- Automatic validation
- Less boilerplate
- Better performance
- Type-safe forms

**When**: After Priority 2.3 (form validation utils) to understand patterns first.

---

#### **4.2 Date Library Integration** 🟢 **FUTURE**

**Current**: Manual date string manipulation (`YYYY-MM-DD`).

**Consider**: `date-fns` or `dayjs` for:
- Consistent date operations
- Better formatting
- Timezone handling
- Relative dates ("2 years ago")

**When**: When adding more date features (age calculations, anniversaries, etc.).

---

### **Refactoring Summary by Priority**

| Priority | Refactoring | Lines Saved | Effort | Impact |
|----------|------------|-------------|--------|--------|
| 1.1 | Extract gender/date utils | ~30 | 30 min | High |
| 1.2 | Extract update management hook | ~50 | 1 hour | High |
| 1.3 | Extract image picker hook | ~60 | 45 min | Medium |
| 2.1 | Extract gender selector | ~100 | 1.5 hours | Medium |
| 2.2 | Extract update card component | ~200 | 2-3 hours | High |
| 2.3 | Form validation utils | - | 2 hours | Medium |
| 3.1 | Extract large screen components | - | 1-2 days | Very High |
| 3.2 | Store selector optimization | - | 3-4 hours | Medium |
| 3.3 | Relationship query utils | - | 4-6 hours | Medium |

**Total Estimated Impact**: ~440 lines of duplicate code removed, better maintainability, improved testability.

**Recommended Order**:
1. Start with Priority 1 (easy wins) - Quick morale boost
2. Then Priority 2 (medium complexity) - Good ROI
3. Finally Priority 3 (strategic) - When planning larger features
4. Priority 4 (future) - As needed

---

**Overall Assessment**: 🟢 **Good foundation, ready for backend integration**
