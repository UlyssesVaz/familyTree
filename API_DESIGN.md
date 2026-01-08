# Family Tree App - API Design Document

## Overview

This document outlines all API endpoints and real-time communication patterns needed for the collaborative family tree mobile application.

## Architecture Decision: REST + WebSockets

**Why Hybrid Approach?**
- **REST APIs**: For standard CRUD operations, initial data loading, and operations that don't need real-time updates
- **WebSockets**: For collaborative features requiring real-time synchronization (multiple users editing simultaneously)

**Rationale:**
- Mobile apps benefit from WebSocket connections for real-time collaboration
- REST APIs are simpler for one-off operations (create, update, delete)
- WebSocket connection can be maintained in background for instant updates
- Firebase/Supabase provide both REST APIs and WebSocket subscriptions

---

## Authentication & User Management

### POST `/api/auth/signin`
**Purpose:** Sign in with provider (Google, Microsoft, Apple, Slack)

**Request:**
```json
{
  "provider": "google" | "microsoft" | "apple" | "slack",
  "idToken": "string",
  "accessToken": "string" // Optional, provider-specific
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "photoUrl": "string"
  },
  "session": {
    "token": "jwt-token",
    "expiresAt": "timestamp"
  }
}
```

### POST `/api/auth/signout`
**Purpose:** Sign out current user

**Request:** (Headers: `Authorization: Bearer <token>`)

**Response:**
```json
{
  "success": true
}
```

### GET `/api/auth/me`
**Purpose:** Get current user info

**Request:** (Headers: `Authorization: Bearer <token>`)

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "photoUrl": "string",
    "onboardingComplete": boolean
  }
}
```

---

## Onboarding

### POST `/api/onboarding/initialize-ego`
**Purpose:** Initialize ego (current user's profile) after onboarding

**Request:**
```json
{
  "name": "string",
  "birthDate": "YYYY-MM-DD",
  "gender": "male" | "female" | "other",
  "photoUrl": "string", // Optional
  "location": "string" // Optional, formatted address
}
```

**Response:**
```json
{
  "personId": "uuid",
  "person": { /* Person object */ }
}
```

### POST `/api/onboarding/complete`
**Purpose:** Mark onboarding as complete

**Request:** (Headers: `Authorization: Bearer <token>`)

**Response:**
```json
{
  "onboardingComplete": true
}
```

---

## People Management

### GET `/api/people`
**Purpose:** Get all people in user's family tree

**Query Params:**
- `includeRelationships`: boolean (default: true)
- `includeUpdates`: boolean (default: false)

**Response:**
```json
{
  "people": [
    {
      "id": "uuid",
      "name": "string",
      "photoUrl": "string",
      "birthDate": "YYYY-MM-DD",
      "deathDate": "YYYY-MM-DD",
      "gender": "male" | "female" | "other",
      "bio": "string",
      "phoneNumber": "string",
      "parentIds": ["uuid"],
      "childIds": ["uuid"],
      "spouseIds": ["uuid"],
      "siblingIds": ["uuid"],
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "createdBy": "uuid",
      "updatedBy": "uuid",
      "version": 1
    }
  ]
}
```

### GET `/api/people/:id`
**Purpose:** Get a specific person by ID

**Response:**
```json
{
  "person": { /* Person object */ }
}
```

### POST `/api/people`
**Purpose:** Create a new person

**Request:**
```json
{
  "name": "string",
  "photoUrl": "string", // Optional
  "birthDate": "YYYY-MM-DD", // Optional
  "gender": "male" | "female" | "other", // Optional
  "phoneNumber": "string" // Optional
}
```

**Response:**
```json
{
  "person": { /* Person object */ }
}
```

### PUT `/api/people/:id`
**Purpose:** Update a person's profile

**Request:**
```json
{
  "name": "string", // Optional
  "photoUrl": "string", // Optional
  "birthDate": "YYYY-MM-DD", // Optional
  "gender": "male" | "female" | "other", // Optional
  "bio": "string", // Optional
  "phoneNumber": "string", // Optional
  "version": 1 // Required for optimistic locking
}
```

**Response:**
```json
{
  "person": { /* Updated Person object */ }
}
```

### DELETE `/api/people/:id`
**Purpose:** Delete a person (soft delete or hard delete)

**Request:** (Headers: `Authorization: Bearer <token>`)

**Response:**
```json
{
  "success": true
}
```

---

## Relationships

### POST `/api/relationships`
**Purpose:** Create a relationship between two people

**Request:**
```json
{
  "personId": "uuid",
  "relatedPersonId": "uuid",
  "relationshipType": "parent" | "spouse" | "child" | "sibling"
}
```

**Response:**
```json
{
  "success": true,
  "relationship": {
    "personId": "uuid",
    "relatedPersonId": "uuid",
    "relationshipType": "parent" | "spouse" | "child" | "sibling"
  }
}
```

### DELETE `/api/relationships`
**Purpose:** Remove a relationship

**Request:**
```json
{
  "personId": "uuid",
  "relatedPersonId": "uuid",
  "relationshipType": "parent" | "spouse" | "child" | "sibling"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Updates (Photos/Memories)

### GET `/api/updates`
**Purpose:** Get all updates (for family feed)

**Query Params:**
- `personId`: uuid (filter by person)
- `taggedPersonId`: uuid (filter by tagged person)
- `limit`: number (default: 50)
- `offset`: number (default: 0)
- `filter`: "all" | "group" (group = 4+ tagged people)

**Response:**
```json
{
  "updates": [
    {
      "id": "uuid",
      "personId": "uuid",
      "title": "string",
      "photoUrl": "string",
      "caption": "string",
      "isPublic": boolean,
      "taggedPersonIds": ["uuid"],
      "createdAt": "timestamp"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### GET `/api/updates/:id`
**Purpose:** Get a specific update

**Response:**
```json
{
  "update": { /* Update object */ }
}
```

### POST `/api/updates`
**Purpose:** Create a new update (photo/memory)

**Request:** (multipart/form-data)
```
photo: File
title: string
caption: string (optional)
isPublic: boolean (default: true)
taggedPersonIds: string[] (optional)
```

**Response:**
```json
{
  "update": { /* Update object */ }
}
```

### PUT `/api/updates/:id`
**Purpose:** Update an existing update

**Request:**
```json
{
  "title": "string", // Optional
  "caption": "string", // Optional
  "isPublic": boolean, // Optional
  "taggedPersonIds": ["uuid"] // Optional
}
```

**Response:**
```json
{
  "update": { /* Updated Update object */ }
}
```

### DELETE `/api/updates/:id`
**Purpose:** Delete an update

**Response:**
```json
{
  "success": true
}
```

### POST `/api/updates/:id/toggle-privacy`
**Purpose:** Toggle update privacy (public/private)

**Response:**
```json
{
  "update": { /* Updated Update object */ }
}
```

### POST `/api/updates/:id/toggle-tagged-visibility`
**Purpose:** Toggle visibility of tagged update on person's profile

**Request:**
```json
{
  "personId": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## File Upload

### POST `/api/upload/photo`
**Purpose:** Upload a photo (returns URL)

**Request:** (multipart/form-data)
```
file: File
type: "person" | "update" // Context for optimization
```

**Response:**
```json
{
  "url": "https://storage.example.com/photos/uuid.jpg",
  "thumbnailUrl": "https://storage.example.com/photos/uuid-thumb.jpg"
}
```

---

## Real-Time Collaboration (WebSocket)

### WebSocket Connection
**Endpoint:** `wss://api.example.com/ws`

**Connection:**
```json
{
  "type": "connect",
  "token": "jwt-token",
  "userId": "uuid"
}
```

### WebSocket Events

#### `person:created`
**Triggered when:** Someone creates a new person

**Payload:**
```json
{
  "type": "person:created",
  "person": { /* Person object */ },
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `person:updated`
**Triggered when:** Someone updates a person

**Payload:**
```json
{
  "type": "person:updated",
  "person": { /* Updated Person object */ },
  "userId": "uuid",
  "timestamp": "timestamp",
  "changes": ["name", "photoUrl"] // Fields that changed
}
```

#### `person:deleted`
**Triggered when:** Someone deletes a person

**Payload:**
```json
{
  "type": "person:deleted",
  "personId": "uuid",
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `relationship:created`
**Triggered when:** Someone creates a relationship

**Payload:**
```json
{
  "type": "relationship:created",
  "personId": "uuid",
  "relatedPersonId": "uuid",
  "relationshipType": "parent" | "spouse" | "child" | "sibling",
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `relationship:deleted`
**Triggered when:** Someone removes a relationship

**Payload:**
```json
{
  "type": "relationship:deleted",
  "personId": "uuid",
  "relatedPersonId": "uuid",
  "relationshipType": "parent" | "spouse" | "child" | "sibling",
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `update:created`
**Triggered when:** Someone creates an update

**Payload:**
```json
{
  "type": "update:created",
  "update": { /* Update object */ },
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `update:updated`
**Triggered when:** Someone updates an update

**Payload:**
```json
{
  "type": "update:updated",
  "update": { /* Updated Update object */ },
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `update:deleted`
**Triggered when:** Someone deletes an update

**Payload:**
```json
{
  "type": "update:deleted",
  "updateId": "uuid",
  "userId": "uuid",
  "timestamp": "timestamp"
}
```

#### `conflict:detected`
**Triggered when:** Optimistic update conflicts with server version

**Payload:**
```json
{
  "type": "conflict:detected",
  "resourceType": "person" | "update" | "relationship",
  "resourceId": "uuid",
  "localVersion": 1,
  "serverVersion": 2,
  "conflict": {
    "field": "name",
    "localValue": "John",
    "serverValue": "Jonathan"
  }
}
```

---

## Search

### GET `/api/search`
**Purpose:** Search people in family tree

**Query Params:**
- `q`: string (search query)
- `limit`: number (default: 20)

**Response:**
```json
{
  "results": [
    {
      "person": { /* Person object */ },
      "matchScore": 0.95,
      "matchedFields": ["name"]
    }
  ]
}
```

---

## Invitations

### POST `/api/invitations`
**Purpose:** Create an invitation to join family tree

**Request:**
```json
{
  "email": "string",
  "role": "viewer" | "editor" | "admin" // Optional, default: "editor"
}
```

**Response:**
```json
{
  "invitationId": "uuid",
  "inviteLink": "https://app.example.com/invite/uuid"
}
```

### GET `/api/invitations/:id`
**Purpose:** Get invitation details (for invite link)

**Response:**
```json
{
  "invitation": {
    "id": "uuid",
    "email": "string",
    "role": "viewer" | "editor" | "admin",
    "createdBy": "uuid",
    "createdAt": "timestamp",
    "expiresAt": "timestamp",
    "accepted": boolean
  }
}
```

### POST `/api/invitations/:id/accept`
**Purpose:** Accept an invitation

**Request:** (Headers: `Authorization: Bearer <token>`)

**Response:**
```json
{
  "success": true,
  "familyTreeId": "uuid"
}
```

---

## Permissions

### GET `/api/permissions`
**Purpose:** Get user's permissions for family tree

**Response:**
```json
{
  "permissions": {
    "canView": boolean,
    "canEdit": boolean,
    "canDelete": boolean,
    "canInvite": boolean,
    "role": "viewer" | "editor" | "admin"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional, additional error details
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` (401): Not authenticated
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Optimistic locking conflict
- `VALIDATION_ERROR` (400): Invalid request data
- `SERVER_ERROR` (500): Internal server error
- `NETWORK_ERROR`: Network/connection issue

---

## Implementation Notes

### Optimistic Updates
- All mutations should update local store immediately
- Sync with server response when received
- Handle conflicts via WebSocket `conflict:detected` events

### Offline Support
- Queue mutations when offline
- Sync when connection restored
- Show offline indicator in UI

### Rate Limiting
- Implement rate limiting on write operations
- Return `429 Too Many Requests` when exceeded

### Pagination
- Use cursor-based pagination for large datasets
- Include `nextCursor` in response

### Caching
- Cache GET responses with appropriate TTL
- Invalidate cache on mutations

---

## Database Schema Considerations

### People Table
- Primary key: `id` (UUID)
- Indexes: `createdBy`, `updatedAt`
- Soft delete: `deletedAt` column

### Relationships Table
- Composite primary key: `(personId, relatedPersonId, relationshipType)`
- Indexes on both `personId` and `relatedPersonId`

### Updates Table
- Primary key: `id` (UUID)
- Indexes: `personId`, `createdAt`, `taggedPersonIds` (array index)

### Version Tracking
- `version` column for optimistic locking
- Increment on every update
- Check version on PUT/DELETE operations

---

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control (RBAC)
3. **Input Validation**: Validate all inputs server-side
4. **SQL Injection**: Use parameterized queries
5. **XSS**: Sanitize user-generated content
6. **CSRF**: Use CSRF tokens for state-changing operations
7. **File Upload**: Validate file types, scan for malware
8. **Rate Limiting**: Prevent abuse

---

## Next Steps

1. **Choose Backend Framework**: Firebase, Supabase, or custom Node.js/Go
2. **Set up Database**: PostgreSQL or Firestore
3. **Implement Authentication**: Firebase Auth or custom JWT
4. **Set up File Storage**: Firebase Storage, S3, or similar
5. **Implement WebSocket Server**: Socket.io, native WebSocket, or Firebase Realtime Database
6. **Add API Gateway**: For rate limiting, authentication middleware
7. **Set up Monitoring**: Error tracking (Sentry), analytics

