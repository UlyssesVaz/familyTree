# Best Practices

## 🏗️ Architecture

### Service Layer Abstraction
- Create interfaces before implementations
- Use factory pattern for service selection
- Mock implementations for rapid development
- Easy migration path: mock → real backend

### State Management
- Zustand with Map-based storage (O(1) lookups)
- Optimistic updates: instant UI → silent background save
- Single sync on login (no polling)
- Use selectors to prevent unnecessary re-renders

### Component Organization
- Keep components under 300 lines
- Extract business logic to hooks
- Pure functions in utils
- Separation: UI → hooks → services

## 🔐 Security

### Token & Sensitive Data
- Never log full tokens, emails, or user IDs
- All sensitive logs behind `__DEV__` guards
- Production builds remove dev logs automatically
- Log metadata only (existence, length, not values)

### Authentication
- Google SSO: SDK generates nonce internally (limitation documented)
- Extract nonce from JWT for Supabase verification
- RLS policies enforce data access (`auth.uid() = created_by`)

## 🚀 Performance

### Data Structures
- Use `Map<string, Person>` instead of arrays for O(1) lookups
- Critical for large family trees (1000+ nodes)

### Sync Strategy
- Single fetch on login (parallel: people + relationships + updates)
- Optimistic updates (no refetch after save)
- Background saves don't block UI

### React Optimization
- Memoize expensive calculations (`useMemo`)
- Use refs to prevent duplicate execution
- Guard effects with execution flags

## 📱 React Native / Expo

### Statsig Integration
- Provider above AuthProvider (starts as guest)
- Use `ensureInitialized()` lifecycle promise (not polling)
- `updateUserAsync()` in `onAuthStateChanged` callback
- Always `await flush()` for critical events

### Routing
- Wait for `isLoading === false` before routing decisions
- Single source of truth in AuthContext
- Use refs to prevent duplicate navigation

### AsyncStorage
- Wait for SDK initialization before accessing
- Use lifecycle promises, not polling
- Handle race conditions with guards

## 🐛 Error Handling

### Centralized Pattern
- Single error handler for Supabase operations
- Consistent error messages
- Handle specific error codes (PGRST116 = no rows)
- Don't block user flow on non-critical errors

### Development vs Production
- `__DEV__` guards for debug logs
- Production builds remove dev code
- Error boundaries for graceful failures

## 📝 Code Quality

### TypeScript
- Prefer interfaces over types
- Avoid `any` when possible
- Document limitations (e.g., Google SSO nonce)

### Testing Strategy
- Test on iOS and Android at each step
- Handle race conditions and edge cases
- Document decisions and trade-offs

### Incremental Development
- Build MVP first, refactor before adding features
- Each phase must work before moving to next
- Keep code reviewable and maintainable

## 🎯 Key Decisions

### Date Handling
- Use `YYYY-MM-DD` strings (ISO 8601)
- Simple solution works for birth/death dates
- Add date library when age calculations needed

### Google SSO Nonce
- SDK limitation: cannot control nonce
- Extract from JWT token after sign-in
- Trade-off: reduced security vs. working auth
- Documented in code comments

### Card-Based Layout
- Chose over graph library initially
- Faster to build, easier to iterate
- Can migrate to graph library later if needed
