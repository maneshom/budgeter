import { useState, useMemo, useCallback, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/Placeholders';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AddExpenseModal } from './components/expenses/AddExpenseModal';
import { CreateWorkspaceModal } from './components/workspaces/CreateWorkspaceModal';
import { AuthScreen } from './components/auth/AuthScreen';
import { Toast } from './components/common/Toast';
import type { ToastMessage } from './components/common/Toast';
import { expenseService } from './services/expenseService';
import { authService } from './services/authService';
import { workspaceService } from './services/workspaceService';
import { budgetService, getWorkspaceBudgetPeriod } from './services/budgetService';
import { offlineStorage } from './services/offlineStorage';
import { supabase } from './services/supabase';
import type {
  NewExpensePayload,
  Transaction,
  Workspace,
  UserProfile,
  WorkspaceBudgetConfig,
  WorkspaceBudgetCategory,
} from './types/expense';
import { Building, Plus, LogOut, Loader2 } from 'lucide-react';

const OFFLINE_USER: UserProfile = {
  id: 'local-owner',
  name: 'Offline User',
  email: 'offline@device.local',
  systemRole: 'owner',
};

export function App() {
  // Application Mode: 'cloud' | 'offline' | null
  const [appMode, setAppMode] = useState<'cloud' | 'offline' | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('moneyundo_app_mode');
      if (saved === 'offline' || saved === 'cloud') {
        return saved;
      }
    }
    return null;
  });

  const isOfflineMode = appMode === 'offline';

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('moneyundo_app_mode') === 'offline') {
      return OFFLINE_USER;
    }
    return null;
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Network State (for Cloud mode alerts)
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // App Navigation & UI State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Workspace & Financial State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<WorkspaceBudgetConfig | null>(null);
  const [workspaceCategories, setWorkspaceCategories] = useState<WorkspaceBudgetCategory[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  const addToast = useCallback((text: string, type: 'success' | 'danger' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 1. Initial Session Check & Live Auth Listener
  useEffect(() => {
    // If user has chosen offline mode, bypass Supabase entirely
    if (appMode === 'offline') {
      setCurrentUser(OFFLINE_USER);
      setIsAuthLoading(false);
      return;
    }

    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // Check existing cloud session
    authService.getSession().then(async (initialSession) => {
      if (initialSession?.user) {
        try {
          const profile = await authService.getProfile(initialSession.user);
          setCurrentUser(profile);
          setAppMode('cloud');
          localStorage.setItem('moneyundo_app_mode', 'cloud');
        } catch (err) {
          console.error('Error fetching initial profile:', err);
        }
      }
      setIsAuthLoading(false);
    });

    // Listen to live cloud auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        try {
          const profile = await authService.getProfile(newSession.user);
          setCurrentUser(profile);
          setAppMode('cloud');
          localStorage.setItem('moneyundo_app_mode', 'cloud');
        } catch (err) {
          console.error('Error on auth state change:', err);
        }
      } else {
        setCurrentUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        setTransactions([]);
        setBudget(null);
        setWorkspaceCategories([]);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appMode]);

  // 2. Network connectivity listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (appMode === 'cloud') {
        addToast('Back online. Connected to cloud.', 'success');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (appMode === 'cloud') {
        addToast('No internet connection. Reconnect to access cloud services.', 'danger');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [appMode, addToast]);

  // 3. Load User's Workspaces strictly scoped to mode
  const loadWorkspaces = useCallback(async (preferredWsId?: string) => {
    if (!currentUser) return;

    try {
      const isOwner = currentUser.systemRole === 'owner';
      const userWorkspaces = await workspaceService.getUserWorkspaces(
        currentUser.id,
        isOwner,
        isOfflineMode
      );

      // In offline mode, automatically ensure at least one default workspace exists
      if (isOfflineMode && userWorkspaces.length === 0) {
        const created = await workspaceService.createWorkspace(
          'My Budget',
          'Offline personal expenses',
          'INR',
          currentUser.id,
          { mode: 'default' },
          true
        );
        setWorkspaces([created]);
        setActiveWorkspace(created);
        return;
      }

      setWorkspaces(userWorkspaces);

      if (userWorkspaces.length > 0) {
        const selected =
          userWorkspaces.find((w) => w.id === preferredWsId) ||
          userWorkspaces.find((w) => w.id === activeWorkspace?.id) ||
          userWorkspaces[0];

        setActiveWorkspace(selected);
      } else {
        setActiveWorkspace(null);
      }
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
      addToast(err.message || 'Failed to load workspaces', 'danger');
    }
  }, [currentUser, isOfflineMode, activeWorkspace?.id, addToast]);

  useEffect(() => {
    if (currentUser) {
      loadWorkspaces();
    }
  }, [currentUser, loadWorkspaces]);

  // 4. Load Scoped Transactions & Budget when active workspace changes
  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return;

    try {
      setIsDataLoading(true);
      const [txs, workspaceBudget, categories] = await Promise.all([
        expenseService.getTransactions(workspaceId, isOfflineMode),
        budgetService.getWorkspaceBudget(workspaceId, isOfflineMode),
        budgetService.getCategories(workspaceId, isOfflineMode),
      ]);
      setTransactions(txs);
      setBudget(workspaceBudget);
      setWorkspaceCategories(categories);
    } catch (err: any) {
      console.error('Failed to load workspace data:', err);
      addToast(err.message || 'Failed to load workspace data', 'danger');
    } finally {
      setIsDataLoading(false);
    }
  }, [isOfflineMode, addToast]);

  useEffect(() => {
    if (activeWorkspace) {
      loadWorkspaceData(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, loadWorkspaceData]);

  // Dynamic dashboard summary calculation from underlying data
  const summary = useMemo(() => {
    if (!budget) return expenseService.calculateSummary([], 0);
    const period = getWorkspaceBudgetPeriod(budget);
    const periodTransactions = transactions.filter(
      (transaction) => transaction.date >= period.startDate && transaction.date <= period.endDate
    );
    const amount = budget.mode === 'category_total'
      ? workspaceCategories.reduce((total, category) => total + category.amount, 0)
      : budget.amount;
    return expenseService.calculateSummary(periodTransactions, amount);
  }, [transactions, budget, workspaceCategories]);

  // Handle Add Expense
  const handleAddExpense = useCallback(
    async (payload: NewExpensePayload) => {
      if (!activeWorkspace || !currentUser) {
        addToast('No active workspace or user session', 'danger');
        return;
      }

      try {
        const created = await expenseService.addTransaction(
          activeWorkspace.id,
          payload,
          currentUser,
          isOfflineMode
        );
        const refreshed = await expenseService.getTransactions(activeWorkspace.id, isOfflineMode);
        setTransactions(refreshed);

        addToast(`Added "${created.name}" for ₹${created.amount.toLocaleString('en-IN')}`, 'success');
      } catch (err: any) {
        console.error('Failed to add expense:', err);
        addToast(err.message || 'Failed to save expense', 'danger');
      }
    },
    [activeWorkspace, currentUser, isOfflineMode, addToast]
  );

  // Handle Delete Expense
  const handleDeleteExpense = useCallback(
    async (id: string) => {
      if (!activeWorkspace) return;
      const tx = transactions.find((t) => t.id === id);

      try {
        await expenseService.deleteTransaction(activeWorkspace.id, id, isOfflineMode);
        const refreshed = await expenseService.getTransactions(activeWorkspace.id, isOfflineMode);
        setTransactions(refreshed);
        addToast(`Removed "${tx ? tx.name : 'Expense'}"`, 'danger');
      } catch (err: any) {
        console.error('Failed to delete expense:', err);
        addToast(err.message || 'Failed to delete expense', 'danger');
      }
    },
    [activeWorkspace, transactions, isOfflineMode, addToast]
  );

  // Mode Divergence: Select Offline Mode from Login Screen
  const handleSelectOfflineMode = useCallback(async () => {
    setAppMode('offline');
    localStorage.setItem('moneyundo_app_mode', 'offline');
    setCurrentUser(OFFLINE_USER);

    const localWs = await offlineStorage.getLocalWorkspaces();
    if (localWs.length === 0) {
      const created = await workspaceService.createWorkspace(
        'My Budget',
        'Offline personal expenses',
        'INR',
        OFFLINE_USER.id,
        { mode: 'default' },
        true
      );
      setWorkspaces([created]);
      setActiveWorkspace(created);
    } else {
      setWorkspaces(localWs);
      setActiveWorkspace(localWs[0]);
    }
    addToast('Started in Offline Mode. Data is stored strictly on this device.', 'success');
  }, [addToast]);

  // Switch to Cloud Account from Offline Mode
  const handleSwitchToCloud = useCallback(async () => {
    localStorage.removeItem('moneyundo_app_mode');
    setAppMode(null);
    setCurrentUser(null);
    setActiveWorkspace(null);
    setWorkspaces([]);
    setTransactions([]);
    setBudget(null);
    setWorkspaceCategories([]);
    addToast('Switched to Cloud Account login', 'success');
  }, [addToast]);

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      if (isOfflineMode) {
        await handleSwitchToCloud();
        return;
      }
      await authService.signOut();
      localStorage.removeItem('moneyundo_app_mode');
      setAppMode(null);
      setCurrentUser(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
      setTransactions([]);
      setBudget(null);
      setWorkspaceCategories([]);
      addToast('Signed out successfully', 'success');
    } catch (err: any) {
      console.error('Sign out error:', err);
      addToast('Error signing out', 'danger');
    }
  };

  // Handle Workspace Switch
  const handleSelectWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    addToast(`Switched to "${ws.name}"`, 'success');
  };

  // Handle Workspace Created
  const handleWorkspaceCreated = (createdWs: Workspace) => {
    setWorkspaces((prev) => [...prev, createdWs]);
    setActiveWorkspace(createdWs);
    addToast(`Created workspace "${createdWs.name}"`, 'success');
  };

  // Handle Workspace Deletion
  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (workspace.role !== 'owner') {
      throw new Error('Only the owner of this workspace can delete it.');
    }

    await workspaceService.deleteWorkspace(workspace.id, isOfflineMode);
    const remainingWorkspaces = workspaces.filter((item) => item.id !== workspace.id);
    setWorkspaces(remainingWorkspaces);
    setTransactions([]);
    setBudget(null);
    setWorkspaceCategories([]);
    setActiveWorkspace((current) =>
      current?.id === workspace.id ? remainingWorkspaces[0] || null : current
    );
    setActiveTab('dashboard');
    addToast(`Deleted workspace "${workspace.name}"`, 'success');
  };

  // --------------------------------------------------------------------------
  // Render Loading Screen while validating session
  // --------------------------------------------------------------------------
  if (isAuthLoading) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
          <div>Restoring your MoneyUndo session...</div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render Login & Diverter Screen if not authenticated
  // --------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onAuthSuccess={() => {
            setAppMode('cloud');
            localStorage.setItem('moneyundo_app_mode', 'cloud');
            addToast('Signed in successfully', 'success');
          }}
          onSelectOfflineMode={handleSelectOfflineMode}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // --------------------------------------------------------------------------
  // Render No Workspace Screen (if user has not been assigned to any workspace)
  // --------------------------------------------------------------------------
  if (!activeWorkspace) {
    const isOwner = currentUser?.systemRole === 'owner';
    return (
      <div className="auth-wrapper">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div className="card-icon-pill purple" style={{ width: 48, height: 48 }}>
              <Building size={24} />
            </div>
          </div>
          <h2 className="auth-title">
            {isOwner ? 'No Workspaces Found' : 'Workspace Access Required'}
          </h2>
          <p className="auth-subtitle">
            {isOwner
              ? 'You have Owner privileges. Create a workspace to start tracking expenses.'
              : 'You are signed in as a Member, but have not been assigned to a workspace yet. Please contact a workspace owner or admin to invite you.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {isOwner && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsCreateWorkspaceOpen(true)}
              >
                <Plus size={16} />
                <span>Create New Workspace</span>
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={handleSignOut}
              style={{ justifyContent: 'center' }}
            >
              <LogOut size={16} />
              <span>{isOfflineMode ? 'Switch to Cloud Account' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Create Workspace Modal */}
        {currentUser && (
          <CreateWorkspaceModal
            isOpen={isCreateWorkspaceOpen}
            onClose={() => setIsCreateWorkspaceOpen(false)}
            onCreated={handleWorkspaceCreated}
            userId={currentUser.id}
            workspaces={workspaces}
            isOfflineMode={isOfflineMode}
          />
        )}

        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render Main Application
  // --------------------------------------------------------------------------
  return (
    <div className="app-layout">
      {/* Sidebar Navigation with Workspace Switcher */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        workspace={activeWorkspace}
        workspaces={workspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        isOfflineMode={isOfflineMode}
        onSwitchToCloud={handleSwitchToCloud}
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
              ? `Here's what's happening with ${activeWorkspace.name}.`
              : activeTab === 'transactions'
              ? `All transactions recorded in ${activeWorkspace.name}.`
              : activeTab === 'reports'
              ? 'Spending analytics and budget forecasts.'
              : 'Workspace preferences, role permissions, and members.'
          }
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          isOfflineMode={isOfflineMode}
          isNetworkOffline={!isOnline}
        />

        <main>
          {isDataLoading && transactions.length === 0 ? (
            <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Loading workspace data...
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  summary={summary}
                  transactions={transactions}
                  budgetConfig={budget}
                  onDeleteTransaction={handleDeleteExpense}
                  onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                  onViewAllTransactions={() => setActiveTab('transactions')}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsPage
                  transactions={transactions}
                  categories={workspaceCategories.map((category) => category.name)}
                  onDeleteTransaction={handleDeleteExpense}
                  onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsPage
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspace.id}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  activeWorkspace={activeWorkspace}
                  currentUser={currentUser}
                  transactions={transactions}
                  workspaces={workspaces}
                  onOpenCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
                  onDeleteWorkspace={handleDeleteWorkspace}
                  isOfflineMode={isOfflineMode}
                  onSwitchToCloud={handleSwitchToCloud}
                  onBudgetUpdated={() => loadWorkspaceData(activeWorkspace.id)}
                  onWorkspaceUpdated={() => loadWorkspaces()}
                  onAddToast={addToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmit={handleAddExpense}
        categories={workspaceCategories.map((category) => category.name)}
      />

      {currentUser && (
        <CreateWorkspaceModal
          isOpen={isCreateWorkspaceOpen}
          onClose={() => setIsCreateWorkspaceOpen(false)}
          onCreated={handleWorkspaceCreated}
          userId={currentUser.id}
          workspaces={workspaces}
          isOfflineMode={isOfflineMode}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
