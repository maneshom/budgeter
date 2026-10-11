-- ==============================================================================
-- SpendWise Complete Database Setup, Permissions & Seed Data
-- ==============================================================================
-- Run this ENTIRE script in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/twiwcgkdatlsvemdvizb/sql/new
-- 2. Paste this complete SQL script
-- 3. Click "RUN"
-- ==============================================================================

-- 1. Drop existing tables to start clean and avoid schema mismatches
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.monthly_budgets CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- 2. Workspaces Table
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Family Members Table (Profile-based, no auth.users dependency)
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Monthly Budgets Table
CREATE TABLE public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year >= 2000),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, month, year)
);

-- 5. Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes
CREATE INDEX idx_transactions_workspace_date ON public.transactions(workspace_id, date DESC);
CREATE INDEX idx_monthly_budgets_lookup ON public.monthly_budgets(workspace_id, year, month);
CREATE INDEX idx_family_members_workspace ON public.family_members(workspace_id);

-- 7. Row Level Security (RLS) & Policies for Anon API access
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read and write on workspaces"
    ON public.workspaces FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read and write on family_members"
    ON public.family_members FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read and write on monthly_budgets"
    ON public.monthly_budgets FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read and write on transactions"
    ON public.transactions FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 8. Seed Sample Data
DO $$
DECLARE
    v_workspace_id UUID;
    v_alex_id UUID;
    v_sarah_id UUID;
BEGIN
    -- Create Default Family Workspace
    INSERT INTO public.workspaces (name, description, currency)
    VALUES ('Family Budget', 'Household expenses & monthly planning', 'INR')
    RETURNING id INTO v_workspace_id;

    -- Create Members
    INSERT INTO public.family_members (workspace_id, name, email, role)
    VALUES (v_workspace_id, 'Alex Morgan', 'alex@family.spendwise', 'admin')
    RETURNING id INTO v_alex_id;

    INSERT INTO public.family_members (workspace_id, name, email, role)
    VALUES (v_workspace_id, 'Sarah Morgan', 'sarah@family.spendwise', 'member')
    RETURNING id INTO v_sarah_id;

    -- Create Monthly Budget (₹50,000 for current month)
    INSERT INTO public.monthly_budgets (workspace_id, month, year, amount)
    VALUES (
        v_workspace_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::INT,
        EXTRACT(YEAR FROM CURRENT_DATE)::INT,
        50000.00
    );

    -- Create Sample Initial Transactions (Sum: ₹18,500)
    INSERT INTO public.transactions (workspace_id, member_id, name, amount, category, date, created_by, status)
    VALUES
        (v_workspace_id, v_alex_id, 'House Rent', 12000.00, 'Housing', CURRENT_DATE - INTERVAL '10 days', 'Alex Morgan', 'approved'),
        (v_workspace_id, v_sarah_id, 'Groceries', 2500.00, 'Food & Shopping', CURRENT_DATE - INTERVAL '7 days', 'Sarah Morgan', 'approved'),
        (v_workspace_id, v_alex_id, 'Electricity Bill', 1450.00, 'Utilities', CURRENT_DATE - INTERVAL '5 days', 'Alex Morgan', 'approved'),
        (v_workspace_id, v_alex_id, 'Fuel', 1200.00, 'Transport', CURRENT_DATE - INTERVAL '3 days', 'Alex Morgan', 'approved'),
        (v_workspace_id, v_sarah_id, 'Restaurant', 850.00, 'Food & Dining', CURRENT_DATE - INTERVAL '2 days', 'Sarah Morgan', 'approved'),
        (v_workspace_id, v_alex_id, 'Pharmacy / Health', 500.00, 'Healthcare', CURRENT_DATE - INTERVAL '1 day', 'Alex Morgan', 'approved');
END $$;

