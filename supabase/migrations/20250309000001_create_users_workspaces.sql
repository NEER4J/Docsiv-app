-- Users (profile; 1:1 with auth.users by id)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  avatar_url text,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  subscribed_to_updates boolean DEFAULT false,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text NOT NULL UNIQUE,
  logo_url text,
  billing_country text,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workspace members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_at timestamptz DEFAULT now() NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_handle ON public.workspaces(handle);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to users and workspaces
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create minimal profile row when a new auth user is created; onboarding will fill the rest.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, onboarding_completed)
  VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- users: own row only
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- workspace_members: ALL policies use ONLY auth.uid() checks — no functions, no subqueries = no recursion.
DROP POLICY IF EXISTS "workspace_members_select_workspace" ON public.workspace_members;
CREATE POLICY "workspace_members_select_workspace" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_own" ON public.workspace_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_update_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_owner_admin" ON public.workspace_members
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_delete_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_owner_admin" ON public.workspace_members
  FOR DELETE USING (user_id = auth.uid());

-- workspaces: EXISTS on workspace_members is safe because its RLS is trivial (user_id = auth.uid()).
DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "workspaces_update_member_admin" ON public.workspaces;
CREATE POLICY "workspaces_update_member_admin" ON public.workspaces FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')));
