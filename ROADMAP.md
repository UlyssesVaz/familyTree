# Family Tree App - Incremental Development Roadmap

## Overview
Reverse engineering FamilySearch mobile app with ego-centric pedigree chart interface. Built incrementally, ensuring each feature works before proceeding.

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

