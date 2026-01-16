# Admin Panel Approach for Content Moderation

## Overview

This document outlines the approach for implementing content moderation and admin functionality for the Family Tree App. Based on the security audit findings, we need a system to review and moderate user-generated content (reports, updates, etc.).

## Decision: Web-Based Admin Panel

**Why Web Instead of Mobile App:**

1. **Safety**: Admin code and secret keys should not be shipped to the public App Store
2. **Efficiency**: Reviewing photos and long text reports is much faster on desktop with keyboard and mouse
3. **Security**: Admin functionality can be kept separate from public-facing app
4. **Scalability**: Easier to add complex admin features (bulk actions, analytics, etc.)

## Implementation Options

### Option 1: Retool (Recommended for Quick Start)

**Pros:**
- Low-code solution - build admin panel in 20 minutes
- Drag-and-drop interface builder
- Direct connection to Supabase PostgreSQL database
- Built-in authentication and permissions
- No backend code needed

**Cons:**
- Monthly cost (~$50/month for team plan)
- Less customization than custom solution

**Setup Steps:**
1. Sign up for Retool account
2. Connect to Supabase PostgreSQL database
3. Create tables/queries for:
   - Reports table (view pending reports)
   - Updates table (view reported content)
   - User blocks table (view blocking relationships)
4. Build UI with:
   - Table view of pending reports
   - Image preview for reported photos
   - Action buttons: "Delete Content", "Dismiss Report", "Block User"
5. Configure authentication (only allow admin users)

### Option 2: Next.js Admin Dashboard

**Pros:**
- Full control and customization
- Can use existing Supabase client libraries
- Can deploy to Vercel/Netlify for free
- Can reuse React components from mobile app

**Cons:**
- Requires development time (1-2 weeks)
- Need to build authentication system
- Need to build UI components

**Tech Stack:**
- Next.js 14+ (App Router)
- Supabase JS client (same as mobile app)
- Tailwind CSS or shadcn/ui for UI
- NextAuth.js or Supabase Auth for admin authentication

**Key Features to Build:**
1. Admin login page (separate from mobile app auth)
2. Reports dashboard:
   - List of pending reports with filters
   - Report details (reporter, content, reason)
   - Image preview for reported photos
3. Content moderation actions:
   - Delete update (sets `is_deleted = true` in updates table)
   - Mark report as resolved (sets `status = 'resolved'` in reports table)
   - Block user (creates entry in `user_blocks` table)
4. Analytics dashboard (optional):
   - Total reports per day/week
   - Most reported users
   - Content moderation metrics

### Option 3: Supabase Dashboard + Custom SQL

**Pros:**
- Free (uses existing Supabase subscription)
- No additional infrastructure
- Direct database access

**Cons:**
- Limited UI customization
- Not user-friendly for non-technical admins
- No built-in workflow management

**Use Case:**
- Temporary solution while building proper admin panel
- For technical admins who are comfortable with SQL

## Recommended Implementation Plan

### Phase 1: Quick Start (Week 1)
1. Set up Retool account and connect to Supabase
2. Build basic reports review interface
3. Implement core actions:
   - View pending reports
   - Delete reported content
   - Mark reports as resolved

### Phase 2: Enhanced Features (Week 2-3)
1. Add user blocking functionality
2. Add bulk actions (delete multiple reports at once)
3. Add filters and search
4. Add email notifications for critical reports

### Phase 3: Custom Solution (Month 2+)
1. Build Next.js admin dashboard
2. Migrate from Retool to custom solution
3. Add advanced features:
   - Analytics dashboard
   - Automated content moderation (AI-based)
   - User management tools

## Database Schema Requirements

The following tables are already in place:
- `reports` - Stores user reports
- `user_blocks` - Stores blocking relationships
- `updates` - Stores user-generated content

**Required Actions:**

When admin deletes content:
```sql
UPDATE updates 
SET is_deleted = true 
WHERE updates_id = '<update_id>';
```

When admin resolves a report:
```sql
UPDATE reports 
SET status = 'resolved' 
WHERE id = '<report_id>';
```

When admin blocks a user:
```sql
INSERT INTO user_blocks (blocker_id, blocked_id)
VALUES ('<admin_user_id>', '<blocked_user_id>')
ON CONFLICT DO NOTHING;
```

## Security Considerations

1. **Admin Authentication**: 
   - Use separate admin accounts (not regular user accounts)
   - Implement role-based access control (RBAC)
   - Use Supabase RLS policies to restrict admin table access

2. **API Security**:
   - Admin actions should use Supabase Edge Functions with admin service role key
   - Never expose admin service role key to frontend
   - Validate admin permissions on every action

3. **Audit Logging**:
   - Log all admin actions (who deleted what, when)
   - Store in separate `admin_actions` table

## Next Steps

1. **Immediate**: Set up Retool account and build basic reports interface
2. **Short-term**: Test admin workflow with real reports
3. **Long-term**: Build custom Next.js admin dashboard for full control

## Resources

- [Retool Documentation](https://docs.retool.com/)
- [Supabase Admin API](https://supabase.com/docs/guides/api)
- [Next.js Admin Dashboard Template](https://github.com/shadcn-ui/admin-dashboard)
