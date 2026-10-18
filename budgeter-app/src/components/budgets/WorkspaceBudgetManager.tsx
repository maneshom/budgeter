import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Copy,
  Loader2,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import type {
  BudgetPeriodType,
  SaveWorkspaceBudgetPayload,
  WorkspaceBudgetCategory,
  WorkspaceBudgetConfig,
  WorkspaceBudgetMode,
  Workspace,
} from '../../types/expense';
import { budgetService, getWorkspaceBudgetPeriod } from '../../services/budgetService';
import { formatINR } from '../../utils/currency';
import type { Transaction } from '../../types/expense';

interface WorkspaceBudgetManagerProps {
  workspaceId: string;
  workspaces: Workspace[];
  transactions: Transaction[];
  canManage: boolean;
  onAddToast: (text: string, type?: 'success' | 'danger') => void;
  onBudgetUpdated: () => void;
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const WorkspaceBudgetManager: React.FC<WorkspaceBudgetManagerProps> = ({
  workspaceId,
  workspaces,
  transactions,
  canManage,
  onAddToast,
  onBudgetUpdated,
}) => {
  const [config, setConfig] = useState<WorkspaceBudgetConfig | null>(null);
  const [categories, setCategories] = useState<WorkspaceBudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isCloningCategories, setIsCloningCategories] = useState(false);
  const [sourceWorkspaceId, setSourceWorkspaceId] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryAmount, setCategoryAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sourceWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.id !== workspaceId),
    [workspaces, workspaceId]
  );

  const load = async () => {
    try {
      setIsLoading(true);
      const [workspaceBudget, workspaceCategories] = await Promise.all([
        budgetService.getWorkspaceBudget(workspaceId),
        budgetService.getCategories(workspaceId),
      ]);
      setConfig(workspaceBudget);
      setCategories(workspaceCategories);
    } catch (err) {
      console.error('Failed to load workspace budget settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspace budget.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [workspaceId]);

  useEffect(() => {
    if (!sourceWorkspaces.some((workspace) => workspace.id === sourceWorkspaceId)) {
      setSourceWorkspaceId(sourceWorkspaces[0]?.id || '');
    }
  }, [sourceWorkspaces, sourceWorkspaceId]);

  const categoryTotal = useMemo(
    () => categories.reduce((total, category) => total + category.amount, 0),
    [categories]
  );

  const currentPeriod = useMemo(
    () => config ? getWorkspaceBudgetPeriod(config) : null,
    [config]
  );

  const currentTransactions = useMemo(() => {
    if (!currentPeriod) return [];
    return transactions.filter(
      (transaction) =>
        transaction.date >= currentPeriod.startDate &&
        transaction.date <= currentPeriod.endDate
    );
  }, [currentPeriod, transactions]);

  const computedAmount = config?.mode === 'category_total' ? categoryTotal : config?.amount || 0;

  const handleSaveConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config) return;
    setError(null);
    setIsSavingConfig(true);
    const payload: SaveWorkspaceBudgetPayload = {
      amount: Number(config.amount),
      mode: config.mode,
      periodType: config.periodType,
      startDate: config.startDate,
      endDate: config.endDate,
    };
    try {
      const updated = await budgetService.saveWorkspaceBudget(workspaceId, payload);
      setConfig(updated);
      onBudgetUpdated();
      onAddToast('Workspace budget settings saved');
    } catch (err) {
      console.error('Failed to save workspace budget settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save workspace budget.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryAmount('');
  };

  const handleSaveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsedAmount = Number(categoryAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Category allocation must be zero or more.');
      return;
    }
    setIsSavingCategory(true);
    try {
      const saved = await budgetService.saveCategory(
        workspaceId,
        { name: categoryName, amount: parsedAmount },
        editingCategoryId || undefined
      );
      const nextCategories = editingCategoryId
        ? categories.map((category) => category.id === editingCategoryId ? saved : category)
        : [...categories, saved].sort((left, right) => left.name.localeCompare(right.name));
      setCategories(nextCategories);
      setConfig((current) =>
        current?.mode === 'category_total'
          ? {
              ...current,
              amount: nextCategories.reduce((total, category) => total + category.amount, 0),
            }
          : current
      );
      resetCategoryForm();
      onBudgetUpdated();
      onAddToast(editingCategoryId ? 'Category allocation updated' : 'Category added');
    } catch (err) {
      console.error('Failed to save category allocation:', err);
      setError(err instanceof Error ? err.message : 'Failed to save category allocation.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: WorkspaceBudgetCategory) => {
    if (transactions.some((transaction) => transaction.category === category.name)) {
      onAddToast('This category is used by existing expenses and cannot be deleted.', 'danger');
      return;
    }
    if (!window.confirm(`Delete the "${category.name}" category and its allocation?`)) return;
    try {
      await budgetService.deleteCategory(workspaceId, category.id);
      const nextCategories = categories.filter((item) => item.id !== category.id);
      setCategories(nextCategories);
      setConfig((current) =>
        current?.mode === 'category_total'
          ? {
              ...current,
              amount: nextCategories.reduce((total, item) => total + item.amount, 0),
            }
          : current
      );
      onBudgetUpdated();
      onAddToast(`Deleted "${category.name}"`);
    } catch (err) {
      console.error('Failed to delete category:', err);
      onAddToast(err instanceof Error ? err.message : 'Failed to delete category', 'danger');
    }
  };

  const handleCloneCategories = async () => {
    if (!sourceWorkspaceId || isCloningCategories) return;
    setError(null);
    setIsCloningCategories(true);
    try {
      const addedCount = await budgetService.cloneCategories(sourceWorkspaceId, workspaceId);
      const [updatedConfig, updatedCategories] = await Promise.all([
        budgetService.getWorkspaceBudget(workspaceId),
        budgetService.getCategories(workspaceId),
      ]);
      setConfig(updatedConfig);
      setCategories(updatedCategories);
      onBudgetUpdated();
      onAddToast(
        addedCount > 0
          ? `Added ${addedCount} categor${addedCount === 1 ? 'y' : 'ies'} with zero allocation. Existing categories were left unchanged.`
          : 'No new categories to add. Matching categories were left unchanged.'
      );
    } catch (err) {
      console.error('Failed to clone workspace categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to clone categories.');
    } finally {
      setIsCloningCategories(false);
    }
  };

  if (isLoading || !config) {
    return (
      <section className="settings-card">
        <div className="budget-empty-state">
          <Loader2 size={20} className="animate-spin" />
          {isLoading ? 'Loading workspace budget...' : error || 'Workspace budget is unavailable.'}
        </div>
      </section>
    );
  }

  return (
    <section className="settings-card" aria-labelledby="workspace-budget-heading">
      <div className="settings-card-header">
        <div className="section-title-wrap">
          <Wallet size={20} color="var(--primary)" />
          <div>
            <h3 id="workspace-budget-heading" className="settings-section-title">Workspace Budget</h3>
            <p className="settings-section-desc">
              Set one workspace limit and category allocations for the selected period.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="auth-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form className="budget-form" onSubmit={handleSaveConfig}>
        <h4>Workspace amount and period</h4>
        <div className="budget-form-grid">
          <label className="form-field">
            <span className="form-label">Workspace amount mode</span>
            <select
              className="form-select"
              value={config.mode}
              onChange={(event) =>
                setConfig({ ...config, mode: event.target.value as WorkspaceBudgetMode })
              }
              disabled={!canManage || isSavingConfig}
            >
              <option value="fixed">Default value — fixed workspace limit</option>
              <option value="category_total">Increase with category values — total is their sum</option>
              <option value="capped">Keep categories within the workspace limit</option>
            </select>
          </label>
          {config.mode !== 'category_total' ? (
            <label className="form-field">
              <span className="form-label">Workspace limit amount</span>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={config.amount}
                onChange={(event) => setConfig({ ...config, amount: Number(event.target.value) })}
                disabled={!canManage || isSavingConfig}
                required
              />
            </label>
          ) : (
            <div className="form-field">
              <span className="form-label">Calculated workspace amount</span>
              <output className="form-input budget-readonly-amount">{formatINR(categoryTotal)}</output>
            </div>
          )}
          <label className="form-field">
            <span className="form-label">Budget period</span>
            <select
              className="form-select"
              value={config.periodType}
              onChange={(event) =>
                setConfig({ ...config, periodType: event.target.value as BudgetPeriodType })
              }
              disabled={!canManage || isSavingConfig}
            >
              <option value="monthly">Monthly (calendar month)</option>
              <option value="yearly">Yearly (calendar year)</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
          {config.periodType === 'custom' && (
            <>
              <label className="form-field">
                <span className="form-label">Start date</span>
                <input
                  className="form-input"
                  type="date"
                  value={config.startDate || ''}
                  onChange={(event) => setConfig({ ...config, startDate: event.target.value })}
                  disabled={!canManage || isSavingConfig}
                  required
                />
              </label>
              <label className="form-field">
                <span className="form-label">End date</span>
                <input
                  className="form-input"
                  type="date"
                  min={config.startDate || undefined}
                  value={config.endDate || ''}
                  onChange={(event) => setConfig({ ...config, endDate: event.target.value })}
                  disabled={!canManage || isSavingConfig}
                  required
                />
              </label>
            </>
          )}
        </div>
        {canManage && (
          <div className="budget-form-actions">
            <button className="btn-primary" type="submit" disabled={isSavingConfig}>
              {isSavingConfig && <Loader2 size={16} className="animate-spin" />}
              Save Workspace Budget
            </button>
          </div>
        )}
        <p className="settings-section-desc">
          {config.mode === 'fixed' && 'Category allocations are tracked individually and do not change this fixed workspace limit.'}
          {config.mode === 'category_total' && 'The workspace amount automatically equals the sum of all category allocations.'}
          {config.mode === 'capped' && 'Category allocations are constrained so their combined amount cannot exceed the workspace limit.'}
        </p>
      </form>

      <div className="settings-card-header">
        <div>
          <h4 className="settings-section-title">Workspace Categories</h4>
          <p className="settings-section-desc">Create categories and set their allocation for this workspace.</p>
        </div>
        <strong>{formatINR(computedAmount)} workspace total</strong>
      </div>

      {canManage && sourceWorkspaces.length > 0 && (
        <div className="budget-form">
          <h4>Clone categories from another workspace</h4>
          <p className="settings-section-desc">
            New categories are added with zero allocation. Existing categories and allocations are unchanged.
          </p>
          <div className="budget-form-grid">
            <label className="form-field">
              <span className="form-label">Source workspace</span>
              <select
                className="form-select"
                value={sourceWorkspaceId}
                onChange={(event) => setSourceWorkspaceId(event.target.value)}
                disabled={isCloningCategories}
              >
                {sourceWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
            </label>
            <div className="form-field">
              <span className="form-label">Action</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleCloneCategories()}
                disabled={isCloningCategories || !sourceWorkspaceId}
              >
                {isCloningCategories
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Copy size={16} />}
                <span>{isCloningCategories ? 'Cloning categories...' : 'Clone categories'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <form className="budget-form" onSubmit={handleSaveCategory}>
          <h4>{editingCategoryId ? 'Edit category allocation' : 'Add workspace category'}</h4>
          <div className="budget-form-grid">
            <label className="form-field">
              <span className="form-label">Category name</span>
              <input
                className="form-input"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                maxLength={60}
                placeholder="e.g. Pet care"
                disabled={isSavingCategory || editingCategoryId !== null}
                required
              />
            </label>
            <label className="form-field">
              <span className="form-label">Category amount</span>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={categoryAmount}
                onChange={(event) => setCategoryAmount(event.target.value)}
                placeholder="0"
                disabled={isSavingCategory}
                required
              />
            </label>
          </div>
          <div className="budget-form-actions">
            {editingCategoryId && (
              <button className="btn-secondary" type="button" onClick={resetCategoryForm}>
                Cancel edit
              </button>
            )}
            <button className="btn-primary" type="submit" disabled={isSavingCategory}>
              {isSavingCategory && <Loader2 size={16} className="animate-spin" />}
              {editingCategoryId ? 'Save Allocation' : 'Add Category'}
            </button>
          </div>
        </form>
      )}

      <div className="budget-list">
        {categories.map((category) => {
          const spent = currentTransactions
            .filter((transaction) => transaction.category === category.name)
            .reduce((total, transaction) => total + transaction.amount, 0);
          const percentage = category.amount > 0
            ? Math.min((spent / category.amount) * 100, 100)
            : 0;
          const isOverCap = config.mode === 'capped' && categoryTotal > config.amount;
          const canDelete = !transactions.some((transaction) => transaction.category === category.name);
          return (
            <article className="budget-list-item" key={category.id}>
              <div className="budget-item-heading">
                <div>
                  <h4>{category.name}</h4>
                  <span className="budget-period-label">
                    <CalendarDays size={13} />
                    {config.periodType === 'custom' && currentPeriod
                      ? `${formatDate(currentPeriod.startDate)} – ${formatDate(currentPeriod.endDate)}`
                      : config.periodType === 'yearly' ? 'Yearly allocation' : 'Monthly allocation'}
                  </span>
                </div>
                {canManage && (
                  <div className="budget-item-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label={`Edit allocation for ${category.name}`}
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setCategoryName(category.name);
                        setCategoryAmount(String(category.amount));
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon danger"
                      aria-label={`Delete ${category.name}`}
                      title={canDelete ? 'Delete category' : 'Category has existing expenses'}
                      disabled={!canDelete}
                      onClick={() => void handleDeleteCategory(category)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="budget-amount-line">
                <span>{formatINR(spent)} spent</span>
                <span>{formatINR(category.amount)} allocated</span>
              </div>
              <div
                className="budget-meter"
                role="progressbar"
                aria-label={`${category.name} allocation used`}
                aria-valuenow={Math.min(spent, category.amount)}
                aria-valuemin={0}
                aria-valuemax={category.amount}
              >
                <div
                  className={spent > category.amount || isOverCap ? 'over' : ''}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
