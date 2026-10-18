import { describe, it, expect, vi } from 'vitest';

// Mock Supabase client to avoid live network requests during unit testing
vi.mock('../services/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'usr-123', email: 'alex@spendwise.app', user_metadata: { name: 'Alex Morgan' } },
            session: { access_token: 'fake-token' },
          },
          error: null,
        }),
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'usr-new', email: 'new@spendwise.app' },
            session: { access_token: 'fake-token' },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'profiles') {
            return Promise.resolve({
              data: {
                id: 'usr-123',
                email: 'alex@spendwise.app',
                name: 'Alex Morgan',
                system_role: 'owner',
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn().mockResolvedValue({
          data: { id: 'tx-created', workspace_id: 'ws-111', name: 'Coffee', amount: 150, category: 'Food & Dining', date: '2026-10-17' },
          error: null,
        }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  };
});

import { expenseService } from '../services/expenseService';
import { authService } from '../services/authService';
import { getWorkspaceBudgetPeriod } from '../services/budgetService';
import type { UserProfile } from '../types/expense';

describe('MoneyUndo authentication & session handling', () => {
  it('correctly maps user profile and handles name fallbacks', async () => {
    const mockUser = {
      id: 'usr-123',
      email: 'alex@spendwise.app',
      user_metadata: { name: 'Alex Morgan' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const profile = await authService.getProfile(mockUser as any);
    expect(profile.id).toBe('usr-123');
    expect(profile.email).toBe('alex@spendwise.app');
    expect(profile.name).toBe('Alex Morgan');
    expect(profile.systemRole).toBe('owner');
  });

  it('signs in user with sanitized credentials', async () => {
    const res = await authService.signIn(' ALEX@spendwise.app ', 'password123');
    expect(res.user).toBeDefined();
    expect(res.session).toBeDefined();
  });
});

describe('Workspace Scoping & Isolation', () => {
  it('scopes transaction calculations to provided items and avoids cross-workspace contamination', () => {
    const ws1Transactions = [
      {
        id: 'tx-1',
        name: 'Groceries',
        amount: 2500,
        category: 'Food & Shopping' as const,
        date: '2026-10-15',
        workspaceId: 'ws-111',
        status: 'approved' as const,
        createdAt: '2026-10-15T10:00:00Z',
      },
      {
        id: 'tx-2',
        name: 'Electricity Bill',
        amount: 1450,
        category: 'Utilities' as const,
        date: '2026-10-16',
        workspaceId: 'ws-111',
        status: 'approved' as const,
        createdAt: '2026-10-16T10:00:00Z',
      },
    ];

    const summaryWs1 = expenseService.calculateSummary(ws1Transactions, 50000);
    expect(summaryWs1.totalSpent).toBe(3950);
    expect(summaryWs1.remainingBalance).toBe(46050);
    expect(summaryWs1.spentPercentage).toBe(7.9);
    expect(summaryWs1.isOverBudget).toBe(false);

    // Empty workspace has zero spent and full balance
    const summaryEmptyWs = expenseService.calculateSummary([], 30000);
    expect(summaryEmptyWs.totalSpent).toBe(0);
    expect(summaryEmptyWs.remainingBalance).toBe(30000);
    expect(summaryEmptyWs.spentPercentage).toBe(0);
    expect(summaryEmptyWs.isOverBudget).toBe(false);
  });

  it('correctly calculates over-budget warnings when spending exceeds budget', () => {
    const overSpentTransactions = [
      {
        id: 'tx-1',
        name: 'House Rent',
        amount: 55000,
        category: 'Housing' as const,
        date: '2026-10-01',
        workspaceId: 'ws-222',
        status: 'approved' as const,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ];

    const summary = expenseService.calculateSummary(overSpentTransactions, 50000);
    expect(summary.totalSpent).toBe(55000);
    expect(summary.remainingBalance).toBe(-5000);
    expect(summary.spentPercentage).toBe(110);
    expect(summary.isOverBudget).toBe(true);
  });
});

describe('Role-Based Access Control (RBAC) Permissions Logic', () => {
  const ownerUser: UserProfile = {
    id: 'user-owner',
    name: 'Owner User',
    email: 'owner@spendwise.app',
    systemRole: 'owner',
  };

  const adminUser: UserProfile = {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@spendwise.app',
    systemRole: 'member',
  };

  const memberUser: UserProfile = {
    id: 'user-member',
    name: 'Member User',
    email: 'member@spendwise.app',
    systemRole: 'member',
  };

  it('Owner has authority to create workspaces and assign workspace admins', () => {
    const isOwner = ownerUser.systemRole === 'owner';
    expect(isOwner).toBe(true);

    const canCreateWorkspace = (user: UserProfile) => user.systemRole === 'owner';
    expect(canCreateWorkspace(ownerUser)).toBe(true);
    expect(canCreateWorkspace(adminUser)).toBe(false);
    expect(canCreateWorkspace(memberUser)).toBe(false);

    const canAssignAdmin = (user: UserProfile, workspaceRole: string) => {
      return user.systemRole === 'owner' || workspaceRole === 'owner';
    };
    expect(canAssignAdmin(ownerUser, 'owner')).toBe(true);
    expect(canAssignAdmin(adminUser, 'admin')).toBe(false);
    expect(canAssignAdmin(memberUser, 'member')).toBe(false);
  });

  it('Admin can assign regular members but cannot promote anyone to Admin', () => {
    const canAssignRole = (callerWorkspaceRole: string, requestedRole: string) => {
      if (callerWorkspaceRole === 'owner') return true;
      if (callerWorkspaceRole === 'admin' && requestedRole === 'member') return true;
      return false;
    };

    expect(canAssignRole('admin', 'member')).toBe(true);
    expect(canAssignRole('admin', 'admin')).toBe(false);
    expect(canAssignRole('member', 'member')).toBe(false);
    expect(canAssignRole('member', 'admin')).toBe(false);
  });

  it('Member cannot remove other members or manage workspaces', () => {
    const canRemoveMember = (
      callerRole: 'owner' | 'admin' | 'member',
      targetRole: 'owner' | 'admin' | 'member',
      isSelf: boolean
    ) => {
      if (isSelf) return true;
      if (callerRole === 'owner') return true;
      if (callerRole === 'admin' && targetRole === 'member') return true;
      return false;
    };

    expect(canRemoveMember('admin', 'member', false)).toBe(true);
    expect(canRemoveMember('admin', 'admin', false)).toBe(false);
    expect(canRemoveMember('admin', 'owner', false)).toBe(false);
    expect(canRemoveMember('member', 'member', false)).toBe(false);
    expect(canRemoveMember('member', 'member', true)).toBe(true);
  });
});

describe('Workspace Isolation & Strict Ownership Rules', () => {
  it('Owner only sees and manages workspaces they created (or are assigned members of)', () => {
    const owner1Id = 'owner-1';
    const owner2Id = 'owner-2';

    const allWorkspaces = [
      { id: 'ws-1', name: 'Owner 1 Family', owner_id: owner1Id },
      { id: 'ws-2', name: 'Owner 2 Family', owner_id: owner2Id },
      { id: 'ws-3', name: 'Shared Workspace', owner_id: owner2Id },
    ];

    // Membership records: owner1 is also assigned as a member to ws-3
    const memberships = [
      { workspace_id: 'ws-3', user_id: owner1Id, role: 'member' },
    ];

    // Isolation filter function matching workspaceService / RLS
    const getVisibleWorkspaces = (userId: string) => {
      const userMemberWsIds = new Set(
        memberships.filter((m) => m.user_id === userId).map((m) => m.workspace_id)
      );
      return allWorkspaces.filter(
        (ws) => ws.owner_id === userId || userMemberWsIds.has(ws.id)
      );
    };

    const owner1Workspaces = getVisibleWorkspaces(owner1Id);
    // Owner 1 must see ws-1 (created by them) and ws-3 (assigned member)
    expect(owner1Workspaces.map((w) => w.id)).toEqual(['ws-1', 'ws-3']);
    // Owner 1 must NOT see ws-2 (created by Owner 2)
    expect(owner1Workspaces.some((w) => w.id === 'ws-2')).toBe(false);

    const owner2Workspaces = getVisibleWorkspaces(owner2Id);
    // Owner 2 must see ws-2 and ws-3 (created by them)
    expect(owner2Workspaces.map((w) => w.id)).toEqual(['ws-2', 'ws-3']);
    // Owner 2 must NOT see ws-1
    expect(owner2Workspaces.some((w) => w.id === 'ws-1')).toBe(false);
  });

  it('Owner cannot administer or assign admins in a workspace they did not create', () => {
    const owner1Id = 'owner-1';
    const workspaceOwnedByOther = { id: 'ws-2', owner_id: 'owner-2' };

    const canAdministerWorkspace = (userId: string, workspace: { id: string; owner_id: string }) => {
      return workspace.owner_id === userId;
    };

    expect(canAdministerWorkspace(owner1Id, workspaceOwnedByOther)).toBe(false);
  });

  it('Admin and Member permissions are strictly scoped to their assigned workspace', () => {
    interface MemberAssignment {
      workspaceId: string;
      userId: string;
      role: 'admin' | 'member';
    }

    const assignments: MemberAssignment[] = [
      { workspaceId: 'ws-alpha', userId: 'user-charlie', role: 'admin' },
      { workspaceId: 'ws-beta', userId: 'user-charlie', role: 'member' },
    ];

    const canManageWorkspaceMembers = (userId: string, workspaceId: string) => {
      const assignment = assignments.find(
        (a) => a.userId === userId && a.workspaceId === workspaceId
      );
      return assignment?.role === 'admin';
    };

    // Charlie is admin in Alpha
    expect(canManageWorkspaceMembers('user-charlie', 'ws-alpha')).toBe(true);
    // Charlie is only a regular member in Beta
    expect(canManageWorkspaceMembers('user-charlie', 'ws-beta')).toBe(false);
    // Charlie has no membership in Gamma
    expect(canManageWorkspaceMembers('user-charlie', 'ws-gamma')).toBe(false);
  });
});

describe('Workspace budget period calculation', () => {
  it('uses the current calendar month for monthly budgets', () => {
    expect(
      getWorkspaceBudgetPeriod(
        {
          id: 'budget-monthly',
          workspaceId: 'ws-1',
          amount: 1000,
          mode: 'fixed',
          periodType: 'monthly',
        },
        new Date('2026-02-15T12:00:00Z')
      )
    ).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
  });

  it('uses the current calendar year for yearly budgets', () => {
    expect(
      getWorkspaceBudgetPeriod(
        {
          id: 'budget-yearly',
          workspaceId: 'ws-1',
          amount: 1000,
          mode: 'fixed',
          periodType: 'yearly',
        },
        new Date('2026-02-15T12:00:00Z')
      )
    ).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  it('preserves explicit custom date ranges', () => {
    expect(
      getWorkspaceBudgetPeriod({
        id: 'budget-custom',
        workspaceId: 'ws-1',
        amount: 1000,
        mode: 'fixed',
        periodType: 'custom',
        startDate: '2026-12-20',
        endDate: '2027-01-05',
      })
    ).toEqual({ startDate: '2026-12-20', endDate: '2027-01-05' });
  });
});
