# 🔐 Compliance & Privacy Plan

## Overview

This document outlines the compliance requirements for Apple App Store submission and the implementation plan for privacy features, including your collaborative permission model for shadow profiles.

**Status:** Planning Phase  
**Last Updated:** 2026

**Recent Updates:**
- Changed permission model from custodian-based to consensus-based (Wikipedia-style)
- Added account deletion with "Delete Everything" option (permanent blacklist)
- Added update visibility controls and bulk management
- Added report functionality in ellipses menus
- Added permanent deletion prevention (can't recreate deleted shadow profiles)  
**Priority:** High (Required for App Store submission)

---

## 📋 Current State Analysis

### ✅ What We Have

1. **Shadow Profiles** (Ancestor profiles without `linked_auth_user_id`)
   - Location: `people-api.ts` - `createRelative()` creates profiles with `linked_auth_user_id: null`
   - Status: ✅ Implemented

2. **Birth/Death Dates**
   - Location: `Person` type - `birthDate?: string`, `deathDate?: string`
   - Status: ✅ Collected (ISO 8601 format: YYYY-MM-DD)

3. **User-Generated Content (UGC)**
   - Location: `updates-api.ts` - Updates/posts system
   - Status: ✅ Implemented (photos, captions, tagging)

4. **Data Collection Points**
   - `name` - Required
   - `birthDate` - Optional (ISO 8601)
   - `deathDate` - Optional (ISO 8601)
   - `gender` - Optional
   - `photoUrl` - Optional (stored in Supabase Storage)
   - `bio` - Optional
   - `phoneNumber` - Optional
   - `createdBy` - UUID of creator (tracking)
   - `linkedAuthUserId` - UUID linking to auth.users (for living users)

### ❌ What's Missing (Apple Requirements)

1. **Privacy Policy** - Not implemented in app
2. **Account Deletion** - No user-facing deletion flow (Apple Guideline 5.1.1)
3. **Report Abuse** - No reporting mechanism for UGC or shadow profiles
4. **Data Minimization** - Need audit of what's actually necessary
5. **Permission System** - No Owner/Custodian/Contributor tiers
6. **Memorial Mode** - No special handling for deceased profiles
7. **Minor Protection** - No age verification or special handling

---

## 🎯 Apple App Store Requirements

### 1. Privacy Policy Required

**Requirement:** Must disclose UGC collection, shadow profiles, data usage  
**Status:** ❌ Not implemented  
**Priority:** 🔴 Critical (Blocking submission)

**What to Include:**
- Data collection methods and purposes
- Shadow profile disclosure (profiles created by others without consent)
- UGC handling (photos, posts, tags)
- Third-party data sharing (Supabase, Google Sign-In, Statsig)
- Data retention and deletion policies
- User rights (access, deletion, modification)

**Research Notes:**
- **Termly** (termly.io): Free privacy policy generator with UGC templates
- **Iubenda** (iubenda.com): Comprehensive templates with GDPR/CCPA coverage
- Both have specific UGC templates covering collaborative content scenarios

**Implementation Plan:**
- [ ] Research Termly/Iubenda UGC templates
- [ ] Create privacy policy page in app (`app/privacy-policy.tsx`)
- [ ] Add privacy policy link in:
  - Settings screen
  - Sign-up flow (with consent checkbox)
  - App Store metadata
- [ ] Store privacy policy acceptance timestamp in user profile

---

### 2. Account Deletion (Apple Guideline 5.1.1)

**Requirement:** Apps with accounts must allow users to delete their accounts  
**Status:** ❌ Not implemented  
**Priority:** 🔴 Critical (Blocking submission)

**Current State:**
- `signOut()` exists in `auth-context.tsx` (clears session only)
- No deletion of:
  - Auth user from `auth.users`
  - Person profile from `people` table
  - Updates created by user
  - Relationships involving user
  - Photos in Storage buckets

**Deletion Strategy:**

**Scenario A: Delete Everything (Permanent Removal)**
```
User wants to permanently remove themselves from family tree:
1. Delete auth user (auth.users)
2. Delete person profile from people table (hard delete)
3. Delete all updates created by user (created_by = userId)
4. Delete photos from Storage (person_photos, update_photos)
5. Remove relationships involving user (or mark as "unclaimed")
6. **CRITICAL**: Add profile to "deleted_profiles" blacklist
   → Prevents anyone from recreating this shadow profile
   → Store: name, birth_date, death_date (for identification)
   → Store: deleted_at timestamp, deleted_by UUID
```

**Scenario B: Keep Shadow Profile (Convert to Ancestor)**
```
User deletes account but profile remains as shadow profile:
1. Delete auth user (auth.users)
2. Set linked_auth_user_id = NULL (becomes shadow profile)
3. Keep updates, relationships, photos (now managed by consensus)
4. Profile becomes collaborative (Wikipedia-style editing)
5. User can no longer claim this profile
```

**Permanent Deletion Prevention:**
- When user chooses "Delete Everything", add profile to `deleted_profiles` table
- Prevent creation of shadow profiles matching deleted profile
- Check before `createRelative()`: Does this match a deleted profile?
- Match criteria: name + birth_date + death_date (fuzzy match)
- Store hash of identifying info for efficient lookup

**Implementation Plan:**

**Database Changes:**
```sql
-- Soft delete tracking with grace period
ALTER TABLE people ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE people ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE people ADD COLUMN deletion_requested_at TIMESTAMP; -- When user requested deletion
ALTER TABLE people ADD COLUMN deletion_grace_period_ends_at TIMESTAMP; -- When grace period ends (30 days)
ALTER TABLE people ADD COLUMN deletion_recovery_token TEXT; -- Token for account recovery

-- Blacklist for permanently deleted profiles (prevent recreation)
CREATE TABLE deleted_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_profile_id UUID, -- Reference to deleted profile (for audit)
  name TEXT NOT NULL,
  birth_date DATE,
  death_date DATE,
  deleted_at TIMESTAMP DEFAULT NOW(),
  deleted_by UUID NOT NULL REFERENCES auth.users(id),
  deletion_reason TEXT, -- 'user_requested', 'account_deletion', etc.
  -- Hash for efficient matching
  profile_hash TEXT NOT NULL, -- Hash of name+birth_date+death_date
  UNIQUE(profile_hash)
);

CREATE INDEX idx_deleted_profiles_hash ON deleted_profiles(profile_hash);
CREATE INDEX idx_deleted_profiles_name ON deleted_profiles(name);
CREATE INDEX idx_people_deletion_grace ON people(deletion_grace_period_ends_at) WHERE deletion_requested_at IS NOT NULL;
```

**API Changes:**
- [ ] Create `account-api.ts` with:
  - `requestAccountDeletion(userId: string, options: DeletionOptions)` - Request deletion (starts grace period)
  - `cancelAccountDeletion(userId: string)` - Cancel deletion during grace period
  - `processAccountDeletion(userId: string)` - Actually delete after grace period (background job)
  - `restoreAccount(recoveryToken: string)` - Restore account using recovery token
  - `checkIfProfileDeleted(name: string, birthDate?: string, deathDate?: string)` - Check blacklist
  - `getUserUpdates(userId: string)` - Get all user's updates for bulk deletion
- [ ] Implement cascading deletion logic:
  - **Option 1: Delete Everything**
    - Delete auth user
    - Delete person profile (hard delete)
    - Delete all user's updates
    - Delete user's photos from Storage
    - Add to `deleted_profiles` blacklist
    - Remove relationships involving user
  - **Option 2: Keep Shadow Profile**
    - Delete auth user
    - Set `linked_auth_user_id = NULL` (convert to shadow)
    - Keep updates, relationships, photos
    - Profile becomes consensus-managed

**UI Changes:**
- [ ] Add "Delete Account" button in **Profile tab** (`app/(tabs)/profile.tsx`)
  - Location: Settings section at bottom of profile screen
  - Or: In profile edit modal
- [ ] Confirmation dialog with two options:
  - **"Delete Everything"** (red, destructive)
    - Warning: "This will permanently remove you from the family tree after 30 days. You can cancel during this time."
    - List what will be deleted: Profile, all posts, all photos, relationships
    - Show: "30-day grace period - you can cancel anytime"
    - Generate recovery token and show to user (save it!)
  - **"Keep Shadow Profile"** (less destructive)
    - Warning: "Your account will be deleted, but your profile will remain as an ancestor profile managed by the family."
- [ ] After deletion request:
  - Show confirmation: "Deletion scheduled. You have 30 days to cancel."
  - Show recovery token: "Save this token to restore your account: [TOKEN]"
  - Send email/notification: "Account deletion scheduled - cancel within 30 days"
- [ ] Add "Cancel Deletion" button (visible during grace period)
- [ ] Add "Restore Account" flow (using recovery token)
- [ ] Handle loading states during deletion

**Edge Cases:**
- What if user created most of the family tree? → Keep tree structure, remove user's ownership
- What if user has pending relationship requests? → Cancel or auto-reject pending requests
- What if matching profile exists? → Prevent creation, show message "This profile was permanently deleted"
- **What if person changes their mind?** → Implement grace period recovery:
  - **Option A: Grace Period (Recommended)**
    - When user chooses "Delete Everything", mark for deletion but don't delete immediately
    - Store deletion request with `deletion_requested_at` timestamp
    - **30-day grace period**: User can cancel deletion during this time
    - After 30 days: Permanently delete and add to blacklist
    - User receives email/notification: "Your account will be deleted in X days. Click here to cancel."
  - **Option B: Recovery Token**
    - Generate recovery token when deleting
    - User can use token to restore account within 30 days
    - After 30 days: Token expires, permanent deletion
  - **Option C: Soft Delete with Recovery**
    - Mark profile as `deleted_at` but don't hard delete
    - Keep in database for 90 days
    - User can restore within 90 days
    - After 90 days: Hard delete and add to blacklist
---

### 3. Report Abuse / Content Reporting

**Requirement:** UGC apps must allow reporting (Apple Guideline 5.1.1)  
**Status:** ❌ Not implemented  
**Priority:** 🔴 Critical (Blocking submission)

**What Can Be Reported:**
1. **Updates/Posts** - Inappropriate photos, captions, tags
2. **Shadow Profiles** - Profiles created without consent
3. **Profiles** - Incorrect information, impersonation
4. **Users** - Harassment, abuse

**Implementation Plan:**

**Database Schema:**
```sql
-- New table: reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id),
  report_type TEXT NOT NULL, -- 'update', 'profile', 'shadow_profile', 'user'
  target_id UUID NOT NULL, -- ID of reported item (update_id, person_id, etc.)
  target_type TEXT NOT NULL, -- Type of target for reference
  reason TEXT NOT NULL, -- 'harassment', 'inappropriate_content', 'incorrect_info', 'unauthorized_profile'
  description TEXT, -- Optional user description
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
```

**API Changes:**
- [ ] Create `reports-api.ts` with:
  - `reportContent(userId, reportData)` - Submit report
  - `getReportsForAdmin()` - Admin review (future)
  - `resolveReport(reportId, resolution)` - Admin action (future)

**UI Changes:**
- [ ] Add "Report" option in ellipses menu (`...`) on:
  - **Family tab** (`app/(tabs)/index.tsx`) - PersonCard components
    - Long press or ellipses menu on person card
    - Report profile, shadow profile, or user
  - **Profile tab** (`app/(tabs)/profile.tsx`) - Update cards
    - Ellipses menu on update cards (already exists: `menuUpdateId`)
    - Add "Report" option alongside "Hide", "Delete", "Edit"
  - **Family feed** (`app/(tabs)/family.tsx`) - Update cards
    - Ellipses menu on update cards (already exists: `menuUpdateId`)
    - Add "Report" option
  - Profile pages (`app/person/[personId].tsx`) - If exists
- [ ] Report modal/form with:
  - Report type selection (Update, Profile, Shadow Profile, User)
  - Reason selection:
    - For Updates: 'inappropriate_content', 'harassment', 'spam', 'incorrect_info'
    - For Profiles: 'incorrect_info', 'impersonation', 'unauthorized_profile', 'harassment'
    - For Shadow Profiles: 'created_without_consent', 'incorrect_info', 'impersonation'
    - For Users: 'harassment', 'abuse', 'spam'
  - Description text input (optional but recommended)
  - Submit button
  - Confirmation message after submission: "Report submitted. Thank you for keeping the family tree safe."

**Admin Panel (Future):**
- [ ] Admin dashboard for reviewing reports
- [ ] Actions: Remove content, warn user, ban user, dismiss report

---

### 4. Data Minimization

**Requirement:** Only collect necessary data  
**Status:** ⚠️ Needs audit  
**Priority:** 🟡 Medium

**Current Data Collection Audit:**

| Field | Required? | Purpose | Can We Minimize? |
|-------|-----------|---------|------------------|
| `name` | ✅ Yes | Display profile | No - Essential |
| `birthDate` | ❌ No | Age calculation, tree display | Consider: Only year for privacy? |
| `deathDate` | ❌ No | Memorial mode, tree display | Keep - Needed for memorial |
| `gender` | ❌ No | Visual representation | Consider: Remove default? |
| `photoUrl` | ❌ No | Profile photos | Keep - Core feature |
| `bio` | ❌ No | User description | Keep - Core feature |
| `phoneNumber` | ❌ No | Invitations | ⚠️ Review: Do we actually use this? |
| `createdBy` | ✅ Yes | Permission tracking | Keep - Needed for permissions |
| `linkedAuthUserId` | ❌ No | Account linking | Keep - Core feature |

**Actions:**
- [ ] Audit `phoneNumber` usage - Do we actually send invitations via phone?
- [ ] Consider birth date privacy (year only vs full date)
- [ ] Review photo storage - Are we storing unnecessarily large images?
- [ ] Document data retention policies

---

### 5. Update Visibility & Management Controls

**Requirement:** Users should control their own content  
**Status:** ⚠️ Partially implemented  
**Priority:** 🟡 Medium

**Current State:**
- Updates have `is_public` field (boolean) in database
- Ellipses menu exists on update cards in `profile.tsx` and `family.tsx`
- Menu options: Hide, Delete, Edit (for own updates)
- No bulk visibility management
- No bulk deletion of all user's updates

**What's Missing:**

1. **Visibility Toggle in Menu** - Change public/private status
2. **Bulk Delete All Updates** - Delete all user's posts at once
3. **Visibility Controls** - Easy way to make all posts private/public

**Implementation Plan:**

**API Changes:**
- [ ] Update `updates-api.ts` with:
  - `updateUpdateVisibility(updateId: string, isPublic: boolean)` - Toggle visibility
  - `deleteAllUserUpdates(userId: string)` - Bulk delete all user's updates
  - `updateAllUserUpdatesVisibility(userId: string, isPublic: boolean)` - Bulk visibility change

**UI Changes:**
- [ ] In ellipses menu on update cards (`profile.tsx`, `family.tsx`):
  - Add "Make Private" / "Make Public" option (toggle based on current `isPublic` state)
  - Show current visibility status in menu
  - For own updates only
- [ ] In Profile settings (bottom of `profile.tsx`):
  - Add "Manage My Updates" section
  - "Delete All My Updates" button
    - Confirmation: "This will permanently delete all posts you've created. This cannot be undone."
    - Show count: "Delete all X posts?"
  - "Make All Updates Private" button
    - Confirmation: "Make all your posts private? Only family members can see them."
  - "Make All Updates Public" button
    - Confirmation: "Make all your posts public? Anyone can see them."

---

## 🏛️ Your Permission Model Implementation

### Wikipedia-Style Consensus Permissions System

**Goal:** Collaborative ownership model for shadow profiles using consensus-based editing

**Philosophy:** No single person manages shadow profiles. Instead, all family members contribute and vote on changes. This reduces workload on individuals and distributes responsibility.

**Moderation Model: Auto-Submit with Post-Hoc Moderation**
- ✅ **Apple Compliant**: Post-moderation is acceptable (not required to pre-moderate)
- ✅ **Benefit of the Doubt**: Changes applied immediately, content can flourish
- ✅ **Safety Net**: Can reject/revert changes if needed (2 rejections = auto-revert)
- ✅ **Transparency**: All edits tracked in history, all rejections visible
- ✅ **Reporting**: Users can still report content (separate from rejection system)

**Permission Tiers:**

#### 1. Verified Owner (100% Control)
- **Who:** The actual person (has `linked_auth_user_id` matching their profile)
- **Rights:**
  - Full edit permissions (no approval needed)
  - Can approve/reject contributor suggestions (override consensus)
  - Can delete profile (with constraints)
  - Can claim profile (convert shadow → living)

**Implementation:**
- Already exists! If `person.linkedAuthUserId === currentUserId`, user is verified owner
- Location: `people-api.ts` - `getUserProfile()` queries by `linked_auth_user_id`

#### 2. Contributors (All Family Members - Consensus-Based)
- **Who:** Any family member who has a relationship to the profile (parent, child, sibling, spouse)
- **Rights:**
  - Can suggest edits (like Wikipedia)
  - Can vote on other contributors' suggestions
  - Cannot edit directly (must go through consensus)
  - Suggestions are approved/rejected by **consensus voting** (not single custodian)


**Implementation Plan:**

**Database Schema:**
```sql
-- Edit history (auto-submit model - changes applied immediately)
CREATE TABLE profile_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES people(user_id),
  edited_by UUID NOT NULL REFERENCES auth.users(id),
  field_name TEXT NOT NULL, -- 'name', 'bio', 'birthDate', 'gender', 'photoUrl', etc.
  old_value TEXT,
  new_value TEXT,
  description TEXT, -- Optional: Why was this change made?
  status TEXT DEFAULT 'active', -- 'active', 'disputed', 'reverted'
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Rejection tracking
  rejection_threshold INTEGER DEFAULT 2, -- How many rejections needed to revert? (default: 2)
  revert_reason TEXT, -- Why was it reverted?
  reverted_at TIMESTAMP,
  reverted_by UUID REFERENCES auth.users(id) -- Who initiated the revert
);

-- Rejections on edits (post-hoc moderation)
CREATE TABLE profile_edit_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_id UUID NOT NULL REFERENCES profile_edit_history(id) ON DELETE CASCADE,
  rejected_by UUID NOT NULL REFERENCES auth.users(id),
  rejection_reason TEXT NOT NULL, -- 'incorrect_info', 'privacy_concern', 'other'
  rejection_description TEXT, -- Optional: Detailed reason
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(edit_id, rejected_by) -- One rejection per person per edit
);

CREATE INDEX idx_edit_history_profile ON profile_edit_history(profile_id, status, created_at DESC);
CREATE INDEX idx_edit_history_active ON profile_edit_history(profile_id, status) WHERE status = 'active';
CREATE INDEX idx_rejections_edit ON profile_edit_rejections(edit_id);
CREATE INDEX idx_edit_history_recent ON profile_edit_history(profile_id, created_at DESC) LIMIT 50;

-- Track who can contribute (must have relationship)
CREATE TABLE profile_contributors (
  profile_id UUID NOT NULL REFERENCES people(user_id),
  contributor_user_id UUID NOT NULL REFERENCES auth.users(id),
  relationship_type TEXT NOT NULL, -- 'parent', 'child', 'sibling', 'spouse'
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id, contributor_user_id)
);

CREATE INDEX idx_contributors_profile ON profile_contributors(profile_id);
CREATE INDEX idx_contributors_user ON profile_contributors(contributor_user_id);
```

**Auto-Submit Logic:**
```typescript
interface ProfileEdit {
  id: string;
  profileId: string;
  editedBy: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  description?: string;
  status: 'active' | 'disputed' | 'reverted';
  createdAt: Date;
  rejections: {
    count: number;
    threshold: number; // Default: 2 rejections to revert
    reasons: string[];
  };
}

function applyEditImmediately(userId: string, profileId: string, fieldName: string, newValue: string, description?: string): ProfileEdit {
  // Get current value
  const currentValue = getProfileField(profileId, fieldName);
  
  // Apply change immediately to profile
  updateProfileField(profileId, fieldName, newValue);
  
  // Create edit history record
  const edit = createEditHistory({
    profileId,
    editedBy: userId,
    fieldName,
    oldValue: currentValue,
    newValue,
    description,
    status: 'active'
  });
  
  // Notify family members of change
  notifyFamilyMembers(profileId, {
    type: 'profile_edit',
    editId: edit.id,
    editedBy: userId,
    fieldName,
    newValue
  });
  
  return edit;
}

function rejectEdit(userId: string, editId: string, reason: string, description?: string): void {
  // Check if user can reject (must be contributor)
  const edit = getEdit(editId);
  if (!isContributor(userId, edit.profileId)) {
    throw new Error('Only family members can reject edits');
  }
  
  // Create rejection record
  createRejection({
    editId,
    rejectedBy: userId,
    rejectionReason: reason,
    rejectionDescription: description
  });
  
  // Check if threshold met
  const rejectionCount = getRejectionCount(editId);
  const threshold = edit.rejectionThreshold || 2;
  
  if (rejectionCount >= threshold) {
    // Auto-revert the change
    revertEdit(editId, userId, `Reverted by consensus (${rejectionCount} rejections)`);
  } else {
    // Mark as disputed
    updateEditStatus(editId, 'disputed');
    notifyEditCreator(edit.editedBy, {
      type: 'edit_disputed',
      editId,
      rejectionCount,
      threshold
    });
  }
}

function revertEdit(editId: string, revertedBy: string, reason: string): void {
  const edit = getEdit(editId);
  
  // Restore old value
  updateProfileField(edit.profileId, edit.fieldName, edit.oldValue);
  
  // Update edit status
  updateEditStatus(editId, 'reverted', {
    revertedBy,
    revertReason: reason,
    revertedAt: new Date()
  });
  
  // Notify all contributors
  notifyFamilyMembers(edit.profileId, {
    type: 'edit_reverted',
    editId,
    revertedBy,
    reason
  });
}

function getRecentChanges(profileId: string, limit: number = 20): ProfileEdit[] {
  return getEditHistory(profileId, { limit, orderBy: 'created_at DESC' });
}
```

**Logic:**
- If profile has `linked_auth_user_id`, that user is verified owner (can edit directly, no moderation)
- If profile has `linked_auth_user_id = NULL` (shadow profile):
  - All family members with relationships can edit directly
  - **Edits are applied immediately** (auto-submit)
  - Changes are visible right away (benefit of the doubt)
  - Other family members can reject/revert changes post-hoc
  - Rejection threshold: 2 rejections = auto-revert (configurable per profile)
  - All changes tracked in edit history for transparency

**UI Flow (Auto-Submit with Post-Hoc Moderation):**
```
Shadow Profile Editing (Auto-Submit Model):
1. Family member clicks "Edit" on profile field
   → Modal opens with field editor
   → Optional: Add description/reason for change
   → Submit edit → **Change applied immediately** (status: 'active')
   → Edit is live on profile right away (benefit of the doubt)

2. Other family members see change notification
   → Notification: "[Name] updated [field] on [Profile Name]"
   → Can view change in "Recent Changes" log
   → Can see who made the change and when

3. If someone disagrees with the change:
   → Click "Reject" or "Revert" button on the change
   → Modal: "Why are you rejecting this change?"
   → Options: "Incorrect information", "Privacy concern", "Other"
   → Add optional reason
   → Submit rejection

4. Rejection logic:
   → If 1+ family member rejects: Change marked as 'disputed'
   → If 2+ family members reject: Change automatically reverted
   → Original value restored
   → All contributors notified of reversal
   → Rejection reasons visible in change log

5. Change history:
   → All changes visible in "Recent Changes" log
   → Shows: Who changed what, when, and why
   → Shows: Rejections and reversals
   → Can view full edit history for transparency
```

**Key Benefits:**
- ✅ **Faster collaboration** - Changes visible immediately
- ✅ **Less friction** - No waiting for approval
- ✅ **Post-hoc moderation** - Can reject if needed
- ✅ **Transparency** - All changes tracked and visible
- ✅ **Compliant** - Apple allows post-moderation with reporting
- ✅ **Distributed responsibility** - Everyone can contribute and moderate

**Implementation Steps:**
- [ ] Create `profile-edit-history-api.ts` with:
  - `applyEdit(userId, profileId, fieldName, newValue, description?)` - Apply edit immediately
  - `rejectEdit(userId, editId, reason, description?)` - Reject an edit
  - `revertEdit(userId, editId, reason)` - Manually revert (if needed)
  - `getRecentChanges(profileId, limit?)` - Get edit history
  - `getEditRejections(editId)` - Get rejection details
  - `checkAndRevertDisputedEdits(profileId)` - Background job to auto-revert
- [ ] Create `profile-contributors-api.ts` with:
  - `getContributors(profileId)` - Get all family members who can contribute
  - `isContributor(userId, profileId)` - Check if user can contribute
- [ ] Add "Edit" button on profile pages (for shadow profiles)
- [ ] Add "Recent Changes" log UI (show edit history)
- [ ] Add "Reject" button on recent changes
- [ ] Add notification system for new edits
- [ ] Show rejection status (e.g., "1 of 2 rejections needed to revert")
- [ ] Auto-revert when rejection threshold met

**Benefits of Auto-Submit System:**
- ✅ **Faster collaboration** - Changes visible immediately, no waiting
- ✅ **Less friction** - Contributors can edit freely, content flourishes
- ✅ **Post-hoc moderation** - Can reject if needed, but gives benefit of the doubt
- ✅ **Distributed responsibility** - Everyone can contribute and moderate
- ✅ **Transparency** - All edits tracked in history, all rejections visible
- ✅ **Compliant** - Apple allows post-moderation (we have reporting + rejection)
- ✅ **Wikipedia-style** - Edits are live, can be reverted if wrong

---

### Memorial Mode (Deceased Profiles)

**Goal:** Collaborative memorial wall for deceased relatives (like Find A Grave, Ancestry)

**Implementation Plan:**

**Detection:**
- Profile has `deathDate` set → Enable memorial mode
- Can be manually toggled (if death date unknown but person is deceased)

**Features:**
- **Read-Only Profile Edits** - Only verified owner (if alive) or custodians can edit
- **Open Updates** - Anyone in family can post memories/photos
- **Collaborative Wall** - Multiple users can post (already supported by updates system)
- **No Relationship Changes** - Lock relationships (cannot add new parents/spouses after death)

**Database Changes:**
```sql
-- Add to people table:
ALTER TABLE people ADD COLUMN memorial_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE people ADD COLUMN memorial_mode_enabled_at TIMESTAMP;
ALTER TABLE people ADD COLUMN memorial_mode_enabled_by UUID REFERENCES auth.users(id);

-- Auto-enable if deathDate is set:
-- (Handle via trigger or application logic)
```

**Logic:**
```typescript
function shouldEnableMemorialMode(person: Person): boolean {
  // Enable if death date is set
  if (person.deathDate) {
    return true;
  }
  // Or manually enabled by custodian/verified owner
  return person.memorialMode ?? false;
}

function canEditProfile(person: Person, userId: string): boolean {
  // If memorial mode, only verified owner or custodians can edit profile
  if (person.memorialMode) {
    return isVerifiedOwner(person, userId) || isCustodian(person, userId);
  }
  // Normal permission rules apply
  return hasEditPermission(person, userId);
}

function canPostUpdates(person: Person, userId: string): boolean {
  // Memorial mode: Anyone in family can post
  if (person.memorialMode) {
    return isFamilyMember(userId); // Has relationship to person
  }
  // Normal mode: Permission rules apply
  return hasPostPermission(person, userId);
}
```

**UI Changes:**
- [ ] Show memorial badge/indicator on deceased profiles
- [ ] Disable relationship editing in memorial mode
- [ ] Show "Post Memory" instead of "Post Update"
- [ ] Add memorial timeline view (chronological memories)

---

### Minor Protection (Instagram-Style)

**Goal:** Extra privacy and protection for profiles of minors/non-adults

**Implementation Plan:**

**Age Detection:**
```typescript
function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function isMinor(birthDate?: string): boolean {
  if (!birthDate) return false; // Unknown age = treat as adult
  const age = calculateAge(birthDate);
  return age !== null && age < 18; // Adjust based on jurisdiction (some use 13, 16, 21)
}
```

**Protections:**

1. **Private by Default**
   - Profile visibility: Family only
   - Updates: Family only (cannot be public)
   - Cannot be tagged in public updates

2. **Parent/Guardian Controls**
   - Require parent/guardian verification
   - Parent can review/censor updates before posting
   - Parent can block certain family members from viewing

3. **Limited Data Collection**
   - No phone number collection
   - Birth date: Year only (more privacy)
   - Location: Less specific

4. **No Direct Messaging**
   - Cannot receive direct messages
   - All communication must go through parent/guardian

**Database Changes:**
```sql
-- Add to people table:
ALTER TABLE people ADD COLUMN is_minor BOOLEAN DEFAULT FALSE;
ALTER TABLE people ADD COLUMN parent_guardian_id UUID REFERENCES auth.users(id);
ALTER TABLE people ADD COLUMN requires_parent_approval BOOLEAN DEFAULT TRUE;

-- Track age calculation (cache for performance)
ALTER TABLE people ADD COLUMN calculated_age INTEGER;
```

**Logic:**
```typescript
interface MinorProtectionSettings {
  profileVisibility: 'family_only' | 'public'; // Default: 'family_only'
  updateVisibility: 'family_only' | 'public'; // Default: 'family_only'
  canBeTagged: boolean; // Default: false (only in family updates)
  requiresParentApproval: boolean; // Default: true
  parentGuardianId?: string; // UUID of parent/guardian
}

function getMinorProtectionSettings(person: Person): MinorProtectionSettings {
  if (!isMinor(person.birthDate)) {
    return null; // Not a minor, no special protections
  }
  
  return {
    profileVisibility: 'family_only',
    updateVisibility: 'family_only',
    canBeTagged: false, // Can only be tagged in family-only updates
    requiresParentApproval: person.requiresParentApproval ?? true,
    parentGuardianId: person.parentGuardianId,
  };
}
```

**UI Changes:**
- [ ] Show "Protected Profile" badge on minor profiles
- [ ] Disable public sharing options
- [ ] Require parent approval modal for updates
- [ ] Parent dashboard for reviewing minor's content

---

## 📊 Implementation Roadmap

### Phase 1: Critical Compliance (Blocking Submission) 🔴

**Priority:** Must complete before App Store submission

- [ ] **Privacy Policy**
  - Research Termly/Iubenda UGC templates
  - Create privacy policy page
  - Add consent flow in sign-up
  - Add link in settings
  - Estimated: 2-3 days

- [ ] **Account Deletion**
  - Design deletion strategy (Delete Everything vs Keep Shadow Profile)
  - Implement grace period system (30-day recovery window)
  - Implement recovery token system
  - Implement API (`account-api.ts`)
  - Implement deleted profiles blacklist (prevent recreation)
  - Add UI in Profile tab (`app/(tabs)/profile.tsx`)
  - Add "Cancel Deletion" and "Restore Account" flows
  - Background job to process deletions after grace period
  - Test cascading deletion
  - Test blacklist prevention
  - Test recovery flow
  - Estimated: 5-7 days

- [ ] **Report Abuse**
  - Design database schema
  - Implement API (`reports-api.ts`)
  - Add report option in ellipses menu:
    - Family tab (PersonCard ellipses menu)
    - Profile tab (Update card ellipses menu)
    - Family feed (Update card ellipses menu)
  - Report modal/form
  - Basic admin review (manual for now)
  - Estimated: 4-5 days

- [ ] **Update Visibility & Management**
  - Implement visibility toggle API (`updateUpdateVisibility`)
  - Implement bulk delete API (`deleteAllUserUpdates`)
  - Implement bulk visibility change API
  - Add visibility toggle in update card ellipses menu
  - Add "Manage My Updates" section in Profile tab
  - Estimated: 2-3 days

**Total Phase 1:** ~14-20 days

---

### Phase 2: Permission System 🟡

**Priority:** Core feature, but not blocking submission

- [ ] **Auto-Submit Edit System**
  - Database schema (`profile_edit_history`, `profile_edit_rejections`, `profile_contributors`)
  - API for edits (`profile-edit-history-api.ts`)
  - API for rejections (`profile-edit-rejections-api.ts`)
  - API for contributors (`profile-contributors-api.ts`)
  - Auto-submit logic (apply immediately)
  - Rejection logic (post-hoc moderation, auto-revert on threshold)
  - Notification system for new edits
  - Estimated: 5-7 days

- [ ] **Edit & Moderation UI**
  - "Edit" button on profile pages (for shadow profiles)
  - Edit modal/form (apply immediately)
  - "Recent Changes" log UI (show edit history)
  - Rejection UI (reject button on changes)
  - Rejection status display (e.g., "1 of 2 rejections needed")
  - Notification badges for new edits
  - Estimated: 4-5 days

**Total Phase 2:** ~9-12 days

---

### Phase 3: Memorial & Minor Protection 🟢

**Priority:** Enhancements, can ship later

- [ ] **Memorial Mode**
  - Database changes
  - Logic for memorial detection
  - UI for memorial profiles
  - Estimated: 3-4 days

- [ ] **Minor Protection**
  - Age calculation logic
  - Database changes
  - Privacy controls
  - Parent/guardian system
  - Estimated: 5-7 days

**Total Phase 3:** ~8-11 days

---

### Phase 4: Data Minimization Audit 🟢

**Priority:** Ongoing improvement

- [ ] Audit data collection
- [ ] Remove unnecessary fields
- [ ] Document data retention
- [ ] Review photo storage optimization
- Estimated: 2-3 days

---

## 📝 Privacy Policy Research Notes

### Termly (termly.io)

**Features:**
- Free privacy policy generator
- UGC-specific templates
- GDPR and CCPA compliant
- Mobile app specific templates
- Can customize sections

**Key Sections for UGC Apps:**
1. **Information We Collect**
   - User-provided (profile data, posts, photos)
   - Automatically collected (usage analytics)
   - Third-party (Google Sign-In, Supabase)

2. **How We Use Information**
   - Display UGC
   - Enable family tree features
   - Send notifications
   - Improve services

3. **User-Generated Content**
   - Disclosure that others can create profiles for users
   - Shadow profile explanation
   - Content ownership
   - Removal rights

4. **Third-Party Services**
   - Supabase (backend)
   - Google Sign-In (authentication)
   - Statsig (analytics)
   - Photo storage

5. **User Rights**
   - Access data
   - Delete account
   - Modify profile
   - Report content

### Iubenda (iubenda.com)

**Features:**
- Comprehensive legal templates
- Multiple privacy law coverage (GDPR, CCPA, PIPEDA, etc.)
- Lawyer-crafted clauses
- Automatic updates for law changes
- Embeddable widget for apps

**Advantages:**
- More comprehensive than Termly
- Better for international apps
- Automatic compliance updates
- Can integrate as web view in app

**Cost:** Paid (but more comprehensive)

---

## 🔍 Code Analysis Summary

### Current Data Flow

```
User Signs Up
  → Google OAuth / Email
  → Supabase Auth (auth.users)
  → Create Profile (people table, linked_auth_user_id = userId)
  → Profile created, user is "Verified Owner"

User Creates Shadow Profile
  → createRelative(userId, personData)
  → people table: linked_auth_user_id = NULL
  → created_by = userId (becomes "Custodian")
  → Profile is "Shadow Profile" (no linked account)

User Posts Update
  → createUpdate(userId, updateData)
  → updates table: created_by = userId
  → Can tag other people (@mentions)
  → Photos stored in Supabase Storage
```

### Security Considerations

1. **RLS Policies** - Need to review Supabase RLS policies for:
   - Who can view shadow profiles?
   - Who can edit shadow profiles?
   - Who can report content?
   - Who can delete accounts?

2. **Photo Storage** - Currently organized by:
   - `profiles/{userId}/` - User's own profile photos
   - `relatives/{userId}/` - Relatives created by user
   - `update-photos/{userId}/` - Update photos
   - Need to review: Who can access these buckets?

3. **Cascade Deletion** - When user deletes account:
   - What happens to relationships?
   - What happens to shadow profiles they created?
   - What happens to updates they posted?

---

## ✅ Next Steps

1. **Immediate Actions:**
   - [ ] Review this document with team
   - [ ] Prioritize Phase 1 features (blocking submission)
   - [ ] Research Termly/Iubenda templates
   - [ ] Design database schema changes
   - [ ] Create implementation tickets

2. **Research:**
   - [ ] Review Apple App Store guidelines for UGC apps
   - [ ] Review GDPR requirements for shadow profiles
   - [ ] Research COPPA requirements (if targeting minors)
   - [ ] Review similar apps (Ancestry, Find A Grave) for patterns

3. **Design:**
   - [ ] Wireframes for report UI
   - [ ] Wireframes for account deletion flow
   - [ ] Privacy policy content outline
   - [ ] Permission system UI/UX

4. **Implementation:**
   - [ ] Start with Phase 1 (Critical Compliance)
   - [ ] Test thoroughly before submission
   - [ ] Document all changes
   - [ ] Update this plan as implementation progresses

---

## 📚 References

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Privacy Guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy)
- [GDPR Requirements](https://gdpr.eu/)
- [COPPA Requirements](https://www.ftc.gov/tips-advice/business-center/privacy-and-security/children%27s-privacy)
- [Termly Privacy Policy Generator](https://termly.io/)
- [Iubenda Privacy Policy Generator](https://www.iubenda.com/)

---

**Document Status:** Draft - Ready for Review  
**Last Updated:** 2024  
**Next Review:** After Phase 1 implementation
