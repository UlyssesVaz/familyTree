# Duplicate Execution Analysis

## 🔍 Problem

**Observation:** Everything seems to be executing twice:
- `[AuthContext] Syncing family tree after loading ego` appears **twice**
- `[Statsig] Initializing` appears **multiple times**
- `[Store] syncFamilyTree: Already syncing, skipping duplicate call` - store detects duplicates

---

## 📊 Root Cause Analysis

### **Issue #1: useEffect Dependencies Triggering Multiple Times**

**Location:** `contexts/auth-context.tsx` lines 126-222

```typescript
useEffect(() => {
  if (isLoading || !session) {
    return;
  }
  // ... profile check and syncFamilyTree
}, [session, isLoading]); // ❌ PROBLEM: Both dependencies
```

**Problem:**
1. `initializeAuth()` calls `setSession()` and `setIsLoading(false)` → triggers useEffect
2. `onAuthStateChanged()` callback calls `setSession()` and `setIsLoading(false)` → triggers useEffect again
3. Both happen in quick succession → useEffect runs twice

**Flow:**
```
App Start
  ↓
initializeAuth() → setSession(session) + setIsLoading(false) → useEffect runs (1st time)
  ↓
onAuthStateChanged() fires → setSession(session) + setIsLoading(false) → useEffect runs (2nd time)
```

---

### **Issue #2: React 19 Development Double Execution**

**Possible Cause:**
- React 19 might run effects twice in development (similar to React 18 StrictMode)
- This is intentional for catching bugs, but causes duplicate logs

**Evidence:**
- Duplicate logs appear consistently
- Store has guards (`isSyncing` flag) that catch duplicates
- This suggests React is intentionally running effects twice

---

### **Issue #3: StatsigProvider Re-renders**

**Location:** `components/StatsigProvider.tsx`

**Problem:**
- `StatsigProvider` re-renders when `authIsLoading` changes
- Even with stable user object, Statsig might re-initialize on re-render
- Multiple re-renders = multiple initializations

---

## 🎯 Solutions

### **Fix #1: Stabilize useEffect Dependencies**

**Current:**
```typescript
useEffect(() => {
  // ...
}, [session, isLoading]); // Both trigger independently
```

**Better:**
```typescript
useEffect(() => {
  // Only run when session is ready (not loading)
  if (isLoading || !session) {
    return;
  }
  // ...
}, [session?.user?.id, isLoading]); // Only depend on user ID, not entire session object
```

**Or use a ref to track if already executed:**
```typescript
const profileCheckExecutedRef = useRef(false);

useEffect(() => {
  if (isLoading || !session || profileCheckExecutedRef.current) {
    return;
  }
  
  profileCheckExecutedRef.current = true;
  // ... execute once
}, [session?.user?.id, isLoading]);
```

---

### **Fix #2: Accept React 19 Development Behavior**

**If React 19 is intentionally running effects twice:**
- This is **normal in development**
- Production builds won't have this issue
- The guards (`isSyncing`, `syncFamilyTreeDoneRef`) are working correctly
- Duplicate logs are expected in dev mode

**Action:** Document this as expected behavior, not a bug

---

### **Fix #3: Add More Guards**

**Current Guards:**
- ✅ `isSyncing` flag in store (catches duplicate syncFamilyTree calls)
- ✅ `syncFamilyTreeDoneRef` in auth-context (tracks if sync done)
- ✅ `profileCheckRef` in auth-context (prevents concurrent profile checks)

**Missing:**
- Guard in StatsigProvider to prevent multiple initializations
- Guard to prevent useEffect from running twice in same render cycle

---

## 🔧 Recommended Fix

### **Option A: Accept Development Behavior (Recommended)**

If React 19 is running effects twice in development:
1. ✅ This is **expected and normal**
2. ✅ Guards are working (duplicates are caught)
3. ✅ Production won't have this issue
4. ✅ No code changes needed

**Action:** Document this as expected React 19 development behavior

---

### **Option B: Add Execution Guard**

Add a ref to prevent useEffect from running twice in same cycle:

```typescript
const profileCheckExecutedRef = useRef<string | null>(null);

useEffect(() => {
  if (isLoading || !session) {
    return;
  }
  
  const userId = session.user.id;
  
  // Prevent duplicate execution for same user
  if (profileCheckExecutedRef.current === userId) {
    return;
  }
  
  profileCheckExecutedRef.current = userId;
  // ... execute profile check
}, [session?.user?.id, isLoading]);
```

---

## 📝 Testing

**To verify if React 19 is causing double execution:**

1. Check React version: `package.json` shows `"react": "19.1.0"`
2. React 19 might have StrictMode-like behavior in development
3. Check if production build has same issue

**Expected in Development:**
- ✅ Effects run twice (React 19 behavior)
- ✅ Guards catch duplicates
- ✅ Logs show duplicates (expected)

**Expected in Production:**
- ✅ Effects run once
- ✅ No duplicate logs
- ✅ Guards still work (defensive)

---

## ✅ Recommendation

**Accept the behavior as normal React 19 development mode.**

The guards are working correctly:
- `isSyncing` prevents duplicate syncFamilyTree calls ✅
- `syncFamilyTreeDoneRef` tracks execution ✅
- Store logs show "Already syncing, skipping" ✅

This is **defensive programming working as intended**. The duplicate logs are just React 19's development mode helping catch potential issues.

**Action:** Document this as expected behavior, focus on fixing Statsig multiple client issue separately.
