import React from 'react';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { formatINR } from '../../utils/currency';

interface BudgetProgressProps {
  totalSpent: number;
  workspaceBudget: number;
  periodLabel: string;
  spentPercentage: number;
  isOverBudget: boolean;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  totalSpent,
  workspaceBudget,
  periodLabel,
  spentPercentage,
  isOverBudget,
}) => {
  // Clamp width between 0 and 100 for visual progress bar
  const visualProgressWidth = workspaceBudget > 0
    ? Math.min(Math.max((totalSpent / workspaceBudget) * 100, 0), 100)
    : 0;

  // Determine status variant
  let statusVariant: 'safe' | 'warning' | 'danger' = 'safe';
  let barClass: 'normal' | 'warning' | 'danger' = 'normal';

  if (isOverBudget) {
    statusVariant = 'danger';
    barClass = 'danger';
  } else if (spentPercentage >= 85) {
    statusVariant = 'warning';
    barClass = 'warning';
  }

  return (
    <section className="progress-card" aria-labelledby="budget-progress-title">
      <div className="progress-header">
        <div className="progress-title-wrap">
          <TrendingUp size={20} color="var(--primary)" />
          <h2 id="budget-progress-title" className="progress-title">
            Budget progress
          </h2>
        </div>

        <div className={`progress-percent-badge ${statusVariant}`}>
          {isOverBudget ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} />
              {spentPercentage.toFixed(1)}% spent (Over Budget)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {spentPercentage < 85 && <CheckCircle2 size={14} />}
              {spentPercentage.toFixed(1)}% spent
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={Math.round(spentPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${periodLabel} budget consumed`}
      >
        <div
          className={`progress-bar-fill ${barClass}`}
          style={{ width: `${visualProgressWidth}%` }}
        />
      </div>

      {/* Metrics Row */}
      <div className="progress-metrics">
        <div className="metric-item">
          <span className="metric-label">Total Spent</span>
          <span className="metric-value">{formatINR(totalSpent)}</span>
        </div>
        <div className="metric-item" style={{ textAlign: 'right' }}>
          <span className="metric-label">Workspace Budget</span>
          <span className="metric-value">{formatINR(workspaceBudget)}</span>
        </div>
      </div>
    </section>
  );
};
