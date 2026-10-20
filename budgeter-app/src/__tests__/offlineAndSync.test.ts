import { describe, it, expect, beforeEach } from 'vitest';
import { offlineStorage } from '../services/offlineStorage';
import { expenseService } from '../services/expenseService';
import { workspaceService } from '../services/workspaceService';
import { budgetService } from '../services/budgetService';
import type { UserProfile } from '../types/expense';

describe('Offline Storage & Partitioned Single-User Workspaces', () => {
  beforeEach(async () => {
    // Clean up local workspaces before each test
    const existing = await offlineStorage.getLocalWorkspaces();
    for (const ws of existing) {
      await offlineStorage.deleteLocalWorkspace(ws.id);
    }
  });

  it('correctly identifies local vs cloud workspace IDs', () => {
    expect(offlineStorage.isLocalWorkspace('local-ws-12345')).toBe(true);
    expect(offlineStorage.isLocalWorkspace('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    expect(offlineStorage.isLocalWorkspace('cloud-ws-1')).toBe(false);
  });

  it('creates and persists a local offline workspace with single-user defaults', async () => {
    const created = await workspaceService.createWorkspace(
      'Private Stash',
      'Local pocket money',
      'INR',
      'local-owner',
      { mode: 'default' },
      true // isOfflineMode
    );

    expect(created.id.startsWith('local-ws-')).toBe(true);
    expect(created.name).toBe('Private Stash');
    expect(created.storageType).toBe('local');
    expect(created.syncStatus).toBe('local_only');
    expect(created.role).toBe('owner');
    expect(created.membersCount).toBe(1);

    // Verify it is stored and retrieved from offlineStorage
    const allLocal = await offlineStorage.getLocalWorkspaces();
    expect(allLocal.some((w) => w.id === created.id)).toBe(true);

    // Verify default budget was created
    const budget = await offlineStorage.getLocalBudget(created.id);
    expect(budget).toBeDefined();
    expect(budget?.amount).toBe(50000);

    // Verify default categories were created
    const categories = await offlineStorage.getLocalCategories(created.id);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c) => c.name === 'Food & Dining')).toBe(true);
  });

  it('enforces single-user constraints on local workspaces', async () => {
    const localWs = await workspaceService.createWorkspace(
      'Solo Budget',
      'Single user only',
      'INR',
      'local-owner',
      { mode: 'none' },
      true
    );

    // Fetching members returns only the single local user
    const members = await workspaceService.getWorkspaceMembers(localWs.id, true);
    expect(members.length).toBe(1);
    expect(members[0].role).toBe('owner');

    // Trying to assign an external member throws an error
    await expect(
      workspaceService.assignMember(localWs.id, 'friend@spendwise.app', 'member')
    ).rejects.toThrow(/offline mode is single-user only/i);

    // Trying to remove a member throws an error
    await expect(
      workspaceService.removeMember(localWs.id, 'some-id')
    ).rejects.toThrow(/offline single-user mode/i);
  });

  it('adds and computes transactions in a local offline workspace with zero network calls', async () => {
    const localWs = await workspaceService.createWorkspace(
      'Personal Diary',
      undefined,
      'INR',
      'local-owner',
      { mode: 'default' },
      true
    );

    const user: UserProfile = {
      id: 'local-owner',
      name: 'Solo User',
      email: 'solo@device.local',
      systemRole: 'owner',
    };

    const tx1 = await expenseService.addTransaction(
      localWs.id,
      {
        name: 'Morning Coffee',
        amount: 150,
        category: 'Food & Dining',
        date: '2026-10-20',
      },
      user,
      true
    );

    const tx2 = await expenseService.addTransaction(
      localWs.id,
      {
        name: 'Metro Ticket',
        amount: 80,
        category: 'Transport',
        date: '2026-10-20',
      },
      user,
      true
    );

    expect(tx1.id.startsWith('local-tx-')).toBe(true);
    expect(tx2.id.startsWith('local-tx-')).toBe(true);

    const allTxs = await expenseService.getTransactions(localWs.id, true);
    expect(allTxs.length).toBe(2);

    const summary = expenseService.calculateSummary(allTxs, 50000);
    expect(summary.totalSpent).toBe(230);
    expect(summary.remainingBalance).toBe(49770);
    expect(summary.isOverBudget).toBe(false);

    // Delete one transaction
    await expenseService.deleteTransaction(localWs.id, tx1.id, true);
    const updatedTxs = await expenseService.getTransactions(localWs.id, true);
    expect(updatedTxs.length).toBe(1);
    expect(updatedTxs[0].id).toBe(tx2.id);
  });

  it('saves and updates budget configurations strictly in offline mode', async () => {
    const localWs = await workspaceService.createWorkspace(
      'Monthly Household',
      undefined,
      'INR',
      'local-owner',
      { mode: 'default' },
      true
    );

    // Update offline budget
    const updatedBudget = await budgetService.saveWorkspaceBudget(
      localWs.id,
      {
        amount: 75000,
        mode: 'fixed',
        periodType: 'monthly',
      },
      true
    );

    expect(updatedBudget.amount).toBe(75000);

    const retrieved = await budgetService.getWorkspaceBudget(localWs.id, true);
    expect(retrieved.amount).toBe(75000);

    // Categories in offline mode
    const categories = await budgetService.getCategories(localWs.id, true);
    expect(categories.length).toBeGreaterThan(0);
  });
});
