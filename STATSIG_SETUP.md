# Statsig Setup & Initialization

## ✅ Implementation Complete

### **1. Statsig Provider Created**
**File:** `components/StatsigProvider.tsx`

**Features:**
- ✅ Wraps `StatsigProviderExpo` with auth-aware logic
- ✅ Initializes with user ID from auth session
- ✅ Updates user context when auth state changes
- ✅ Handles anonymous users (not authenticated)
- ✅ Loading component during initialization
- ✅ Graceful degradation if SDK key missing
- ✅ Security: No PII logged (user IDs, emails, etc.)

### **2. Root Layout Updated**
**File:** `app/_layout.tsx`

**Provider Hierarchy:**
```
AuthProvider
└── StatsigProvider  ← NEW: Initializes Statsig with user
    └── RootLayoutNav
```

**Placement Verified:**
- ✅ Inside `AuthProvider` (has access to session/user ID)
- ✅ Outside navigation (available to all screens/modals)
- ✅ Protected by ErrorBoundary (won't crash app if Statsig fails)

---

## ⚙️ Configuration Required

### **Step 1: Add SDK Key to Environment**

Add to your `.env` file (create if it doesn't exist):

```env
EXPO_PUBLIC_STATSIG_SDK_KEY=client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z
```

**Important:**
- SDK key must start with `EXPO_PUBLIC_` for Expo to expose it
- Client SDK keys are safe to expose (designed for client apps)
- Don't commit `.env` to git (already in `.gitignore`)

### **Step 2: Restart Dev Server**

After adding the environment variable:

```bash
# Stop current dev server (Ctrl+C)
# Start fresh to load new env vars
npx expo start --clear
```

---

## 🔄 How It Works

### **Initialization Flow**

1. **App Starts:**
   - StatsigProvider mounts
   - Reads SDK key from `EXPO_PUBLIC_STATSIG_SDK_KEY`
   - Gets session from `useAuth()` (may be null initially)
   - Initializes Statsig with user ID (or 'anonymous' if no session)

2. **User Signs In:**
   - Auth state changes in `AuthProvider`
   - `StatsigUserUpdater` detects session change
   - Calls `client.updateUser({ userID: session.user.id })`
   - Statsig re-evaluates feature gates/experiments for new user

3. **User Signs Out:**
   - Auth state becomes null
   - `StatsigUserUpdater` detects session cleared
   - Calls `client.updateUser({ userID: 'anonymous' })`
   - Statsig switches to anonymous user context

---

## 🔍 Verification

### **Check Statsig Initialization**

After adding SDK key and restarting, check console logs:

**Expected Logs (Dev Mode):**
```
[Statsig] Initializing: { userType: 'anonymous', hasSession: false }
[Statsig] User set to anonymous
```

**After Sign-In:**
```
[Statsig] User updated: authenticated user
```

**If SDK Key Missing:**
```
[Statsig] SDK key not configured. Add EXPO_PUBLIC_STATSIG_SDK_KEY to .env
```

---

## ✅ Success Criteria

### **Phase 1: Core Initialization Complete When:**
- [x] StatsigProvider component created
- [x] StatsigProviderExpo added to root layout
- [x] User initialization on sign-in implemented
- [x] User updates on auth state changes implemented
- [x] Security: No PII logged
- [ ] SDK key added to `.env` file ← **YOU NEED TO DO THIS**
- [ ] Dev server restarted
- [ ] Statsig initializes without errors
- [ ] Statsig updates user on sign-in

---

## 🔒 Security

### **What We're NOT Logging:**
- ❌ Full user IDs (only "authenticated" status in dev logs)
- ❌ Email addresses
- ❌ Session tokens
- ❌ Any PII

### **What We ARE Logging (Dev Only):**
- ✅ Statsig initialization status
- ✅ User type (anonymous vs authenticated)
- ✅ Session existence (boolean)

### **Production Safety:**
- ✅ All logs behind `__DEV__` guards
- ✅ Production builds remove dev logs
- ✅ Only userID sent to Statsig (no PII)

---

## 📝 Next Steps (After Testing)

Once core initialization works:

1. **Phase 2: Event Logging**
   - Add `useStatsigClient()` hook usage
   - Log authentication events (sign-in, sign-out)
   - Log user actions (add person, create update, etc.)

2. **Phase 3: Feature Gates**
   - Use `useFeatureGate()` for feature flags
   - A/B testing for new features
   - Gradual rollouts

---

## 🐛 Troubleshooting

### **Statsig Not Initializing?**
1. Check SDK key is in `.env` file
2. Verify `EXPO_PUBLIC_` prefix
3. Restart dev server after adding env var
4. Check console for errors

### **User Not Updating on Sign-In?**
1. Verify `StatsigUserUpdater` is inside `StatsigProviderExpo`
2. Check that `useAuth()` returns session
3. Verify `client.updateUser()` is called

### **App Crashes?**
- StatsigProvider has graceful degradation
- If SDK key missing, app renders without Statsig
- Check ErrorBoundary catches any Statsig errors

---

## 📚 Resources

- [Statsig Expo Docs](https://docs.statsig.com/client/expoClientSDK)
- SDK Key: `client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z`
- Package: `@statsig/expo-bindings@^3.31.1`
