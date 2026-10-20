# MoneyUndo — Budgeting & Expense Tracking

**MoneyUndo** is a modern, responsive budgeting and expense management app for personal, shared, travel, project, and other spending needs, with multi-workspace access and role-based permissions.

---

## 🌟 Features

* **Secure Authentication & Session Management:**
  * Email/password account registration and sign-in.
  * Automatic session restoration on reload and clean sign-out.
  * Protected route guards: unauthenticated users cannot access dashboard, transactions, or settings.
* **Role-Based Access Control (RBAC):**
  * **Owner (System-role):** Can create new workspaces. An Owner will only see and manage the workspaces they created (or workspaces they have been assigned to as members). Owners cannot see, update, or administer workspaces created by other owners.
  * **Admin (Workspace-scoped):** Can manage workspace budgets and invite/assign regular Members to workspaces they administer. Permissions are strictly scoped to their assigned workspace.
  * **Member (Workspace-scoped):** Can view reports and record expenses in assigned workspaces. Cannot manage members or workspaces.
* **Workspace Isolation & Multi-Workspace Support:**
  * Workspaces belong to their creating owner (`owner_id`).
  * Interactive workspace switcher in the sidebar when a user belongs to more than one workspace.
  * All transaction and budget queries are strictly scoped to the active workspace.
  * Workspace access and permissions are enforced by database security policies.
* **Workspace Budgets & Dynamic Categories:**
  * Each workspace has one budget period: monthly, yearly, or custom start/end dates.
  * Owners and workspace admins can create workspace-specific expense categories with allocation amounts.
  * When creating a workspace, owners can use default categories, start with no categories, clone category names with zero allocations, or clone names and allocations from another accessible workspace.
  * From workspace settings, owners and admins can also clone category names with zero allocations; existing categories and allocations remain unchanged.
  * Workspace totals can be fixed, automatically summed from category allocations, or capped so category allocations cannot exceed the workspace limit.
  * Budget and category progress compares workspace expenses dated within the selected period.
* **Workspace Lifecycle:**
  * Only a workspace's owner can permanently delete it. Deletion requires a confirmation prompt and removes its budget, categories, expenses, and member assignments.
* **Workspace-Period Financial Dashboard:**
  * Displays the active monthly, yearly, or custom budget period.
  * **Summary Cards:**
    * **Workspace Budget:** Configured workspace amount with currency formatting in Indian Rupees (INR).
    * **Total Spent:** Sum of transactions in the active workspace budget period with percentage of budget consumed.
    * **Remaining Balance:** Dynamically calculated balance remaining, with soft green ("Within budget") and prominent warning ("Over budget") indicators.
* **Budget Progress Bar:**
  * Dynamic visual progress tracker that updates instantly when expenses are added or removed.
  * Adaptive color coding: purple for healthy progress, amber for warning (>85%), and red for exceeded budgets (>100%).
* **Workspace Reports & Analytics:**
  * Select any workspace the user can access from the Reports page.
  * View spending and budget summary widgets, six-month spending trends, budget progress, and category-level spend with allocations.
* **Clean Separation of Offline & Cloud Modes:**
  * **Login Screen Mode Divergence:** Users choose their mode directly on the entry screen: **Cloud Account** or **Offline Mode (Single User)**.
  * **Offline Mode (100% On-Device):** Stores workspace settings, categories, budget allocations, and transactions strictly on the local device (IndexedDB / LocalStorage). Operates completely standalone with zero network dependencies, maximum privacy, and zero latency.
  * **Cloud Mode (Multi-User Synced):** Hosted on Supabase Postgres database. Enables family collaboration, role-based access (Owner, Admin, Member), and real-time synchronization across devices.
  * **Easy Switching:** Offline users can switch to Cloud mode anytime with one click from the sidebar or settings to create or sign into an online account.
* **Recent Transactions List:**
  * Categorized transactions with distinct icons and colors, including workspace-defined categories.
  * Formatted amounts in INR aligned to the right with minus indicators (`- ₹2,500`).
  * "View all" toggle and search/category filtering.
  * Delete capability with instant recalculation of all metrics.
* **Add Expense Modal:**
  * Accessible modal dialog (`role="dialog"`, `aria-modal="true"`).
  * Strict validation: trimmed name with length constraints, valid positive INR amounts, active workspace categories, and date picker.
  * Keyboard navigation (Esc to dismiss, Enter to submit, initial input focus).
  * Duplicate submission prevention.
* **Responsive SaaS Design:**
  * Tested for mobile (360px, 390px), tablet (768px), and desktop (1280px+).
  * Mobile slide-in sidebar with hamburger toggle, backdrop blur, and overlay dismissal.

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript (Strict Mode)
* **Build Tool:** Vite 8
* **Authentication & Backend:** Hosted authentication and PostgreSQL
* **Security & Authorization:** Row Level Security (RLS) & Security Definer Functions
* **Icons:** Lucide React
* **Styling:** CSS variables & responsive layout
* **Testing:** Vitest
* **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)
* **Hosting Target:** GitHub Pages

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd budgeter-app
npm install
```

### 2. Configure Backend Environment Variables

Copy `.env.example` to `.env` in `budgeter-app/`:

```bash
cp budgeter-app/.env.example budgeter-app/.env
```

Fill in your project credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run the Safe Database Migration

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard).
2. Copy and run the script from [`supabase-schema.sql`](supabase-schema.sql).
3. The migration is **safe and non-destructive** (no `DROP TABLE CASCADE`):
   * Sets up `public.profiles` linked to `auth.users(id)` with automatic trigger `on_auth_user_created`.
   * The first registered user automatically receives the global `owner` role; subsequent users default to `member`.
   * Sets up `public.workspaces` with `owner_id` foreign key.
   * Sets up `public.workspace_members` with roles (`admin`, `member`).
   * Sets up one `public.workspace_budgets` record and dynamic `public.workspace_categories` for each workspace, migrating legacy monthly limits.
   * Installs secure RPCs that enforce the workspace budget mode and category allocation rules.
   * Configures restrictive RLS policies preventing privilege escalation.
   * Defines secure RPC functions for workspace lifecycle, member assignment, budget management, category management, and category cloning.

For an existing Supabase project, rerun the latest script after the app update. It backfills profiles for existing Auth users, promotes the earliest registered account to Owner only if no Owner exists, and links legacy workspaces that have no owner to that Owner. After the migration completes, sign out and sign back in so the app reloads your profile and workspace access.

To brand account confirmation emails, set the confirmation email subject to `Confirm your MoneyUndo account` and use [`supabase/templates/confirm-signup.html`](supabase/templates/confirm-signup.html) as the confirmation message body in the authentication email template settings.

### 4. (Optional) Deploy Edge Function for Email Invitations

To invite unverified users who haven't registered yet, deploy the secure Edge Function:

```bash
supabase functions deploy invite-member
```

The function is located at [`supabase/functions/invite-member/index.ts`](supabase/functions/invite-member/index.ts). It uses the server-side `SUPABASE_SERVICE_ROLE_KEY` to invite users via `supabase.auth.admin.inviteUserByEmail`, verifying caller authorization so service role keys are never exposed in browser code.

### 5. Run Unit & RBAC Tests

```bash
cd budgeter-app
npm test
```

### 6. Run Local Development Server

```bash
cd budgeter-app
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### 7. Build for Production

```bash
cd budgeter-app
npm run build
```

The production output is generated in `budgeter-app/dist`.

---

## 📁 Project Structure

```
budgeter/
├── .github/workflows/deploy.yml   # Automated GitHub Pages CI/CD
├── supabase-schema.sql            # Safe RLS migration & database schema
├── supabase/
│   └── functions/
│       └── invite-member/
│           └── index.ts           # Secure server-side invitation Edge Function
├── README.md
└── budgeter-app/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── types/
        │   └── expense.ts          # Domain models (Transaction, Workspace, Roles, Members)
        ├── utils/
        │   ├── currency.ts         # Indian Rupee (INR) formatting & parsing
        │   ├── date.ts             # Dynamic month/year & date helpers
        │   └── categoryMetadata.ts # Icons and badge styling for categories
        ├── services/
        │   ├── supabase.ts         # Supabase client initialization
        │   ├── authService.ts      # Auth (signIn, signUp, signOut, getProfile)
        │   ├── workspaceService.ts # Workspaces, member assignments, role querying
        │   ├── budgetService.ts    # Workspace amount, period, and category budget operations
        │   └── expenseService.ts   # Scoped transaction and budget operations
        ├── components/
        │   ├── auth/
        │   │   └── AuthScreen.tsx  # Sign-in and registration forms with validation
        │   ├── budgets/
        │   │   └── WorkspaceBudgetManager.tsx # Workspace limits and dynamic category allocations
        │   ├── workspaces/
        │   │   └── CreateWorkspaceModal.tsx # Workspace creation modal (Owner only)
        │   ├── layout/
        │   │   ├── Sidebar.tsx     # Navigation & interactive workspace switcher
        │   │   └── Header.tsx      # Top header with status and "+ Add expense"
        │   ├── dashboard/
        │   │   ├── SummaryCard.tsx # Reusable metric card
        │   │   ├── BudgetProgress.tsx # Responsive progress bar
        │   │   ├── RecentTransactions.tsx # List container & empty state
        │   │   └── TransactionRow.tsx # Individual transaction item
        │   ├── expenses/
        │   │   └── AddExpenseModal.tsx # Validated accessible modal
        │   └── common/
        │       └── Toast.tsx       # Status toasts
        ├── pages/
        │   ├── Dashboard.tsx       # Dashboard page
        │   ├── SettingsPage.tsx    # Role-based workspace & member management
        │   └── Placeholders.tsx    # Transactions view & Phase 2 roadmap views
        ├── __tests__/
        │   └── authAndPermissions.test.ts # Vitest test suite for auth and RBAC
        ├── App.tsx                 # Root app container, session check & route guards
        ├── main.tsx                # Mount point
        ├── index.css               # Design tokens, reset, typography
        └── App.css                 # Component & responsive styles
```
