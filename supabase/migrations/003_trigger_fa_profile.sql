-- ============================================================
-- Migration 003 — Auto-create fa_profile on signup
-- ============================================================
-- When a new row appears in auth.users (user signed up),
-- insert a matching row into public.fa_profiles so every auth
-- user has a profile to write to without a separate request.
--
-- `display_name` is pulled from raw_user_meta_data (set by
-- options.data on signUp — see src/app/signup/page.tsx).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fa_profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;  -- idempotent
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
