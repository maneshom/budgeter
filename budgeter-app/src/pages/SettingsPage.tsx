import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Workspace, WorkspaceMember, UserProfile } from '../types/expense';
import { workspaceService } from '../services/workspaceService';
import { WorkspaceBudgetManager } from '../components/budgets/WorkspaceBudgetManager';
import type { Transaction } from '../types/expense';

interface SettingsPageProps {
  activeWorkspace: Workspace;
  currentUser: UserProfile;
  transactions: Transaction[];
  workspaces: Workspace[];
  onOpenCreateWorkspace: () => void;
  onDeleteWorkspace: (workspace: Workspace) => Promise<void>;
  onWorkspaceUpdated?: () => void;
  onBudgetUpdated: () => void;
  onAddToast: (text: string, type?: 'success' | 'danger') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  activeWorkspace,
  currentUser,
  transactions,
  workspaces,
  onOpenCreateWorkspace,
  onDeleteWorkspace,
  onWorkspaceUpdated,
  onBudgetUpdated,
  onAddToast,
}) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  const isOwner = activeWorkspace.role === 'owner';
  const isAdmin = activeWorkspace.role === 'admin';
  const canManageMembers = isOwner || isAdmin;
  const canCreateWorkspace = currentUser.systemRole === 'owner';

  const loadMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const data = await workspaceService.getWorkspaceMembers(activeWorkspace.id);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [activeWorkspace.id]);

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setMemberError('Please enter a valid email address.');
      return;
    }

    // Role safety check
    const effectiveRole = isOwner ? inviteRole : 'member';

    setIsSubmittingInvite(true);
    try {
      const res = await workspaceService.assignMember(activeWorkspace.id, email, effectiveRole);
      onAddToast(res.message, 'success');
      setInviteEmail('');
      setIsAddingMember(false);
      await loadMembers();
      if (onWorkspaceUpdated) onWorkspaceUpdated();
    } catch (err: any) {
      console.error('Failed to assign member:', err);
      setMemberError(err.message || 'Failed to assign member.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${targetName} from ${activeWorkspace.name}?`)) {
      return;
    }

    try {
      await workspaceService.removeMember(activeWorkspace.id, targetUserId);
      onAddToast(`Removed ${targetName} from workspace`, 'success');
      await loadMembers();
      if (onWorkspaceUpdated) onWorkspaceUpdated();
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      onAddToast(err.message || 'Failed to remove member', 'danger');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!isOwner || isDeletingWorkspace) return;

    const confirmed = window.confirm(
      `Permanently delete "${activeWorkspace.name}" and all its expenses, budgets, categories, and memberships? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingWorkspace(true);
    try {
      await onDeleteWorkspace(activeWorkspace);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      onAddToast(err instanceof Error ? err.message : 'Failed to delete workspace', 'danger');
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header Overview */}
      <div className="overview-header">
        <div className="overview-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="overview-badge">Workspace Settings</span>
            <span className={`role-badge ${activeWorkspace.role}`}>
              {activeWorkspace.role.toUpperCase()}
            </span>
          </div>
          <h2 className="overview-title">{activeWorkspace.name} Settings</h2>
          <p className="overview-subtitle">
            Manage your workspace configuration, member permissions, and access.
          </p>
        </div>

        {canCreateWorkspace && (
          <button type="button" className="btn-primary" onClick={onOpenCreateWorkspace}>
            <Plus size={16} />
            <span>Create Workspace</span>
          </button>
        )}
      </div>

      {/* Role & Permissions Explanation Card */}
      <div className="settings-card permission-card">
        <div className="permission-card-header">
          <ShieldCheck size={22} className="permission-icon" />
          <div>
            <h3 className="settings-section-title">Your Access & Role</h3>
            <p className="settings-section-desc">
              {isOwner && (
                <>
                  You have the <strong>Owner</strong> role. You can create workspaces, manage all settings, and assign or remove workspace admins and members.
                </>
              )}
              {isAdmin && !isOwner && (
                <>
                  You are an <strong>Admin</strong> in this workspace. You can invite and manage regular members and configure the workspace budget and categories.
                </>
              )}
              {!isOwner && !isAdmin && (
                <>
                  You are a <strong>Member</strong> in this workspace. You can log expenses and view dashboard reports. User management is restricted to Admins and Owners.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <WorkspaceBudgetManager
        workspaceId={activeWorkspace.id}
        workspaces={workspaces}
        transactions={transactions}
        canManage={canManageMembers}
        onAddToast={onAddToast}
        onBudgetUpdated={onBudgetUpdated}
      />

      {/* Team / Members Management Section */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="section-title-wrap">
            <Users size={20} color="var(--primary)" />
            <div>
              <h3 className="settings-section-title">Workspace Members</h3>
              <p className="settings-section-desc">
                People who have access to view and record transactions in this workspace.
              </p>
            </div>
          </div>

          {canManageMembers && !isAddingMember && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsAddingMember(true)}
            >
              <UserPlus size={16} />
              <span>Add Member</span>
            </button>
          )}
        </div>

        {/* Add Member Form */}
        {isAddingMember && (
          <div className="add-member-panel">
            <h4 style={{ fontSize: '0.925rem', fontWeight: 600, marginBottom: 8 }}>
              {isOwner ? 'Assign or Invite Member / Admin' : 'Assign Workspace Member'}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Enter the registered email of the user to grant access.
            </p>

            {memberError && (
              <div className="auth-error" style={{ marginBottom: 12 }}>
                <AlertCircle size={15} />
                <span>{memberError}</span>
              </div>
            )}

            <form onSubmit={handleAssignMember} className="add-member-form">
              <div className="form-field" style={{ flex: 2, minWidth: 220 }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSubmittingInvite}
                  required
                />
              </div>

              {isOwner ? (
                <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    disabled={isSubmittingInvite}
                  >
                    <option value="member">Role: Member</option>
                    <option value="admin">Role: Admin</option>
                  </select>
                </div>
              ) : (
                <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    type="text"
                    className="form-input"
                    value="Role: Member"
                    disabled
                    readOnly
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingInvite}
                >
                  {isSubmittingInvite ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add to Workspace</span>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setIsAddingMember(false);
                    setMemberError(null);
                  }}
                  disabled={isSubmittingInvite}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Members List */}
        {isLoadingMembers ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading workspace members...
          </div>
        ) : (
          <div className="members-list">
            {members.map((member) => {
              const isMemberOwner = member.role === 'owner';
              const isCurrentUser = member.userId === currentUser.id;
              const canRemove =
                !isMemberOwner &&
                ((isOwner && !isCurrentUser) || (isAdmin && member.role === 'member' && !isCurrentUser));

              return (
                <div key={member.id} className="member-row">
                  <div className="member-info">
                    <div className="member-avatar">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="member-name">
                        {member.name} {isCurrentUser && <span className="you-pill">You</span>}
                      </div>
                      <div className="member-email">{member.email}</div>
                    </div>
                  </div>

                  <div className="member-actions">
                    <span className={`role-badge ${member.role}`}>
                      {member.role.toUpperCase()}
                    </span>

                    {canRemove && (
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={() => handleRemoveMember(member.userId, member.name)}
                        title={`Remove ${member.name}`}
                        aria-label={`Remove ${member.name} from workspace`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isOwner && (
        <section className="settings-card workspace-danger-zone" aria-labelledby="delete-workspace-heading">
          <div>
            <h3 id="delete-workspace-heading" className="settings-section-title">Delete Workspace</h3>
            <p className="settings-section-desc">
              Permanently delete this workspace and all associated expenses, budgets, and member assignments. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDeleteWorkspace}
            disabled={isDeletingWorkspace}
          >
            {isDeletingWorkspace ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            <span>{isDeletingWorkspace ? 'Deleting workspace...' : 'Delete this workspace'}</span>
          </button>
        </section>
      )}
    </div>
  );
};
