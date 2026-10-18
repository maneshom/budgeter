import { supabase } from './supabase';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../types/expense';

class WorkspaceService {
  /**
   * Fetches all workspaces accessible by the given user.
   * If the user is a global Owner, they can access workspaces they own as well as workspaces they are members of.
   */
  public async getUserWorkspaces(userId: string, _isGlobalOwner?: boolean): Promise<Workspace[]> {
    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }

    // 1. Fetch member records for this user
    const { data: memberRows, error: memberErr } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userId);

    if (memberErr) {
      console.error('Error fetching member records:', memberErr);
      throw new Error(`Unable to verify workspace access: ${memberErr.message}`);
    }

    const memberRoleByWsId = new Map<string, WorkspaceRole>();
    (memberRows || []).forEach((row) => {
      memberRoleByWsId.set(row.workspace_id, row.role as WorkspaceRole);
    });

    // 2. Fetch accessible workspaces
    const { data: workspacesData, error: wsErr } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (wsErr) {
      console.error('Error fetching workspaces:', wsErr);
      throw wsErr;
    }

    if (!workspacesData || workspacesData.length === 0) {
      return [];
    }

    // 3. For each workspace, fetch active member counts
    const workspaceIds = workspacesData.map((w) => w.id);
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .in('workspace_id', workspaceIds);

    const countByWsId = new Map<string, number>();
    (allMembers || []).forEach((m) => {
      countByWsId.set(m.workspace_id, (countByWsId.get(m.workspace_id) || 0) + 1);
    });

    const result: Workspace[] = [];

    for (const ws of workspacesData) {
      const isCreator = ws.owner_id === userId;
      const assignedRole = memberRoleByWsId.get(ws.id);

      // Strict workspace isolation:
      // Users (including system owners) only see workspaces they created or are assigned members of.
      if (!isCreator && !assignedRole) {
        continue;
      }

      // Determine user's effective role in this specific workspace
      let role: WorkspaceRole = 'member';
      if (isCreator) {
        role = 'owner';
      } else if (assignedRole) {
        role = assignedRole;
      }

      // Member count: assigned members + 1 (for owner)
      const membersCount = (countByWsId.get(ws.id) || 0) + (ws.owner_id ? 1 : 0);

      result.push({
        id: ws.id,
        name: ws.name,
        description: ws.description || undefined,
        currency: ws.currency || 'INR',
        ownerId: ws.owner_id || undefined,
        role,
        membersCount: Math.max(membersCount, 1),
        createdAt: ws.created_at,
      });
    }

    return result;
  }

  /**
   * Creates a new workspace. Allowed only for users with the Owner role.
   */
  public async createWorkspace(
    name: string,
    description?: string,
    currency: string = 'INR',
    userId?: string,
    categorySetup: {
      mode: 'default' | 'none' | 'clone_empty' | 'clone_allocations';
      sourceWorkspaceId?: string;
    } = { mode: 'default' }
  ): Promise<Workspace> {
    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }

    // Try secure RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_workspace', {
      p_name: name.trim(),
      p_description: description?.trim() || null,
      p_currency: currency,
      p_category_mode: categorySetup.mode,
      p_source_workspace_id: categorySetup.sourceWorkspaceId || null,
    });

    if (rpcError) {
      console.error('Error creating workspace:', rpcError);
      throw new Error(`Failed to create workspace: ${rpcError.message}`);
    }
    if (!rpcData?.workspace_id) {
      throw new Error('Workspace creation returned no workspace ID.');
    }

    return {
      id: rpcData.workspace_id as string,
      name: name.trim(),
      description: description?.trim(),
      currency,
      ownerId: userId,
      role: 'owner',
      membersCount: 1,
    };
  }

  public async deleteWorkspace(workspaceId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }
    if (!workspaceId) {
      throw new Error('No workspace selected');
    }

    const { data, error } = await supabase.rpc('delete_workspace', {
      p_workspace_id: workspaceId,
    });

    if (error) {
      console.error('Error deleting workspace:', error);
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
    if (!data?.success) {
      throw new Error('Workspace was not deleted. Only its owner can delete it.');
    }
  }

  /**
   * Fetches all members of a workspace, including the workspace owner.
   */
  public async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (!supabase) return [];

    // 1. Get workspace owner
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();

    const members: WorkspaceMember[] = [];

    if (wsData?.owner_id) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', wsData.owner_id)
        .maybeSingle();

      if (ownerProfile) {
        members.push({
          id: `owner-${ownerProfile.id}`,
          workspaceId,
          userId: ownerProfile.id,
          name: ownerProfile.name,
          email: ownerProfile.email,
          role: 'owner',
          createdAt: ownerProfile.created_at || new Date().toISOString(),
        });
      }
    }

    // 2. Get assigned members from workspace_members
    const { data: memberRows, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        created_at
      `)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error fetching workspace members:', error);
      return members;
    }

    if (memberRows && memberRows.length > 0) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profileById = new Map<string, { name: string; email: string }>();
      (profiles || []).forEach((p) => {
        profileById.set(p.id, { name: p.name, email: p.email });
      });

      for (const row of memberRows) {
        // Skip if owner is also in workspace_members to avoid duplicate listing
        if (row.user_id === wsData?.owner_id) continue;

        const prof = profileById.get(row.user_id);
        members.push({
          id: row.id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          name: prof?.name || 'Member',
          email: prof?.email || 'member@spendwise',
          role: row.role as WorkspaceRole,
          createdAt: row.created_at,
        });
      }
    }

    return members;
  }

  /**
   * Assigns an existing registered user to the workspace.
   */
  public async assignMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'member'
  ): Promise<{ success: boolean; message: string }> {
    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Call secure RPC
    const { data, error } = await supabase.rpc('assign_workspace_member', {
      p_workspace_id: workspaceId,
      p_email: cleanEmail,
      p_role: role,
    });

    if (error) {
      throw error;
    }

    if (data && data.success === false) {
      throw new Error(data.message || 'Could not assign member');
    }

    return {
      success: true,
      message: `Assigned ${cleanEmail} as ${role}.`,
    };
  }

  /**
   * Removes a member from the workspace.
   */
  public async removeMember(workspaceId: string, targetUserId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase.rpc('remove_workspace_member', {
      p_workspace_id: workspaceId,
      p_target_user_id: targetUserId,
    });

    if (error) {
      // Fallback direct delete
      const { error: directErr } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId);

      if (directErr) {
        throw directErr;
      }
    }

    return true;
  }
}

export const workspaceService = new WorkspaceService();
