# Dependency & Configuration Audit for App Store Submission

## Overview
This document identifies potentially unused dependencies and configurations that Apple may flag during App Store review.

## ✅ All Permissions Are Justified

All permissions in `app.json` are actively used:

| Permission | Used By | Status |
|------------|---------|--------|
| `NSCameraUsageDescription` | `expo-image-picker` (photo capture) | ✅ Required |
| `NSPhotoLibraryUsageDescription` | `expo-image-picker` (photo selection) | ✅ Required |
| `NSLocationWhenInUseUsageDescription` | `expo-location` (location service) | ✅ Required |

**Action:** No changes needed - all permissions are justified.

---

## 📦 Package Usage Analysis

### ✅ Actively Used Packages

These packages are imported and used in the codebase:

| Package | Usage Location | Status |
|---------|---------------|--------|
| `expo-image` | Multiple components (Image display) | ✅ Keep |
| `expo-router` | All routing/navigation | ✅ Keep |
| `expo-crypto` | `invitations-api.ts`, `account-api.ts` | ✅ Keep |
| `expo-image-picker` | `use-image-picker.ts`, `AddUpdateModal.tsx` | ✅ Keep |
| `expo-location` | `location-service.ts` | ✅ Keep |
| `expo-linking` | `supabase-auth-service.ts` | ✅ Keep |
| `expo-file-system` | `storage-api.ts` | ✅ Keep |
| `expo-haptics` | `haptic-tab.tsx`, `button.tsx` | ✅ Keep |
| `expo-status-bar` | `app/_layout.tsx` | ✅ Keep |
| `expo-symbols` | `icon-symbol.tsx`, `icon-symbol.ios.tsx` | ✅ Keep |
| `expo-web-browser` | `external-link.tsx` | ✅ Keep |
| `expo-splash-screen` | Plugin in `app.json` | ✅ Keep |

### ⚠️ Potentially Unused Packages

These packages are NOT directly imported in the codebase:

| Package | Potential Usage | Recommendation |
|---------|----------------|----------------|
| `expo-application` | **Used by `@statsig/expo-bindings`** | ✅ **Keep** (peer dependency) |
| `expo-constants` | May be used by other Expo packages internally | ⚠️ **Keep** (likely used by Expo SDK) |
| `expo-device` | May be used by other Expo packages internally | ⚠️ **Keep** (likely used by Expo SDK) |
| `expo-font` | May be used by Expo internally for font loading | ⚠️ **Keep** (likely used by Expo SDK) |
| `expo-system-ui` | Not found in codebase, no peer dependencies | ⚠️ **Can remove** (verify first) |
| `expo-dev-client` | Development builds only | ✅ **Keep** (needed for dev builds) |

### 🔍 Investigation Needed

Before removing packages, verify they're not:
1. **Peer dependencies** of other packages
2. **Used internally** by Expo SDK
3. **Required for build** even if not directly imported

---

## 🛠️ Recommended Actions

### Safe to Remove (After Verification)

1. **`expo-system-ui`** - Not found in codebase, no peer dependencies
   ```bash
   npm uninstall expo-system-ui
   ```
   **Note:** Verify it's not used by Expo Router or other packages before removing.

### Must Keep

1. **`expo-application`** - Required by `@statsig/expo-bindings` (peer dependency)
   - **DO NOT REMOVE** - Statsig telemetry depends on it

### Keep (Even if Not Directly Imported)

These packages are likely used internally by Expo SDK or other dependencies:

- `expo-constants` - Used by many Expo packages internally
- `expo-device` - Used by Expo SDK for device detection
- `expo-font` - Used by Expo for font loading
- `expo-dev-client` - Required for development builds

### Verification Steps

Before removing packages:

1. **Check peer dependencies:**
   ```bash
   npm ls expo-application
   npm ls expo-system-ui
   ```

2. **Test build after removal:**
   ```bash
   npx expo prebuild --clean
   npx expo run:ios
   ```

3. **Check for runtime errors** - Some packages may be loaded dynamically

---

## 📱 App.json Configuration

### ✅ All Configurations Are Valid

| Configuration | Purpose | Status |
|--------------|---------|--------|
| `scheme: "familytreeapp"` | Deep linking | ✅ Required |
| `googleServicesFile` | Google Sign-In | ✅ Required |
| `ITSAppUsesNonExemptEncryption: false` | Encryption declaration | ✅ Required |
| All permission descriptions | Privacy compliance | ✅ Required |

**Action:** No changes needed.

---

## 🚨 Apple App Store Concerns

Apple may flag:

1. **Unused permissions** - ✅ All permissions are justified
2. **Unused dependencies** - ⚠️ `expo-system-ui` may be flagged (but `expo-application` is required by Statsig)
3. **Large bundle size** - Removing unused packages helps
4. **Unused capabilities** - ✅ All capabilities are used

---

## 📋 Action Plan

### Immediate (Before Submission)

1. ✅ Verify all permissions are used (DONE - all are used)
2. ✅ Keep `expo-application` (required by Statsig)
3. ⚠️ **Remove `expo-system-ui`** if not needed (verify first)
4. ✅ Keep all other packages (they're either used or required by Expo SDK)

### Testing After Removal

1. Run `npx expo prebuild --clean`
2. Test iOS build: `npx expo run:ios`
3. Test Android build: `npx expo run:android`
4. Verify all features still work:
   - Image picking
   - Location services
   - Deep linking
   - Google Sign-In

---

## 🔗 Related Files

- `package.json` - Dependencies list
- `app.json` - App configuration and permissions
- `.gitignore` - Should exclude `node_modules/` (already done)

---

## Notes

- **Expo SDK packages** often have internal dependencies that aren't directly imported
- **Development packages** like `expo-dev-client` are needed for dev builds but not in production
- **Peer dependencies** may require packages even if not directly imported
- Always test thoroughly after removing packages
