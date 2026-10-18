// Supabase Edge Function: invite-member
// Securely invites a new user via Supabase Admin API and assigns them to a workspace.
// Service role key is kept strictly server-side on Supabase Edge runtime.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate caller using their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workspace_id, email, role = 'member' } = await req.json();

    if (!workspace_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: workspace_id and email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedRole = String(role).toLowerCase().trim();
    if (sanitizedRole !== 'admin' && sanitizedRole !== 'member') {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin or member.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Initialize Privileged Admin Client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verify caller authorization in the database
    // Workspace permissions are strictly scoped to the workspace creator and assigned members

    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('owner_id, name')
      .eq('id', workspace_id)
      .maybeSingle();

    if (!workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Workspace owner privileges are strictly scoped to the workspace creator
    const isWsOwner = workspace.owner_id === caller.id;

    // Check if caller is assigned workspace admin
    let isWsAdmin = isWsOwner;
    if (!isWsAdmin) {
      const { data: memberRecord } = await adminClient
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspace_id)
        .eq('user_id', caller.id)
        .maybeSingle();

      isWsAdmin = memberRecord?.role === 'admin';
    }

    if (!isWsAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only workspace owners and admins can invite members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only owners can invite admins
    if (sanitizedRole === 'admin' && !isWsOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only workspace owners can assign workspace admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        data: {
          invited_to_workspace: workspace_id,
          invited_role: sanitizedRole,
        },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invitedUserId = inviteData.user.id;

    // 5. Ensure member record is created/updated in workspace_members
    const { error: memberError } = await adminClient
      .from('workspace_members')
      .upsert(
        {
          workspace_id,
          user_id: invitedUserId,
          role: sanitizedRole,
        },
        { onConflict: 'workspace_id,user_id' }
      );

    if (memberError) {
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: invitedUserId,
        email: email.trim().toLowerCase(),
        role: sanitizedRole,
        message: `Invitation email sent to ${email}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

