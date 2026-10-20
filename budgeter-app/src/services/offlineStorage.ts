import type {
  Workspace,
  Transaction,
  WorkspaceBudgetConfig,
  WorkspaceBudgetCategory,
} from '../types/expense';

const DB_NAME = 'moneyundo_offline_db';
const DB_VERSION = 1;

const STORE_WORKSPACES = 'workspaces';
const STORE_TRANSACTIONS = 'transactions';
const STORE_BUDGETS = 'budgets';
const STORE_CATEGORIES = 'categories';

// In-memory fallback if IndexedDB/LocalStorage is restricted
const memoryFallback = new Map<string, any>();

function getLocalStorageKey(storeName: string, key?: string): string {
  return `moneyundo_offline_${storeName}${key ? `_${key}` : ''}`;
}

function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    }
  } catch (e) {
    // LocalStorage quota or disabled
  }
  return memoryFallback.get(key) ?? defaultValue;
}

function safeSetLocalStorage<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }
  } catch (e) {
    // LocalStorage error
  }
  memoryFallback.set(key, value);
}

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isIndexedDBAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.indexedDB !== 'undefined' &&
      typeof window.indexedDB.open === 'function'
    );
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable()) {
      return null;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
            db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
            const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
            txStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
            db.createObjectStore(STORE_BUDGETS, { keyPath: 'workspaceId' });
          }
          if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
            const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
            catStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('Error opening IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public isLocalWorkspace(workspaceId: string): boolean {
    return typeof workspaceId === 'string' && workspaceId.startsWith('local-');
  }

  // --------------------------------------------------------------------------
  // Local Workspaces
  // --------------------------------------------------------------------------

  public async getLocalWorkspaces(): Promise<Workspace[]> {
    const db = await this.getDB();
    if (!db) {
      return safeGetLocalStorage<Workspace[]>(getLocalStorageKey(STORE_WORKSPACES), []);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_WORKSPACES, 'readonly');
        const store = tx.objectStore(STORE_WORKSPACES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => {
          resolve(safeGetLocalStorage<Workspace[]>(getLocalStorageKey(STORE_WORKSPACES), []));
        };
      } catch (e) {
        resolve(safeGetLocalStorage<Workspace[]>(getLocalStorageKey(STORE_WORKSPACES), []));
      }
    });
  }

  public async saveLocalWorkspace(workspace: Workspace): Promise<void> {
    const formatted: Workspace = {
      ...workspace,
      storageType: 'local',
      syncStatus: 'local_only',
      membersCount: 1,
      role: 'owner',
    };

    const current = await this.getLocalWorkspaces();
    const updated = current.filter((w) => w.id !== formatted.id).concat(formatted);
    safeSetLocalStorage(getLocalStorageKey(STORE_WORKSPACES), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
        tx.objectStore(STORE_WORKSPACES).put(formatted);
      } catch (e) {
        // Fallback already saved
      }
    }
  }

  public async deleteLocalWorkspace(workspaceId: string): Promise<void> {
    const current = await this.getLocalWorkspaces();
    const updated = current.filter((w) => w.id !== workspaceId);
    safeSetLocalStorage(getLocalStorageKey(STORE_WORKSPACES), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(
          [STORE_WORKSPACES, STORE_TRANSACTIONS, STORE_BUDGETS, STORE_CATEGORIES],
          'readwrite'
        );
        tx.objectStore(STORE_WORKSPACES).delete(workspaceId);
        tx.objectStore(STORE_BUDGETS).delete(workspaceId);
      } catch (e) {
        // Handled
      }
    }

    safeSetLocalStorage(getLocalStorageKey(STORE_TRANSACTIONS, workspaceId), []);
    safeSetLocalStorage(getLocalStorageKey(STORE_CATEGORIES, workspaceId), []);
    safeSetLocalStorage(getLocalStorageKey(STORE_BUDGETS, workspaceId), null);
  }

  // --------------------------------------------------------------------------
  // Local Transactions
  // --------------------------------------------------------------------------

  public async getLocalTransactions(workspaceId: string): Promise<Transaction[]> {
    const db = await this.getDB();
    if (!db) {
      return safeGetLocalStorage<Transaction[]>(getLocalStorageKey(STORE_TRANSACTIONS, workspaceId), []);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
        const store = tx.objectStore(STORE_TRANSACTIONS);
        const index = store.index('workspaceId');
        const req = index.getAll(workspaceId);
        req.onsuccess = () => {
          const list: Transaction[] = req.result || [];
          list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
          resolve(list);
        };
        req.onerror = () => {
          resolve(safeGetLocalStorage<Transaction[]>(getLocalStorageKey(STORE_TRANSACTIONS, workspaceId), []));
        };
      } catch (e) {
        resolve(safeGetLocalStorage<Transaction[]>(getLocalStorageKey(STORE_TRANSACTIONS, workspaceId), []));
      }
    });
  }

  public async saveLocalTransaction(transaction: Transaction): Promise<void> {
    const current = await this.getLocalTransactions(transaction.workspaceId);
    const updated = current.filter((t) => t.id !== transaction.id).concat(transaction);
    updated.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    safeSetLocalStorage(getLocalStorageKey(STORE_TRANSACTIONS, transaction.workspaceId), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
        tx.objectStore(STORE_TRANSACTIONS).put(transaction);
      } catch (e) {
        // Fallback stored
      }
    }
  }

  public async deleteLocalTransaction(workspaceId: string, transactionId: string): Promise<void> {
    const current = await this.getLocalTransactions(workspaceId);
    const updated = current.filter((t) => t.id !== transactionId);
    safeSetLocalStorage(getLocalStorageKey(STORE_TRANSACTIONS, workspaceId), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
        tx.objectStore(STORE_TRANSACTIONS).delete(transactionId);
      } catch (e) {
        // Fallback stored
      }
    }
  }

  // --------------------------------------------------------------------------
  // Local Budget Config & Categories
  // --------------------------------------------------------------------------

  public async getLocalBudget(workspaceId: string): Promise<WorkspaceBudgetConfig | null> {
    const db = await this.getDB();
    if (!db) {
      return safeGetLocalStorage<WorkspaceBudgetConfig | null>(getLocalStorageKey(STORE_BUDGETS, workspaceId), null);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BUDGETS, 'readonly');
        const store = tx.objectStore(STORE_BUDGETS);
        const req = store.get(workspaceId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => {
          resolve(safeGetLocalStorage<WorkspaceBudgetConfig | null>(getLocalStorageKey(STORE_BUDGETS, workspaceId), null));
        };
      } catch (e) {
        resolve(safeGetLocalStorage<WorkspaceBudgetConfig | null>(getLocalStorageKey(STORE_BUDGETS, workspaceId), null));
      }
    });
  }

  public async saveLocalBudget(config: WorkspaceBudgetConfig): Promise<void> {
    safeSetLocalStorage(getLocalStorageKey(STORE_BUDGETS, config.workspaceId), config);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_BUDGETS, 'readwrite');
        tx.objectStore(STORE_BUDGETS).put(config);
      } catch (e) {
        // Fallback saved
      }
    }
  }

  public async getLocalCategories(workspaceId: string): Promise<WorkspaceBudgetCategory[]> {
    const db = await this.getDB();
    if (!db) {
      return safeGetLocalStorage<WorkspaceBudgetCategory[]>(getLocalStorageKey(STORE_CATEGORIES, workspaceId), []);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CATEGORIES, 'readonly');
        const store = tx.objectStore(STORE_CATEGORIES);
        const index = store.index('workspaceId');
        const req = index.getAll(workspaceId);
        req.onsuccess = () => {
          const list: WorkspaceBudgetCategory[] = req.result || [];
          list.sort((a, b) => a.name.localeCompare(b.name));
          resolve(list);
        };
        req.onerror = () => {
          resolve(safeGetLocalStorage<WorkspaceBudgetCategory[]>(getLocalStorageKey(STORE_CATEGORIES, workspaceId), []));
        };
      } catch (e) {
        resolve(safeGetLocalStorage<WorkspaceBudgetCategory[]>(getLocalStorageKey(STORE_CATEGORIES, workspaceId), []));
      }
    });
  }

  public async saveLocalCategory(category: WorkspaceBudgetCategory): Promise<void> {
    const current = await this.getLocalCategories(category.workspaceId);
    const updated = current.filter((c) => c.id !== category.id).concat(category);
    updated.sort((a, b) => a.name.localeCompare(b.name));
    safeSetLocalStorage(getLocalStorageKey(STORE_CATEGORIES, category.workspaceId), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
        tx.objectStore(STORE_CATEGORIES).put(category);
      } catch (e) {
        // Fallback stored
      }
    }
  }

  public async setLocalCategories(workspaceId: string, categories: WorkspaceBudgetCategory[]): Promise<void> {
    safeSetLocalStorage(getLocalStorageKey(STORE_CATEGORIES, workspaceId), categories);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
        const store = tx.objectStore(STORE_CATEGORIES);
        categories.forEach((cat) => store.put(cat));
      } catch (e) {
        // Fallback stored
      }
    }
  }

  public async deleteLocalCategory(workspaceId: string, categoryId: string): Promise<void> {
    const current = await this.getLocalCategories(workspaceId);
    const updated = current.filter((c) => c.id !== categoryId);
    safeSetLocalStorage(getLocalStorageKey(STORE_CATEGORIES, workspaceId), updated);

    const db = await this.getDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
        tx.objectStore(STORE_CATEGORIES).delete(categoryId);
      } catch (e) {
        // Fallback stored
      }
    }
  }
}

export const offlineStorage = new OfflineStorageService();
