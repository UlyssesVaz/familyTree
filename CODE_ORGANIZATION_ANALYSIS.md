# Code Organization & Duplication Analysis

## 📋 Current Structure

### **Utilities (`utils/`)**
1. **`date-utils.ts`** - Date formatting utilities
   - `formatDateRange()` - Format birth/death date ranges
   - `formatYear()` - Extract year from date string

2. **`gender-utils.ts`** - Gender-related utilities
   - `GENDER_COLORS` - Color constants for male/female
   - `getGenderColor()` - Get color based on gender

3. **`mentions.ts`** - Mention parsing and display utilities
   - `getDisplayNameWithContext()` - Get display name with context for duplicates
   - `parseMentions()` - Parse @mentions from caption text
   - `getMentionString()` - Get mention string for a person

4. **`format-mentions.tsx`** - React component for formatting mentions
   - `formatMentions()` - Returns React components with styled @mentions

### **Services (`services/`)**

#### **Supabase Services (`services/supabase/`)**
1. **`supabase-init.ts`** - Supabase client initialization
   - `initializeSupabase()` - Initialize client
   - `getSupabaseClient()` - Get client instance
   - `isSupabaseInitialized()` - Check initialization status

2. **`storage-api.ts`** - Storage operations
   - `uploadImage()` - Upload image to Supabase Storage
   - `downloadImage()` - Download image from storage
   - `getPublicImageUrl()` - Get public URL for image
   - `deleteImage()` - Delete image from storage
   - `STORAGE_BUCKETS` - Bucket name constants

3. **`people-api.ts`** - People CRUD operations
   - `getUserProfile()` - Get user's profile
   - `createEgoProfile()` - Create ego profile
   - `updateEgoProfile()` - Update ego profile
   - `createRelative()` - Create relative (ancestor) profile
   - `getAllPeople()` - Get all people with relationships

4. **`relationships-api.ts`** - Relationship operations
   - `createRelationship()` - Create relationship
   - `getRelationshipsForPerson()` - Get relationships for person

5. **`updates-api.ts`** - Update/post operations
   - `createUpdate()` - Create update with photo upload
   - `getAllUpdates()` - Get all updates
   - `getUpdatesForPerson()` - Get updates for person
   - `deleteUpdate()` - Delete update and photo

6. **`invitations-api.ts`** - Invitation link operations
   - `createInvitationLink()` - Create invitation link
   - `getInvitationLink()` - Get invitation by token
   - `claimInvitationLink()` - Claim invitation (update linked_auth_user_id)
   - `getInvitationLinksForPerson()` - Get links for person

#### **Other Services**
- **`auth/`** - Authentication service abstraction
- **`family-tree-service.ts`** - Family tree service (legacy?)
- **`location-service.ts`** - Location services

---

## 🔍 Duplication Analysis

### **1. Error Handling Patterns** ⚠️ **HIGH PRIORITY**

**Duplicated Pattern:**
All Supabase API files have similar error handling:
```typescript
const { data, error } = await supabase.from('table').select()...

if (error) {
  console.error('[API Name] Error message:', error);
  throw new Error(`Failed to operation: ${error.message}`);
}

if (!data) {
  throw new Error('Failed to operation: No data returned');
}
```

**Files Affected:**
- `people-api.ts` - 5+ instances
- `relationships-api.ts` - 2+ instances
- `updates-api.ts` - 4+ instances
- `invitations-api.ts` - 3+ instances

**Recommendation:**
Create `utils/supabase-error-handler.ts`:
```typescript
export function handleSupabaseError<T>(
  data: T | null,
  error: any,
  operation: string,
  apiName: string
): T {
  if (error) {
    // Handle specific error codes (PGRST116 = no rows, etc.)
    if (error.code === 'PGRST116') {
      return null as T; // Or throw specific error
    }
    console.error(`[${apiName}] Error ${operation}:`, error);
    throw new Error(`Failed to ${operation}: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`Failed to ${operation}: No data returned`);
  }
  
  return data;
}
```

**Impact:** Reduces ~50 lines of duplicated code across 4 files.

---

### **2. Photo Upload Logic** ⚠️ **MEDIUM PRIORITY**

**Duplicated Pattern:**
Both `people-api.ts` and `updates-api.ts` have similar photo upload logic:

```typescript
// In people-api.ts (createEgoProfile, createRelative)
if (photoUrl?.startsWith('file://')) {
  try {
    const uploadedUrl = await uploadImage(
      photoUrl,
      STORAGE_BUCKETS.PERSON_PHOTOS,
      `profiles/${userId}`
    );
    if (uploadedUrl) {
      photoUrl = uploadedUrl;
    } else {
      console.warn('[API] Photo upload returned null');
      photoUrl = null;
    }
  } catch (error) {
    console.error('[API] Error uploading photo:', error);
    photoUrl = null; // Continue without photo
  }
}

// In updates-api.ts (createUpdate)
if (photoUrl && photoUrl.startsWith('file://')) {
  try {
    const uploadedUrl = await uploadImage(
      photoUrl,
      STORAGE_BUCKETS.UPDATE_PHOTOS,
      authenticatedUserId
    );
    if (uploadedUrl) {
      photoUrl = uploadedUrl;
    } else {
      console.warn('[Updates API] Photo upload returned null');
      photoUrl = null;
    }
  } catch (error) {
    console.error('[Updates API] Error uploading photo:', error);
    photoUrl = null;
  }
}
```

**Recommendation:**
Create `utils/photo-upload-helper.ts`:
```typescript
export async function uploadPhotoIfLocal(
  photoUrl: string | null | undefined,
  bucket: string,
  folder?: string
): Promise<string | null> {
  if (!photoUrl?.startsWith('file://')) {
    return photoUrl || null;
  }
  
  try {
    const uploadedUrl = await uploadImage(photoUrl, bucket, folder);
    return uploadedUrl || null;
  } catch (error) {
    console.error('[Photo Upload] Error:', error);
    return null; // Continue without photo
  }
}
```

**Impact:** Reduces ~30 lines of duplicated code, standardizes error handling.

---

### **3. Database Row Mapping** ⚠️ **LOW PRIORITY**

**Duplicated Pattern:**
All API files map database rows to TypeScript types:

```typescript
// In people-api.ts
const person: Person = {
  id: data.user_id,
  name: data.name,
  birthDate: data.birth_date || undefined,
  // ... 15+ more fields
};

// In updates-api.ts
const update: Update = {
  id: data.updates_id,
  personId: data.user_id,
  // ... 10+ more fields
};
```

**Recommendation:**
Keep as-is for now. Each mapping is domain-specific and may have unique logic. Consider creating mapper functions only if patterns become more complex.

---

### **4. UUID Generation** ✅ **ALREADY GOOD**

**Current State:**
- `relationships-api.ts` uses `uuidv4()`
- `updates-api.ts` uses `uuidv4()`
- `invitations-api.ts` uses `crypto.randomUUID()`

**Recommendation:**
Standardize on `uuidv4()` from `uuid` package (already used in most places). Update `invitations-api.ts` to use `uuidv4()` for consistency.

---

### **5. Supabase Client Access** ✅ **ALREADY GOOD**

**Current State:**
All files use `getSupabaseClient()` from `supabase-init.ts` - **no duplication**.

---

### **6. Mention Parsing** ⚠️ **POTENTIAL DUPLICATION**

**Current State:**
- `utils/mentions.ts` - Core parsing logic
- `utils/format-mentions.tsx` - React component formatting
- `components/family-tree/AddUpdateModal.tsx` - Uses `parseMentions()` and `getMentionString()`

**Analysis:**
No duplication found - utilities are properly separated. `format-mentions.tsx` uses a simpler regex (`/@(\w+)/g`) vs `mentions.ts` (`/@([a-zA-Z0-9_.-]+(?:\s+[a-zA-Z0-9_.-]+)?)/g`), but they serve different purposes (display vs parsing).

**Recommendation:**
Consider documenting the difference or aligning regex patterns if needed.

---

## 📊 Summary Statistics

| Category | Files | Duplicated Lines | Priority |
|----------|-------|------------------|----------|
| Error Handling | 4 | ~50 | HIGH |
| Photo Upload | 2 | ~30 | MEDIUM |
| UUID Generation | 3 | ~3 | LOW |
| Row Mapping | 4 | ~100 | LOW (domain-specific) |

---

## 🎯 Recommended Actions

### **Phase 1: High Priority (Immediate)**
1. ✅ **Create `utils/supabase-error-handler.ts`**
   - Consolidate error handling logic
   - Handle common error codes (PGRST116, etc.)
   - Standardize error messages

2. ✅ **Refactor all API files to use error handler**
   - `people-api.ts`
   - `relationships-api.ts`
   - `updates-api.ts`
   - `invitations-api.ts`

### **Phase 2: Medium Priority (Next)**
3. ✅ **Create `utils/photo-upload-helper.ts`**
   - Consolidate photo upload logic
   - Standardize error handling for uploads

4. ✅ **Refactor photo upload calls**
   - `people-api.ts` (createEgoProfile, createRelative)
   - `updates-api.ts` (createUpdate)

### **Phase 3: Low Priority (Future)**
5. ⚠️ **Standardize UUID generation**
   - Update `invitations-api.ts` to use `uuidv4()` instead of `crypto.randomUUID()`

6. ⚠️ **Document mention parsing differences**
   - Clarify when to use `parseMentions()` vs `formatMentions()`

---

## ✅ What's Already Well-Organized

1. **Service Layer Separation** - All Supabase operations are in dedicated API files
2. **Storage Abstraction** - `storage-api.ts` centralizes all storage operations
3. **Utility Functions** - Date, gender, and mention utilities are properly separated
4. **Type Definitions** - Types are centralized in `types/family-tree.ts`
5. **Client Initialization** - Single source of truth for Supabase client

---

## 📝 Notes

- **No major architectural issues** - Code is well-organized overall
- **Duplications are minor** - Mostly error handling and photo upload patterns
- **Utilities are properly separated** - No cross-dependencies or circular imports
- **Service layer is clean** - Each API file has a clear responsibility

---

## 🔄 Next Steps

1. Review this analysis
2. Prioritize which duplications to address first
3. Create utility functions for error handling and photo uploads
4. Refactor API files to use new utilities
5. Test thoroughly to ensure no regressions
