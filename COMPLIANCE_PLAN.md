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
- Added race condition fixes for family tree sync (session-store, profile-context, auth-guard)
- Added data portability export flow (GDPR compliance)
- Added neutral age gate flow (COPPA compliance)
- Added user consent during entry (legal shield for UGC)
- Added external request flow for web-based removal requests
- Added proactive notification for shadow profiles with email addresses  
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

## 🔧 User Experience & Stability Issues

### 7. Race Condition in Family Tree Sync

**Status:** ⚠️ POTENTIAL BUG  
**Impact:** Family tree not loading for invited users  
**Priority:** 🟡 Medium (Affects user experience, may cause poor reviews)

**User Report:** "Full family tree not showing up if a different user signs in from invite"

**Root Cause Analysis:**

**Problem 1: Module-level `isSyncing` flag**
- **Location:** `stores/session-store.ts` line 17
- **Issue:** `let isSyncing = false;` is a module-level variable, NOT part of Zustand state
- **Problems:**
  1. Not reactive - won't trigger re-renders in React components
  2. Can get stuck as `true` if sync throws unexpectedly
  3. Shared across all component instances (race condition risk)

**Problem 2: Profile Context Ref Dependencies**
- **Location:** `contexts/profile-context.tsx` lines 36-41, 104
- **Issue:** Multiple refs tracking state - complex to debug
- **Specific Issue (Line 104):** Check prevents re-running but may skip valid re-syncs for invited users:
  ```typescript
  if (syncFamilyTreeDoneRef.current === currentUserId && profileCheckRef.current) {
    return; // May incorrectly skip sync for invited users
  }
  ```

**Problem 3: Auth Guard Timing**
- **Location:** `contexts/guards/auth-guard.tsx` lines 54-65
- **Issue:** Gets ego SYNCHRONOUSLY but sync is ASYNC
- **Problem:** If sync not complete, ego may be null even for valid users, causing incorrect redirects

**Implementation Plan:**

**Step 1: Move `isSyncing` into Zustand State**
- **File:** `stores/session-store.ts`
- **Action:**
  1. Add `isSyncing: boolean` to `SessionStore` interface
  2. Add `syncError: string | null` to track errors
  3. Remove module-level `let isSyncing = false;`
  4. Update `syncFamilyTree` to use Zustand state:
     - Set `isSyncing: true` at start
     - Set `syncError: null` on start
     - Set `syncError: error.message` on error
     - Set `isSyncing: false` in `finally` block
  5. **Safety:** Check `get().isSyncing` before starting sync (prevents concurrent calls)

**Step 2: Update Profile Context to Wait for Sync**
- **File:** `contexts/profile-context.tsx`
- **Action:**
  1. Import `useSessionStore` hook to access `isSyncing` state
  2. In profile check useEffect (line 90), add check:
     - If `isSyncing === true`, wait before proceeding
     - Use polling or effect dependency on `isSyncing` to re-check when sync completes
  3. **Alternative:** Wait for `isSyncing` to become `false` before making routing decisions
  4. **Safety:** Don't skip sync check for invited users - ensure `syncFamilyTreeDoneRef` only prevents duplicate calls, not necessary ones

**Step 3: Update Auth Guard to Wait for Sync**
- **File:** `contexts/guards/auth-guard.tsx`
- **Action:**
  1. Import `useSessionStore` hook
  2. Get `isSyncing` from store: `const isSyncing = useSessionStore((state) => state.isSyncing)`
  3. In useEffect (line 28), add early return:
     ```typescript
     if (isLoading || isSyncing) return; // Wait for auth AND sync
     ```
  4. **Safety:** This prevents auth guard from running before sync completes, avoiding false negatives

**Step 4: Testing**
- Test invited user flow: Claim invitation → Verify sync completes → Verify tree loads
- Test race condition: Rapid sign-in/sign-out → Verify no stuck states
- Test error handling: Simulate sync failure → Verify `syncError` is set and `isSyncing` returns to `false`

---

### 8. Invitation Claim Flow Race Condition

**Status:** ⚠️ POTENTIAL BUG  
**Impact:** Invited user sees empty family tree  
**Priority:** 🟡 Medium (Affects user onboarding experience)

**Current Flow:**
```
User clicks invite link → app/join/[token].tsx
User signs in with Google
claimInvitationLink() called
syncFamilyTree() called (line 128)
Navigate to /(tabs) (line 131)
```

**Problem:** Navigation happens 1500ms after sync STARTS, not after sync COMPLETES.  
**Location:** `app/join/[token].tsx` lines 125-133

**Issue:**
```typescript
setScreenState('success');
await useSessionStore.getState().syncFamilyTree(session.user.id);
// ↑ This returns when sync STARTS due to isSyncing check
setTimeout(() => {
  router.replace('/(tabs)'); // May navigate before sync completes
}, 1500);
```

**Implementation Plan:**

**Step 1: Ensure Sync Completes Before Navigation**
- **File:** `app/join/[token].tsx`
- **Action:**
  1. In `handleClaimProfile` (line 110), after `claimInvitationLink`:
     - Call `syncFamilyTree` and **wait for completion**
     - After sync completes, check if data loaded:
       ```typescript
       await useSessionStore.getState().syncFamilyTree(session.user.id);
       
       // Verify data is loaded before navigating
       const people = usePeopleStore.getState().people;
       if (people.size === 0) {
         console.error('Sync completed but no people loaded');
         // Option: Retry sync or show error
       }
       ```
  2. **Critical:** Remove `setTimeout` delay OR ensure it's AFTER sync completes
  3. **Alternative:** Use polling to wait for `isSyncing === false` before navigating

**Step 2: Add Loading State During Sync**
- **File:** `app/join/[token].tsx`
- **Action:**
  1. Add `isSyncing` check from `useSessionStore`
  2. Show loading spinner while `isSyncing === true`
  3. Only navigate when `isSyncing === false` AND `people.size > 0`

**Step 3: Error Handling**
- **File:** `app/join/[token].tsx`
- **Action:**
  1. Check `syncError` from store after sync attempt
  2. If error, show retry button instead of navigating
  3. Allow user to manually retry sync if it fails

**Step 4: Testing**
- Test invitation claim flow: Sign in → Claim → Verify tree loads BEFORE navigation
- Test slow network: Simulate slow sync → Verify navigation waits
- Test sync failure: Simulate error → Verify user sees error, not empty tree

---

### 9. Profile Context useEffect Dependency Array

**Status:** ⚠️ UNNECESSARY RE-RENDERS  
**Impact:** Performance, potential infinite loops  
**Priority:** 🟢 Low (Optimization, not blocking)

**Location:** `contexts/profile-context.tsx` line 223

**Issue:**
```typescript
}, [session?.user?.id, isAuthLoading, router]);
// ↑ router is a stable reference but included anyway
// Could cause re-runs if router reference changes
```

**Implementation Plan:**

**Step 1: Remove Router from Dependency Array**
- **File:** `contexts/profile-context.tsx`
- **Action:**
  1. Remove `router` from dependency array (line 223)
  2. **Rationale:** `router` from `useRouter()` is stable - it won't change between renders
  3. **Safety:** Router methods (`router.replace`) can be called without being in dependencies (they're stable functions)

**Step 2: Use useCallback for Navigation**
- **File:** `contexts/profile-context.tsx` (if needed for optimization)
- **Action:**
  1. If navigation logic is complex, wrap in `useCallback`
  2. Only include dependencies that actually change: `[session?.user?.id, isAuthLoading]`
  3. **Note:** This is optional - router is already stable

**Step 3: Testing**
- Test profile loading: Verify no unnecessary re-renders
- Test navigation: Verify routing still works correctly
- Monitor performance: Check React DevTools for unnecessary effect runs

---

### 10. Optimistic Updates Missing Proper Error Boundaries

**Status:** ⚠️ UX ISSUE  
**Impact:** User sees success, then silent failure  
**Priority:** 🟡 Medium (Poor user experience)

**Example Location:** `stores/relationships-store.ts` lines 111-116

**Current Issue:**
```typescript
} catch (error: any) {
  console.error('[RelationshipsStore] Error saving parent relationship to database:', error);
  usePeopleStore.setState({ people: oldPeople }); // Rollback optimistic update
  // No user notification!
}
```

**Implementation Plan:**

**Step 1: Use Error Context for User Feedback**
- **Files:** All store files with optimistic updates (`relationships-store.ts`, `updates-store.ts`, `people-store.ts`)
- **Action:**
  1. Import error context: `import { useError } from '@/contexts/error-context'` (NOTE: Can't use hooks in stores, see Step 2)
  2. **Alternative:** Throw errors from stores, catch in components
  3. Update catch blocks to throw errors:
     ```typescript
     } catch (error: any) {
       usePeopleStore.setState({ people: oldPeople });
       throw new Error(`Failed to save relationship: ${error.message}`);
     }
     ```

**Step 2: Catch Errors in Components**
- **Files:** Components using store actions (e.g., `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`)
- **Action:**
  1. Wrap store action calls in try/catch:
     ```typescript
     const { showError } = useError(); // Use error context hook
     
     try {
       await addParent(childId, parentId, userId);
     } catch (error) {
       showError('Failed to add parent. Please try again.');
     }
     ```
  2. **Safety:** Don't prevent rollback - stores should always rollback on error
  3. **UX:** Show user-friendly error messages via error context

**Step 3: Identify All Optimistic Update Locations**
- **Files to check:**
  - `stores/relationships-store.ts` - `addParent`, `addChild`, `addSpouse`, `addSibling`
  - `stores/updates-store.ts` - `addUpdate`, `updateUpdate`, `deleteUpdate`
  - `stores/people-store.ts` - Any optimistic updates
- **Action:** Add error handling to all catch blocks

**Step 4: Testing**
- Test network failure: Disable network → Attempt action → Verify rollback AND error message
- Test invalid data: Send invalid data → Verify error message shows
- Test success: Normal flow → Verify no error message appears

---

### 11. `getAllPeople()` Fetches ALL Users' Data

**Status:** ⚠️ SCALABILITY & PRIVACY  
**Impact:** Performance degrades with more users; potential data leakage  
**Priority:** 🟡 Medium (Scales poorly, privacy concern)

**Location:** `services/supabase/people-api.ts` lines 355-369 (approximate)

**Current Issue:**
```typescript
export async function getAllPeople(): Promise<Person[]> {
  const supabase = getSupabaseClient();
  
  const [peopleResponse, relationshipsResponse] = await Promise.all([
    supabase
      .from('people')
      .select('*')  // Fetches ALL people across ALL family trees
      .or('deletion_type.is.null,deletion_type.neq.delete_profile')
      .order('created_at', { ascending: true }),
    supabase.from('relationships').select('*'),  // Fetches ALL relationships
  ]);
}
```

**Problems:**
- At 100+ users, this fetches entire database
- RLS should limit this, but current policies may be too permissive
- Creates N+1 performance issues
- Privacy: Users shouldn't see people from other family trees

**Implementation Plan:**

**Step 1: Create SQL Function for Family Tree Query**
- **Location:** Supabase SQL Editor
- **Action:**
  1. Create recursive CTE function to get only connected family members:
     ```sql
     CREATE OR REPLACE FUNCTION get_family_tree(root_user_id UUID)
     RETURNS TABLE (
       user_id UUID,
       name TEXT,
       -- ... other columns from people table
     ) AS $$
     WITH RECURSIVE family AS (
       -- Base case: the root user's profile
       SELECT p.* FROM people p 
       WHERE p.linked_auth_user_id = root_user_id
       
       UNION
       
       -- Recursive case: related people
       SELECT DISTINCT p.* FROM people p
       INNER JOIN relationships r ON 
         (p.user_id = r.person_one_id OR p.user_id = r.person_two_id)
       INNER JOIN family f ON 
         (f.user_id = r.person_one_id OR f.user_id = r.person_two_id)
       WHERE p.user_id != f.user_id
         AND (p.deletion_type IS NULL OR p.deletion_type != 'delete_profile')
     )
     SELECT * FROM family;
     $$ LANGUAGE sql SECURITY DEFINER;
     ```
  2. **Safety:** Test with various family tree structures (cycles, disconnected nodes)
  3. **Performance:** Add indexes on `relationships.person_one_id` and `relationships.person_two_id`

**Step 2: Create New API Function**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. Create `getFamilyTree(userId: string): Promise<Person[]>` function
  2. Use Supabase RPC call:
     ```typescript
     export async function getFamilyTree(userId: string): Promise<Person[]> {
       const supabase = getSupabaseClient();
       
       const { data, error } = await supabase.rpc('get_family_tree', {
         root_user_id: userId
       });
       
       if (error) throw error;
       
       // Transform to Person[] format
       return data.map(transformDbPersonToPerson);
     }
     ```
  3. **Safety:** Add error handling for RPC call failures

**Step 3: Update `syncFamilyTree` to Use New Function**
- **File:** `stores/session-store.ts`
- **Action:**
  1. Import `getFamilyTree` instead of `getAllPeople`
  2. Update `syncFamilyTree` (line 131):
     ```typescript
     const peopleFromBackend = await getFamilyTree(userId);
     ```
  3. **Safety:** Keep `getAllPeople` for admin/debug purposes (if needed), but don't use in production flow

**Step 4: Update Relationships Loading**
- **File:** `services/supabase/people-api.ts` or separate function
- **Action:**
  1. Create `getFamilyRelationships(userId: string)` function
  2. Get relationships only for people in family tree:
     ```typescript
     // First get family tree
     const familyTree = await getFamilyTree(userId);
     const familyIds = familyTree.map(p => p.id);
     
     // Then get relationships involving family members
     const { data } = await supabase
       .from('relationships')
       .select('*')
       .in('person_one_id', familyIds)
       .or(`person_two_id.in.(${familyIds.join(',')})`);
     ```
  3. **Performance:** This is more efficient than fetching all relationships

**Step 5: Update RLS Policies**
- **Location:** Supabase SQL Editor
- **Action:**
  1. Review RLS policies on `people` table
  2. Ensure policies limit access to family members only
  3. **Security:** Test that users can't access other family trees even if RPC function has issues

**Step 6: Testing**
- Test small family tree: Verify all connected members load
- Test large family tree: Verify performance improvement
- Test disconnected family: Verify only connected members load
- Test privacy: Verify user A can't see user B's family tree
- Test edge cases: Cycles in relationships, multiple relationships, etc.

---

## 📦 Data Portability (Export Flow)

**Status:** ❌ Not implemented  
**Priority:** 🟡 Medium (GDPR requirement, Apple recommendation)

**Requirement:** Users should be able to export their data in a machine-readable format (GDPR Article 15, Apple App Store recommendation)

**Implementation Plan:**

**Step 1: Create Export API Function**
- **File:** `services/supabase/export-api.ts` (new file)
- **Action:**
  1. Create `exportUserData(userId: string): Promise<ExportData>` function
  2. Fetch all user's data from Supabase:
     - Profile data (`people` table where `linked_auth_user_id = userId`)
     - Relationships (`relationships` table where `person_one_id` or `person_two_id` matches user's profile)
     - Updates (`updates` table where `created_by = userId`)
     - Invitations sent (`invitations` table where `created_by = userId`)
     - Photos (list photo URLs from Storage - don't download, just list)
  3. Structure data as JSON:
     ```typescript
     interface ExportData {
       profile: Person;
       relationships: Relationship[];
       updates: Update[];
       invitations: Invitation[];
       photos: { url: string; path: string }[];
       exportedAt: string; // ISO 8601 timestamp
       exportVersion: string; // For future compatibility
     }
     ```

**Step 2: Generate JSON File**
- **File:** `services/supabase/export-api.ts`
- **Action:**
  1. Convert `ExportData` to JSON string: `JSON.stringify(data, null, 2)`
  2. Create filename: `familytree-export-${userId}-${timestamp}.json`
  3. Return JSON string and filename

**Step 3: Add Native Sharing**
- **File:** `services/export-service.ts` (new file, uses expo-sharing)
- **Action:**
  1. Install `expo-sharing` if not already installed
  2. Create `shareExportData(userId: string): Promise<void>` function:
     ```typescript
     import * as Sharing from 'expo-sharing';
     import * as FileSystem from 'expo-file-system';
     
     async function shareExportData(userId: string) {
       // 1. Get export data
       const exportData = await exportUserData(userId);
       const jsonString = JSON.stringify(exportData, null, 2);
       
       // 2. Write to temporary file
       const fileUri = FileSystem.documentDirectory + `export-${Date.now()}.json`;
       await FileSystem.writeAsStringAsync(fileUri, jsonString);
       
       // 3. Share using native share sheet
       await Sharing.shareAsync(fileUri, {
         mimeType: 'application/json',
         dialogTitle: 'Export Your Data'
       });
     }
     ```
  3. **Platform-specific:** iOS/Android share sheet will allow saving to device or emailing

**Step 4: Add UI in Settings**
- **File:** `app/(tabs)/settings.tsx`
- **Action:**
  1. Add "Download My Data" button in Settings screen
  2. Show loading state while generating export
  3. On success: Native share sheet opens automatically
  4. On error: Show error message with retry option
  5. **UX:** Show what data will be exported (profile, posts, relationships, photos)

**Step 5: Add to Privacy Policy**
- **File:** `app/privacy-policy.tsx` (when created)
- **Action:**
  1. Add section: "Your Right to Data Portability"
  2. Explain how to export data
  3. Explain what data is included in export

**Step 6: Testing**
- Test export flow: Settings → Download Data → Verify JSON is valid
- Test on iOS: Verify share sheet opens
- Test on Android: Verify share sheet opens
- Test with large data: Many updates/photos → Verify export completes
- Verify data completeness: Check JSON includes all user's data

---

## 🎂 Neutral Age Gate Flow

**Status:** ❌ Not implemented  
**Priority:** 🔴 Critical (COPPA compliance, required before App Store submission)

**Requirement:** COPPA requires age verification before collecting any data. Must ask for age BEFORE login buttons appear.

**Current Flow:** Login buttons appear first → Age not checked → Potential COPPA violation

**Implementation Plan:**

**Step 1: Create Age Gate Screen**
- **File:** `app/(auth)/age-gate.tsx` (new file, before login screen)
- **Action:**
  1. Create simple screen asking: "What is your birth year?" or "What is your date of birth?"
  2. **Options:**
     - **Option A:** Year only (simpler, less privacy-invasive)
       - Dropdown: Select year (e.g., 2000-2024)
     - **Option B:** Full date (more accurate, more privacy-invasive)
       - Date picker: Month, Day, Year
  3. Store age in local state (NOT sent to backend until after login)

**Step 2: Age Eligibility Check**
- **File:** `app/(auth)/age-gate.tsx`
- **Action:**
  1. Calculate age from birth year/date
  2. If age < 13:
     - Show "Not Eligible" message: "You must be 13 or older to use FamilyTree"
     - Disable login buttons (prevent any data collection)
     - **DO NOT** allow sign-in (COPPA violation if under 13)
  3. If age >= 13:
     - Show login buttons (Google Sign-In, etc.)
     - Proceed to normal login flow

**Step 3: Update Auth Flow**
- **File:** `app/(auth)/_layout.tsx` or `app/_layout.tsx`
- **Action:**
  1. Add age gate as first screen in auth flow
  2. Route: `/(auth)/age-gate` → `/(auth)/login`
  3. **Logic:**
     - If user is authenticated: Skip age gate (already verified)
     - If user is not authenticated: Show age gate first
  4. Store age eligibility in AsyncStorage (so user doesn't have to re-enter on app restart)

**Step 4: Privacy Policy Consent**
- **File:** `app/(auth)/age-gate.tsx` or `app/(auth)/login.tsx`
- **Action:**
  1. After age check passes (>= 13), show Privacy Policy consent checkbox
  2. Text: "I agree to the [Privacy Policy](link) and [Terms of Service](link)"
  3. **Required:** Checkbox must be checked before login buttons are enabled
  4. **Record:** Store `privacy_policy_accepted_at` timestamp after login (see Step 5)

**Step 5: Store Age and Consent in Database**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. After user signs in, create profile with:
     - `birth_date` (from age gate)
     - `privacy_policy_accepted_at` (timestamp)
     - `age_gate_passed_at` (timestamp - when age was verified)
  2. **Database:** Already have `privacy_policy_accepted_at` column (added in previous migration)
  3. **Update:** `createUserProfile()` function to include these fields

**Step 6: Handle Edge Cases**
- **File:** `app/(auth)/age-gate.tsx`
- **Action:**
  1. **User changes mind:** Allow changing age before signing in (reset form)
  2. **App restart:** Load age from AsyncStorage, skip age gate if already verified
  3. **User lies about age:** Can't prevent, but document in privacy policy that lying violates terms
  4. **Parent/Guardian:** If user says they're under 13, show message: "Please have a parent or guardian create an account"

**Step 7: Testing**
- Test under 13: Verify login buttons are disabled
- Test 13+: Verify login buttons are enabled after age check
- Test privacy policy: Verify consent checkbox is required
- Test app restart: Verify age gate is skipped if already passed
- Test COPPA compliance: Verify no data is collected before age check passes

---

## ✅ User Consent During Entry (Legal Shield)

**Status:** ⚠️ Partially implemented (database columns exist)  
**Priority:** 🔴 Critical (Apple requirement for UGC apps)

**Requirement:** Apple requires explicit consent affirmations when creating UGC (User Generated Content). Must be in UI, not just privacy policy.

**Database Status:** ✅ Already added:
- `people.creator_confirmed_consent` (BOOLEAN)
- `people.consent_confirmed_at` (TIMESTAMP)
- `updates.creator_confirmed_sharing_consent` (BOOLEAN)

**Implementation Plan:**

### Part A: Profile Creation Consent

**Step 1: Add Consent Checkbox to Add Person Modal**
- **File:** `components/family-tree/AddPersonModal.tsx`
- **Action:**
  1. Add checkbox/affirmation BEFORE "Save" button:
     - Text: "I confirm that I have obtained consent from this individual (or their legal guardian) to add their information to this family tree."
     - **Required:** Checkbox must be checked before "Save" is enabled
     - **Styling:** Prominent, with legal shield icon (if available)
  2. Store consent state in component state

**Step 2: Update Create Person API**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. Update `createRelative()` function to accept `creatorConfirmedConsent: boolean`
  2. When creating person, set:
     - `creator_confirmed_consent: true`
     - `consent_confirmed_at: new Date()`
  3. **Validation:** Throw error if `creatorConfirmedConsent` is false (prevent creation without consent)

**Step 3: Update Create Person UI to Pass Consent**
- **File:** `components/family-tree/AddPersonModal.tsx`
- **Action:**
  1. When calling `createRelative()`, pass consent value
  2. Show error if API rejects due to missing consent
  3. **UX:** Disable "Save" button if consent checkbox is not checked

**Step 4: Add Report Option (Back Door)**
- **File:** `components/family-tree/PersonCard.tsx` or profile page
- **Action:**
  1. Add "Report Profile" option in ellipses menu (see Report Abuse section)
  2. Report type: "Unauthorized Profile" or "Created Without Consent"
  3. **Apple Requirement:** Even with consent checkbox, subject must be able to disagree

### Part B: Update/Post Consent

**Step 1: Add Consent Checkbox to Add Update Modal**
- **File:** `components/family-tree/AddUpdateModal.tsx`
- **Action:**
  1. Add checkbox/affirmation when posting to someone else's wall:
     - Text: "I have permission to share this update and any included media on this person's profile."
     - **Conditional:** Only show if posting to someone else's profile (not own profile)
     - **Required:** Checkbox must be checked before "Post" is enabled
  2. Store consent state in component state

**Step 2: Update Create Update API**
- **File:** `services/supabase/updates-api.ts`
- **Action:**
  1. Update `createUpdate()` function to accept `creatorConfirmedSharingConsent: boolean`
  2. When creating update, set:
     - `creator_confirmed_sharing_consent: true` (if posting to someone else's wall)
     - `creator_confirmed_sharing_consent: false` (if posting to own wall - not required)
  3. **Validation:** Throw error if posting to someone else's wall without consent

**Step 3: Update Create Update UI to Pass Consent**
- **File:** `components/family-tree/AddUpdateModal.tsx`
- **Action:**
  1. Check if `targetPersonId !== currentUserId` (posting to someone else)
  2. If yes, show consent checkbox and require it
  3. If no (own profile), don't show checkbox (not required)
  4. Pass consent value to `createUpdate()` API call

**Step 4: Add Report Option to Updates**
- **File:** `app/(tabs)/profile.tsx` or `app/(tabs)/family.tsx`
- **Action:**
  1. Add "Report Update" option in update ellipses menu (already exists)
  2. Report type: "Unauthorized Sharing" or "Shared Without Consent"
  3. **Apple Requirement:** Subject must be able to report content even if creator claims consent

**Step 5: Update Privacy Policy**
- **File:** `app/privacy-policy.tsx` (when created)
- **Action:**
  1. Add section: "User Consent and Content Creation"
  2. Explain that creators must confirm they have consent
  3. Explain that subjects can report unauthorized content
  4. Explain that lying about consent violates terms of service

**Step 6: Testing**
- Test profile creation: Verify consent checkbox is required
- Test update creation: Verify consent checkbox only shows for others' profiles
- Test API validation: Verify API rejects without consent
- Test report flow: Verify users can report unauthorized content
- Test edge cases: Own profile updates (no consent needed), shadow profiles (consent needed)

---

## 🌐 External Request Flow (Web)

**Status:** ❌ Not implemented  
**Priority:** 🟡 Medium (Apple recommendation, GDPR requirement)

**Requirement:** Non-users (people who don't have the app) should be able to request removal of their shadow profiles via web form.

**Use Case:** Someone finds out their profile was created without their knowledge → They don't have the app → They need a way to request removal

**Implementation Plan:**

**Step 1: Create Web Form Page**
- **Location:** Create separate web app or static HTML page hosted on your domain
- **File:** `web/request-removal.html` (or similar, not in mobile app)
- **Action:**
  1. Create simple HTML form with:
     - Email input (required)
     - Name input (to identify profile)
     - Birth date input (optional, for verification)
     - Description textarea: "Why are you requesting removal?"
     - Submit button
  2. **Styling:** Simple, mobile-friendly design
  3. **URL:** `https://familytreeapp.com/request-removal` (or your domain)

**Step 2: Create Backend API Endpoint**
- **Location:** Supabase Edge Function or backend API
- **File:** `supabase/functions/request-removal/index.ts` (or backend API endpoint)
- **Action:**
  1. Create endpoint: `POST /api/request-removal`
  2. Accept form data:
     ```typescript
     interface RemovalRequest {
       email: string;
       name: string;
       birthDate?: string;
       description?: string;
     }
     ```
  3. Create record in database (new table `removal_requests`)
  4. Send confirmation email to requester

**Step 3: Create Removal Requests Table**
- **Location:** Supabase SQL Editor
- **Action:**
  1. Create table:
     ```sql
     CREATE TABLE removal_requests (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       email TEXT NOT NULL,
       requester_name TEXT NOT NULL,
       profile_name TEXT NOT NULL, -- Name of profile to remove
       birth_date DATE, -- Optional, for verification
       description TEXT,
       status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'completed', 'rejected'
       reviewed_by UUID REFERENCES auth.users(id),
       reviewed_at TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW()
     );
     ```
  2. Add indexes: `CREATE INDEX idx_removal_requests_status ON removal_requests(status)`

**Step 4: Match Request to Profile**
- **File:** Backend API or Supabase function
- **Action:**
  1. When request is submitted, search for matching profile:
     ```typescript
     // Find profiles matching name and birth date (if provided)
     const matchingProfiles = await supabase
       .from('people')
       .select('*')
       .eq('name', request.name)
       .or(request.birthDate ? `birth_date.eq.${request.birthDate}` : '');
     ```
  2. Store matched profile IDs in `removal_requests` table (add `matched_profile_ids` JSON column)
  3. **Manual Review:** Mark as "pending" for admin review (automated removal could be risky)

**Step 5: Admin Review Process (Manual)**
- **Location:** Admin panel or manual database review
- **Action:**
  1. Admin reviews removal requests:
     - Verify identity (email confirmation, proof of identity)
     - Check if profile matches requester
     - Approve or reject request
  2. If approved:
     - Delete profile (hard delete or soft delete)
     - Send confirmation email to requester
  3. If rejected:
     - Send explanation email to requester
     - Allow appeal process

**Step 6: Add Link in Privacy Policy**
- **File:** `app/privacy-policy.tsx` (when created)
- **Action:**
  1. Add section: "Request Removal of Your Profile"
  2. Link to web form: `https://familytreeapp.com/request-removal`
  3. Explain process: "If you don't have the app, you can request removal via our web form"

**Step 7: Email Verification**
- **File:** Backend API or Supabase function
- **Action:**
  1. Send verification email when request is submitted
  2. Require email confirmation before processing request
  3. **Security:** Prevents spam/fake requests

**Step 8: Testing**
- Test web form: Submit request → Verify email confirmation
- Test matching: Verify profile matching logic works
- Test admin review: Verify admin can approve/reject requests
- Test removal: Verify profile is deleted after approval
- Test email notifications: Verify emails are sent correctly

---

## 📧 Proactive Notification for Shadow Profiles

**Status:** ❌ Not implemented  
**Priority:** 🟡 Medium (Good practice, reduces unauthorized profiles)

**Requirement:** When email is added to a shadow profile, automatically send invitation email notifying the person.

**Implementation Plan:**

**Step 1: Detect Email Addition**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. In `updatePerson()` or `createRelative()`, check if `email` field is being added
  2. **Trigger:** After profile is created/updated with email, call notification function
  3. **Condition:** Only trigger if:
     - Profile is shadow profile (`linked_auth_user_id IS NULL`)
     - Email was just added (not already present)

**Step 2: Create Invitation Email**
- **File:** `services/supabase/invitations-api.ts` or new `services/email-service.ts`
- **Action:**
  1. Create `sendProfileNotificationEmail(email: string, profileId: string): Promise<void>`
  2. Generate invitation link (reuse existing `createInvitationLink()` logic)
  3. Send email with:
     - Subject: "A profile has been created for you on FamilyTree"
     - Body: Template explaining:
       - "A family member has created a profile for you on FamilyTree"
       - "You can [Claim it] or [Request its removal]"
       - Link to claim profile
       - Link to request removal (web form)
  4. **Email Service:** Use Supabase email service or third-party (SendGrid, etc.)

**Step 3: Update Profile Update API**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. In `updatePerson()`, after update succeeds:
     ```typescript
     // Check if email was just added to shadow profile
     if (updatedPerson.linkedAuthUserId === null && updatedPerson.email && !oldPerson?.email) {
       // Email was just added - send notification
       await sendProfileNotificationEmail(updatedPerson.email, updatedPerson.id);
     }
     ```
  2. **Safety:** Don't send email if profile already has `linked_auth_user_id` (already claimed)

**Step 4: Update Create Relative API**
- **File:** `services/supabase/people-api.ts`
- **Action:**
  1. In `createRelative()`, after profile is created:
     ```typescript
     // If email provided, send notification
     if (newPerson.email && newPerson.linkedAuthUserId === null) {
       await sendProfileNotificationEmail(newPerson.email, newPerson.id);
     }
     ```
  2. **Timing:** Send email after profile is successfully created (not before)

**Step 5: Email Template**
- **Location:** Email service template or HTML file
- **Action:**
  1. Create email template with:
     - Friendly greeting
     - Explanation of shadow profile
     - Two clear CTAs:
       - "Claim Your Profile" (button linking to invitation link)
       - "Request Removal" (button linking to removal form)
     - Privacy policy link
  2. **Tone:** Professional but friendly, non-alarming

**Step 6: Track Email Sending**
- **Database:** Add to `invitations` table or new `email_notifications` table
- **Action:**
  1. Record when notification email was sent
  2. Track: `sent_at`, `email`, `profile_id`, `email_type` ('profile_notification')
  3. **Purpose:** Prevent duplicate emails, track delivery

**Step 7: Testing**
- Test email sending: Add email to shadow profile → Verify email is sent
- Test email content: Verify links work (claim + removal)
- Test duplicate prevention: Add email twice → Verify only one email sent
- Test claimed profile: Add email to claimed profile → Verify no email sent
- Test email delivery: Verify emails arrive (check spam folder)

---

## 📊 Implementation Roadmap

**⚠️ IMPORTANT: Implement phases in order. Each phase must be completed and tested before moving to the next phase.**

---

### Phase 0: Foundation Fixes (Stability & Race Conditions) 🔴

**Priority:** 🔴 **MUST DO FIRST** - Fixes bugs that affect all other features  
**Why First:** These fixes ensure stable sync and prevent data corruption. Other features depend on reliable sync.

**Estimated Time:** 4-6 days

#### 0.1: Fix Session Store Race Condition
- [ ] Move `isSyncing` from module-level to Zustand state (`stores/session-store.ts`)
- [ ] Add `syncError: string | null` to store state
- [ ] Update `syncFamilyTree` to use Zustand state with proper cleanup
- [ ] Test: Multiple concurrent sync calls → Verify no race conditions
- [ ] Test: Sync failure → Verify `isSyncing` returns to `false` and error is set
- **Deliverable:** Stable sync function that prevents concurrent calls

#### 0.2: Fix Profile Context Sync Waiting
- [ ] Import `useSessionStore` hook in `contexts/profile-context.tsx`
- [ ] Add check for `isSyncing` before making routing decisions
- [ ] Wait for `isSyncing === false` before proceeding with profile checks
- [ ] Test: Sign in → Verify profile check waits for sync completion
- [ ] Test: Invited user sign-in → Verify sync completes before navigation
- **Deliverable:** Profile context waits for sync before routing

#### 0.3: Fix Auth Guard Timing
- [ ] Add `isSyncing` check in `contexts/guards/auth-guard.tsx`
- [ ] Wait for sync before checking ego validity
- [ ] Test: Fast sign-in → Verify guard doesn't redirect before sync
- **Deliverable:** Auth guard works correctly with async sync

#### 0.4: Fix Invitation Claim Flow Race Condition
- [ ] Update `app/join/[token].tsx` to wait for sync completion
- [ ] Remove `setTimeout` delay OR ensure it's after sync completes
- [ ] Verify people loaded before navigating
- [ ] Test: Claim invitation → Verify tree loads before navigation
- [ ] Test: Slow network → Verify navigation waits for sync
- **Deliverable:** Invitation flow works reliably

#### 0.5: Fix Optimistic Updates Error Handling
- [ ] Update all store catch blocks to throw errors (`relationships-store.ts`, `updates-store.ts`)
- [ ] Add error catching in components using stores
- [ ] Integrate `useError` context for user feedback
- [ ] Test: Network failure → Verify rollback AND error message
- **Deliverable:** Users see errors when optimistic updates fail

#### 0.6: Fix Profile Context useEffect Dependencies
- [ ] Remove `router` from dependency array (it's stable)
- [ ] Test: Verify no unnecessary re-renders
- **Deliverable:** Optimized profile context

**Phase 0 Testing Checklist:**
- ✅ Multiple users can sign in without sync conflicts
- ✅ Invited users see full family tree after claim
- ✅ Sync failures show errors, don't leave app in broken state
- ✅ Optimistic updates rollback correctly on error
- ✅ No race conditions in concurrent operations

---

### Phase 1: Critical Compliance (Blocking Submission) 🔴

**Priority:** 🔴 **MUST COMPLETE** - Required for App Store submission  
**Dependencies:** Phase 0 must be complete (stable sync required)  
**Estimated Time:** 16-22 days

#### 1.1: Neutral Age Gate (COPPA Compliance)
- [ ] Create age gate screen (`app/(auth)/age-gate.tsx`)
- [ ] Add age eligibility check (block < 13)
- [ ] Update auth flow to show age gate before login
- [ ] Store age eligibility in AsyncStorage
- [ ] Add privacy policy consent checkbox (required before login)
- [ ] Update `createUserProfile()` to store `birth_date` and `privacy_policy_accepted_at`
- [ ] Test: Under 13 → Verify login buttons disabled
- [ ] Test: 13+ → Verify login works after consent
- **Deliverable:** COPPA-compliant age verification
- **Time:** 2-3 days

#### 1.2: Privacy Policy
- [ ] Research Termly/Iubenda UGC templates
- [ ] Create privacy policy page (`app/privacy-policy.tsx`)
- [ ] Add sections: UGC, shadow profiles, data usage, user rights
- [ ] Add privacy policy link in Settings
- [ ] Add privacy policy link in age gate screen
- [ ] Update onboarding to reference privacy policy
- [ ] Test: Verify all links work, content is readable
- **Deliverable:** Complete privacy policy accessible in app
- **Time:** 2-3 days

#### 1.3: Report Abuse System
- [ ] Create `reports` table in database
- [ ] Create `reports-api.ts` with `reportContent()` function
- [ ] Add "Report" option in ellipses menus:
  - [ ] PersonCard ellipses menu (Family tab)
  - [ ] Update card ellipses menu (Profile tab)
  - [ ] Update card ellipses menu (Family feed)
- [ ] Create ReportAbuseModal component (reuse existing or create new)
- [ ] Implement report submission flow
- [ ] Test: Report profile → Verify report saved
- [ ] Test: Report update → Verify report saved
- [ ] Test: Report shadow profile → Verify report saved
- **Deliverable:** Users can report inappropriate content
- **Time:** 4-5 days

#### 1.4: Account Deletion
- [ ] Create database schema (soft delete columns, `deleted_profiles` table)
- [ ] Create `account-api.ts` with deletion functions
- [ ] Implement grace period system (30-day recovery)
- [ ] Implement recovery token system
- [ ] Add "Delete Account" UI in Profile tab
- [ ] Add deletion confirmation dialog (Delete Everything vs Keep Shadow Profile)
- [ ] Implement deleted profiles blacklist check
- [ ] Add "Cancel Deletion" button (during grace period)
- [ ] Test: Delete Everything → Verify blacklist prevents recreation
- [ ] Test: Keep Shadow Profile → Verify profile remains
- [ ] Test: Grace period recovery → Verify account restores
- **Deliverable:** Users can delete accounts with recovery option
- **Time:** 5-7 days

#### 1.5: Update Visibility & Management
- [ ] Implement `updateUpdateVisibility()` API
- [ ] Implement `deleteAllUserUpdates()` API
- [ ] Implement `updateAllUserUpdatesVisibility()` API
- [ ] Add visibility toggle in update ellipses menu
- [ ] Add "Manage My Updates" section in Profile tab
- [ ] Test: Toggle visibility → Verify update visibility changes
- [ ] Test: Bulk delete → Verify all updates deleted
- [ ] Test: Bulk visibility change → Verify all updates updated
- **Deliverable:** Users control their content visibility
- **Time:** 2-3 days

**Phase 1 Testing Checklist:**
- ✅ Age gate blocks under 13, allows 13+
- ✅ Privacy policy is accessible and complete
- ✅ Users can report all types of content
- ✅ Account deletion works with grace period
- ✅ Users can manage their updates visibility

---

### Phase 2: User Consent & Legal Shield (UGC Compliance) 🟡

**Priority:** 🟡 **High Priority** - Apple requirement for UGC apps  
**Dependencies:** Phase 1.2 (Privacy Policy must exist)  
**Estimated Time:** 4-6 days

**Note:** Database columns already exist (`creator_confirmed_consent`, `consent_confirmed_at`, `creator_confirmed_sharing_consent`)

#### 2.1: Profile Creation Consent
- [ ] Add consent checkbox to `AddPersonModal.tsx`
- [ ] Text: "I confirm that I have obtained consent from this individual (or their legal guardian) to add their information to this family tree."
- [ ] Make checkbox required (disable Save if unchecked)
- [ ] Update `createRelative()` API to accept and validate `creatorConfirmedConsent`
- [ ] Store consent in database (`creator_confirmed_consent`, `consent_confirmed_at`)
- [ ] Add "Report Profile" option to PersonCard (if not already in Phase 1.3)
- [ ] Test: Create profile without consent → Verify Save disabled
- [ ] Test: Create profile with consent → Verify profile created with consent flag
- [ ] Test: Report unauthorized profile → Verify report submitted
- **Deliverable:** Profile creation requires consent affirmation
- **Time:** 2-3 days

#### 2.2: Update/Post Consent (Posting to Others' Walls)
- [ ] Add consent checkbox to `AddUpdateModal.tsx`
- [ ] Show checkbox only when posting to someone else's profile (`targetPersonId !== currentUserId`)
- [ ] Text: "I have permission to share this update and any included media on this person's profile."
- [ ] Make checkbox required (disable Post if unchecked)
- [ ] Update `createUpdate()` API to accept and validate `creatorConfirmedSharingConsent`
- [ ] Store consent in database (`creator_confirmed_sharing_consent`)
- [ ] Test: Post to own wall → Verify no consent checkbox shown
- [ ] Test: Post to others' wall without consent → Verify Post disabled
- [ ] Test: Post to others' wall with consent → Verify update created with consent flag
- [ ] Test: Report unauthorized update → Verify report submitted
- **Deliverable:** Posting to others' walls requires consent affirmation
- **Time:** 2-3 days

**Phase 2 Testing Checklist:**
- ✅ Profile creation requires consent checkbox
- ✅ Posting to others' walls requires consent checkbox
- ✅ Consent flags stored in database
- ✅ Users can report unauthorized content
- ✅ Privacy policy references consent requirements

---

### Phase 3: Data Rights & Privacy (GDPR Compliance) 🟡

**Priority:** 🟡 **Medium Priority** - GDPR requirement, Apple recommendation  
**Dependencies:** Phase 1 complete (stable app, account deletion working)  
**Estimated Time:** 8-12 days

#### 3.1: Data Portability (Export)
- [ ] Create `export-api.ts` with `exportUserData()` function
- [ ] Fetch all user's data (profile, relationships, updates, invitations, photos)
- [ ] Generate JSON export file
- [ ] Install `expo-sharing` if not already installed
- [ ] Create `export-service.ts` with `shareExportData()` function
- [ ] Add "Download My Data" button in Settings
- [ ] Add export loading state and error handling
- [ ] Update privacy policy with data portability section
- [ ] Test: Export data → Verify JSON contains all user data
- [ ] Test: Share JSON → Verify native share sheet opens (iOS/Android)
- [ ] Test: Large exports → Verify completes successfully
- **Deliverable:** Users can export their data in JSON format
- **Time:** 3-4 days

#### 3.2: External Removal Request Flow (Web)
- [ ] Create web form HTML page (`web/request-removal.html`)
- [ ] Create `removal_requests` table in database
- [ ] Create backend API endpoint (Supabase Edge Function or API)
- [ ] Implement profile matching logic (name + birth date)
- [ ] Add email verification for requests
- [ ] Create admin review process (manual)
- [ ] Add link to web form in privacy policy
- [ ] Test: Submit removal request → Verify email sent
- [ ] Test: Verify email → Verify request saved
- [ ] Test: Admin approves → Verify profile deleted
- **Deliverable:** Non-users can request profile removal via web
- **Time:** 4-5 days

#### 3.3: Scalability Fix (`getAllPeople()` → Family Tree Query)
- [ ] Create SQL function `get_family_tree(root_user_id UUID)` with recursive CTE
- [ ] Test SQL function with various family tree structures
- [ ] Create `getFamilyTree()` API function in `people-api.ts`
- [ ] Create `getFamilyRelationships()` API function
- [ ] Update `syncFamilyTree()` in `session-store.ts` to use `getFamilyTree()`
- [ ] Update RLS policies to ensure privacy (test user A can't see user B's tree)
- [ ] Test: Small family tree → Verify all connected members load
- [ ] Test: Large family tree → Verify performance improvement
- [ ] Test: Privacy → Verify users can't see other family trees
- **Deliverable:** Efficient family tree queries (not fetching entire database)
- **Time:** 2-3 days

**Phase 3 Testing Checklist:**
- ✅ Users can export their data
- ✅ Web form allows removal requests
- ✅ Family tree queries are efficient and private
- ✅ All features work with new query system

---

### Phase 4: Enhanced Features & Notifications 🟢

**Priority:** 🟢 **Low Priority** - Nice-to-have features  
**Dependencies:** Phase 2 complete (consent system in place)  
**Estimated Time:** 4-6 days

#### 4.1: Proactive Shadow Profile Notifications
- [ ] Create `sendProfileNotificationEmail()` function
- [ ] Set up email service (Supabase or SendGrid)
- [ ] Create email template with "Claim" and "Request Removal" links
- [ ] Update `updatePerson()` to detect email addition to shadow profile
- [ ] Update `createRelative()` to send email if email provided
- [ ] Add email tracking to prevent duplicates
- [ ] Test: Add email to shadow profile → Verify email sent
- [ ] Test: Email content → Verify links work
- [ ] Test: Duplicate prevention → Verify only one email sent
- **Deliverable:** Shadow profiles with emails receive notification
- **Time:** 3-4 days

#### 4.2: Permission System (Wikipedia-Style Consensus)
- [ ] Create database schema (`profile_edit_history`, `profile_edit_rejections`, `profile_contributors`)
- [ ] Create `profile-edit-history-api.ts`
- [ ] Create `profile-edit-rejections-api.ts`
- [ ] Implement auto-submit edit logic (apply immediately)
- [ ] Implement rejection logic (post-hoc moderation, auto-revert on threshold)
- [ ] Add "Edit" button on shadow profile pages
- [ ] Add "Recent Changes" log UI
- [ ] Add rejection UI and status display
- [ ] Test: Edit shadow profile → Verify change applied immediately
- [ ] Test: Reject edit → Verify auto-revert after 2 rejections
- **Deliverable:** Collaborative editing system for shadow profiles
- **Time:** 5-7 days (can be split into separate sub-phase if needed)

**Phase 4 Testing Checklist:**
- ✅ Shadow profile emails trigger notifications
- ✅ Users can edit shadow profiles collaboratively
- ✅ Edit rejection system works correctly

---

### Phase 5: Future Enhancements 🔵

**Priority:** 🔵 **Future** - Can ship after App Store submission  
**Dependencies:** All previous phases complete  
**Estimated Time:** 11-15 days

#### 5.1: Memorial Mode
- [ ] Add `memorial_mode` column to `people` table
- [ ] Implement memorial detection logic (death date)
- [ ] Create memorial UI (badge, timeline view)
- [ ] Lock relationships in memorial mode
- [ ] Test: Deceased profile → Verify memorial mode enabled
- **Time:** 3-4 days

#### 5.2: Minor Protection
- [ ] Implement age calculation logic
- [ ] Add minor protection database columns
- [ ] Add privacy controls for minors
- [ ] Create parent/guardian system
- [ ] Test: Minor profile → Verify protections applied
- **Time:** 5-7 days

#### 5.3: Data Minimization Audit
- [ ] Audit all data collection points
- [ ] Remove unnecessary fields
- [ ] Document data retention policies
- [ ] Optimize photo storage
- [ ] Test: Verify app works with minimal data
- **Time:** 2-3 days

---

## 🎯 Phase Summary

| Phase | Priority | Time | Dependencies | Status |
|-------|----------|------|--------------|--------|
| **Phase 0** | 🔴 Critical | 4-6 days | None | ⬜ Not Started |
| **Phase 1** | 🔴 Critical | 16-22 days | Phase 0 | ⬜ Not Started |
| **Phase 2** | 🟡 High | 4-6 days | Phase 1.2 | ⬜ Not Started |
| **Phase 3** | 🟡 Medium | 8-12 days | Phase 1 | ⬜ Not Started |
| **Phase 4** | 🟢 Low | 4-6 days | Phase 2 | ⬜ Not Started |
| **Phase 5** | 🔵 Future | 11-15 days | All phases | ⬜ Not Started |

**Total Estimated Time:** 47-67 days (if done sequentially)

**Critical Path (Minimum for App Store Submission):**
- Phase 0 (4-6 days) → Phase 1 (16-22 days) → **Total: 20-28 days**

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
s
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
