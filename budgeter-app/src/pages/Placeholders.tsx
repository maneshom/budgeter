import React, { useState } from 'react';
import {
  Settings,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Users2,
  Search,
  Filter,
} from 'lucide-react';
import type { Transaction } from '../types/expense';
import { TransactionRow } from '../components/dashboard/TransactionRow';
import { formatINR } from '../utils/currency';

interface TransactionsPageProps {
  transactions: Transaction[];
  categories: string[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddExpense: () => void;
  onBackToDashboard: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  categories,
  onDeleteTransaction,
  onOpenAddExpense,
  onBackToDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = transactions.filter((tx) => {
    const matchesSearch = tx.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tx.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalFilteredAmount = filtered.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="page-container">
      <div className="overview-header">
        <div className="overview-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onBackToDashboard}
              style={{ padding: '6px 10px' }}
            >
              <ArrowLeft size={16} />
              <span>Dashboard</span>
            </button>
            <span className="overview-badge">All Transactions</span>
          </div>
          <h2 className="overview-title">Workspace Transaction History</h2>
          <p className="overview-subtitle">
            Showing {filtered.length} of {transactions.length} total records • Filtered sum: {formatINR(totalFilteredAmount)}
          </p>
        </div>

        <button type="button" className="btn-primary" onClick={onOpenAddExpense}>
          + Add expense
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-card)',
          padding: 16,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ flex: 1, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search expense name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="var(--text-tertiary)" />
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="transactions-card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No transactions match your search filter</p>
            <p className="empty-desc">Try clearing the search query or selecting another category.</p>
          </div>
        ) : (
          <div className="transactions-list">
            {filtered.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onDelete={onDeleteTransaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsPlaceholder: React.FC<{ onBackToDashboard: () => void }> = ({
  onBackToDashboard,
}) => {
  return (
    <div className="page-container">
      <div className="placeholder-card">
        <span className="placeholder-badge">Planned Feature • Phase 2</span>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Settings size={24} />
        </div>
        <h2 className="placeholder-title">Workspace Settings</h2>
        <p className="placeholder-desc">
          Manage workspace members, invite co-managers, and configure budgets and categories.
        </p>

        <div className="feature-checklist">
          <div className="feature-item">
            <ShieldCheck size={18} className="feature-icon" />
            <span>Role-based access controls for workspace members</span>
          </div>
          <div className="feature-item">
            <Users2 size={18} className="feature-icon" />
            <span>Invite people to collaborate on a workspace budget</span>
          </div>
          <div className="feature-item">
            <Sparkles size={18} className="feature-icon" />
            <span>Secure cloud data access across your devices</span>
          </div>
        </div>

        <button type="button" className="btn-primary" onClick={onBackToDashboard}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};
