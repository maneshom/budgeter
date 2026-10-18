import React from 'react';
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { DashboardSummary, Transaction, WorkspaceBudgetConfig } from '../types/expense';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { BudgetProgress } from '../components/dashboard/BudgetProgress';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { getMonthlyOverviewTitle, getCurrentMonthName, getCurrentYear } from '../utils/date';

interface DashboardProps {
  summary: DashboardSummary;
  budgetConfig: WorkspaceBudgetConfig | null;
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddExpense: () => void;
  onViewAllTransactions: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  budgetConfig,
  transactions,
  onDeleteTransaction,
  onOpenAddExpense,
  onViewAllTransactions,
}) => {
  const currentMonth = getCurrentMonthName();
  const currentYear = getCurrentYear();
  const periodLabel = budgetConfig?.periodType === 'yearly'
    ? `Yearly Overview ${currentYear}`
    : budgetConfig?.periodType === 'custom'
      ? 'Custom Period Overview'
      : getMonthlyOverviewTitle();
  const budgetPeriodLabel = budgetConfig?.periodType === 'yearly'
    ? 'Planned for this year'
    : budgetConfig?.periodType === 'custom'
      ? 'Planned for this custom period'
      : 'Planned for this month';

  return (
    <div className="page-container">
      {/* Monthly Overview Header */}
      <section className="overview-header" aria-label="Workspace Budget Overview">
        <div className="overview-title-group">
          <h2 className="overview-title">{periodLabel}</h2>
          <p className="overview-subtitle">
            Track your household finances in one place.
          </p>
        </div>

        <div className="overview-badge" aria-label={`Budget period: ${budgetPeriodLabel}`}>
          <Calendar size={14} />
          <span>
            {budgetConfig?.periodType === 'yearly'
              ? currentYear
              : budgetConfig?.periodType === 'custom' && budgetConfig.startDate && budgetConfig.endDate
                ? `${budgetConfig.startDate} – ${budgetConfig.endDate}`
                : `${currentMonth} ${currentYear}`}
          </span>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="summary-grid" aria-label="Key Financial Metrics">
        {/* Card 1: Workspace Budget */}
        <SummaryCard
          label="Workspace Budget"
          amount={summary.workspaceBudget}
          icon={Wallet}
          iconVariant="purple"
          subtitle={budgetPeriodLabel}
          badge={{
            text: 'Target set',
            variant: 'neutral',
          }}
        />

        {/* Card 2: Total Spent */}
        <SummaryCard
          label="Total Spent"
          amount={summary.totalSpent}
          icon={TrendingUp}
          iconVariant="orange"
          subtitle={`${summary.transactionCount} expenses recorded`}
          badge={{
            text: `${summary.spentPercentage.toFixed(1)}% of budget`,
            variant: summary.isOverBudget ? 'danger' : summary.spentPercentage >= 85 ? 'warning' : 'neutral',
          }}
        />

        {/* Card 3: Remaining Balance */}
        <SummaryCard
          label="Remaining Balance"
          amount={summary.remainingBalance}
          icon={PiggyBank}
          iconVariant={summary.isOverBudget ? 'red' : 'green'}
          subtitle={summary.isOverBudget ? 'Exceeded workspace budget' : 'Remaining to spend'}
          badge={{
            text: summary.isOverBudget ? 'Over budget' : 'Within budget',
            variant: summary.isOverBudget ? 'danger' : 'success',
            icon: summary.isOverBudget ? AlertCircle : CheckCircle2,
          }}
        />
      </section>

      {/* Budget Progress */}
      <BudgetProgress
        totalSpent={summary.totalSpent}
        workspaceBudget={summary.workspaceBudget}
        periodLabel={budgetPeriodLabel}
        spentPercentage={summary.spentPercentage}
        isOverBudget={summary.isOverBudget}
      />

      {/* Recent Transactions */}
      <RecentTransactions
        transactions={transactions}
        onDeleteTransaction={onDeleteTransaction}
        onOpenAddExpense={onOpenAddExpense}
        onViewAllClick={onViewAllTransactions}
      />
    </div>
  );
};
