/**
 * Supabase Edge Function: Delete User
 * 
 * This function handles the deletion of users from auth.users table.
 * It requires service_role key because regular anon key cannot delete auth.users records.
 * 
 * Security: This function should only be called from trusted backend code after
 * all user data has been processed and deletion grace period has expired.
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

    console.log(`[Delete User Function] Attempting to delete user: ${user_id}`);

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
