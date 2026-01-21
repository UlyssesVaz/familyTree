# App Configuration Guide

This guide explains how to change the app name, icons, and other configuration settings.

## App Name Configuration

### Current Configuration
The app name is configured in `app.json`:

```json
{
  "expo": {
    "name": "FamilyTreeApp",           // Display name shown to users
    "slug": "FamilyTreeApp",           // URL slug for Expo
    "version": "1.0.0",                // App version
    // ...
    "ios": {
      "bundleIdentifier": "com.vaz09.FamilyTreeApp"  // iOS bundle ID
    },
    "android": {
      "package": "com.vaz09.FamilyTreeApp"           // Android package name
    }
  }
}
```

### How to Change App Name

1. **Update Display Name** (shown to users):
   - Change `expo.name` in `app.json`
   - This is the name shown on the home screen and app store

2. **Update URL Slug** (for Expo):
   - Change `expo.slug` in `app.json`
   - Used in Expo URLs (e.g., `https://expo.dev/@username/FamilyTreeApp`)

3. **Update Bundle Identifier** (iOS):
   - Change `expo.ios.bundleIdentifier` in `app.json`
   - Format: `com.company.appname`
   - **Note:** Changing this requires creating a new app in App Store Connect
   - **Important:** Must be unique across all iOS apps

4. **Update Package Name** (Android):
   - Change `expo.android.package` in `app.json`
   - Format: `com.company.appname`
   - **Note:** Changing this requires creating a new app in Google Play Console
   - **Important:** Must be unique across all Android apps

### Example: Changing to "FamilyConnect"

```json
{
  "expo": {
    "name": "FamilyConnect",              // ✅ Changed
    "slug": "family-connect",             // ✅ Changed (use lowercase with hyphens)
    "ios": {
      "bundleIdentifier": "com.vaz09.familyconnect"  // ✅ Changed
    },
    "android": {
      "package": "com.vaz09.familyconnect"           // ✅ Changed
    }
  }
}
```

---

## App Icon Configuration

### Current Icon Setup

Icons are located in `assets/images/` directory:
- `icon.png` - Main app icon (1024x1024px)
- `favicon.png` - Web favicon
- `splash-icon.png` - Splash screen icon (200px wide)

**Android Icons:**
- `android-icon-foreground.png` - Foreground layer
- `android-icon-background.png` - Background layer
- `android-icon-monochrome.png` - Monochrome icon

### Icon Configuration in app.json

```json
{
  "expo": {
    "icon": "./assets/images/icon.png",  // Main app icon (iOS/Android)
    "ios": {
      // Uses main icon by default
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      }
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",  // Splash screen icon
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ]
    ]
  }
}
```

### How to Change Icons

#### Step 1: Create New Icon Files

**iOS Icon:**
- Size: **1024x1024px** (PNG)
- No rounded corners (iOS adds them automatically)
- No transparency
- Save as: `assets/images/icon.png`

**Android Adaptive Icon:**
- **Foreground:** 1024x1024px, with padding (safe zone is 768x768px center)
- **Background:** 1024x1024px, solid color or pattern
- **Monochrome:** 1024x1024px, single color version
- Save as:
  - `assets/images/android-icon-foreground.png`
  - `assets/images/android-icon-background.png`
  - `assets/images/android-icon-monochrome.png`

**Web Favicon:**
- Size: **48x48px** or **512x512px** (PNG or ICO)
- Save as: `assets/images/favicon.png`

**Splash Screen Icon:**
- Size: **200px wide** (maintain aspect ratio)
- Should work on light and dark backgrounds
- Save as: `assets/images/splash-icon.png`

#### Step 2: Replace Icon Files

1. Create new icon images with required dimensions
2. Replace existing files in `assets/images/` directory
3. Ensure filenames match exactly (case-sensitive)

#### Step 3: Update Configuration (if needed)

If you change file paths or names, update `app.json`:

```json
{
  "expo": {
    "icon": "./assets/images/your-new-icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/your-new-foreground.png",
        "backgroundImage": "./assets/images/your-new-background.png",
        "monochromeImage": "./assets/images/your-new-monochrome.png"
      }
    }
  }
}
```

#### Step 4: Update Android Background Color

If you change the adaptive icon background, update the color:

```json
{
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#YOUR_COLOR_HEX"  // Change this
    }
  }
}
```

#### Step 5: Rebuild App

Icons are embedded during build time, so you need to rebuild:

**Development:**
```bash
expo prebuild --clean  # Regenerates native files
expo run:ios          # or expo run:android
```

**Production:**
```bash
eas build --platform ios     # or --platform android
# or
eas build --platform all     # Build for both platforms
```

---

## Icon Design Guidelines

### iOS App Icon
- **Size:** 1024x1024px (PNG)
- **Format:** PNG with no alpha channel
- **Design:** Use full canvas, no padding required
- **Corners:** iOS automatically adds rounded corners
- **Glossy Effect:** Disabled by default in modern iOS

### Android Adaptive Icon
- **Foreground:**
  - Full size: 1024x1024px
  - Safe zone: 768x768px (center)
  - Keep important content within safe zone (may be cropped on some devices)
  - Can have transparency
  
- **Background:**
  - Full size: 1024x1024px
  - No transparency
  - Solid color or subtle pattern
  - Set `backgroundColor` in `app.json` to match

- **Monochrome:**
  - Used for themed icons (Android 13+)
  - Single color version
  - Can be same as foreground if icon is already monochrome

### Web Favicon
- **Size:** 48x48px or 512x512px
- **Format:** PNG or ICO
- **Simple design:** Should be recognizable at small sizes

### Splash Screen Icon
- **Size:** 200px wide (maintain aspect ratio)
- **Design:** Center icon with padding
- **Background:** Configurable (light/dark mode support)

---

## Quick Reference: Current Icon Files

| Purpose | File Path | Size | Format |
|---------|-----------|------|--------|
| Main App Icon | `assets/images/icon.png` | 1024x1024px | PNG |
| Android Foreground | `assets/images/android-icon-foreground.png` | 1024x1024px | PNG |
| Android Background | `assets/images/android-icon-background.png` | 1024x1024px | PNG |
| Android Monochrome | `assets/images/android-icon-monochrome.png` | 1024x1024px | PNG |
| Web Favicon | `assets/images/favicon.png` | 48x48px | PNG |
| Splash Icon | `assets/images/splash-icon.png` | 200px width | PNG |

---

## Testing Icons

After changing icons, test on:

1. **iOS:**
   - Build and install on iOS device/simulator
   - Check home screen icon
   - Check Settings app icon
   - Check App Switcher icon

2. **Android:**
   - Build and install on Android device/emulator
   - Check home screen adaptive icon
   - Check app drawer icon
   - Check recent apps icon
   - Test on different Android versions (icons render differently)

3. **Web:**
   - Check browser tab favicon
   - Check bookmarks icon

---

## Additional Configuration

### App Scheme (Deep Linking)
Configured in `app.json`:
```json
{
  "expo": {
    "scheme": "familytreeapp"  // Used for deep links: familytreeapp://...
  }
}
```

**To change:** Update `expo.scheme` (lowercase, no spaces)

### Splash Screen
Configured in `app.json` plugins:
```json
{
  "plugins": [
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff",
        "dark": {
          "backgroundColor": "#000000"
        }
      }
    ]
  ]
}
```

**To change:**
- Update `image` path
- Change `backgroundColor` for light mode
- Change `dark.backgroundColor` for dark mode

---

## Troubleshooting

### Icons Not Updating
1. **Clean build:** `expo prebuild --clean`
2. **Delete node_modules:** `rm -rf node_modules && npm install`
3. **Clear cache:** `expo start --clear`
4. **Rebuild native:** `expo run:ios --clean` or `expo run:android --clean`

### Icon Looks Blurry
- Ensure icon is exactly 1024x1024px
- Use PNG format (not JPEG)
- Check image quality/sharpen if needed

### Android Icon Not Centered
- Ensure foreground content is within 768x768px safe zone
- Center content in 1024x1024px canvas

### Icon Not Showing in Development
- Icons only appear in production builds
- For EAS builds: Icons are embedded during build
- For local builds: Run `expo prebuild` first

---

## Resources

- [Expo Icon Configuration](https://docs.expo.dev/guides/app-icons/)
- [Android Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
- [iOS App Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Icon Generator Tools](https://www.appicon.co/) - Generate all sizes from one image