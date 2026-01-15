# Update Menu Permissions System

## Overview

This document describes the centralized update menu permissions system that determines what actions users can perform on updates (posts) across the app.

## File Location

`utils/update-menu-permissions.ts`

## Logic

### Ownership Check
- **Own Update**: `update.createdBy === currentUserId`
  - User created the update (regardless of whose wall it's on)
  - Full permissions: Edit, Change Visibility, Delete, Report

### Tagged Updates
- **Tagged Update**: User is tagged in an update they didn't create
  - Only when viewing own profile
  - Can: Hide/Show on Profile, Report
  - Cannot: Edit, Delete, Change Visibility

### Other People's Updates
- **Not Own, Not Tagged**: Update created by someone else
  - On any profile (own or other's)
  - Can: Report only
  - Cannot: Edit, Delete, Change Visibility, Reject

## Menu Options by Permission

### Own Updates (createdBy === currentUserId)
- ✅ Edit
- ✅ Change Visibility (Public/Private)
- ✅ Delete
- ✅ Report

### Tagged Updates (on own profile)
- ✅ Hide/Show on Profile
- ✅ Report

### Other People's Updates
- ✅ Report only

## Usage

```typescript
import { getUpdateMenuPermissions } from '@/utils/update-menu-permissions';

const menuPermissions = getUpdateMenuPermissions(
  update,
  session?.user?.id,      // Current authenticated user ID
  viewingPersonId,        // Person whose profile is being viewed
  egoId,                  // Current user's profile ID
  viewingPerson           // Optional: Person object (for tagged visibility)
);

// Use permissions in UI
{menuPermissions.showMenuButton && (
  <MenuButton />
)}

{menuPermissions.canEdit && (
  <EditButton />
)}

{menuPermissions.canReport && (
  <ReportButton />
)}
```

## Screens Using This System

1. **Profile Tab** (`app/(tabs)/profile.tsx`)
   - Shows ego's own profile
   - Uses permissions for all updates on ego's wall

2. **Family Feed** (`app/(tabs)/family.tsx`)
   - Shows all family updates
   - Uses permissions based on ownership

3. **Person Profile** (`app/person/[personId].tsx`)
   - Shows any person's profile
   - Uses permissions based on ownership and viewing context

## Key Principle

**Always show menu button** - Report is always available, so the menu button should always be visible. The menu contents change based on permissions.
