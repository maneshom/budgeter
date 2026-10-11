import React from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { formatINR } from '../../utils/currency';

export interface SummaryCardProps {
  label: string;
  amount: number;
  icon: ComponentType<LucideProps>;
  iconVariant: 'purple' | 'orange' | 'green' | 'red';
  subtitle?: string;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'danger' | 'neutral';
    icon?: ComponentType<LucideProps>;
  };
  onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  amount,
  icon: Icon,
  iconVariant,
  subtitle,
  badge,
  onClick,
}) => {
  return (
    <div
      className="summary-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-top">
        <span className="card-label">{label}</span>
        <div className={`card-icon-pill ${iconVariant}`} aria-hidden="true">
          <Icon size={20} strokeWidth={2.2} />
        </div>
      </div>

      <div className="card-main">
        <div className="card-value">{formatINR(amount)}</div>
      </div>

      <div className="card-footer">
        {subtitle && <span>{subtitle}</span>}
        {badge && (
          <span className={`indicator-pill ${badge.variant}`}>
            {badge.icon && <badge.icon size={12} />}
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
};

