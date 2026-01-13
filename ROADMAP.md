# Roadmap

## ✅ Completed
- Family tree visualization (ego-centric with parents, siblings, spouses, children)
- Instagram-style profiles with photo updates, bio, tagging
- Family feed with filtering and privacy controls
- Google SSO authentication (Supabase backend)
- Complete onboarding flow (welcome → profile → location → app)
- Full Supabase integration (people, relationships, updates)
- Multi-wall updates (post on any person's wall)
- Shadow profiles (ancestors without linked auth users)
- Sync strategy (single fetch on login, optimistic updates)
- Relationship management (full CRUD)
- Invitation system (claim profiles via deep links)
- Statsig telemetry integration

## 🚧 In Progress
- Code cleanup (remove debug logs, consolidate utilities)
- Error handling consolidation (centralized Supabase error handling)

## 📋 Planned
- WebSocket real-time updates (Supabase Realtime)
- Update permissions (modify/visibility restrictions)
- Activity log
- Local persistence (AsyncStorage)
- Performance optimization (memoization, pagination for large trees)
- Search functionality
- Offline support

## 🎯 Current Focus
- Code efficiency & cleanup
- Security & compliance (Apple App Store submission)
- Telemetry analysis (Statsig events)
