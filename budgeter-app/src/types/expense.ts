export const EXPENSE_CATEGORIES = [
  'Food & Shopping',
  'Housing',
  'Utilities',
  'Transport',
  'Food & Dining',
  'Healthcare',
  'Education',
  'Entertainment',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type TransactionStatus = 'approved' | 'pending' | 'rejected';

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD format
  workspaceId: string;
  createdBy?: string;
  status: TransactionStatus;
  notes?: string;
  createdAt: string;
}

export interface MonthlyBudget {
  id: string;
  workspaceId: string;
  month: number; // 1-12
  year: number;
  amount: number;
}

export interface DashboardSummary {
  monthlyBudget: number;
  totalSpent: number;
  remainingBalance: number;
  spentPercentage: number;
  isOverBudget: boolean;
  transactionCount: number;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  currency: string;
  role: 'admin' | 'member' | 'viewer';
  membersCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface NewExpensePayload {
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes?: string;
}

