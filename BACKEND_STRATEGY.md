# Backend Integration Strategy & State Management Recommendations

## Executive Summary

**Current Status**: **✅ Backend Integration Complete - Using Zustand + Supabase Directly**

- ✅ **Zustand** for all state (UI + server data) - working well with optimistic updates
- ✅ **Supabase** for database + REST APIs + Storage
- ✅ **Direct Supabase Client** - no custom API server needed
- ✅ **Optimistic Updates Pattern** - instant UI, silent background saves
- ⏳ **WebSocket Real-time** - planned for future (Supabase Realtime subscriptions)
- ⏳ **TanStack Query** - optional future optimization (not needed yet)

**Decision**: Zustand + Supabase direct client is working well. TanStack Query can be added later if needed for advanced caching/background sync, but current approach is production-ready.

---

## 0. Authentication & Profile Check Strategy (Current Implementation)

### **Current Approach: Database → State Cache Pattern**

**How It Works:**
1. **Database Check (ONCE)**: When user authenticates, we query Supabase database once via `getUserProfile(userId)`
2. **State Cache**: Profile data is loaded into Zustand store (`loadEgo(profile)`) for fast access
3. **Routing Decisions**: All routing logic uses cached state (`getEgo()`) - no database queries
4. **Security Guard**: Only tabs access is protected (checks state, not database)

**Why This Approach:**
- ✅ **Performance**: No constant database polling - check once, cache in memory
- ✅ **Battery Efficient**: Mobile apps should minimize network requests
- ✅ **Fast Routing**: State checks are instant (no network latency)
- ✅ **Best Practice**: Industry standard pattern (check on auth, cache in state)

**When We Refresh:**
- ✅ **On Sign In**: Fresh database check
- ✅ **On Sign Out**: Clear cache
- ✅ **After Profile Creation**: State updated immediately (optimistic update)
- ❌ **NOT Constantly**: No polling, no background checks during navigation

**Future: WebSocket/Realtime Updates**
- When we add Supabase Realtime subscriptions, we'll update Zustand state when database changes
- This allows real-time sync without constant polling
- Pattern: Database change → WebSocket event → Update Zustand → UI updates automatically

**Code Location:**
- Profile Check: `contexts/auth-context.tsx` (lines 87-156)
- Database Query: `services/supabase/people-api.ts` (`getUserProfile`)
- State Cache: `stores/family-tree-store.ts` (`loadEgo`, `getEgo`)

---

## 1. State Management: Zustand vs TanStack Query

### **TL;DR: Use BOTH (Not Either/Or)**

| Use Case | Current | Recommended | Why |
|----------|---------|-------------|-----|
| **Server Data** (People, Updates, Relationships) | Zustand | **TanStack Query** | Caching, background sync, error retry |
| **UI State** (modals, filters, expanded/collapsed) | Zustand | **Keep Zustand** | Works perfectly, no need to change |
| **Optimistic Updates** | Zustand | **TanStack Query + Zustand** | Query for server sync, Zustand for instant UI |
| **Form State** | Local useState | **Keep useState** | Simple forms don't need global state |

### **Why NOT Migrate Everything to TanStack Query?**

**TanStack Query is excellent for:**
- ✅ Fetching from APIs
- ✅ Caching server responses
- ✅ Background refetching
- ✅ Optimistic updates with rollback
- ✅ Loading/error states

**But Zustand is better for:**
- ✅ Client-side UI state (modals, filters, expanded states)
- ✅ Computed values (tree layout calculations)
- ✅ Temporary form state
- ✅ Real-time subscriptions (when used with Supabase Realtime)

### **Why Use TanStack Query for Server State?**

**Current Zustand Limitations for Server State:**
1. ❌ No automatic caching - refetches on every mount
2. ❌ No background sync - data can become stale
3. ❌ Manual loading/error state management
4. ❌ No automatic retry on failures
5. ❌ No request deduplication (same request fired multiple times)

**TanStack Query Benefits:**
```typescript
// Current: Manual loading/error states
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const fetchPeople = async () => {
  setLoading(true);
  try {
    const data = await api.getPeople();
    setPeople(data);
  } catch (e) {
    setError(e);
  } finally {
    setLoading(false);
  }
};

// With TanStack Query: Automatic handling
const { data: people, isLoading, error } = useQuery({
  queryKey: ['people'],
  queryFn: () => api.getPeople(),
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

### **Recommended Architecture**

```typescript
// services/api/family-tree-api.ts
export const familyTreeApi = {
  // TanStack Query will handle caching, loading, errors
  getPeople: () => supabase.from('people').select('*'),
  getPerson: (id: string) => supabase.from('people').select('*').eq('id', id).single(),
  createPerson: (data) => supabase.from('people').insert(data),
  updatePerson: (id, data) => supabase.from('people').update(data).eq('id', id),
  deletePerson: (id) => supabase.from('people').delete().eq('id', id),
};

// hooks/use-people.ts (TanStack Query)
export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: familyTreeApi.getPeople,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyTreeApi.createPerson,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
    onMutate: async (newPerson) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['people'] });
      const previous = queryClient.getQueryData(['people']);
      queryClient.setQueryData(['people'], (old) => [...old, newPerson]);
      return { previous };
    },
    onError: (err, newPerson, context) => {
      // Rollback on error
      queryClient.setQueryData(['people'], context.previous);
    },
  });
}

// stores/ui-store.ts (Keep Zustand for UI state)
export const useUIStore = create((set) => ({
  isAddingPerson: false,
  selectedPersonId: null,
  expandedUpdateIds: new Set(),
  feedFilter: 'all',
  setFeedFilter: (filter) => set({ feedFilter: filter }),
  // ... UI-only state
}));
```

---

## 2. Backend: Supabase as Full-Stack Solution

### **Recommended: Supabase for Everything**

**Why Supabase?**
- ✅ **Already integrated** - Auth is working
- ✅ **PostgreSQL database** - Robust, relational, handles complex queries
- ✅ **Auto-generated REST APIs** - No need to write custom endpoints
- ✅ **Real-time subscriptions** - Built-in WebSocket support
- ✅ **Storage** - For photos/uploads
- ✅ **Row Level Security (RLS)** - Built-in permissions
- ✅ **TypeScript types** - Auto-generated from schema

### **Architecture Decision: Database Schema First**

**Step 1: Design Database Schema in Supabase**
```sql
-- Supabase Dashboard: SQL Editor

-- People table
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  death_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  photo_url TEXT,
  bio TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Relationships table (many-to-many with type)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  related_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'spouse', 'child', 'sibling')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, related_person_id, relationship_type)
);

-- Updates/Stories table
CREATE TABLE updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  photo_url TEXT,
  caption TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update tags (many-to-many for @mentions)
CREATE TABLE update_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  update_id UUID REFERENCES updates(id) ON DELETE CASCADE,
  tagged_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  UNIQUE(update_id, tagged_person_id)
);

-- Enable Row Level Security
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see/edit their own data or shared family data)
CREATE POLICY "Users can view their own people" ON people
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create their own people" ON people
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- ... more policies
```

**Step 2: Use Supabase Client Directly (No Custom API Server Needed)**

```typescript
// services/supabase/family-tree-api.ts
import { getSupabaseClient } from '../supabase/supabase-init';

export const familyTreeApi = {
  // People CRUD
  async getPeople() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createPerson(personData: CreatePersonInput) {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('people')
      .insert({
        ...personData,
        created_by: user?.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Real-time subscription (optional, for multi-user sync)
  subscribeToPeople(callback: (payload: any) => void) {
    const supabase = getSupabaseClient();
    return supabase
      .channel('people-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'people' },
        callback
      )
      .subscribe();
  },
};
```

**Step 3: Supabase Storage for Photos**

```typescript
// services/supabase/storage-api.ts
export const storageApi = {
  async uploadPhoto(personId: string, uri: string, userId: string) {
    const supabase = getSupabaseClient();
    
    // Convert local URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split('.').pop();
    const fileName = `${userId}/${personId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('person-photos')
      .upload(fileName, blob, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('person-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  },
};
```

---

## 3. APIs You Need Now

### **Priority 1: Core CRUD (MVP)**

**People Management**
- `GET /people` - Get all people (filtered by user's family)
- `GET /people/:id` - Get single person
- `POST /people` - Create person
- `PUT /people/:id` - Update person
- `DELETE /people/:id` - Delete person

**Relationships**
- `POST /relationships` - Create relationship (parent, spouse, child, sibling)
- `DELETE /relationships/:id` - Remove relationship
- `GET /people/:id/relationships` - Get all relationships for a person

**Updates/Stories**
- `GET /updates` - Get updates (with filters: personId, isPublic, etc.)
- `POST /updates` - Create update
- `PUT /updates/:id` - Update update
- `DELETE /updates/:id` - Delete update
- `POST /updates/:id/tags` - Tag people in update

**Storage**
- `POST /storage/upload` - Upload photo (returns URL)
- `DELETE /storage/:path` - Delete photo

### **Priority 2: Advanced Features (Post-MVP)**

**Sync & Real-time**
- WebSocket: Subscribe to family tree changes
- `POST /sync` - Full tree sync (for offline-first)

**Search & Discovery**
- `GET /people/search?q=john` - Search people
- `GET /people/suggestions` - Suggested relatives (future ML feature)

**Permissions & Sharing**
- `POST /people/:id/share` - Share person with other users
- `GET /people/shared` - Get people shared with current user

---

## 4. Migration Strategy (Incremental)

### **Phase 1: Setup (Week 1)**
1. ✅ Create Supabase database schema
2. ✅ Set up RLS policies
3. ✅ Configure storage buckets
4. ✅ Install TanStack Query: `npm install @tanstack/react-query`

### **Phase 2: Core APIs (Week 2)**
1. Migrate `getPeople()` → TanStack Query
2. Migrate `createPerson()` → TanStack Query mutation
3. Keep Zustand for UI state (filters, modals)
4. Test with real data

### **Phase 3: Relationships & Updates (Week 3)**
1. Migrate relationship operations
2. Migrate updates/stories
3. Add photo upload to Supabase Storage
4. Implement optimistic updates

### **Phase 4: Real-time Sync (Week 4)**
1. Add Supabase Realtime subscriptions
2. Sync changes across devices
3. Handle conflicts (last-write-wins with timestamps)

### **Phase 5: Offline Support (Future)**
1. Add AsyncStorage caching
2. Queue mutations when offline
3. Sync when back online

---

## 5. Implementation Example

### **Step-by-Step: Adding TanStack Query for People**

```typescript
// 1. Install
npm install @tanstack/react-query

// 2. Setup QueryClient in _layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... rest of app */}
    </QueryClientProvider>
  );
}

// 3. Create API service (using Supabase directly)
// services/supabase/people-api.ts
export const peopleApi = {
  getAll: async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('people').select('*');
    if (error) throw error;
    return data;
  },
  
  create: async (personData: CreatePersonInput) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('people')
      .insert({ ...personData, created_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// 4. Create hooks
// hooks/use-people.ts
export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: peopleApi.getAll,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: peopleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}

// 5. Use in components
// app/(tabs)/index.tsx
function FamilyTreeScreen() {
  const { data: people, isLoading } = usePeople();
  const createPerson = useCreatePerson();
  const feedFilter = useUIStore((s) => s.feedFilter); // Zustand for UI state
  
  // ... rest of component
}
```

---

## 6. Decision Matrix: When to Use What

| Scenario | Solution | Example |
|----------|----------|---------|
| **Fetching from API** | TanStack Query | `usePeople()`, `useUpdates()` |
| **Creating/Updating data** | TanStack Query Mutation | `useCreatePerson()`, `useUpdatePerson()` |
| **UI state (modals, filters)** | Zustand | `isModalOpen`, `feedFilter` |
| **Form state** | `useState` | `name`, `email` inputs |
| **Real-time subscriptions** | Supabase Realtime + Zustand | Live updates from other users |
| **Computed values** | Zustand selector or `useMemo` | Tree layout calculations |
| **Offline cache** | AsyncStorage + TanStack Query persistence | Queue mutations when offline |

---

## 7. Recommended Next Steps

### **✅ Completed (January 2025)**
1. ✅ **Database schema** - Created in Supabase with RLS policies
2. ✅ **Storage buckets** - Set up for photos (`update-photos`)
3. ✅ **People CRUD** - Full implementation via `people-api.ts`
4. ✅ **Relationships CRUD** - Full implementation via `relationships-api.ts`
5. ✅ **Updates CRUD** - Full implementation via `updates-api.ts`
6. ✅ **Photo upload** - Working with Supabase Storage
7. ✅ **Optimistic updates** - Implemented with rollback on error
8. ✅ **Sync strategy** - Single fetch on login, no polling

### **Immediate (This Week)**
1. **Implement Invitation System:**
   - Create `invitations-api.ts` for invite link management
   - Add "Invite" UI to ancestor profiles
   - Deep link handling for invite tokens
   - Profile claiming flow

2. **Code Cleanup:**
   - Remove debug logs (marked with `#region agent log`)
   - Clean up console.log statements

### **Short Term (Next 2 Weeks)**
1. **Complete Invitation System:**
   - Invitation management UI
   - Notification when invitation is claimed
   - Expired invitation cleanup

2. **Update Permissions:**
   - Enforce modify/visibility restrictions
   - Add permission checks to UI components

### **Medium Term (Next Month)**
1. **WebSocket Real-time Updates:**
   - Supabase Realtime subscriptions for people/relationships/updates
   - Live updates from other users
   - No polling needed

2. **Optional: TanStack Query:**
   - Only if advanced caching/background sync needed
   - Current Zustand approach is working well
   - Can migrate incrementally if performance issues arise

### **Future Considerations**
- Consider custom API server only if you need:
  - Complex business logic
  - External API integrations
  - Rate limiting
  - Custom authentication flows
  - GraphQL endpoints

**For now, Supabase provides everything you need without custom backend code.**

---

## 8. Cost Considerations

**Supabase Free Tier:**
- ✅ 500MB database
- ✅ 1GB file storage
- ✅ 2GB bandwidth
- ✅ 500K edge function invocations/month
- ✅ Real-time subscriptions included

**Supabase Pro ($25/month):**
- ✅ 8GB database
- ✅ 100GB file storage
- ✅ 250GB bandwidth
- ✅ Better performance

**Recommendation**: Start with free tier, upgrade when needed. Most family trees won't exceed free tier limits initially.

---

## Summary: Why This Approach?

1. ✅ **Leverage existing Supabase auth** - Already working
2. ✅ **No custom API server needed** - Supabase = Database + REST + Realtime
3. ✅ **Best of both worlds** - TanStack Query for server state, Zustand for UI state
4. ✅ **Incremental migration** - No big rewrites, migrate feature by feature
5. ✅ **Production-ready** - Industry-standard patterns
6. ✅ **Scalable** - Can add custom backend later if needed

**Start with Supabase + TanStack Query. Add custom APIs only if you hit limitations.**

