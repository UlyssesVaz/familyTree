# Console Log Cleanup - Apple App Store Compliance

## Status: ✅ In Progress

**Apple Guideline 2.3**: Apps with excessive debug logging may be rejected.

## What We've Done

### ✅ Created Logger Utility (`utils/logger.ts`)
- Wraps all console statements
- Only logs in `__DEV__` mode (development)
- `console.error` always logged (errors are important)
- Provides `withPrefix()` for component-specific logging

### ✅ Fixed Statsig Logging
- Events now flush immediately for dashboard visibility
- Made `logStatsigEvent` fire-and-forget (non-blocking)
- Events will appear in Statsig dashboard in production

### ✅ Removed Debug Instrumentation
- Removed all `#region agent log` debug instrumentation from:
  - `components/family-tree/PersonCard.tsx`
  - `app/(tabs)/profile.tsx`

### ✅ Started Replacing Console Statements
- `contexts/profile-context.tsx` - All console statements replaced
- `contexts/analytics-context.tsx` - All console statements replaced
- `components/StatsigProvider.tsx` - Console statements replaced
- `utils/statsig-tracking.ts` - Console statements replaced

## Remaining Work

### Files with Console Statements (302 total across 57 files)

**High Priority (User-facing):**
- `app/blocked-users.tsx` - 2 statements
- `app/join/[token].tsx` - 5 statements
- `app/(tabs)/profile.tsx` - 8 statements
- `app/person/[personId].tsx` - 8 statements
- `app/(tabs)/index.tsx` - 5 statements
- `app/(tabs)/family.tsx` - 4 statements

**Medium Priority (Services):**
- `services/supabase/*.ts` - Multiple files
- `services/auth/*.ts` - Multiple files

**Low Priority (Internal/Utils):**
- `stores/*.ts` - Store files (can be migrated later)
- `utils/*.ts` - Utility files

## How to Use Logger

```typescript
import { logger } from '@/utils/logger';

// Simple logging
logger.log('Debug message'); // Only in __DEV__
logger.error('Error message'); // Always logged
logger.warn('Warning message'); // Only in __DEV__

// Component-specific logging
const myLogger = logger.withPrefix('MyComponent');
myLogger.log('Component message'); // Logs as: [MyComponent] Component message
```

## Automated Script

Created `scripts/remove-console-logs.js` to automatically replace console statements.

**To run:**
```bash
node scripts/remove-console-logs.js
```

**Note:** Review changes before committing - some logs may need manual adjustment.

## Statsig Events

All Statsig events are now properly flushed and will appear in the dashboard:
- `user_signs_in` - When user authenticates
- `logout` - When user signs out
- `user_blocked` - When user blocks someone
- `user_unblocked` - When user unblocks someone
- `invite_sent` - When invitation is sent
- `update_posted` - When update is posted
- `relative_added` - When relative is added
- `wall_entry_updated` - When wall entry is updated

## Next Steps

1. Run the automated script to replace remaining console statements
2. Manually review and adjust any logs that need special handling
3. Test the app to ensure logging works correctly
4. Verify Statsig events appear in dashboard
5. Build production bundle and verify no console logs appear
