import { supabase } from './supabase';
import type {
  BudgetPeriodType,
  SaveWorkspaceBudgetPayload,
  SaveWorkspaceCategoryPayload,
  WorkspaceBudgetCategory,
  WorkspaceBudgetConfig,
  WorkspaceBudgetMode,
} from '../types/expense';
import { offlineStorage } from './offlineStorage';

export interface BudgetPeriod {
  startDate: string;
  endDate: string;
}

function mapConfig(row: {
  id: string;
  workspace_id: string;
  amount: number | string;
  mode: string;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
}): WorkspaceBudgetConfig {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    amount: Number(row.amount),
    mode: row.mode as WorkspaceBudgetMode,
    periodType: row.period_type as BudgetPeriodType,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
  };
}

function mapCategory(row: {
  id: string;
  workspace_id: string;
  name: string;
  amount: number | string;
}): WorkspaceBudgetCategory {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    amount: Number(row.amount),
  };
}

export function getWorkspaceBudgetPeriod(config: WorkspaceBudgetConfig, today = new Date()): BudgetPeriod {
  if (config.periodType === 'custom') {
    if (!config.startDate || !config.endDate) {
      throw new Error('Custom workspace budgets require a start and end date.');
    }
    return { startDate: config.startDate, endDate: config.endDate };
  }

  const year = today.getFullYear();
  const month = today.getMonth();
  const start = config.periodType === 'yearly'
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, month, 1));
  const end = config.periodType === 'yearly'
    ? new Date(Date.UTC(year + 1, 0, 0))
    : new Date(Date.UTC(year, month + 1, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function validateConfig(payload: SaveWorkspaceBudgetPayload): SaveWorkspaceBudgetPayload {
  if (!Number.isFinite(payload.amount) || payload.amount < 0) {
    throw new Error('Workspace amount must be zero or more.');
  }
  if (
    payload.periodType === 'custom' &&
    (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate)
  ) {
    throw new Error('Choose a valid custom start and end date.');
  }
  return {
    ...payload,
    amount: Math.round(payload.amount * 100) / 100,
    startDate: payload.periodType === 'custom' ? payload.startDate : undefined,
    endDate: payload.periodType === 'custom' ? payload.endDate : undefined,
  };
}

function validateCategory(payload: SaveWorkspaceCategoryPayload): SaveWorkspaceCategoryPayload {
  const name = payload.name.trim();
  if (!name || name.length > 60) throw new Error('Category name must be 1–60 characters.');
  if (!Number.isFinite(payload.amount) || payload.amount < 0) {
    throw new Error('Category amount must be zero or more.');
  }
  return { name, amount: Math.round(payload.amount * 100) / 100 };
}

class BudgetService {
  public async getWorkspaceBudget(
    workspaceId: string,
    isOfflineMode: boolean = false
  ): Promise<WorkspaceBudgetConfig> {
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      const localBudget = await offlineStorage.getLocalBudget(workspaceId);
      if (localBudget) return localBudget;

      const defaultBudget: WorkspaceBudgetConfig = {
        id: `local-budget-${Date.now()}`,
        workspaceId,
        amount: 50000,
        mode: 'fixed',
        periodType: 'monthly',
      };
      await offlineStorage.saveLocalBudget(defaultBudget);
      return defaultBudget;
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase
      .from('workspace_budgets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load workspace budget:', error);
      throw new Error(`Failed to load workspace budget: ${error.message}`);
    }

    if (!data) throw new Error('Workspace budget settings are missing. Please contact your workspace owner.');

    return mapConfig(data);
  }

  public async saveWorkspaceBudget(
    workspaceId: string,
    payload: SaveWorkspaceBudgetPayload,
    isOfflineMode: boolean = false
  ): Promise<WorkspaceBudgetConfig> {
    const validated = validateConfig(payload);

    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      const existing = await offlineStorage.getLocalBudget(workspaceId);
      const updated: WorkspaceBudgetConfig = {
        id: existing?.id || `local-budget-${Date.now()}`,
        workspaceId,
        amount: validated.amount,
        mode: validated.mode,
        periodType: validated.periodType,
        startDate: validated.startDate,
        endDate: validated.endDate,
      };
      await offlineStorage.saveLocalBudget(updated);
      return updated;
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase.rpc('save_workspace_budget', {
      p_workspace_id: workspaceId,
      p_amount: validated.amount,
      p_mode: validated.mode,
      p_period_type: validated.periodType,
      p_start_date: validated.startDate || null,
      p_end_date: validated.endDate || null,
    });

    if (error) {
      console.error('Failed to save workspace budget:', error);
      throw new Error(`Failed to save workspace budget: ${error.message}`);
    }
    if (!data?.success) throw new Error(data?.message || 'Failed to save workspace budget.');

    return this.getWorkspaceBudget(workspaceId, false);
  }

  public async getCategories(
    workspaceId: string,
    isOfflineMode: boolean = false
  ): Promise<WorkspaceBudgetCategory[]> {
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      return offlineStorage.getLocalCategories(workspaceId);
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase
      .from('workspace_categories')
      .select('id, workspace_id, name, amount')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load workspace categories:', error);
      throw new Error(`Failed to load workspace categories: ${error.message}`);
    }

    return (data || []).map(mapCategory);
  }

  public async saveCategory(
    workspaceId: string,
    payload: SaveWorkspaceCategoryPayload,
    categoryId?: string,
    isOfflineMode: boolean = false
  ): Promise<WorkspaceBudgetCategory> {
    const validated = validateCategory(payload);

    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      const cat: WorkspaceBudgetCategory = {
        id: categoryId || `local-cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workspaceId,
        name: validated.name,
        amount: validated.amount,
      };
      await offlineStorage.saveLocalCategory(cat);
      return cat;
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase.rpc('save_workspace_category', {
      p_workspace_id: workspaceId,
      p_category_id: categoryId || null,
      p_name: validated.name,
      p_amount: validated.amount,
    });

    if (error) {
      console.error('Failed to save workspace category:', error);
      throw new Error(`Failed to save category: ${error.message}`);
    }
    if (!data?.success || !data?.category) {
      throw new Error(data?.message || 'Failed to save category.');
    }
    return mapCategory(data.category);
  }

  public async deleteCategory(
    workspaceId: string,
    categoryId: string,
    isOfflineMode: boolean = false
  ): Promise<void> {
    if (isOfflineMode || offlineStorage.isLocalWorkspace(workspaceId)) {
      await offlineStorage.deleteLocalCategory(workspaceId, categoryId);
      return;
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase.rpc('delete_workspace_category', {
      p_workspace_id: workspaceId,
      p_category_id: categoryId,
    });

    if (error) {
      console.error('Failed to delete workspace category:', error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
    if (!data?.success) throw new Error(data?.message || 'Failed to delete category.');
  }

  public async cloneCategories(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    isOfflineMode: boolean = false
  ): Promise<number> {
    if (!sourceWorkspaceId || !targetWorkspaceId || sourceWorkspaceId === targetWorkspaceId) {
      throw new Error('Choose a different source workspace.');
    }

    if (isOfflineMode || offlineStorage.isLocalWorkspace(targetWorkspaceId)) {
      const sourceCategories = await this.getCategories(sourceWorkspaceId, true);
      for (const sc of sourceCategories) {
        await this.saveCategory(targetWorkspaceId, {
          name: sc.name,
          amount: sc.amount,
        }, undefined, true);
      }
      return sourceCategories.length;
    }

    if (!supabase) throw new Error('Budget services are unavailable. Please contact support.');

    const { data, error } = await supabase.rpc('clone_workspace_categories', {
      p_source_workspace_id: sourceWorkspaceId,
      p_target_workspace_id: targetWorkspaceId,
    });

    if (error) {
      console.error('Failed to clone workspace categories:', error);
      throw new Error(`Failed to clone categories: ${error.message}`);
    }
    if (!data?.success || typeof data?.added_count !== 'number') {
      throw new Error(data?.message || 'Failed to clone categories.');
    }
    return data.added_count;
  }
}

export const budgetService = new BudgetService();
