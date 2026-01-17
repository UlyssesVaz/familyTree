/**
 * Supabase Edge Function: Delete User
 * 
 * This function handles the deletion of users from auth.users table.
 * It requires service_role key because regular anon key cannot delete auth.users records.
 * 
 * Security: This function can be called in two modes:
 * 1. User-initiated deletion: User's JWT must match the user_id being deleted (self-deletion only)
 * 2. Scheduled job deletion: Service role key can delete any user (for expired grace periods)
 * 
 * Required for App Store compliance (Apple Guideline 5.1.1 - Account Deletion)
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Delete User Function] Missing environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          message: 'Missing required environment variables' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create admin client with service_role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request',
          message: 'user_id is required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate user_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request',
          message: 'user_id must be a valid UUID' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // SECURITY: Determine authorization mode
    // Extract Authorization header
    const authHeader = req.headers.get('Authorization');
    let isServiceRoleCall = false;
    let requestingUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Check if this is a service role key (scheduled job or trusted backend)
      // Service role keys are API keys, not JWTs - compare directly
      if (token === supabaseServiceRoleKey) {
        isServiceRoleCall = true;
        console.log('[Delete User Function] Authorized via service role key (scheduled job or trusted backend)');
      } else {
        // This is a user JWT - verify it and check ownership
        try {
          const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
          
          if (authError || !requestingUser) {
            console.error('[Delete User Function] Invalid user token:', authError?.message);
            return new Response(
              JSON.stringify({ 
                error: 'Unauthorized',
                message: 'Invalid or expired token' 
              }),
              { 
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          requestingUserId = requestingUser.id;

          // Users can only delete their own account (prevent malicious deletion of other users)
          if (requestingUserId !== user_id) {
            console.error(`[Delete User Function] Authorization failed: User ${requestingUserId} attempted to delete user ${user_id}`);
            return new Response(
              JSON.stringify({ 
                error: 'Forbidden',
                message: 'You can only delete your own account' 
              }),
              { 
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          console.log(`[Delete User Function] Authorized user-initiated deletion: ${user_id}`);
        } catch (error: any) {
          // If token parsing fails, it's not a valid user JWT
          console.error('[Delete User Function] Token validation error:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Unauthorized',
              message: 'Invalid token format' 
            }),
            { 
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    } else {
      // No authorization header - reject (security: require explicit auth)
      console.error('[Delete User Function] Missing authorization header');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Authorization header required (Bearer token or service role key)' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // At this point, we're authorized:
    // - Either via service role key (scheduled job, can delete any user)
    // - Or via user JWT matching the user_id (self-deletion)

    console.log(`[Delete User Function] Proceeding with deletion for user: ${user_id} (${isServiceRoleCall ? 'service role' : 'user-initiated'})`);

    // Delete from auth.users (requires service_role key)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) {
      console.error(`[Delete User Function] Error deleting user ${user_id}:`, error);
      
      // If user doesn't exist, that's okay (idempotent operation)
      if (error.message.includes('User not found') || error.message.includes('not found')) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'User not found (already deleted or never existed)'
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.status || 500
        }),
        { 
          status: error.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[Delete User Function] Successfully deleted user: ${user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Delete User Function] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
