# Settings Page Implementation Plan

## Overview
Create a comprehensive settings page accessible via hamburger icon (top right) that consolidates user preferences, privacy controls, and account management features. This page must comply with Apple App Store guidelines, particularly Section 5.1 (Privacy).

## Requirements

### 1. Navigation & Access
- **Hamburger Icon**: Top right corner of main screens (like Instagram)
- **Location**: Accessible from all main tabs (index, family, profile)
- **Implementation**: Add header component with hamburger menu icon

### 2. Settings Page Structure

#### Section 1: Preferences
- **Dark Mode Toggle**: Move from profile screen
  - Current location: `app/(tabs)/profile.tsx` (lines 676-688)
  - Use existing `useColorSchemeContext()` hook
  - Toggle between light/dark/system

#### Section 2: Privacy & Security
- **Privacy Policy Link**: Navigate to privacy policy page
  - Required by Apple Guideline 5.1.1
  - Must be easily accessible
  - Link in App Store metadata as well
  
- **Terms of Use Link**: Navigate to terms page
  - Legal requirement
  - Should be accessible from sign-up flow too

- **Data Management**:
  - View collected data
  - Request data export (GDPR compliance)
  - Data deletion options

#### Section 3: Account Management
- **Sign Out Button**: Move from profile screen (if exists)
  - Use existing `useAuth().signOut()` method
  - Confirmation dialog before sign out
  
- **Delete Account Button**: Move from profile screen
  - Current location: `app/(tabs)/profile.tsx` (lines 690-703)
  - Use existing `AccountDeletionModal` component
  - Two options: "Delete Everything" or "Keep Shadow Profile"

### 3. Legal Pages (App Store Compliance)

#### Privacy Policy Page (`app/privacy-policy.tsx`)
**Required by Apple Guideline 5.1.1**

Must include:
- **Data Collection**: What data we collect
  - Name, email, birth date, death date, gender
  - Photos (person photos, update photos)
  - Location data (optional)
  - User-generated content (posts, updates, captions)
  - Shadow profiles (profiles created by others)
  
- **How Data is Collected**:
  - Direct input from user
  - Created by other family members (shadow profiles)
  - Photos uploaded by user or others
  
- **Data Usage**:
  - Family tree display
  - Updates/feed functionality
  - Relationship mapping
  - Analytics (Statsig) - anonymized
  - Third-party services (Supabase, Google Sign-In)
  
- **Data Sharing**:
  - Supabase (database & storage)
  - Google Sign-In (authentication)
  - Statsig (analytics - anonymized)
  - Family members (collaborative editing)
  
- **Data Retention**:
  - Active accounts: Indefinite
  - Deleted accounts: 30-day grace period, then permanent deletion
  - Shadow profiles: Managed by family consensus
  
- **User Rights**:
  - Access to data
  - Deletion request
  - Account deletion
  - Data export
  - Opt-out of analytics
  
- **Shadow Profiles Disclosure**:
  - Explain that family members can create profiles for others
  - These profiles become collaborative (Wikipedia-style)
  - User can claim their profile if it exists
  
- **Children's Privacy**:
  - COPPA compliance
  - No data collection from children under 13 without parental consent
  - Special handling for minor profiles

#### Terms of Use Page (`app/terms-of-use.tsx`)
Must include:
- Service description
- User responsibilities
- Content ownership
- Prohibited activities
- Account termination
- Limitation of liability
- Dispute resolution

### 4. File Structure (Separation of Concerns)

```
app/
  (tabs)/
    settings.tsx              # Main settings page
    _layout.tsx              # Add hamburger icon to header
  privacy-policy.tsx        # Privacy policy page
  terms-of-use.tsx          # Terms of use page

components/
  settings/
    SettingsHeader.tsx       # Header with hamburger icon
    SettingsSection.tsx      # Reusable section component
    SettingsItem.tsx         # Reusable settings item component
    PrivacySettings.tsx     # Privacy & security section
    AccountSettings.tsx     # Account management section
    PreferencesSettings.tsx  # App preferences section

services/
  privacy/
    privacy-api.ts          # Privacy-related API calls
    data-export-api.ts      # GDPR data export
```

### 5. Implementation Steps

#### Step 1: Create Settings Page Structure
- [ ] Create `app/(tabs)/settings.tsx`
- [ ] Create reusable settings components
- [ ] Implement scrollable layout with sections

#### Step 2: Add Hamburger Icon Navigation
- [ ] Create `SettingsHeader` component with hamburger icon
- [ ] Add to tab layout or create shared header component
- [ ] Implement navigation to settings page

#### Step 3: Move Existing Features
- [ ] Move dark mode toggle from profile.tsx to settings
- [ ] Move delete account button from profile.tsx to settings
- [ ] Add sign out button to settings

#### Step 4: Create Legal Pages
- [ ] Create `app/privacy-policy.tsx` with full privacy policy
- [ ] Create `app/terms-of-use.tsx` with terms
- [ ] Add navigation links from settings page

#### Step 5: Privacy & Security Features
- [ ] Add privacy settings section
- [ ] Add data management options
- [ ] Implement data export functionality (if needed)

#### Step 6: Testing & Compliance
- [ ] Verify all Apple App Store requirements met
- [ ] Test navigation flow
- [ ] Verify privacy policy accessibility
- [ ] Test account deletion flow
- [ ] Verify sign out functionality

### 6. Apple App Store Compliance Checklist

#### Guideline 5.1.1 - Privacy Policy
- [x] Privacy policy page created
- [ ] Privacy policy link in settings
- [ ] Privacy policy link in App Store metadata
- [ ] Privacy policy accessible without login
- [ ] Privacy policy includes all required disclosures

#### Guideline 5.1.1 - Account Deletion
- [x] Account deletion button in settings
- [x] Account deletion modal with options
- [ ] Grace period implementation (30 days)
- [ ] Recovery token generation

#### Guideline 5.1.1 - Data Collection Disclosure
- [ ] Clear list of collected data
- [ ] Purpose of data collection
- [ ] Third-party data sharing disclosure
- [ ] Data retention policies

#### Guideline 5.1.2 - Data Use and Sharing
- [ ] User consent for data collection
- [ ] Opt-out mechanisms
- [ ] Data sharing transparency

### 7. Design Considerations

#### Instagram-Style Settings
- Clean, organized sections
- Icons for each setting item
- Destructive actions (delete, sign out) in red
- Smooth navigation transitions
- Modal presentation for settings page (optional)

#### Accessibility
- Proper labels for screen readers
- High contrast for destructive actions
- Clear visual hierarchy

### 8. Dependencies

#### Existing Hooks/Contexts
- `useColorSchemeContext()` - Theme switching
- `useAuth()` - Authentication (signOut)
- `AccountDeletionModal` - Delete account modal

#### New Components Needed
- Settings page layout
- Settings sections
- Settings items
- Legal page templates

### 9. Migration Notes

#### From Profile Screen
- Remove dark mode toggle (lines 676-688 in profile.tsx)
- Remove delete account button (lines 690-703 in profile.tsx)
- Keep profile editing functionality in profile screen
- Settings becomes dedicated settings page

#### Navigation Flow
- Hamburger icon → Settings page
- Settings → Privacy Policy
- Settings → Terms of Use
- Settings → Account Deletion Modal
- Settings → Sign Out Confirmation

---

## Next Steps
1. Review and approve this plan
2. Create settings page structure
3. Implement hamburger icon navigation
4. Move existing features
5. Create legal pages
6. Test compliance
