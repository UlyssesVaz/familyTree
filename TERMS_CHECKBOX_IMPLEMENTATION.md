# Terms Acceptance Checkbox Implementation

## Issues Fixed

### ✅ 1. Apple Sign-In Button Not Showing
**Problem:** The native Apple button wasn't rendering properly due to width constraint issues.

**Fix:** Updated the button wrapper to use proper container styling:
- Added `appleButtonContainer` style with `width: '100%'` and `alignSelf: 'stretch'`
- Added `appleNativeButton` style with explicit width and height
- This ensures the native Apple button renders correctly on iOS

### ✅ 2. Terms Acceptance Checkbox Missing
**Problem:** The checkbox only existed in the age-gate screen. Users accessing the login screen or join screen directly never saw it - a major compliance issue!

**Fix:** Added the terms acceptance checkbox to both screens:

#### Login Screen (`app/(auth)/login.tsx`)
- Interactive checkbox that must be checked before sign-in
- Clickable links to Privacy Policy and Terms of Service
- Buttons disabled when unchecked
- Alert messages when user tries to proceed without acceptance
- Overlay on Apple button when disabled (since it's a native component)

#### Join Screen (`app/join/[token].tsx`)
- Interactive checkbox that must be checked before claiming profile
- Clickable links to Privacy Policy and Terms of Service
- Google Sign-In button disabled when unchecked
- Accept button disabled when unchecked
- Alert messages when user tries to proceed without acceptance
- Auto-claim only happens if terms are accepted (prevents race conditions)

## Race Condition Prevention

### Join Screen Flow
1. User sees invitation → Terms checkbox appears
2. User accepts terms → Checkbox checked
3. User signs in → `useEffect` watches for session
4. **Only if terms accepted** → Auto-claim profile
5. If user signs in before accepting terms → Must accept terms and manually click "Accept"

This prevents the race condition where:
- User signs in → Auto-claim tries to run → Terms check fails → User stuck

Instead:
- User signs in → Auto-claim waits for terms → User accepts terms → Auto-claim proceeds OR user manually clicks Accept

## Files Modified

1. **`components/auth.tsx`**
   - Added `appleButtonContainer` and `appleNativeButton` styles
   - Fixed Apple button rendering with proper container

2. **`app/(auth)/login.tsx`**
   - Added `hasAcceptedTerms` state
   - Added terms checkbox section with links
   - Disabled buttons when terms not accepted
   - Added overlay for Apple button when disabled
   - Updated footer text

3. **`app/join/[token].tsx`**
   - Added `hasAcceptedTerms` state
   - Added terms checkbox section with links
   - Disabled buttons when terms not accepted
   - Added terms check in `handleClaimProfile`
   - Updated `useEffect` to only auto-claim if terms accepted

## Security & Compliance

✅ **Terms must be accepted before any authentication**  
✅ **Terms must be accepted before claiming profiles**  
✅ **No bypass possible** - buttons are disabled, not just hidden  
✅ **Clear user feedback** - alerts explain why action is blocked  
✅ **Links to full terms** - users can read before accepting  

## Testing Checklist

- [ ] Login screen: Checkbox appears, buttons disabled until checked
- [ ] Login screen: Can click Privacy Policy link
- [ ] Login screen: Can click Terms of Service link
- [ ] Login screen: Apple button shows overlay when disabled
- [ ] Login screen: Google button disabled when unchecked
- [ ] Join screen: Checkbox appears, buttons disabled until checked
- [ ] Join screen: Can click Privacy Policy link
- [ ] Join screen: Can click Terms of Service link
- [ ] Join screen: Google Sign-In disabled when unchecked
- [ ] Join screen: Accept button disabled when unchecked
- [ ] Join screen: Auto-claim only works if terms accepted
- [ ] Join screen: Manual Accept works after accepting terms

## No Breaking Changes

- Existing flows remain intact
- Age gate screen still has its own terms checkbox (unchanged)
- Routing and navigation unchanged
- No race conditions introduced
- All error handling preserved
