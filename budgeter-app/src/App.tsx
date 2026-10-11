import { useState, useMemo, useCallback, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import {
  TransactionsPage,
  ReportsPlaceholder,
  SettingsPlaceholder,
} from './pages/Placeholders';
import { AddExpenseModal } from './components/expenses/AddExpenseModal';
import { Toast } from './components/common/Toast';
import type { ToastMessage } from './components/common/Toast';
import { expenseService } from './services/expenseService';
import type { NewExpensePayload, Transaction, MonthlyBudget, Workspace } from './types/expense';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<MonthlyBudget>(() => expenseService.getInitialBudgetSync());
  const [workspace, setWorkspace] = useState<Workspace>(() => expenseService.getWorkspaceSync());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentUser = expenseService.getCurrentUser();
  const isCloudConnected = expenseService.isCloudConnected();

  // Load workspace, transactions, and budget asynchronously from Supabase or local service
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ws, txs, bgt] = await Promise.all([
        expenseService.getWorkspace(),
        expenseService.getTransactions(),
        expenseService.getMonthlyBudget(),
      ]);
      setWorkspace(ws);
      setTransactions(txs);
      setBudget(bgt);
    } catch (err) {
      console.error('Failed to load expense data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic dashboard summary calculation from underlying data
  const summary = useMemo(() => {
    return expenseService.calculateSummary(transactions, budget.amount);
  }, [transactions, budget.amount]);

  const addToast = useCallback((text: string, type: 'success' | 'danger' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAddExpense = useCallback(
    async (payload: NewExpensePayload) => {
      try {
        const created = await expenseService.addTransaction(payload);
        const refreshed = await expenseService.getTransactions();
        setTransactions(refreshed);
        addToast(
          `Added "${created.name}" for ₹${created.amount.toLocaleString('en-IN')}`,
          'success'
        );
      } catch (err) {
        console.error('Failed to add expense', err);
        addToast('Failed to save expense', 'danger');
      }
    },
    [addToast]
  );

  const handleDeleteExpense = useCallback(
    async (id: string) => {
      const tx = transactions.find((t) => t.id === id);
      try {
        await expenseService.deleteTransaction(id);
        const refreshed = await expenseService.getTransactions();
        setTransactions(refreshed);
        addToast(`Removed "${tx ? tx.name : 'Expense'}"`, 'danger');
      } catch (err) {
        console.error('Failed to delete expense', err);
        addToast('Failed to delete expense', 'danger');
      }
    },
    [transactions, addToast]
  );

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        workspace={workspace}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          title={
            activeTab === 'dashboard'
              ? 'Dashboard'
              : activeTab === 'transactions'
              ? 'Transactions'
              : activeTab === 'reports'
              ? 'Reports'
              : 'Settings'
          }
          subtitle={
            activeTab === 'dashboard'
              ? "Here's what's happening with your money."
              : activeTab === 'transactions'
              ? 'All household expenses and categorized spending.'
              : activeTab === 'reports'
              ? 'Spending analytics and budget forecasts.'
              : 'Workspace preferences and family members.'
          }
          isCloudConnected={isCloudConnected}
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        <main>
          {isLoading && transactions.length === 0 ? (
            <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Loading family budget records...
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  summary={summary}
                  transactions={transactions}
                  onDeleteTransaction={handleDeleteExpense}
                  onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                  onViewAllTransactions={() => setActiveTab('transactions')}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsPage
                  transactions={transactions}
                  onDeleteTransaction={handleDeleteExpense}
                  onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsPlaceholder onBackToDashboard={() => setActiveTab('dashboard')} />
              )}

              {activeTab === 'settings' && (
                <SettingsPlaceholder onBackToDashboard={() => setActiveTab('dashboard')} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Add Expense Modal Dialog */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmit={handleAddExpense}
      />

      {/* Feedback Toast */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
