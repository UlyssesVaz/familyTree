# Current State Assessment & Next Steps

**Date:** Current Session  
**Focus:** Moving from "Social Wall" to "Collaborative Archive"

---

## ✅ What We've Completed

### **Recent Achievements**
1. **✅ Delete Feature for Living Profiles**
   - Soft delete implemented (frontend hides immediately)
   - Permanent deletion from database + Storage bucket
   - Only profile owners can delete their own updates
   - UUID primary key (`updates_id`) allows multiple posts per user per wall

2. **✅ Backend Integration (Partial)**
   - Updates API fully integrated with Supabase
   - Photo upload to Storage bucket working
   - Database schema with UUID primary key
   - CASCADE deletion for `update_tags`

3. **✅ Core Architecture**
   - Service layer abstraction ready
   - Zustand store with optimistic updates
   - Hooks extracted (`useProfileUpdates`, `useFamilyFeed`, `useUpdateManagement`)
   - Type-safe API functions

---

## 🎯 Current State: Where We Are

### **Profile Types (Conceptual - Not Yet Implemented)**

Based on the "Family Compendium" vision:

#### **Living Profiles (Self-Managed)**
- **Status:** ✅ Partially implemented
- **Current:** Users can create/delete their own updates
- **Missing:** `linked_auth_user_id` field to distinguish from Ancestor Profiles
- **Permission Logic:** Only owner can modify/delete (working for deletes)

#### **Ancestor Profiles (Crowdsourced)**
- **Status:** ❌ Not yet implemented
- **Current:** No distinction between Living and Ancestor profiles
- **Missing:** 
  - `linked_auth_user_id` field (NULL = Ancestor)
  - Permission logic allowing any authenticated user to add updates
  - UI indicators showing profile type

### **Permission System Status**

| Feature | Living Profiles | Ancestor Profiles | Status |
|---------|----------------|-------------------|--------|
| **Add Updates** | Owner only | Any authenticated user | ⚠️ Partial (no distinction yet) |
| **Delete Updates** | Owner only | ❓ Not defined | ✅ Working (owner only) |
| **Modify Updates** | Owner only | ❓ Not defined | ⚠️ No restrictions yet |
| **Change Visibility** | Owner only | ❓ Not defined | ⚠️ No restrictions yet |

---

## 🚀 Next Incremental Feature: Ancestor Profile Support

### **Phase 1: Add `linked_auth_user_id` to Person Type**

**Goal:** Distinguish between Living and Ancestor profiles

**Changes Needed:**
1. Add `linkedAuthUserId?: string` to `Person` interface
2. Update database schema (if not already present)
3. Update `people-api.ts` to handle this field
4. Update store to track this field

**Acceptance Criteria:**
- ✅ Person type includes `linkedAuthUserId`
- ✅ Living profiles have `linkedAuthUserId === auth.users.id`
- ✅ Ancestor profiles have `linkedAuthUserId === null/undefined`
- ✅ Database queries handle both cases

---

### **Phase 2: Permission Helpers**

**Goal:** Create utility functions to check permissions

**New Files:**
- `utils/profile-permissions.ts`

**Functions:**
```typescript
// Check if profile is Living (has linked auth user)
export function isLivingProfile(person: Person): boolean

// Check if current user owns this profile
export function isProfileOwner(person: Person, currentUserId: string): boolean

// Check if user can add updates to this profile
export function canAddUpdate(person: Person, currentUserId: string): boolean

// Check if user can delete/modify an update
export function canModifyUpdate(update: Update, person: Person, currentUserId: string): boolean
```

**Acceptance Criteria:**
- ✅ Helper functions correctly identify profile types
- ✅ Permission checks work for both Living and Ancestor profiles
- ✅ Functions are pure and testable

---

### **Phase 3: Update UI to Show Profile Type**

**Goal:** Visual distinction between Living and Ancestor profiles

**Changes:**
1. Add badge/indicator showing "Living" vs "Ancestor"
2. Show different UI for adding updates:
   - Living: "Add to Your Profile"
   - Ancestor: "Add to Family Archive"
3. Update profile screens to show profile type

**Acceptance Criteria:**
- ✅ Users can visually distinguish profile types
- ✅ UI language reflects collaborative nature of Ancestor profiles
- ✅ Clear indication of who can contribute

---

### **Phase 4: Update Permissions in API**

**Goal:** Enforce permissions at API level

**Changes:**
1. Update `createUpdate` to check permissions:
   - Living: Only owner can add
   - Ancestor: Any authenticated user can add
2. Update `deleteUpdate` to check permissions:
   - Living: Only owner can delete
   - Ancestor: Only creator can delete (or owner if exists)
3. Update `updateUpdate` to check permissions:
   - Living: Only owner can modify
   - Ancestor: Only creator can modify

**Acceptance Criteria:**
- ✅ API enforces permissions correctly
- ✅ RLS policies support permission checks
- ✅ Error messages are clear when permissions denied

---

### **Phase 5: Update Frontend Components**

**Goal:** Apply permissions in UI components

**Changes:**
1. Update `AddUpdateModal` to check `canAddUpdate()`
2. Update delete buttons to check `canModifyUpdate()`
3. Update edit buttons to check `canModifyUpdate()`
4. Hide/disable actions based on permissions

**Acceptance Criteria:**
- ✅ UI correctly shows/hides actions based on permissions
- ✅ Users can't attempt actions they're not allowed to perform
- ✅ Clear feedback when actions are restricted

---

## 📋 Implementation Order (Recommended)

### **Step 1: Foundation (Type System)**
1. Add `linkedAuthUserId` to `Person` type
2. Update database schema if needed
3. Update `people-api.ts` to handle field

### **Step 2: Permission Logic**
1. Create `utils/profile-permissions.ts`
2. Implement helper functions
3. Add unit tests (if testing framework exists)

### **Step 3: API Enforcement**
1. Update `createUpdate` permissions
2. Update `deleteUpdate` permissions (already owner-only, verify)
3. Update `updateUpdate` permissions

### **Step 4: UI Updates**
1. Add profile type indicators
2. Update permission checks in components
3. Update language/messaging

### **Step 5: Testing & Refinement**
1. Test Living profile permissions
2. Test Ancestor profile permissions
3. Test edge cases (unclaimed profiles, etc.)

---

## 🔍 Key Questions to Resolve

1. **Ancestor Profile Delete Permissions:**
   - Can anyone delete updates on Ancestor profiles?
   - Or only the creator of the update?
   - Or only if the profile gets claimed later?

2. **Profile Claiming:**
   - Can an Ancestor profile be "claimed" later?
   - What happens to existing updates when claimed?
   - Should we implement claiming in this phase?

3. **Multi-Wall Effect:**
   - When a post is tagged, does it appear on both walls?
   - What permissions apply on the tagged person's wall?
   - Should tagged posts be deletable from both walls?

---

## 📊 Current Architecture Status

### **✅ Well-Architected**
- Service layer abstraction
- Type-safe API functions
- Hooks for reusable logic
- Separation of concerns

### **⚠️ Needs Attention**
- Large component files (700-800 lines)
- Some duplicate code (~440 lines identified)
- Permission logic not yet centralized

### **❌ Missing**
- `linked_auth_user_id` field in Person type
- Permission utility functions
- Profile type distinction in UI
- Ancestor profile support

---

## 🎯 Success Metrics

After implementing Ancestor Profile Support:

1. ✅ Users can distinguish Living vs Ancestor profiles
2. ✅ Any authenticated user can add updates to Ancestor profiles
3. ✅ Only owners can modify/delete on Living profiles
4. ✅ Clear permission enforcement at API level
5. ✅ UI correctly reflects permissions
6. ✅ Code is maintainable and testable

---

## 📝 Notes

- **Incremental Approach:** Each phase should be fully working before moving to next
- **Backward Compatibility:** Ensure existing Living profiles continue to work
- **Database Migration:** May need migration script for `linked_auth_user_id` field
- **Testing:** Test both profile types thoroughly before moving forward

---

**Next Action:** Start with Phase 1 - Add `linked_auth_user_id` to Person type
