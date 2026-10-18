-- ==============================================================================
-- MoneyUndo Database Migration & Security Schema
-- ==============================================================================
-- Safe, non-destructive migration script.
-- Sets up:
-- 1. Profiles (linked to auth.users, managed via security triggers)
-- 2. Workspaces (scoped to creating owner)
-- 3. Workspace Members (role-based: owner, admin, member)
-- 4. Transactions & Workspace Budgets/Categories (scoped to authorized workspace)
-- 5. Restrictive Row Level Security (RLS) policies enforcing permissions
-- 6. Secure RPC functions for workspace creation and member assignment
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    system_role TEXT NOT NULL DEFAULT 'member' CHECK (system_role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on email for fast lookups during member invitations
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure owner_id column exists if table was created previously
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);

-- 4. Monthly Budgets Table
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year >= 2000),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, month, year)
);

-- One budget configuration and dynamic allocation categories per workspace.
CREATE TABLE IF NOT EXISTS public.workspace_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed', 'category_total', 'capped')),
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'yearly', 'custom')),
    start_date DATE,
    end_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (period_type = 'custom' AND start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
      OR (period_type IN ('monthly', 'yearly') AND start_date IS NULL AND end_date IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.workspace_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_categories_name_ci
    ON public.workspace_categories(workspace_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_workspace_categories_workspace
    ON public.workspace_categories(workspace_id, name);

-- Migrate the latest legacy monthly value to the new single workspace budget.
INSERT INTO public.workspace_budgets (workspace_id, amount)
SELECT DISTINCT ON (workspace_id) workspace_id, amount
FROM public.monthly_budgets
ORDER BY workspace_id, year DESC, month DESC
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO public.workspace_budgets (workspace_id)
SELECT id FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- Retain existing built-in categories and initialize them for every workspace.
INSERT INTO public.workspace_categories (workspace_id, name, amount)
SELECT w.id, category.name, 0
FROM public.workspaces AS w
CROSS JOIN (
  VALUES
    ('Food & Shopping'), ('Housing'), ('Utilities'), ('Transport'),
    ('Food & Dining'), ('Healthcare'), ('Education'), ('Entertainment'), ('Other')
) AS category(name)
ON CONFLICT (workspace_id, name) DO NOTHING;

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    member_id UUID,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by TEXT,
    created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure created_by_id exists if table was created previously
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_lookup ON public.monthly_budgets(workspace_id, year, month);

-- ==============================================================================
-- Security Helper Functions (SECURITY DEFINER with fixed search_path)
-- ==============================================================================

-- Check if user is a global owner
CREATE OR REPLACE FUNCTION public.is_owner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND system_role = 'owner'
  );
END;
$$;

-- Check if user is owner of the workspace or assigned admin in the workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Creator of this workspace is the workspace admin/owner
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Assigned workspace admin in workspace_members for THIS workspace
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'admin'
  );
END;
$$;

-- Check if user has access to a workspace (Creator/Owner or assigned Member/Admin)
CREATE OR REPLACE FUNCTION public.has_workspace_access(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Creator/owner of this specific workspace
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Assigned member or admin in this specific workspace
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
END;
$$;

-- ==============================================================================
-- Triggers for Auth & Role Integrity
-- ==============================================================================

-- Automatic profile creation when a user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_first_user BOOLEAN;
  v_assigned_role TEXT;
BEGIN
  -- If no owner exists yet in profiles, designate the first user as owner
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE system_role = 'owner') INTO v_is_first_user;
  IF v_is_first_user THEN
    v_assigned_role := 'owner';
  ELSE
    v_assigned_role := 'member';
  END IF;

  INSERT INTO public.profiles (id, email, name, system_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_assigned_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name);

  -- If this is the first user (Owner), ensure a default workspace is created and linked
  IF v_is_first_user THEN
    INSERT INTO public.workspaces (name, description, currency, owner_id)
    VALUES ('Family Budget', 'Household expenses & monthly planning', 'INR', NEW.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.workspace_budgets (workspace_id, amount)
    SELECT id, 50000
    FROM public.workspaces
    WHERE owner_id = NEW.id AND name = 'Family Budget'
    ON CONFLICT (workspace_id) DO NOTHING;

    INSERT INTO public.workspace_categories (workspace_id, name, amount)
    SELECT w.id, category.name, 0
    FROM public.workspaces AS w
    CROSS JOIN (
      VALUES
        ('Food & Shopping'), ('Housing'), ('Utilities'), ('Transport'),
        ('Food & Dining'), ('Healthcare'), ('Education'), ('Entertainment'), ('Other')
    ) AS category(name)
    WHERE w.owner_id = NEW.id AND w.name = 'Family Budget'
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent authenticated non-owners from escalating their own system_role.
-- A NULL auth.uid() is reserved for trusted database migrations/admin operations.
CREATE OR REPLACE FUNCTION public.protect_profile_system_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.system_role <> OLD.system_role AND auth.uid() IS NOT NULL THEN
    IF NOT public.is_owner(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: only owners can modify system_role';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_system_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_system_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_role();

-- Backfill users who signed up before the auth trigger was installed.
-- Preserve an existing owner; otherwise, the earliest registered account becomes owner.
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id
  INTO v_owner_id
  FROM public.profiles
  WHERE system_role = 'owner'
  ORDER BY created_at, id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT id
    INTO v_owner_id
    FROM auth.users
    ORDER BY created_at, id
    LIMIT 1;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, name, system_role)
    SELECT
      u.id,
      COALESCE(u.email, ''),
      COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(COALESCE(u.email, ''), '@', 1)),
      CASE WHEN u.id = v_owner_id THEN 'owner' ELSE 'member' END
    FROM auth.users AS u
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name);

    UPDATE public.profiles
    SET system_role = 'owner'
    WHERE id = v_owner_id
      AND system_role <> 'owner';

    -- Existing workspaces created before owner_id was added belong to the initial owner.
    UPDATE public.workspaces
    SET owner_id = v_owner_id
    WHERE owner_id IS NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspaces
      WHERE owner_id = v_owner_id
    ) THEN
      INSERT INTO public.workspaces (name, description, currency, owner_id)
      VALUES ('Family Budget', 'Household expenses & monthly planning', 'INR', v_owner_id);
    END IF;

    INSERT INTO public.monthly_budgets (workspace_id, month, year, amount)
    SELECT
      id,
      EXTRACT(MONTH FROM CURRENT_DATE)::INT,
      EXTRACT(YEAR FROM CURRENT_DATE)::INT,
      50000.00
    FROM public.workspaces
    WHERE owner_id = v_owner_id
    ON CONFLICT (workspace_id, month, year) DO NOTHING;

    INSERT INTO public.workspace_budgets (workspace_id, amount)
    SELECT DISTINCT ON (workspace_id) workspace_id, amount
    FROM public.monthly_budgets
    WHERE workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = v_owner_id
    )
    ORDER BY workspace_id, year DESC, month DESC
    ON CONFLICT (workspace_id) DO NOTHING;

    INSERT INTO public.workspace_budgets (workspace_id)
    SELECT id FROM public.workspaces
    WHERE owner_id = v_owner_id
    ON CONFLICT (workspace_id) DO NOTHING;

    INSERT INTO public.workspace_categories (workspace_id, name, amount)
    SELECT w.id, category.name, 0
    FROM public.workspaces AS w
    CROSS JOIN (
      VALUES
        ('Food & Shopping'), ('Housing'), ('Utilities'), ('Transport'),
        ('Food & Dining'), ('Healthcare'), ('Education'), ('Entertainment'), ('Other')
    ) AS category(name)
    WHERE w.owner_id = v_owner_id
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END IF;
END;
$$;

-- ==============================================================================
-- Secure RPC Operations
-- ==============================================================================

-- Create a workspace (Owner only)
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'INR'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_workspace_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_owner(v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can create workspaces';
  END IF;

  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Workspace name cannot be empty';
  END IF;

  INSERT INTO public.workspaces (name, description, currency, owner_id)
  VALUES (trim(p_name), trim(p_description), coalesce(p_currency, 'INR'), v_user_id)
  RETURNING id INTO v_workspace_id;

  -- Create initial monthly budget
  INSERT INTO public.monthly_budgets (workspace_id, month, year, amount)
  VALUES (
    v_workspace_id,
    EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    50000.00
  );

  INSERT INTO public.workspace_budgets (workspace_id, amount)
  VALUES (v_workspace_id, 50000.00);

  INSERT INTO public.workspace_categories (workspace_id, name, amount)
  SELECT v_workspace_id, category.name, 0
  FROM (
    VALUES
      ('Food & Shopping'), ('Housing'), ('Utilities'), ('Transport'),
      ('Food & Dining'), ('Healthcare'), ('Education'), ('Entertainment'), ('Other')
  ) AS category(name);

  RETURN jsonb_build_object('success', true, 'workspace_id', v_workspace_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_category_total_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace_id := OLD.workspace_id;
  ELSE
    v_workspace_id := NEW.workspace_id;
  END IF;

  UPDATE public.workspace_budgets AS wb
  SET amount = COALESCE((
        SELECT SUM(category.amount)
        FROM public.workspace_categories AS category
        WHERE category.workspace_id = v_workspace_id
      ), 0),
      updated_at = now()
  WHERE wb.workspace_id = v_workspace_id
    AND wb.mode = 'category_total';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_category_total_budget ON public.workspace_categories;
CREATE TRIGGER trg_recalculate_category_total_budget
  AFTER INSERT OR UPDATE OF amount OR DELETE ON public.workspace_categories
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_category_total_budget();

CREATE OR REPLACE FUNCTION public.save_workspace_budget(
  p_workspace_id UUID,
  p_amount NUMERIC,
  p_mode TEXT,
  p_period_type TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saved public.workspace_budgets%ROWTYPE;
  v_category_total NUMERIC(12, 2);
BEGIN
  IF NOT public.is_workspace_admin(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only workspace owners and admins can change budget settings';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('fixed', 'category_total', 'capped') THEN
    RAISE EXCEPTION 'Invalid workspace budget mode';
  END IF;
  IF p_period_type IS NULL OR p_period_type NOT IN ('monthly', 'yearly', 'custom') THEN
    RAISE EXCEPTION 'Invalid workspace budget period';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Workspace amount must be zero or more';
  END IF;
  IF p_period_type = 'custom' AND (
    p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date
  ) THEN
    RAISE EXCEPTION 'A valid custom start and end date are required';
  END IF;
  IF p_period_type <> 'custom' AND (p_start_date IS NOT NULL OR p_end_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Start and end dates are only valid for a custom period';
  END IF;

  SELECT * INTO v_saved
  FROM public.workspace_budgets
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace budget settings are missing';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_category_total
  FROM public.workspace_categories
  WHERE workspace_id = p_workspace_id;
  IF p_mode = 'capped' AND v_category_total > p_amount THEN
    RAISE EXCEPTION 'Category allocations total % and exceed the workspace limit %',
      v_category_total, p_amount;
  END IF;

  INSERT INTO public.workspace_budgets (
    workspace_id, amount, mode, period_type, start_date, end_date, updated_at
  )
  VALUES (
    p_workspace_id,
    CASE WHEN p_mode = 'category_total' THEN v_category_total ELSE p_amount END,
    p_mode,
    p_period_type,
    p_start_date,
    p_end_date,
    now()
  )
  ON CONFLICT (workspace_id) DO UPDATE
  SET amount = EXCLUDED.amount,
      mode = EXCLUDED.mode,
      period_type = EXCLUDED.period_type,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      updated_at = now()
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object('success', true, 'workspace_id', v_saved.workspace_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_workspace_category(
  p_workspace_id UUID,
  p_category_id UUID,
  p_name TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saved public.workspace_categories%ROWTYPE;
  v_workspace_budget public.workspace_budgets%ROWTYPE;
  v_other_total NUMERIC(12, 2);
  v_existing_name TEXT;
  v_name TEXT := trim(COALESCE(p_name, ''));
BEGIN
  IF NOT public.is_workspace_admin(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only workspace owners and admins can manage categories';
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Category name must be between 1 and 60 characters';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Category amount must be zero or more';
  END IF;

  SELECT * INTO v_workspace_budget
  FROM public.workspace_budgets
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace budget settings are missing';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_other_total
  FROM public.workspace_categories
  WHERE workspace_id = p_workspace_id
    AND (p_category_id IS NULL OR id <> p_category_id);
  IF v_workspace_budget.mode = 'capped'
    AND v_other_total + p_amount > v_workspace_budget.amount THEN
    RAISE EXCEPTION 'Category allocations cannot exceed the workspace limit of %',
      v_workspace_budget.amount;
  END IF;

  IF p_category_id IS NULL THEN
    INSERT INTO public.workspace_categories (workspace_id, name, amount)
    VALUES (p_workspace_id, v_name, p_amount)
    RETURNING * INTO v_saved;
  ELSE
    SELECT name INTO v_existing_name
    FROM public.workspace_categories
    WHERE id = p_category_id AND workspace_id = p_workspace_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Category not found in this workspace';
    END IF;
    IF v_existing_name <> v_name AND EXISTS (
      SELECT 1 FROM public.transactions
      WHERE workspace_id = p_workspace_id AND category = v_existing_name
    ) THEN
      RAISE EXCEPTION 'A category used by existing expenses cannot be renamed';
    END IF;

    UPDATE public.workspace_categories
    SET name = v_name, amount = p_amount
    WHERE id = p_category_id AND workspace_id = p_workspace_id
    RETURNING * INTO v_saved;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'category', jsonb_build_object(
      'id', v_saved.id,
      'workspace_id', v_saved.workspace_id,
      'name', v_saved.name,
      'amount', v_saved.amount
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_workspace_category(
  p_workspace_id UUID,
  p_category_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_name TEXT;
BEGIN
  IF NOT public.is_workspace_admin(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only workspace owners and admins can manage categories';
  END IF;

  SELECT name INTO v_category_name
  FROM public.workspace_categories
  WHERE id = p_category_id AND workspace_id = p_workspace_id
  FOR UPDATE;
  IF v_category_name IS NULL THEN
    RAISE EXCEPTION 'Category not found in this workspace';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE workspace_id = p_workspace_id AND category = v_category_name
  ) THEN
    RAISE EXCEPTION 'This category is used by existing expenses and cannot be deleted';
  END IF;

  DELETE FROM public.workspace_categories
  WHERE id = p_category_id AND workspace_id = p_workspace_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_workspace_budget(UUID, NUMERIC, TEXT, TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_workspace_budget(UUID, NUMERIC, TEXT, TEXT, DATE, DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.save_workspace_category(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_workspace_category(UUID, UUID, TEXT, NUMERIC) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_workspace_category(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_category(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_transaction_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  SELECT id INTO v_category_id
  FROM public.workspace_categories
  WHERE workspace_id = NEW.workspace_id AND name = NEW.category
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category does not exist in this workspace';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transaction_category ON public.transactions;
CREATE TRIGGER trg_validate_transaction_category
  BEFORE INSERT OR UPDATE OF workspace_id, category ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_category();

-- Delete a workspace only when called by its owner.
-- Remove the budget configuration explicitly, then let foreign keys cascade related data.
CREATE OR REPLACE FUNCTION public.delete_workspace(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Workspace not found or caller is not its owner';
  END IF;

  DELETE FROM public.workspace_budgets
  WHERE workspace_id = p_workspace_id;

  DELETE FROM public.workspaces
  WHERE id = p_workspace_id
    AND owner_id = v_user_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found or caller is not its owner';
  END IF;

  RETURN jsonb_build_object('success', true, 'workspace_id', v_deleted_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_workspace(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace(UUID) TO authenticated;

-- Assign or invite an existing registered user to a workspace
CREATE OR REPLACE FUNCTION public.assign_workspace_member(
  p_workspace_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_user_id UUID;
  v_target_name TEXT;
  v_is_ws_owner BOOLEAN;
  v_is_ws_admin BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  p_role := lower(trim(p_role));
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or member';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_ws_owner
  FROM public.workspaces WHERE id = p_workspace_id;

  v_is_ws_admin := public.is_workspace_admin(p_workspace_id, v_caller_id);

  -- Only owners can assign admins
  IF p_role = 'admin' AND NOT v_is_ws_owner THEN
    RAISE EXCEPTION 'Unauthorized: Only workspace owners can assign workspace admins';
  END IF;

  -- Only owners and admins can assign members
  IF NOT v_is_ws_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and admins can assign members';
  END IF;

  -- Find target profile by email
  SELECT id, name INTO v_target_user_id, v_target_name
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email));

  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_FOUND',
      'message', 'No registered MoneyUndo user found with that email. The user must register an account first, or be invited via the Edge Function.'
    );
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, v_target_user_id, p_role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target_user_id,
    'name', v_target_name,
    'role', p_role
  );
END;
$$;

-- Remove a member from a workspace
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_ws_owner BOOLEAN;
  v_is_ws_admin BOOLEAN;
  v_target_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Users can always remove themselves (leave workspace)
  IF v_caller_id = p_target_user_id THEN
    DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;
    RETURN jsonb_build_object('success', true, 'action', 'left');
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_ws_owner
  FROM public.workspaces WHERE id = p_workspace_id;

  v_is_ws_admin := public.is_workspace_admin(p_workspace_id, v_caller_id);

  IF NOT v_is_ws_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and admins can remove members';
  END IF;

  SELECT role INTO v_target_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;

  -- Admins cannot remove other admins or owners
  IF v_target_role = 'admin' AND NOT v_is_ws_owner THEN
    RAISE EXCEPTION 'Unauthorized: Workspace admins cannot remove other admins. Only the owner can.';
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'action', 'removed');
END;
$$;

-- ==============================================================================
-- Restrictive Row Level Security (RLS) Policies
-- ==============================================================================

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS "Allow anon access for workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow anon access for family_members" ON public.family_members;
DROP POLICY IF EXISTS "Allow anon access for monthly_budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Allow anon access for transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon read and write on workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow anon read and write on family_members" ON public.family_members;
DROP POLICY IF EXISTS "Allow anon read and write on monthly_budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Allow anon read and write on transactions" ON public.transactions;

-- Drop any previous restrictive policies to cleanly reapply
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces insert policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces update policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces delete policy" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members insert policy" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members update policy" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members delete policy" ON public.workspace_members;
DROP POLICY IF EXISTS "Monthly budgets select policy" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Monthly budgets modify policy" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Workspace budgets select policy" ON public.workspace_budgets;
DROP POLICY IF EXISTS "Workspace categories select policy" ON public.workspace_categories;
DROP POLICY IF EXISTS "Transactions select policy" ON public.transactions;
DROP POLICY IF EXISTS "Transactions modify policy" ON public.transactions;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 2. Workspaces Policies
CREATE POLICY "Workspaces select policy"
    ON public.workspaces FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(id, auth.uid()));

CREATE POLICY "Workspaces insert policy"
    ON public.workspaces FOR INSERT
    TO authenticated
    WITH CHECK (public.is_owner(auth.uid()) AND owner_id = auth.uid());

CREATE POLICY "Workspaces update policy"
    ON public.workspaces FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspaces delete policy"
    ON public.workspaces FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- 3. Workspace Members Policies
CREATE POLICY "Workspace members select policy"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Workspace members insert policy"
    ON public.workspace_members FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_workspace_admin(workspace_id, auth.uid())
        AND (
            role = 'member'
            OR (SELECT owner_id = auth.uid() FROM public.workspaces WHERE id = workspace_id)
        )
    );

CREATE POLICY "Workspace members update policy"
    ON public.workspace_members FOR UPDATE
    TO authenticated
    USING (
        (SELECT owner_id = auth.uid() FROM public.workspaces WHERE id = workspace_id)
    )
    WITH CHECK (
        (SELECT owner_id = auth.uid() FROM public.workspaces WHERE id = workspace_id)
    );

CREATE POLICY "Workspace members delete policy"
    ON public.workspace_members FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR (SELECT owner_id = auth.uid() FROM public.workspaces WHERE id = workspace_id)
        OR (public.is_workspace_admin(workspace_id, auth.uid()) AND role = 'member')
    );

-- 4. Monthly Budgets Policies
CREATE POLICY "Monthly budgets select policy"
    ON public.monthly_budgets FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Monthly budgets modify policy"
    ON public.monthly_budgets FOR ALL
    TO authenticated
    USING (public.is_workspace_admin(workspace_id, auth.uid()))
    WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- Workspace budget configuration and categories are readable by workspace members.
-- All writes go through authorization-checked security-definer RPCs.
CREATE POLICY "Workspace budgets select policy"
    ON public.workspace_budgets FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Workspace categories select policy"
    ON public.workspace_categories FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()));

-- Transactions Policies
CREATE POLICY "Transactions select policy"
    ON public.transactions FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Transactions modify policy"
    ON public.transactions FOR ALL
    TO authenticated
    USING (public.has_workspace_access(workspace_id, auth.uid()))
    WITH CHECK (public.has_workspace_access(workspace_id, auth.uid()));
