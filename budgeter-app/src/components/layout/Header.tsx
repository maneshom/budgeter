import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { PwaInstallButton } from './PwaInstallButton';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenAddExpense: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Dashboard',
  subtitle = "Here's what's happening with your money.",
  onOpenAddExpense,
  onToggleMobileMenu,
}) => {
  return (
    <header className="app-header">
      <div className="header-title-group">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="header-text">
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="header-actions">
        <PwaInstallButton />
        <button
          type="button"
          className="btn-primary"
          onClick={onOpenAddExpense}
          aria-label="Add new expense"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Add expense</span>
        </button>
      </div>
    </header>
  );
};
