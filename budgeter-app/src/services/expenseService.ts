import { supabase } from './supabase';
import type {
  Transaction,
  DashboardSummary,
  NewExpensePayload,
  ExpenseCategory,
  TransactionStatus,
  UserProfile,
} from '../types/expense';
import { getTodayDateString } from '../utils/date';
import { offlineStorage } from './offlineStorage';

interface DatabaseTransactionRow {
  id: string;
  workspace_id: string;
  member_id?: string | null;
  name: string;
  amount: number | string;
  category: string;
  date: string;
  created_by?: string | null;
  created_by_id?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

function mapRowToTransaction(row: DatabaseTransactionRow): Transaction {
  return {
    id: String(row.id),
    name: row.name,
    amount: Number(row.amount),
    category: row.category as ExpenseCategory,
    date: row.date,
    workspaceId: row.workspace_id,
    createdBy: row.created_by || undefined,
    createdById: row.created_by_id || undefined,
    status: (row.status as TransactionStatus) || 'approved',
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

class ExpenseService {
  /**
   * Retrieves transactions strictly scoped to the active application mode.
   */
  public async getTransactions(
    workspaceId: string,
    isOfflineMode: boolean = false
  ): Promise<Transaction[]> {
    if (!workspaceId) {
      return [];
    }

    // 1. OFFLINE MODE: Pure device storage
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      return offlineStorage.getLocalTransactions(workspaceId);
    }

    // 2. CLOUD MODE: Supabase database
    if (!supabase) {
      throw new Error('Expense services are unavailable. Please contact support.');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query error (transactions):', error);
      throw new Error(`Failed to load expenses: ${error.message}`);
    }

    if (!data) return [];

    return (data as DatabaseTransactionRow[]).map(mapRowToTransaction);
  }

  /**
   * Adds an expense transaction strictly in offline storage or cloud.
   */
  public async addTransaction(
    workspaceId: string,
    payload: NewExpensePayload,
    user: UserProfile,
    isOfflineMode: boolean = false
  ): Promise<Transaction> {
    if (!workspaceId) {
      throw new Error('No active workspace selected');
    }

    const roundedAmount = Math.round(payload.amount * 100) / 100;
    const date = payload.date || getTodayDateString();

    // 1. OFFLINE MODE: Save to IndexedDB/LocalStorage
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      const localTx: Transaction = {
        id: `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: payload.name.trim(),
        amount: roundedAmount,
        category: payload.category,
        date,
        workspaceId,
        createdBy: user.name,
        createdById: user.id,
        status: 'approved',
        notes: payload.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await offlineStorage.saveLocalTransaction(localTx);
      return localTx;
    }

    // 2. CLOUD MODE: Save to Supabase
    if (!supabase) {
      throw new Error('Expense services are unavailable. Please contact support.');
    }

    const newRow = {
      workspace_id: workspaceId,
      name: payload.name.trim(),
      amount: roundedAmount,
      category: payload.category,
      date,
      created_by: user.name,
      created_by_id: user.id,
      status: 'approved',
      notes: payload.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert([newRow])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (transactions):', error);
      throw new Error(`Failed to save expense: ${error.message}`);
    }

    return mapRowToTransaction(data as DatabaseTransactionRow);
  }

  /**
   * Deletes a transaction from offline storage or cloud.
   */
  public async deleteTransaction(
    workspaceId: string,
    id: string,
    isOfflineMode: boolean = false
  ): Promise<boolean> {
    // 1. OFFLINE MODE
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      await offlineStorage.deleteLocalTransaction(workspaceId, id);
      return true;
    }

    // 2. CLOUD MODE
    if (!supabase) {
      throw new Error('Expense services are unavailable. Please contact support.');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error (transactions):', error);
      throw new Error(`Failed to delete expense: ${error.message}`);
    }

    return true;
  }

  /**
   * Calculates dashboard summary figures dynamically from transactions array and budget amount.
   */
  public calculateSummary(transactions: Transaction[], budgetAmount: number): DashboardSummary {
    const totalSpent = transactions.reduce((sum, item) => sum + item.amount, 0);
    const roundedSpent = Math.round(totalSpent * 100) / 100;
    const remainingBalance = Math.round((budgetAmount - roundedSpent) * 100) / 100;
    const spentPercentage = budgetAmount > 0
      ? Math.round((roundedSpent / budgetAmount) * 1000) / 1000
      : 0;
    const isOverBudget = remainingBalance < 0;

    return {
      workspaceBudget: budgetAmount,
      totalSpent: roundedSpent,
      remainingBalance,
      spentPercentage: Math.round(spentPercentage * 1000) / 10,
      isOverBudget,
      transactionCount: transactions.length,
    };
  }
}

export const expenseService = new ExpenseService();
