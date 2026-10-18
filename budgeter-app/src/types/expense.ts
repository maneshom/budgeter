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

export type ExpenseCategory = string;

export type TransactionStatus = 'approved' | 'pending' | 'rejected';

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD format
  workspaceId: string;
  createdBy?: string;
  createdById?: string;
  status: TransactionStatus;
  notes?: string;
  createdAt: string;
}

export type BudgetPeriodType = 'monthly' | 'yearly' | 'custom';
export type WorkspaceBudgetMode = 'fixed' | 'category_total' | 'capped';

export interface WorkspaceBudgetConfig {
  id: string;
  workspaceId: string;
  amount: number;
  mode: WorkspaceBudgetMode;
  periodType: BudgetPeriodType;
  startDate?: string;
  endDate?: string;
}

export interface WorkspaceBudgetCategory {
  id: string;
  workspaceId: string;
  name: string;
  amount: number;
}

export interface SaveWorkspaceBudgetPayload {
  amount: number;
  mode: WorkspaceBudgetMode;
  periodType: BudgetPeriodType;
  startDate?: string;
  endDate?: string;
}

export interface SaveWorkspaceCategoryPayload {
  name: string;
  amount: number;
}

export interface DashboardSummary {
  workspaceBudget: number;
  totalSpent: number;
  remainingBalance: number;
  spentPercentage: number;
  isOverBudget: boolean;
  transactionCount: number;
}

export type SystemRole = 'owner' | 'member';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  currency: string;
  ownerId?: string;
  role: WorkspaceRole;
  membersCount: number;
  createdAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  avatarUrl?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface NewExpensePayload {
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes?: string;
}
