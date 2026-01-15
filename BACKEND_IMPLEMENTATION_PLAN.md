# Backend Implementation Plan

## Overview
This document outlines the current state of backend integration and what needs to be implemented to complete the app functionality, particularly for App Store compliance.

**Status:** Planning Phase  
**Last Updated:** 2026

---

## 📊 Current State Analysis

### ✅ What's Already Implemented

#### Updates/Posts
- ✅ **Create Update** (`createUpdate` in `services/supabase/updates-api.ts`)
  - Handles photo upload to Supabase Storage
  - Creates update_tags for @mentions
  - Returns complete Update object
  - **Status:** Fully functional

- ✅ **Delete Update** (`deleteUpdate` in `services/supabase/updates-api.ts`)
  - Deletes from database
  - Deletes photo from Storage
  - Verifies user ownership
  - **Status:** Fully functional

- ✅ **Get Updates** (`getUpdatesForPerson`, `getAllUpdates`)
  - Fetches updates with tags
  - Sorted by date (newest first)
  - **Status:** Fully functional

#### Frontend State Management
- ✅ **UpdatesStore** (`stores/updates-store.ts`)
  - Optimistic updates
  - Local state management
  - `addUpdate`, `deleteUpdate`, `updateUpdate`, `toggleUpdatePrivacy`
  - **Status:** Frontend logic complete, but some actions need backend sync

#### UI Components
- ✅ **Report Abuse Modal** (`components/family-tree/ReportAbuseModal.tsx`)
  - UI for reporting content
  - Reason selection
  - Description input
  - **Status:** UI complete, but no backend API call

- ✅ **Account Deletion Modal** (`components/family-tree/AccountDeletionModal.tsx`)
  - Two deletion options (Delete Everything / Keep Shadow Profile)
  - **Status:** UI complete, but no backend API call

---

## ❌ What Needs to Be Implemented

### 1. Update Management (Backend Sync)

#### 1.1 Edit Update API
**Current State:** Frontend has `updateUpdate()` in store, but it only updates local state. No backend sync.

**Required:**
- `updateUpdate()` function in `services/supabase/updates-api.ts`
- Update database row (title, caption, photo_url, is_public)
- Update update_tags if taggedPersonIds changed
- Handle photo replacement if new photo uploaded

**Database Schema:** Already exists
```sql
-- updates table already has:
-- title, photo_url, caption, is_public, updated_at
-- update_tags table for taggedPersonIds
```

**Implementation:**
```typescript
// services/supabase/updates-api.ts
export async function updateUpdate(
  userId: string,
  updateId: string,
  input: {
    title?: string;
    photoUrl?: string; // Can be local file:// URI or remote URL
    caption?: string;
    isPublic?: boolean;
    taggedPersonIds?: string[];
  }
): Promise<Update>
```

**File to Create/Update:**
- `services/supabase/updates-api.ts` - Add `updateUpdate()` function

**Frontend Integration:**
- Update `stores/updates-store.ts` `updateUpdate()` to call API
- Currently: Only updates local state
- Needed: Call `updateUpdateAPI()` then update local state

---

#### 1.2 Toggle Update Privacy API
**Current State:** Frontend has `toggleUpdatePrivacy()` in store, but it only updates local state. No backend sync.

**Required:**
- `toggleUpdatePrivacy()` function in `services/supabase/updates-api.ts`
- Update `is_public` column in database
- Verify user has permission (owner or admin)

**Database Schema:** Already exists
```sql
-- updates table already has:
-- is_public boolean DEFAULT false
```

**Implementation:**
```typescript
// services/supabase/updates-api.ts
export async function toggleUpdatePrivacy(
  userId: string,
  updateId: string
): Promise<Update>
```

**File to Create/Update:**
- `services/supabase/updates-api.ts` - Add `toggleUpdatePrivacy()` function

**Frontend Integration:**
- Update `stores/updates-store.ts` `toggleUpdatePrivacy()` to call API
- Currently: Only toggles local state
- Needed: Call `toggleUpdatePrivacyAPI()` then update local state

---

### 2. Report Abuse System

#### 2.1 Database Schema (NEW TABLE NEEDED)
**Current State:** No reports table exists.

**Required:**
```sql
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('update', 'profile', 'shadow_profile', 'user')),
  target_id UUID NOT NULL, -- ID of reported item (updates_id, user_id, etc.)
  target_type TEXT NOT NULL, -- 'update', 'person', 'user' for reference
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate_content',
    'harassment',
    'spam',
    'incorrect_info',
    'unauthorized_profile',
    'created_without_consent',
    'impersonation',
    'abuse'
  )),
  description TEXT, -- Optional user description
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_user_id);
```

**RLS Policies:**
```sql
-- Users can create reports
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_user_id);

-- Admins can view all reports (future)
-- CREATE POLICY "Admins can view all reports"
--   ON public.reports FOR SELECT
--   USING (is_admin(auth.uid()));
```

#### 2.2 Reports API Service (NEW FILE)
**Required:**
- Create `services/supabase/reports-api.ts`

**Functions:**
```typescript
// services/supabase/reports-api.ts

/**
 * Submit a report for inappropriate content
 */
export async function reportContent(
  userId: string,
  input: {
    reportType: 'update' | 'profile' | 'shadow_profile' | 'user';
    targetId: string;
    reason: ReportReason;
    description?: string;
  }
): Promise<{ id: string; status: string }>

/**
 * Get reports submitted by a user (for their own review)
 */
export async function getUserReports(userId: string): Promise<Report[]>

// Future admin functions:
// export async function getAllReports(): Promise<Report[]>
// export async function resolveReport(reportId: string, resolution: 'resolved' | 'dismissed'): Promise<void>
```

**File to Create:**
- `services/supabase/reports-api.ts` - New file

**Frontend Integration:**
- Update `ReportAbuseModal` onSubmit handlers in:
  - `app/(tabs)/profile.tsx`
  - `app/(tabs)/family.tsx`
  - `app/person/[personId].tsx`
- Currently: `console.log('[Profile] Report submitted:', ...)`
- Needed: Call `reportContent()` API

---

### 3. Account Deletion System

#### 3.1 Database Schema Updates (MODIFY EXISTING TABLES)
**Current State:** No deletion tracking exists.

**What are the 5 deletion tracking columns?**
These columns track the account deletion process and grace period:
1. `deleted_at` - When the account was actually deleted (after grace period ends)
2. `deleted_by` - Who deleted the account (user ID, usually the user themselves)
3. `deletion_requested_at` - When the user first requested deletion (starts the 30-day grace period)
4. `deletion_grace_period_ends_at` - When the grace period ends (30 days after request)
5. `deletion_recovery_token` - Token that allows user to restore account during grace period

**Required Schema Changes:**
```sql
-- Add deletion tracking columns to people table (5 columns total)
-- These columns track the deletion process and grace period
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
  -- When the account was actually deleted (after grace period)

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
  -- Who deleted the account (usually the user themselves)

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE;
  -- When the user first requested deletion (starts grace period)

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deletion_grace_period_ends_at TIMESTAMP WITH TIME ZONE;
  -- When the grace period ends (30 days after deletion_requested_at)

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deletion_recovery_token TEXT;
  -- Token that allows user to restore account during grace period

-- Index for efficient querying of accounts in grace period
CREATE INDEX IF NOT EXISTS idx_people_deletion_grace ON public.people(deletion_grace_period_ends_at) 
  WHERE deletion_requested_at IS NOT NULL;
```

**Note:** We are NOT creating a blacklist table. Based on the current deletion options:
- **Delete Profile**: Removes photos/stories and account info, but name remains in tree
- **Deactivate Profile**: Keeps photos/stories, removes account info only

Both options preserve the person's name in the family tree for historical purposes, so no blacklist is needed.

#### 3.2 Account Deletion API Service (NEW FILE)
**Required:**
- Create `services/supabase/account-api.ts`

**Functions:**
```typescript
// services/supabase/account-api.ts

/**
 * Request account deletion (starts grace period)
 */
export async function requestAccountDeletion(
  userId: string,
  options: {
    deletionType: 'delete_profile' | 'deactivate_profile';
  }
): Promise<{
  deletionRequestedAt: string;
  gracePeriodEndsAt: string;
  recoveryToken: string;
}>

/**
 * Cancel account deletion during grace period
 */
export async function cancelAccountDeletion(userId: string): Promise<void>

/**
 * Actually delete account after grace period (background job)
 * This should be called by a scheduled function/trigger, not directly by user
 */
export async function processAccountDeletion(userId: string): Promise<void>

/**
 * Restore account using recovery token
 */
export async function restoreAccount(recoveryToken: string): Promise<void>

/**
 * Get deletion status for a user's account
 */
export async function getAccountDeletionStatus(userId: string): Promise<{
  deletionRequestedAt: string | null;
  gracePeriodEndsAt: string | null;
  recoveryToken: string | null;
  isInGracePeriod: boolean;
} | null>
```

**File to Create:**
- `services/supabase/account-api.ts` - New file

**Frontend Integration:**
- Update `app/(tabs)/settings.tsx` `handleDeleteAccount()` function
- Currently: `console.log('[Settings] Account deletion requested:', option)`
- Needed: Call `requestAccountDeletion()` API

**Deletion Logic:**
- **Option 1: Delete Profile** (`delete_profile`)
  - Delete auth user from `auth.users`
  - Delete all user's updates (photos and stories)
  - Delete user's photos from Storage (person_photos, update_photos)
  - Set `linked_auth_user_id = NULL` (profile becomes shadow profile)
  - **Keep person record** with name only (for family history)
  - Keep relationships (profile remains in tree structure)
  - Remove PII: Clear bio, phone_number, photo_url from person record
  - Mark `deleted_at` timestamp

- **Option 2: Deactivate Profile** (`deactivate_profile`)
  - Delete auth user from `auth.users`
  - Set `linked_auth_user_id = NULL` (profile becomes shadow profile)
  - **Keep all updates, photos, stories** (contributed content remains)
  - Keep relationships (profile remains in tree structure)
  - Remove PII: Clear bio, phone_number from person record (keep photo_url)
  - Mark `deleted_at` timestamp after 1 year (soft delete, not immediate)

---

## 📁 File Structure (Separation of Concerns)

### Current Structure
```
services/
  supabase/
    updates-api.ts          ✅ Create, Delete, Get
    people-api.ts           ✅ CRUD operations
    relationships-api.ts    ✅ CRUD operations
    invitations-api.ts      ✅ Create, validate
    storage-api.ts          ✅ Upload, delete photos
    supabase-init.ts        ✅ Client initialization
    shared/
      mappers.ts            ✅ Database row mappers
      photo-upload.ts       ✅ Photo upload logic
```

### Files to Create/Update

#### New Files
```
services/
  supabase/
    reports-api.ts          ❌ NEW - Report abuse functionality
    account-api.ts          ❌ NEW - Account deletion functionality
```

#### Files to Update
```
services/
  supabase/
    updates-api.ts          ⚠️ UPDATE - Add updateUpdate() and toggleUpdatePrivacy()
```

---

## 🔧 Implementation Checklist

### Phase 1: Update Management (High Priority)
- [ ] **Database:** Verify `updates` table has all required columns
  - [x] `title` ✅
  - [x] `photo_url` ✅
  - [x] `caption` ✅
  - [x] `is_public` ✅
  - [x] `updated_at` ✅
  - [x] `update_tags` table ✅

- [ ] **API:** Add `updateUpdate()` to `services/supabase/updates-api.ts`
  - [ ] Handle photo upload/replacement
  - [ ] Update update_tags if taggedPersonIds changed
  - [ ] Verify user ownership
  - [ ] Return updated Update object

- [ ] **API:** Add `toggleUpdatePrivacy()` to `services/supabase/updates-api.ts`
  - [ ] Toggle `is_public` column
  - [ ] Verify user ownership
  - [ ] Return updated Update object

- [ ] **Store:** Update `stores/updates-store.ts`
  - [ ] `updateUpdate()` - Call API then update local state
  - [ ] `toggleUpdatePrivacy()` - Call API then update local state

- [ ] **Testing:** Verify edit and privacy toggle work end-to-end

### Phase 2: Report Abuse System (High Priority - App Store Compliance)
- [ ] **Database:** Create `reports` table
  - [ ] Run migration SQL
  - [ ] Set up RLS policies
  - [ ] Create indexes

- [ ] **API:** Create `services/supabase/reports-api.ts`
  - [ ] `reportContent()` - Submit report
  - [ ] `getUserReports()` - Get user's reports (optional)

- [ ] **Frontend:** Update report handlers
  - [ ] `app/(tabs)/profile.tsx` - Call `reportContent()` API
  - [ ] `app/(tabs)/family.tsx` - Call `reportContent()` API
  - [ ] `app/person/[personId].tsx` - Call `reportContent()` API

- [ ] **Testing:** Verify reports are saved to database

### Phase 3: Account Deletion (High Priority - App Store Compliance)
- [ ] **Database:** Update `people` table
  - [ ] Add 5 deletion tracking columns (see schema above)
  - [ ] Create index for grace period queries

- [ ] **API:** Create `services/supabase/account-api.ts`
  - [ ] `requestAccountDeletion()` - Start grace period
  - [ ] `cancelAccountDeletion()` - Cancel during grace period
  - [ ] `processAccountDeletion()` - Actually delete (background job)
  - [ ] `restoreAccount()` - Restore using token
  - [ ] `getAccountDeletionStatus()` - Get deletion status for user

- [ ] **Frontend:** Update `app/(tabs)/settings.tsx`
  - [ ] `handleDeleteAccount()` - Call `requestAccountDeletion()` API
  - [ ] Show grace period information
  - [ ] Show recovery token
  - [ ] Add "Cancel Deletion" button (if grace period active)

- [ ] **Background Job:** Set up scheduled function for `processAccountDeletion()`
  - [ ] Check for accounts past grace period
  - [ ] Process deletions based on option (delete_profile vs deactivate_profile)
  - [ ] Clean up PII while preserving name in tree

- [ ] **Testing:** Verify deletion flow works end-to-end

---

## 🗄️ Database Migration Summary

### New Tables
1. **`reports`** - Content reporting system

### Modified Tables
1. **`people`** - Add 5 deletion tracking columns:
   - `deleted_at` - When account was actually deleted (after grace period)
   - `deleted_by` - Who deleted the account (user ID)
   - `deletion_requested_at` - When deletion was requested (starts grace period)
   - `deletion_grace_period_ends_at` - When grace period ends (30 days later)
   - `deletion_recovery_token` - Token to restore account during grace period

### No Changes Needed
- ✅ `updates` - Already has all required columns
- ✅ `update_tags` - Already exists
- ✅ `relationships` - No changes needed
- ✅ `invitation_links` - No changes needed

### No New Tables Needed
- ❌ `deleted_profiles` - **NOT NEEDED** - Names remain in tree, no blacklist required

---

## 🔐 Security Considerations

### RLS Policies Needed
1. **Reports Table:**
   - Users can create reports
   - Users can view their own reports
   - Admins can view all reports (future)

2. **Account Deletion:**
   - Users can only delete their own account
   - Users can only cancel their own deletion
   - Background job needs service role access

### Verification Checks
- **Update Edit/Delete:** Verify `created_by = auth.uid()`
- **Report Creation:** Verify `reporter_user_id = auth.uid()`
- **Account Deletion:** Verify user owns the account being deleted

---

## 📝 Next Steps

1. **Review this plan** - Ensure all requirements are captured
2. **Create database migrations** - Run SQL for new tables/columns
3. **Implement Phase 1** - Update management APIs
4. **Implement Phase 2** - Report abuse system
5. **Implement Phase 3** - Account deletion system
6. **Testing** - End-to-end testing of all features
7. **App Store Submission** - Ensure compliance requirements met

---

## 🎯 Priority Order

1. **Phase 2 (Reports)** - Required for App Store submission (Guideline 5.1.1)
2. **Phase 3 (Account Deletion)** - Required for App Store submission (Guideline 5.1.1)
3. **Phase 1 (Update Management)** - Important for user experience, but not blocking

---

## 📚 Related Documentation

- `COMPLIANCE_PLAN.md` - Full compliance requirements
- `SETTINGS_IMPLEMENTATION_PLAN.md` - Settings page implementation
- Database schema (provided by user)

---

**Ready to implement?** Start with Phase 2 (Reports) as it's required for App Store submission and has the simplest implementation.
