import React, { useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import type { Transaction } from '../../types/expense';
import { TransactionRow } from './TransactionRow';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddExpense: () => void;
  onViewAllClick?: () => void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  onDeleteTransaction,
  onOpenAddExpense,
  onViewAllClick,
}) => {
  const [showAll, setShowAll] = useState(false);

  const displayedTransactions = showAll ? transactions : transactions.slice(0, 5);
  const totalCount = transactions.length;

  const handleToggleViewAll = () => {
    if (onViewAllClick) {
      onViewAllClick();
    } else {
      setShowAll((prev) => !prev);
    }
  };

  return (
    <section className="transactions-section" aria-labelledby="recent-tx-heading">
      <div className="section-header">
        <div className="section-title-wrap">
          <h2 id="recent-tx-heading" className="section-title">
            Recent Transactions
          </h2>
          <span className="count-pill">
            {totalCount} {totalCount === 1 ? 'record' : 'records'}
          </span>
        </div>

        {totalCount > 5 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleToggleViewAll}
            aria-label={showAll ? 'Show fewer transactions' : 'View all transactions'}
          >
            {showAll ? 'Show recent 5' : `View all (${totalCount})`}
          </button>
        )}
      </div>

      <div className="transactions-card">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <Receipt className="empty-icon" />
            <h3 className="empty-title">No transactions yet</h3>
            <p className="empty-desc">
              Get started by logging your first family expense for this month.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 8 }}
              onClick={onOpenAddExpense}
            >
              <Plus size={16} />
              <span>Add first expense</span>
            </button>
          </div>
        ) : (
          <div className="transactions-list">
            {displayedTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onDelete={onDeleteTransaction}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

