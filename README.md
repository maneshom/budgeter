# SpendWise — Family Expense Management App

**SpendWise** is a modern, responsive expense management application tailored for family budgets, designed with an architecture that smoothly scales to multi-user, multi-family, and workspace environments.

---

## 🌟 Features

* **Real-time Financial Dashboard:**
  * **Dynamic Monthly Overview:** Displays the current month and year dynamically (e.g. October 2026 overview).
  * **Summary Cards:**
    * **Monthly Budget:** Displays configured budget limit with currency formatting in Indian Rupees (INR).
    * **Total Spent:** Aggregated sum of all transactions for the month with percentage of budget consumed.
    * **Remaining Balance:** Dynamically calculated balance remaining, with soft green ("Within budget") and prominent warning ("Over budget") indicators.
* **Budget Progress Bar:**
  * Dynamic visual progress tracker that updates instantly when expenses are added or removed.
  * Adaptive color coding: purple for healthy progress, amber for warning (>85%), and red for exceeded budgets (>100%).
* **Recent Transactions List:**
  * Categorized transactions with distinct icons and colors for all 9 supported categories.
  * Formatted amounts in INR aligned to the right with minus indicators (`- ₹2,500`).
  * "View all" toggle and search/category filtering.
  * Delete capability with instant recalculation of all metrics.
* **Add Expense Modal:**
  * Accessible modal dialog (`role="dialog"`, `aria-modal="true"`).
  * Strict validation: trimmed name with length constraints, valid positive INR amounts, supported categories, and date picker.
  * Keyboard navigation (Esc to dismiss, Enter to submit, initial input focus).
  * Duplicate submission prevention.
* **Responsive SaaS Design:**
  * Tested for mobile (360px, 390px), tablet (768px), and desktop (1280px+).
  * Mobile slide-in sidebar with hamburger toggle, backdrop blur, and overlay dismissal.

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript (Strict Mode)
* **Build Tool:** Vite 8
* **Icons:** Lucide React
* **Styling:** CSS variables & responsive layout
* **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)
* **Hosting Target:** GitHub Pages

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd budgeter-app
npm install
```

### 2. Run Local Development Server

```bash
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### 3. Build for Production

```bash
npm run build
```

The production output is generated in `budgeter-app/dist`.

---

## 📁 Project Structure

```
budgeter/
├── .github/workflows/deploy.yml   # Automated GitHub Pages CI/CD
├── README.md
└── budgeter-app/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── types/
        │   └── expense.ts          # Core domain models (Transaction, Budget, Workspace)
        ├── utils/
        │   ├── currency.ts         # Indian Rupee (INR) formatting & parsing
        │   ├── date.ts             # Dynamic month/year & date helpers
        │   └── categoryMetadata.ts # Icons and badge styling for categories
        ├── services/
        │   └── expenseService.ts   # Data layer (clean separation for Supabase migration)
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx     # Desktop & mobile responsive navigation
        │   │   └── Header.tsx      # Header bar with hamburger & "+ Add expense"
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
        │   └── Placeholders.tsx    # Transactions view & Phase 2 roadmap views
        ├── App.tsx                 # Root app container & state management
        ├── main.tsx                # Mount point
        ├── index.css               # Design tokens, reset, typography
        └── App.css                 # Component & responsive styles
```

---

## 🔮 Recommended Next Steps: Supabase Integration

1. **Database Schema:**
   * Create `workspaces` table (`id`, `name`, `currency`).
   * Create `family_members` table (`workspace_id`, `user_id`, `role`).
   * Create `monthly_budgets` table (`workspace_id`, `month`, `year`, `amount`).
   * Create `transactions` table (`id`, `workspace_id`, `name`, `amount`, `category`, `date`, `created_by`, `status`, `notes`).
2. **Row Level Security (RLS):**
   * Enforce `workspace_id` isolation so users can only view and mutate expenses belonging to their family workspace.
3. **Frontend Connection:**
   * Install `@supabase/supabase-js`.
   * Swap out local in-memory calls in `src/services/expenseService.ts` for Supabase client queries.
