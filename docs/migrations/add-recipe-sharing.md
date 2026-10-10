# Migration: sharing recipes between households (`recipe_shares`, `recipes.copied_from`)

For `docs/PLAN-RECIPE-SHARING.md` (10 Oct 2026). One household lets another browse its whole recipe library, read-only. The
other household copies what it wants into its own library with ADD TO OUR RECIPES. Each household keeps its own recipe database;
plans, the diary, notes, shopping ticks and the calendar are never shared.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo. It carries DDL only and no data.)*

**Applied by the household on 10 Oct 2026**, before PR #74 merged; its check queries run read-only at 16:15 UTC (`docs/INFRASTRUCTURE.md`). Tested before that, on 10 Oct 2026, on a scratch Postgres 16 built to the live shape (roles, `auth.users`, `auth.uid()`,
the households, members and recipes tables with their live policies), applied as a non-superuser like the live `postgres`:
it applies; before a share the viewer gets no rows and its own `select` returns only its own recipes; SHARE refuses an unknown
email, its own household, a two-household account and an account with no household, and succeeds once, harmlessly twice; the
viewer then reads the owner's two recipes (no favourite or source-photo columns) and still only its own through `select`; a
copy into its own household lands with `copied_from`, and an insert into the owner's household is refused; neither side can
write `recipe_shares` directly; the viewer cannot stop the owner's share, the owner can; a stranger and a two-household
account get nothing; `anon` cannot call any of it; the check queries below give what they say; the undo runs. On the live
project, `postgres` can read `auth.users` (read-only check, 10 Oct), which SHARE needs.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries the app's side.** A
session does not apply it (`CLAUDE.md`). Paste the whole statement below and run it once; it is one transaction.

## The statement

Drafted from the live schema (read-only, 10 Oct 2026): `households`, `household_members` (one membership per account today), the
`recipes` columns and its four `TO authenticated` policies, and `private.household_ids_for_user()`, which every policy uses.

```sql
begin;

-- Where a copied recipe came from: the other household's recipe id. No foreign key, because the original may be deleted
-- and the copy must live on. Null on every recipe that was not copied.
alter table public.recipes add column copied_from uuid;

-- "owner_household lets viewer_household browse its recipes". One row per direction; each side switches its own on.
create table public.recipe_shares (
  owner_household uuid not null references public.households(id) on delete cascade,
  viewer_household uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_household, viewer_household),
  constraint recipe_shares_not_self check (owner_household <> viewer_household)
);
alter table public.recipe_shares enable row level security;
create policy "see own household's shares" on public.recipe_shares for select to authenticated
  using (owner_household in (select private.household_ids_for_user())
      or viewer_household in (select private.household_ids_for_user()));
revoke all on table public.recipe_shares from anon, authenticated;
grant select on table public.recipe_shares to authenticated;

-- The signed-in account's one household, or null if it has none or more than one.
create function private.my_household() returns uuid language sql stable security definer set search_path = '' as $$
  select case when count(*) = 1 then min(household_id::text)::uuid end
  from public.household_members where user_id = auth.uid();
$$;
revoke all on function private.my_household() from public, anon, authenticated;

-- Let the household of the account with this email browse our recipes. Answers {ok, household, name} or {error}.
create function public.share_recipes_with(p_email text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mine uuid := private.my_household();
  v_user uuid;
  v_target uuid;
  v_count int;
  v_name text;
begin
  if v_mine is null then return jsonb_build_object('error', 'Your account is not in exactly one household'); end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return jsonb_build_object('error', 'No account uses that email'); end if;
  select count(*), min(household_id::text)::uuid into v_count, v_target from public.household_members where user_id = v_user;
  if v_count = 0 then return jsonb_build_object('error', 'That account is not in a household yet'); end if;
  if v_count > 1 then return jsonb_build_object('error', 'That account is in more than one household'); end if;
  if v_target = v_mine then return jsonb_build_object('error', 'That account is in your own household'); end if;
  insert into public.recipe_shares (owner_household, viewer_household) values (v_mine, v_target) on conflict do nothing;
  select name into v_name from public.households where id = v_target;
  return jsonb_build_object('ok', true, 'household', v_target, 'name', v_name);
end;
$$;

-- Stop letting that household browse our recipes. Only ever removes our own share.
create function public.stop_sharing_with(p_household uuid) returns void language sql security definer set search_path = '' as $$
  delete from public.recipe_shares where owner_household = private.my_household() and viewer_household = p_household;
$$;

-- The households we let browse our recipes, by name.
create function public.households_i_share_with() returns table (household_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name from public.recipe_shares s join public.households h on h.id = s.viewer_household
  where s.owner_household = private.my_household() order by h.name;
$$;

-- The households that let us browse theirs, with how many recipes each has.
create function public.households_sharing_with_me() returns table (household_id uuid, name text, recipes bigint)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name, (select count(*) from public.recipes r where r.household_id = h.id)
  from public.recipe_shares s join public.households h on h.id = s.owner_household
  where s.viewer_household = private.my_household() order by h.name;
$$;

-- That household's recipes, only if it shares with ours; otherwise nothing. Never their favourites or source photos.
create function public.shared_recipes(p_owner uuid)
returns table (id uuid, title text, source text, source_url text, image_url text, time_text text, servings integer,
               equipment text, tags jsonb, syntax text, date_added date, source_check jsonb)
language sql stable security definer set search_path = '' as $$
  select r.id, r.title, r.source, r.source_url, r.image_url, r.time_text, r.servings,
         r.equipment, r.tags, r.syntax, r.date_added, r.source_check
  from public.recipes r
  where r.household_id = p_owner
    and exists (select 1 from public.recipe_shares s
                where s.owner_household = p_owner and s.viewer_household = private.my_household())
  order by r.title;
$$;

-- Name our own household, as the other side will see it ("Smiths' recipes"). 1 to 40 characters.
create function public.set_household_name(p_name text) returns text language plpgsql security definer set search_path = '' as $$
declare v_mine uuid := private.my_household(); v_name text := left(trim(coalesce(p_name, '')), 40);
begin
  if v_mine is null or v_name = '' then return null; end if;
  update public.households set name = v_name where id = v_mine;
  return v_name;
end;
$$;

revoke all on function public.share_recipes_with(text) from public, anon;
revoke all on function public.stop_sharing_with(uuid) from public, anon;
revoke all on function public.households_i_share_with() from public, anon;
revoke all on function public.households_sharing_with_me() from public, anon;
revoke all on function public.shared_recipes(uuid) from public, anon;
revoke all on function public.set_household_name(text) from public, anon;
grant execute on function public.share_recipes_with(text) to authenticated;
grant execute on function public.stop_sharing_with(uuid) to authenticated;
grant execute on function public.households_i_share_with() to authenticated;
grant execute on function public.households_sharing_with_me() to authenticated;
grant execute on function public.shared_recipes(uuid) to authenticated;
grant execute on function public.set_household_name(text) to authenticated;

commit;
```

## Why each part is there

- **The `recipes` policies are not widened.** `hydrate()` reads `recipes` with no household filter and relies on row-level
  security for "only ours". A wider select policy would pour the other household's recipes into our library, plan and shopping
  list. So the other library is reached only through `shared_recipes()`, which checks a share exists first, and our own reads are
  untouched.
- **`recipes.copied_from`:** lets the app say ALREADY IN OUR RECIPES on the original's card. The app names the column only on a
  copy, never on an ordinary save, as `recipeToRow` does for `source_check`.
- **`recipe_shares`:** one row per direction, so each household decides for itself whether the other may browse. Either side
  can see the rows it is part of (so the app can say "they share with you"), but no one can write them directly:
  `share_recipes_with` and `stop_sharing_with` are the only ways in, and each only ever writes our own household's share.
- **`private.my_household()`:** the account's household when it has exactly one, as the app and both calendar functions already
  assume. With none or several, every function does nothing.
- **Sharing by email:** the person sharing knows the other household's email, and nothing lists every household in the project
  (the weekly live test has one of its own).
- **`set_household_name`:** `households` has no update policy, and `name` is still the default "Household". This lets Settings
  set it without opening the table to writes.
- **The default privileges** grant `execute` on every new function in `public` to `anon`; each `revoke … from public, anon`
  takes that back. Only signed-in accounts can call them.

## Why it is safe to apply first

`copied_from` is nullable and the app live today never names it. The table and functions are new and nothing calls them until
the app's side is merged. No existing policy, grant or column changes.

## After it is applied

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'recipes' and column_name = 'copied_from';
-- expect: copied_from | uuid | YES
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename in ('recipe_shares', 'recipes') order by 1;
-- expect the four recipes policies as before, plus "see own household's shares" | SELECT | {authenticated}
select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') authed
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('share_recipes_with', 'stop_sharing_with', 'households_i_share_with',
       'households_sharing_with_me', 'shared_recipes', 'set_household_name') order by 1;
-- expect six rows, each: false | true
select count(*) from public.recipe_shares;
-- expect 0 until a household taps SHARE
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

Put the app back first if its side has been merged. Copies already made stay as ordinary recipes of their household.

```sql
begin;
drop function public.share_recipes_with(text);
drop function public.stop_sharing_with(uuid);
drop function public.households_i_share_with();
drop function public.households_sharing_with_me();
drop function public.shared_recipes(uuid);
drop function public.set_household_name(text);
drop function private.my_household();
drop table public.recipe_shares;
alter table public.recipes drop column copied_from;
commit;
```
