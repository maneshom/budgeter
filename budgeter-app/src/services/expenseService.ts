import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Transaction,
  MonthlyBudget,
  DashboardSummary,
  Workspace,
  UserProfile,
  NewExpensePayload,
  ExpenseCategory,
  TransactionStatus,
} from '../types/expense';
import { getTodayDateString } from '../utils/date';

const STORAGE_KEYS = {
  TRANSACTIONS: 'spendwise_transactions_v1',
  BUDGET: 'spendwise_budget_v1',
};

export const DEFAULT_WORKSPACE: Workspace = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Family Budget',
  description: 'Household expenses & monthly planning',
  currency: 'INR',
  role: 'admin',
  membersCount: 4,
};

export const CURRENT_USER: UserProfile = {
  id: 'usr-alex-01',
  name: 'Alex Morgan',
  email: 'alex.morgan@family.spendwise',
  role: 'Family Admin',
};

export const DEFAULT_MONTHLY_BUDGET = 50000;

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    name: 'House Rent',
    amount: 12000,
    category: 'Housing',
    date: '2026-10-01',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Alex Morgan',
    status: 'approved',
    createdAt: '2026-10-01T10:00:00Z',
  },
  {
    id: 'tx-002',
    name: 'Groceries',
    amount: 2500,
    category: 'Food & Shopping',
    date: '2026-10-04',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Sarah Morgan',
    status: 'approved',
    createdAt: '2026-10-04T14:30:00Z',
  },
  {
    id: 'tx-003',
    name: 'Electricity Bill',
    amount: 1450,
    category: 'Utilities',
    date: '2026-10-06',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Alex Morgan',
    status: 'approved',
    createdAt: '2026-10-06T11:15:00Z',
  },
  {
    id: 'tx-004',
    name: 'Fuel',
    amount: 1200,
    category: 'Transport',
    date: '2026-10-08',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Alex Morgan',
    status: 'approved',
    createdAt: '2026-10-08T09:45:00Z',
  },
  {
    id: 'tx-005',
    name: 'Restaurant',
    amount: 850,
    category: 'Food & Dining',
    date: '2026-10-09',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Sarah Morgan',
    status: 'approved',
    createdAt: '2026-10-09T20:00:00Z',
  },
  {
    id: 'tx-006',
    name: 'Pharmacy / Health',
    amount: 500,
    category: 'Healthcare',
    date: '2026-10-10',
    workspaceId: DEFAULT_WORKSPACE.id,
    createdBy: 'Alex Morgan',
    status: 'approved',
    createdAt: '2026-10-10T16:20:00Z',
  },
];

interface DatabaseTransactionRow {
  id: string;
  workspace_id: string;
  member_id?: string | null;
  name: string;
  amount: number | string;
  category: string;
  date: string;
  created_by?: string | null;
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
    status: (row.status as TransactionStatus) || 'approved',
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

class ExpenseService {
  private localTransactions: Transaction[] = [];
  private monthlyBudget: number = DEFAULT_MONTHLY_BUDGET;
  private activeWorkspaceId: string | null = null;

  constructor() {
    this.loadLocalState();
  }

  private loadLocalState(): void {
    if (typeof window !== 'undefined') {
      try {
        const storedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        if (storedTx) {
          this.localTransactions = JSON.parse(storedTx);
        } else {
          this.localTransactions = [...INITIAL_TRANSACTIONS];
          this.persistLocalTransactions();
        }

        const storedBudget = localStorage.getItem(STORAGE_KEYS.BUDGET);
        if (storedBudget) {
          const num = Number(storedBudget);
          if (!isNaN(num) && num > 0) {
            this.monthlyBudget = num;
          }
        }
      } catch (err) {
        console.warn('Could not read from localStorage, using memory defaults', err);
        this.localTransactions = [...INITIAL_TRANSACTIONS];
      }
    } else {
      this.localTransactions = [...INITIAL_TRANSACTIONS];
    }
  }

  private persistLocalTransactions(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.localTransactions));
      } catch (err) {
        console.warn('Failed to save transactions to localStorage', err);
      }
    }
  }

  public isCloudConnected(): boolean {
    return isSupabaseConfigured;
  }

  public getCurrentUser(): UserProfile {
    return CURRENT_USER;
  }

  public getInitialBudgetSync(): MonthlyBudget {
    const now = new Date();
    return {
      id: `budget-${now.getFullYear()}-${now.getMonth() + 1}`,
      workspaceId: DEFAULT_WORKSPACE.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      amount: this.monthlyBudget,
    };
  }

  public getWorkspaceSync(): Workspace {
    return DEFAULT_WORKSPACE;
  }

  /**
   * Fetches or resolves the active workspace UUID.
   */
  public async getWorkspace(): Promise<Workspace> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Supabase getWorkspace error:', error);
        } else if (data) {
          this.activeWorkspaceId = data.id;
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            currency: data.currency || 'INR',
            role: 'admin',
            membersCount: 4,
          };
        }
      } catch (err) {
        console.error('Failed to get workspace from Supabase:', err);
      }
    }

    return DEFAULT_WORKSPACE;
  }

  private async getResolvedWorkspaceId(): Promise<string> {
    if (this.activeWorkspaceId) {
      return this.activeWorkspaceId;
    }
    const ws = await this.getWorkspace();
    return ws.id;
  }

  /**
   * Retrieves all transactions.
   * If Supabase is connected, queries `supabase.from('transactions').select('*')`.
   */
  public async getTransactions(): Promise<Transaction[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase query error (transactions):', error);
          return this.getLocalTransactions();
        }

        if (data) {
          const transactions = (data as DatabaseTransactionRow[]).map(mapRowToTransaction);
          this.localTransactions = transactions;
          this.persistLocalTransactions();
          return transactions;
        }
      } catch (err) {
        console.error('Network error contacting Supabase:', err);
      }
    }

    return this.getLocalTransactions();
  }

  private getLocalTransactions(): Transaction[] {
    return [...this.localTransactions].sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  /**
   * Adds an expense transaction.
   * Uses `supabase.from('transactions').insert(...)` when connected.
   */
  public async addTransaction(payload: NewExpensePayload): Promise<Transaction> {
    const roundedAmount = Math.round(payload.amount * 100) / 100;
    const date = payload.date || getTodayDateString();

    if (supabase) {
      try {
        const workspaceId = await this.getResolvedWorkspaceId();
        const newRow = {
          workspace_id: workspaceId,
          name: payload.name.trim(),
          amount: roundedAmount,
          category: payload.category,
          date,
          created_by: CURRENT_USER.name,
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
          return this.addLocalTransaction(payload);
        }

        const created = mapRowToTransaction(data as DatabaseTransactionRow);
        this.localTransactions.unshift(created);
        this.persistLocalTransactions();
        return created;
      } catch (err) {
        console.error('Failed to insert transaction to Supabase:', err);
        return this.addLocalTransaction(payload);
      }
    }

    return this.addLocalTransaction(payload);
  }

  private addLocalTransaction(payload: NewExpensePayload): Transaction {
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: payload.name.trim(),
      amount: Math.round(payload.amount * 100) / 100,
      category: payload.category,
      date: payload.date || getTodayDateString(),
      workspaceId: this.activeWorkspaceId || DEFAULT_WORKSPACE.id,
      createdBy: CURRENT_USER.name,
      status: 'approved',
      notes: payload.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    this.localTransactions.unshift(newTx);
    this.persistLocalTransactions();
    return newTx;
  }

  /**
   * Deletes a transaction.
   * Uses `supabase.from('transactions').delete().eq('id', id)` when connected.
   */
  public async deleteTransaction(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Supabase delete error (transactions):', error);
        }
      } catch (err) {
        console.error('Failed to delete transaction from Supabase:', err);
      }
    }

    // Always update local cache
    const initialLen = this.localTransactions.length;
    this.localTransactions = this.localTransactions.filter((tx) => tx.id !== id);
    if (this.localTransactions.length !== initialLen) {
      this.persistLocalTransactions();
      return true;
    }
    return true;
  }

  /**
   * Fetches monthly budget.
   * Uses `supabase.from('monthly_budgets').select('*')` when connected.
   */
  public async getMonthlyBudget(): Promise<MonthlyBudget> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('monthly_budgets')
          .select('*')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle();

        if (error) {
          console.error('Supabase query error (monthly_budgets):', error);
        } else if (data) {
          this.monthlyBudget = Number(data.amount);
          return {
            id: String(data.id),
            workspaceId: data.workspace_id || DEFAULT_WORKSPACE.id,
            month: data.month,
            year: data.year,
            amount: Number(data.amount),
          };
        }
      } catch (err) {
        console.error('Failed to fetch monthly budget from Supabase:', err);
      }
    }

    return {
      id: `budget-${currentYear}-${currentMonth}`,
      workspaceId: DEFAULT_WORKSPACE.id,
      month: currentMonth,
      year: currentYear,
      amount: this.monthlyBudget,
    };
  }

  public calculateSummary(transactions: Transaction[], budgetAmount: number): DashboardSummary {
    const totalSpent = transactions.reduce((sum, item) => sum + item.amount, 0);
    const roundedSpent = Math.round(totalSpent * 100) / 100;
    const remainingBalance = Math.round((budgetAmount - roundedSpent) * 100) / 100;
    const spentPercentage = budgetAmount > 0 
      ? Math.round((roundedSpent / budgetAmount) * 1000) / 10 
      : 0;
    const isOverBudget = remainingBalance < 0;

    return {
      monthlyBudget: budgetAmount,
      totalSpent: roundedSpent,
      remainingBalance,
      spentPercentage,
      isOverBudget,
      transactionCount: transactions.length,
    };
  }
}

export const expenseService = new ExpenseService();
