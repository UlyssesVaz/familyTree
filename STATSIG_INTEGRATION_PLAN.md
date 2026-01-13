# Statsig Integration Plan

## 📋 Analysis

### **Current Provider Hierarchy (app/_layout.tsx)**
```
RootLayout
└── GestureHandlerRootView
    └── SafeAreaProvider
        └── ErrorBoundary
            └── ColorSchemeProvider
                └── ErrorProvider
                    └── ModalProvider
                        └── AuthProvider  ← Session/User info available here
                            └── RootLayoutNav
```

### **Key Findings**
1. ✅ **Statsig package installed:** `@statsig/expo-bindings": "^3.31.1"`
2. ✅ **AuthProvider location:** Perfect spot - has access to `session.user.id`
3. ✅ **Provider order:** Statsig should be inside AuthProvider to access session
4. ⚠️ **User updates:** Statsig needs to update user when auth state changes

### **Optimal Placement**
**StatsigProviderExpo should be:**
- **Inside** `AuthProvider` (to access session/user ID)
- **Outside** `ModalProvider` (statsig available to all modals)
- **Before** `RootLayoutNav` (statsig available to all screens)

**New hierarchy:**
```
AuthProvider
└── StatsigProviderExpo  ← NEW: Initialize with user from session
    └── RootLayoutNav
```

---

## 🎯 Integration Strategy

### **Phase 1: Core Initialization (Current Focus)**
**Goal:** Initialize Statsig when user signs in

**Steps:**
1. ✅ Create `components/StatsigProvider.tsx` wrapper component
2. ✅ Add `StatsigProviderExpo` to root layout (inside AuthProvider)
3. ✅ Pass `user` object from session when available
4. ✅ Handle loading state during Statsig initialization
5. ✅ Test: Verify Statsig initializes on sign-in

**Requirements:**
- Statsig SDK key from environment variable (not hardcoded)
- User ID from `session.user.id` when authenticated
- Anonymous user when not authenticated
- Loading component during Statsig init

---

## 📝 Implementation Plan

### **Step 1: Create Statsig Wrapper Component**
**File:** `components/StatsigProvider.tsx`

**Purpose:**
- Wrap `StatsigProviderExpo` with auth-aware logic
- Extract user ID from auth session
- Handle anonymous vs authenticated users
- Provide loading state

**Key Logic:**
```typescript
// Get session from useAuth()
const { session } = useAuth();

// Build user object for Statsig
const statsigUser = session?.user?.id 
  ? { userID: session.user.id }
  : { userID: 'anonymous' }; // Or null if Statsig supports it

// Pass to StatsigProviderExpo
<StatsigProviderExpo 
  sdkKey={process.env.EXPO_PUBLIC_STATSIG_SDK_KEY}
  user={statsigUser}
  loadingComponent={<LoadingScreen />}
>
  {children}
</StatsigProviderExpo>
```

---

### **Step 2: Add to Root Layout**
**File:** `app/_layout.tsx`

**Changes:**
- Import `StatsigProvider` component
- Wrap `RootLayoutNav` with `StatsigProvider`
- Place inside `AuthProvider` but outside navigation

**New Structure:**
```tsx
<AuthProvider>
  <StatsigProvider>  {/* NEW */}
    <RootLayoutNav />
  </StatsigProvider>
</AuthProvider>
```

---

### **Step 3: Environment Configuration**
**File:** `.env` or environment setup

**Required:**
- Add `EXPO_PUBLIC_STATSIG_SDK_KEY` environment variable
- SDK Key: `client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z` (from user)

---

### **Step 4: Testing**
**Verify:**
1. App loads without errors
2. Statsig initializes when user signs in
3. Statsig updates user ID on auth state change
4. No performance issues or timing problems

---

## ⚠️ Critical Considerations

### **1. Timing & Overlay Issues**
- ✅ Statsig init is async - use `loadingComponent` prop
- ✅ Don't block app rendering - Statsig loads in background
- ✅ User updates happen automatically when session changes (Statsig detects prop changes)

### **2. User ID Management**
- ✅ Use `session.user.id` when authenticated
- ✅ Use `'anonymous'` when not authenticated (or Statsig's anonymous user)
- ✅ Update automatically when session changes (React props update Statsig)

### **3. SDK Key Security**
- ✅ Store in environment variable (`EXPO_PUBLIC_STATSIG_SDK_KEY`)
- ✅ Never hardcode in source code
- ✅ Client SDK keys are safe to expose (designed for client apps)

### **4. Wire Order**
- ✅ Must be inside `AuthProvider` (needs session)
- ✅ Should be outside navigation (available everywhere)
- ✅ Order: AuthProvider → StatsigProvider → RootLayoutNav

---

## 🔄 Future Phases (After Core Init Works)

### **Phase 2: Event Logging**
- Add `useStatsigClient()` hook usage
- Log authentication events (sign-in, sign-out)
- Log user actions (add person, create update, etc.)

### **Phase 3: Feature Gates**
- Use `useFeatureGate()` for feature flags
- A/B testing for new features
- Gradual rollouts

---

## ✅ Success Criteria

### **Phase 1 Complete When:**
- [x] Statsig provider added to root layout
- [x] Statsig initializes on user sign-in
- [x] No console errors or warnings
- [x] App renders normally
- [x] Statsig SDK loads successfully

---

## 📚 Resources

- [Statsig Expo Docs](https://docs.statsig.com/client/expoClientSDK)
- SDK Key: `client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z`
- Package: `@statsig/expo-bindings@^3.31.1`
