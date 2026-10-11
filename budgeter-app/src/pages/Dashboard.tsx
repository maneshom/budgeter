import React from 'react';
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { DashboardSummary, Transaction } from '../types/expense';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { BudgetProgress } from '../components/dashboard/BudgetProgress';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { getMonthlyOverviewTitle, getCurrentMonthName, getCurrentYear } from '../utils/date';

interface DashboardProps {
  summary: DashboardSummary;
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddExpense: () => void;
  onViewAllTransactions: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  transactions,
  onDeleteTransaction,
  onOpenAddExpense,
  onViewAllTransactions,
}) => {
  const currentMonth = getCurrentMonthName();
  const currentYear = getCurrentYear();
  const overviewTitle = getMonthlyOverviewTitle();

  return (
    <div className="page-container">
      {/* Monthly Overview Header */}
      <section className="overview-header" aria-label="Monthly Financial Overview">
        <div className="overview-title-group">
          <h2 className="overview-title">{overviewTitle}</h2>
          <p className="overview-subtitle">
            Track your household finances in one place.
          </p>
        </div>

        <div className="overview-badge" aria-label={`Current month is ${currentMonth} ${currentYear}`}>
          <Calendar size={14} />
          <span>
            {currentMonth} {currentYear}
          </span>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="summary-grid" aria-label="Key Financial Metrics">
        {/* Card 1: Monthly Budget */}
        <SummaryCard
          label="Monthly Budget"
          amount={summary.monthlyBudget}
          icon={Wallet}
          iconVariant="purple"
          subtitle="Planned for this month"
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
          subtitle={summary.isOverBudget ? 'Exceeded monthly budget' : 'Remaining to spend'}
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
        monthlyBudget={summary.monthlyBudget}
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

