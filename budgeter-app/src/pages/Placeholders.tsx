import React, { useState } from 'react';
import {
  BarChart3,
  Settings,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Users2,
  PieChart,
  Search,
  Filter,
} from 'lucide-react';
import type { Transaction, ExpenseCategory } from '../types/expense';
import { EXPENSE_CATEGORIES } from '../types/expense';
import { TransactionRow } from '../components/dashboard/TransactionRow';
import { formatINR } from '../utils/currency';

interface TransactionsPageProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddExpense: () => void;
  onBackToDashboard: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
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
          <h2 className="overview-title">Household Transaction History</h2>
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
            {EXPENSE_CATEGORIES.map((cat: ExpenseCategory) => (
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

export const ReportsPlaceholder: React.FC<{ onBackToDashboard: () => void }> = ({
  onBackToDashboard,
}) => {
  return (
    <div className="page-container">
      <div className="placeholder-card">
        <span className="placeholder-badge">Planned Feature • Phase 2</span>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <BarChart3 size={24} />
        </div>
        <h2 className="placeholder-title">Visual Reports & Analytics</h2>
        <p className="placeholder-desc">
          Category breakdowns, monthly spending trends, and comparative charts will be enabled in Phase 2 alongside the Supabase backend integration.
        </p>

        <div className="feature-checklist">
          <div className="feature-item">
            <PieChart size={18} className="feature-icon" />
            <span>Category-wise breakdown charts and percentage distributions</span>
          </div>
          <div className="feature-item">
            <Sparkles size={18} className="feature-icon" />
            <span>Month-over-month household budget variance analysis</span>
          </div>
          <div className="feature-item">
            <Users2 size={18} className="feature-icon" />
            <span>Member-wise spending attribution for shared families</span>
          </div>
        </div>

        <button type="button" className="btn-primary" onClick={onBackToDashboard}>
          Return to Dashboard
        </button>
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
        <h2 className="placeholder-title">Family & Workspace Settings</h2>
        <p className="placeholder-desc">
          Manage family members, invite co-managers, configure monthly budget limits, and set up Supabase Row Level Security (RLS) policies.
        </p>

        <div className="feature-checklist">
          <div className="feature-item">
            <ShieldCheck size={18} className="feature-icon" />
            <span>Role-based access controls (Family Admin, Member, Child)</span>
          </div>
          <div className="feature-item">
            <Users2 size={18} className="feature-icon" />
            <span>Invite family members via email and link WhatsApp notifications</span>
          </div>
          <div className="feature-item">
            <Sparkles size={18} className="feature-icon" />
            <span>Supabase Cloud Sync and multi-device real-time updates</span>
          </div>
        </div>

        <button type="button" className="btn-primary" onClick={onBackToDashboard}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

