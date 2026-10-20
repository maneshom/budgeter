import { supabase } from './supabase';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../types/expense';
import { offlineStorage } from './offlineStorage';
import { budgetService } from './budgetService';

const DEFAULT_CATEGORIES = [
  'Food & Shopping',
  'Housing',
  'Utilities',
  'Transport',
  'Food & Dining',
  'Healthcare',
  'Education',
  'Entertainment',
  'Other',
];

class WorkspaceService {
  /**
   * Fetches workspaces strictly scoped to the active application mode (Offline or Cloud).
   */
  public async getUserWorkspaces(
    userId: string,
    _isGlobalOwner?: boolean,
    isOfflineMode: boolean = false
  ): Promise<Workspace[]> {
    // ------------------------------------------------------------------------
    // OFFLINE MODE: Strictly local device workspaces
    // ------------------------------------------------------------------------
    if (isOfflineMode || userId === 'local-owner') {
      return offlineStorage.getLocalWorkspaces();
    }

    // ------------------------------------------------------------------------
    // CLOUD MODE: Strictly Supabase cloud workspaces
    // ------------------------------------------------------------------------
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

    // 2. Fetch accessible cloud workspaces
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

    // 3. Member counts
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

      if (!isCreator && !assignedRole) {
        continue;
      }

      let role: WorkspaceRole = 'member';
      if (isCreator) {
        role = 'owner';
      } else if (assignedRole) {
        role = assignedRole;
      }

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
        storageType: 'cloud',
        syncStatus: 'synced',
      });
    }

    return result;
  }

  /**
   * Creates a workspace in either Offline mode (on-device) or Cloud mode (Supabase).
   */
  public async createWorkspace(
    name: string,
    description?: string,
    currency: string = 'INR',
    userId?: string,
    categorySetup: {
      mode: 'default' | 'none' | 'clone_empty' | 'clone_allocations';
      sourceWorkspaceId?: string;
    } = { mode: 'default' },
    isOfflineMode: boolean = false
  ): Promise<Workspace> {
    const cleanName = name.trim();
    const cleanDesc = description?.trim() || undefined;

    // ------------------------------------------------------------------------
    // OFFLINE MODE: Save to local device
    // ------------------------------------------------------------------------
    if (isOfflineMode || userId === 'local-owner') {
      const localId = `local-ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const localWorkspace: Workspace = {
        id: localId,
        name: cleanName,
        description: cleanDesc,
        currency,
        ownerId: 'local-owner',
        role: 'owner',
        membersCount: 1,
        createdAt: new Date().toISOString(),
        storageType: 'local',
        syncStatus: 'local_only',
      };

      await offlineStorage.saveLocalWorkspace(localWorkspace);

      // Default budget
      await offlineStorage.saveLocalBudget({
        id: `local-budget-${Date.now()}`,
        workspaceId: localId,
        amount: 50000,
        mode: 'fixed',
        periodType: 'monthly',
      });

      // Categories setup
      if (categorySetup.mode === 'default') {
        const initialCategories = DEFAULT_CATEGORIES.map((catName, index) => ({
          id: `local-cat-${Date.now()}-${index}`,
          workspaceId: localId,
          name: catName,
          amount: 0,
        }));
        await offlineStorage.setLocalCategories(localId, initialCategories);
      } else if (categorySetup.mode.startsWith('clone_') && categorySetup.sourceWorkspaceId) {
        try {
          const sourceCats = await budgetService.getCategories(categorySetup.sourceWorkspaceId, true);
          const cloned = sourceCats.map((sc, index) => ({
            id: `local-cat-${Date.now()}-${index}`,
            workspaceId: localId,
            name: sc.name,
            amount: categorySetup.mode === 'clone_allocations' ? sc.amount : 0,
          }));
          await offlineStorage.setLocalCategories(localId, cloned);
        } catch (cloneErr) {
          console.warn('Could not clone categories:', cloneErr);
        }
      }

      return localWorkspace;
    }

    // ------------------------------------------------------------------------
    // CLOUD MODE: Save to Supabase
    // ------------------------------------------------------------------------
    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_workspace', {
      p_name: cleanName,
      p_description: cleanDesc || null,
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
      name: cleanName,
      description: cleanDesc,
      currency,
      ownerId: userId,
      role: 'owner',
      membersCount: 1,
      createdAt: new Date().toISOString(),
      storageType: 'cloud',
      syncStatus: 'synced',
    };
  }

  /**
   * Deletes a workspace from local storage or cloud.
   */
  public async deleteWorkspace(workspaceId: string, isOfflineMode: boolean = false): Promise<void> {
    if (!workspaceId) {
      throw new Error('No workspace selected');
    }

    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      await offlineStorage.deleteLocalWorkspace(workspaceId);
      return;
    }

    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
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
   * Fetches all members of a workspace.
   */
  public async getWorkspaceMembers(
    workspaceId: string,
    isOfflineMode: boolean = false
  ): Promise<WorkspaceMember[]> {
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      return [
        {
          id: `local-member-${workspaceId}`,
          workspaceId,
          userId: 'local-owner',
          name: 'You (Offline User)',
          email: 'Stored locally on this device',
          role: 'owner',
          createdAt: new Date().toISOString(),
        },
      ];
    }

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
   * Assigns an existing registered user to the workspace (Cloud mode only).
   */
  public async assignMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'member'
  ): Promise<{ success: boolean; message: string }> {
    if (offlineStorage.isLocalWorkspace(workspaceId)) {
      throw new Error('Offline mode is single-user only. Switch to Cloud mode to collaborate with family members.');
    }

    if (!supabase) {
      throw new Error('Workspace services are unavailable. Please contact support.');
    }

    const cleanEmail = email.trim().toLowerCase();

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
   * Removes a member from the workspace (Cloud mode only).
   */
  public async removeMember(workspaceId: string, targetUserId: string): Promise<boolean> {
    if (offlineStorage.isLocalWorkspace(workspaceId)) {
      throw new Error('Cannot remove members in offline single-user mode.');
    }

    if (!supabase) return false;

    const { error } = await supabase.rpc('remove_workspace_member', {
      p_workspace_id: workspaceId,
      p_target_user_id: targetUserId,
    });

    if (error) {
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
