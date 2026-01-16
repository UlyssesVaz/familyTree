# App Store & TestFlight Submission Audit Checklist

## ✅ Critical Items (Must Fix Before Submission)

### 1. Privacy Policy - Contact Information
**Status:** ❌ NEEDS UPDATE  
**File:** `app/privacy-policy.tsx`  
**Issue:** Section 11 says "contact us through the app settings" but doesn't provide actual contact information  
**Required:** Add developer name, email address, and/or support contact method

**Current (line 141-144):**
```tsx
<ThemedText style={styles.sectionTitle}>11. Contact Us</ThemedText>
<ThemedText style={styles.paragraph}>
  If you have questions about this Privacy Policy or our data practices, please contact us through the app settings.
</ThemedText>
```

**Action Required:** Replace with actual contact information (email, developer name, etc.)

---

### 2. Terms of Use - Contact Information
**Status:** ❌ NEEDS UPDATE  
**File:** `app/terms-of-use.tsx`  
**Issue:** Section 13 says "contact us through the app settings" but doesn't provide actual contact information  
**Required:** Add developer name, email address, and/or support contact method

**Current (line 137-140):**
```tsx
<ThemedText style={styles.sectionTitle}>13. Contact Information</ThemedText>
<ThemedText style={styles.paragraph}>
  If you have questions about these Terms of Use, please contact us through the app settings.
</ThemedText>
```

**Action Required:** Replace with actual contact information (email, developer name, etc.)

---

### 3. iOS Permission Descriptions
**Status:** ❌ MISSING  
**File:** `app.json`  
**Issue:** App uses camera, photo library, and location but no permission descriptions in `infoPlist`

**Required Permissions:**
- `NSCameraUsageDescription` - For taking photos with camera
- `NSPhotoLibraryUsageDescription` - For selecting photos from library
- `NSLocationWhenInUseUsageDescription` - For location features (if used)

**Action Required:** Add to `ios.infoPlist` in `app.json`:
```json
"infoPlist": {
  "ITSAppUsesNonExemptEncryption": false,
  "NSCameraUsageDescription": "We need access to your camera to take photos for family tree profiles and updates.",
  "NSPhotoLibraryUsageDescription": "We need access to your photo library to select photos for family tree profiles and updates.",
  "NSLocationWhenInUseUsageDescription": "We need access to your location to add location information to family tree profiles."
}
```

---

### 4. iOS App Store Metadata
**Status:** ⚠️ PARTIAL  
**File:** `app.json`  
**Issue:** Missing App Store listing information

**Required Fields:**
- `description` - App description (up to 4000 characters)
- `subtitle` - Short subtitle (up to 30 characters)
- `keywords` - Search keywords (up to 100 characters, comma-separated)
- `category` - Primary category (e.g., "Social Networking", "Lifestyle")
- `privacyPolicyUrl` - URL to privacy policy (if hosted online)
- `supportUrl` - Support/contact URL

**Action Required:** Add to `ios` section in `app.json`:
```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.vaz09.FamilyTreeApp",
  "googleServicesFile": "./GoogleService-Info.plist",
  "infoPlist": { ... },
  "config": {
    "usesNonExemptEncryption": false
  },
  "appStoreUrl": "https://apps.apple.com/app/id[YOUR_APP_ID]",
  "privacyPolicyUrl": "https://yourwebsite.com/privacy-policy",
  "supportUrl": "https://yourwebsite.com/support"
}
```

**Note:** Some metadata (description, subtitle, keywords, category) is typically set in App Store Connect, not in app.json, but it's good to document here.

---

## ⚠️ Important Items (Should Fix)

### 5. App Display Name
**Status:** ✅ OK  
**File:** `app.json`  
**Current:** `"name": "FamilyTreeApp"`  
**Note:** Consider if you want a more user-friendly name like "Family Tree" (spaces allowed in display name)

---

### 6. Version Number
**Status:** ✅ OK  
**File:** `app.json`  
**Current:** `"version": "1.0.0"`  
**Note:** EAS is configured with `autoIncrement: true` for production builds, so this will auto-increment

---

### 7. Bundle Identifier
**Status:** ✅ OK  
**File:** `app.json`  
**Current:** `"bundleIdentifier": "com.vaz09.FamilyTreeApp"`  
**Note:** Ensure this matches your Apple Developer account

---

### 8. Encryption Declaration
**Status:** ✅ OK  
**File:** `app.json`  
**Current:** `"ITSAppUsesNonExemptEncryption": false`  
**Note:** This is correct if you're using standard HTTPS/TLS encryption only

---

### 9. EAS Build Configuration
**Status:** ✅ OK  
**File:** `eas.json`  
**Note:** Configuration looks good for production builds

---

## 📋 App Store Connect Checklist

### Required in App Store Connect (Not in Code):

1. **App Information:**
   - [ ] App Name (display name)
   - [ ] Subtitle (up to 30 characters)
   - [ ] Category (Primary & Secondary)
   - [ ] Content Rights (if using third-party content)

2. **Pricing and Availability:**
   - [ ] Price tier (Free/Paid)
   - [ ] Availability (countries)

3. **App Privacy:**
   - [ ] Privacy policy URL (required)
   - [ ] Data collection practices (declare what you collect)
   - [ ] Data usage purposes
   - [ ] Third-party data sharing

4. **App Store Listing:**
   - [ ] Description (up to 4000 characters)
   - [ ] Keywords (up to 100 characters)
   - [ ] Support URL (required)
   - [ ] Marketing URL (optional)
   - [ ] Promotional text (optional)
   - [ ] Screenshots (required for all device sizes)
   - [ ] App preview video (optional)

5. **Version Information:**
   - [ ] What's New in This Version
   - [ ] Screenshots for this version
   - [ ] App preview (optional)

6. **App Review Information:**
   - [ ] Contact information (name, phone, email)
   - [ ] Demo account credentials (if app requires login)
   - [ ] Notes for reviewer

7. **Age Rating:**
   - [ ] Complete questionnaire
   - [ ] Get age rating (likely 4+ or 12+)

---

## 🔍 Additional Checks

### Code Quality:
- [ ] Remove all console.log statements (or use proper logging)
- [ ] Remove debug/test code
- [ ] Ensure error handling is user-friendly
- [ ] Test on physical device (not just simulator)

### Assets:
- [ ] App icon (1024x1024) - ✅ Present
- [ ] Splash screen - ✅ Present
- [ ] Screenshots for App Store (various device sizes)
- [ ] App preview video (optional but recommended)

### Testing:
- [ ] Test on iOS 15+ (minimum supported version)
- [ ] Test on iPhone and iPad (if supportsTablet: true)
- [ ] Test all major user flows
- [ ] Test with TestFlight internal testing
- [ ] Test with TestFlight external testing (if applicable)

### Legal/Compliance:
- [ ] Privacy Policy accessible in app - ✅ Present
- [ ] Terms of Use accessible in app - ✅ Present
- [ ] Contact information in privacy policy - ❌ NEEDS UPDATE
- [ ] Contact information in terms of use - ❌ NEEDS UPDATE
- [ ] COPPA compliance (if targeting children) - ✅ Mentioned in privacy policy
- [ ] GDPR compliance - ✅ Mentioned in privacy policy

### Security:
- [ ] API keys not hardcoded (use environment variables)
- [ ] Sensitive data properly encrypted
- [ ] Authentication flows tested
- [ ] Deep linking tested

---

## 🚀 Pre-Submission Steps

1. **Update Contact Information:**
   - Update `app/privacy-policy.tsx` Section 11
   - Update `app/terms-of-use.tsx` Section 13

2. **Add iOS Permissions:**
   - Add permission descriptions to `app.json` `ios.infoPlist`

3. **Build for Production:**
   ```bash
   eas build --platform ios --profile production
   ```

4. **Submit to TestFlight:**
   ```bash
   eas submit --platform ios --profile production
   ```

5. **Test in TestFlight:**
   - Install on physical device
   - Test all features
   - Check for crashes or issues

6. **Submit to App Store:**
   - Complete App Store Connect listing
   - Upload screenshots
   - Fill in all metadata
   - Submit for review

---

## 📝 Notes

- Developer name appears to be "vaz09" based on bundle identifier
- Contact email/developer name needs to be added to privacy policy and terms
- App uses Google Sign-In, Supabase, and Statsig - ensure all are properly configured
- App collects user data (photos, location, personal info) - ensure privacy policy accurately reflects this

---

## ✅ Quick Fix Summary

**Priority 1 (Must Fix):**
1. Add contact information to Privacy Policy (Section 11)
2. Add contact information to Terms of Use (Section 13)
3. Add iOS permission descriptions to app.json

**Priority 2 (Should Fix):**
4. Complete App Store Connect metadata
5. Prepare screenshots
6. Test on physical devices

---

**Last Updated:** [Current Date]  
**Next Review:** After implementing fixes
