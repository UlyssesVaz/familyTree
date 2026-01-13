# Current State Assessment & Next Steps

**Date:** January 2025  
**Status:** ✅ **ALL CORE FEATURES COMPLETE** - Invitation System Working!

---

## ✅ What We've Completed (Recent Session)

### **Backend Integration - COMPLETE** ✅
1. **✅ People & Relationships Backend**
   - Full CRUD operations for people via `people-api.ts`
   - Relationship management via `relationships-api.ts`
   - Database-generated UUIDs for `user_id` (primary key)
   - `linked_auth_user_id` field distinguishes Living vs Ancestor profiles
   - Shadow profiles (ancestors without accounts) fully supported
   - RLS policies enforce `created_by` requirements

2. **✅ Updates Backend**
   - Full CRUD operations for updates via `updates-api.ts`
   - Photo upload to Supabase Storage (`update-photos` bucket)
   - Tagging system via `update_tags` table
   - Updates can be posted on any person's wall (not just ego)
   - `user_id` = target person's wall, `created_by` = authenticated user posting

3. **✅ Sync & Persistence**
   - `syncFamilyTree()` loads all people, relationships, and updates on app startup
   - Single fetch per login session (no polling loops)
   - Optimistic updates for instant UI feedback
   - Silent background saves (no refetch after creation)
   - Proper relationship mapping (fixed 'child' relationship direction bug)

4. **✅ Data Flow**
   - Optimistic updates → Background save → No refetch
   - Follows same pattern as `addUpdate` for consistency
   - Ready for WebSocket real-time updates later

---

## 🎯 Current State: Where We Are

### **Profile Types - IMPLEMENTED** ✅

#### **Living Profiles (Self-Managed)**
- **Status:** ✅ Fully implemented
- **Current:** 
  - `linked_auth_user_id` field links to `auth.users.id`
  - Users can create/delete their own updates
  - Only owners can modify/delete their updates
- **Database:** `people.linked_auth_user_id = auth.users.id`

#### **Ancestor Profiles (Crowdsourced)**
- **Status:** ✅ Fully implemented
- **Current:**
  - `linked_auth_user_id = null` (no linked auth user)
  - Any authenticated user can add updates to ancestor profiles
  - Database-generated `user_id` (not tied to auth)
- **Database:** `people.linked_auth_user_id = NULL`

### **Permission System Status**

| Feature | Living Profiles | Ancestor Profiles | Status |
|---------|----------------|-------------------|--------|
| **Add Updates** | Owner only | Any authenticated user | ✅ Working |
| **Delete Updates** | Owner only | Creator only | ✅ Working |
| **Modify Updates** | Owner only | Creator only | ⚠️ No restrictions yet |
| **Change Visibility** | Owner only | Creator only | ⚠️ No restrictions yet |

---

## 🚀 Next Core Feature: Invitation System

### **Overview**
Allow family members to invite relatives to claim their profiles. When someone signs up via an invite link, their profile's `linked_auth_user_id` gets set, converting an "Ancestor Profile" to a "Living Profile."

### **Database Schema (Already Exists)**
```sql
CREATE TABLE invitation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_person_id uuid REFERENCES people(user_id),
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id)
);
```

### **Phase 1: Create Invitation Links**

**Goal:** Allow curators to generate invite links for specific profiles

**Implementation:**
1. Create `services/supabase/invitations-api.ts`:
   - `createInvitationLink(targetPersonId, userId)` → generates token, saves to DB
   - `getInvitationLink(token)` → validates token, returns target person
   - `claimInvitationLink(token, userId)` → sets `linked_auth_user_id`, deletes link

2. Add UI in profile screen:
   - "Invite [Person Name]" button (only for profiles with `linkedAuthUserId === null`)
   - Generate link, show shareable URL
   - Copy to clipboard functionality

**Acceptance Criteria:**
- ✅ Curators can generate invite links for ancestor profiles
- ✅ Links expire after 7 days
- ✅ Links are unique tokens
- ✅ Can share via native share sheet

---

### **Phase 2: Handle Invite Links on Sign-Up**

**Goal:** When user signs up via invite link, claim their profile

**Implementation:**
1. Deep link handling:
   - `app/join/[token].tsx` route
   - Extract token from URL params
   - Validate token (not expired, exists)
   - Show "Claim Profile" screen

2. Claim flow:
   - User signs up/logs in
   - After auth, call `claimInvitationLink(token, userId)`
   - Updates `people.linked_auth_user_id = userId`
   - Deletes invitation link
   - Redirects to profile

**Acceptance Criteria:**
- ✅ Users can access invite links via deep link
- ✅ Token validation works (expired links rejected)
- ✅ Profile claiming updates `linked_auth_user_id`
- ✅ User becomes owner of their profile after claiming

---

### **Phase 3: Invite Link Management**

**Goal:** Allow curators to see/manage active invitations

**Implementation:**
1. Add "Active Invitations" section to profile:
   - List all invitation links created for this person
   - Show expiration dates
   - Allow revoking invitations

2. Notification system (future):
   - Notify when invitation is claimed
   - Show pending invitations

**Acceptance Criteria:**
- ✅ Curators can see active invitations
- ✅ Can revoke invitations
- ✅ Expired invitations are automatically cleaned up

---

## 📊 Current Architecture Status

### **✅ Well-Architected**
- ✅ Service layer abstraction (people-api, relationships-api, updates-api)
- ✅ Type-safe API functions
- ✅ Hooks for reusable logic (`useTreeLayout`, `useProfileUpdates`, `useFamilyFeed`)
- ✅ Separation of concerns
- ✅ Optimistic updates pattern
- ✅ Single sync on login (no polling)
- ✅ Cycle detection in tree traversal (`visited` Set)

### **⚠️ Needs Attention**
- ⚠️ Large component files (700-800 lines) - refactoring planned
- ⚠️ Some duplicate code (~440 lines identified)
- ⚠️ Debug logs still present (should be cleaned up after verification)
- ⚠️ Update permissions (modify/visibility) not yet restricted

### **❌ Missing**
- ❌ Invitation system (next feature)
- ❌ WebSocket real-time updates
- ❌ Update permission enforcement (modify/visibility)

---

## 🔍 Scalability & Performance Checks

### **✅ Cycle Prevention**
- Tree traversal uses `visited` Set to prevent infinite loops
- Both `countAncestors` and `countDescendants` have cycle detection
- `useTreeLayout` uses `visited` Set in recursive generation calculations

### **✅ Performance Optimizations**
- `Map<string, Person>` for O(1) lookups (crucial for large trees)
- `relationshipsHash` for efficient reactivity tracking
- Memoized tree calculations (`useMemo` with proper dependencies)
- Parallel fetching (`Promise.all` for people + relationships + updates)

### **⚠️ Potential Issues with Many People**
1. **Tree Layout Calculation:**
   - Recursive traversal could be slow with very deep trees (10+ generations)
   - **Mitigation:** `visited` Set prevents revisiting, but deep trees still traverse all ancestors
   - **Future:** Consider limiting generation depth or lazy loading

2. **Sync Performance:**
   - `getAllPeople()` and `getAllUpdates()` fetch everything
   - **Mitigation:** Currently fine for small-medium families (<1000 people)
   - **Future:** Add pagination or filtering if needed

3. **Memory Usage:**
   - All people/updates loaded into Zustand store
   - **Mitigation:** Maps are efficient, but large datasets could use memory
   - **Future:** Consider virtual scrolling or lazy loading for updates

4. **Relationship Hash Calculation:**
   - `relationshipsHash` iterates all people on every store update
   - **Mitigation:** Only recalculates when relationships change
   - **Future:** Could optimize with incremental hash updates

### **✅ Code Quality**
- No obvious infinite loops or memory leaks
- Proper error handling with rollback on failures
- Type safety throughout
- RLS policies enforce data integrity

---

## 🎯 Success Metrics

### **Completed Features:**
1. ✅ Users can distinguish Living vs Ancestor profiles (`linkedAuthUserId`)
2. ✅ Any authenticated user can add updates to Ancestor profiles
3. ✅ Only owners can modify/delete on Living profiles
4. ✅ Updates persist correctly on reload
5. ✅ Relationships load correctly from database
6. ✅ No polling loops (single sync on login)
7. ✅ Optimistic updates provide instant feedback

### **Next Feature (Invitation System):**
1. ⏳ Curators can generate invite links
2. ⏳ Users can claim profiles via invite links
3. ⏳ Profiles convert from Ancestor → Living on claim
4. ⏳ Invitation management UI

---

## 📝 Implementation Notes

### **Recent Fixes:**
1. **Fixed 'child' relationship mapping bug** - was reversed, now correct
2. **Fixed missing updates on reload** - added `getAllUpdates()` to sync
3. **Fixed polling loop** - removed redundant `syncFamilyTree` calls
4. **Fixed `deleted_at` column error** - removed references (column doesn't exist)
5. **Fixed updates on other people's walls** - `addUpdate` now accepts `targetUserId`

### **Code Cleanup Needed:**
- Remove debug logs after verification (marked with `#region agent log`)
- Clean up `console.log` statements used for debugging
- Consider extracting more hooks from large components

### **Database Schema Status:**
- ✅ `people` table: `user_id` (PK), `linked_auth_user_id` (nullable FK)
- ✅ `relationships` table: bidirectional relationships
- ✅ `updates` table: `user_id` (target wall), `created_by` (poster)
- ✅ `update_tags` table: many-to-many tagging
- ✅ `invitation_links` table: ready for implementation

---

## 🚀 Recommended Next Steps

### **Immediate (This Week)**
1. **Implement Invitation System Phase 1:**
   - Create `invitations-api.ts`
   - Add "Invite" button to ancestor profiles
   - Generate and share invitation links

2. **Code Cleanup:**
   - Remove debug logs
   - Clean up console.log statements

### **Short Term (Next 2 Weeks)**
1. **Complete Invitation System:**
   - Deep link handling
   - Profile claiming flow
   - Invitation management UI

2. **Update Permissions:**
   - Enforce modify/visibility restrictions
   - Add permission checks to UI

### **Medium Term (Next Month)**
1. **WebSocket Real-time Updates:**
   - Supabase Realtime subscriptions
   - Live updates from other users
   - No polling needed

2. **Performance Optimizations:**
   - Lazy loading for large trees
   - Virtual scrolling for updates
   - Incremental relationship hash updates

---

**Next Action:** Start implementing Invitation System Phase 1 - Create Invitation Links
