# Family Tree App - Current State & Roadmap Analysis

## 🎯 What We Just Completed

### ✅ @Mention Tagging System
**What it was (chip-based tagging):**
- Horizontal scrollable chips showing all family members
- Tap chips to select/deselect people to tag
- Visual checkmarks on selected chips
- Separate UI section above caption field

**What it is now (@mention tagging):**
- Natural Instagram-style @mentions in caption text
- Parse `@name` patterns from caption automatically
- Match names to people in tree (exact, first name, last name, partial)
- Extract person IDs and store in `taggedPersonIds`
- Display @mentions with blue highlight in captions
- "Group Photos" filter shows updates with 4+ tagged people

**Files Changed:**
- `utils/mentions.ts` - New utility for parsing and matching mentions
- `utils/format-mentions.tsx` - New utility for styling @mentions in display
- `components/family-tree/AddUpdateModal.tsx` - Removed chip UI, added @mention parsing
- `app/(tabs)/explore.tsx` - Added @mention formatting in captions
- `app/(tabs)/profile.tsx` - Added @mention formatting in captions

---

## 📍 Where We Are Now

### ✅ Completed Features

#### Core Tree Functionality
- ✅ Ego-centric family tree visualization
- ✅ Add relatives (parent, spouse, child, sibling) from any card
- ✅ Recursive generation display (ancestors/descendants)
- ✅ Infinite canvas with pan/zoom
- ✅ Horizontal layout for spouses/siblings
- ✅ Vertical layout for ancestors/descendants

#### Profile & Updates
- ✅ Instagram-style profile pages
- ✅ Add/edit/delete updates (photos with captions)
- ✅ Privacy toggle (public/private)
- ✅ Update timeline display
- ✅ View other people's profiles (modal route)

#### Family Feed (Explore Tab)
- ✅ Aggregated feed of all family updates
- ✅ Family header (photo placeholder + name)
- ✅ Filter: "All" vs "Group Photos" (4+ tagged people)
- ✅ Tagged people display ("With [names]")
- ✅ Add updates from feed
- ✅ Edit/delete own updates only

#### Tagging System
- ✅ @mention parsing from captions
- ✅ Name matching (exact, first name, last name, partial)
- ✅ Tagged people display
- ✅ Group Photos filter
- ✅ Styled @mentions in captions (blue highlight)

#### Collaboration Features (Phase 1-2)
- ✅ Phone number field on Person
- ✅ Native share sheet for invites
- ✅ Profile viewing for all family members
- ✅ Modal routes for non-ego profiles

---

## 🗺️ Where We Want to Go

### Phase 3: Invite System (Backend Required)
**Goal:** Generate unique invite codes/links, support deep linking, accept/reject flow

**What's Needed:**
- Backend API for invite code generation
- Database to store invites (code, personId, status, expiresAt)
- Deep linking configuration (`yourapp://invite/{code}`)
- Accept/reject invite UI flow
- Link phone numbers to user accounts

**Questions to Answer:**
1. **Backend Choice:** Supabase, Firebase, or custom Node.js API?
2. **Invite Format:** UUID-based codes or shorter human-readable codes?
3. **Expiration:** Should invites expire? How long?
4. **Account Linking:** How do we link phone numbers to user accounts?
5. **Deep Linking:** Use Expo Linking or custom scheme handler?

### Phase 4: Multi-User Collaboration (Backend Required)
**Goal:** Real-time sync, conflict resolution, multi-user editing

**What's Needed:**
- User authentication system
- Backend database (people, updates, relationships)
- Real-time sync (Firestore/Supabase subscriptions)
- Conflict resolution (timestamp-based → CRDTs later)
- Optimistic updates with pending states
- Offline support

**Questions to Answer:**
1. **Auth Provider:** Firebase Auth, Supabase Auth, or custom?
2. **Sync Strategy:** Real-time subscriptions or polling?
3. **Conflict Resolution:** Last-write-wins initially, then CRDTs?
4. **Permissions:** Role-based (admin/editor/viewer) or per-node?
5. **Offline:** How much data to cache locally?

### Phase 5: Advanced Features
**Goal:** Enhanced UX, performance, scalability

**What's Needed:**
- Photo upload to cloud storage
- Search functionality
- Notifications for tags/updates
- Activity log/feed improvements
- Performance optimization (virtualization, lazy loading)

**Questions to Answer:**
1. **Photo Storage:** Cloudinary, AWS S3, or Firebase Storage?
2. **Search:** Full-text search or simple name matching?
3. **Notifications:** Push notifications or in-app only?
4. **Performance:** When to add virtualization? (100+ nodes? 1000+?)

---

## 🤔 Key Questions We Need to Answer

### 1. Backend Architecture
**Question:** What backend infrastructure should we use?

**Options:**
- **Supabase** (PostgreSQL + real-time + auth)
  - Pros: Real-time subscriptions, SQL database, built-in auth, free tier
  - Cons: Learning curve, vendor lock-in
- **Firebase** (Firestore + Auth + Storage)
  - Pros: Real-time, easy setup, Google ecosystem
  - Cons: NoSQL, vendor lock-in, pricing can scale
- **Custom Node.js API**
  - Pros: Full control, any database, flexible
  - Cons: More setup/maintenance, need to build everything

**Recommendation:** Start with Supabase for MVP (real-time + SQL + auth), can migrate later if needed.

### 2. Invite System Design
**Question:** How should invites work?

**Current State:** 
- Phone number stored on Person
- Native share sheet for sending invites
- Placeholder message: "[Invite link will be added here in Phase 3]"

**Design Decisions Needed:**
- **Invite Code Format:** UUID (long but unique) vs short codes (6-8 chars, need collision handling)
- **Invite Link Format:** `yourapp://invite/{code}` vs `https://app.com/invite/{code}` (web fallback)
- **Expiration:** Should invites expire? (e.g., 30 days)
- **One-time vs Multi-use:** Can one invite be used multiple times?
- **Account Linking:** When someone accepts invite, do they:
  - Create new account linked to that Person?
  - Join existing family tree?
  - Merge with existing account?

**Recommendation:** 
- Short codes (8 chars, alphanumeric)
- Expire after 30 days
- One-time use (mark as "accepted" after first use)
- Deep link: `yourapp://invite/{code}` with web fallback

### 3. User Account Model
**Question:** How do users relate to people in the tree?

**Current State:**
- No user accounts yet
- Single ego per app instance
- All data is local (Zustand store)

**Design Decisions Needed:**
- **One-to-One:** One user account = one Person in tree?
- **One-to-Many:** One user can manage multiple trees?
- **Many-to-One:** Multiple users can edit same Person? (e.g., siblings both editing parent's info)
- **Account Creation:** When does account get created? (onboarding vs invite acceptance)

**Recommendation:**
- One user account = one Person (ego)
- User can view/edit their own Person + relatives
- Multiple users can edit same Person (with conflict resolution)
- Account created during onboarding OR when accepting invite

### 4. Data Sync Strategy
**Question:** How should data sync between devices/users?

**Current State:**
- All data local (Zustand Maps)
- No persistence yet
- No sync

**Design Decisions Needed:**
- **Real-time:** WebSocket subscriptions (Firestore/Supabase) vs polling?
- **Optimistic Updates:** Update UI immediately, sync in background?
- **Conflict Resolution:** Last-write-wins vs CRDTs vs manual merge?
- **Offline Support:** How much to cache? What happens when offline?

**Recommendation:**
- Real-time subscriptions (Supabase/Firestore)
- Optimistic updates (show changes immediately)
- Timestamp-based conflict resolution initially (last-write-wins)
- Cache last 100 updates + all people locally
- Queue mutations when offline, sync when online

### 5. Permissions & Access Control
**Question:** Who can edit what?

**Current State:**
- No permissions system
- Anyone can edit anything (in local state)

**Design Decisions Needed:**
- **Role-based:** Admin/Editor/Viewer roles?
- **Per-node:** Each Person has edit permissions?
- **Relationship-based:** Can edit yourself + direct relatives?
- **Invite-based:** Only people invited to tree can edit?

**Recommendation:**
- Start simple: Anyone in tree can edit anything
- Add per-node permissions later (e.g., "only I can edit my profile")
- Role-based for tree-level permissions (admin can delete tree, etc.)

### 6. Photo Storage
**Question:** Where should photos be stored?

**Current State:**
- Photos stored as local URIs (`file://` paths)
- No cloud storage

**Design Decisions Needed:**
- **Storage Provider:** Cloudinary, AWS S3, Firebase Storage, Supabase Storage?
- **Image Processing:** Resize/compress on upload?
- **CDN:** Use CDN for fast delivery?
- **Cost:** Free tier limits? Pricing model?

**Recommendation:**
- Supabase Storage (if using Supabase) or Cloudinary
- Resize to max 2000px width, compress to 80% quality
- Use CDN for delivery
- Free tier should cover MVP needs

---

## 🚀 Next Steps (Incremental)

### Immediate (No Backend Required)
1. ✅ **@Mention Tagging** - DONE
2. **Photo Upload to Cloud** - Add cloud storage integration
3. **Search Functionality** - Search people by name in tree
4. **Notifications** - In-app notifications for tags/mentions

### Short-term (Backend MVP)
1. **Backend Setup** - Choose and set up Supabase/Firebase
2. **User Authentication** - Email/phone auth
3. **Local Persistence** - Save to AsyncStorage, load on startup
4. **Basic Sync** - One-way sync (local → backend) initially

### Medium-term (Full Backend)
1. **Real-time Sync** - Two-way sync with subscriptions
2. **Invite System** - Generate codes, deep linking, accept flow
3. **Conflict Resolution** - Handle simultaneous edits
4. **Multi-user Testing** - Test with multiple users/devices

### Long-term (Advanced Features)
1. **CRDTs** - Upgrade conflict resolution to CRDTs
2. **Advanced Search** - Full-text search, filters
3. **Push Notifications** - Notify on tags/updates
4. **Performance** - Virtualization, lazy loading, optimization

---

## 📊 Current Architecture

### Frontend (React Native + Expo)
- **State:** Zustand store (Maps for O(1) lookups)
- **Navigation:** Expo Router (file-based routing)
- **UI:** Custom components (Instagram/FamilySearch inspired)
- **Data:** Local only (no backend yet)

### Data Structure
```typescript
Person {
  id: string (UUID)
  name: string
  phoneNumber?: string
  // ... relationships, timestamps, etc.
}

Update {
  id: string (UUID)
  personId: string
  title: string
  photoUrl: string (local URI)
  caption?: string (with @mentions)
  taggedPersonIds?: string[]
  // ... timestamps, privacy, etc.
}
```

### What's Missing
- ❌ Backend API
- ❌ User authentication
- ❌ Cloud storage
- ❌ Real-time sync
- ❌ Local persistence (AsyncStorage)
- ❌ Deep linking
- ❌ Invite system

---

## 🎯 Success Criteria

### MVP (Minimum Viable Product)
- ✅ Core tree functionality
- ✅ Profile & updates
- ✅ Family feed
- ✅ @Mention tagging
- ⏳ Backend sync (in progress)
- ⏳ User accounts (next)
- ⏳ Invite system (next)

### Full Product Vision
- Multi-user collaboration
- Real-time sync
- Invite system
- Cloud photo storage
- Search & discovery
- Notifications
- Mobile + web support

---

## 💡 Key Insights

1. **Incremental Approach Works:** We've built complex features incrementally without breaking existing functionality
2. **Frontend-First Strategy:** Building UI/UX first, backend later, allows for faster iteration
3. **Natural Patterns:** @Mentions feel more natural than chip-based tagging (Instagram/Twitter pattern)
4. **Backend Decision Needed:** We're at the point where backend choice will impact architecture
5. **Data Model is Solid:** Current Person/Update structure supports multi-user collaboration

---

## 🔄 Migration Path

### When Adding Backend:
1. **Keep Local State:** Zustand store remains, syncs with backend
2. **Add Sync Layer:** Create sync service that reads/writes to backend
3. **Gradual Migration:** Start with one-way sync (local → backend), then two-way
4. **Conflict Handling:** Add version numbers, timestamps for conflict detection
5. **Offline Support:** Queue mutations when offline, sync when online

### When Adding Auth:
1. **Onboarding Flow:** Create account during initial setup
2. **Invite Flow:** Link account when accepting invite
3. **Session Management:** Store auth token, refresh as needed
4. **Protected Routes:** Redirect to login if not authenticated

---

*Last Updated: After @Mention Tagging Implementation*

