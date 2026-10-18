import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CalendarDays, Loader2, PieChart, Wallet } from 'lucide-react';
import { budgetService, getWorkspaceBudgetPeriod } from '../services/budgetService';
import { expenseService } from '../services/expenseService';
import type { Transaction, Workspace, WorkspaceBudgetCategory, WorkspaceBudgetConfig } from '../types/expense';
import { formatINR } from '../utils/currency';

interface ReportsPageProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

interface ReportData {
  transactions: Transaction[];
  budget: WorkspaceBudgetConfig;
  categories: WorkspaceBudgetCategory[];
}

interface MonthlySpend {
  key: string;
  label: string;
  amount: number;
}

const getMonthlyTrend = (transactions: Transaction[], now = new Date()): MonthlySpend[] =>
  Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    return {
      key,
      label: monthStart.toLocaleDateString('en-IN', { month: 'short' }),
      amount: transactions
        .filter((transaction) => transaction.date.startsWith(key))
        .reduce((total, transaction) => total + transaction.amount, 0),
    };
  });

export const ReportsPage: React.FC<ReportsPageProps> = ({ workspaces, activeWorkspaceId }) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(activeWorkspaceId);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, selectedWorkspaceId, workspaces]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    setReportData(null);

    Promise.all([
      expenseService.getTransactions(selectedWorkspaceId),
      budgetService.getWorkspaceBudget(selectedWorkspaceId),
      budgetService.getCategories(selectedWorkspaceId),
    ])
      .then(([transactions, budget, categories]) => {
        if (isCurrent) setReportData({ transactions, budget, categories });
      })
      .catch((err: unknown) => {
        console.error('Failed to load workspace report:', err);
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace report.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedWorkspaceId]);

  const period = useMemo(
    () => reportData ? getWorkspaceBudgetPeriod(reportData.budget) : null,
    [reportData]
  );

  const periodTransactions = useMemo(
    () => reportData && period
      ? reportData.transactions.filter(
          (transaction) => transaction.date >= period.startDate && transaction.date <= period.endDate
        )
      : [],
    [period, reportData]
  );

  const totalSpent = periodTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalBudget = reportData?.budget.mode === 'category_total'
    ? reportData.categories.reduce((sum, category) => sum + category.amount, 0)
    : reportData?.budget.amount || 0;
  const remaining = totalBudget - totalSpent;
  const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const monthlyTrend = useMemo(
    () => reportData ? getMonthlyTrend(reportData.transactions) : [],
    [reportData]
  );
  const maxMonthlySpend = Math.max(1, ...monthlyTrend.map((month) => month.amount));

  const categorySpending = useMemo(() => {
    if (!reportData) return [];
    const totals = new Map<string, number>();
    periodTransactions.forEach((transaction) => {
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
    });
    return Array.from(totals, ([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);
  }, [periodTransactions, reportData]);
  const maxCategorySpend = Math.max(1, ...categorySpending.map((category) => category.amount));
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  const periodText = reportData && period
    ? reportData.budget.periodType === 'monthly'
      ? new Date(`${period.startDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : reportData.budget.periodType === 'yearly'
        ? period.startDate.slice(0, 4)
        : `${period.startDate} – ${period.endDate}`
    : '';

  return (
    <div className="page-container reports-page">
      <section className="overview-header">
        <div className="overview-title-group">
          <span className="overview-badge">Workspace analytics</span>
          <h2 className="overview-title">Reports & insights</h2>
          <p className="overview-subtitle">
            Review spending, category allocations, and budget progress by workspace.
          </p>
        </div>
        <label className="reports-workspace-picker">
          <span className="form-label">Workspace</span>
          <select
            className="form-select"
            value={selectedWorkspaceId}
            onChange={(event) => setSelectedWorkspaceId(event.target.value)}
            aria-label="Choose workspace for reports"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div className="reports-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="reports-loading" role="status">
          <Loader2 size={22} className="animate-spin" />
          <span>Loading {selectedWorkspace?.name || 'workspace'} reports...</span>
        </div>
      ) : reportData && period ? (
        <>
          <div className="reports-period-caption">
            <CalendarDays size={16} />
            <span>{selectedWorkspace?.name} · {periodText}</span>
          </div>

          <section className="reports-kpi-grid" aria-label="Workspace financial summary">
            <article className="reports-kpi-card">
              <span className="reports-kpi-label"><Wallet size={16} /> Spent this period</span>
              <strong>{formatINR(totalSpent)}</strong>
              <span>{periodTransactions.length} expenses recorded</span>
            </article>
            <article className="reports-kpi-card">
              <span className="reports-kpi-label"><BarChart3 size={16} /> Workspace budget</span>
              <strong>{formatINR(totalBudget)}</strong>
              <span>{spentPercentage.toFixed(1)}% used</span>
            </article>
            <article className={`reports-kpi-card ${remaining < 0 ? 'is-over-budget' : ''}`}>
              <span className="reports-kpi-label"><PieChart size={16} /> {remaining < 0 ? 'Over budget' : 'Remaining'}</span>
              <strong>{formatINR(Math.abs(remaining))}</strong>
              <span>{remaining < 0 ? 'Above the workspace limit' : 'Available in this period'}</span>
            </article>
          </section>

          <section className="reports-chart-grid">
            <article className="reports-chart-card">
              <div className="reports-chart-heading">
                <div>
                  <h3>Spending trend</h3>
                  <p>Monthly expenses over the last six months</p>
                </div>
                <BarChart3 size={19} />
              </div>
              <div className="reports-trend-chart" role="img" aria-label="Monthly spending trend for the last six months">
                {monthlyTrend.map((month) => (
                  <div className="reports-trend-column" key={month.key} title={`${month.label}: ${formatINR(month.amount)}`}>
                    <span className="reports-trend-value">{month.amount > 0 ? formatINR(month.amount) : '—'}</span>
                    <div className="reports-trend-track">
                      <div
                        className="reports-trend-bar"
                        style={{ height: `${month.amount > 0 ? Math.max((month.amount / maxMonthlySpend) * 100, 4) : 0}%` }}
                      />
                    </div>
                    <span className="reports-trend-label">{month.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="reports-chart-card">
              <div className="reports-chart-heading">
                <div>
                  <h3>Budget progress</h3>
                  <p>Spending compared with the workspace budget</p>
                </div>
                <Wallet size={19} />
              </div>
              <div className="reports-budget-summary">
                <strong>{formatINR(totalSpent)}</strong>
                <span>of {formatINR(totalBudget)}</span>
              </div>
              <div
                className="reports-budget-track"
                role="progressbar"
                aria-label="Workspace budget consumed"
                aria-valuenow={Math.round(Math.min(spentPercentage, 100))}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`reports-budget-fill ${spentPercentage >= 100 ? 'is-over' : ''}`}
                  style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                />
              </div>
              <div className="reports-budget-footer">
                <span>{spentPercentage.toFixed(1)}% used</span>
                <span>{remaining < 0 ? `${formatINR(Math.abs(remaining))} over` : `${formatINR(remaining)} left`}</span>
              </div>
              <p className="reports-budget-note">
                {reportData.budget.mode === 'fixed'
                  ? 'Fixed workspace limit'
                  : reportData.budget.mode === 'category_total'
                    ? 'Total based on category allocations'
                    : 'Category allocations capped by workspace limit'}
              </p>
            </article>
          </section>

          <section className="reports-chart-card reports-category-card">
            <div className="reports-chart-heading">
              <div>
                <h3>Spending by category</h3>
                <p>Category totals for {periodText}</p>
              </div>
              <PieChart size={19} />
            </div>
            {categorySpending.length > 0 ? (
              <div className="reports-category-list">
                {categorySpending.map((category) => {
                  const allocation = reportData.categories.find((item) => item.name === category.name)?.amount;
                  return (
                    <div className="reports-category-row" key={category.name}>
                      <div className="reports-category-label">
                        <span>{category.name}</span>
                        <strong>{formatINR(category.amount)}</strong>
                      </div>
                      <div
                        className="reports-category-track"
                        role="img"
                        aria-label={`${category.name}: ${formatINR(category.amount)} spent${allocation === undefined ? '' : ` of ${formatINR(allocation)} allocated`}`}
                      >
                        <div
                          className="reports-category-bar"
                          style={{ width: `${Math.max((category.amount / maxCategorySpend) * 100, 2)}%` }}
                        />
                      </div>
                      {allocation !== undefined && (
                        <span className="reports-category-allocation">Allocation: {formatINR(allocation)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="reports-empty-state">
                <PieChart size={24} />
                <p>No expenses recorded in this budget period.</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};
