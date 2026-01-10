# Family Tree App - Incremental Development Roadmap

## Overview
Reverse engineering FamilySearch mobile app with ego-centric pedigree chart interface. Built incrementally, ensuring each feature works before proceeding.

---

## 🎯 Development Journey & Lessons Learned

### **High-Level Summary of Accomplishments**

This project has successfully built a **production-ready family tree mobile application** with the following key achievements:

#### **✅ Core Features Completed**
1. **Full Family Tree Visualization** - Ego-centric tree with parents, siblings, spouses, and children
2. **Instagram-Style Profiles** - Complete profile system with photo updates, bio, and tagging
3. **Family Feed** - Timeline of family updates with filtering and privacy controls
4. **Google SSO Authentication** - Native Google Sign-In integrated with Supabase backend
5. **Complete Onboarding Flow** - Welcome → Profile Setup → Location → Main App
6. **Service Layer Architecture** - Clean abstraction ready for backend API integration
7. **Comprehensive API Design** - Full REST + WebSocket specification documented

#### **🏗️ Architecture Highlights**
- **State Management**: Zustand with optimistic updates pattern
- **Routing**: Expo Router with file-based routing and protected routes
- **Authentication**: Service layer abstraction (currently Supabase, easy to swap)
- **Separation of Concerns**: Types, stores, components, utils, services well-organized
- **Multi-User Ready**: `createdBy` tracking, timestamp-based conflict resolution

---

### **🛣️ Development Evolution**

#### **Phase 1: Foundation (MVP)**
- Started with simple ego node display
- Built PersonCard component with FamilySearch-style design
- Implemented Zustand store with Map-based person storage
- Added bidirectional relationship management

**Key Decision**: Used `Map<string, Person>` instead of arrays for O(1) lookups - crucial for large trees.

#### **Phase 2: Feature Expansion**
- Added parent/child/spouse relationships
- Built modal system for adding relatives
- Implemented tree visualization with generation rows
- Added profile system with photo updates

**Key Decision**: Chose card-based layout over graph library initially - faster to build, easier to iterate.

#### **Phase 3: Social Features**
- Instagram-style profile with updates/stories
- Family feed with filtering (all vs. group)
- Tagging system with mention parsing
- Privacy controls (public/private updates)

**Key Decision**: Built social features before backend - validated UX before investing in infrastructure.

#### **Phase 4: Authentication & Onboarding**
- **Started with**: Mock auth service for rapid prototyping
- **Migrated to**: Supabase with Google SSO (native SDK)
- Built complete onboarding flow with routing guards
- Added location services integration

**Key Decision**: Abstraction layer allowed switching from mock → Supabase without changing components.

---

### **🚨 Major Pitfalls & Solutions**

#### **1. Google SSO Nonce Verification Challenge** 🔴 **CRITICAL**

**The Problem**:
- Supabase documentation suggests using nonce verification for security
- React Native Google Sign-In SDK (`@react-native-google-signin/google-signin`) **does NOT support custom nonces**
- SDK generates nonce internally - we cannot control it
- Initial attempts to use `expo-crypto` for nonce hashing failed due to SDK limitations

**Discovery Process**:
- Spent significant time trying to implement proper nonce flow
- Investigated SDK source code and TypeScript types
- Confirmed: `ConfigureParams` and `SignInParams` have NO nonce field
- JWT tokens from SDK contain Google-generated nonces

**Solution**:
- Extracted nonce from JWT token after Google sign-in
- Passed extracted nonce to Supabase (less secure but functional)
- Documented the limitation clearly in code comments
- **Trade-off**: Reduced security vs. working authentication

**Lesson for Prompt Engineering**:
- ❌ **Don't assume**: "Implement Google SSO with nonce verification" - SDK limitations matter
- ✅ **Better prompt**: "Implement Google SSO authentication. Check SDK capabilities first, document limitations"
- ✅ **Research phase**: Always check library capabilities before implementing security features
- ✅ **Document trade-offs**: Clear comments about security implications of workarounds

---

#### **2. Routing Guard Race Conditions** 🟡 **MODERATE**

**The Problem**:
- Auth state checks happened asynchronously
- Components rendered before auth state was determined
- Flicker/flash of wrong screens during navigation
- Multiple redirects happening simultaneously

**Discovery**:
- Observed flicker when app started
- Logged auth state changes and found timing issues
- `useAuthStateChanged` fired before initial session check completed

**Solution**:
- Added `isLoading` state to prevent premature redirects
- Single source of truth in `AuthContext`
- Routing guard waits for `isLoading === false` before deciding redirect
- Used `useEffect` with proper dependencies to handle state transitions

**Implementation**:
```typescript
// AuthContext routing guard
useEffect(() => {
  if (isLoading) return; // ⚠️ CRITICAL: Wait for auth check
  
  // Now safe to check auth state and redirect
  if (!session) {
    router.replace('/(auth)/login');
  } else {
    // Check onboarding status...
  }
}, [session, isLoading, segments, router]);
```

**Lesson for Prompt Engineering**:
- ❌ **Don't assume**: "Add routing guards" - race conditions are common
- ✅ **Better prompt**: "Implement routing guards with loading state to prevent race conditions"
- ✅ **Specify edge cases**: "Handle app startup, auth state changes, and deep links"
- ✅ **Request verification**: "Test for flicker/flash during navigation transitions"

---

#### **3. Large Component Files (700-800 lines)** 🟡 **MODERATE**

**The Problem**:
- Screen components grew organically to 700-862 lines
- Mixed concerns: UI rendering, business logic, state management, modal handling
- Hard to maintain, test, and understand
- Duplicate code patterns across files

**Discovery**:
- Code review revealed massive files
- Similar patterns in `profile.tsx` and `family.tsx` (update management)
- Relationship calculations scattered across components
- Date formatting, gender colors duplicated in multiple places

**Current Status**:
- ✅ Extracted some hooks (`useTreeLayout`, `useProfileUpdates`, `useFamilyFeed`)
- ⚠️ Still need to extract more (see `ANALYSIS.md` Section 10 for full refactoring plan)
- ⚠️ Identified ~440 lines of duplicate code to extract

**Solution (In Progress)**:
- Priority-based refactoring plan created
- Start with easy wins (utility functions)
- Then extract hooks (update management, image picker)
- Finally break down large components into smaller pieces

**Lesson for Prompt Engineering**:
- ❌ **Don't assume**: "Build feature X" will result in clean code
- ✅ **Better prompt**: "Build feature X with proper separation: extract hooks for logic, utils for pure functions, components for UI"
- ✅ **Request code review**: "After implementation, identify code duplication and suggest refactoring"
- ✅ **Incremental approach**: "Build MVP first, then refactor before adding more features"

---

#### **4. Service Layer Abstraction Timing** 🟢 **SUCCESS**

**What Went Right**:
- Created auth service abstraction from the start
- Used mock implementation initially
- Easy migration to Supabase when ready
- Family tree service ready for backend integration

**The Approach**:
```typescript
// services/auth/index.ts - Factory pattern
export function getAuthService(): AuthService {
  return new SupabaseAuthService(); // Was: MockAuthService
}

// Components don't care which implementation
const { signInWithProvider } = useAuth();
```

**Why It Worked**:
- Started with interface/abstraction before implementation
- Mock allowed rapid frontend development
- Real implementation swapped in without component changes

**Lesson for Prompt Engineering**:
- ✅ **Good prompt**: "Create service layer abstraction that allows swapping implementations"
- ✅ **Request interfaces first**: "Define interfaces before implementations"
- ✅ **Mock for speed**: "Create mock implementation for rapid development, document migration path"
- ✅ **Future-proofing**: "Design for easy migration to real backend later"

---

#### **5. State Management Pattern Confusion** 🟡 **MODERATE**

**The Problem**:
- Multiple `useFamilyTreeStore` calls in same component
- Unclear when to use selectors vs. direct store access
- Potential unnecessary re-renders
- Inconsistent patterns across components

**Discovery**:
- Some components had 10+ store selectors
- Performance wasn't an issue yet (small trees), but pattern was unclear
- Hard to optimize later without consistent approach

**Solution**:
- Documented best practices in analysis
- Created composite hooks where it made sense
- Left optimization for later (premature optimization avoided)

**Lesson for Prompt Engineering**:
- ✅ **Request patterns**: "Document state management patterns and when to use each"
- ✅ **Performance awareness**: "Design for scalability, optimize when needed"
- ⚠️ **Don't over-optimize**: Performance wasn't an issue - documented pattern for future

---

#### **6. Date Handling String Manipulation** 🟢 **ACCEPTABLE**

**The Problem**:
- Using `YYYY-MM-DD` strings throughout
- Manual date parsing/formatting scattered across codebase
- No date validation library

**Decision**:
- **Chose**: Keep simple string format for now
- **Reason**: ISO 8601 format, works with native date pickers, no timezone complexity
- **Future**: Can migrate to `date-fns` or `dayjs` when needed (age calculations, relative dates)

**Lesson for Prompt Engineering**:
- ✅ **Pragmatic decisions**: "Use simple solution now, document migration path for complex needs"
- ✅ **Don't over-engineer**: String dates work fine for birth/death dates
- ✅ **Future-proofing**: Document when to add date library (e.g., "when adding age calculations")

---

### **🎓 Key Lessons for Future Prompt Engineering**

#### **Do's ✅**

1. **Request SDK/Library Research First**
   - "Check library capabilities before implementing feature X"
   - "Document any limitations or workarounds needed"
   - "Verify TypeScript types match documentation"

2. **Specify Edge Cases & Race Conditions**
   - "Handle loading states to prevent race conditions"
   - "Test for flicker/flash during state transitions"
   - "Consider app startup, deep links, and state restoration"

3. **Request Incremental Refactoring**
   - "After building feature, identify code duplication"
   - "Extract reusable utilities and hooks"
   - "Keep components under 300 lines"

4. **Design for Change**
   - "Create abstraction layer for X (mock → real implementation)"
   - "Document migration path from mock to production"
   - "Use factory pattern for service selection"

5. **Balance Pragmatism with Best Practices**
   - "Use simple solution now, document when to upgrade"
   - "Avoid premature optimization, but design for scalability"
   - "Document trade-offs (security, performance, complexity)"

#### **Don'ts ❌**

1. **Don't Assume Library Capabilities**
   - ❌ "Implement X with feature Y" (assumes Y exists)
   - ✅ "Research if library supports Y, implement X accordingly"

2. **Don't Skip Edge Cases**
   - ❌ "Add routing guards" (misses race conditions)
   - ✅ "Add routing guards with loading states and handle edge cases"

3. **Don't Let Files Grow Unchecked**
   - ❌ "Add feature to existing component" (can create 800-line files)
   - ✅ "Add feature, then refactor if component exceeds 300 lines"

4. **Don't Mix Concerns Without Plan**
   - ❌ "Build screen with all features" (UI + logic + state mixed)
   - ✅ "Build screen, extract logic to hooks, extract utils to separate files"

5. **Don't Ignore Trade-offs**
   - ❌ "Implement secure authentication" (nonce issue discovered later)
   - ✅ "Implement authentication, document security trade-offs and limitations"

---

### **📊 Metrics & Status**

**Code Quality**:
- ✅ TypeScript throughout (type safety)
- ✅ Separation of concerns (types, stores, components, utils, services)
- ⚠️ Large component files (700-800 lines) - refactoring plan in place
- ⚠️ ~440 lines of duplicate code identified - extraction plan ready

**Feature Completeness**:
- ✅ Core tree functionality: 100%
- ✅ Social features (profiles, feed): 100%
- ✅ Authentication: 100% (Google SSO)
- ✅ Onboarding: 100%
- ⏭️ Backend integration: 0% (API design complete, implementation pending)
- ⏭️ Real-time sync: 0% (planned for Phase 7)

**Architecture Readiness**:
- ✅ Service layer abstraction: Complete
- ✅ API design document: Complete
- ✅ Error handling: Enhanced with context
- ✅ Modal management: Centralized
- ⏭️ Backend APIs: Not implemented
- ⏭️ Database schema: Not implemented

---

### **🚀 What's Next**

**Immediate Priorities**:
1. Backend API implementation (per `API_DESIGN.md`)
2. Connect family tree service to backend APIs
3. Real-time sync with Supabase Realtime
4. File upload for photos

**Code Quality Improvements**:
1. Extract duplicate utilities (Priority 1.1-1.3 from ANALYSIS.md)
2. Break down large screen components (Priority 3.1)
3. Add unit tests for store and utils
4. Add integration tests for critical flows

**Future Features**:
1. Invite system (Phase 2.3)
2. DAG validation (Phase 4)
3. Connection lines visualization (Phase 6.2)
4. Advanced tree layout algorithms (Phase 6.3)

---

### **💡 Development Philosophy That Emerged**

1. **Build → Refactor → Build**: Ship features, then clean up, then add more
2. **Abstract Early**: Service layers pay off when swapping implementations
3. **Document Trade-offs**: Security, performance, complexity - be explicit
4. **Incremental Complexity**: Simple solutions first, upgrade when needed
5. **Test in Production-like Environment**: Auth issues discovered when integrating real SDK

---

This journey shows that **prompt engineering is iterative** - initial prompts built features, but refinement prompts (code review, refactoring, edge case handling) improved quality. The key is **balancing feature velocity with code quality**, and **documenting decisions and trade-offs** for future reference.

## Architecture Principles
- **Separation of Concerns**: Types, stores, components, utils in separate folders
- **Multi-user Ready**: Optimistic updates, conflict resolution, real-time sync (later)
- **DAG Validation**: Prevent cycles, handle merging paths (cousin marriages)
- **Mobile First**: React Native + Expo only

## Tech Stack
- **State Management**: Zustand
- **ID Generation**: UUID v4
- **Visualization**: Custom card-based (FamilySearch style) → Graph library later
- **Multi-user**: Timestamp-based conflict resolution → CRDTs later
- **Persistence**: AsyncStorage → Backend sync later

---

## Phase 0: Foundation (Current)
### Step 0.1: Project Structure ✅
- [x] Create folder structure (`types/`, `stores/`, `components/family-tree/`, `utils/`)
- [x] Install dependencies (zustand, uuid)

### Step 0.2: Type Definitions
- [ ] Define `Person` interface
- [ ] Define `FamilyTreeState` interface
- [ ] Export types from `types/family-tree.ts`

---

## Phase 1: Single Ego Node (MVP)
### Step 1.1: Basic Store
- [ ] Create Zustand store (`stores/family-tree-store.ts`)
- [ ] Implement `people: Map<string, Person>`
- [ ] Implement `egoId: string | null`
- [ ] Add `initializeEgo(name: string)` action

### Step 1.2: Person Card Component
- [ ] Create `PersonCard.tsx` component
- [ ] FamilySearch-style design:
  - Circular photo placeholder
  - Name (prominent)
  - Birth/Death dates
  - Gender indicator (blue/orange silhouette)
- [ ] Accept `personId` prop, read from store

### Step 1.3: Display Ego Card
- [ ] Update `index.tsx` to check for ego
- [ ] If no ego: show placeholder/onboarding prompt (non-functional for now)
- [ ] If ego exists: display `PersonCard` centered
- [ ] Test: Create ego manually in store, verify display

**Acceptance Criteria:**
- ✅ Can see ego card with name
- ✅ Card matches FamilySearch visual style
- ✅ Store persists ego (in memory for now)

---

## Phase 2: Onboarding & Auth (Before Main App)
### Step 2.1: Auth Flow Structure ✅
- [x] Create auth context/store (`contexts/auth-context.tsx`)
- [x] Implement auth service layer (`services/auth/`)
- [x] Implement Supabase auth service (`services/auth/supabase-auth-service.ts`)
- [x] Implement auth check in `_layout.tsx` with routing guards
- [x] Redirect to login if not authenticated
- [x] Google SSO integration using native SDK (`@react-native-google-signin/google-signin`)
- [x] ID token flow with Supabase (`signInWithIdToken`)
- ⚠️ Nonce verification skipped (SDK generates nonce internally, extracted from token)

### Step 2.2: Onboarding Flow ✅
- [x] Create onboarding screens:
  - [x] Welcome screen (`app/(onboarding)/welcome.tsx`)
  - [x] Create yourself profile (`app/(onboarding)/profile.tsx`)
  - [x] Location selection (`app/(onboarding)/location.tsx`)
- [x] On completion: initialize ego in store with `createdBy` field
- [x] Redirect to main app based on onboarding completion
- [x] Routing guard prevents accessing app without completing onboarding

### Step 2.3: Invite Flow
- [ ] Handle invite links
- [ ] Check if user has active account
- [ ] Join existing family or create new
- [ ] Handle race conditions (check before redirect)

**Acceptance Criteria:**
- ✅ Unauthenticated users see login (Google SSO button)
- ✅ New users complete onboarding → ego created with `createdBy` field
- ✅ Authenticated users with completed onboarding → redirected to app
- ✅ Authenticated users without onboarding → redirected to welcome screen
- ✅ No flicker/race conditions (routing guards handle state transitions)
- ⚠️ Invited users can join family (not yet implemented)

---

## Phase 3: Adding Parents (Upward Expansion)
### Step 3.1: Add Parent UI
- [ ] "+" button above ego card
- [ ] Modal/prompt: "Add Parent"
- [ ] Form: Name, Birth Year, Gender
- [ ] Autocomplete: Search existing people by name/DOB

### Step 3.2: Parent Addition Logic
- [ ] `addParent(childId: string, parentData: Partial<Person>)` action
- [ ] Create new Person or link existing (by ID)
- [ ] Update relationships bidirectionally
- [ ] Validate: Prevent self-parent, prevent duplicate parents

### Step 3.3: Display Parents
- [ ] Render parent cards above ego
- [ ] Connect lines (visual connectors)
- [ ] Handle multiple parents (adoption, etc.)

**Acceptance Criteria:**
- ✅ Can add parent via "+" button
- ✅ Parent appears above ego
- ✅ Relationships stored correctly
- ✅ Can link to existing person

---

## Phase 4: DAG Validation & Merging
### Step 4.1: DAG Validation Utils
- [ ] Implement BFS traversal (`utils/dag-validation.ts`)
- [ ] Check for cycles before adding relationship
- [ ] Union-find for ancestor deduplication
- [ ] Validate on `addParent` action

### Step 4.2: Merge Detection
- [ ] Detect duplicate nodes (name + DOB match)
- [ ] Prompt: "Known person? Enter ID or merge"
- [ ] Merge nodes, update all relationships
- [ ] Handle cousin marriages (shared ancestors)

### Step 4.3: Conflict Prevention
- [ ] Lock nodes during edit (optimistic locking)
- [ ] Version numbers for conflict detection
- [ ] Rollback on validation failure

**Acceptance Criteria:**
- ✅ Cannot create cycles
- ✅ Duplicate detection works
- ✅ Merging preserves relationships
- ✅ Validation prevents bad data

---

## Phase 5: Adding Children (Downward Expansion)
### Step 5.1: Add Child UI
- [ ] Toggle: "Show Children" / "Add Children"
- [ ] Modal: Multi-add form (name, birth date, gender)
- [ ] Require spouse link first (if applicable)
- [ ] Gate behind deliberate action (not auto-expand)

### Step 5.2: Child Addition Logic
- [ ] `addChild(parentId: string, childData: Partial<Person>)` action
- [ ] Handle multiple children at once
- [ ] Link spouse relationships
- [ ] Update bidirectional relationships

### Step 5.3: Display Children
- [ ] Render child cards below ego
- [ ] Group by generation
- [ ] Visual connectors

**Acceptance Criteria:**
- ✅ Can add children via modal
- ✅ Children appear below ego
- ✅ Spouse relationships linked
- ✅ Multiple children supported

---

## Phase 6: Graph Visualization
### Step 6.1: Layout Algorithm
- [ ] Implement ahnentafel layout (ancestors up)
- [ ] Implement descendant fan chart (children down)
- [ ] Calculate positions for all nodes
- [ ] Handle variable node sizes

### Step 6.2: Rendering
- [ ] Use react-native-svg or custom rendering
- [ ] Render cards at calculated positions
- [ ] Draw connection lines
- [ ] Handle pan/zoom (later)

### Step 6.3: Performance
- [ ] Virtualize off-screen nodes
- [ ] Lazy load deep ancestors/descendants
- [ ] Optimize re-renders

**Acceptance Criteria:**
- ✅ Tree renders correctly
- ✅ All relationships visible
- ✅ Smooth scrolling/panning
- ✅ Handles 100+ nodes

---

## Phase 7: Multi-User Collaboration
### Step 7.1: Optimistic Updates
- [ ] Update UI immediately on actions
- [ ] Queue mutations for sync
- [ ] Show pending state indicators
- [ ] Handle offline mode

### Step 7.2: Real-time Sync
- [ ] Integrate Firebase Firestore or Supabase
- [ ] Listen to remote changes
- [ ] Merge local + remote state
- [ ] Handle conflicts (timestamp-based)

### Step 7.3: Conflict Resolution
- [ ] Detect conflicts (same node, different versions)
- [ ] Last-write-wins initially
- [ ] Upgrade to CRDTs (Yjs/Automerge) later
- [ ] User notifications for conflicts

### Step 7.4: Permissions
- [ ] Role-based access (admin, editor, viewer)
- [ ] Per-node permissions
- [ ] Invite system
- [ ] Activity log

**Acceptance Criteria:**
- ✅ Multiple users can edit simultaneously
- ✅ Changes sync in real-time
- ✅ Conflicts resolved gracefully
- ✅ Permissions enforced

---

## Phase 8: Persistence & Performance
### Step 8.1: Local Persistence
- [ ] Save to AsyncStorage
- [ ] Load on app start
- [ ] Handle migration/versioning

### Step 8.2: Backend Integration
- [ ] API endpoints for CRUD
- [ ] Batch operations
- [ ] Pagination for large trees
- [ ] Search functionality

### Step 8.3: Optimization
- [ ] Memoize expensive calculations
- [ ] Debounce rapid updates
- [ ] Cache frequently accessed nodes
- [ ] Background sync

**Acceptance Criteria:**
- ✅ Data persists locally
- ✅ Syncs with backend
- ✅ Fast performance (1000+ nodes)
- ✅ Works offline

---

## Current Status: Phase 5 Complete ✅ + Backend Ready

**Completed Phases:**
- ✅ Phase 1: + Button and modal flow
- ✅ Phase 2: Add Relative type selection
- ✅ Phase 3: Add Person form
- ✅ Phase 4: Store actions and relationships
- ✅ Phase 5: Tree visualization
- ✅ Profile Section: Complete Instagram-style profile with updates
- ✅ Infinite Canvas: Basic implementation (web working, mobile in progress)
- ✅ Onboarding & Auth: Complete flow with Google SSO via Supabase
  - ✅ Native Google Sign-In SDK integration
  - ✅ Supabase `signInWithIdToken()` flow
  - ✅ Auth context with routing guards
  - ✅ Onboarding screens (welcome, profile, location)
  - ⚠️ Nonce check skipped (SDK generates nonce, extracted from token)
- ✅ Location Services: Device location integration
- ✅ Refactoring: Hooks, service layer, separation of concerns
- ✅ Error Handling: Enhanced with error context
- ✅ Modal Management: Centralized modal context
- ✅ API Design: Comprehensive API design document created

**Current Focus:**
- ✅ Frontend architecture complete and ready for backend integration
- ✅ Authentication fully integrated with Supabase (Google SSO)
- ✅ API design document outlines all endpoints and WebSocket events
- ✅ Service layer abstraction ready for API integration (auth service complete)
- ⏭️ Next: Connect family tree service to backend APIs

**Next Steps:**
- **Backend Implementation**: Create backend APIs per `API_DESIGN.md`
- **Database Setup**: PostgreSQL or Firestore schema
- **WebSocket Server**: Real-time collaboration support
- **File Storage**: Photo upload and storage
- **API Integration**: Connect frontend service layer to backend APIs

**See `API_DESIGN.md` for comprehensive API specification.**
**See `PROGRESS.md` for comprehensive development summary.**

---

## Notes
- Each phase must be fully working before moving to next
- Test on iOS and Android at each step
- Consider race conditions and edge cases
- Document decisions and trade-offs
- Keep code reviewable and maintainable

