create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  referral_source text,
  profession text,
  onboarded_at timestamptz,
  invite_code TEXT UNIQUE,
  invite_codes text[] NOT NULL DEFAULT '{}',
  role text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  detail text not null default '',
  schedule jsonb not null default '{"type":"daily"}'::jsonb,
  completions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index habits_user_id_idx on public.habits(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
alter table public.habits enable row level security;
create policy "Users can view own habits" on public.habits for select using (auth.uid() = user_id);
create policy "Users can insert own habits" on public.habits for insert with check (auth.uid() = user_id);
create policy "Users can update own habits" on public.habits for update using (auth.uid() = user_id);
create policy "Users can delete own habits" on public.habits for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger habits_updated_at before update on public.habits for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.parent_child_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  child_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, child_user_id),
  CHECK (parent_user_id <> child_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child_links TO authenticated;
GRANT ALL ON public.parent_child_links TO service_role;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own links" ON public.parent_child_links FOR SELECT USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);
CREATE POLICY "Users can create links involving themselves" ON public.parent_child_links FOR INSERT WITH CHECK (auth.uid() = parent_user_id OR auth.uid() = child_user_id);
CREATE POLICY "Users can delete their own links" ON public.parent_child_links FOR DELETE USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);

CREATE OR REPLACE FUNCTION public.find_profile_by_invite_code(_code TEXT)
RETURNS TABLE(id UUID, profession TEXT, display_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, profession, display_name
  FROM public.profiles
  WHERE invite_code = _code OR _code = ANY(invite_codes)
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.find_profile_by_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_invite_code(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_children()
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name
  FROM public.parent_child_links l
  JOIN public.profiles p ON p.id = l.child_user_id
  WHERE l.parent_user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_children() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_children() TO authenticated;

CREATE TABLE public.habit_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL,
  child_user_id uuid NOT NULL,
  parent_user_id uuid NOT NULL,
  date text NOT NULL,
  image_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_approvals TO authenticated;
GRANT ALL ON public.habit_approvals TO service_role;

CREATE INDEX idx_habit_approvals_parent ON public.habit_approvals(parent_user_id, status);
CREATE INDEX idx_habit_approvals_child ON public.habit_approvals(child_user_id, status);
CREATE UNIQUE INDEX uniq_habit_approvals_pending
  ON public.habit_approvals(habit_id, date) WHERE status = 'pending';

ALTER TABLE public.habit_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own approvals" ON public.habit_approvals
  FOR SELECT USING (auth.uid() = child_user_id OR auth.uid() = parent_user_id);

CREATE POLICY "child inserts own approvals" ON public.habit_approvals
  FOR INSERT WITH CHECK (auth.uid() = child_user_id);

CREATE POLICY "parent updates approvals" ON public.habit_approvals
  FOR UPDATE USING (auth.uid() = parent_user_id);

CREATE POLICY "child uploads own proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'habit-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "child views own proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'habit-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "linked parent views child proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'habit-proofs'
    AND EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid()
        AND child_user_id::text = (storage.foldername(name))[1]
    )
  );