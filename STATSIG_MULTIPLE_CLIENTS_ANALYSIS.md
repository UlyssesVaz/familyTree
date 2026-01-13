# Statsig Multiple Clients Analysis

## 🔍 Problem

**Warning:** `[Statsig] Creating multiple Statsig clients with the same SDK key can lead to unexpected behavior. Multi-instance support requires different SDK keys.`

**Observation:** `[Statsig] Initializing (auth ready)` log appears **4 times** in the console.

---

## 📊 Root Cause Analysis

### **Issue #1: Object Reference Changes on Every Render**

**Location:** `components/StatsigProvider.tsx` lines 98-100

```typescript
const initialUser = session?.user?.id 
  ? { userID: session.user.id }
  : { userID: 'anonymous' };
```

**Problem:**
- This creates a **new object** on every render, even if `session.user.id` hasn't changed
- React sees a new `user` prop → `StatsigProviderExpo` thinks it needs to re-initialize
- Statsig creates a new client instance each time

**Evidence:**
- Log shows initialization 4 times with same user
- Each render creates new `{ userID: '...' }` object
- Statsig detects prop change → creates new client

---

### **Issue #2: Auth Context Re-renders Trigger Statsig Re-initialization**

**Location:** `contexts/auth-context.tsx`

**Re-render Triggers:**
1. `isLoading` changes: `true` → `false` (initial load)
2. `session` changes: `null` → `AuthSession` (sign-in)
3. `session` updates: Session refresh or profile check
4. Multiple state updates in quick succession

**Flow:**
```
Render 1: authIsLoading=true → Shows loading component
Render 2: authIsLoading=false, session=null → Creates StatsigProviderExpo with {userID: 'anonymous'}
Render 3: session=AuthSession → Creates StatsigProviderExpo with {userID: 'actual-id'}
Render 4: session updates (profile check) → Creates StatsigProviderExpo again (same user, new object)
```

---

### **Issue #3: No Memoization of User Object**

**Current Code:**
```typescript
export function StatsigProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authIsLoading } = useAuth();
  
  // ❌ Creates new object every render
  const initialUser = session?.user?.id 
    ? { userID: session.user.id }
    : { userID: 'anonymous' };
  
  return <StatsigProviderExpo user={initialUser} ... />;
}
```

**Problem:**
- No `useMemo` to stabilize object reference
- Every render = new object = Statsig re-initializes

---

### **Issue #4: StatsigProviderExpo Re-mounts Instead of Updating**

**Expected Behavior:**
- `StatsigProviderExpo` should update user via `updateUserAsync()` when session changes
- Should NOT create new client instances

**Actual Behavior:**
- New `user` prop object → React re-mounts component → New client created

---

## 🎯 Solution Strategy

### **Fix #1: Memoize User Object**

Use `useMemo` to only create new object when user ID actually changes:

```typescript
const initialUser = useMemo(() => {
  return session?.user?.id 
    ? { userID: session.user.id }
    : { userID: 'anonymous' };
}, [session?.user?.id]); // Only recreate when user ID changes
```

**Benefits:**
- Same object reference if user ID unchanged
- Prevents unnecessary re-renders
- Statsig won't see prop change → won't create new client

---

### **Fix #2: Use Key Prop to Control Re-mounting**

Add `key` prop to `StatsigProviderExpo` to only remount when user actually changes:

```typescript
<StatsigProviderExpo
  key={session?.user?.id || 'anonymous'} // Only remount when user ID changes
  sdkKey={STATSIG_SDK_KEY}
  user={initialUser}
  ...
/>
```

**Benefits:**
- Forces remount only when user ID changes
- Prevents remount on every render
- Clear intent: "new user = new client instance"

---

### **Fix #3: Rely on updateUserAsync Instead of Re-mounting**

**Current Approach (Problematic):**
- Re-mount `StatsigProviderExpo` when user changes
- Creates new client each time

**Better Approach:**
- Initialize once with initial user
- Use `StatsigUserUpdater` to call `updateUserAsync()` when session changes
- Don't remount unless absolutely necessary

**Implementation:**
```typescript
// Initialize once, update via async method
const initialUser = useMemo(() => ({
  userID: session?.user?.id || 'anonymous'
}), []); // Only on mount

// StatsigUserUpdater handles all user changes
```

---

### **Fix #4: Prevent Re-renders During Auth Loading**

**Current:**
```typescript
if (authIsLoading) {
  return <StatsigLoadingComponent />;
}
```

**Issue:** When `authIsLoading` changes from `true` → `false`, component re-renders and creates StatsigProviderExpo

**Better:** Use ref to track if Statsig has been initialized:

```typescript
const hasInitializedRef = useRef(false);

if (authIsLoading || hasInitializedRef.current === false) {
  if (!authIsLoading) {
    hasInitializedRef.current = true;
  }
  // Show loading or initialize
}
```

---

## 🔧 Recommended Fix

**Priority: High** - Memoize user object + use key prop

```typescript
export function StatsigProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authIsLoading } = useAuth();

  if (authIsLoading) {
    return <StatsigLoadingComponent />;
  }

  // ✅ Memoize user object - only changes when user ID changes
  const initialUser = useMemo(() => {
    return session?.user?.id 
      ? { userID: session.user.id }
      : { userID: 'anonymous' };
  }, [session?.user?.id]);

  // ✅ Use key to control remounting - only remount when user ID changes
  return (
    <StatsigProviderExpo
      key={session?.user?.id || 'anonymous'}
      sdkKey={STATSIG_SDK_KEY}
      user={initialUser}
      ...
    >
      <StatsigUserUpdater />
      {children}
    </StatsigProviderExpo>
  );
}
```

**Why This Works:**
1. `useMemo` ensures same object reference if user ID unchanged
2. `key` prop ensures remount only when user ID changes
3. `StatsigUserUpdater` handles user updates without remounting
4. Prevents multiple client instances

---

## 📝 Testing Checklist

After fix, verify:
- [ ] `[Statsig] Initializing` log appears only **once** on app start
- [ ] No warning about multiple clients
- [ ] User updates work correctly (sign-in/sign-out)
- [ ] StatsigUserUpdater updates user without remounting
- [ ] No performance issues or memory leaks

---

## 🚨 Current Impact

**Low Severity** (but should fix):
- Multiple clients consume more memory
- Event logging might be duplicated
- Feature gate evaluations might be inconsistent
- Not breaking, but inefficient

**Priority:** Medium - Fix before production to ensure clean telemetry
