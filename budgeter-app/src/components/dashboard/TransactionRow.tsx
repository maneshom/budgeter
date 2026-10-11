import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Transaction } from '../../types/expense';
import { getCategoryInfo } from '../../utils/categoryMetadata';
import { formatExpenseAmount } from '../../utils/currency';
import { formatTransactionDate } from '../../utils/date';

interface TransactionRowProps {
  transaction: Transaction;
  onDelete?: (id: string) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onDelete,
}) => {
  const categoryInfo = getCategoryInfo(transaction.category);
  const Icon = categoryInfo.icon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(transaction.id);
    }
  };

  return (
    <div className="transaction-row">
      <div className="row-left">
        <div
          className="row-category-icon"
          style={{
            backgroundColor: categoryInfo.bgColor,
            color: categoryInfo.textColor,
            borderColor: categoryInfo.borderColor,
          }}
          aria-hidden="true"
        >
          <Icon size={20} />
        </div>

        <div className="row-details">
          <span className="row-name" title={transaction.name}>
            {transaction.name}
          </span>
          <div className="row-meta">
            <span
              className="row-category-badge"
              style={{
                backgroundColor: categoryInfo.bgColor,
                color: categoryInfo.textColor,
              }}
            >
              {transaction.category}
            </span>
            <span className="row-dot-separator">•</span>
            <span>{formatTransactionDate(transaction.date)}</span>
            {transaction.createdBy && (
              <>
                <span className="row-dot-separator">•</span>
                <span>{transaction.createdBy}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="row-right">
        <span className="row-amount">
          {formatExpenseAmount(transaction.amount)}
        </span>
        {onDelete && (
          <button
            type="button"
            className="row-delete-btn"
            onClick={handleDelete}
            title={`Delete ${transaction.name}`}
            aria-label={`Delete expense: ${transaction.name}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

